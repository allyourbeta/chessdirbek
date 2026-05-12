"""Practice game API routes (Phase 10)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.game_schemas import (
    PracticeGameCreate,
    PracticeGameOut,
    PracticeGameUpdate,
)
from backend.database import get_db
from backend.models import Position, PracticeGame
from backend.services import ENGINE_LEVELS, compute_engine_verdict

router = APIRouter(prefix="/practice", tags=["practice"])




@router.get("/engine-levels")
def get_engine_levels():
    """Expose ENGINE_LEVELS so the frontend can populate its dropdown."""
    return ENGINE_LEVELS


@router.post("/", response_model=PracticeGameOut, status_code=201)
def create_practice_game(data: PracticeGameCreate, db: Session = Depends(get_db)):
    position = db.query(Position).filter(Position.id == data.root_position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Root position not found")

    if data.user_color not in ("white", "black"):
        raise HTTPException(status_code=400, detail="user_color must be 'white' or 'black'")

    engine_verdict = compute_engine_verdict(
        data.starting_eval, data.final_eval, data.user_color
    )

    pg = PracticeGame(
        root_position_id=data.root_position_id,
        pgn_text=data.pgn_text,
        user_color=data.user_color,
        final_fen=data.final_fen,
        move_count=data.move_count,
        engine_verdict=engine_verdict,
        user_verdict=data.user_verdict,
        final_eval=data.final_eval,
        starting_eval=data.starting_eval,
        engine_name=data.engine_name,
        engine_level=data.engine_level,
        notes=data.notes,
    )
    db.add(pg)
    db.commit()
    db.refresh(pg)
    return pg


@router.get("/")
def list_practice_games(
    root_position_id: int | None = Query(default=None),
    verdict: str | None = Query(default=None),
    engine_level: str | None = Query(default=None),
    sort: str = Query(default="recent"),
    limit: int = Query(default=None, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    # Validate parameters
    if verdict and verdict not in ["win", "draw", "loss", "abandoned"]:
        raise HTTPException(status_code=400, detail="Invalid verdict value")
    if sort not in ["recent", "oldest", "longest", "shortest"]:
        raise HTTPException(status_code=400, detail="Invalid sort value")
    
    q = db.query(PracticeGame)
    if root_position_id is not None:
        q = q.filter(PracticeGame.root_position_id == root_position_id)
    
    # Apply verdict filter
    if verdict:
        # Check both user_verdict and engine_verdict
        from sqlalchemy import or_
        q = q.filter(or_(
            PracticeGame.user_verdict == verdict,
            (PracticeGame.user_verdict.is_(None)) & (PracticeGame.engine_verdict == verdict)
        ))
    
    # Apply engine level filter
    if engine_level:
        q = q.filter(PracticeGame.engine_level == engine_level)
    
    # Apply sorting
    if sort == "recent":
        q = q.order_by(PracticeGame.created_at.desc())
    elif sort == "oldest":
        q = q.order_by(PracticeGame.created_at.asc())
    elif sort == "longest":
        q = q.order_by(PracticeGame.move_count.desc())
    elif sort == "shortest":
        q = q.order_by(PracticeGame.move_count.asc())
    
    # Get total count before pagination
    total_count = q.count()
    
    # Apply pagination
    if limit is not None:
        q = q.limit(limit).offset(offset)
    elif offset > 0:
        q = q.offset(offset)
    
    games = q.all()
    
    # Convert to response format with total_count
    return {
        "games": games,
        "total_count": total_count
    }








@router.get("/{practice_id}", response_model=PracticeGameOut)
def get_practice_game(practice_id: int, db: Session = Depends(get_db)):
    pg = db.query(PracticeGame).filter(PracticeGame.id == practice_id).first()
    if not pg:
        raise HTTPException(status_code=404, detail="Practice game not found")
    return pg


@router.put("/{practice_id}", response_model=PracticeGameOut)
def update_practice_game(
    practice_id: int,
    data: PracticeGameUpdate,
    db: Session = Depends(get_db),
):
    pg = db.query(PracticeGame).filter(PracticeGame.id == practice_id).first()
    if not pg:
        raise HTTPException(status_code=404, detail="Practice game not found")

    if data.user_verdict is not None:
        if data.user_verdict not in ("win", "draw", "loss", "abandoned", ""):
            raise HTTPException(
                status_code=400,
                detail="user_verdict must be win/draw/loss/abandoned",
            )
        pg.user_verdict = data.user_verdict or None
    if data.notes is not None:
        pg.notes = data.notes

    db.commit()
    db.refresh(pg)
    return pg


@router.delete("/{practice_id}", status_code=204)
def delete_practice_game(practice_id: int, db: Session = Depends(get_db)):
    pg = db.query(PracticeGame).filter(PracticeGame.id == practice_id).first()
    if not pg:
        raise HTTPException(status_code=404, detail="Practice game not found")
    db.delete(pg)
    db.commit()
