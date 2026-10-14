"""Tests for OCR warm-up: the lock, warm_up(), and the race it guards against.

Stubs only at the import boundary (`chess_diagram_to_fen` in `sys.modules`) —
never by patching `_load`/`warm_up`/`recognize_fen` themselves, so these tests
exercise the real locking code, not a mock of it.
"""

import logging
import sys
import threading
import time
import types

import pytest

from backend.services import ocr_service


@pytest.fixture(autouse=True)
def _reset_ocr_state():
    """Each test gets a clean `_get_fen` and a clean `chess_diagram_to_fen` slot."""
    prev_get_fen = ocr_service._get_fen
    had_module = "chess_diagram_to_fen" in sys.modules
    prev_module = sys.modules.get("chess_diagram_to_fen")
    ocr_service._get_fen = None
    yield
    ocr_service._get_fen = prev_get_fen
    if had_module:
        sys.modules["chess_diagram_to_fen"] = prev_module
    else:
        sys.modules.pop("chess_diagram_to_fen", None)


def _fake_result(fen="8/8/8/8/8/8/8/8 w - - 0 1", flipped=False):
    return types.SimpleNamespace(fen=fen, board_is_flipped=flipped)


class _SlowImportStub:
    """Stands in for the real recognizer module. Accessing `get_fen` (what
    `from chess_diagram_to_fen import get_fen` does) is slow and counted, so a
    race between two unsynchronized importers would show up as >1 access."""

    def __init__(self, delay=0.05):
        self.access_times = []
        self._delay = delay

    @property
    def get_fen(self):
        self.access_times.append(time.monotonic())
        time.sleep(self._delay)
        return lambda **kwargs: _fake_result()


def test_two_threads_load_once():
    stub = _SlowImportStub()
    sys.modules["chess_diagram_to_fen"] = stub

    results = []

    def worker():
        results.append(ocr_service._load())

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=2)

    assert results == [None, None], results
    assert len(stub.access_times) == 1, (
        f"expected exactly one import, got {len(stub.access_times)} "
        "-- _load() is not serializing concurrent callers"
    )
    assert ocr_service._get_fen is not None


def test_warm_up_skips_when_unavailable(caplog):
    # None in sys.modules is the standard trick to make the next import of
    # this name raise ImportError, without touching _load()/warm_up() code.
    sys.modules["chess_diagram_to_fen"] = None

    with caplog.at_level(logging.INFO, logger="backend.services.ocr_service"):
        ocr_service.warm_up()  # must not raise

    assert any("OCR warm-up skipped" in r.message for r in caplog.records), caplog.records
    assert ocr_service._get_fen is None


def test_warm_up_survives_blank_image_failure(caplog):
    def boom(**kwargs):
        raise RuntimeError("no board found in blank image")

    stub = types.SimpleNamespace(get_fen=boom)
    sys.modules["chess_diagram_to_fen"] = stub

    with caplog.at_level(logging.INFO, logger="backend.services.ocr_service"):
        ocr_service.warm_up()  # must not raise despite the stub raising

    assert ocr_service._get_fen is boom, "loading succeeded, so _get_fen must stay set"
    assert any("OCR warm-up done" in r.message for r in caplog.records), caplog.records


def test_recognize_fen_waits_for_warm_up():
    order = []

    def get_fen_stub(**kwargs):
        order.append(("start", time.monotonic()))
        time.sleep(0.2)
        order.append(("end", time.monotonic()))
        return _fake_result()

    stub = types.SimpleNamespace(get_fen=get_fen_stub)
    sys.modules["chess_diagram_to_fen"] = stub

    warm_up_thread = threading.Thread(target=ocr_service.warm_up)
    warm_up_thread.start()
    time.sleep(0.05)  # let warm_up get inside its locked recognize_fen call

    result_holder = {}

    def call_real():
        result_holder["result"] = ocr_service.recognize_fen(ocr_service._blank_image_bytes())

    real_thread = threading.Thread(target=call_real)
    real_thread.start()

    warm_up_thread.join(timeout=2)
    real_thread.join(timeout=2)

    assert "result" in result_holder
    assert result_holder["result"]["fen"]

    starts = [t for label, t in order if label == "start"]
    ends = [t for label, t in order if label == "end"]
    assert len(starts) == 2 and len(ends) == 2, order
    # The real call's recognizer invocation must not start until warm-up's
    # own invocation finished -- proof the lock serializes them.
    assert starts[1] >= ends[0], "recognize_fen ran concurrently with warm_up instead of waiting"
