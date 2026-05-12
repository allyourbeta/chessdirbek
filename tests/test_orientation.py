"""Integration tests for the per-position orientation feature.

Covers:
  - POST creates with orientation='white' by default
  - POST accepts and persists orientation='black'
  - PUT updates orientation
  - GET returns orientation in PositionOut and PositionBrief
  - Migration backfills existing rows based on FEN side-to-move
  - Schema validator rejects garbage orientation values
"""

import os
import sys
import tempfile

# Use a fresh on-disk SQLite file so we can simulate "existing rows" before
# the migration adds the column.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
DB_PATH = _tmp.name
os.environ["CHESSDIRBEK_DB_URL"] = f"sqlite:///{DB_PATH}"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _seed_legacy_rows_without_orientation_column():
    """Create a legacy positions table (no orientation column) and insert
    fixture rows. Then we let main.py run the migration on import."""
    from sqlalchemy import create_engine, text
    eng = create_engine(f"sqlite:///{DB_PATH}")
    with eng.begin() as conn:
        conn.execute(text("""
            CREATE TABLE positions (
                id INTEGER PRIMARY KEY,
                fen VARCHAR NOT NULL,
                title VARCHAR,
                notes TEXT,
                stockfish_analysis TEXT,
                position_type VARCHAR DEFAULT 'tabiya' NOT NULL,
                solution_san VARCHAR,
                theme VARCHAR,
                created_at DATETIME,
                updated_at DATETIME
            )
        """))
        # White-to-move row
        conn.execute(text("""
            INSERT INTO positions (fen, title, position_type)
            VALUES ('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                    'Legacy white', 'tabiya')
        """))
        # Black-to-move row
        conn.execute(text("""
            INSERT INTO positions (fen, title, position_type)
            VALUES ('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
                    'Legacy black', 'tabiya')
        """))
    eng.dispose()


def main():
    _seed_legacy_rows_without_orientation_column()

    # Now import the app, which runs the migration on the seeded DB.
    from backend.main import app
    from backend.database import engine
    from sqlalchemy import text
    from fastapi.testclient import TestClient

    # 1) Migration backfill check: white-to-move legacy row -> 'white',
    #    black-to-move legacy row -> 'black'.
    with engine.begin() as conn:
        rows = conn.execute(text(
            "SELECT title, orientation FROM positions ORDER BY id"
        )).all()
    print("Legacy rows after migration:", rows)
    assert ("Legacy white", "white") in rows, f"backfill failed: {rows}"
    assert ("Legacy black", "black") in rows, f"backfill failed: {rows}"
    print("PASS  migration backfill")

    client = TestClient(app)

    # 2) POST without orientation -> defaults to 'white'.
    r = client.post("/api/positions/", json={
        "fen": "8/8/8/8/8/8/8/4K2k w - - 0 1",
        "title": "no-orientation-given",
        "position_type": "tabiya",
    })
    assert r.status_code == 201, r.text
    new_id_white = r.json()["id"]
    assert r.json()["orientation"] == "white"
    print("PASS  POST defaults orientation to 'white'")

    # 3) POST with orientation='black' -> persisted.
    r = client.post("/api/positions/", json={
        "fen": "8/8/8/8/8/8/8/3K3k b - - 0 1",
        "title": "explicit-black",
        "position_type": "puzzle",
        "orientation": "black",
    })
    assert r.status_code == 201, r.text
    new_id_black = r.json()["id"]
    assert r.json()["orientation"] == "black"
    print("PASS  POST persists orientation='black'")

    # 4) GET returns orientation.
    r = client.get(f"/api/positions/{new_id_black}")
    assert r.status_code == 200
    assert r.json()["orientation"] == "black"
    print("PASS  GET single position returns orientation")

    # 5) List endpoint (PositionBrief) includes orientation.
    r = client.get("/api/positions/")
    assert r.status_code == 200
    titles_to_orient = {p["title"]: p["orientation"] for p in r.json()}
    assert titles_to_orient.get("explicit-black") == "black"
    assert titles_to_orient.get("no-orientation-given") == "white"
    assert titles_to_orient.get("Legacy black") == "black"
    print("PASS  list endpoint includes orientation")

    # 6) PUT updates orientation.
    r = client.put(f"/api/positions/{new_id_white}", json={"orientation": "black"})
    assert r.status_code == 200, r.text
    assert r.json()["orientation"] == "black"
    print("PASS  PUT updates orientation")

    # 7) Schema validator rejects garbage values.
    r = client.post("/api/positions/", json={
        "fen": "8/8/8/8/8/8/8/2K4k w - - 0 1",
        "title": "bad",
        "orientation": "sideways",
    })
    assert r.status_code == 422, r.text
    print("PASS  invalid orientation rejected (422)")

    print("\nAll orientation tests passed.")


if __name__ == "__main__":
    try:
        main()
    finally:
        try:
            os.unlink(DB_PATH)
        except OSError:
            pass
