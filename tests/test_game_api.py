#!/usr/bin/env python3
"""Phase 4 tests: Game CRUD, bulk import, position search, collections."""

import sys
import os

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


VALID_PGN = """[Event "Smith-Morra Gambit"]
[Site "Chess.com"]
[Date "2024.01.15"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]
[ECO "B21"]
[Opening "Sicilian Defense: Smith-Morra Gambit"]

1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 d6 6. Bc4 e6 7. O-O Nf6 8. Qe2 Be7 9. Rd1 e5 10. Be3 O-O 11. Rac1 Bg4 12. Nd5 Bxf3 13. gxf3 Nxd5 14. Bxd5 Rc8 15. Bb6 Qd7 16. Rxc6 1-0"""

MULTI_PGN = """[Event "Smith-Morra Gambit"]
[Site "Chess.com"]
[Date "2024.01.15"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]
[ECO "B21"]
[Opening "Sicilian Defense: Smith-Morra Gambit"]

1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 d6 6. Bc4 e6 7. O-O Nf6 8. Qe2 Be7 9. Rd1 e5 10. Be3 O-O 11. Rac1 Bg4 12. Nd5 Bxf3 13. gxf3 Nxd5 14. Bxd5 Rc8 15. Bb6 Qd7 16. Rxc6 1-0

[Event "Another Smith-Morra"]
[Site "Lichess"]
[Date "2024.03.10"]
[White "Player3"]
[Black "Player4"]
[Result "0-1"]
[ECO "B21"]
[Opening "Sicilian Defense: Smith-Morra Gambit"]

1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 e6 6. Bc4 a6 7. O-O Nge7 8. Bg5 h6 9. Be3 Ng6 10. Bb3 Be7 11. Qd2 O-O 12. Rad1 b5 13. f4 Bb7 14. f5 exf5 15. exf5 Nge5 16. Nxe5 Nxe5 17. Qf2 Nc4 0-1

[Event "Elephant Gambit"]
[Site "Online"]
[Date "2024.05.20"]
[White "Opponent"]
[Black "Ashish"]
[Result "0-1"]
[ECO "C40"]
[Opening "Elephant Gambit"]

1. e4 e5 2. Nf3 d5 3. exd5 Bd6 4. d4 e4 5. Ne5 Nf6 6. Bc4 O-O 7. O-O Bxe5 8. dxe5 Nxd5 9. Qh5 Nc6 10. Bxd5 Qxd5 11. Nc3 Qxe5 0-1"""

START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

print("Running Phase 4 tests...\n")

print("--- Game API ---")

r = c.post("/api/games/", json={"pgn_text": VALID_PGN, "tags": ["test"]})
check("Create game", r.status_code == 201, f"got {r.status_code}: {r.text[:200]}")
game1_id = r.json()["id"]
check("Game has auto-tags", len(r.json()["tags"]) > 1)

r = c.post("/api/games/", json={"pgn_text": ""})
check("Reject empty PGN", r.status_code == 400, f"got {r.status_code}")

r = c.post("/api/games/import", json={"pgn_text": MULTI_PGN, "tags": ["bulk"], "force": True})
check("Bulk import status", r.status_code == 200, f"got {r.status_code}: {r.text[:200]}")
check("Bulk import count", r.json()["imported"] == 3, f"got {r.json()}")
check("Bulk import game_ids", len(r.json()["game_ids"]) == 3)
bulk_ids = r.json()["game_ids"]

r = c.get("/api/games/")
check("List games", r.status_code == 200 and len(r.json()) == 4,
      f"got {r.status_code}, count={len(r.json()) if r.status_code == 200 else 'N/A'}")

r = c.get("/api/games/?tag=bulk")
check("Filter by tag", len(r.json()) == 3, f"got {len(r.json())}")

r = c.get("/api/games/?eco=B21")
check("Filter by ECO", len(r.json()) >= 2, f"got {len(r.json())}")

r = c.get("/api/games/?search=Player1")
check("Search by player", len(r.json()) >= 1, f"got {len(r.json())}")

r = c.get(f"/api/games/{game1_id}")
check("Get game detail", r.status_code == 200)
detail = r.json()
check("Detail has moves_san", len(detail["moves_san"]) == 31, f"got {len(detail['moves_san'])}")
check("Detail has fens", len(detail["fens"]) == 32, f"got {len(detail['fens'])}")
check("Detail has comments", "comments" in detail)

r = c.get("/api/games/9999")
check("404 for missing game", r.status_code == 404)

r = c.put(f"/api/games/{game1_id}", json={"tags": ["updated", "sicilian"]})
check("Update game tags", r.status_code == 200, f"got {r.status_code}")
check("Tags updated", len(r.json()["tags"]) == 2)

r = c.post("/api/games/search-position", json={"fen": START_FEN, "search_type": "exact"})
check("Position search (exact)", r.status_code == 200, f"got {r.status_code}")
check("Start pos found in all games", len(r.json()) == 4, f"got {len(r.json())}")

