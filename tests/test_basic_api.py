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

    def test_list_positions(self, test_client):
        """List all positions."""
        r = test_client.get("/api/positions/")
        assert r.status_code == 200
        positions = r.json()
        assert len(positions) >= 2

    def test_filter_by_tag(self, test_client):
        """Filter positions by tag."""
        r = test_client.get("/api/positions/?tags=e4")
        assert r.status_code == 200
        positions = r.json()
        # Should find the first position which has "e4" tag
        assert len(positions) >= 1

    def test_list_tags(self, test_client):
        """List all tags."""
        r = test_client.get("/api/tags/")
        assert r.status_code == 200
        tags = r.json()
        tag_names = [t["name"] for t in tags]
        assert "opening" in tag_names
        assert "e4" in tag_names

    def test_update_position(self, test_client):
        """Update existing position."""
        r = test_client.put("/api/positions/1", json={
            "notes": "Updated!",
            "tags": ["openings", "e4", "beginner"]
        })
        assert r.status_code == 200
        data = r.json()
        assert len(data["tags"]) == 3

    def test_delete_position(self, test_client):
        """Delete position."""
        r = test_client.delete("/api/positions/1")
        assert r.status_code == 204

    def test_cascade_delete(self, test_client):
        """Verify position was deleted."""
        r = test_client.get("/api/positions/")
        assert r.status_code == 200
        positions = r.json()
        assert len(positions) == 1


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