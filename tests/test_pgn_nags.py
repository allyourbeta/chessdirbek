"""Test NAG symbols in PGN parsing."""

from backend.services.pgn_service import parse_single_pgn


def test_nag_symbols_in_moves():
    """Test that NAG symbols (!, ?, !!, ??, !?, ?!) are appended to moves."""
    pgn = '1. e4! e5? 2. Nf3!! Nc6?! 3. Bb5!? a6'
    result = parse_single_pgn(pgn)
    assert result["error"] is None
    assert result["moves_san"][0] == "e4!"
    assert result["moves_san"][1] == "e5?"
    assert result["moves_san"][2] == "Nf3!!"
    assert result["moves_san"][3] == "Nc6?!"
    assert result["moves_san"][4] == "Bb5!?"
    assert result["moves_san"][5] == "a6"


def test_no_nag_unchanged():
    """Test that moves without NAGs are unchanged."""
    pgn = '1. e4 e5 2. Nf3 Nc6'
    result = parse_single_pgn(pgn)
    assert result["error"] is None
    assert result["moves_san"] == ["e4", "e5", "Nf3", "Nc6"]