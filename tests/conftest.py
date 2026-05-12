"""Shared test fixtures for ChessQuiz."""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set test database URL before any imports
os.environ["CHESSQUIZ_DB_URL"] = "sqlite:///:memory:"

from backend.main import app
from backend.database import get_db, Base


@pytest.fixture(scope="function")
def test_client():
    """Create test client with fresh in-memory database for each test."""
    # Create a new in-memory database for this test
    test_engine = create_engine(
        "sqlite:///:memory:", 
        echo=False,
        connect_args={"check_same_thread": False}
    )
    
    # Create all tables
    Base.metadata.create_all(bind=test_engine)
    
    # Create session factory
    TestSessionLocal = sessionmaker(
        autocommit=False, 
        autoflush=False, 
        bind=test_engine
    )
    
    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    # Override the dependency
    app.dependency_overrides[get_db] = override_get_db
    
    # Create and yield the test client
    client = TestClient(app)
    yield client
    
    # Clean up
    app.dependency_overrides.clear()
    test_engine.dispose()