# Phase 25: Interactive board in the add/fork form

**Goal**: Make the board in the add/edit/fork form interactive — you can drag pieces to make legal moves, and the FEN input stays in sync. Currently the board is display-only; you can only change the position by pasting a FEN.

This is a small, targeted change. Three files, ~10 lines of code.

**Read first**: `CLAUDE.md`

**Backup**: `./scripts/backup_now.sh`

**Scope**: Frontend only. No backend changes.

---

## Background

`BoardManager.create(elementId, fen, options)` supports a `mode: 'analysis'` option that enables drag-to-move with legal move validation. It also accepts an `onPositionChange` callback that fires with the new FEN after every move. Both features already work — the detail view and featured boards use them. The add-form board was never given a mode, so it's display-only.

---

## The fix

### Step 1. Define a FEN-sync callback

In `frontend/js/position-form.js`, add a function that syncs the board state back to the FEN input field and to `AppState.boardFen`. Place it near the top of the file, before `savePosition`:

```js
function _onBoardPositionChange(newFen) {
    document.getElementById('fen-input').value = newFen;
    AppState.boardFen = newFen;
}
```

### Step 2. Update `clearForm` in `frontend/js/position-form.js` (~line 124)

Current:
```js
BoardManager.create('board', AppState.boardFen, { flipped: false });
```

Change to:
```js
BoardManager.create('board', AppState.boardFen, {
    flipped: false,
    mode: 'analysis',
    onPositionChange: _onBoardPositionChange,
});
```

### Step 3. Update `main.js` (~line 8)

Current:
```js
BoardManager.create('board', AppState.boardFen);
```

Change to:
```js
BoardManager.create('board', AppState.boardFen, {
    mode: 'analysis',
    onPositionChange: function(newFen) {
        document.getElementById('fen-input').value = newFen;
        AppState.boardFen = newFen;
    },
});
```

Note: `main.js` is an ES module and can't see `_onBoardPositionChange` directly (it's defined in `position-form.js`, a regular script). So inline the callback here. Alternatively, expose `_onBoardPositionChange` on window in `position-form.js` and reference it in `main.js` — either approach works. The inline version is simpler.

### Step 4. Update `forkFeaturedPosition` in `frontend/js/position-list.js` (~line 340)

Currently, after `Router.navigate`, the fork function calls:
```js
BoardManager.setPosition('board', AppState.boardFen);
```

`setPosition` updates the display but does NOT re-enable move input or set the mode. Since `clearForm` is not called during fork (and shouldn't be — we want to keep the pre-populated data), the board needs to be explicitly recreated with analysis mode.

Change that line to:
```js
BoardManager.create('board', AppState.boardFen, {
    mode: 'analysis',
    onPositionChange: function(newFen) {
        document.getElementById('fen-input').value = newFen;
        AppState.boardFen = newFen;
    },
});
```

Also check `editPosition` in `position-detail.js` (~line 163) — it has the same pattern (`BoardManager.setPosition('board', ...)`). Apply the same fix there so the board is interactive when editing an existing position too:

```js
BoardManager.create('board', AppState.boardFen, {
    mode: 'analysis',
    onPositionChange: function(newFen) {
        document.getElementById('fen-input').value = newFen;
        AppState.boardFen = newFen;
    },
});
```

### Step 5. Verify the FEN input → board direction still works

The existing `setupAutoLoad` in `position-form.js` listens to the FEN input's `input` event and calls `BoardManager.setPosition('board', fen)` when the user types/pastes a FEN. This should still work — `setPosition` updates the board display and internal `_fen` without recreating it, so analysis mode stays active. Verify manually: paste a FEN → board updates → drag a piece → FEN input updates.

### Step 6. Handle the `renderRoute` clobbering issue for fork

When `forkFeaturedPosition` calls `Router.navigate({ view: 'addPosition', ... })`, the route handler in `shared.js` runs and overwrites the form title with "New Tactic" / "New Tabiya", clobbering the "Fork from ..." title that was set just before. The fix: in `forkFeaturedPosition`, set the form title and do the `BoardManager.create` **after** `Router.navigate`, not before. The current code already does `BoardManager.setPosition` after navigate, so just make sure the form title is also set after:

```js
Router.navigate({
    view: 'addPosition',
    params: { type: pos.position_type || 'tabiya' }
});
// These must come AFTER Router.navigate since renderRoute overwrites them
BoardManager.create('board', AppState.boardFen, {
    mode: 'analysis',
    onPositionChange: function(newFen) {
        document.getElementById('fen-input').value = newFen;
        AppState.boardFen = newFen;
    },
});
if (typeof window._applyFormOrientation === 'function') {
    window._applyFormOrientation(pos.orientation || 'white');
}
document.getElementById('form-title').textContent =
    'Fork from ' + (pos.title || 'untitled');
```

---

## Files modified

| File | Change |
|---|---|
| `frontend/js/position-form.js` | Add `_onBoardPositionChange`. Update `clearForm` to pass `mode: 'analysis'` + callback. |
| `frontend/js/main.js` | Update initial `BoardManager.create('board', ...)` to pass `mode: 'analysis'` + inline callback. |
| `frontend/js/position-list.js` | In `forkFeaturedPosition`: use `BoardManager.create` (not `setPosition`) with analysis mode; move form-title set after navigate. |
| `frontend/js/position-detail.js` | In `editPosition`: use `BoardManager.create` (not `setPosition`) with analysis mode. |

## What NOT to do

- Don't add free-form piece placement (the full editor-in-form). That's a separate future phase.
- Don't change the board editor view (`board-editor.js`). It's a separate tool.
- Don't touch backend code.
- Don't change how `setupAutoLoad` works — the FEN-input-to-board direction is already correct.

## Acceptance criteria

- [ ] Navigate to the add form (+ New Tactic or + New Tabiya). The board shows the starting position. **Drag a piece to make a legal move** (e.g. drag e2 pawn to e4). The piece moves. The FEN input updates to reflect the new position.
- [ ] Paste a different FEN into the input. The board updates. Drag a piece again — still works.
- [ ] Click Fork on a featured tactic. The board shows the source position. Drag a piece — it moves. FEN input syncs. Form title says "Fork from [name]".
- [ ] Click Edit on a position (from the detail view). The board shows the position. Drag a piece — it moves. FEN input syncs.
- [ ] After dragging pieces to modify the position, click Save. The position saves with the **modified** FEN (the one shown in the input), not the original.
- [ ] Click Clear. Board resets to starting position. Dragging still works (analysis mode persists after reset).
- [ ] Only legal moves work — can't drop a piece on an illegal square; it snaps back.
- [ ] No console errors.

## Commit

Single commit: `Make add/edit/fork board interactive with analysis mode`
