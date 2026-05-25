#!/usr/bin/env python3
"""Migrate position-level notes to FEN-based annotations."""

import sys
import os
from datetime import datetime, timezone

# Add parent directory to path to import backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.models import Position, FenAnnotation
from backend.database import Base


def normalize_fen_key(full_fen: str) -> str:
    """Normalize FEN to match annotations.py logic exactly."""
    parts = full_fen.strip().split()
    board = parts[0]
    side = parts[1] if len(parts) > 1 else 'w'
    return f"{board} {side}"


def main():
    print("=" * 60)
    print("Migrate Position Notes to FEN Annotations")
    print("=" * 60)
    
    # Connect to database
    engine = create_engine('sqlite:///chessdirbek.db')
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Query all positions with non-empty notes
        positions_with_notes = session.query(Position).filter(
            Position.notes.isnot(None),
            Position.notes != ''
        ).all()
        
        print(f"\nFound {len(positions_with_notes)} positions with notes to migrate")
        
        migrated_count = 0
        skipped_count = 0
        appended_count = 0
        error_count = 0
        
        for position in positions_with_notes:
            try:
                # Normalize the FEN key
                fen_key = normalize_fen_key(position.fen)
                
                # Check if annotation already exists
                existing_annotation = session.query(FenAnnotation).filter(
                    FenAnnotation.fen_key == fen_key
                ).first()
                
                if existing_annotation:
                    # Check if position notes are already contained in the annotation
                    if position.notes in existing_annotation.note_text:
                        print(f"  Skipping position {position.id}: notes already in annotation")
                        skipped_count += 1
                    elif existing_annotation.note_text.strip():
                        # Annotation exists with non-empty text - append
                        separator = "\n\n---\n(migrated from position notes)\n"
                        existing_annotation.note_text = existing_annotation.note_text + separator + position.notes
                        existing_annotation.updated_at = datetime.now(timezone.utc)
                        print(f"  Appended notes from position {position.id} to existing annotation")
                        appended_count += 1
                    else:
                        # Annotation exists but is empty - replace
                        existing_annotation.note_text = position.notes
                        existing_annotation.updated_at = datetime.now(timezone.utc)
                        print(f"  Replaced empty annotation with notes from position {position.id}")
                        migrated_count += 1
                else:
                    # No existing annotation - create new one
                    new_annotation = FenAnnotation(
                        fen_key=fen_key,
                        note_text=position.notes,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc)
                    )
                    session.add(new_annotation)
                    print(f"  Created new annotation from position {position.id}")
                    migrated_count += 1
                    
            except Exception as e:
                print(f"  ERROR processing position {position.id}: {e}")
                error_count += 1
                continue
        
        # Commit all changes
        session.commit()
        
        print("\n" + "=" * 60)
        print("Migration Summary:")
        print(f"  Migrated: {migrated_count} notes")
        print(f"  Appended: {appended_count} notes to existing annotations")
        print(f"  Skipped:  {skipped_count} (already contained in annotations)")
        print(f"  Errors:   {error_count}")
        print("=" * 60)
        
        if error_count > 0:
            print("\n⚠️  Some positions had errors. Check the output above for details.")
            return 1
        else:
            print("\n✅ Migration completed successfully!")
            return 0
            
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        session.rollback()
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())