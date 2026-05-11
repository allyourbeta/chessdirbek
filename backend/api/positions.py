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
    BulkReclassifyRequest,
    BulkReclassifyResponse
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

    # Check for duplicate position with same FEN and type
    existing = db.query(Position).filter(
        Position.fen == data.fen,
        Position.position_type == data.position_type
    ).first()
    if existing:
        position_type_name = "tactic" if data.position_type == PositionType.puzzle else "tabiya"
        raise HTTPException(
            status_code=409, 
            detail=f"This {position_type_name} position already exists."
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
    db: Session = Depends(get_db),
):
    """List only puzzle positions."""
    return list_positions(
        tag=tag, 
        tags=tags, 
        search=search, 
        position_type=PositionType.puzzle, 
        db=db
    )


@router.get("/tabiyas", response_model=list[PositionBrief])
def list_tabiyas(
    tag: str | None = None,
    tags: list[str] | None = Query(default=None),
    search: str | None = None,
    db: Session = Depends(get_db),
):
    """List only tabiya positions."""
    return list_positions(
        tag=tag, 
        tags=tags, 
        search=search, 
        position_type=PositionType.tabiya, 
        db=db
    )


@router.get("/", response_model=list[PositionBrief])
def list_positions(
    tag: str | None = None,
    tags: list[str] | None = Query(default=None),
    search: str | None = None,
    position_type: Optional[PositionType] = None,
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

    return query.order_by(Position.created_at.desc()).all()


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


@router.delete("/{position_id}", status_code=204)
def delete_position(position_id: int, db: Session = Depends(get_db)):
    """Delete a position."""
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    db.delete(position)
    db.commit()


@router.post("/bulk-reclassify", response_model=BulkReclassifyResponse)
def bulk_reclassify(
    request: BulkReclassifyRequest,
    db: Session = Depends(get_db)
):
    """Bulk reclassify positions to a new type."""
    success_count = 0
    failure_count = 0
    errors = []
    
    # Validate puzzle requirements
    if request.new_type == PositionType.puzzle and not request.solution_san:
        raise HTTPException(status_code=400, detail="Solution required when changing to puzzle type")
    
    positions = db.query(Position).filter(Position.id.in_(request.position_ids)).all()
    
    for position in positions:
        try:
            if request.new_type == PositionType.puzzle:
                position.position_type = PositionType.puzzle
                position.solution_san = request.solution_san
                position.theme = request.theme
            else:
                # Changing to tabiya
                position.position_type = PositionType.tabiya
                # Preserve theme as tag if exists
                if position.theme:
                    theme_tag = _get_or_create_tags(db, [position.theme])
                    if theme_tag and theme_tag[0] not in position.tags:
                        position.tags.append(theme_tag[0])
                position.solution_san = None
                position.theme = None
            success_count += 1
        except Exception as e:
            failure_count += 1
            errors.append(f"Position {position.id}: {str(e)}")
    
    db.commit()
    
    return BulkReclassifyResponse(
        success_count=success_count,
        failure_count=failure_count,
        errors=errors
    )


@router.get("/{position_id}/navigation")
def get_puzzle_navigation(
    position_id: int,
    tags: list[str] | None = Query(default=None),
    db: Session = Depends(get_db)
):
    """Get navigation info for puzzle browsing (next/previous puzzle IDs and position counter)."""
    # Get current position to verify it's a puzzle
    current = db.query(Position).filter(Position.id == position_id).first()
    if not current:
        raise HTTPException(status_code=404, detail="Position not found")
    
    # Build query for puzzles only
    query = db.query(Position).filter(Position.position_type == PositionType.puzzle)
    
    if tags:
        cleaned = [t.strip().lower().lstrip("#") for t in tags]
        cleaned = [n for n in cleaned if n]
        if cleaned:
            query = query.filter(
                or_(*(Position.tags.any(Tag.name == n) for n in cleaned))
            )
    
    # Get all puzzle IDs in order (newest first by default)
    all_puzzles = query.order_by(Position.created_at.desc()).with_entities(Position.id).all()
    puzzle_ids = [p[0] for p in all_puzzles]
    
    # Find current position in the list
    try:
        current_index = puzzle_ids.index(position_id)
    except ValueError:
        # Current position not in filtered set (might not be a puzzle or doesn't match filter)
        return {
            "next_id": None,
            "previous_id": None,
            "current_index": 0,
            "total_count": len(puzzle_ids)
        }
    
    # Determine next and previous
    # "Next" moves forward in the list (toward higher index/older puzzles)
    # "Previous" moves backward in the list (toward lower index/newer puzzles)
    next_id = puzzle_ids[current_index + 1] if current_index < len(puzzle_ids) - 1 else None
    previous_id = puzzle_ids[current_index - 1] if current_index > 0 else None
    
    return {
        "next_id": next_id,
        "previous_id": previous_id,
        "current_index": current_index + 1,  # 1-indexed for display
        "total_count": len(puzzle_ids)
    }
