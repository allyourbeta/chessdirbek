"""Chess logic services. Pure functions — no DB, no FastAPI imports.

Uses python-chess for FEN validation, pawn structure analysis, etc.
"""

import chess


def validate_fen(fen: str) -> tuple[bool, str]:
    """Validate a FEN string. Returns (is_valid, error_message)."""
    try:
        chess.Board(fen)
        return True, ""
    except ValueError as e:
        return False, str(e)


def set_side_to_move(fen: str, side: str) -> str:
    """Return `fen` with its side-to-move field set to `side` ('w' or 'b').

    Used by the image importer. The recognizer can't see whose turn it is in a
    still diagram, so it always emits 'w'; when a board is captured from Black's
    perspective we set it to 'b' to honour this app's capture convention (the
    side shown at the bottom is the side to move).

    python-chess accepts legally-incomplete positions (missing kings, pawns on
    the back rank, etc.) that the recognizer can produce, so this is safe for OCR
    output. If `side` is not 'w'/'b', or the FEN can't be parsed at all, the
    original FEN is returned unchanged so a bad recognition never aborts an import.
    """
    if side not in ("w", "b"):
        return fen
    try:
        board = chess.Board(fen)
    except (ValueError, IndexError):
        return fen
    board.turn = chess.WHITE if side == "w" else chess.BLACK
    return board.fen()


def get_board_info(fen: str) -> dict:
    """Extract useful info from a FEN position."""
    board = chess.Board(fen)
    return {
        "fen": fen,
        "turn": "white" if board.turn == chess.WHITE else "black",
        "is_check": board.is_check(),
        "is_checkmate": board.is_checkmate(),
        "is_stalemate": board.is_stalemate(),
        "legal_moves": [board.san(m) for m in board.legal_moves],
        "piece_count": _count_pieces(board),
        "pawn_structure": _get_pawn_structure(board),
    }


def get_pawn_structure(fen: str) -> dict:
    """Analyze pawn structure for a given FEN."""
    board = chess.Board(fen)
    return _get_pawn_structure(board)


def search_by_pawn_structure(
    target_fen: str, candidate_fens: list[str], tolerance: int = 1
) -> list[str]:
    """Find positions with similar pawn structures.

    Args:
        target_fen: The FEN to match against.
        candidate_fens: List of FENs to search through.
        tolerance: Max number of pawn differences allowed.

    Returns:
        List of FENs that match within tolerance.
    """
    target_board = chess.Board(target_fen)
    target_pawns = _get_pawn_squares(target_board)

    matches = []
    for fen in candidate_fens:
        try:
            board = chess.Board(fen)
            candidate_pawns = _get_pawn_squares(board)
            diff = len(target_pawns.symmetric_difference(candidate_pawns))
            if diff <= tolerance:
                matches.append(fen)
        except ValueError:
            continue
    return matches


def _count_pieces(board: chess.Board) -> dict:
    """Count pieces by type and color."""
    counts = {}
    for color_name, color in [("white", chess.WHITE), ("black", chess.BLACK)]:
        counts[color_name] = {}
        for piece_name, piece_type in [
            ("pawns", chess.PAWN),
            ("knights", chess.KNIGHT),
            ("bishops", chess.BISHOP),
            ("rooks", chess.ROOK),
            ("queens", chess.QUEEN),
        ]:
            counts[color_name][piece_name] = len(board.pieces(piece_type, color))
    return counts


def _get_pawn_structure(board: chess.Board) -> dict:
    """Analyze pawn structure: doubled, isolated, passed pawns."""
    structure = {"white": _analyze_color_pawns(board, chess.WHITE),
                 "black": _analyze_color_pawns(board, chess.BLACK)}
    return structure


def _analyze_color_pawns(board: chess.Board, color: chess.Color) -> dict:
    """Analyze pawn structure for one color."""
    pawns = board.pieces(chess.PAWN, color)
    pawn_files = [chess.square_file(sq) for sq in pawns]

    # Doubled pawns: files with more than one pawn
    from collections import Counter
    file_counts = Counter(pawn_files)
    doubled = [f for f, c in file_counts.items() if c > 1]

    # Isolated pawns: no friendly pawn on adjacent files
    isolated = []
    for f in set(pawn_files):
        adjacent = {f - 1, f + 1} & set(range(8))
        if not adjacent.intersection(set(pawn_files)):
            isolated.append(f)

    # Passed pawns: no enemy pawn ahead on same or adjacent files
    enemy_color = not color
    enemy_pawns = board.pieces(chess.PAWN, enemy_color)
    enemy_files_ranks = [(chess.square_file(sq), chess.square_rank(sq))
                         for sq in enemy_pawns]
    passed = []
    for sq in pawns:
        f, r = chess.square_file(sq), chess.square_rank(sq)
        dominated_files = {f - 1, f, f + 1} & set(range(8))
        is_passed = True
        for ef, er in enemy_files_ranks:
            if ef in dominated_files:
                if color == chess.WHITE and er > r:
                    is_passed = False
                    break
                elif color == chess.BLACK and er < r:
                    is_passed = False
                    break
        if is_passed:
            passed.append(chess.square_name(sq))

    return {
        "count": len(pawns),
        "files": sorted(set(pawn_files)),
        "doubled_files": doubled,
        "isolated_files": isolated,
        "passed_pawns": passed,
    }


def _get_pawn_squares(board: chess.Board) -> set[tuple[int, int, bool]]:
    """Get set of (file, rank, is_white) for all pawns."""
    result = set()
    for color in [chess.WHITE, chess.BLACK]:
        for sq in board.pieces(chess.PAWN, color):
            result.add((chess.square_file(sq), chess.square_rank(sq),
                        color == chess.WHITE))
    return result


def uci_to_san(fen: str, uci_moves: list[str]) -> str:
    """Convert a UCI move sequence to numbered SAN notation.

    Args:
        fen: Starting position as FEN.
        uci_moves: List of UCI moves, e.g. ["e2e4", "e7e5", "g1f3"].

    Returns:
        Numbered SAN string, e.g. "1. e4 e5 2. Nf3".
    """
    board = chess.Board(fen)
    san_parts = []
    for uci_str in uci_moves:
        try:
            move = board.parse_uci(uci_str)
            san = board.san(move)
            move_num = board.fullmove_number
            if board.turn == chess.WHITE:
                san_parts.append(f"{move_num}. {san}")
            else:
                # Add move number with dots only at start of variation
                if not san_parts:
                    san_parts.append(f"{move_num}... {san}")
                else:
                    san_parts.append(san)
            board.push(move)
        except (ValueError, chess.InvalidMoveError):
            san_parts.append(uci_str)  # Fall back to raw UCI if invalid
            break
    return " ".join(san_parts)
