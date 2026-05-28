# Spec: Play vs Engine, Game History, and Replay-with-Eval

**Status:** Ready to implement
**Audience:** Claude Code
**Author intent:** Greenfield. Implement this from the requirements below. Do **not**
study, copy, or "fix" any prior engine/practice code in the repo — see
§0 "Hard reset" for what to treat as legacy. The previous engine integration had a
fundamental architectural flaw; reusing it reintroduces the flaw.

---

## 0. Hard reset — what is legacy, what is greenfield

This repo contains **abandoned** engine/practice code from a previous attempt. Treat all
of the following as **legacy to be removed or ignored**, not as reference material:

- `frontend/js/practice.js`, `frontend/js/practice-ui.js`,
  `frontend/js/practice-ui-actions.js`, `frontend/js/practice-viewer.js`,
  `frontend/js/practice-viewer-actions.js`, `frontend/js/practice-history.js`
- Backend `backend/api/practice.py`, `backend/api/practice_stats.py`,
  `backend/api/game_schemas.py` practice portions, `backend/models/practice_models.py`
- Any `engine-level`/`Skill Level`/`stockfish_analysis` concepts in those files.

You will build **new, cleanly-named modules** (listed in §5) and a **new backend table**
(`engine_games`, §4). Do **not** extend the legacy `practice_games` table or its API.
At the end (§9) there is an explicit decommission step for the legacy code.

Do not grep the legacy files for "how it was done." The whole point is to not inherit
their structure.

---

## 1. Product requirements (the only source of truth)

1. **Play.** From any saved position (all four `position_type`s: `tabiya`, `puzzle`,
   `endgame`, `strategy`), the user can play a full game against a chess engine. The user
   picks their **color** and a **difficulty** (engine Elo). The engine replies with legal
   moves. The app detects game end (checkmate, stalemate, draws).
