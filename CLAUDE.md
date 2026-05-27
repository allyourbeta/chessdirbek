# Chessdirbek

Personal chess position quiz app. Save positions (FEN), annotate them with notes and Stockfish analysis, tag them, and quiz yourself.

## Architecture

```
Vanilla JS (browser)
  ├── cm-chessboard v8 (board rendering, via CDN)
  ├── chess.js (move validation, client-side)
  └── calls → Python backend (FastAPI)
                ├── python-chess (FEN validation, pawn structure search)
                └── SQLite via SQLAlchemy (persistence)
```

## Tech Stack
- **Backend**: Python 3 + FastAPI + SQLAlchemy + SQLite
- **Chess logic**: python-chess (backend), chess.js (frontend move validation)
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
- Stockfish WASM was removed (2026-05-27) due to irreconcilable state bugs. Clean rebuild planned.
- python-chess used server-side for FEN validation, pawn structure, etc.

## Database Backup Scripts
Chessdirbek has automated backup scripts for data safety:

- `scripts/backup_database.sh` — Automated nightly backup at 3am via launchd. Uses SQLite's native backup API. Keeps 30 days of backups.
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

### Stockfish / Engine Analysis — REMOVED

As of 2026-05-27, Stockfish WASM, engine-ui.js, stockfish-service.js, and
practice-engine-service.js have been removed. The engine integration and
analysis tree navigation had accumulated irreconcilable state-management bugs
across 12+ competing state variables. A clean rebuild is planned.

What was removed:
- `frontend/js/engine-ui.js` — engine panel UI (FEN toolbar, side pills, eval bar)
- `frontend/js/stockfish-service.js` — WASM worker wrapper, UCI protocol, SAN conversion
- `frontend/js/practice-engine-service.js` — separate worker for practice-vs-engine
- `frontend/vendor/stockfish/` — WASM binary and JS loader
- `BoardManager._analysisHistory` / `_analysisOrigin` / `undoAnalysis()` / `resetAnalysis()` / `setAnalysisOrigin()` — competing history that conflicted with MoveNavigator

What still works:
- Saving/loading positions, tags, annotations, all CRUD
- Board display and drag-to-move in analysis mode
- MoveNavigator (arrow keys, on-screen buttons) — now the sole history owner
- Practice history (viewing past games)
- Game viewer with move navigation

What is temporarily disabled:
- Engine evaluation display (no eval bar, no engine lines)
- Practice vs Stockfish ("Start Practice" shows a toast instead)

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
# Stabilization Guardrails

Before editing:

1. Run `./test_smoke.sh`
2. Do not proceed if tests fail.

After editing:

1. Run `./test_smoke.sh`
2. Do not declare completion unless it passes.

## Hard Rules

Do not introduce:

* inline HTML event handlers
* direct frontend `fetch()` outside `frontend/js/api-client.js`
* direct `history.back()` outside `frontend/js/navigation.js`
* undocumented `innerHTML`
* direct FEN clipboard writes outside `frontend/js/fen-actions.js`
* duplicated naming, ECO, move-count, notification, FEN, save-current-position, or category-label logic

Use existing centralized helpers/services:

* ApiClient
* Navigation
* NamingService
* BoardManager.getCurrentFen()
* MoveCounts
* EcoOpenings
* PositionTypes
* FenActions
* Notifications
* SaveCurrentPosition
* EmptyStates

This is a vanilla-JS app.
Do not introduce React, TypeScript migrations, bundlers, or framework rewrites.

If adding new functionality:

* prefer extending existing helpers/services
* avoid creating parallel ownership paths
* preserve stabilization invariants
