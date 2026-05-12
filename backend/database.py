"""Database engine and session setup. SQLite via SQLAlchemy."""

import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

DATABASE_URL = os.environ.get("CHESSDIRBEK_DB_URL", "sqlite:///./chessdirbek.db")
# Note: if migrating from ChessQuiz, rename chessquiz.db to chessdirbek.db

_connect_args = {"check_same_thread": False}
_extra = {}
if DATABASE_URL == "sqlite:///:memory:":
    _extra["poolclass"] = StaticPool

engine = create_engine(DATABASE_URL, connect_args=_connect_args, **_extra)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def run_lightweight_migrations():
    """Apply additive column migrations for SQLite. Safe to run at startup."""
    from backend.models.annotation_models import FenAnnotation

    insp = inspect(engine)
    
    # Check if tables exist before trying to migrate
    table_names = insp.get_table_names()

    if "fen_annotations" not in table_names:
        FenAnnotation.__table__.create(engine)
    
    # Migrate games table
    if "games" in table_names:
        cols = {c["name"] for c in insp.get_columns("games")}
        with engine.begin() as conn:
            if "white_elo" not in cols:
                conn.execute(text("ALTER TABLE games ADD COLUMN white_elo INTEGER"))
            if "black_elo" not in cols:
                conn.execute(text("ALTER TABLE games ADD COLUMN black_elo INTEGER"))
    
    # Migrate positions table for Phase 15
    if "positions" in table_names:
        cols = {c["name"] for c in insp.get_columns("positions")}
        with engine.begin() as conn:
            if "position_type" not in cols:
                # Default all existing positions to 'tabiya'
                conn.execute(text("ALTER TABLE positions ADD COLUMN position_type VARCHAR DEFAULT 'tabiya' NOT NULL"))
            if "solution_san" not in cols:
                conn.execute(text("ALTER TABLE positions ADD COLUMN solution_san VARCHAR"))
            if "theme" not in cols:
                conn.execute(text("ALTER TABLE positions ADD COLUMN theme VARCHAR"))
            if "orientation" not in cols:
                # Add column with default 'white', then backfill existing rows
                # to match side-to-move encoded in FEN (field 2 of the FEN string).
                conn.execute(text(
                    "ALTER TABLE positions ADD COLUMN orientation VARCHAR "
                    "NOT NULL DEFAULT 'white'"
                ))
                # Backfill: when FEN's side-to-move is 'b', orient board for Black.
                # FEN format: "<placement> <side> <castling> <ep> <halfmove> <fullmove>"
                # We use SUBSTR/INSTR to find the char immediately after the first space.
                conn.execute(text(
                    "UPDATE positions SET orientation = 'black' "
                    "WHERE SUBSTR(fen, INSTR(fen, ' ') + 1, 1) = 'b'"
                ))


def get_db():
    """FastAPI dependency that yields a DB session and closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
