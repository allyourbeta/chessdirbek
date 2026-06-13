"""Unit tests for OCR import orientation + side-to-move derivation.

The recognizer always returns a canonical, white-on-bottom, white-to-move FEN
plus a `board_is_flipped` flag. This app's capture convention is "the side at
the bottom of the photo is the side to move", so that one flag must drive BOTH:

    board_is_flipped=True  -> orientation 'black' AND side-to-move 'b'
    board_is_flipped=False -> orientation 'white' AND side-to-move 'w' (unchanged)

Regression guard: this used to read a non-existent attribute (`is_black_perspective`)
and fall through to the FEN's side-to-move field — which OCR hardcodes to 'w' —
so every import came back 'white'. These tests pin the corrected behaviour.

Pure functions only: no model, no image, no DB. Runnable directly:
    python tests/test_ocr_orientation.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services import chess_service
from backend.services.ocr_service import _orientation_from, _build_result


# A representative canonical recognizer FEN: white on bottom, white to move,
# castling '-' (tsoj emits '-'), exactly as get_fen() would hand it back.
CANON = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w - - 0 1"


class FakeResult:
    """Mimics the tsoj FenResult fields we actually read."""
    def __init__(self, fen, board_is_flipped):
        self.fen = fen
        self.board_is_flipped = board_is_flipped


def _field(fen, i):
    return fen.split(" ")[i]


def test_set_side_to_move():
    # w -> b flips only the side-to-move field; placement is untouched.
    out = chess_service.set_side_to_move(CANON, "b")
    assert _field(out, 1) == "b", out
    assert _field(out, 0) == _field(CANON, 0), "placement must not change"
    # w -> w is a no-op in meaning.
    assert _field(chess_service.set_side_to_move(CANON, "w"), 1) == "w"
    # Already-black stays black.
    black = chess_service.set_side_to_move(CANON, "b")
    assert _field(chess_service.set_side_to_move(black, "b"), 1) == "b"
    # Bad side -> unchanged.
    assert chess_service.set_side_to_move(CANON, "sideways") == CANON
    # Unparseable FEN -> returned unchanged, never raises.
    assert chess_service.set_side_to_move("not a fen", "b") == "not a fen"
    # Works on a legally-incomplete OCR-style position (no kings).
    nokings = "8/8/8/4q3/3R4/8/8/8 w - - 0 1"
    assert _field(chess_service.set_side_to_move(nokings, "b"), 1) == "b"
    print("PASS  set_side_to_move flips turn, preserves placement, fails safe")


def test_orientation_from_reads_board_is_flipped():
    assert _orientation_from(FakeResult(CANON, True), CANON) == "black"
    assert _orientation_from(FakeResult(CANON, False), CANON) == "white"
    print("PASS  _orientation_from reads board_is_flipped")


def test_build_result_flipped_sets_black_and_side_b():
    out = _build_result(FakeResult(CANON, True))
    assert out["orientation"] == "black", out
    assert _field(out["fen"], 1) == "b", out
    # Crucial: the board itself must NOT be rotated — only the turn changes.
    assert _field(out["fen"], 0) == _field(CANON, 0), "placement must not change"
    print("PASS  flipped board -> orientation 'black' + side-to-move 'b'")


def test_build_result_not_flipped_is_unchanged():
    out = _build_result(FakeResult(CANON, False))
    assert out["orientation"] == "white", out
    assert _field(out["fen"], 1) == "w", out
    assert out["fen"] == CANON, "white-on-bottom output must equal input FEN"
    print("PASS  un-flipped board -> orientation 'white', FEN unchanged")


def main():
    test_set_side_to_move()
    test_orientation_from_reads_board_is_flipped()
    test_build_result_flipped_sets_black_and_side_b()
    test_build_result_not_flipped_is_unchanged()
    print("\nAll OCR orientation tests passed.")


if __name__ == "__main__":
    main()
