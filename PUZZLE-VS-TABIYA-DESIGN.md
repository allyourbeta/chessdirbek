# Puzzle vs Tabiya Design Document

## Core Concept

Chessdirbek needs to distinguish between two fundamentally different types of positions:

1. **Puzzles**: Positions with a specific correct answer or sequence that the user needs to find
2. **Tabiyas**: Key opening/middlegame positions that serve as starting points for practice and exploration

## Why This Matters

The current system treats all positions the same, but these two types serve different purposes:

- **Puzzles** are about finding the right move(s) - they have solutions, themes, and success/failure states
- **Tabiyas** are about understanding and practicing from key positions - they're launch points for exploration, not problems to solve

## Data Model Changes

### New Fields for Position Model

```python
position_type: Enum["puzzle", "tabiya"]  # Required, no "both" option
solution_san: String  # For puzzles: the correct move(s) in SAN notation
theme: String  # For puzzles: tactical theme (e.g., "fork", "pin", "endgame")
```

### Migration Strategy

- All existing positions default to "tabiya" (since the app started as a position database, not a puzzle trainer)
- Users can bulk-reclassify their positions after migration
- Practice history and quiz attempts remain intact regardless of type changes

## UI Changes

### Navigation Structure (Option A - Selected)

Replace single "Positions" tab with two separate tabs:
- **Puzzles** - Shows only puzzle-type positions
- **Tabiyas** - Shows only tabiya-type positions

Benefits:
- Clear separation of concerns
- Users know exactly what they're looking at
- Can have different default views (puzzles show themes, tabiyas show opening names)

### Position Detail Views

Split into type-specific views:

**Puzzle Detail View:**
- Shows puzzle-specific UI elements
- Solution field (hidden until revealed)
- Theme tag
- Success rate tracking
- "Check answer" functionality

**Tabiya Detail View:**
- Shows practice-oriented UI
- "Practice from here" prominent
- Opening tree statistics
- No solution/answer mechanics

### Add/Edit Position Flow

1. First screen asks: "What type of position is this?"
   - Puzzle (has a specific solution)
   - Tabiya (key position for practice)
2. Based on selection, show appropriate fields
3. Type can be changed later, but with clear warnings about data implications

## Type Change Rules

### Tabiya → Puzzle
- Preserves: notes, tags, practice history
- Requires: adding a solution (can't save as puzzle without solution)
- Optional: adding a theme

### Puzzle → Tabiya  
- Preserves: notes, tags, practice history
- Clears: solution_san (with warning)
- Theme becomes a regular tag

### Key Principle
Practice history is NEVER deleted during type changes. A position practiced as a tabiya that becomes a puzzle and then becomes a tabiya again retains all practice games throughout.

## Implementation Priority

1. Database migration with safe defaults
2. Backend model and API changes
3. Navigation restructuring
4. Type-specific detail views
5. Bulk reclassification tool
6. Enhanced puzzle features (later phases)

## Future Enhancements (Not in Phase 15)

- Puzzle rating/difficulty system
- Spaced repetition for puzzles
- Puzzle streak tracking
- Import from puzzle databases (Lichess puzzles, chess.com puzzles)
- Auto-detect puzzle vs tabiya on import based on source