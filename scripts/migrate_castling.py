#!/usr/bin/env python3
"""One-time migration (SPEC-CASTLING.md Part 5): give every stored position
the castling rights its pieces support. A FEN with no castling field (or
'-') gets every right its placement allows; a FEN that already states rights
keeps only the ones its placement supports.

Idempotent: a second run changes zero rows. Uses backend.database so
CHESSDIRBEK_DB_URL is honoured.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.database import SessionLocal
from backend.models import Position
from backend.services import supported_castling


def _migrated_fen(fen: str) -> str:
    """The one-time backfill rule: a castling field that is missing OR '-'
    (every existing position, before this feature) gets every right its
    placement supports; a FEN that already states specific rights (written
    by this feature going forward) keeps only the ones still supported.

    Deliberately not chess_service.normalize_castling: that function treats
    a stated '-' as "no rights wanted" and leaves it alone (needed so the
    detail-page toggle's unticked state sticks); this one-time pass instead
    needs to treat every pre-existing '-' as "never considered" and upgrade it.
    """
    parts = fen.strip().split()
    board = parts[0] if parts else ""
    side = parts[1] if len(parts) > 1 and parts[1] in ("w", "b") else "w"
    requested = parts[2] if len(parts) > 2 else None
    allowed = supported_castling(board)
    if requested is None or requested == "-":
        castling = allowed
    else:
        castling = "".join(c for c in requested if c in allowed) or "-"
    ep = parts[3] if len(parts) > 3 else "-"
    halfmove = parts[4] if len(parts) > 4 and parts[4].isdigit() else "0"
    fullmove = parts[5] if len(parts) > 5 and parts[5].isdigit() else "1"
    return " ".join([board, side, castling, ep, halfmove, fullmove])


def _planned_updates(session):
    """Return [(position, old_fen, new_fen)] for every row whose FEN changes."""
    updates = []
    for position in session.query(Position).all():
        new_fen = _migrated_fen(position.fen)
        if new_fen != position.fen:
            updates.append((position, position.fen, new_fen))
    return updates


def run(dry_run: bool) -> int:
    session = SessionLocal()
    try:
        updates = _planned_updates(session)
        verb = "Would change" if dry_run else "Changing"
        print(f"{verb} {len(updates)} row(s).")
        for position, old_fen, new_fen in updates[:5]:
            print(f"  id={position.id}: {old_fen!r} -> {new_fen!r}")
        if not dry_run:
            for position, _old_fen, new_fen in updates:
                position.fen = new_fen
            session.commit()
        return len(updates)
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Report how many rows would change, without writing them",
    )
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
