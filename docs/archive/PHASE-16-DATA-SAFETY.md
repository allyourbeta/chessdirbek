# Phase 16: Data Safety

Protections for ChessQuiz's production database against accidental loss, corruption, and test pollution. This is reactive work — driven by real incidents (Phase 15 test pollution, repeated test-DB-bleeding-into-production bugs) — but also proactive protection against the inevitable future mistake.

**Guiding principle:** Data loss should require multiple independent failures. No single bug, command, or migration should be able to destroy user data.

---

## Why This Phase Exists

Real incidents that motivated this phase:
- **Phase 4 incident**: A readonly-database error caused by tests deleting and recreating the production DB while the server was connected
- **Phase 10 incident**: "Fixed" test database isolation that regressed
- **Phase 15 incident**: Test fixtures ("Rook Endgame Win", "Italian Game Mainline", "Test Position 1") written to production database; case inconsistency in position_type column; UI showing empty lists because real positions were mixed with fake ones

Pattern: the test-vs-production boundary keeps breaking, and migrations are done without backup safety nets. This phase closes those gaps permanently.

---

## 16A: Automated Backups

Nightly backup via scheduled job, plus on-demand backups triggered manually.

### Backup script

Create `scripts/backup_database.sh`:

```bash
#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$HOME/Droppbox/programming/projects/chessquiz"
DB_FILE="$PROJECT_ROOT/chessquiz.db"
BACKUP_DIR="$PROJECT_ROOT/backups"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/chessquiz-$TIMESTAMP.db"

# Use Python + SQLite's native backup API (safer than cp for live databases)
python3 -c "
import sqlite3
src = sqlite3.connect('$DB_FILE')
dst = sqlite3.connect('$BACKUP_FILE')
src.backup(dst)
src.close()
dst.close()
"

# Prune old backups beyond retention window
find "$BACKUP_DIR" -name "chessquiz-*.db" -mtime +$RETENTION_DAYS -delete

echo "Backup created: $BACKUP_FILE"
echo "Retained backups:"
ls -lht "$BACKUP_DIR"/chessquiz-*.db | head -5
```

Requirements:
- Uses SQLite's native `.backup()` API, not `cp` — ensures consistency even if server is live
- Keeps 30 days of daily backups
- Script exits nonzero on failure (important for cron/launchd to surface errors)
- Prints summary of what was backed up

### Automated scheduling

Create a launchd plist for macOS at `~/Library/LaunchAgents/com.ashish.chessquiz-backup.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ashish.chessquiz-backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/ashish/Droppbox/programming/projects/chessquiz/scripts/backup_database.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>3</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/ashish/Droppbox/programming/projects/chessquiz/backups/backup.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/ashish/Droppbox/programming/projects/chessquiz/backups/backup.error.log</string>
</dict>
</plist>
```

Load with `launchctl load ~/Library/LaunchAgents/com.ashish.chessquiz-backup.plist`.

### Manual backup via CLI

Create `scripts/backup_now.sh` as a thin wrapper that calls the same logic with a "MANUAL" tag in the filename for later identification:

```bash
#!/bin/bash
# Same as backup_database.sh but with MANUAL prefix
# For use before risky operations (migrations, bulk imports, etc.)
```

### Restore script

Create `scripts/restore_database.sh`:

```bash
#!/bin/bash
# Usage: ./scripts/restore_database.sh <backup-filename>
# Interactively confirms before overwriting chessquiz.db
```

### Acceptance criteria

- [ ] `scripts/backup_database.sh` exists and uses SQLite's backup API
- [ ] `scripts/backup_now.sh` exists for manual pre-risk backups
- [ ] `scripts/restore_database.sh` exists and asks confirmation
- [ ] launchd plist exists and backup runs nightly
- [ ] 30-day retention works (old backups pruned)
- [ ] Backup log accumulates in backups/backup.log
- [ ] README.md or CLAUDE.md documents these scripts so Claude Code is aware

---

## 16B: Test Database Isolation (Permanent Enforcement)

The test-vs-production bleed has regressed multiple times. This section adds defense-in-depth to prevent it from happening again.

### Shared test database fixture

