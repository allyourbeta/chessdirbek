"""Tests for puzzle navigation functionality (Phase 18 Part 2)."""

import pytest
import random
from sqlalchemy.orm import Session
from backend.models import Position, PositionType, Tag
from backend.database import SessionLocal
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

# Use random IDs to avoid conflicts
BASE_ID = random.randint(10000, 90000)

def setup_test_puzzles(db: Session):
    """Create test puzzles and tabiyas with tags for navigation testing."""
    # Don't delete all data - just use unique IDs
    id1 = BASE_ID + 1
    id2 = BASE_ID + 2
    id3 = BASE_ID + 3
    id4 = BASE_ID + 4
    id5 = BASE_ID + 5
    id6 = BASE_ID + 6
    
    # Get or create tags
    tactics_tag = db.query(Tag).filter(Tag.name == "tactics").first()
    if not tactics_tag:
        tactics_tag = Tag(name="tactics")
        db.add(tactics_tag)
        db.flush()
    
    endgame_tag = db.query(Tag).filter(Tag.name == "endgame").first()
    if not endgame_tag:
        endgame_tag = Tag(name="endgame")
        db.add(endgame_tag)
        db.flush()
    
    # Create puzzles with different tags
    puzzles = [
        Position(
            id=id1,
            fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            title="Puzzle 1",
            position_type=PositionType.puzzle,
            tags=[tactics_tag]
        ),
        Position(
            id=id2,
            fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            title="Puzzle 2",
            position_type=PositionType.puzzle,
            tags=[tactics_tag]
        ),
        Position(
            id=id3,
            fen="rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
            title="Puzzle 3",
            position_type=PositionType.puzzle,
            tags=[tactics_tag, endgame_tag]
        ),
        Position(
            id=id4,
            fen="8/8/8/4k3/8/8/4K3/8 w - - 0 1",
            title="Puzzle 4",
            position_type=PositionType.puzzle,
            tags=[endgame_tag]
        ),
        Position(
            id=id5,
            fen="8/8/8/4k3/8/8/4K3/R7 w - - 0 1",
            title="Puzzle 5",
            position_type=PositionType.puzzle,
            tags=[endgame_tag]
        ),
    ]
    
    # Create a tabiya to ensure it's not included in puzzle navigation
    tabiya = Position(
        id=id6,
        fen="rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        title="Tabiya 1",
        position_type=PositionType.tabiya,
        tags=[tactics_tag]
    )
    
    db.add_all(puzzles + [tabiya])
    db.commit()
    
    return puzzles, [id1, id2, id3, id4, id5, id6]


def test_next_puzzle_returns_next_in_order():
    """Test that navigation returns the next puzzle in order."""
    db = SessionLocal()
    try:
        puzzles, ids = setup_test_puzzles(db)
        id1, id2, id3, id4, id5, id6 = ids
        
        # Get navigation for puzzle id2 (middle puzzle)
        response = client.get(f"/api/positions/{id2}/navigation")
        assert response.status_code == 200
        data = response.json()
        
        # Puzzles are ordered by created_at DESC, so newer puzzles come first
        # Since we created them in order id1, id2, id3, id4, id5:
        # The display order would be id5, id4, id3, id2, id1
        # Puzzle id2 is at index 3 (0-based)
        # - next: moves forward to index 4 -> puzzle id1 
        # - previous: moves back to index 2 -> puzzle id3
        assert data["next_id"] == id1  # Next in sequence (older)
        assert data["previous_id"] == id3  # Previous in sequence (newer)
        assert data["current_index"] == 4  # 4th position (1-indexed)
        assert data["total_count"] == 5
    finally:
        db.close()


def test_next_puzzle_at_end_returns_null():
    """Test that the last puzzle has no next."""
    db = SessionLocal()
    try:
        puzzles, ids = setup_test_puzzles(db)
        id1, id2, id3, id4, id5, id6 = ids
        
        # Get navigation for the newest puzzle (id5)
        response = client.get(f"/api/positions/{id5}/navigation")
        assert response.status_code == 200
        data = response.json()
        
        assert data["previous_id"] is None  # No previous (newest puzzle)
        assert data["next_id"] == id4
        assert data["current_index"] == 1  # First in list
        assert data["total_count"] == 5
    finally:
        db.close()


