#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$HOME/Droppbox/programming/projects/chessquiz"
DB_FILE="$PROJECT_ROOT/chessdirbek.db"
BACKUP_DIR="$PROJECT_ROOT/backups"
RETENTION_COUNT=10   # keep the newest N backups (daily + manual share this budget)

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/chessdirbek-MANUAL-$TIMESTAMP.db"

# Use Python + SQLite's native backup API (safer than cp for live databases)
python3 -c "
import sqlite3
src = sqlite3.connect('$DB_FILE')
dst = sqlite3.connect('$BACKUP_FILE')
src.backup(dst)
src.close()
dst.close()
"

# --- Retention: keep only the newest $RETENTION_COUNT backups ---
# Same trim as the nightly job, so manual bursts can't accumulate forever.
# Never deletes the BEFORE-RESTORE safety copies created by restore_database.sh.
{
  ls -t "$BACKUP_DIR"/*.db 2>/dev/null \
    | grep -v -- '-BEFORE-RESTORE-' \
    | tail -n +$((RETENTION_COUNT + 1)) \
    | while IFS= read -r old; do rm -f -- "$old"; done
} || true

echo "Manual backup created: $BACKUP_FILE"
echo "Recent backups:"
ls -lht "$BACKUP_DIR"/*.db 2>/dev/null | head -5 || echo "  No backups found"