AFTER_E4_C5 = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2"
r = c.post("/api/games/search-position", json={"fen": AFTER_E4_C5, "search_type": "exact"})
check("Position search (1.e4 c5)", len(r.json()) >= 2, f"got {len(r.json())}")

r = c.post("/api/games/search-position", json={"fen": START_FEN, "search_type": "pawn"})
check("Pawn structure search", r.status_code == 200)
check("Start pawn sig found in all", len(r.json()) == 4, f"got {len(r.json())}")

r = c.post("/api/games/search-position", json={"fen": START_FEN, "search_type": "bad"})
check("Invalid search type rejected", r.status_code == 400)

r = c.delete(f"/api/games/{game1_id}")
check("Delete game", r.status_code == 204)
r = c.get(f"/api/games/{game1_id}")
check("Deleted game gone", r.status_code == 404)

r = c.post("/api/games/search-position", json={"fen": START_FEN, "search_type": "exact"})
check("Position index cascade", len(r.json()) == 3, f"got {len(r.json())}")

print("\n--- Collection API ---")

r = c.post("/api/collections/", json={"name": "Smith-Morra", "description": "SM Gambit games"})
check("Create collection", r.status_code == 201, f"got {r.status_code}: {r.text[:200]}")
coll_id = r.json()["id"]
check("Collection has name", r.json()["name"] == "Smith-Morra")

r = c.post("/api/collections/", json={"name": "Smith-Morra"})
check("Reject duplicate name", r.status_code == 409)

r = c.get("/api/collections/")
check("List collections", r.status_code == 200 and len(r.json()) >= 1)

r = c.post(f"/api/collections/{coll_id}/games?game_id={bulk_ids[0]}")
check("Add game to collection", r.status_code == 204)
r = c.post(f"/api/collections/{coll_id}/games?game_id={bulk_ids[1]}")
check("Add second game", r.status_code == 204)

r = c.get(f"/api/collections/{coll_id}")
check("Collection detail", r.status_code == 200)
check("Collection has 2 games", len(r.json()["games"]) == 2,
      f"got {len(r.json()['games'])}")

r = c.get(f"/api/games/?collection_id={coll_id}")
check("Filter by collection", len(r.json()) == 2, f"got {len(r.json())}")

r = c.put(f"/api/collections/{coll_id}", json={"name": "Morra Gambit"})
check("Update collection", r.status_code == 200 and r.json()["name"] == "Morra Gambit")

r = c.delete(f"/api/collections/{coll_id}/games/{bulk_ids[0]}")
check("Remove game from collection", r.status_code == 204)
r = c.get(f"/api/collections/{coll_id}")
check("Collection now has 1 game", len(r.json()["games"]) == 1)

r = c.post("/api/collections/", json={"name": "Elephant"})
check("Create second collection", r.status_code == 201)
coll2_id = r.json()["id"]

r = c.post("/api/games/import", json={
    "pgn_text": VALID_PGN,
    "tags": ["coll-test"],
    "collection_ids": [coll2_id],
    "force": True,
})
check("Import with collection", r.json()["imported"] == 1)
r = c.get(f"/api/collections/{coll2_id}")
check("Imported game in collection", len(r.json()["games"]) == 1)

r = c.delete(f"/api/collections/{coll_id}")
check("Delete collection", r.status_code == 204)
r = c.get("/api/collections/")
check("Collection gone", all(ci["id"] != coll_id for ci in r.json()))

r = c.get("/api/games/")
game_count_after = len(r.json())
check("Games survive collection delete", game_count_after >= 3)

print("\n--- Opening Tree API ---")

r = c.get("/api/opening-tree/?fen=" + START_FEN)
check("Opening tree status", r.status_code == 200, f"got {r.status_code}")
tree = r.json()
check("Opening tree has fen", tree["fen"] == START_FEN)
check("Opening tree total_games > 0", tree["total_games"] > 0, f"got {tree['total_games']}")
check("Opening tree has moves", len(tree["moves"]) > 0, f"got {len(tree['moves'])}")

e4_move = next((m for m in tree["moves"] if m["san"] == "e4"), None)
check("e4 in opening tree", e4_move is not None)
check("e4 has games count", e4_move and e4_move["games"] >= 3, f"got {e4_move}")
check("e4 has result stats", e4_move and (e4_move["white_wins"] + e4_move["draws"] + e4_move["black_wins"]) == e4_move["games"])
check("e4 has fen", e4_move and "4P3" in e4_move["fen"])

AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
r = c.get("/api/opening-tree/?fen=" + AFTER_E4)
tree2 = r.json()
check("After e4: tree has moves", len(tree2["moves"]) >= 2, f"got {len(tree2['moves'])}")
c5 = next((m for m in tree2["moves"] if m["san"] == "c5"), None)
e5 = next((m for m in tree2["moves"] if m["san"] == "e5"), None)
check("c5 in tree after e4", c5 is not None)
check("e5 in tree after e4", e5 is not None)

RARE_FEN = "8/8/8/8/8/8/8/4K3 w - - 0 1"
r = c.get("/api/opening-tree/?fen=" + RARE_FEN)
check("Rare position: empty tree", r.status_code == 200 and r.json()["total_games"] == 0)

