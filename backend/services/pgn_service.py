"""PGN parsing service. Pure functions — no DB, no FastAPI imports."""

import io

import chess
import chess.pgn
import chess.polyglot

from backend.services.index_service import compute_pawn_sig, compute_zobrist

# Standard NAG-to-symbol mapping (most common move annotations).
# See PGN specification §10 for the full list.
_NAG_SYMBOLS = {1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!"}


def parse_single_pgn(pgn_text: str) -> dict:
    """Parse a single PGN game.

    Returns dict with headers, moves, FENs, hashes, and metadata.
    """
    try:
        game = chess.pgn.read_game(io.StringIO(pgn_text))
        if game is None:
            return {"error": "No game found in PGN text"}
    except Exception as e:
        return {"error": str(e)}

    headers = dict(game.headers)
    board = game.board()

    moves_san = []
    moves_uci = []
    fens = [board.fen()]
    comments = []
    zobrist_hashes = [compute_zobrist(board.fen())]
    pawn_sigs = [compute_pawn_sig(board.fen())]
    has_variations = False

    for node in game.mainline():
        if node.parent and len(node.parent.variations) > 1:
            has_variations = True
        san = board.san(node.move)
        # Append NAG symbols (!, ?, !!, ??, !?, ?!) to the move text
        for nag in sorted(node.nags):
            sym = _NAG_SYMBOLS.get(nag)
            if sym:
                san += sym
                break  # Only use the first recognized NAG per move
        moves_san.append(san)
        moves_uci.append(node.move.uci())
        board.push(node.move)
        fens.append(board.fen())
        comments.append(node.comment if node.comment else None)
        zobrist_hashes.append(compute_zobrist(board.fen()))
        pawn_sigs.append(compute_pawn_sig(board.fen()))

    return {
        "headers": headers,
        "moves_san": moves_san,
        "moves_uci": moves_uci,
        "fens": fens,
        "comments": comments,
        "zobrist_hashes": zobrist_hashes,
        "pawn_sigs": pawn_sigs,
        "move_count": len(moves_san),
        "has_variations": has_variations,
        "error": None,
    }


def parse_multi_pgn(pgn_text: str) -> list[dict]:
    """Parse multiple PGN games from a single text block."""
    results = []
    stream = io.StringIO(pgn_text)
    while True:
        game = chess.pgn.read_game(stream)
        if game is None:
            break
        pgn_str = str(game)
        parsed = parse_single_pgn(pgn_str)
        parsed["pgn_text"] = pgn_str
        results.append(parsed)
    return results


def _slugify(text: str) -> str:
    """Convert text to a clean hyphenated tag: lowercase, no spaces."""
    import re
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s).strip("-")
    return s


def extract_auto_tags(headers: dict) -> list[str]:
    """Extract tags from PGN headers. Skips '?' placeholder values.

    ECO codes: as-is lowercase (e.g. "b21").
    Opening names: take the variant (after last colon), slugified.
    Player names: slugified.
    """
    tags = []
    eco = headers.get("ECO", "")
    if eco and eco != "?" and eco != "??":
        tags.append(eco.lower())

    opening = headers.get("Opening", "")
    if opening and opening != "?" and opening != "??":
        parts = opening.split(":")
        short = parts[-1].strip()
        slug = _slugify(short)
        if slug:
            tags.append(slug)

    for key in ("White", "Black"):
        val = headers.get(key, "")
        if val and val != "?" and val != "??":
            slug = _slugify(val)
            if slug:
                tags.append(slug)
    return tags


def get_fen_at_move(pgn_text: str, half_move: int) -> str:
    """Get FEN at a specific ply index (0 = starting position)."""
    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if game is None:
        return ""
    board = game.board()
    if half_move == 0:
        return board.fen()
    for i, node in enumerate(game.mainline()):
        board.push(node.move)
        if i + 1 == half_move:
            return board.fen()
    return board.fen()
