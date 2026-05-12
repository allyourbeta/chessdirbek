"""Practice analytics and aggregation endpoints."""

import io

import chess
import chess.pgn
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.api.game_schemas import (
    PracticeEngineBreakdown,
    PracticePositionSummary,
    PracticeStatsOut,
    PracticeTreeMove,
    PracticeTreeResponse,
)
from backend.database import get_db
from backend.models import Position, PracticeGame

router = APIRouter(prefix="/practice", tags=["practice"])


def _effective_verdict(pg: PracticeGame) -> str | None:
    """User override wins over engine verdict."""
    return pg.user_verdict or pg.engine_verdict


def _aggregate(games: list[PracticeGame]) -> dict:
    wins = draws = losses = abandoned = 0
    for g in games:
        v = _effective_verdict(g)
        if v == "win":
            wins += 1
        elif v == "draw":
            draws += 1
        elif v == "loss":
            losses += 1
        elif v == "abandoned":
            abandoned += 1
    total = len(games)
    decided = wins + draws + losses
    win_rate = (wins / decided) if decided else 0.0
    return {
        "total": total, "wins": wins, "draws": draws,
        "losses": losses, "abandoned": abandoned, "win_rate": win_rate,
    }


def _first_move_from_root(pgn_text: str, root_fen: str) -> tuple[str | None, str]:
    """Extract the first move after the root position from pgn_text.

    PracticeGame pgn_text starts from the root position, so the first mainline
    move is the one we want. Returns (san, fen_after_move) or (None, root_fen).
    """
    try:
        game = chess.pgn.read_game(io.StringIO(pgn_text))
        if game is None:
            return None, root_fen
        board = game.board()
        first = next(iter(game.mainline_moves()), None)
        if first is None:
            return None, board.fen()
        san = board.san(first)
        board.push(first)
        return san, board.fen()
    except Exception:
        return None, root_fen


@router.get("/positions", response_model=list[PracticePositionSummary])
def list_practice_positions(db: Session = Depends(get_db)):
    """Positions that have practice activity, ordered by most recent play."""
    position_ids = [
        row[0] for row in db.query(PracticeGame.root_position_id).distinct().all()
    ]
    summaries: list[dict] = []
    for pid in position_ids:
        position = db.query(Position).filter(Position.id == pid).first()
        if not position:
            continue
        games = (
            db.query(PracticeGame)
            .filter(PracticeGame.root_position_id == pid)
            .all()
        )
        agg = _aggregate(games)
        last_played = max((g.created_at for g in games), default=None)
        summaries.append({
            "position_id": pid,
            "fen": position.fen,
            "title": position.title,
            "total_games": agg["total"],
            "wins": agg["wins"],
            "losses": agg["losses"],
            "draws": agg["draws"],
            "win_rate": agg["win_rate"],
            "last_played": last_played,
        })
    summaries.sort(
        key=lambda s: s["last_played"] or 0, reverse=True
    )
    return summaries


@router.get("/stats/{position_id}", response_model=PracticeStatsOut)
def get_practice_stats(
    position_id: int,
    verdict: str | None = Query(default=None),
    engine_level: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    # Validate parameters
    if verdict and verdict not in ["win", "draw", "loss", "abandoned"]:
        raise HTTPException(status_code=400, detail="Invalid verdict value")

    q = db.query(PracticeGame).filter(PracticeGame.root_position_id == position_id)
    
    # Apply verdict filter
    if verdict:
        q = q.filter(or_(
            PracticeGame.user_verdict == verdict,
            (PracticeGame.user_verdict.is_(None)) & (PracticeGame.engine_verdict == verdict)
        ))
    
    # Apply engine level filter
    if engine_level:
        q = q.filter(PracticeGame.engine_level == engine_level)
    
    games = q.all()
    agg = _aggregate(games)

    avg_move_count = (
        sum(g.move_count for g in games) / len(games) if games else 0.0
    )
    finals = [g.final_eval for g in games if g.final_eval is not None]
    avg_final_eval = (sum(finals) / len(finals)) if finals else None

    by_level: dict[str, list[PracticeGame]] = {}
    for g in games:
        by_level.setdefault(g.engine_level, []).append(g)

    breakdown = []
    for level, lgames in sorted(by_level.items()):
        la = _aggregate(lgames)
        breakdown.append(PracticeEngineBreakdown(
            engine_level=level,
            total=la["total"],
            wins=la["wins"],
            draws=la["draws"],
            losses=la["losses"],
            abandoned=la["abandoned"],
            win_rate=la["win_rate"],
        ))

    return PracticeStatsOut(
        position_id=position_id,
        total_games=agg["total"],
        wins=agg["wins"],
        draws=agg["draws"],
        losses=agg["losses"],
        abandoned=agg["abandoned"],
        win_rate=agg["win_rate"],
        avg_move_count=avg_move_count,
        avg_final_eval=avg_final_eval,
        by_engine_level=breakdown,
    )


@router.get("/tree/{position_id}", response_model=PracticeTreeResponse)
def get_practice_tree(position_id: int, db: Session = Depends(get_db)):
    """Opening tree built from user's practice games starting at this position."""
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    games = (
        db.query(PracticeGame)
        .filter(PracticeGame.root_position_id == position_id)
        .all()
    )

    move_stats: dict[str, dict] = {}
    for g in games:
        first_san, next_fen = _first_move_from_root(g.pgn_text, position.fen)
        if not first_san:
            continue
        entry = move_stats.setdefault(first_san, {
            "san": first_san, "fen": next_fen,
            "games": 0, "wins": 0, "draws": 0, "losses": 0,
        })
        entry["games"] += 1
        v = _effective_verdict(g)
        if v == "win":
            entry["wins"] += 1
        elif v == "draw":
            entry["draws"] += 1
        elif v == "loss":
            entry["losses"] += 1

    moves = []
    for e in sorted(move_stats.values(), key=lambda x: x["games"], reverse=True):
        decided = e["wins"] + e["draws"] + e["losses"]
        win_rate = (e["wins"] / decided) if decided else 0.0
        moves.append(PracticeTreeMove(
            san=e["san"], fen=e["fen"], games=e["games"],
            wins=e["wins"], draws=e["draws"], losses=e["losses"],
            win_rate=win_rate,
        ))

    return PracticeTreeResponse(
        position_id=position_id,
        total_games=len(games),
        moves=moves,
    )