2. **Capture.** Every game's move sequence is saved to a database, **keyed by the starting
   position** (`position_id`, which maps 1:1 to the position's starting FEN). One position
   has many games over time.
3. **Replay with live eval.** The user can retrieve any saved game and step through it move
   by move. At each position, an engine evaluation (centipawn/mate score + best line) is
   shown and updates live as the user steps.
4. **Lichess deep-dive (already built).** A "Lichess" button opens the current position in
   Lichess's analysis board. This already exists (`FenActions.analyzeOnLichess`). Leave it
   as-is; just make sure the new Play and Replay views also expose it (§6.4).
5. **Naming fix (independent).** Auto-generated position names must **not** be chess-themed.
   See §3.

---

## 2. Architecture — the one rule that prevents the swamp

**The engine is a stateless oracle behind a Promise wall. It never owns game state.**

`chess.js` is the single source of truth for the board during play. `MoveNavigator` is the
single source of truth during replay. The engine is asked questions and returns answers; it
stores nothing the app reads back.

```
            ┌────────────────────────────────────────────────┐
  PLAY:     │ chess.js (sole truth)                            │
            │   │ fen                                          │
            │   ▼                                              │
            │ Engine.bestMove(fen, {elo})  ──► Worker (WASM)   │
            │   ◄── resolves {bestMove:"e2e4"} ──              │
            │   ▼ apply to chess.js, render board              │
            └────────────────────────────────────────────────┘

            ┌────────────────────────────────────────────────┐
  REPLAY:   │ MoveNavigator (sole truth) ── fen at ply N       │
            │   ▼                                              │
            │ Engine.evaluate(fen, {depth}) ──► Worker (WASM)  │
            │   ◄── resolves {scoreCp, mate, bestLineSan} ──   │
            │   ▼ render eval bar / line (DISPLAY ONLY)        │
            └────────────────────────────────────────────────┘
```

Non-negotiable invariants:

- **INV-1.** The engine module exposes exactly two async methods: `bestMove()` and
  `evaluate()`. No other module sends raw UCI or reads worker messages.
- **INV-2.** The engine holds **no** position/history state that any other module reads.
  Each call is independent request→response.
- **INV-3.** During play, the only mutable game state is one `chess.js` instance. During
  replay, the only mutable game state is `MoveNavigator`. The eval display writes to nothing
  but DOM text. These two modes never share a mutable object.
- **INV-4.** Stale-response protection lives **only** inside the engine module via a
  generation counter (§5.1). No upstream module deals with race conditions.
- **INV-5.** The engine is swappable. Because the only contract is `bestMove`/`evaluate`
  speaking through a UCI worker, a future Lc0/Maia worker can replace Stockfish without
  touching play/replay/data code. Keep all Stockfish-specific strings inside the engine
  module.

---

## 3. CHANGE 1 — De-chess the position naming (do this first, separate commit)

**File:** `frontend/js/naming-service.js`

**Problem:** `generatePositionName()` draws from chess-themed `ADJECTIVES`/`NOUNS`
(`sharp`/`gambit`, etc.), producing confusing pseudo-chess names. The user never wanted
chess-specific names. The **only** constraint is total visual length.

**Required change:**

- Replace the `ADJECTIVES` and `NOUNS` arrays with **general-purpose, non-chess** word
  lists. Suggested content (you may refine, keep each word ≤ 8 chars so adjective-noun fits
  the UI tile):
  - Adjectives: everyday descriptive words (e.g. `amber, brave, calm, clever, cosmic,
    cozy, crisp, dapper, eager, fuzzy, gentle, golden, happy, jolly, keen, lively, lucky,
    mellow, merry, nimble, plucky, quiet, rapid, shiny, snug, spry, sunny, swift, tidy,
    witty, zesty`).
  - Nouns: concrete, friendly objects/animals (e.g. `acorn, badger, beacon, cabin, cedar,
    comet, cove, ember, falcon, fern, harbor, heron, lark, lotus, maple, marble, meadow,
    otter, pebble, quartz, raven, ridge, robin, sparrow, stone, thistle, tundra, willow`).
- Keep the function name `generatePositionName()` and its return shape (`adjective + '-' +
  noun`) **unchanged** so all call sites keep working.
- **Remove** `generateGamePositionName`'s dependence on nothing here is needed — leave the
  game-name and fork-name functions as they are (they are not chess-themed; they use real
  player names / source titles). Only the random word lists change.
- Add/keep a JSDoc note: "Names are intentionally generic (non-chess). Only constraint is
  length so the adjective-noun pair fits the tile."

**Test (§8.1)** asserts the word lists contain no chess terms and that generated names fit a
length budget.

---

## 4. CHANGE 2a — Backend: new `engine_games` table + API

Build a **new** model, schema, and router. Do not touch legacy practice files yet (§9
handles their removal).

### 4.1 Model — `backend/models/engine_models.py` (new file)

```python
"""SQLAlchemy model for engine games (play-vs-engine sessions)."""
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from backend.database import Base


class EngineGame(Base):
    __tablename__ = "engine_games"

    id = Column(Integer, primary_key=True, index=True)
    position_id = Column(
        Integer, ForeignKey("positions.id"), nullable=False, index=True
    )
    start_fen = Column(String, nullable=False)        # denormalized for replay convenience
    moves_san = Column(Text, nullable=False)          # space-separated SAN, e.g. "e4 e5 Nf3"
    user_color = Column(String, nullable=False)       # "white" | "black"
    engine_elo = Column(Integer, nullable=False)      # 1320..3190
    result = Column(String, nullable=False)           # "1-0" | "0-1" | "1/2-1/2" | "*"
    outcome = Column(String, nullable=True)           # "checkmate"|"stalemate"|"insufficient"
                                                      #  |"threefold"|"fifty-move"|"resigned"|"abandoned"
    final_fen = Column(String, nullable=False)
    move_count = Column(Integer, nullable=False)      # number of plies
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    position = relationship("Position", backref="engine_games")
```

**Notes:**
- `result` uses standard PGN result tokens; `*` means unfinished.
- `moves_san` is space-separated SAN. SAN chosen for human readability + trivial replay with
  chess.js. Empty string is allowed (game saved with zero moves = abandoned immediately;
  reject these in the API per §4.3).
- Register the model so `Base.metadata.create_all` picks it up (import it in
  `backend/models/__init__.py` exactly like other models are imported there).
- The existing `run_lightweight_migrations()` in `backend/database.py` + `create_all` on
  startup must create this table. If the project relies on `create_all`, importing the model
  is sufficient. Verify the table is created on a fresh DB (test §8.3).

### 4.2 Schemas — `backend/api/engine_schemas.py` (new file)

Pydantic v2 models (`model_config = ConfigDict(from_attributes=True)`; do not use the
deprecated class-based `Config`):

- `EngineGameCreate`: `position_id:int`, `start_fen:str`, `moves_san:str`,
  `user_color:str`, `engine_elo:int`, `result:str`, `outcome:str|None`, `final_fen:str`,
  `move_count:int`.
- `EngineGameOut`: all columns + `id` + `created_at`.
- `EngineGameBrief`: `id`, `created_at`, `user_color`, `engine_elo`, `result`,
  `move_count` (for list views — omit the heavy `moves_san`).

Validation in `EngineGameCreate`:
- `user_color` ∈ {"white","black"}.
- `engine_elo` in `[1320, 3190]`.
- `result` ∈ {"1-0","0-1","1/2-1/2","*"}.
- `moves_san` non-empty and `move_count` ≥ 1.

### 4.3 Router — `backend/api/engine_games.py` (new file)

Prefix mounting matches existing pattern (`app.include_router(engine_games_router,
prefix="/api")`). Routes (all DB access here, per the layered architecture):

- `POST /engine-games` → create. Body `EngineGameCreate`. 201 → `EngineGameOut`.
  - Reject (422) if `move_count < 1` or `moves_san` empty.
  - Validate `position_id` exists (404 if not).
- `GET /positions/{position_id}/engine-games` → `list[EngineGameBrief]`, newest first.
- `GET /engine-games/{game_id}` → `EngineGameOut` (full, includes `moves_san`). 404 if
  missing.
- `DELETE /engine-games/{game_id}` → 204. 404 if missing.

Export the router via `backend/api/__init__.py` as `engine_games_router` and mount it in
`backend/main.py` next to the others.

**Server-side move validation (defensive, optional but recommended):** On create, you *may*
verify `moves_san` actually produces `final_fen` from `start_fen` using `python-chess`
(already a dependency). If you implement it, put the check in a **service** function
(`backend/services/`), not in the router, and return 422 on mismatch. Keep it pure (no DB).

---

## 5. CHANGE 2b — Frontend engine module (the heart of it)

### 5.1 `frontend/js/engine.js` (new file) — the ONLY file that talks to the worker

This wraps the Stockfish WASM worker behind a Promise API. ~150 lines max. No DOM access.
Exposes `window.Engine`.

**Engine asset:** single-threaded WASM build (no COOP/COEP headers required). Files are
vendored at `frontend/vendor/stockfish/stockfish-18-lite-single.js` and
`stockfish-18-lite-single.wasm` (see §7 for fetching them). The `.js` loader is itself the
worker script and locates the `.wasm` next to itself.

**Why single-threaded:** the multi-threaded builds require `SharedArrayBuffer`, which needs
`Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` headers. That header requirement
is a classic source of environment-specific breakage (and breaks PWAs / embeds). The
single-threaded "lite-single" build runs on any modern browser with **no special headers**.
Do not switch to a multi-threaded build.

**Public API:**

```js
window.Engine = {
  // Lazily boots the worker on first call. Safe to call repeatedly.
  async init(): Promise<void>,

  // Ask for the engine's move from `fen`, limited to approx `elo` strength.
  // Resolves with { bestMove: "e2e4", ponder?: "e7e5" }. bestMove is UCI (long algebraic).
  async bestMove(fen, { elo, movetimeMs = 1000 }): Promise<{bestMove:string, ponder?:string}>,

  // Evaluate `fen` to `depth`. Resolves with normalized eval from White's POV:
  //   { scoreCp: number|null, mate: number|null, bestLineUci: string[], depth: number }
  // Exactly one of scoreCp / mate is non-null.
  async evaluate(fen, { depth = 12 }): Promise<EvalResult>,

  // Optional: stop any in-flight search (used when leaving a view).
  stop(): void,
};
```

**Internal design (this is where the only cleverness lives):**

1. **Single worker, single in-flight command.** Maintain one `Worker`. The UCI protocol is
   serial. Maintain a small internal queue so overlapping calls don't interleave UCI: a new
   `bestMove`/`evaluate` first sends `stop` if a search is running, then runs.

2. **Generation counter (INV-4).** Keep `let generation = 0`. Each public call does
   `const myGen = ++generation;` before sending UCI. When parsing worker output, if
   `myGen !== generation`, **discard** the result (resolve the stale promise with a rejected
   or ignored sentinel; simplest: never resolve stale ones and let the newer call's
   `bestmove`/eval resolve the current promise). This makes fast replay-stepping safe: only
   the latest `evaluate` call's result is ever rendered.

3. **UCI handshake (do once in `init`):**
   ```
   → uci
   ← ... uciok
   → isready
   ← readyok
   ```
   Then per-call options.

4. **`bestMove(fen, {elo, movetimeMs})`:**
   ```
   → setoption name UCI_LimitStrength value true
   → setoption name UCI_Elo value <clamp elo to [1320,3190]>
   → ucinewgame
   → position fen <fen>
   → go movetime <movetimeMs>
   ← info ...            (ignore for bestMove, or capture last for convenience)
   ← bestmove e2e4 ponder e7e5
   ```
   Resolve `{bestMove, ponder}`. Parse the `bestmove` line. If `bestmove (none)` (mate/
   stalemate at this node), resolve `{bestMove:null}` — caller treats null as "no move,
   game is over" and should already have detected game end via chess.js anyway.

5. **`evaluate(fen, {depth})`:**
   ```
   → setoption name UCI_LimitStrength value false   (full strength for honest eval)
   → setoption name MultiPV value 1
   → position fen <fen>
   → go depth <depth>
   ← info depth d ... score cp 34 ... pv e2e4 e7e5 ...
   ← info depth d ... score mate 3 ... pv ...
   ← bestmove ...
   ```
   Keep the **last** `info ... pv ...` line seen before `bestmove`. Parse:
   - `score cp N` → centipawns; `score mate N` → mate in N.
   - **Normalize to White's POV.** UCI scores are from the **side to move**. If it's Black
     to move in `fen` (field 2 == "b"), negate `cp` and negate the sign of `mate`. Document
     this clearly; it is the single most common eval bug.
   - `pv` tokens are UCI moves → store as `bestLineUci`.
   Resolve `{scoreCp, mate, bestLineUci, depth}`.

6. **WASM-supported detection.** Guard with the standard
   `typeof WebAssembly === 'object'`. If unsupported, `init()` rejects and the UI shows a
   graceful "engine unavailable" message (§6). Do not crash.

7. **No DOM, no app globals.** `engine.js` imports nothing from the app. It is pure infra.

**Worker bootstrapping detail:** create the worker as
`new Worker('/vendor/stockfish/stockfish-18-lite-single.js')`. The loader auto-detects
worker context, forwards engine stdout via `postMessage` (one line per message), and accepts
UCI commands via `worker.postMessage('<uci>')`. It resolves the `.wasm` path relative to its
own location, so both files must sit in the same directory.

### 5.2 `frontend/js/play.js` (new file) — play-mode controller

Owns one `chess.js` instance per game. Exposes `window.PlayMode`.

Responsibilities:
- `start({ positionId, startFen, userColor, elo })`:
  - `this.game = new Chess(startFen)` (validate FEN; if invalid, toast + abort).
  - Render board via `BoardManager.create('play-board', startFen, { mode:'play', flipped: userColor==='black', onMove })`.
  - Store `positionId, startFen, userColor, elo`.
  - If it is the **engine's** turn at the start (e.g. user is Black and it's White to move,
    or the FEN's side to move ≠ userColor), immediately trigger an engine move.
- `onMove(event)` (from cm-chessboard `validateMoveInput`):
  - Build `{from, to, promotion}` (auto-queen on promotion rank, same rule as the existing
    analysis board handler).
  - `const mv = this.game.move(...)`. If illegal → return `false` (board snaps back).
  - Else render, append to move list, check game end (§ below), and if not over, ask the
    engine to reply.
- `engineReply()`:
  - Guard: only if `this.game.turn()` ≠ userColor's first letter and game not over.
  - `const {bestMove} = await Engine.bestMove(this.game.fen(), { elo: this.elo })`.
  - If `bestMove` is null → game is over; finalize.
  - Convert UCI `bestMove` (e.g. `e7e8q`) into a chess.js move:
    `this.game.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] })`.
  - Render board to `this.game.fen()`, append move, check game end.
- **Game-end detection (use chess.js 0.10.3 API — note the older method names):**
  - `this.game.game_over()` is the umbrella check.
  - `this.game.in_checkmate()` → result is `"1-0"` if the side to move (the mated side) is
    black, else `"0-1"`; `outcome="checkmate"`.
  - `this.game.in_stalemate()` → `"1/2-1/2"`, `outcome="stalemate"`.
  - `this.game.in_draw()` → covers fifty-move + insufficient material; distinguish if you
    like via `this.game.insufficient_material()` (`outcome="insufficient"`) else
    `outcome="fifty-move"`; result `"1/2-1/2"`.
  - `this.game.in_threefold_repetition()` → `"1/2-1/2"`, `outcome="threefold"`.
  - **chess.js 0.10.3 uses snake_case** (`game_over`, `in_checkmate`, `in_stalemate`,
    `in_draw`, `in_threefold_repetition`, `insufficient_material`). Do **not** use
    `isGameOver()` etc. — that's a newer chess.js and this repo loads 0.10.3 via CDN.
- **Resign** button → finalize with result from the user's perspective (loss) and
  `outcome="resigned"`.
- `finalize({result, outcome})`:
  - `moves_san = this.game.history().join(' ')`.
  - `move_count = this.game.history().length`.
  - `final_fen = this.game.fen()`.
  - If `move_count < 1` (user resigned/abandoned before any move): do **not** POST; just
    return to detail with a toast. (API also rejects empties.)
  - `await ApiClient.post('/engine-games', { position_id, start_fen, moves_san, user_color,
    engine_elo, result, outcome, final_fen, move_count })`.
  - Toast "Game saved", refresh the Past Games list on the detail page, navigate back to
    detail (or stay with a "Play again" affordance — your call, keep it simple).

Concurrency rules for play:
- Disable user move input while an engine reply is pending (set a `thinking` flag; reject
  `onMove` while thinking). Re-enable after the engine move renders. This prevents the user
  from moving for the engine.

### 5.3 `frontend/js/game-replay.js` (new file) — replay + live eval

Exposes `window.GameReplay`. Reuses the existing **MoveNavigator** (the sole working history
owner) — do not build a second navigator.

- `open(gameId)`:
  - `const g = await ApiClient.get('/engine-games/' + gameId)`.
  - Reconstruct the FEN at each ply: start `new Chess(g.start_fen)`, then for each SAN in
    `g.moves_san.split(' ')`, `chess.move(san)` and record `chess.fen()`. Build
    `fens = [startFen, fenAfterPly1, fenAfterPly2, ...]`.
  - Render board `BoardManager.create('replay-board', g.start_fen, { flipped: g.user_color==='black' })`.
  - `MoveNavigator.create('replay-nav', { fens, startIndex: 0, boardId: 'replay-board',
    containerId: 'replay-move-nav', keyScope: 'view-replay', onNavigate: (fen) => this.onStep(fen) })`.
  - Render the move list (SAN) with the current ply highlighted.
  - Call `this.onStep(fens[0])` once to populate the initial eval.
- `onStep(fen)`:
  - Update FEN label.
  - Fire `Engine.evaluate(fen, { depth: 12 })`. When it resolves, render the eval bar + score
    + best line (in SAN — convert `bestLineUci` to SAN by replaying on a scratch
    `new Chess(fen)`). Because of the engine's generation counter, only the latest step's
    eval ever lands — no stale renders.
  - Eval rendering is **display-only**; it must never write to MoveNavigator or the board.
- Provide a "Lichess" button (reuse `FenActions.analyzeOnLichess`) that opens the
  **current** replay FEN.
- `close()`: `Engine.stop()`, `MoveNavigator.destroy('replay-nav')`.

### 5.4 Eval bar component

Small, dependency-free. Either a thin module `frontend/js/eval-bar.js` (preferred, keeps
files small) or inline in `game-replay.js` if trivial. Renders a vertical/horizontal bar
mapping eval to a 0–100% White-advantage fill, plus a numeric label (`+1.2`, `-0.4`,
`M3`/`-M2` for mate). Clamp cp display to e.g. ±10.00 for the bar fill while still showing
the true number in text. Keep it under the 300-line limit (it will be ~60 lines).

---

## 6. CHANGE 2c — HTML/UI wiring

Reuse existing patterns: `data-action` attributes dispatched in
`frontend/js/action-handlers.js`; views are `<div class="view" id="view-...">`; routing via
`Router`/`Navigation`. Keep all new buttons on the existing event-delegation path (no inline
handlers — the static audit forbids them).

### 6.1 Play controls on the position detail page
Add a "Play vs Engine" control group to `#view-detail` (and the detail actions card):
- A color selector (White / Black / Random).
- A difficulty selector mapping labels → Elo:
  `Beginner=1320, Casual=1600, Intermediate=2000, Strong=2400, Maximum=3190`.
- A "Play" button → `data-action="engine-play-start"` → reads selectors + current
  `AppState.currentDetailId` + the detail FEN, then `PlayMode.start(...)` and routes to a new
  `#view-play`.

### 6.2 New `#view-play`
- `#play-board` board container.
- Move list (`#play-move-list`).
- Status line (`#play-status`): "Your move" / "Engine thinking…" / final result.
- Buttons: Resign (`data-action="engine-play-resign"`), Back (cancel → confirm if a game is
  in progress and has ≥1 move; abandoned games are simply not saved), and a Lichess button
  (`data-action="analyze-on-lichess"`).

### 6.3 "Past Games" section on the detail page
- A card `#engine-games-section` listing this position's saved games (newest first), each row
  showing date, your color, Elo label, result, move count, and a Delete (🗑) control.
- Tapping a row → `data-action="engine-game-open"` with the game id → `GameReplay.open(id)` →
  route to `#view-replay`.
- Loaded for **all four** position types (no type gating — requirement §1.2). Populate it in
  the detail loader for every type.

### 6.4 New `#view-replay`
- `#replay-board`, `#replay-move-nav` (MoveNavigator mounts here), `#replay-move-list`,
  the eval bar (`#replay-eval`), best-line text (`#replay-bestline`), a Lichess button, and
  Back.

### 6.5 Action handlers
Add cases to `ActionHandlers.execute`:
- `engine-play-start` → read selectors, start play.
- `engine-play-resign` → `PlayMode.resign()`.
- `engine-game-open` → `GameReplay.open(target.dataset.gameId)`.
- `engine-game-delete` → confirm, `ApiClient.delete('/engine-games/'+id)`, refresh list.
Routing entries for `view-play` and `view-replay` in the router, with proper teardown
(`PlayMode`/`GameReplay` `close()`/cleanup on navigate-away, and `Engine.stop()`).

### 6.6 Script load order
Add new scripts in `index.html` **before** `main.js` (which bootstraps the router):
`engine.js`, `eval-bar.js`, `play.js`, `game-replay.js`. They define `window.*` globals,
consistent with the app's non-module scripts. `engine.js` must load before `play.js` and
`game-replay.js`. `main.js` stays last; `build-stamp.js` stays before `main.js`.

### 6.7 Engine-unavailable fallback
If `Engine.init()` rejects (no WASM), the Play button shows a toast "Chess engine couldn't
load in this browser" and the eval bar in replay shows "—". Replay still works for stepping
through moves without eval. Never throw uncaught.

---

## 7. Fetching & vendoring the engine (automate this)

Provide a script `scripts/fetch_engine.sh` that downloads the single-threaded lite build and
vendors it. It must be idempotent and verify file presence/size.

```bash
#!/usr/bin/env bash
set -euo pipefail
DEST="frontend/vendor/stockfish"
mkdir -p "$DEST"
TMP="$(mktemp -d)"
echo "Fetching stockfish npm package…"
npm pack stockfish --pack-destination "$TMP" >/dev/null
TGZ="$(ls "$TMP"/stockfish-*.tgz)"
tar xzf "$TGZ" -C "$TMP" \
  package/bin/stockfish-18-lite-single.js \
  package/bin/stockfish-18-lite-single.wasm
cp "$TMP"/package/bin/stockfish-18-lite-single.js  "$DEST/"
cp "$TMP"/package/bin/stockfish-18-lite-single.wasm "$DEST/"
rm -rf "$TMP"
echo "Vendored to $DEST:"
ls -la "$DEST"
# Sanity: wasm should be ~7MB
test "$(stat -f%z "$DEST/stockfish-18-lite-single.wasm" 2>/dev/null || stat -c%s "$DEST/stockfish-18-lite-single.wasm")" -gt 5000000
echo "OK"
```

Notes:
- The `.wasm` is ~7 MB and the `.js` loader ~20 KB. Both must end up in the same folder.
- Add `frontend/vendor/stockfish/*.wasm` consideration to the PWA service worker: the engine
  must be available offline, so **add both files to the SW precache list** in
  `frontend/sw.js` (find the existing precache array and append the two paths). If you bump
  the SW cache version constant, do it once and note it.
- License: Stockfish.js is GPLv3. Add a short `frontend/vendor/stockfish/NOTICE.md` noting
  origin (`npm: stockfish`, nmrugg/stockfish.js), version, and GPLv3, with a link.
- Do **not** commit the 7 MB wasm without the user's awareness — mention it in the final
  summary. (It is required for offline play; that's expected.)

---

## 8. Testing (this is how we get it right the first time)

The repo uses `./test_smoke.sh` (static audits + FastAPI TestClient + pytest). Extend it.
Every new test must pass. Run `./test_smoke.sh` before and after.

### 8.1 Naming tests — `tests/test_naming.py` (new) or add to frontend smoke
- Read `frontend/js/naming-service.js`; assert the ADJECTIVES/NOUNS arrays do **not** contain
  any of a banned chess-term set: `{gambit, tactic, mate, check, pin, fork, skewer, tempo,
  endgame, opening, defense, attack, blitz, setup, motif}`.
- Assert each word ≤ 8 chars (length budget).
- (Optional JS unit if a JS test runner exists; otherwise the static string assertions in
  pytest are sufficient and match how this repo tests frontend.)

### 8.2 Backend API tests — `tests/test_engine_games.py` (new)
Use the FastAPI `TestClient` against a temp SQLite DB (follow the existing
`tests/test_basic_api.py` setup/fixtures). Cases:
- **Create + fetch round-trip:** create a position, POST a valid `engine-games` payload (a
  short real game e.g. Scholar's mate `e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7` → result `1-0`), expect
  201 and an id; GET it back, assert `moves_san`, `result`, `move_count` match.
- **List by position, newest first:** POST two games, GET
  `/positions/{id}/engine-games`, assert length 2 and order (newest `created_at` first), and
  that briefs omit `moves_san`.
- **Reject empty game:** POST with `moves_san=""`, `move_count=0` → 422.
- **Reject bad enums:** `user_color="green"` → 422; `engine_elo=100` → 422;
  `result="win"` → 422.
- **404s:** GET/DELETE missing `game_id` → 404; POST with nonexistent `position_id` → 404.
- **Delete:** POST, DELETE → 204, then GET → 404.
- **(If server-side validation implemented):** POST a `moves_san` that doesn't yield
  `final_fen` from `start_fen` → 422.

### 8.3 Fresh-DB migration test
- Spin up the app against a brand-new temp DB and assert the `engine_games` table exists
  (e.g. issue a `GET /positions/{id}/engine-games` returning `[]` rather than a 500). This
  guards the "model registered + table created" wiring.

### 8.4 Engine module tests (Node, headless) — `tests/engine/`
The engine runs in a browser worker, but we can test the **UCI parsing/normalization logic**
in isolation by extracting the pure parsers into testable functions.

- Refactor `engine.js` so the **pure** helpers are individually exported/attachable for test:
  - `parseBestMove(line) -> {bestMove, ponder}`
  - `parseInfoLine(line) -> {depth, scoreCp, mate, pvUci[]}` (raw, side-to-move POV)
  - `normalizeScore({scoreCp, mate}, sideToMove) -> {scoreCp, mate}` (White POV)
  Expose them on `window.Engine._test = {...}` in the browser, and also export via a tiny
  CommonJS shim guarded by `typeof module !== 'undefined'` so Node can `require` them. Keep
  this shim minimal and clearly commented; it must not affect browser behavior.
- Write `tests/engine/parse.test.js` (plain Node assertions, no framework needed; a script
  that `require`s the shim and `assert`s). Cases:
  - `parseBestMove("bestmove e2e4 ponder e7e5")` → `{bestMove:"e2e4", ponder:"e7e5"}`.
  - `parseBestMove("bestmove (none)")` → `{bestMove:null}`.
  - `parseInfoLine("info depth 12 ... score cp 34 ... pv e2e4 e7e5")` →
    `scoreCp 34, mate null, pvUci ["e2e4","e7e5"]`.
  - `parseInfoLine(".. score mate -3 .. pv ..")` → `mate -3`.
  - `normalizeScore({scoreCp:34,mate:null}, 'w')` → `+34`; with `'b'` → `-34`.
  - `normalizeScore({scoreCp:null,mate:3}, 'b')` → `mate -3`.
- Add a runner line to `test_smoke.sh`: `node tests/engine/parse.test.js` (guard with
  `command -v node`).

### 8.5 Frontend integration smoke (static, like existing comprehensive tests)
Add assertions to `tests/test_frontend_smoke.py` / comprehensive:
- `engine.js`, `play.js`, `game-replay.js` exist and are referenced in `index.html` before
  `main.js`.
- `engine.js` contains `UCI_LimitStrength` and `UCI_Elo` and does **not** reference
  multi-threaded/`SharedArrayBuffer`/`Threads value` (guards the headerless decision).
- No inline handlers introduced (existing audit already enforces; just keep it green).
- `#view-play` and `#view-replay` exist in `index.html`; Past Games section exists.
- chess.js usage in `play.js` uses snake_case methods (`game_over`, `in_checkmate`) and not
  `isGameOver` (guards the version mismatch).

### 8.6 Manual test checklist (include in the PR description / a `MANUAL-TEST.md`)
1. Fresh load, open a tabiya, pick White + Casual, Play. Make a legal move; engine replies
   within ~1–2s. Illegal move snaps back. You cannot move during "thinking".
2. Play to checkmate (or resign). Game saves; appears in Past Games with correct result.
3. Open the saved game in Replay; step forward/back with arrows; eval bar updates and never
   "sticks" to a stale value when stepping fast.
4. Black-to-move start position: eval sign is correct (a White-up position shows `+`).
5. Repeat Play from the same position; both games listed, newest first.
6. Do all of the above for an endgame and a strategy position (no type gating).
7. Lichess button in Play and Replay opens the current FEN.
8. Offline (DevTools offline): engine still plays (SW precached the wasm).
9. Delete a saved game; it disappears.

---

## 9. Decommission legacy (final, separate commit)

Only after §3–§8 are green:
- Remove legacy frontend practice files listed in §0 from `index.html` and delete them.
- Remove legacy backend `practice.py` / `practice_stats.py` routers from `main.py` mounts and
  delete the files and `practice_models.py` + practice schema fragments.
- Update `test_smoke.sh` critical-file list and any tests that referenced the legacy files.
- Leave the legacy `practice_games` **table** in the DB as-is (don't write a destructive
  migration); it's harmless and the user's real data lives in `cafe_reports.db`-style
  backups. Note in the summary that the table is orphaned but untouched.
- Run `scripts/backup_now.sh` first if it exists (per CLAUDE.md: always back up before
  destructive ops).

If removing the legacy practice UI would break the detail page (shared DOM ids), do the
removal carefully and keep the new Play/Replay sections independent of the old ids.

---

## 10. Constraints & house rules (from CLAUDE.md and user preferences)

- **No file over 300 lines.** Split: `engine.js` (infra), `play.js`, `game-replay.js`,
  `eval-bar.js`. If any approaches 300, split further.
- **Layered architecture:** components/UI ≠ business logic ≠ data. Backend: all DB in
  `api/`; pure chess logic (if any) in `services/`. Frontend: `engine.js` is pure infra;
  controllers (`play.js`, `game-replay.js`) own flow; `ApiClient` is the only fetch path
  (the static audit enforces "no fetch outside api-client.js" — route all calls through it).
- **No new heavy dependencies.** chess.js + cm-chessboard already present; Stockfish wasm is
  vendored static, not an npm runtime dep. No bundler, no framework, no TypeScript migration.
- **Reuse centralized helpers:** `ApiClient`, `Navigation`, `BoardManager.getCurrentFen()`,
  `FenActions`, `Notifications`/`toast`, `MoveNavigator`, `NamingService`.
- **Discuss-before-deviate:** if any assumption here conflicts with the actual code
  (method names, ids, router shape), prefer reading the real file and adapting **without**
  changing the architecture in §2. Note deviations in the summary.
- **Automate over manual.** The engine fetch is scripted (§7). Provide unzip/test/commit
  commands in the final summary. Ship as one ZIP at project root with a unique name.
- **End every coding task by running `./test_smoke.sh` and the Node engine test, and
  confirm no file exceeds 300 lines.**

## 11. Suggested commit sequence
1. `naming: de-chess generated position names` (§3 + §8.1).
2. `engine: vendored single-thread stockfish + fetch script + NOTICE` (§7).
3. `engine: Promise oracle wrapper + pure parsers + node tests` (§5.1 + §8.4).
4. `backend: engine_games model/schema/router + tests` (§4 + §8.2/§8.3).
5. `play: play-vs-engine view + save flow` (§5.2 + §6.1/§6.2 + §8.5).
6. `replay: game replay with live eval + eval bar` (§5.3/§5.4 + §6.3/§6.4).
7. `cleanup: decommission legacy practice code` (§9).

Each commit should leave `./test_smoke.sh` green.