Create `backend/testing/test_db.py` with a single source of truth:

```python
"""Test database fixtures. All test files MUST import from here.

Running tests against the production database is blocked at the import level.
"""
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
PRODUCTION_DB_PATH = PROJECT_ROOT / "chessquiz.db"
TEST_DB_PATH = PROJECT_ROOT / "test_chessquiz.db"

def get_test_db_url():
    """Returns the SQLAlchemy URL for the test database.

    Raises RuntimeError if called in a context that would touch production DB.
    """
    # Safety assertion: we're not pointing at production
    url = f"sqlite:///{TEST_DB_PATH}"
    if str(PRODUCTION_DB_PATH) in url:
        raise RuntimeError("Refusing to use production database for tests")
    return url

def create_test_db():
    """Create a fresh test database. Deletes any existing test_chessquiz.db."""
    # Belt-and-suspenders: refuse to operate if path equals production
    if TEST_DB_PATH == PRODUCTION_DB_PATH:
        raise RuntimeError("Test DB path must differ from production DB path")
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    # Create schema...
```

### Enforce in every test file

Every test file's top imports should assert isolation:

```python
# At the top of every test_*.py file:
from backend.testing.test_db import TEST_DB_PATH, PRODUCTION_DB_PATH

# Fail-fast assertions
assert TEST_DB_PATH != PRODUCTION_DB_PATH, "Test DB must not equal production DB"
assert not str(PRODUCTION_DB_PATH) in os.environ.get("DATABASE_URL", ""), \
    "Tests must not run against production DATABASE_URL"
```

### Environment variable guard

Add to `backend/database.py` (production DB setup):

```python
def get_db_url():
    url = os.environ.get("DATABASE_URL", DEFAULT_PRODUCTION_URL)

    # If we're inside pytest or a test runner, refuse to use production URL
    if "PYTEST_CURRENT_TEST" in os.environ and "chessquiz.db" in url and "test_" not in url:
        raise RuntimeError(
            "Detected test context but DATABASE_URL points at production. "
            "Use the test fixture from backend.testing.test_db instead."
        )

    return url
```

### Acceptance criteria

- [ ] All test files import from `backend/testing/test_db.py`
- [ ] Running any test with DATABASE_URL pointing at production raises an error immediately
- [ ] Assertion at top of each test file catches accidental production DB usage
- [ ] `test_chessquiz.db` is in `.gitignore` (like `chessquiz.db` should already be)
- [ ] A CI-style smoke test: run `PYTEST_CURRENT_TEST=dummy python test.py` with production URL and verify it fails fast

### Regression test

Add `test_db_isolation.py` that verifies the isolation mechanism itself:

- Test that attempting to use production URL during test raises error
- Test that TEST_DB_PATH differs from PRODUCTION_DB_PATH
- Test that test DB file is created in the right location
- Test that running tests doesn't affect production DB mtime

This is a meta-test. It's the "belt" that catches regressions where someone removes the "suspenders" (assertions in individual test files).

---

## 16C: Migration Safety

All schema changes should go through a proper migration framework that supports rollback and preserves data.

### Introduce alembic

Alembic is SQLAlchemy's official migration tool. It generates migration scripts from model changes, supports up/down migrations, and tracks version history.

Steps:
1. `pip install alembic` — add to requirements.txt
2. `alembic init migrations` — creates migrations directory
3. Configure `alembic.ini` to point at the production DB URL (with env var override for tests)
4. Generate initial migration that represents the current schema: `alembic revision --autogenerate -m "initial schema"`
5. Stamp the current DB as being at the initial version: `alembic stamp head`
6. For all future schema changes, run `alembic revision --autogenerate -m "description"` then review the generated migration before applying with `alembic upgrade head`

### Pre-migration backup

Add to the Alembic env.py (or as a wrapper script):

```python
def run_migrations_online():
    # BEFORE any migration runs, create a backup
    subprocess.run(["./scripts/backup_now.sh"], check=True)
    # Then proceed with migration
    ...
```

This guarantees a known-good state before any schema change.

### No raw DDL in application code

