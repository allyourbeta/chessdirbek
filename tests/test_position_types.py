#!/usr/bin/env python3
"""Tests for Phase 15: Position Types (Puzzle vs Tabiya)."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# CRITICAL: Set test database before importing app
os.environ["CHESSDIRBEK_DB_URL"] = "sqlite:///:memory:"

from backend.main import app
from fastapi.testclient import TestClient

# Use TestClient instead of hitting production server
c = TestClient(app)

passed = 0
failed = 0

_fen_counter = 0


def _unique_fen():
    """Legal FEN with two kings and a lone pawn on a square that advances
    every call, so every create() in this file gets its own position (the
    API rejects duplicate FENs with 409)."""
    global _fen_counter
    n = _fen_counter
    _fen_counter += 1
    file_idx = n % 8
    rank = 2 + (n // 8) % 6  # ranks 2..7, clear of the kings' back ranks
    row = 8 - rank  # 0-indexed from rank 8 (row 0) down to rank 1 (row 7)
    grid = [["." for _ in range(8)] for _ in range(8)]
    grid[0][4] = "k"  # e8
    grid[7][4] = "K"  # e1
    if grid[row][file_idx] == ".":
        grid[row][file_idx] = "P"
    else:
        grid[row][(file_idx + 1) % 8] = "P"
    ranks = []
    for row_cells in grid:
        s, empty = "", 0
        for cell in row_cells:
            if cell == ".":
                empty += 1
            else:
                if empty:
                    s += str(empty)
                    empty = 0
                s += cell
        if empty:
            s += str(empty)
        ranks.append(s)
    return "/".join(ranks) + " w - - 0 1"


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
        "fen": _unique_fen(),
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
    """Create puzzle without solution_san -> allowed (201). A tactic needs no
    solution to exist, same as the capture hotkey and the "+ Tactic" button."""
    data = {
        "fen": _unique_fen(),
        "title": "Puzzle Without Solution",
        "position_type": "puzzle",
        # No solution_san
        "theme": "endgame"
    }
    r = c.post("/api/positions/", json=data)
    check("create_puzzle_without_solution_allowed",
          r.status_code == 201,
          f"Status: {r.status_code}, Response: {r.text[:100]}")


def test_create_tabiya():
    """Create tabiya (solution_san ignored) -> success."""
    data = {
        "fen": _unique_fen(),
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


def test_change_tabiya_to_endgame():
    """PUT position_type=endgame on a tabiya -> success (detail-page reclassify target)."""
    data = {
        "fen": _unique_fen(),
        "title": "Reclassify To Endgame Test",
        "position_type": "tabiya"
    }
    r = c.post("/api/positions/", json=data)
    if r.status_code != 201:
        check("change_tabiya_to_endgame", False, f"Failed to create tabiya: {r.status_code}")
        return
    pos_id = r.json()["id"]

    r = c.put(f"/api/positions/{pos_id}", json={"position_type": "endgame"})
    check("change_tabiya_to_endgame",
          r.status_code == 200,
          f"Status: {r.status_code}, Response: {r.text[:100]}")
    if r.status_code == 200:
        check("changed to endgame type", r.json()["position_type"] == "endgame")


def test_put_puzzle_without_solution_allowed():
    """PUT position_type=puzzle with no solution_san -> allowed (200), same as create."""
    data = {
        "fen": _unique_fen(),
        "title": "PUT Without Solution Test",
        "position_type": "tabiya"
    }
    r = c.post("/api/positions/", json=data)
    if r.status_code != 201:
        check("put_puzzle_without_solution_allowed", False, f"Failed to create tabiya: {r.status_code}")
        return
    pos_id = r.json()["id"]

    r = c.put(f"/api/positions/{pos_id}", json={"position_type": "puzzle"})
    check("put_puzzle_without_solution_allowed",
          r.status_code == 200,
          f"Status: {r.status_code}, Response: {r.text[:100]}")
    if r.status_code == 200:
        check("put without solution is now a puzzle", r.json()["position_type"] == "puzzle")


def test_bulk_reclassify():
    """Reclassify 5 positions at once -> all updated."""
    # Create 5 tabiyas
    position_ids = []
    for i in range(5):
        data = {
            "fen": _unique_fen(),
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


def test_bulk_reclassify_puzzle_without_solution():
    """Bulk reclassify to puzzle with no solution_san -> allowed (200), same as a single PUT."""
    position_ids = []
    for i in range(2):
        data = {
            "fen": _unique_fen(),
            "title": f"Bulk No Solution {i+1}",
            "position_type": "tabiya"
        }
        r = c.post("/api/positions/", json=data)
        if r.status_code == 201:
            position_ids.append(r.json()["id"])

    check("created 2 test positions for bulk-no-solution", len(position_ids) == 2)

    bulk_data = {
        "position_ids": position_ids,
        "new_type": "puzzle"
        # No solution_san
    }
    r = c.post("/api/positions/bulk-reclassify", json=bulk_data)
    check("bulk_reclassify_without_solution allowed",
          r.status_code == 200,
          f"Status: {r.status_code}, Response: {r.text[:100]}")
    if r.status_code == 200:
        result = r.json()
        check("bulk-no-solution all succeeded", result["success_count"] == len(position_ids))
        check("bulk-no-solution no failures", result["failure_count"] == 0)


def test_filter_by_type():
    """Create mixed positions, filter -> correct results."""
    # Create 3 puzzles
    puzzle_ids = []
    for i in range(3):
        data = {
            "fen": _unique_fen(),
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
            "fen": _unique_fen(),
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
        "fen": _unique_fen(),
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
        "fen": _unique_fen(),
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
        "fen": _unique_fen(),
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
    test_change_tabiya_to_endgame()
    test_put_puzzle_without_solution_allowed()
    test_bulk_reclassify()
    test_bulk_reclassify_puzzle_without_solution()
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
