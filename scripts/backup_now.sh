#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$HOME/Droppbox/programming/projects/chessquiz"
DB_FILE="$PROJECT_ROOT/chessdirbek.db"
BACKUP_DIR="$PROJECT_ROOT/backups"

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

echo "Manual backup created: $BACKUP_FILE"
echo "Recent backups:"
ls -lht "$BACKUP_DIR"/chessdirbek-*.db 2>/dev/null | head -5 || echo "  No backups found"