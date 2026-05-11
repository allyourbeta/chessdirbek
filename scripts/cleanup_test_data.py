#!/usr/bin/env python3
"""One-time cleanup script to remove test data from production database."""

import sqlite3
import sys

def main():
    print("=" * 60)
    print("ChessQuiz Database Cleanup")
    print("=" * 60)
    print("\nThis script will remove test data that leaked into production.")
    print("Real user data (positions 1-5 and their practice games) will be preserved.")
    
    conn = sqlite3.connect('chessquiz.db')
    cursor = conn.cursor()
    
    # First, analyze what we'll delete
    print("\n1. Analyzing test data...")
    
    # Find test positions (ID > 5, and positions with obvious test titles)
    cursor.execute("""
        SELECT id, title FROM positions 
        WHERE id > 5 
        OR (id != 3 AND (
            title LIKE '%Test Position%' 
            OR title LIKE '%Rook Endgame Win%'
            OR title LIKE '%Italian Game Mainline%'
            OR title LIKE '%Filter Test%'
            OR title LIKE '%Debug%'
            OR title LIKE '%Legacy Position%'
            OR title LIKE '%Practice Test%'
            OR title LIKE '%Quiz Test%'
            OR title LIKE '%Invalid Solution%'
        ))
        ORDER BY id
    """)
    test_positions = cursor.fetchall()
    
    print(f"Found {len(test_positions)} test positions to delete:")
    for pos_id, title in test_positions[:10]:
        print(f"  - ID {pos_id}: {title}")
    if len(test_positions) > 10:
        print(f"  ... and {len(test_positions) - 10} more")
    
    # Count related data that will be deleted
    test_position_ids = [p[0] for p in test_positions]
    
    if test_position_ids:
        # Count practice games
        placeholders = ','.join(['?' for _ in test_position_ids])
        cursor.execute(f"""
            SELECT COUNT(*) FROM practice_games 
            WHERE root_position_id IN ({placeholders})
        """, test_position_ids)
        practice_game_count = cursor.fetchone()[0]
        
        # Count quiz attempts  
        cursor.execute(f"""
            SELECT COUNT(*) FROM quiz_attempts 
            WHERE position_id IN ({placeholders})
        """, test_position_ids)
        quiz_attempt_count = cursor.fetchone()[0]
    else:
        practice_game_count = 0
        quiz_attempt_count = 0
    
    print(f"\nRelated data that will be deleted:")
    print(f"  - {practice_game_count} practice games")
    print(f"  - {quiz_attempt_count} quiz attempts")
    
    # Check what we're preserving
    print("\n2. Data that will be PRESERVED:")
    cursor.execute("""
        SELECT id, title, position_type FROM positions 
        WHERE id <= 5
        ORDER BY id
    """)
    preserved = cursor.fetchall()
    for pos_id, title, ptype in preserved:
        print(f"  - ID {pos_id}: {title} ({ptype})")
    
    cursor.execute("SELECT COUNT(*) FROM practice_games WHERE root_position_id = 5")
    pos5_practice = cursor.fetchone()[0]
    print(f"  - {pos5_practice} practice games for position 5")
    
    # Ask for confirmation
    print("\n" + "=" * 60)
    print(f"SUMMARY: Will delete {len(test_positions)} positions, "
          f"{practice_game_count} practice games, and {quiz_attempt_count} quiz attempts.")
    
    # Check for --yes flag
    if '--yes' in sys.argv:
        print("Auto-confirming cleanup (--yes flag provided)")
        response = 'y'
    else:
        try:
            response = input("Continue with cleanup? [y/N]: ")
        except EOFError:
            print("\nNo input available. Run with --yes flag to auto-confirm.")
            conn.close()
            return
    
    if response.lower() != 'y':
        print("Cleanup cancelled.")
        conn.close()
        return
    
    # Perform the cleanup
    print("\n3. Performing cleanup...")
    
    if test_position_ids:
        # Delete positions (cascade will handle related data)
        placeholders = ','.join(['?' for _ in test_position_ids])
        cursor.execute(f"DELETE FROM positions WHERE id IN ({placeholders})", test_position_ids)
        
        # Also fix the case inconsistency while we're at it
        cursor.execute("UPDATE positions SET position_type = LOWER(position_type)")
        
        conn.commit()
        print(f"✓ Deleted {len(test_positions)} test positions")
        print(f"✓ Normalized all position_type values to lowercase")
    else:
        print("No test data found to delete.")
    
    # Show final state
    print("\n4. Final database state:")
    cursor.execute("SELECT COUNT(*) FROM positions")
    total_positions = cursor.fetchone()[0]
    print(f"  - Total positions: {total_positions}")
    
    cursor.execute("SELECT COUNT(*), position_type FROM positions GROUP BY position_type")
    for count, ptype in cursor.fetchall():
        print(f"  - {ptype}: {count}")
    
    cursor.execute("SELECT COUNT(*) FROM practice_games")
    total_practice = cursor.fetchone()[0]
    print(f"  - Total practice games: {total_practice}")
    
    conn.close()
    print("\n✓ Cleanup complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()