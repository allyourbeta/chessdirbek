# Script Bootstrap Refactor — Exact Diffs

## What this does

Currently `board.js` does two jobs:
1. Defines `BoardManager` (library)
2. Boots the entire app (creates boards, runs setup, calls `Router.init()`)

This refactor splits job #2 into a new `main.js` file. After the change:
- `board.js` = pure library (defines BoardManager, exports to window)
- `main.js` = app bootstrap (creates boards, runs setup, starts router)

This eliminates load-order bugs. Adding new globals in the future just
means adding one import to `main.js`.

---

## Step 1: Create `frontend/js/main.js`

Create this new file with exactly this content:

```js
// main.js — single app entrypoint.
// All modules are loaded via import. Startup happens here, after
// all libraries and globals are guaranteed to exist.

import "./board.js";  // sets window.BoardManager, etc.

// Create default boards
BoardManager.create('board', AppState.boardFen);
BoardManager.create('detail-board', AppState.boardFen);

// Run setup (defined in position-form.js, loaded as regular script before this)
setupAutoLoad();
setupKeyboardSave();
setupUrlParams();
setupPuzzleKeyboardShortcuts();

// Start the router — all globals are guaranteed to exist at this point.
Router.init();
```

This file is 16 lines. It imports `board.js` (which loads cm-chessboard
and sets `window.BoardManager`), then runs the same setup calls that
were previously at the end of `board.js`.

---

## Step 2: Remove bootstrap code from `frontend/js/board.js`

Delete lines 221-228 (the bootstrap code at the end of the file).
Keep everything else — all the imports, BoardManager definition, and
window exports.

The lines to DELETE are:

```js
BoardManager.create('board', AppState.boardFen);
BoardManager.create('detail-board', AppState.boardFen);
setupAutoLoad();
setupKeyboardSave();
setupUrlParams();
setupPuzzleKeyboardShortcuts();
// Start the router: parse current URL and render the matching view.
Router.init();
```

After deletion, `board.js` should end with:

```js
window.parseFenBoard = parseFenBoard;
window.renderMiniBoard = renderMiniBoard;
window.BoardManager = BoardManager;
window.MARKER_TYPE = MARKER_TYPE;
window.ARROW_TYPE = ARROW_TYPE;
```

(Plus a trailing newline. Nothing after the window exports.)

---

## Step 3: Update `frontend/index.html` script tags

Find these two lines (currently lines ~527-528):

```html
<script src="/js/board-editor.js"></script>
<script type="module" src="/js/board.js"></script>
```

Replace with:

```html
<script src="/js/board-editor.js"></script>
<script type="module" src="/js/main.js"></script>
```

`main.js` imports `board.js` internally, so `board.js` no longer needs
its own script tag. `board-editor.js` stays as a regular script before
the module — it defines `window.BoardEditor` which must exist before
`Router.init()` runs.

---

## Step 4: Register the static file route

In `backend/main.py`, the `/js` directory is already mounted as static
files, so `main.js` will be served automatically. No backend changes needed.

---

## What NOT to change

- Do NOT modify any function signatures or logic
- Do NOT modify `board-editor.js`
- Do NOT modify `shared.js`
- Do NOT modify `router.js`
- Do NOT modify any CSS files
- Do NOT modify any backend files
- Do NOT move or rename any functions — they stay in their current files

---

## Why this is safe

The refactor moves 8 lines of code from the end of `board.js` to a new
`main.js`. The execution order is identical:

**Before:**
1. Regular scripts load (state, router, shared, position-form, etc.)
2. `board-editor.js` loads (regular script, sets `window.BoardEditor`)
3. `board.js` module loads → imports cm-chessboard → defines BoardManager
   → creates boards → runs setup → calls Router.init()

**After:**
1. Regular scripts load (same)
2. `board-editor.js` loads (same)
3. `main.js` module loads → imports `board.js` → board.js defines
   BoardManager → main.js creates boards → runs setup → calls Router.init()

The only difference: `board.js` no longer has the bootstrap code at the
end. `main.js` does the same calls in the same order.

---

## Verification

After making the changes, test EVERY view. This is a structural change
so all views must be verified:

1. `localhost:8000` — Tactics landing loads, featured board renders
2. Click a tactic card — detail page loads, board renders
3. Click Tabiyas — list loads, card thumbnails render
4. Click a tabiya — detail loads, board renders, engine works
5. Click Games — table loads
6. Click a game — game viewer loads, board renders, moves work
7. Click Search — board renders, search works
8. Click "+ New ▾" → New Tactic — add form loads, board renders
9. Click "+ New ▾" → Editor — board editor loads, click-to-place works
10. Click "+ New ▾" → Import PGN — import form loads
11. Click "+ New ▾" → Bulk Add — bulk add form loads
12. Navigate back and forward — all views re-render correctly
13. No console errors on any view
14. Run backend tests: `python test.py && python test_games.py && python test_game_api.py && python test_practice.py && python test_position_types.py`

If ANY view fails to load or shows a blank board, the refactor has a
bug. Check the console for "X is not defined" errors — that means a
global wasn't available when Router.init() tried to use it.

## Rollback

If it doesn't work:
```bash
git restore .
```
This resets everything to the last commit.
