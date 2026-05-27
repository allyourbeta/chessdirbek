"""Position API routes. All DB calls for positions happen here."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from backend.api.schemas import (
    PositionBrief, 
    PositionCreate, 
    PositionOut, 
    PositionUpdate,
)
from backend.database import get_db
from backend.models import Position, PositionType, Tag
from backend.services import validate_fen, generate_placeholder_name

router = APIRouter(prefix="/positions", tags=["positions"])


def _get_or_create_tags(db: Session, tag_names: list[str]) -> list[Tag]:
    """Get existing tags or create new ones."""
    tags = []
    for name in tag_names:
        name = name.strip().lower().lstrip("#")
        if not name:
            continue
        tag = db.query(Tag).filter(Tag.name == name).first()
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


@router.post("/", response_model=PositionOut, status_code=201)
def create_position(data: PositionCreate, db: Session = Depends(get_db)):
    """Create a new position. Validates FEN via python-chess."""
    is_valid, error = validate_fen(data.fen)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid FEN: {error}")

    # Check for duplicate position with same FEN (global check)
    existing = db.query(Position).filter(Position.fen == data.fen).first()
    if existing:
        existing_category = existing.position_type.value  # e.g. "tabiya", "endgame"
        # Return existing position data in the response so frontend can navigate to it
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"This position already exists (in {existing_category}).",
                "existing_id": existing.id
            }
        )
    
    # Auto-generate a friendly placeholder name if title is missing/blank.
    # Placeholders aren't unique identifiers — collisions are fine.
    title = (data.title or "").strip() or generate_placeholder_name()
    
    tags = _get_or_create_tags(db, data.tags)
    position = Position(
        fen=data.fen,
        title=title,
        notes=data.notes,
        stockfish_analysis=data.stockfish_analysis,
        position_type=data.position_type,
        solution_san=data.solution_san if data.position_type == PositionType.puzzle else None,
        theme=data.theme if data.position_type == PositionType.puzzle else None,
        orientation=data.orientation,
        tags=tags,
    )
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


# Convenience endpoints must come before the /{position_id} route
@router.get("/puzzles", response_model=list[PositionBrief])
def list_puzzles(
    tag: str | None = None,
    tags: list[str] | None = Query(default=None),
    search: str | None = None,
    sort: str = "newest",
    db: Session = Depends(get_db),
):
    """List only puzzle positions."""
    return list_positions(
        tag=tag, 
        tags=tags, 
        search=search, 
        position_type=PositionType.puzzle, 
        sort=sort,
        db=db
    )


@router.get("/tabiyas", response_model=list[PositionBrief])
def list_tabiyas(
    tag: str | None = None,
    tags: list[str] | None = Query(default=None),
    search: str | None = None,
    sort: str = "newest",
    db: Session = Depends(get_db),
):
    """List only tabiya positions."""
    return list_positions(
        tag=tag, 
        tags=tags, 
        search=search, 
        position_type=PositionType.tabiya, 
        sort=sort,
        db=db
    )


@router.get("/", response_model=list[PositionBrief])
def list_positions(
    tag: str | None = None,
    tags: list[str] | None = Query(default=None),
    search: str | None = None,
    position_type: Optional[PositionType] = None,
    sort: str = "newest",  # "newest" or "oldest"
    db: Session = Depends(get_db),
):
    """List positions, optionally filtered by tag(s), search text, or type."""
    query = db.query(Position).options(joinedload(Position.tags))
    
    # Filter by position type if specified
    if position_type:
        query = query.filter(Position.position_type == position_type)

    tag_names = []
    if tag:
        tag_names.append(tag)
    if tags:
        tag_names.extend(tags)
    cleaned = [t.strip().lower().lstrip("#") for t in tag_names]
    cleaned = [n for n in cleaned if n]
    if cleaned:
        query = query.filter(or_(*(Position.tags.any(Tag.name == n) for n in cleaned)))

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            Position.title.ilike(pattern) | Position.notes.ilike(pattern)
        )

    order = Position.created_at.desc() if sort != "oldest" else Position.created_at.asc()
    return query.order_by(order).all()


@router.get("/random", response_model=PositionBrief)
def random_position(
    position_type: Optional[PositionType] = None,
    tags: list[str] | None = Query(default=None),
    exclude_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Position).options(joinedload(Position.tags))
    if position_type:
        query = query.filter(Position.position_type == position_type)
    if tags:
        cleaned = [t.strip().lower().lstrip("#") for t in tags]
        cleaned = [n for n in cleaned if n]
        if cleaned:
            query = query.filter(
                or_(*(Position.tags.any(Tag.name == n) for n in cleaned))
            )
    if exclude_id:
        query = query.filter(Position.id != exclude_id)
    pos = query.order_by(func.random()).first()
    if not pos:
        raise HTTPException(status_code=404, detail="No matching positions")
    return pos


@router.get("/{position_id}", response_model=PositionOut)
def get_position(position_id: int, db: Session = Depends(get_db)):
    """Get a single position with all details."""
    position = (
        db.query(Position)
        .options(joinedload(Position.tags))
        .filter(Position.id == position_id)
        .first()
    )
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    return position


@router.put("/{position_id}", response_model=PositionOut)
def update_position(
    position_id: int, data: PositionUpdate, db: Session = Depends(get_db)
):
    """Update a position's notes, title, analysis, or tags."""
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    if data.fen is not None:
        is_valid, error = validate_fen(data.fen)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid FEN: {error}")
        position.fen = data.fen
    if data.title is not None:
        position.title = data.title.strip() or generate_placeholder_name()
    if data.notes is not None:
        position.notes = data.notes
    if data.stockfish_analysis is not None:
        position.stockfish_analysis = data.stockfish_analysis
    if data.orientation is not None:
        position.orientation = data.orientation
    if data.tags is not None:
        position.tags = _get_or_create_tags(db, data.tags)
    
    # Handle position type changes
    if data.position_type is not None and data.position_type != position.position_type:
        if data.position_type == PositionType.puzzle:
            # Changing to puzzle - require solution
            if not data.solution_san:
                raise HTTPException(status_code=400, detail="Puzzles must have a solution")
            position.position_type = data.position_type
            position.solution_san = data.solution_san
            position.theme = data.theme
        else:
            # Changing to tabiya - clear puzzle fields
            position.position_type = data.position_type
            position.solution_san = None
            # Preserve theme as a tag if it exists
            if position.theme:
                theme_tag = _get_or_create_tags(db, [position.theme])
                if theme_tag and theme_tag[0] not in position.tags:
                    position.tags.append(theme_tag[0])
            position.theme = None
    else:
        # Update puzzle fields if not changing type
        if data.solution_san is not None:
            position.solution_san = data.solution_san
        if data.theme is not None:
            position.theme = data.theme

    db.commit()
    db.refresh(position)
    return position


@router.patch("/{position_id}/star")
def toggle_star(position_id: int, db: Session = Depends(get_db)):
    """Toggle the starred flag on a position. Returns new state."""
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    position.starred = not position.starred
    db.commit()
    db.refresh(position)
    return {"id": position.id, "starred": position.starred}


@router.delete("/{position_id}", status_code=204)
def delete_position(position_id: int, db: Session = Depends(get_db)):
    """Delete a position."""
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    db.delete(position)
    db.commit()


