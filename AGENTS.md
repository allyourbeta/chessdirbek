# Chessdirbek

Personal chess position quiz app. Save positions (FEN), annotate them with notes and Stockfish analysis, tag them, and quiz yourself.

## Architecture

```
Vanilla JS (browser)
  ├── Stockfish WASM (engine analysis, client-side)
  ├── cm-chessboard v8 (board rendering, via CDN)
  └── calls → Python backend (FastAPI)
                ├── python-chess (FEN validation, pawn structure search)
                └── SQLite via SQLAlchemy (persistence)
```

## Tech Stack
- **Backend**: Python 3 + FastAPI + SQLAlchemy + SQLite
- **Chess logic**: python-chess (backend), stockfish.js WASM (frontend)
- **Frontend**: Vanilla JS + cm-chessboard v8 (CDN) + chess.js (move validation)
- **Database**: SQLite (single file, no server)

## File Limits
- No file over 300 lines. Split immediately if exceeded.

## Backend Structure
- `models/` — SQLAlchemy models
- `api/` — FastAPI route handlers (all DB calls here)
  - `positions.py`, `positions_extra.py` — Position CRUD + bulk operations  
  - `practice.py`, `practice_stats.py` — Practice games + analytics
- `services/` — Pure functions for chess logic (no DB, no FastAPI imports)
- `main.py` — App entry point, mounts routers
- `database.py` — DB engine/session setup

## Key Decisions
- Single-user MVP (no auth). User ID hardcoded as 1.
- Quiz order: random within filtered tag set.
- Quiz history tracked from day one (for future spaced repetition).
- Stockfish runs in browser (WASM), not on server.
- python-chess used server-side for FEN validation, pawn structure, etc.

## Database Backup Scripts
Chessdirbek has automated backup scripts for data safety:

- `scripts/backup_database.sh` — Automated nightly backup at 3am via launchd. Uses SQLite's native backup API. Keeps the newest 10 backups (RETENTION_COUNT).
- `scripts/backup_now.sh` — Manual backup wrapper for use before risky operations. Creates backups with MANUAL prefix.
- `scripts/restore_database.sh <backup-filename>` — Interactive restore with confirmation prompt. Creates safety backup before restore.

Backups are stored in `backups/` directory (gitignored). The launchd plist is at `~/Library/LaunchAgents/com.ashish.chessdirbek-backup.plist`.

To load/unload the automated backup:
- Load: `launchctl load ~/Library/LaunchAgents/com.ashish.chessdirbek-backup.plist`
- Unload: `launchctl unload ~/Library/LaunchAgents/com.ashish.chessdirbek-backup.plist`

IMPORTANT: Always run `scripts/backup_now.sh` before any destructive operations, migrations, or bulk imports.

## Frontend Architecture Notes

The frontend is vanilla JS (no build tools). Scripts are loaded via `<script>`
tags in `index.html`. Two files use `<script type="module">`:

- `main.js` — ES module that imports cm-chessboard v8 from CDN. Defines
  `BoardManager` (window global). Also bootstraps the app by calling
  `Router.init()` at the end of its execution. This means all regular scripts
  must be loaded before `main.js`, and any global they define will be
  available when `Router.init()` triggers routing.
- `board-editor.js` — regular script (NOT a module). Must appear before
  `main.js` in `index.html` so `window.BoardEditor` exists when the router
  might navigate to the editor view.

Split files (to honor 300-line limit):
- `position-list.js` + `featured.js` — Position lists and featured board management
- `practice-ui.js` + `practice-ui-actions.js` — Practice session UI and inline actions

### cm-chessboard v8 API

The app uses cm-chessboard v8 via CDN. Key API facts for this version:

- `enableSquareSelect(handler)` — one argument (the callback). The handler
  receives an event with `event.square` (e.g. "e4"). Do NOT pass an event
  type as the first argument — that is a different version's API.
- `enableMoveInput(handler, color)` — used for drag-to-move on play boards.
- `setPosition(fen, animated)` — updates the board display.
- Exports: `Chessboard`, `COLOR`, `FEN`, `INPUT_EVENT_TYPE`. Do NOT try to
  import `POINTER_EVENTS` or `SQUARE_SELECT_TYPE` — they do not exist in the
  version served by `@8` on jsdelivr.

### Board Editor Interaction Model

The board editor uses click-to-place, NOT drag-and-drop:
1. Click a piece in the palette to select it as the active tool
2. Click a square on the board to place that piece
3. Click the eraser tool, then click a square to remove a piece

## Troubleshooting

### Stockfish analysis shows "Analyzing..." but no lines

This has occurred 5+ times. Before changing any code, try these steps IN ORDER:

1. **Hard refresh** (Cmd+Shift+R on Mac). The browser aggressively caches JS
   files, especially ES modules. A stale `stockfish-service.js` or
   `engine-ui.js` can cause analysis to silently fail.
2. **Open an incognito window** and test there. If it works in incognito, it's
   a cache problem.
3. **Check the console** for errors. If the stockfish WASM worker fails to
   load, you'll see network errors for `stockfish.wasm.js` or `stockfish.wasm`.
4. **Check StockfishService.state** in the console (`StockfishService.state`).
   - `"uninitialized"` → engine was never started. Click "Show Engine".
   - `"loading"` → engine is loading but stuck. Worker may have failed.
   - `"ready"` → engine loaded but not analyzing. `analyze()` not called.
   - `"analyzing"` → engine is running. If no lines show, `_onUpdate`
     callback may be null (check engine-ui.js `_startAnalysis`).

Only if ALL of the above fail to reveal the issue, look at the code. The
historical root cause was a race condition in `stockfish-service.js` where
a `bestmove` response set `_state = 'ready'`, causing subsequent `info` lines
to be ignored. This was fixed by making the `bestmove` handler simply return
without changing state (line ~94 in stockfish-service.js). If someone
reintroduces `_state = 'ready'` in the bestmove handler, that is the bug.

### Board editor not working

The board editor has two known failure modes:

1. **`BoardEditor` is undefined** — `board-editor.js` must be loaded as a
   regular `<script>` (NOT `type="module"`) and must appear BEFORE `main.js`
   in `index.html`. If it's a module or appears after `main.js`, the router
   will try to call `BoardEditor.init()` before it exists.
2. **Clicking squares does nothing** — the `BoardManager.enableSquareSelect()`
   method must use cm-chessboard's native one-argument API. If someone changes
   it to pass `POINTER_EVENTS.pointerdown` as the first argument, square
   selection will silently fail.
