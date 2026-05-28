"""Tests for engine_games API endpoints."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app
from backend.models.models import Position, PositionType


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db():
    """Create a fresh test database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    """Create test client with test database."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def test_position(db):
    """Create a test position for engine games."""
    position = Position(
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        position_type=PositionType.tabiya,
        title="Test Position"
    )
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


def test_create_engine_game(client, test_position):
    """Test creating a valid engine game."""
    payload = {
        "position_id": test_position.id,
        "start_fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "moves_san": "e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7",
        "user_color": "white",
        "engine_elo": 1600,
        "result": "1-0",
        "outcome": "checkmate",
        "final_fen": "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
        "move_count": 7
    }
    
    response = client.post("/api/engine-games", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["moves_san"] == payload["moves_san"]
    assert data["result"] == "1-0"
    assert data["move_count"] == 7


def test_list_position_engine_games(client, test_position):
    """Test listing engine games for a position, newest first."""
    # Create two games
    for i in range(2):
        payload = {
            "position_id": test_position.id,
            "start_fen": test_position.fen,
            "moves_san": f"e4 e5" if i == 0 else "d4 d5",
            "user_color": "white" if i == 0 else "black",
            "engine_elo": 1600 + i * 100,
            "result": "1-0" if i == 0 else "0-1",
            "outcome": "resigned",
            "final_fen": test_position.fen,
            "move_count": 2
        }
        client.post("/api/engine-games", json=payload)
    
    response = client.get(f"/api/positions/{test_position.id}/engine-games")
    assert response.status_code == 200
    games = response.json()
    assert len(games) == 2
    # Newest first
    assert games[0]["engine_elo"] == 1700
    assert games[1]["engine_elo"] == 1600
    # Brief format should not include moves_san
    assert "moves_san" not in games[0]


def test_get_engine_game(client, test_position):
    """Test fetching a single engine game."""
    # Create a game
    payload = {
        "position_id": test_position.id,
        "start_fen": test_position.fen,
        "moves_san": "e4 e5 Nf3",
        "user_color": "white",
        "engine_elo": 2000,
        "result": "1/2-1/2",
        "outcome": "stalemate",
        "final_fen": test_position.fen,
        "move_count": 3
    }
    
    create_response = client.post("/api/engine-games", json=payload)
    game_id = create_response.json()["id"]
    
    response = client.get(f"/api/engine-games/{game_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["moves_san"] == "e4 e5 Nf3"
    assert data["outcome"] == "stalemate"


def test_delete_engine_game(client, test_position):
    """Test deleting an engine game."""
    # Create a game
    payload = {
        "position_id": test_position.id,
        "start_fen": test_position.fen,
        "moves_san": "e4",
        "user_color": "white",
        "engine_elo": 1320,
        "result": "*",
        "outcome": "abandoned",
        "final_fen": test_position.fen,
        "move_count": 1
    }
    
    create_response = client.post("/api/engine-games", json=payload)
    game_id = create_response.json()["id"]
    
    # Delete it
    delete_response = client.delete(f"/api/engine-games/{game_id}")
    assert delete_response.status_code == 204
    
    # Verify it's gone
    get_response = client.get(f"/api/engine-games/{game_id}")
    assert get_response.status_code == 404


def test_reject_empty_game(client, test_position):
    """Test that empty games are rejected."""
    payload = {
        "position_id": test_position.id,
        "start_fen": test_position.fen,
        "moves_san": "",  # Empty
        "user_color": "white",
        "engine_elo": 1600,
        "result": "*",
        "outcome": "abandoned",
        "final_fen": test_position.fen,
        "move_count": 0  # Zero moves
    }
    
    response = client.post("/api/engine-games", json=payload)
    assert response.status_code == 422


def test_reject_invalid_enums(client, test_position):
    """Test validation of enum fields."""
    # Bad color
    payload = {
        "position_id": test_position.id,
        "start_fen": test_position.fen,
        "moves_san": "e4",
        "user_color": "green",  # Invalid
        "engine_elo": 1600,
        "result": "1-0",
        "outcome": "checkmate",
        "final_fen": test_position.fen,
        "move_count": 1
    }
    
    response = client.post("/api/engine-games", json=payload)
    assert response.status_code == 422
    
    # Bad Elo (too low)
    payload["user_color"] = "white"
    payload["engine_elo"] = 100
    response = client.post("/api/engine-games", json=payload)
    assert response.status_code == 422
    
    # Bad result
    payload["engine_elo"] = 1600
    payload["result"] = "win"
    response = client.post("/api/engine-games", json=payload)
    assert response.status_code == 422


def test_404_nonexistent_position(client):
    """Test creating game with nonexistent position."""
    payload = {
        "position_id": 99999,
        "start_fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "moves_san": "e4",
        "user_color": "white",
        "engine_elo": 1600,
        "result": "*",
        "outcome": None,
        "final_fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        "move_count": 1
    }
    
    response = client.post("/api/engine-games", json=payload)
    assert response.status_code == 404


def test_404_get_missing_game(client):
    """Test fetching non-existent game."""
    response = client.get("/api/engine-games/99999")
    assert response.status_code == 404


def test_404_delete_missing_game(client):
    """Test deleting non-existent game."""
    response = client.delete("/api/engine-games/99999")
    assert response.status_code == 404


def test_fresh_db_migration(client):
    """Test that engine_games table exists on fresh DB."""
    # This tests that the model is registered and table created
    response = client.get("/api/positions/1/engine-games")
    # Should return empty list, not 500 error
    assert response.status_code == 200
    assert response.json() == []