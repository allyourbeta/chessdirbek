"""Tests for scripts/migrate_castling.py (SPEC-CASTLING.md Part 5) against a
temp SQLite file, run as a subprocess so CHESSDIRBEK_DB_URL is honoured fresh
(backend.database binds its engine at import time, so an in-process import
can't be re-pointed once another test module has already imported it).
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
START_BOARD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
NO_ROOKS_BOARD = "1nbqkbn1/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBN1"


def _make_test_db(db_path):
    from sqlalchemy import create_engine
    from backend.database import Base
    import backend.models  # noqa: F401 (registers models on Base.metadata)

    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    return engine


def _seed(engine, rows):
    from sqlalchemy.orm import sessionmaker
    from backend.models import Position

    Session = sessionmaker(bind=engine)
    session = Session()
    for fen, title in rows:
        session.add(Position(fen=fen, title=title, position_type="tabiya"))
    session.commit()
    session.close()


def _run_script(db_path, *extra_args):
    env = os.environ.copy()
    env["CHESSDIRBEK_DB_URL"] = f"sqlite:///{db_path}"
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "migrate_castling.py"), *extra_args],
        cwd=str(ROOT), env=env, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    return result.stdout


def test_dry_run_apply_then_idempotent(tmp_path):
    db_path = tmp_path / "test.db"
    engine = _make_test_db(db_path)
    _seed(engine, [
        (START_BOARD + " w - - 0 1", "missing rights"),       # gains KQkq
        (START_BOARD + " w KQkq - 0 1", "already full"),      # unchanged
        (NO_ROOKS_BOARD + " w KQkq - 0 1", "no rooks"),        # KQkq trimmed to -
    ])

    out = _run_script(db_path, "--dry-run")
    assert "Would change 2 row(s)." in out, out

    out = _run_script(db_path)
    assert "Changing 2 row(s)." in out, out

    out = _run_script(db_path, "--dry-run")
    assert "Would change 0 row(s)." in out, out


def test_apply_actually_writes_the_rows(tmp_path):
    db_path = tmp_path / "test2.db"
    engine = _make_test_db(db_path)
    _seed(engine, [(START_BOARD, "board only")])

    _run_script(db_path)

    from sqlalchemy.orm import sessionmaker
    from backend.models import Position

    Session = sessionmaker(bind=engine)
    session = Session()
    position = session.query(Position).filter(Position.title == "board only").first()
    assert position.fen == START_BOARD + " w KQkq - 0 1"
    session.close()
