"""FastAPI router for engine games."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.engine_models import EngineGame
from backend.models.models import Position
from backend.api.engine_schemas import (
    EngineGameCreate,
    EngineGameOut,
    EngineGameBrief,
)

router = APIRouter()


@router.post("/engine-games", status_code=status.HTTP_201_CREATED, response_model=EngineGameOut)
def create_engine_game(game: EngineGameCreate, db: Session = Depends(get_db)):
    """Create a new engine game record."""
    # Validate position exists
    position = db.query(Position).filter(Position.id == game.position_id).first()
    if not position:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Position {game.position_id} not found"
        )
    
    # Reject empty games
    if game.move_count < 1 or not game.moves_san.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Game must have at least one move"
        )
    
    # Create the game record
    db_game = EngineGame(**game.model_dump())
    db.add(db_game)
    db.commit()
    db.refresh(db_game)
    
    return db_game


@router.get("/positions/{position_id}/engine-games", response_model=List[EngineGameBrief])
def list_position_engine_games(position_id: int, db: Session = Depends(get_db)):
    """List all engine games for a position, newest first."""
    games = (
        db.query(EngineGame)
        .filter(EngineGame.position_id == position_id)
        .order_by(EngineGame.created_at.desc())
        .all()
    )
    return games


@router.get("/engine-games/{game_id}", response_model=EngineGameOut)
def get_engine_game(game_id: int, db: Session = Depends(get_db)):
    """Get a single engine game by ID."""
    game = db.query(EngineGame).filter(EngineGame.id == game_id).first()
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Engine game {game_id} not found"
        )
    return game


@router.delete("/engine-games/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_engine_game(game_id: int, db: Session = Depends(get_db)):
    """Delete an engine game."""
    game = db.query(EngineGame).filter(EngineGame.id == game_id).first()
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Engine game {game_id} not found"
        )
    
    db.delete(game)
    db.commit()