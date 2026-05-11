# Board Editor Fix Spec

## Status: Two bugs, both must be fixed

The board editor has two bugs that together make it non-functional.

---

## Bug 1: BoardEditor is undefined at route time (load order)

### Symptom
`window.BoardEditor` is `undefined` when the router calls `BoardEditor.init()`.

### Root cause
`board-editor.js` is loaded as `<script type="module">` after `board.js`
(also `type="module"`). `board.js` calls `Router.init()` at the end of its
execution, which calls `renderRoute()` → `BoardEditor.init()`. But
`board-editor.js` hasn't executed yet.

### Fix
In `frontend/index.html`, change `board-editor.js` from a module to a regular
script and move it before `board.js`:

Find:
```html
<script type="module" src="/js/board-editor.js"></script>
```

Change to a regular script and place it immediately before the board.js line:
```html
<script src="/js/board-editor.js"></script>
<script type="module" src="/js/board.js"></script>
```

Why: regular scripts execute before all modules. `board-editor.js` has no
import statements and does not need `BoardManager` at definition time.

### Also
In `backend/main.py`, confirm `"editor"` is in the `_SPA_ROUTES` set.

---

## Bug 2: enableSquareSelect uses wrong cm-chessboard API signature

### Symptom
Board renders, palette renders, but clicking squares does nothing. No errors.

### Root cause
In `frontend/js/board.js`, the `BoardManager.enableSquareSelect()` method
uses a custom DOM-scraping approach:

```js
el.addEventListener('pointerdown', function (e) {
    const sqEl = e.target.closest('[data-square]');
    if (sqEl) callback(sqEl.getAttribute('data-square'));
});
```

This does not use cm-chessboard's API at all. It scrapes the DOM for
`[data-square]` attributes which may not exist in cm-chessboard v8's SVG.

The cm-chessboard v8 native API for square selection is:

```js
board.enableSquareSelect(POINTER_EVENTS.pointerdown, (event) => {
    console.log(event.square)  // "e4", "d1", etc.
})
```

Key facts about the v8 API:
- `enableSquareSelect` takes TWO arguments: eventType and handler
- `POINTER_EVENTS` is exported from `Chessboard.js`
- The handler receives an event object with `.square` containing the
  algebraic square name
- `disableSquareSelect` also takes the eventType as an argument

### Fix — step by step

#### Step 1: Add POINTER_EVENTS to the import in board.js

Change line 1 of `frontend/js/board.js` from:
```js
import {Chessboard, COLOR, FEN, INPUT_EVENT_TYPE}
    from "https://cdn.jsdelivr.net/npm/cm-chessboard@8/src/Chessboard.js";
```
to:
```js
import {Chessboard, COLOR, FEN, INPUT_EVENT_TYPE, POINTER_EVENTS}
    from "https://cdn.jsdelivr.net/npm/cm-chessboard@8/src/Chessboard.js";
```

#### Step 2: Replace enableSquareSelect method

Replace the entire `enableSquareSelect` method in `BoardManager` with:

```js
enableSquareSelect(elementId, callback) {
    const board = this.boards[elementId];
    if (!board) return;
    board.enableSquareSelect(POINTER_EVENTS.pointerdown, (event) => {
        callback(event.square);
    });
},
```

#### Step 3: Replace disableSquareSelect method

Replace the entire `disableSquareSelect` method in `BoardManager` with:

```js
disableSquareSelect(elementId) {
    const board = this.boards[elementId];
    if (!board) return;
    board.disableSquareSelect(POINTER_EVENTS.pointerdown);
},
```

---

## Do NOT change

- `frontend/js/board-editor.js` — the current version is correct
- `frontend/js/shared.js`
- The board editor interaction model (click palette piece, then click square)
- Any other files or methods in board.js besides the import line,
  `enableSquareSelect`, and `disableSquareSelect`

---

## Files to change

1. `frontend/index.html` — script tag for board-editor.js (Bug 1)
2. `frontend/js/board.js` — import line, `enableSquareSelect` method, and
   `disableSquareSelect` method (Bug 2)
3. `backend/main.py` — verify `"editor"` in `_SPA_ROUTES`

---

## Verification

After both fixes, hard refresh (Cmd+Shift+R):

1. `console.log(typeof BoardEditor)` at `localhost:8000` — must be `"object"`
2. Navigate to board editor
3. Board renders with coordinates
4. Piece palette renders (12 pieces + eraser)
5. FEN shows `8/8/8/8/8/8/8/8 w - - 0 1`
6. Click white queen in palette — highlights
7. Click d4 — queen appears, FEN updates
8. Click eraser, click d4 — queen disappears
9. "Starting Position" — all pieces appear
10. "Clear Board" — board empties
11. "Flip" — orientation reverses
12. Direct navigation to `localhost:8000/editor` loads the app
13. No console errors
14. ALL other views still work (tabiyas, tactics, games, practice, search)
