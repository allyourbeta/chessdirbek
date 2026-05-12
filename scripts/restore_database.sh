#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$HOME/Droppbox/programming/projects/chessquiz"
DB_FILE="$PROJECT_ROOT/chessdirbek.db"
BACKUP_DIR="$PROJECT_ROOT/backups"

if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup-filename>"
    echo ""
    echo "Available backups:"
    ls -lht "$BACKUP_DIR"/chessdirbek-*.db 2>/dev/null | head -20 || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# If just filename given, assume it's in the backups directory
if [[ ! "$BACKUP_FILE" = /* ]]; then
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Show current database info
if [ -f "$DB_FILE" ]; then
    CURRENT_SIZE=$(ls -lh "$DB_FILE" | awk '{print $5}')
    CURRENT_MTIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$DB_FILE" 2>/dev/null || stat -c "%y" "$DB_FILE" 2>/dev/null | cut -d. -f1)
    echo "Current database:"
    echo "  Path: $DB_FILE"
    echo "  Size: $CURRENT_SIZE"
    echo "  Modified: $CURRENT_MTIME"
else
    echo "Current database not found at $DB_FILE"
fi

# Show backup info
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
BACKUP_MTIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$BACKUP_FILE" 2>/dev/null || stat -c "%y" "$BACKUP_FILE" 2>/dev/null | cut -d. -f1)
echo ""
echo "Backup to restore:"
echo "  Path: $BACKUP_FILE"
echo "  Size: $BACKUP_SIZE"
echo "  Modified: $BACKUP_MTIME"

# Confirm before overwriting
echo ""
echo "WARNING: This will OVERWRITE the current database with the backup!"
echo "Are you sure you want to restore from this backup?"
read -p "Type 'yes' to confirm: " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Create a safety backup of current DB before overwriting
if [ -f "$DB_FILE" ]; then
    SAFETY_BACKUP="$BACKUP_DIR/chessdirbek-BEFORE-RESTORE-$(date +%Y%m%d-%H%M%S).db"
    echo ""
    echo "Creating safety backup of current database..."
    python3 -c "
import sqlite3
src = sqlite3.connect('$DB_FILE')
dst = sqlite3.connect('$SAFETY_BACKUP')
src.backup(dst)
src.close()
dst.close()
"
    echo "Safety backup created: $SAFETY_BACKUP"
fi

# Perform the restore
echo ""
echo "Restoring from backup..."
cp "$BACKUP_FILE" "$DB_FILE"

echo "Database restored successfully from: $BACKUP_FILE"