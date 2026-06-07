"""Tests for the FEN-keyed annotation 'question' prompt field.

The question is the (always-visible) counterpart to note_text (the blurred
answer). Both live in the same fen_annotations row, keyed by normalized FEN.

This module uses a self-contained StaticPool engine rather than the shared
conftest `test_client` fixture: an in-memory SQLite DB needs StaticPool so
every pooled connection sees the same database (otherwise follow-up requests
hit an empty DB). Keeping the fixture local avoids changing shared test infra.
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["CHESSDIRBEK_DB_URL"] = "sqlite:///:memory:"

from backend.main import app
from backend.database import Base, get_db

FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
    engine.dispose()


def _get(client):
    return client.get("/api/annotations/", params={"fen": FEN}).json()


def _put(client, note="", question=""):
    return client.put(
        "/api/annotations/",
        json={"fen": FEN, "note_text": note, "question_text": question},
    ).json()


class TestAnnotationQuestion:
    def test_empty_when_unset(self, client):
        r = _get(client)
        assert r["exists"] is False
        assert r["note_text"] == ""
        assert r["question_text"] == ""

    def test_question_only_persists(self, client):
        """A question with no note should still create/keep the row."""
        r = _put(client, question="What is Black's best plan?")
        assert r["saved"] is True
        assert r["question_text"] == "What is Black's best plan?"
        assert r["note_text"] == ""

        g = _get(client)
        assert g["exists"] is True
        assert g["question_text"] == "What is Black's best plan?"

    def test_question_and_note_roundtrip(self, client):
        _put(client, note="...c5 strikes the centre", question="Best plan?")
        g = _get(client)
        assert g["note_text"] == "...c5 strikes the centre"
        assert g["question_text"] == "Best plan?"

    def test_clearing_question_keeps_note(self, client):
        _put(client, note="keep me", question="drop me")
        r = _put(client, note="keep me", question="")
        assert r["note_text"] == "keep me"
        assert r["question_text"] == ""
        assert _get(client)["exists"] is True

    def test_clearing_both_deletes_row(self, client):
        _put(client, note="n", question="q")
        _put(client, note="", question="")
        assert _get(client)["exists"] is False

    def test_legacy_payload_without_question(self, client):
        """Old clients sending only note_text must still work."""
        r = client.put(
            "/api/annotations/", json={"fen": FEN, "note_text": "legacy"}
        ).json()
        assert r["note_text"] == "legacy"
        assert r["question_text"] == ""

    def test_whitespace_question_is_treated_as_empty(self, client):
        r = _put(client, note="", question="   ")
        assert r["question_text"] == ""
        assert _get(client)["exists"] is False
