#!/usr/bin/env python3
"""Tests for Phase 15: Position Types (Puzzle vs Tabiya)."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# CRITICAL: Set test database before importing app
os.environ["CHESSQUIZ_DB_URL"] = "sqlite:///:memory:"

from backend.main import app
from fastapi.testclient import TestClient

# Use TestClient instead of hitting production server
c = TestClient(app)

passed = 0
failed = 0

# Test FEN positions
STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
PUZZLE_FEN = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1"  # Rook endgame
TABIYA_FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"  # Italian Game


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✓ {name}")
        passed += 1
    else:
        print(f"  ✗ {name} — {detail}")
        failed += 1


def test_create_puzzle_with_solution():
    """Create puzzle with solution_san -> success."""
    data = {
        "fen": PUZZLE_FEN,
        "title": "Rook Endgame Win",
        "position_type": "puzzle",
        "solution_san": "Rd8+",
        "theme": "endgame",
        "tags": ["rook-endgame", "winning"]
    }
    r = c.post("/api/positions/", json=data)
    check("create_puzzle_with_solution", 
          r.status_code == 201,
          f"Status: {r.status_code}, Response: {r.text[:100]}")
    if r.status_code == 201:
        pos = r.json()
        check("puzzle has correct type", pos["position_type"] == "puzzle")
        check("puzzle has solution", pos["solution_san"] == "Rd8+")
        check("puzzle has theme", pos["theme"] == "endgame")
        return pos["id"]
    return None


def test_create_puzzle_without_solution():
    """Create puzzle without solution_san -> 400 error."""
    data = {
        "fen": PUZZLE_FEN,
        "title": "Puzzle Without Solution",
        "position_type": "puzzle",
        # Missing solution_san
        "theme": "endgame"
    }
    r = c.post("/api/positions/", json=data)
    check("create_puzzle_without_solution rejects",
          r.status_code == 400 or r.status_code == 422,
          f"Status: {r.status_code}")


def test_create_tabiya():
    """Create tabiya (solution_san ignored) -> success."""
    data = {
        "fen": TABIYA_FEN,
        "title": "Italian Game Mainline",
        "position_type": "tabiya",
        "solution_san": "This should be ignored",  # Should be ignored for tabiyas
        "theme": "Also ignored",
        "tags": ["opening", "italian"]
    }
    r = c.post("/api/positions/", json=data)
    check("create_tabiya", 
          r.status_code == 201,
          f"Status: {r.status_code}, Response: {r.text[:100]}")
    if r.status_code == 201:
        pos = r.json()
        check("tabiya has correct type", pos["position_type"] == "tabiya")
        check("tabiya ignores solution", pos["solution_san"] is None)
        check("tabiya ignores theme", pos["theme"] is None)
        return pos["id"]
    return None


def test_change_tabiya_to_puzzle():
    """Change type from tabiya to puzzle, add solution -> success."""
    # First create a tabiya
    tabiya_id = test_create_tabiya()
    if not tabiya_id:
        check("change_tabiya_to_puzzle", False, "Failed to create tabiya")
        return
    
    # Change to puzzle
    update_data = {
        "position_type": "puzzle",
        "solution_san": "Nf6",
        "theme": "opening-trap"
    }
    r = c.put(f"/api/positions/{tabiya_id}", json=update_data)
    check("change_tabiya_to_puzzle",
          r.status_code == 200,
          f"Status: {r.status_code}, Response: {r.text[:100]}")
    if r.status_code == 200:
        pos = r.json()
        check("changed to puzzle type", pos["position_type"] == "puzzle")
        check("has solution after change", pos["solution_san"] == "Nf6")
        check("has theme after change", pos["theme"] == "opening-trap")


def test_change_puzzle_to_tabiya():
    """Change type from puzzle to tabiya -> solution cleared, theme preserved as tag."""
    # First create a puzzle
    puzzle_id = test_create_puzzle_with_solution()
    if not puzzle_id:
        check("change_puzzle_to_tabiya", False, "Failed to create puzzle")
        return
    
    # Change to tabiya
    update_data = {
        "position_type": "tabiya"
    }
    r = c.put(f"/api/positions/{puzzle_id}", json=update_data)
    check("change_puzzle_to_tabiya",
          r.status_code == 200,
          f"Status: {r.status_code}, Response: {r.text[:100]}")
    if r.status_code == 200:
        pos = r.json()
        check("changed to tabiya type", pos["position_type"] == "tabiya")
        check("solution cleared", pos["solution_san"] is None)
        check("theme cleared", pos["theme"] is None)
        # Check that theme was preserved as a tag
        tag_names = [t["name"] for t in pos["tags"]]
        check("theme preserved as tag", "endgame" in tag_names)


def test_bulk_reclassify():
    """Reclassify 5 positions at once -> all updated."""
    # Create 5 tabiyas
    position_ids = []
    for i in range(5):
        data = {
            "fen": STARTING_FEN,
            "title": f"Test Position {i+1}",
            "position_type": "tabiya"
        }
        r = c.post("/api/positions/", json=data)
        if r.status_code == 201:
            position_ids.append(r.json()["id"])
    
    check("created 5 test positions", len(position_ids) == 5)
    
    # Bulk reclassify to puzzles
    bulk_data = {
        "position_ids": position_ids,
        "new_type": "puzzle",
        "solution_san": "e4",
        "theme": "opening"
    }
    r = c.post("/api/positions/bulk-reclassify", json=bulk_data)
    check("bulk_reclassify endpoint",
          r.status_code == 200,
          f"Status: {r.status_code}, Response: {r.text[:100]}")
    
    if r.status_code == 200:
        result = r.json()
        check("all reclassified successfully", result["success_count"] == 5)
        check("no failures", result["failure_count"] == 0)
        
        # Verify all were updated
        for pos_id in position_ids:
            r = c.get(f"/api/positions/{pos_id}")
            if r.status_code == 200:
                pos = r.json()
                check(f"position {pos_id} is now puzzle", pos["position_type"] == "puzzle")
                check(f"position {pos_id} has solution", pos["solution_san"] == "e4")


def test_filter_by_type():
    """Create mixed positions, filter -> correct results."""
    # Create 3 puzzles
    puzzle_ids = []
    for i in range(3):
        data = {
            "fen": PUZZLE_FEN,
            "title": f"Filter Test Puzzle {i+1}",
            "position_type": "puzzle",
            "solution_san": "Rd8+",
            "tags": ["filter-test"]
        }
        r = c.post("/api/positions/", json=data)
        if r.status_code == 201:
            puzzle_ids.append(r.json()["id"])
    
    # Create 2 tabiyas
    tabiya_ids = []
    for i in range(2):
        data = {
            "fen": TABIYA_FEN,
            "title": f"Filter Test Tabiya {i+1}",
            "position_type": "tabiya",
            "tags": ["filter-test"]
        }
        r = c.post("/api/positions/", json=data)
        if r.status_code == 201:
            tabiya_ids.append(r.json()["id"])
    
    # Test filtering by type
    r = c.get("/api/positions/?position_type=puzzle")
    check("filter by puzzle type", r.status_code == 200)
    if r.status_code == 200:
        puzzles = r.json()
        puzzle_ids_from_api = {p["id"] for p in puzzles}
        check("all created puzzles returned", 
              all(pid in puzzle_ids_from_api for pid in puzzle_ids))
    
    r = c.get("/api/positions/?position_type=tabiya")
    check("filter by tabiya type", r.status_code == 200)
    if r.status_code == 200:
        tabiyas = r.json()
        tabiya_ids_from_api = {t["id"] for t in tabiyas}
        check("all created tabiyas returned",
              all(tid in tabiya_ids_from_api for tid in tabiya_ids))
    
    # Test convenience endpoints
    r = c.get("/api/positions/puzzles")
    check("puzzles convenience endpoint", r.status_code == 200)
    if r.status_code == 200:
        puzzles = r.json()
        check("all are puzzles", all(p["position_type"] == "puzzle" for p in puzzles))
    
    r = c.get("/api/positions/tabiyas")
    check("tabiyas convenience endpoint", r.status_code == 200)
    if r.status_code == 200:
        tabiyas = r.json()
        check("all are tabiyas", all(t["position_type"] == "tabiya" for t in tabiyas))


def test_migration_defaults():
    """Existing positions default to tabiya."""
    # Create a position without specifying type (simulating old positions)
    data = {
        "fen": STARTING_FEN,
        "title": "Legacy Position"
        # No position_type specified
    }
    r = c.post("/api/positions/", json=data)
    check("create without type", r.status_code == 201)
    if r.status_code == 201:
        pos = r.json()
        check("defaults to tabiya", pos["position_type"] == "tabiya")


def test_practice_history_preserved():
    """Type changes don't affect practice games."""
    # Create a tabiya
    data = {
        "fen": TABIYA_FEN,
        "title": "Practice Test Position",
        "position_type": "tabiya"
    }
    r = c.post("/api/positions/", json=data)
    if r.status_code != 201:
        check("practice_history_preserved", False, "Failed to create position")
        return
    pos_id = r.json()["id"]
    
    # Change to puzzle
    update = {
        "position_type": "puzzle",
        "solution_san": "Nf6"
    }
    r = c.put(f"/api/positions/{pos_id}", json=update)
    check("change to puzzle", r.status_code == 200)
    
    # Change back to tabiya
    update = {"position_type": "tabiya"}
    r = c.put(f"/api/positions/{pos_id}", json=update)
    check("change back to tabiya", r.status_code == 200)
    
    # Position should still exist
    r = c.get(f"/api/positions/{pos_id}")
    check("position still exists", r.status_code == 200)


