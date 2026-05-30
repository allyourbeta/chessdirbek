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
import os
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

_MODELS_URL = "https://github.com/tsoj/Chess_diagram_to_FEN/releases/download/1.0/models.zip"

_get_fen = None  # cached only on success


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


def _load():
    """Return None on success, or the import error string (not cached)."""
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


def import_error():
    return _load()


def is_available():
    return _load() is None


def download_models():
    """Download + extract the pretrained models (pure Python, no wget)."""
    pkg = _package_dir()
    pkg.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(_MODELS_URL, headers={"User-Agent": "chessquiz-ocr"})
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
    flipped = getattr(result, "is_black_perspective", None)
    if isinstance(flipped, bool):
        return "black" if flipped else "white"
    try:
        return "black" if fen.split()[1] == "b" else "white"
    except (IndexError, AttributeError):
        return "white"


def recognize_fen(image_bytes):
    """Recognize a chess diagram. Returns {'fen': str, 'orientation': str}."""
    if _load() is not None:
        raise OcrUnavailable(_load() or "OCR engine is not installed")
    from PIL import Image  # lazy

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    with _in_package_dir():
        result = _get_fen(
            img=img,
            game="chess",
            auto_rotate_image=True,
            auto_rotate_board=True,
        )
    fen = getattr(result, "fen", None) or str(result)
    return {"fen": fen, "orientation": _orientation_from(result, fen)}
