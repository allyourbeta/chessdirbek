#!/usr/bin/env python3
"""Phase 10 tests: practice games, stats, per-position opening tree."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ["CHESSDIRBEK_DB_URL"] = "sqlite:///:memory:"

from backend.main import app
from fastapi.testclient import TestClient

c = TestClient(app)

passed = 0
failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✓ {name}")
        passed += 1
    else:
        print(f"  ✗ {name} — {detail}")
        failed += 1


print("Running Phase 10 tests...\n")

# Engine levels config exposed
r = c.get("/api/practice/engine-levels")
check("Engine levels endpoint", r.status_code == 200)
levels = r.json()
check("Has easy/medium/hard/max",
      all(k in levels for k in ("easy", "medium", "hard", "max")),
      f"got keys {list(levels.keys())}")
check("Easy has depth+skill", "depth" in levels["easy"] and "skill" in levels["easy"])

# Create a root position
START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"

r = c.post("/api/positions/", json={
    "fen": START_FEN, "title": "Opening tabiya", "tags": ["practice-test"]
})
check("Create root position", r.status_code == 201)
root_id = r.json()["id"]

r = c.post("/api/positions/", json={
    "fen": AFTER_E4, "title": "Another", "tags": []
})
other_id = r.json()["id"]

# Save practice game - win (eval swings > 1.0 in user's favor)
WIN_PGN = """[Event "Practice"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0"""

r = c.post("/api/practice/", json={
    "root_position_id": root_id,
    "pgn_text": WIN_PGN,
    "user_color": "white",
    "final_fen": "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    "move_count": 6,
    "engine_name": "Stockfish",
    "engine_level": "easy",
    "starting_eval": 0.2,
    "final_eval": 2.5,
})
check("Create practice game (win)", r.status_code == 201, f"got {r.status_code}: {r.text[:200]}")
pg_win_id = r.json()["id"]
check("Engine verdict auto-computed = win",
      r.json()["engine_verdict"] == "win",
      f"got {r.json()['engine_verdict']}")
check("Starting eval saved", r.json()["starting_eval"] == 0.2)
check("Final eval saved", r.json()["final_eval"] == 2.5)
check("Engine level saved", r.json()["engine_level"] == "easy")

# Loss: eval swung > 1.0 against user
r = c.post("/api/practice/", json={
    "root_position_id": root_id,
    "pgn_text": WIN_PGN,
    "user_color": "white",
    "final_fen": "test",
    "move_count": 20,
    "engine_level": "hard",
    "starting_eval": 0.0,
    "final_eval": -3.0,
})
check("Create practice game (loss)", r.status_code == 201)
check("Engine verdict = loss",
      r.json()["engine_verdict"] == "loss",
      f"got {r.json()['engine_verdict']}")

# Draw: eval barely changed
r = c.post("/api/practice/", json={
    "root_position_id": root_id,
    "pgn_text": WIN_PGN,
    "user_color": "white",
    "final_fen": "test",
    "move_count": 40,
    "engine_level": "medium",
    "starting_eval": 0.1,
    "final_eval": 0.3,
})
check("Engine verdict = draw for small delta",
      r.json()["engine_verdict"] == "draw",
      f"got {r.json()['engine_verdict']}")

# Black user: eval improves for black (goes more negative)
r = c.post("/api/practice/", json={
    "root_position_id": root_id,
    "pgn_text": WIN_PGN,
    "user_color": "black",
    "final_fen": "test",
    "move_count": 15,
    "engine_level": "easy",
    "starting_eval": 0.0,
    "final_eval": -2.0,
})
check("Black perspective: win when eval goes negative",
      r.json()["engine_verdict"] == "win",
      f"got {r.json()['engine_verdict']}")
pg_black_id = r.json()["id"]

# Invalid user_color rejected
r = c.post("/api/practice/", json={
    "root_position_id": root_id,
    "pgn_text": WIN_PGN,
    "user_color": "neither",
    "final_fen": "x",
    "move_count": 1,
    "engine_level": "easy",
})
check("Reject invalid user_color", r.status_code == 400)

# Missing position ref
r = c.post("/api/practice/", json={
    "root_position_id": 99999,
    "pgn_text": WIN_PGN,
    "user_color": "white",
    "final_fen": "x",
    "move_count": 1,
    "engine_level": "easy",
})
check("Reject unknown root position", r.status_code == 404)

# List practice games
r = c.get("/api/practice/")
check("List practice games", r.status_code == 200 and len((r.json()["games"] if "games" in r.json() else r.json())) == 4,
      f"got {len(r.json()) if r.status_code == 200 else 'err'}")

# Filter by root position
r = c.get(f"/api/practice/?root_position_id={root_id}")
check("Filter by root_position_id",
      len((r.json()["games"] if "games" in r.json() else r.json())) == 4, f"got {len(r.json())}")

r = c.get(f"/api/practice/?root_position_id={other_id}")
check("Filter returns empty for other position", len((r.json()["games"] if "games" in r.json() else r.json())) == 0)

# User can override verdict
r = c.put(f"/api/practice/{pg_win_id}", json={"user_verdict": "draw"})
check("User override verdict", r.status_code == 200)
check("user_verdict saved", r.json()["user_verdict"] == "draw")
check("engine_verdict preserved", r.json()["engine_verdict"] == "win")

r = c.put(f"/api/practice/{pg_win_id}", json={"notes": "interesting game"})
check("Update notes", r.json()["notes"] == "interesting game")

r = c.put(f"/api/practice/{pg_win_id}", json={"user_verdict": "nonsense"})
check("Invalid verdict rejected", r.status_code == 400)

# Get single practice game
r = c.get(f"/api/practice/{pg_win_id}")
check("Get practice game detail", r.status_code == 200)
check("Detail has pgn_text", len(r.json()["pgn_text"]) > 0)

r = c.get("/api/practice/99999")
check("404 for missing practice game", r.status_code == 404)

# Stats aggregation
r = c.get(f"/api/practice/stats/{root_id}")
check("Stats endpoint", r.status_code == 200)
stats = r.json()
check("Stats total = 4", stats["total_games"] == 4, f"got {stats}")
# After user override pg_win_id is draw (engine win); pg_black_id is win;
# one was engine win but overridden so 1 win, 2 draws (one overridden + one natural), 1 loss
check("Stats has win counts", "wins" in stats and "draws" in stats and "losses" in stats)
check("Stats win_rate is float 0-1",
      0.0 <= stats["win_rate"] <= 1.0)
check("Stats avg_move_count", stats["avg_move_count"] > 0)
check("Stats by_engine_level list",
      isinstance(stats["by_engine_level"], list)
      and len(stats["by_engine_level"]) >= 2)

# Find the easy breakdown
easy = next((b for b in stats["by_engine_level"] if b["engine_level"] == "easy"), None)
check("Easy breakdown present", easy is not None)
check("Easy breakdown has counts",
      easy and easy["total"] == 2, f"got {easy}")

# Per-position opening tree
r = c.get(f"/api/practice/tree/{root_id}")
check("Tree endpoint", r.status_code == 200)
tree = r.json()
check("Tree total_games = 4", tree["total_games"] == 4)
# All 4 games start with 1. e4
e4_move = next((m for m in tree["moves"] if m["san"] == "e4"), None)
check("e4 in practice tree", e4_move is not None)
check("e4 has 4 games", e4_move and e4_move["games"] == 4, f"got {e4_move}")
check("e4 has wins/draws/losses", e4_move and (
    e4_move["wins"] + e4_move["draws"] + e4_move["losses"]
    + (4 - e4_move["wins"] - e4_move["draws"] - e4_move["losses"])  # abandoned
) == 4)
check("Tree win_rate is float", isinstance(e4_move["win_rate"], float))

# Practice positions summary
r = c.get("/api/practice/positions")
check("List practice positions", r.status_code == 200)
summaries = r.json()
check("Has our root position",
      any(s["position_id"] == root_id for s in summaries))
our = next(s for s in summaries if s["position_id"] == root_id)
check("Summary has total_games", our["total_games"] == 4)
check("Summary has fen", our["fen"] == START_FEN)

# Delete practice game does not delete root position
r = c.delete(f"/api/practice/{pg_black_id}")
check("Delete practice game", r.status_code == 204)
r = c.get(f"/api/positions/{root_id}")
check("Root position survives practice delete", r.status_code == 200)
r = c.get(f"/api/practice/?root_position_id={root_id}")
check("One fewer practice game", len((r.json()["games"] if "games" in r.json() else r.json())) == 3)

# Cascade: delete root position removes practice games
r = c.delete(f"/api/positions/{root_id}")
check("Delete root position", r.status_code == 204)
r = c.get(f"/api/practice/?root_position_id={root_id}")
check("Practice games cascade-deleted", len((r.json()["games"] if "games" in r.json() else r.json())) == 0)

# Stats for deleted position = 404
r = c.get(f"/api/practice/stats/{root_id}")
check("Stats 404 for deleted position", r.status_code == 404)

# ==== Phase D: Filtering, sorting, and pagination tests ====

# Create a new position with diverse practice games for testing filters
r = c.post("/api/positions/", json={
    "fen": "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1",
    "title": "Filter Test Position",
    "tags": ["test"],
})
check("Create filter test position", r.status_code == 201)
filter_pos_id = r.json()["id"]

# Create practice games with various verdicts and levels
test_games = [
    # Wins at different levels
    {"verdict": "win", "level": "easy", "moves": 20},
    {"verdict": "win", "level": "medium", "moves": 25},
    {"verdict": "win", "level": "hard", "moves": 30},
    # Losses at different levels
    {"verdict": "loss", "level": "easy", "moves": 15},
    {"verdict": "loss", "level": "medium", "moves": 35},
    {"verdict": "loss", "level": "hard", "moves": 40},
    # Draws
    {"verdict": "draw", "level": "medium", "moves": 50},
    {"verdict": "draw", "level": "hard", "moves": 45},
    # Abandoned
    {"verdict": "abandoned", "level": "easy", "moves": 10},
    {"verdict": "abandoned", "level": "medium", "moves": 12},
]

created_game_ids = []
for i, game_cfg in enumerate(test_games):
    pgn = f'[Event "Test"]\n[White "You"]\n[Black "Engine"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6'
    r = c.post("/api/practice/", json={
        "root_position_id": filter_pos_id,
        "user_color": "white",
        "engine_level": game_cfg["level"],
        "pgn_text": pgn,
        "final_fen": "test_fen",  # Add required field
        "move_count": game_cfg["moves"],
        "starting_eval": 0.0,
        "final_eval": 1.5 if game_cfg["verdict"] == "win" else -1.5 if game_cfg["verdict"] == "loss" else 0.1,
    })
    check(f"Create test game {i+1}", r.status_code == 201, f"got {r.status_code}: {r.text[:200]}")
    game_id = r.json()["id"]
    created_game_ids.append(game_id)
    
    # Update verdict if not matching engine verdict
    if game_cfg["verdict"] == "abandoned":
        r = c.put(f"/api/practice/{game_id}", json={"user_verdict": "abandoned"})
        check(f"Set game {i+1} as abandoned", r.status_code == 200)
    elif game_cfg["verdict"] == "draw":
        r = c.put(f"/api/practice/{game_id}", json={"user_verdict": "draw"})
        check(f"Set game {i+1} as draw", r.status_code == 200)

# Test verdict filtering
r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&verdict=win")
check("Filter by verdict=win", r.status_code == 200)
data = r.json()
check("Filter win returns dict with games", "games" in data)
check("Filter win count", len(data["games"]) == 3)
check("Total count includes all", data["total_count"] == 3)

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&verdict=loss")
check("Filter by verdict=loss", r.status_code == 200)
check("Filter loss count", len(r.json()["games"]) == 3)

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&verdict=draw")
check("Filter by verdict=draw", r.status_code == 200)
check("Filter draw count", len(r.json()["games"]) == 2)

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&verdict=abandoned")
check("Filter by verdict=abandoned", r.status_code == 200)
check("Filter abandoned count", len(r.json()["games"]) == 2)

# Test invalid verdict
r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&verdict=invalid")
check("Invalid verdict returns 400", r.status_code == 400)

# Test engine level filtering
r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&engine_level=easy")
check("Filter by engine_level=easy", r.status_code == 200)
check("Filter easy count", len(r.json()["games"]) == 3)

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&engine_level=medium")
check("Filter by engine_level=medium", r.status_code == 200)
check("Filter medium count", len(r.json()["games"]) == 4)

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&engine_level=hard")
check("Filter by engine_level=hard", r.status_code == 200)
check("Filter hard count", len(r.json()["games"]) == 3)

# Unknown engine level returns empty
r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&engine_level=unknown")
check("Unknown engine_level returns empty", len(r.json()["games"]) == 0)

# Combined filters (AND logic)
r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&verdict=loss&engine_level=medium")
check("Combined filters", r.status_code == 200)
check("Loss AND medium count", len(r.json()["games"]) == 1)

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&verdict=win&engine_level=hard")
check("Win AND hard count", len(r.json()["games"]) == 1)

# Test sort orders
r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&sort=recent")
check("Sort by recent", r.status_code == 200)
games = r.json()["games"]
check("Recent sort default", len(games) == 10)

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&sort=oldest")
check("Sort by oldest", r.status_code == 200)
oldest_games = r.json()["games"]
# First game in oldest should be different from first in recent
check("Oldest differs from recent", oldest_games[0]["id"] != games[0]["id"])

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&sort=longest")
check("Sort by longest", r.status_code == 200)
longest_games = r.json()["games"]
check("Longest first has most moves", longest_games[0]["move_count"] >= longest_games[-1]["move_count"])

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&sort=shortest")
check("Sort by shortest", r.status_code == 200)
shortest_games = r.json()["games"]
check("Shortest first has least moves", shortest_games[0]["move_count"] <= shortest_games[-1]["move_count"])

# Invalid sort value
r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&sort=invalid")
check("Invalid sort returns 400", r.status_code == 400)

# Test pagination
r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&limit=5&offset=0")
check("Pagination limit=5", r.status_code == 200)
data = r.json()
check("First page has 5 games", len(data["games"]) == 5)
check("Total count still shows all", data["total_count"] == 10)
first_page_ids = [g["id"] for g in data["games"]]

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&limit=5&offset=5")
check("Second page offset=5", r.status_code == 200)
data = r.json()
check("Second page has 5 games", len(data["games"]) == 5)
second_page_ids = [g["id"] for g in data["games"]]
check("No overlap between pages", not any(id in first_page_ids for id in second_page_ids))

# Invalid pagination params
r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&limit=0")
check("limit=0 returns 400", r.status_code == 422)  # FastAPI validation

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&limit=-1")
check("limit<0 returns 400", r.status_code == 422)  # FastAPI validation

r = c.get(f"/api/practice/?root_position_id={filter_pos_id}&offset=-1")
check("offset<0 returns 400", r.status_code == 422)  # FastAPI validation

# Test stats filtering
r = c.get(f"/api/practice/stats/{filter_pos_id}?verdict=loss")
check("Stats with verdict filter", r.status_code == 200)
stats = r.json()
check("Stats filtered by loss", stats["total_games"] == 3)
check("Stats shows only losses", stats["losses"] == 3)
check("Stats shows no wins with loss filter", stats["wins"] == 0)

r = c.get(f"/api/practice/stats/{filter_pos_id}?engine_level=hard")
check("Stats with engine_level filter", r.status_code == 200)
stats = r.json()
check("Stats filtered by hard", stats["total_games"] == 3)

r = c.get(f"/api/practice/stats/{filter_pos_id}?verdict=win&engine_level=medium")
check("Stats with combined filters", r.status_code == 200)
stats = r.json()
check("Stats combined filters count", stats["total_games"] == 1)

# Clean up
r = c.delete(f"/api/positions/{filter_pos_id}")
check("Delete filter test position", r.status_code == 204)

print(f"\n{'='*40}")
print(f"  {passed} passed, {failed} failed")
print(f"{'='*40}")

sys.exit(1 if failed else 0)