def test_solution_validation():
    """Valid SAN in solution."""
    data = {
        "fen": PUZZLE_FEN,
        "title": "Solution Validation Test",
        "position_type": "puzzle",
        "solution_san": "Rd8+",
        "theme": "test"
    }
    r = c.post("/api/positions/", json=data)
    check("solution_validation", r.status_code == 201)


def test_type_statistics():
    """Endpoint returns counts by type."""
    # Get all positions
    r = c.get("/api/positions/")
    check("get all positions", r.status_code == 200)
    if r.status_code != 200:
        return
    
    all_positions = r.json()
    
    # Count by type manually
    puzzle_count = sum(1 for p in all_positions if p["position_type"] == "puzzle")
    tabiya_count = sum(1 for p in all_positions if p["position_type"] == "tabiya")
    
    # Compare with filtered endpoints
    r = c.get("/api/positions/puzzles")
    check("puzzles endpoint works", r.status_code == 200)
    if r.status_code == 200:
        puzzles = r.json()
        check("puzzle count matches", len(puzzles) == puzzle_count)
    
    r = c.get("/api/positions/tabiyas")
    check("tabiyas endpoint works", r.status_code == 200)
    if r.status_code == 200:
        tabiyas = r.json()
        check("tabiya count matches", len(tabiyas) == tabiya_count)
    
    print(f"  Stats: {puzzle_count} puzzles, {tabiya_count} tabiyas")


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("Testing Phase 15: Position Types (Puzzle vs Tabiya)")
    print("="*60 + "\n")
    
    test_create_puzzle_with_solution()
    test_create_puzzle_without_solution()
    test_create_tabiya()
    test_change_tabiya_to_puzzle()
    test_change_puzzle_to_tabiya()
    test_bulk_reclassify()
    test_filter_by_type()
    test_migration_defaults()
    test_practice_history_preserved()
    test_solution_validation()
    test_type_statistics()
    
    print("\n" + "="*60)
    print(f"Results: {passed} passed, {failed} failed")
    if failed == 0:
        print("🎉 All Phase 15 tests passed!")
    print("="*60 + "\n")
    
    return failed == 0


if __name__ == "__main__":
    import sys
    sys.exit(0 if main() else 1)