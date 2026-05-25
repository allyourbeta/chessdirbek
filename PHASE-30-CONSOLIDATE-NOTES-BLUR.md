# Phase 30: Consolidate Notes to Annotations + Blur Reveal

Two changes: (1) remove the position-level Notes card from the detail view and make the annotation panel (keyed by FEN) the single notes system, and (2) add blur-to-reveal behavior so notes are hidden until you click.

Run `scripts/backup_now.sh` before starting.

## Part 1: Remove Position-Level Notes Card

The detail view currently has TWO notes systems:
- A "Notes" card in the right panel → saves to `position.notes` via `PUT /positions/{id}`
- An "annotation-textarea" below the board → saves to `fen_annotations` table via `PUT /annotations/`

We are keeping ONLY the annotation system (keyed by FEN). The position-level notes card is being removed.

### Step 1A: Migration Script

Create `scripts/migrate_notes_to_annotations.py` that:

1. Queries all positions where `notes IS NOT NULL AND notes != ''`
2. For each, normalizes the FEN key using the same logic as `annotations.py`:
   ```python
   def normalize_fen_key(full_fen):
       parts = full_fen.strip().split()
       board = parts[0]
       side = parts[1] if len(parts) > 1 else 'w'
       return f"{board} {side}"
   ```
3. Checks if a `fen_annotations` row already exists for that key
4. If NO existing annotation: insert the position's notes as a new `fen_annotations` row
5. If an annotation ALREADY exists and is non-empty: APPEND the position notes below the existing text, separated by `\n\n---\n(migrated from position notes)\n`. Do NOT overwrite.
6. If an annotation exists but is empty: replace with the position notes
7. Print a summary: `Migrated X notes, skipped Y (already had annotations), Z errors`

The script should be safe to run multiple times (idempotent — don't double-append). Add a check: if the position's notes text is already contained within the existing annotation, skip it.

Use direct SQLAlchemy against `chessdirbek.db` (same pattern as `scripts/cleanup_test_data.py`).

### Step 1B: Remove Notes Card from Detail View

**`frontend/index.html`** — Delete the Notes Card block (lines 331-340):
```html
<!-- DELETE THIS ENTIRE BLOCK -->
<div class="card collapsible-card" id="notes-card">
  <div class="collapsible-header" data-collapsible="notes-card">
    <span class="collapse-arrow">&#9654;</span>
    <label style="margin:0;cursor:pointer" id="notes-card-label">...</label>
  </div>
  <div class="card-body">
    <textarea id="detail-notes" ...></textarea>
  </div>
</div>
```

NOTE: The collapsible notes removal prompt (REMOVE-NOTES-COLLAPSIBLE-PROMPT.md) may have already changed this HTML. Read the current state of `index.html` before editing — if the collapsible was already removed and replaced with a plain card, remove that plain card instead.

**`frontend/js/position-detail.js`** — Remove all position-level notes logic:
- Lines 24-28: Remove `notesEl` setup (`detail-notes` value, `_lastSaved`, `oninput`, `onblur`)
- Line 31: Remove `_initCollapsibleCards(pos.notes)` call
- Lines 113-127: Remove `_initCollapsibleCards` function entirely (may already be gone from collapsible removal)
- Lines 104-107: Remove `toggleCollapsible` function (may already be gone)
- Lines 196-221: Remove `_onDetailNotesInput` and `_autoSaveDetailNotes` functions entirely
- Line 200-202: Remove the label innerHTML update in `_onDetailNotesInput`

**`frontend/js/position-detail.js`** — In `editPosition()` (line 171), keep `pos.notes` loading into the edit form for now. The edit form's notes field (`pos-notes`) is a separate concern — it can stay as a way to edit legacy position-level notes until we decide to remove it too.

**`frontend/css/components.css`** — Remove the collapsible card CSS if it's no longer used by anything else (the `.collapsible-card`, `.collapsible-header`, `.collapse-arrow`, `.card-body` max-height transition rules around lines 656-678). Check if any other element uses `collapsible-card` class first.

### Step 1C: What NOT to Touch

- Do NOT remove the `notes` column from the Position model or database. Leave it as-is — it's harmless and removing columns from SQLite is painful.
- Do NOT remove `notes` from the edit form (`pos-notes` textarea in view-add). That can stay as a secondary edit path for now.
- Do NOT remove the `stockfish_analysis` field or the `detail-stockfish-card` — that's a separate system for pasted engine analysis.
- Do NOT change the annotation panel mounting or the `/annotations/` API — those are correct as-is.

## Part 2: Blur Reveal on Annotation Panel

When annotations load for a position, if notes exist, blur them until the user clicks.

### CSS

**`frontend/css/components.css`** — Add:

```css
.annotation-textarea.blurred {
    filter: blur(5px);
    cursor: pointer;
    user-select: none;
}
```

### JavaScript

**`frontend/js/annotation-panel.js`** — Modify `setPosition()`:

After notes load successfully (inside the `.then` callback, after `_setTextarea(_loadedText)`), if `_loadedText` is non-empty, add the `blurred` class to the textarea:

```javascript
var ta = document.getElementById('annotation-textarea');
if (ta) {
    if (_loadedText) {
        ta.classList.add('blurred');
    } else {
        ta.classList.remove('blurred');
    }
}
```

**`frontend/js/annotation-panel.js`** — Add a click handler to reveal:

In `mount()`, after the existing event listeners, add a click handler to the textarea:

```javascript
ta.addEventListener('click', _onRevealClick);
```

Define `_onRevealClick`:

```javascript
function _onRevealClick(e) {
    var ta = document.getElementById('annotation-textarea');
    if (ta && ta.classList.contains('blurred')) {
        e.preventDefault();
        ta.classList.remove('blurred');
        // Don't focus or place cursor on the reveal click —
        // let the user click again to start editing
    }
}
```

In `unmount()`, remove the listener:

```javascript
ta.removeEventListener('click', _onRevealClick);
```

### Behavior Summary

- Navigate to a position → annotation loads → if non-empty, textarea is blurred
- Click the blurred textarea → blur drops, notes are readable
- Click again → normal textarea behavior (cursor, editing)
- Navigate to a new position (practice, move navigation) → `setPosition` is called → new notes load → blur re-applies if non-empty
- Empty annotations → no blur, normal placeholder shown, ready to type immediately
- The blur applies everywhere the annotation panel appears: position detail, game viewer, practice viewer (all go through the same `setPosition` method)

## Testing

1. Run `python scripts/migrate_notes_to_annotations.py` — verify output summary
2. `./test_smoke.sh` must pass
3. Manual checks:
   - Open a position that had position-level notes → verify the notes now appear in the annotation panel below the board (from migration)
   - The right panel should have NO notes card
   - Notes in annotation panel should be blurred on load
   - Click to reveal — blur drops
   - Navigate to another position — blur re-applies
   - Position with no notes — no blur, placeholder visible
   - Game viewer annotation panel — same blur behavior
   - Practice viewer annotation panel — same blur behavior
4. Verify no file exceeds 300 lines

## Files Modified

- `scripts/migrate_notes_to_annotations.py` (NEW — migration script)
- `frontend/index.html` (remove notes card)
- `frontend/js/position-detail.js` (remove notes logic)
- `frontend/js/annotation-panel.js` (add blur/reveal behavior)
- `frontend/css/components.css` (add `.blurred` class, possibly remove collapsible CSS)
