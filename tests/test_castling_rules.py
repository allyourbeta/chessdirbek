"""Unit tests for the single home of castling-rights logic.

Pure functions, no DB, no FastAPI. tier: fast.
"""

from backend.services import chess_service

START_BOARD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
START_FEN = START_BOARD + " w KQkq - 0 1"


def test_supported_castling_start_position():
    assert chess_service.supported_castling(START_BOARD) == "KQkq"


def test_supported_castling_king_moved():
    # White king on f1 instead of e1: white loses both rights, black keeps both.
    board = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1KNR"
    assert chess_service.supported_castling(board) == "kq"


def test_supported_castling_one_rook_missing():
    # h1 rook gone: kingside-white right gone, the other three remain.
    board = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1"
    assert chess_service.supported_castling(board) == "Qkq"


def test_normalize_castling_board_only_gets_full_rights():
    out = chess_service.normalize_castling(START_BOARD)
    assert out == START_FEN


def test_normalize_castling_dash_stays_dash():
    out = chess_service.normalize_castling(START_BOARD + " w - - 0 1")
    assert out == START_BOARD + " w - - 0 1"


def test_normalize_castling_trims_unsupported_rights():
    board = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1"  # h1 rook missing
    out = chess_service.normalize_castling(board + " w KQkq - 0 1")
    assert out == board + " w Qkq - 0 1"


def test_normalize_castling_no_rights_possible():
    board = "8/8/8/8/8/8/8/8"  # empty board
    out = chess_service.normalize_castling(board + " w KQkq - 0 1")
    assert out == board + " w - - 0 1"


def test_normalize_castling_missing_side_defaults_white():
    out = chess_service.normalize_castling(START_BOARD + " - - 0 1")
    assert out.split()[1] == "w"


def test_position_key_full_and_board_only_match():
    assert chess_service.position_key(START_FEN) == chess_service.position_key(START_BOARD)
    assert chess_service.position_key(START_FEN) == START_BOARD + " w"


def test_position_key_differs_by_side_to_move():
    white = chess_service.position_key(START_BOARD + " w KQkq - 0 1")
    black = chess_service.position_key(START_BOARD + " b KQkq - 0 1")
    assert white != black
