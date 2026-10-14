"""Basic API tests covering core position CRUD and chess services."""

import pytest


class TestHealthAndStatic:
    def test_health_check(self, test_client):
        """API health endpoint returns ok."""
        r = test_client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_frontend_serves(self, test_client):
        """Frontend static files are accessible."""
        r = test_client.get("/")
        assert r.status_code == 200


@pytest.fixture
def two_positions(test_client):
    """Create the two standard CRUD-test positions through the real API; return their ids."""
    r1 = test_client.post("/api/positions/", json={
        "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        "title": "King's Pawn",
        "notes": "1.e4 opening",
        "tags": ["opening", "e4"],
        "position_type": "tabiya"
    })
    assert r1.status_code == 201

    r2 = test_client.post("/api/positions/", json={
        "fen": "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
        "title": "King's Pawn Game",
        "tags": ["opening"],
        "position_type": "tabiya"
    })
    assert r2.status_code == 201

    return r1.json()["id"], r2.json()["id"]


class TestPositionCRUD:
    def test_create_position(self, test_client):
        """Create position with valid FEN."""
        r = test_client.post("/api/positions/", json={
            "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            "title": "King's Pawn",
            "notes": "1.e4 opening",
            "tags": ["opening", "e4"],
            "position_type": "tabiya"
        })
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "King's Pawn"
        assert len(data["tags"]) == 2

    def test_create_second_position(self, test_client):
        """Create second position."""
        r = test_client.post("/api/positions/", json={
            "fen": "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
            "title": "King's Pawn Game",
            "tags": ["opening"],
            "position_type": "tabiya"
        })
        assert r.status_code == 201

    def test_reject_invalid_fen(self, test_client):
        """Invalid FEN should be rejected."""
        r = test_client.post("/api/positions/", json={
            "fen": "invalid_fen_string",
            "title": "Bad Position",
            "position_type": "tabiya"
        })
        assert r.status_code == 400

    def test_list_positions(self, test_client, two_positions):
        """List all positions."""
        r = test_client.get("/api/positions/")
        assert r.status_code == 200
        positions = r.json()
        assert len(positions) >= 2

    def test_filter_by_tag(self, test_client, two_positions):
        """Filter positions by tag."""
        r = test_client.get("/api/positions/?tags=e4")
        assert r.status_code == 200
        positions = r.json()
        # Should find the first position which has "e4" tag
        assert len(positions) >= 1

    def test_list_tags(self, test_client, two_positions):
        """List all tags."""
        r = test_client.get("/api/tags/")
        assert r.status_code == 200
        tags = r.json()
        tag_names = [t["name"] for t in tags]
        assert "opening" in tag_names
        assert "e4" in tag_names

    def test_update_position(self, test_client, two_positions):
        """Update existing position."""
        id1, _ = two_positions
        r = test_client.put(f"/api/positions/{id1}", json={
            "notes": "Updated!",
            "tags": ["openings", "e4", "beginner"]
        })
        assert r.status_code == 200
        data = r.json()
        assert len(data["tags"]) == 3

    def test_cascade_delete(self, test_client, two_positions):
        """Deleting one of two positions leaves the other."""
        id1, _ = two_positions
        r = test_client.delete(f"/api/positions/{id1}")
        assert r.status_code == 204

        r = test_client.get("/api/positions/")
        assert r.status_code == 200
        positions = r.json()
        assert len(positions) == 1


class TestDuplicateMessageAndTitleSearch:
    def test_duplicate_returns_existing_title_in_message(self, test_client):
        """409 on a FEN duplicate includes existing_title and names it in the message."""
        fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
        r1 = test_client.post("/api/positions/", json={
            "fen": fen, "title": "Named One", "position_type": "tabiya"
        })
        assert r1.status_code == 201

        r2 = test_client.post("/api/positions/", json={
            "fen": fen, "title": "Named Two", "position_type": "tabiya"
        })
        assert r2.status_code == 409
        detail = r2.json()["detail"]
        assert detail["existing_title"] == "Named One"
        assert detail["message"] == "Already saved as Named One"

    def test_duplicate_of_auto_named_position_returns_generated_name(self, test_client):
        """409 on a duplicate of an auto-named (title omitted) position names the generated title."""
        fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2"
        r1 = test_client.post("/api/positions/", json={
            "fen": fen, "position_type": "tabiya"
        })
        assert r1.status_code == 201
        generated_title = r1.json()["title"]
        assert generated_title

        r2 = test_client.post("/api/positions/", json={
            "fen": fen, "position_type": "tabiya"
        })
        assert r2.status_code == 409
        detail = r2.json()["detail"]
        assert detail["existing_title"] == generated_title
        assert detail["message"] == f"Already saved as {generated_title}"

    def test_title_q_and_limit_filter_title_only(self, test_client):
        """title_q matches only the title, not notes, and limit caps results."""
        test_client.post("/api/positions/", json={
            "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            "title": "swift-otter",
            "position_type": "tabiya",
        })
        test_client.post("/api/positions/", json={
            "fen": "rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            "title": "no match here",
            "notes": "mentions otter",
            "position_type": "tabiya",
        })

        r = test_client.get("/api/positions/?title_q=otter&limit=1")
        assert r.status_code == 200
        positions = r.json()
        assert len(positions) == 1
        assert positions[0]["title"] == "swift-otter"


class TestChessServices:
    def test_uci_to_san(self, test_client):
        """Convert UCI moves to SAN notation."""
        r = test_client.post("/api/chess/uci-to-san", json={
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "uci_moves": ["e2e4", "e7e5", "g1f3"]
        })
        assert r.status_code == 200
        assert r.json()["san"] == "1. e4 e5 2. Nf3"

    def test_uci_to_san_black_to_move(self, test_client):
        """Convert UCI moves with black to move."""
        r = test_client.post("/api/chess/uci-to-san", json={
            "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            "uci_moves": ["e7e5", "g1f3"]
        })
        assert r.status_code == 200
        assert "1... e5" in r.json()["san"]