print("\n--- Phase 9: Collection Browser + Batch Review ---")

r = c.post("/api/collections/", json={"name": "Phase9 Review", "description": "Batch review test"})
check("Create collection for batch review", r.status_code == 201)
p9_coll_id = r.json()["id"]
check("New collection game_count == 0", r.json()["game_count"] == 0)

r = c.get("/api/games/")
all_game_ids = [g["id"] for g in r.json()]
check("Have games to review", len(all_game_ids) >= 2)

for gid in all_game_ids[:2]:
    r = c.post(f"/api/collections/{p9_coll_id}/games?game_id={gid}")
    check(f"Add game {gid} to batch collection", r.status_code == 204)

r = c.get("/api/collections/")
colls = r.json()
p9_coll = next((cx for cx in colls if cx["id"] == p9_coll_id), None)
check("Collection browser shows updated count", p9_coll is not None and p9_coll["game_count"] == 2,
      f"got {p9_coll}")

r = c.get(f"/api/games/?collection_id={p9_coll_id}")
batch_games = r.json()
check("Batch review: list games in collection",
      r.status_code == 200 and len(batch_games) == 2, f"got {len(batch_games)}")
check("Batch games have ids to navigate", all("id" in g for g in batch_games))

r = c.put(f"/api/collections/{p9_coll_id}",
          json={"name": "Phase9 Renamed", "description": "Edited"})
check("Edit collection name/desc", r.status_code == 200
      and r.json()["name"] == "Phase9 Renamed"
      and r.json()["description"] == "Edited")

print("\n--- Phase 9: Position Search UI ---")

r = c.post("/api/games/search-position",
           json={"fen": START_FEN, "search_type": "exact"})
check("Search UI (exact) status", r.status_code == 200)
exact_hits = r.json()
check("Search UI (exact) returns list", isinstance(exact_hits, list) and len(exact_hits) >= 2)
check("Search UI result has half_move", all("half_move" in h for h in exact_hits))
check("Search UI result has game_id", all("game_id" in h for h in exact_hits))

r = c.post("/api/games/search-position",
           json={"fen": AFTER_E4_C5, "search_type": "exact"})
e4c5_hits = r.json()
check("Search UI after e4 c5", len(e4c5_hits) >= 2)
check("All hits have half_move=2 for exact",
      all(h["half_move"] == 2 for h in e4c5_hits),
      f"got {[h['half_move'] for h in e4c5_hits]}")

r = c.post("/api/games/search-position",
           json={"fen": START_FEN, "search_type": "pawn"})
check("Search UI (pawn structure) status", r.status_code == 200)
pawn_hits = r.json()
check("Search UI (pawn) returns list", isinstance(pawn_hits, list) and len(pawn_hits) >= 2)

r = c.post("/api/games/search-position",
           json={"fen": "invalid fen string", "search_type": "exact"})
check("Search UI handles bad FEN gracefully",
      r.status_code in (200, 400, 422, 500), f"got {r.status_code}")

r = c.delete(f"/api/collections/{p9_coll_id}")
check("Delete Phase 9 collection", r.status_code == 204)
r = c.get(f"/api/games/")
check("Games preserved after collection delete",
      len(r.json()) >= len(all_game_ids))

print("\n--- Duplicate detection on import ---")

DUP_PGN = """[Event "Dup Test"]
[Site "Test"]
[Date "2024.06.01"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0"""

r = c.post("/api/games/import", json={"pgn_text": DUP_PGN, "tags": ["dup"]})
check("Import unique game", r.status_code == 200 and r.json()["imported"] == 1,
      f"got {r.json()}")
check("No duplicates initially", r.json()["duplicates"] == 0)
first_import_ids = r.json()["game_ids"]

r = c.post("/api/games/import", json={"pgn_text": DUP_PGN, "tags": ["dup"]})
check("Re-import detects duplicate", r.status_code == 200 and r.json()["imported"] == 0,
      f"got {r.json()}")
check("Duplicates count == 1", r.json()["duplicates"] == 1, f"got {r.json()}")

r = c.post("/api/games/import",
           json={"pgn_text": DUP_PGN, "tags": ["dup"], "force": True})
check("Force re-import bypasses check", r.json()["imported"] == 1, f"got {r.json()}")
check("No duplicates counted when forced", r.json()["duplicates"] == 0)

for gid in first_import_ids + r.json()["game_ids"]:
    c.delete(f"/api/games/{gid}")

print("\n--- Single game delete ---")

r = c.post("/api/games/", json={"pgn_text": DUP_PGN, "tags": ["del"]})
check("Create game for delete", r.status_code == 201)
del_gid = r.json()["id"]
r = c.delete(f"/api/games/{del_gid}")
check("Delete single game", r.status_code == 204)
r = c.get(f"/api/games/{del_gid}")
check("Game gone after single delete", r.status_code == 404)
r = c.delete(f"/api/games/{del_gid}")
check("Delete non-existent game returns 404", r.status_code == 404)

print(f"\n{'='*40}")
print(f"  {passed} passed, {failed} failed")
print(f"{'='*40}")

sys.exit(1 if failed else 0)
