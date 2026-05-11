#!/usr/bin/env python3
"""ChessQuiz test suite. Run from project root: python test.py"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ["CHESSQUIZ_DB_URL"] = "sqlite:///:memory:"

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


print("Running ChessQuiz tests...\n")

# Health
r = c.get("/api/health")
check("Health check", r.status_code == 200, f"got {r.status_code}")

# Frontend
r = c.get("/")
check("Frontend serves", r.status_code == 200, f"got {r.status_code}")

# Create positions
r = c.post("/api/positions/", json={
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "title": "King's Pawn", "notes": "After 1. e4", "tags": ["openings", "e4"]
})
check("Create position", r.status_code == 201, f"got {r.status_code}: {r.text[:100]}")

r = c.post("/api/positions/", json={
    "fen": "8/8/4k3/8/8/4K3/4P3/8 w - - 0 1",
    "title": "K+P Endgame", "tags": ["endgame"]
})
check("Create 2nd position", r.status_code == 201)

# Invalid FEN
r = c.post("/api/positions/", json={"fen": "not-a-fen", "tags": []})
check("Reject invalid FEN", r.status_code == 400)

# List
r = c.get("/api/positions/")
check("List all positions", r.status_code == 200 and len(r.json()) == 2)

# Filter by tag
r = c.get("/api/positions/?tag=endgame")
check("Filter by tag", len(r.json()) == 1 and r.json()[0]["title"] == "K+P Endgame")

# Tags
r = c.get("/api/tags/")
check("List tags", r.status_code == 200 and len(r.json()) >= 2)


# Update
r = c.put("/api/positions/1", json={"notes": "Updated!", "tags": ["openings", "e4", "beginner"]})
check("Update position", r.status_code == 200 and len(r.json()["tags"]) == 3)

# Delete (with cascade)
r = c.delete("/api/positions/1")
check("Delete position", r.status_code == 204)

r = c.get("/api/positions/")
check("Cascade delete", len(r.json()) == 1)

# UCI to SAN
r = c.post("/api/chess/uci-to-san", json={
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "uci_moves": ["e2e4", "e7e5", "g1f3"]
})
check("UCI to SAN", r.status_code == 200 and r.json()["san"] == "1. e4 e5 2. Nf3")

r = c.post("/api/chess/uci-to-san", json={
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "uci_moves": ["e7e5", "g1f3"]
})
check("UCI to SAN (black to move)", "1... e5" in r.json()["san"])

# Summary
print(f"\n{'='*40}")
print(f"  {passed} passed, {failed} failed")
print(f"{'='*40}")

sys.exit(1 if failed else 0)
