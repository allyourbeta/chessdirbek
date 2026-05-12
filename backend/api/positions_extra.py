"""Extra position API routes - bulk operations and navigation."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from backend.api.schemas import BulkReclassifyRequest, BulkReclassifyResponse
from backend.database import get_db
from backend.models import Position, PositionType, Tag

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
            db.flush()  # Get the ID without committing
        tags.append(tag)
    return tags


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