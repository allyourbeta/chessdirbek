"""Opening tree API route."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.game_schemas import OpeningTreeMove, OpeningTreeResponse
from backend.database import get_db
from backend.models import Game, PositionIndex
from backend.services import compute_zobrist, parse_single_pgn

router = APIRouter(prefix="/opening-tree", tags=["opening-tree"])


@router.get("/", response_model=OpeningTreeResponse)
def get_opening_tree(fen: str = Query(...), db: Session = Depends(get_db)):
    z_hash = compute_zobrist(fen)

    matches = (
        db.query(PositionIndex)
        .filter(PositionIndex.zobrist_hash == z_hash)
        .all()
    )

    move_stats: dict[str, dict] = {}

    # Batch load all games to avoid N+1 queries
    game_ids = list({m.game_id for m in matches})
    games = db.query(Game).filter(Game.id.in_(game_ids)).all() if game_ids else []
    games_by_id = {g.id: g for g in games}

    for m in matches:
        next_idx = (
            db.query(PositionIndex)
            .filter(
                PositionIndex.game_id == m.game_id,
                PositionIndex.half_move == m.half_move + 1,
            )
            .first()
        )
        if not next_idx:
            continue

        game = games_by_id.get(m.game_id)
        if not game:
            continue

        parsed = parse_single_pgn(game.pgn_text)
        if parsed.get("error") or m.half_move >= len(parsed["moves_san"]):
            continue

        san = parsed["moves_san"][m.half_move]

        if san not in move_stats:
            move_stats[san] = {
                "san": san,
                "fen": next_idx.fen,
                "games": 0,
                "white_wins": 0,
                "draws": 0,
                "black_wins": 0,
            }

        entry = move_stats[san]
        entry["games"] += 1
        result = game.result or ""
        if result == "1-0":
            entry["white_wins"] += 1
        elif result == "0-1":
            entry["black_wins"] += 1
        elif result == "1/2-1/2":
            entry["draws"] += 1

    moves = sorted(move_stats.values(), key=lambda x: x["games"], reverse=True)
    total = sum(m["games"] for m in moves)

    return OpeningTreeResponse(
        fen=fen,
        total_games=total,
        moves=[OpeningTreeMove(**m) for m in moves],
    )