def test_previous_puzzle_at_start_returns_null():
    """Test that the first puzzle has no previous."""
    db = SessionLocal()
    try:
        puzzles, ids = setup_test_puzzles(db)
        id1, id2, id3, id4, id5, id6 = ids
        
        # Get navigation for the oldest puzzle (id1)
        response = client.get(f"/api/positions/{id1}/navigation")
        assert response.status_code == 200
        data = response.json()
        
        assert data["next_id"] is None  # No next (oldest puzzle)
        assert data["previous_id"] == id2
        assert data["current_index"] == 5  # Last in list
        assert data["total_count"] == 5
    finally:
        db.close()


def test_next_puzzle_respects_tag_filter():
    """Test that filtering by tag only returns puzzles with that tag."""
    db = SessionLocal()
    try:
        puzzles, ids = setup_test_puzzles(db)
        id1, id2, id3, id4, id5, id6 = ids
        
        # Get navigation for puzzle id3 with endgame tag filter
        # Puzzles with endgame tag: id3, id4, id5
        response = client.get(f"/api/positions/{id3}/navigation?tags=endgame")
        assert response.status_code == 200
        data = response.json()
        
        # In endgame-only set: id5, id4, id3 (newest first)
        # So id3 is at index 2 (last)
        assert data["next_id"] is None  # id3 is the oldest endgame puzzle
        assert data["previous_id"] == id4
        assert data["current_index"] == 3
        assert data["total_count"] == 3
    finally:
        db.close()


def test_navigation_only_returns_puzzles_not_tabiyas():
    """Test that navigation never includes tabiyas."""
    db = SessionLocal()
    try:
        puzzles, ids = setup_test_puzzles(db)
        id1, id2, id3, id4, id5, id6 = ids
        
        # Get navigation for any puzzle with tactics tag
        # Both puzzles and the tabiya have tactics tag, but only puzzles should be included
        response = client.get(f"/api/positions/{id1}/navigation?tags=tactics")
        assert response.status_code == 200
        data = response.json()
        
        # Only puzzles id1, id2, id3 have tactics tag (not the tabiya id6)
        assert data["total_count"] == 3  # Not 4 (would be 4 if tabiya was included)
        
        # Verify the tabiya is not reachable through navigation
        assert data["next_id"] != id6
        assert data["previous_id"] != id6
    finally:
        db.close()


def test_puzzle_without_matching_filter_returns_empty_navigation():
    """Test navigation when current puzzle doesn't match the filter."""
    db = SessionLocal()
    try:
        puzzles, ids = setup_test_puzzles(db)
        id1, id2, id3, id4, id5, id6 = ids
        
        # Get navigation for puzzle id1 (has tactics tag) with endgame filter
        # Puzzle id1 doesn't have endgame tag
        response = client.get(f"/api/positions/{id1}/navigation?tags=endgame")
        assert response.status_code == 200
        data = response.json()
        
        # Current puzzle not in filtered set
        assert data["next_id"] is None
        assert data["previous_id"] is None
        assert data["current_index"] == 0  # Not in set
        assert data["total_count"] == 3  # Total endgame puzzles
    finally:
        db.close()


if __name__ == "__main__":
    print("Running puzzle navigation tests...")
    
    test_next_puzzle_returns_next_in_order()
    print("✓ test_next_puzzle_returns_next_in_order")
    
    test_next_puzzle_at_end_returns_null()
    print("✓ test_next_puzzle_at_end_returns_null")
    
    test_previous_puzzle_at_start_returns_null()
    print("✓ test_previous_puzzle_at_start_returns_null")
    
    test_next_puzzle_respects_tag_filter()
    print("✓ test_next_puzzle_respects_tag_filter")
    
    test_navigation_only_returns_puzzles_not_tabiyas()
    print("✓ test_navigation_only_returns_puzzles_not_tabiyas")
    
    test_puzzle_without_matching_filter_returns_empty_navigation()
    print("✓ test_puzzle_without_matching_filter_returns_empty_navigation")
    
    print("\n✨ All puzzle navigation tests passed!")