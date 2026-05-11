# Global Position Annotations Spec

Status: **PLANNED** — design is ready, implement when ready.

## Goal

Attach free-text notes to any board position (FEN), globally. When you
navigate to a position — in a tabiya exploration, game viewer, practice,
or search — any existing annotation for that FEN appears. When you type
a note, it auto-saves against that FEN. Same position, same note,
regardless of how you reached it.

This turns the app into a personal chess knowledge base keyed by position.

## Terminology

Use "position annotation" consistently throughout code and UI.
- DB table: `fen_annotations` (implementation detail)
- UI label: "Position notes"
- Code variable/class: `AnnotationPanel`, `FenAnnotation`

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

**Future-proofing note**: v1 uses board + side-to-move as the key. A
future version could optionally support a stricter key (including castling
rights) for positions where that matters. The current design does not
prevent this — just add an optional `strict_fen_key` column later if
needed. Do not build this now.

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
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
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

**Save/delete semantics:**
- Trim `note_text` only for the emptiness check — do NOT trim the stored
  value. Preserve internal formatting, newlines, and whitespace.
- If trimmed text is empty string, DELETE the row (clean up junk records).
- If trimmed text equals the already-stored text, skip the DB write
  (no-op save). Still return success.
- Any non-empty text after trim is valid. No minimum length — chess
  notes are often tiny ("!", "only move", "zug", "?").

Response: `{ "fen_key": "...", "note_text": "...", "saved": true }`

### POST /api/annotations/batch

For bulk loading (e.g., highlighting which moves have annotations in a
move list). Uses POST because FEN strings contain spaces and special
characters that make query strings unreliable.

Request: `{ "fens": ["full fen 1", "full fen 2", ...] }`

Response: `{ "annotations": { "normalized_fen1": "note text", ... } }`

Only returns FENs that have annotations (sparse).

---

## Frontend

### AnnotationPanel component

A shared component like EngineUI. API:
- `AnnotationPanel.mount(containerId)` — renders the textarea
- `AnnotationPanel.setPosition(fen)` — loads annotation for this FEN
- `AnnotationPanel.unmount()` — cleans up, saves any pending changes

### Internal state model

The component tracks:
```
_currentFen      — the FEN we're showing/editing notes for
_loadedText      — the text as loaded from the server
_draftText       — the text currently in the textarea
_isDirty         — _draftText !== _loadedText
_isSaving        — a save request is in flight
_loadVersion     — incrementing counter to prevent stale fetch races
```

### Behavior

**On position change** (setPosition called):
1. If `_isDirty`, save current draft immediately before switching
2. Increment `_loadVersion`
3. Fetch `GET /api/annotations?fen=newFen`
4. When response arrives, check `_loadVersion` matches — if not, discard
   (prevents stale response from overwriting current position's textarea)
5. Set `_loadedText` and `_draftText` to the fetched text
6. Update textarea

**On input** (user types):
1. Update `_draftText`
2. Set `_isDirty = true`
3. Reset debounce timer (1.5 seconds)
4. After debounce: if still dirty, save

**On blur:**
1. If `_isDirty`, save immediately (cancel any pending debounce)

**On save:**
1. Set `_isSaving = true`
2. `PUT /api/annotations` with `_currentFen` and `_draftText`
3. On success: set `_loadedText = _draftText`, `_isDirty = false`,
   show subtle "Saved ✓" indicator that fades after 2 seconds
4. On failure: show subtle "Save failed" indicator, keep draft visible,
   do NOT erase textarea. Will retry on next blur or debounce.
5. Set `_isSaving = false`

### Error handling

If a fetch or save request fails:
- Do NOT erase the textarea
- Keep the local draft visible
- Show subtle "Save failed" state
- Retry on next blur or next debounce trigger

### Layout

```
┌─────────────────────┐
│  Board              │
│                     │
├─────────────────────┤
│  FEN: rnbqk...  [Copy]
├─────────────────────┤
│  Position notes     │
│  ┌─────────────────┐│
│  │ This is where   ││
│  │ Nf3 is critical ││
│  └─────────────────┘│
│              Saved ✓ │
├─────────────────────┤
│  Engine analysis    │
└─────────────────────┘
```

The annotation panel sits below the FEN display and above the engine,
in the left (board) column.

### FEN source of truth

The panel must always derive its current FEN from the board/view
controller's canonical current position (passed via `setPosition()`),
never from a displayed text field that might lag behind.

### Move list indicators (v2, not required for v1)

In the move list panel (game viewer, practice), annotated moves show a
small dot or speech bubble icon next to the move. The indicator marks
the **resulting position after the move** (not the position before it).
For example, a dot on `12...Nf6` means "there is an annotation on the
position after Nf6 was played."

This requires the batch endpoint: on loading a game, send all position
FENs to `POST /api/annotations/batch`, then mark moves that have
annotations.

---

## Integration points

The annotation panel appears in these views:

1. **Tabiya/Tactic detail** — below the FEN, above the engine
2. **Game viewer** — below the FEN, above the engine
3. **Practice viewer** — below the board (review mode)

**Excluded from v1:** Board editor. The editor is for composing positions,
not studying them. Annotations can be added later if needed.

The annotation panel is a shared component. Mount it in each view's
`loadXxx()` function, call `setPosition()` whenever the board position
changes (same places that call `EngineUI.setPosition()`).

---

## Migration

Add to `database.py`'s `run_lightweight_migrations()` function to
create the table if it doesn't exist:

```python
if not inspect(engine).has_table("fen_annotations"):
    FenAnnotation.__table__.create(engine)
```

This is additive only — no destructive migration, no alteration of
existing tables. Safe to run on existing databases.

---

## Relationship to existing notes

Positions already have a `notes` field on the Position model. That field
stores notes about the starting position of a tabiya/tactic — it's
conceptually "what is this position and why did I save it."

Position annotations are different — they're about specific positions
encountered during exploration. "At this exact position, here's what I
noticed."

Both coexist. The Position.notes field stays as-is (shown in the right
panel). Position annotations appear below the board and update per-move.

---

## Estimated scope

- New model + migration: ~30 lines
- New API file with 3 endpoints: ~100 lines
- New frontend component (AnnotationPanel): ~130 lines
- Integration in 3 views: ~20 lines each
- Move list indicators (v2, optional): ~40 lines

Total: ~320-380 lines of new code across 4-5 files.