Going forward:
- Models can define schema via SQLAlchemy ORM (as today)
- Actual migrations happen via alembic, not via `Base.metadata.create_all()` in production code
- Claude Code should be instructed to use alembic for schema changes, not edit the DB directly

### Acceptance criteria

- [ ] Alembic initialized with migrations directory
- [ ] Initial migration captures current schema
- [ ] Database stamped at initial version
- [ ] `scripts/backup_now.sh` runs automatically before migrations
- [ ] CLAUDE.md documents "use alembic for schema changes, never edit DB directly"
- [ ] At least one test-migration example: create a dummy field, migrate up, migrate down, verify data preserved

### Backward retrofit

The existing schema wasn't built with alembic. Generate an initial migration that represents the current state. All future changes use alembic from there.

---

## 16D: Operational Runbook

A markdown file `OPERATIONS.md` in the project root documenting:

- How to back up the database (manual + automatic)
- How to restore from backup
- How to run migrations safely (always backup first)
- How to detect test pollution in the production DB
- What to do if the production DB gets corrupted
- The location and retention policy of backups
- Who to blame if things break (you; it's always you)

This is documentation, not code. But it's essential — next time something breaks at 2am you shouldn't have to reconstruct the recovery steps from scratch.

### Acceptance criteria

- [ ] `OPERATIONS.md` exists with all sections above
- [ ] References the scripts from Section 16A
- [ ] Includes a test-pollution detection query (the SQL that surfaced the Phase 15 contamination)
- [ ] Links to any relevant SQLAlchemy / Alembic / SQLite documentation

---

## 16E: Automatic Pre-Operation Backup Hook

For operations that are known to be risky, backup automatically before running.

### Hook into risky flows

Add pre-operation backup calls to:
- PGN bulk import (even with atomic transactions, a safety net is cheap)
- Position delete operations that affect 10+ records
- Any explicit "reset" or "bulk" operation in the app
- Any alembic migration (already specified in 16C)

Implementation: each risky flow calls `subprocess.run(["./scripts/backup_now.sh"])` before starting, tagged with the operation name.

### Don't overdo it

Don't back up on every user action — that's wasteful and noisy. Backups before:
- Multi-record deletions
- Schema migrations
- Bulk data imports
- Database resets or clears

Not backups before:
- Single record create/update/delete
- User-initiated verdict edits
- Playing practice games
- Normal read operations

### Acceptance criteria

- [ ] Bulk operations backup before running
- [ ] Backup failures block the risky operation (fail-fast, don't proceed without safety net)
- [ ] Tagged backups clearly labeled by operation: `chessquiz-20260423-143022-preimport.db`

---

## Execution Order

This phase has natural order:

1. **16A first** — get backups running nightly. This alone protects against most future disasters.
2. **16B second** — permanent test isolation. Closes the most common regression source.
3. **16D third** — write the runbook while context is fresh.
4. **16C fourth** — alembic is a bigger change; do it once the safety nets are in place.
5. **16E last** — hook backups into risky operations after the script infrastructure exists.

Can be done as a single Claude Code session or split across five sub-prompts. I'd suggest splitting — each part is testable on its own.

---

## Testing

Each sub-section has its own acceptance criteria. Additionally, an integration test:

**Simulated disaster recovery test:**
- [ ] Record state: number of positions, number of practice games
- [ ] Create a fresh backup
- [ ] Run a destructive operation (drop a table or delete all positions)
- [ ] Verify production DB is now in a known-bad state
- [ ] Run restore from backup
- [ ] Verify production DB matches original state (counts match)
- [ ] Delete the test backup

If this works end-to-end, the data safety story is complete.

---

## Out of Scope

- Off-machine backups (Backblaze B2, iCloud, etc.) — separate concern, can be done manually via Time Machine or similar
- Point-in-time recovery (continuous WAL archival) — overkill for personal app
- Database encryption at rest — not needed for non-sensitive data
- Multi-user conflict resolution — single-user app
- Schema version negotiation between frontend and backend — premature optimization

---

## Related Documents

- `SPEC-v2.md` — main build spec
- `CLAUDE.md` — instructions for Claude Code; should reference backup scripts
- `OPERATIONS.md` — operational runbook (created by 16D)
