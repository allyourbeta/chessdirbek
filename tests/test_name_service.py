"""Tests for auto-generated placeholder names."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Set test database before importing
os.environ["CHESSQUIZ_DB_URL"] = "sqlite:///:memory:"

from backend.main import app
from backend.services import generate_placeholder_name
from fastapi.testclient import TestClient

client = TestClient(app)


def test_name_format():
    name = generate_placeholder_name()
    assert "-" in name
    parts = name.split("-")
    assert len(parts) == 2
    assert all(part.isalpha() and part.islower() for part in parts)


def test_names_vary():
    """Verify the generator produces a reasonable spread, not the same name twice."""
    names = {generate_placeholder_name() for _ in range(50)}
    # ~40,000 combos, 50 draws should be well above 30 unique
    assert len(names) > 30


def test_create_position_generates_title_if_missing():
    res = client.post("/api/positions/", json={
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "title": None,
        "tags": [],
    })
    assert res.status_code == 201
    body = res.json()
    assert body["title"]
    assert "-" in body["title"]


def test_create_position_keeps_provided_title():
    res = client.post("/api/positions/", json={
        "fen": "8/8/8/8/8/6k1/4R3/4K3 w - - 0 1",  # Unique FEN 
        "title": "Lucena Position",
        "tags": [],
    })
    assert res.status_code == 201
    assert res.json()["title"] == "Lucena Position"


def test_update_empty_title_regenerates():
    # Create with a real title
    res = client.post("/api/positions/", json={
        "fen": "4k3/8/8/8/8/8/4K3/4R3 w - - 0 1",  # Different unique FEN
        "title": "Real Title",
        "tags": [],
    })
    assert res.status_code == 201
    pid = res.json()["id"]
    # Edit to clear title
    res = client.put(f"/api/positions/{pid}", json={"title": "   "})
    assert res.status_code == 200
    assert res.json()["title"] != "Real Title"
    assert "-" in res.json()["title"]