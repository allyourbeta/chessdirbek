"""Board-image -> FEN recognition + model management.

Wraps the open-source `tsoj/Chess_diagram_to_FEN` recognizer (MIT). Heavy deps
(PyTorch, the model) are imported lazily, so the backend runs fine before OCR is
installed. Import failures are NOT cached, so status flips to available as soon
as the package/model are in place.

tsoj opens some resources via paths relative to the *current working directory*
(it assumes you run it from inside its own folder). Our server runs from the
project root, so we temporarily chdir into the package directory around the
import and each recognition call. Single-user/local, so the brief cwd change is
acceptable.
"""

import contextlib
import io
import logging
import os
import shutil
import tempfile
import threading
import time
import urllib.request
import zipfile
from pathlib import Path

from . import chess_service

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    # uvicorn configures its own "uvicorn.*" loggers but leaves the root
    # logger's level at WARNING, so an INFO call here would otherwise be
    # silently dropped in the real server process. Attach our own handler so
    # the warm-up line always reaches stderr (-> /tmp/chessdirbek.log via the
    # LaunchAgent), independent of whatever the root logger is doing.
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(name)s: %(message)s"))
    logger.addHandler(_handler)

_MODELS_URL = "https://github.com/tsoj/Chess_diagram_to_FEN/releases/download/1.0/models.zip"

_get_fen = None  # cached only on success

# Guards the one-time import of the recognizer AND every call into it: the
# recognizer's own `_in_package_dir()` changes the process-wide cwd, so two
# overlapping calls (e.g. a warm-up and a real capture) must never interleave.
_lock = threading.Lock()


class OcrUnavailable(RuntimeError):
    """Raised when the OCR engine/model is not installed on this machine."""


def _package_dir():
    """Directory of the recognizer (where its models/ and resources/ live)."""
    vendor = Path(__file__).resolve().parents[1] / "vendor" / "Chess_diagram_to_FEN"
    if vendor.is_dir():
        return vendor
    try:
        import chess_diagram_to_fen  # type: ignore
        return Path(chess_diagram_to_fen.__file__).resolve().parent
    except Exception:
        return vendor


@contextlib.contextmanager
def _in_package_dir():
    """Run a block with cwd set to the package dir, so its relative paths resolve."""
    pkg = _package_dir()
    prev = os.getcwd()
    try:
        if pkg.is_dir():
            os.chdir(pkg)
        yield
    finally:
        os.chdir(prev)


def models_dir():
    return _package_dir() / "models" / "chess"


def models_present():
    d = models_dir()
    return d.is_dir() and any(d.glob("*.pth"))


def _load_locked():
    """Same as `_load()`, but assumes `_lock` is already held."""
    global _get_fen
    if _get_fen is not None:
        return None
    try:
        with _in_package_dir():
            from chess_diagram_to_fen import get_fen  # type: ignore
            _get_fen = get_fen
        return None
    except Exception as exc:
        return str(exc)


def _load():
    """Return None on success, or the import error string (not cached)."""
    if _get_fen is not None:
        return None
    with _lock:
        return _load_locked()


def import_error():
    return _load()


def is_available():
    return _load() is None


def download_models():
    """Download + extract the pretrained models (pure Python, no wget)."""
    pkg = _package_dir()
    pkg.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(_MODELS_URL, headers={"User-Agent": "chessdirbek-ocr"})
    with urllib.request.urlopen(req, timeout=300) as resp, \
            tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        shutil.copyfileobj(resp, tmp)
        tmp_path = tmp.name
    try:
        with zipfile.ZipFile(tmp_path) as zf:
            zf.extractall(pkg)
    finally:
        os.unlink(tmp_path)
    return models_present()


def _orientation_from(result, fen):
    for attr in ("orientation", "perspective"):
        val = getattr(result, attr, None)
        if isinstance(val, str) and val.lower() in ("white", "black"):
            return val.lower()
    # The tsoj recognizer exposes the perspective it detected as `board_is_flipped`
    # (True when the diagram was captured from Black's side). This is the real
    # orientation signal; everything below is a defensive fallback only.
    flipped = getattr(result, "board_is_flipped", None)
    if isinstance(flipped, bool):
        return "black" if flipped else "white"
    try:
        return "black" if fen.split()[1] == "b" else "white"
    except (IndexError, AttributeError):
        return "white"


def _build_result(result):
    """Map a recognizer result to {'fen', 'orientation'} (pure, no I/O).

    Capture convention (personal app): the side shown at the bottom of the photo
    is also the side to move. The recognizer returns a canonical white-on-bottom
    FEN — and, because it can't see whose turn it is, always with 'w' to move —
    plus a perspective flag. We map that one signal to BOTH fields:

        Black's perspective -> orientation 'black' AND side-to-move 'b'
        White's perspective -> orientation 'white' AND side-to-move 'w'  (FEN unchanged)

    Kept separate from recognize_fen() so it can be unit-tested without a model
    or a real image.
    """
    fen = getattr(result, "fen", None) or str(result)
    orientation = _orientation_from(result, fen)
    if orientation == "black":
        fen = chess_service.set_side_to_move(fen, "b")
    return {"fen": fen, "orientation": orientation}


def recognize_fen(image_bytes):
    """Recognize a chess diagram. Returns {'fen': str, 'orientation': str}."""
    from PIL import Image  # lazy

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    with _lock:
        err = _load_locked()
        if err is not None:
            raise OcrUnavailable(err or "OCR engine is not installed")
        with _in_package_dir():
            result = _get_fen(
                img=img,
                game="chess",
                auto_rotate_image=True,
                auto_rotate_board=True,
            )
    return _build_result(result)


def _blank_image_bytes():
    """A tiny blank PNG, just to exercise the recognizer's model setup."""
    from PIL import Image  # lazy

    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color=(255, 255, 255)).save(buf, format="PNG")
    return buf.getvalue()


def warm_up():
    """Load the recognizer and run it once, so the hotkey's first real
    capture never pays for lazy model setup. Safe to call from a background
    thread at server startup; never raises.
    """
    start = time.monotonic()
    err = _load()
    if err is not None:
        logger.info("OCR warm-up skipped: %s", err)
        return
    try:
        recognize_fen(_blank_image_bytes())
    except Exception as exc:
        logger.info("OCR warm-up done in %.1fs (blank-image check raised: %s)", time.monotonic() - start, exc)
        return
    logger.info("OCR warm-up done in %.1fs", time.monotonic() - start)
