# Global FEN Annotations Spec (Future)

Status: **PLANNED** — design is ready, implement when ready.

## Goal

Attach free-text notes to any board position (FEN), globally. When you
navigate to a position — in a tabiya exploration, game viewer, practice,
or search — any existing annotation for that FEN appears. When you type
a note, it auto-saves against that FEN. Same position, same note,
regardless of how you reached it.

This turns the app into a personal chess knowledge base keyed by position.

---

## Data Model

### New table: `fen_annotations`

```sql
CREATE TABLE fen_annotations (
    id INTEGER PRIMARY KEY,
    fen_key TEXT NOT NULL UNIQUE,
    note_text TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fen_key ON fen_annotations(fen_key);
```

**`fen_key`** is the normalized board-only FEN: the piece placement plus
side to move, but WITHOUT castling rights, en passant, halfmove clock,
or fullmove number. Example: `rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b`

This normalization ensures transpositions are recognized — the same
position reached via different move orders shares one annotation.

### Normalization function

```python
def normalize_fen_key(full_fen: str) -> str:
    """Extract board + side-to-move from a full FEN."""
    parts = full_fen.strip().split()
    board = parts[0]
    side = parts[1] if len(parts) > 1 else 'w'
    return f"{board} {side}"
```

### SQLAlchemy model

```python
class FenAnnotation(Base):
    __tablename__ = "fen_annotations"
    id = Column(Integer, primary_key=True, index=True)
    fen_key = Column(String, unique=True, nullable=False, index=True)
    note_text = Column(Text, nullable=False, default='')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=..., onupdate=...)
```

---

## Backend API

### GET /api/annotations?fen={full_fen}

Returns the annotation for a FEN (normalized internally).

Response: `{ "fen_key": "...", "note_text": "...", "exists": true }`
or `{ "fen_key": "...", "note_text": "", "exists": false }` if none.

### PUT /api/annotations

Upsert an annotation.

Request: `{ "fen": "full FEN string", "note_text": "my notes..." }`

If `note_text` is empty, delete the annotation (clean up empty records).

Response: `{ "fen_key": "...", "note_text": "...", "saved": true }`

### GET /api/annotations/batch

For bulk loading (e.g., highlighting which moves have annotations in a
move list).

Request: `?fens=fen1&fens=fen2&fens=fen3`

Response: `{ "annotations": { "normalized_fen1": "note text", ... } }`

Only returns FENs that have annotations (sparse).

---

## Frontend

### Annotation panel

A small text area that appears below or beside the board. It loads the
annotation for the current FEN and auto-saves on blur or after a
debounce.

```
┌─────────────────────┐
│  Board              │
│                     │
├─────────────────────┤
│  FEN: rnbqk...      │  [Copy]
├─────────────────────┤
│  📝 Position notes  │
│  ┌─────────────────┐│
│  │ This is where   ││
│  │ Nf3 is critical ││
│  └─────────────────┘│
├─────────────────────┤
│  Engine analysis    │
└─────────────────────┘
```

### Behavior

- On every position change (move, navigation, page load), fetch
  `GET /api/annotations?fen=currentFen`
- Display the note text in a textarea (or "No notes for this position"
  placeholder)
- On input, debounce 1.5 seconds, then `PUT /api/annotations`
- On blur, save immediately if changed
- Show a subtle save indicator ("Saved ✓" that fades)

### Move list indicators

In the move list panel (game viewer, practice), annotated moves could
show a small dot or speech bubble icon. This requires the batch endpoint:
on loading a game, send all FENs to `GET /api/annotations/batch`, then
mark moves that have annotations.

This is a nice-to-have, not required for v1.

---

## Integration points

The annotation panel should appear in ALL views that show a board with
navigation:

1. **Tabiya/Tactic detail** — below the board, between FEN and engine
2. **Game viewer** — below the board, between FEN and engine
3. **Practice viewer** — below the board (review mode)

The annotation panel is a shared component, like EngineUI. Create
`AnnotationPanel` with `mount(containerId)`, `setPosition(fen)`,
`unmount()`.

---

## Migration

Add to `database.py`'s `run_lightweight_migrations()` function to
create the table if it doesn't exist:

```python
if not inspect(engine).has_table("fen_annotations"):
    FenAnnotation.__table__.create(engine)
```

---

## Relationship to existing notes

Positions already have a `notes` field on the Position model. That field
stores notes about the starting position of a tabiya/tactic — it's
conceptually "what is this position and why did I save it."

FEN annotations are different — they're about specific positions
encountered during exploration. "At this exact position, here's what I
noticed."

Both can coexist. The Position.notes field stays as-is (shown in the
right panel). FEN annotations appear below the board and update per-move.

---

## Estimated scope

- New model + migration: ~30 lines
- New API file with 3 endpoints: ~80 lines
- New frontend component (AnnotationPanel): ~100 lines
- Integration in 3 views: ~20 lines each
- Move list indicators (optional): ~40 lines

Total: ~300-350 lines of new code across 4-5 files.
