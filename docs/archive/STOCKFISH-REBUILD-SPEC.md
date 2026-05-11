# Stockfish Engine Integration — Clean Rebuild

Build the Stockfish analysis feature from scratch. Treat all prior engine implementations as deleted/unsupported. Do not reuse any prior engine logic even if stale references remain in the codebase. The Stockfish WASM binary and chess.js are the only prerequisites — both are already in the project.

## Architecture

Two new files, strict separation of concerns:

### 1. `frontend/js/stockfish-service.js` — Engine Service Layer

This file owns the Web Worker. It has NO DOM access, NO UI code, NO rendering. Pure engine communication.

**Public API:**

```javascript
const StockfishService = {
    // Initialize the worker. Returns a promise that resolves when engine is ready.
    init()  →  Promise<void>

    // Analyze a position. Calls onUpdate callback with parsed results as they arrive.
    // Cancels any previous analysis automatically.
    analyze(fen, options)  →  void
    //   options: { multiPV: 3, onUpdate: fn(lines), onReady: fn() }
    //   lines: [{ pv: 1, score: "+1.45", scoreCp: 145, isMate: false, depth: 15, moves: ["Nxe5", "dxe5", "Bc4+", ...] }, ...]

    // Stop current analysis.
    stop()  →  void

    // Terminate the worker entirely. Call on page unload.
    destroy()  →  void

    // Current state: 'uninitialized' | 'loading' | 'ready' | 'analyzing' | 'destroyed'
    state  →  string
}
```

**Implementation details:**

Worker initialization sequence (MUST follow this exact order):
1. Create worker: `new Worker('/vendor/stockfish/stockfish-16-single.js')`
2. Attach `worker.onmessage` handler
3. Send: `"uci"` — this tells the engine to identify itself
4. Wait for worker to send a line containing `"uciok"` — engine is now in UCI mode
5. Send: `"setoption name MultiPV value " + multiPV`
6. Send: `"setoption name Use NNUE value true"`
7. Send: `"isready"`
8. Wait for worker to send `"readyok"`
9. Set state to `'ready'`. Resolve the init() promise.

Step 3 is critical — without sending `"uci"` first, the engine never responds with `"uciok"` and initialization hangs silently.

The `analyze(fen, options)` method:
1. If state is not 'ready' or 'analyzing', throw error
2. Send: `"stop"` (cancel any in-progress analysis)
3. Send: `"setoption name MultiPV value " + options.multiPV` (in case it changed)
4. Send: `"position fen " + fen`
5. Send: `"go depth 24"`
6. Set state to 'analyzing'
7. Parse incoming `info` lines (see UCI parsing section below)
8. On each update, call `options.onUpdate(lines)` with the latest parsed results
9. When engine sends `bestmove`, analysis is complete. Set state back to 'ready'. Do NOT auto-restart.

Using `go depth 24` instead of `go infinite` is deliberate. Bounded analysis terminates cleanly, avoids leaked compute on route changes, and provides strong analysis (~2-3 seconds on modern hardware). This eliminates the lifecycle bugs that plagued the previous implementation. If the user wants fresh analysis, they toggle off and on again.

The `stop()` method:
1. Send: `"stop"` to worker
2. Set state to 'ready'

The `destroy()` method:
1. Call stop()
2. Call `worker.terminate()`
3. Set state to 'destroyed'

**UCI output parsing:**

The worker sends many lines. Parse lines that contain ` pv ` (a space-delimited "pv" token indicating a principal variation). Rules:
- If the line contains `multipv [N]`, use that as the PV number.
- If the line contains `pv` but NOT `multipv`, treat it as PV 1 (this happens with MultiPV=1 on some Stockfish builds).
- Ignore lines that don't contain ` pv ` at all (including `info string ...`, `info currmove ...`, `bestmove ...`, etc.).

For each matching line, extract:
- `multipv` number (1, 2, or 3 etc.)
- `depth` number
- `score`: either `cp [centipawns]` or `mate [moves]`
  - `cp 145` → scoreCp: 145, display: "+1.45", isMate: false
  - `cp -87` → scoreCp: -87, display: "-0.87", isMate: false
  - `mate 3` → display: "M3", isMate: true
  - `mate -2` → display: "-M2", isMate: true
- `pv` moves: everything after "pv" until end of line. These are in UCI notation (e.g., "e2e4 e7e5 g1f3").

**UCI-to-SAN conversion:**

Convert the UCI PV moves to SAN notation using chess.js:

```javascript
function uciToSan(fen, uciMoves) {
    const chess = new Chess(fen);
    const sanMoves = [];
    for (const uci of uciMoves) {
        const from = uci.substring(0, 2);
        const to = uci.substring(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        const move = chess.move({ from, to, promotion });
        if (!move) break; // Invalid move, stop converting
        sanMoves.push(move.san);
    }
    return sanMoves;
}
```

The `onUpdate` callback receives an array of line objects, one per PV. Each line object:
```javascript
{
    pv: 1,                          // multipv number
    score: "+1.45",                 // display string
    scoreCp: 145,                   // raw centipawns (null for mate)
    isMate: false,                  // true if forced mate
    mateIn: null,                   // number of moves to mate (null if not mate)
    depth: 15,                      // search depth
    moves: ["Nxe5", "dxe5", "Bc4+", "Ke8", "Qh5", ...] // SAN notation
}
```

Maintain an internal `currentLines` array. Each new `info` line updates the entry for its `multipv` number. Call `onUpdate(currentLines)` after each update. This gives the UI progressively deeper analysis in real time.

### 2. `frontend/js/engine-ui.js` — Engine UI Component

This file handles all DOM rendering for engine analysis. It uses StockfishService but has no knowledge of UCI or Web Workers.

**Public API:**

```javascript
const EngineUI = {
    // Mount the engine UI into a container element.
    // containerId: the ID of the div where engine controls + output will render
    // MUST be idempotent: if already mounted in this container, do nothing.
    // If mounted in a different container, unmount from old one first.
    mount(containerId)  →  void

    // Set the current position. If engine is on, restarts analysis.
    setPosition(fen)  →  void

    // Clean up: stop engine, remove ALL event listeners created by mount(), clear DOM.
    // MUST be safe to call even if not currently mounted (no-op in that case).
    unmount()  →  void
}
```

**Idempotency rules (critical — prevents duplicate listener bugs):**
- `mount()` called twice with the same containerId: second call is a no-op
- `mount()` called with a different containerId: calls `unmount()` on the old container first, then mounts in the new one
- `unmount()` called when not mounted: no-op, no errors
- `unmount()` removes ALL event listeners, DOM elements, and references created by the corresponding `mount()` call

**What `mount(containerId)` renders inside the container:**

```html
<div class="engine-panel">
    <div class="engine-controls">
        <button class="btn engine-toggle" id="engine-toggle-btn">Show Engine</button>
        <select class="select-input engine-lines-select" id="engine-lines-select" style="display:none">
            <option value="1">1 line</option>
            <option value="2">2 lines</option>
            <option value="3" selected>3 lines</option>
            <option value="4">4 lines</option>
            <option value="5">5 lines</option>
        </select>
    </div>
    <div class="engine-eval-bar" id="engine-eval-bar" style="display:none">
        <div class="engine-eval-bar-fill" id="engine-eval-bar-fill"></div>
    </div>
    <div class="engine-output" id="engine-output" style="display:none">
        <!-- Lines render here -->
    </div>
</div>
```

The lines dropdown and eval bar are hidden until the user clicks "Show Engine."

**Toggle behavior:**

Click "Show Engine":
1. If StockfishService is uninitialized, call `StockfishService.init()`. Show "Loading..." on the button (disabled).
2. Once ready, update button to "Hide Engine".
3. Show the lines dropdown and eval bar.
4. Show the engine output area.
5. Call `StockfishService.analyze(currentFen, { multiPV: selectedLineCount, onUpdate: renderLines })`.

Click "Hide Engine":
1. Call `StockfishService.stop()`.
2. Update button to "Show Engine".
3. Hide the lines dropdown, eval bar, and engine output.

Change lines dropdown:
1. If engine is currently running, call `StockfishService.analyze()` again with the new multiPV value.

**Rendering each analysis line:**

Each line in the engine output area looks like:

```html
<div class="engine-line">
    <span class="engine-line-score">+1.45</span>
    <span class="engine-line-depth">d15</span>
    <span class="engine-line-moves">Nxe5 dxe5 Bc4+ Ke8 Qh5 g6 Qxe5 Nf6 Qf4</span>
</div>
```

Formatting rules:
- Score: bold, colored (positive = green/white-favoring, negative = red/black-favoring, zero = neutral gray)
- Depth: small, muted text, format "d15"
- Moves: monospace or standard text. Show move numbers for readability: "1.Nxe5 dxe5 2.Bc4+ Ke8 3.Qh5 g6". Include as many moves as Stockfish provides — do NOT truncate. Let the line wrap naturally within the container.
- For mate scores: show "M3" or "-M2" in a distinct color (e.g., bright red for mate-against, bright green for mate-for)

**Eval bar:**

A vertical or horizontal bar showing the balance of the position:
- White advantage: white portion grows
- Black advantage: black portion grows
- Equal: 50/50 split
- Scale: map centipawns to percentage. Use a sigmoid-like mapping so extreme evals (±500cp+) don't pin the bar at 100%. Common formula: `whitePercent = 50 + 50 * (2 / (1 + Math.exp(-cp / 250)) - 1)`
- For mate: pin to 100% for the winning side
- Colors: white fills from bottom/left, dark fills from top/right. Use the app's existing color palette.
- Orientation: horizontal bar above the analysis lines, about 8px tall, full width of the engine panel

**`setPosition(fen)` behavior:**

If engine is currently ON (analyzing):
1. Call `StockfishService.analyze(newFen, ...)` — this automatically sends `stop` first
2. Clear the current display and show "Analyzing..." briefly until new results arrive

If engine is OFF:
1. Just store the FEN internally. Next time engine is toggled on, it uses this FEN.

## Where to mount the engine UI

The engine UI component is mounted in THREE places. Same component, same behavior, different containers.

### Place 1: Position detail page (both tabiyas and tactics)

Add a new div after the Notes Card and before the Actions Card:

```html
<!-- Engine Analysis (shared component) -->
<div id="detail-engine-container" class="card">
    <!-- EngineUI.mount('detail-engine-container') fills this -->
</div>
```

When `showDetail(id)` is called in positions.js:
- Call `EngineUI.mount('detail-engine-container')`
- Call `EngineUI.setPosition(pos.fen)`

When navigating away from detail view:
- Call `EngineUI.unmount()`

### Place 2: Game viewer

Add a new div after the move navigation buttons and before the panel:

```html
<div id="game-engine-container">
    <!-- EngineUI.mount('game-engine-container') fills this -->
</div>
```

When a game is loaded:
- Call `EngineUI.mount('game-engine-container')`
- Call `EngineUI.setPosition(currentFen)`

When the user navigates moves (arrow keys, clicking move list):
- Call `EngineUI.setPosition(newFen)` — this restarts analysis if engine is ON

When navigating away from game viewer:
- Call `EngineUI.unmount()`

### Place 3: Search page (for analyzing search results)

Not critical for this implementation. Can be added later. Skip for now.

## CSS

Add to `frontend/css/components.css`:

```css
.engine-panel {
    /* No extra styling needed — it's inside a card */
}

.engine-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
}

.engine-toggle {
    /* Uses existing .btn styles */
}

.engine-eval-bar {
    height: 8px;
    width: 100%;
    background: var(--text-primary, #1a1a1a);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
}

.engine-eval-bar-fill {
    height: 100%;
    background: #f0f0f0;
    width: 50%;
    transition: width 0.3s ease;
}

.engine-output {
    font-size: 13px;
    line-height: 1.6;
}

.engine-line {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 4px 0;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.engine-line:last-child {
    border-bottom: none;
}

.engine-line-score {
    font-weight: 700;
    min-width: 48px;
    text-align: right;
    font-family: 'SF Mono', 'Fira Code', monospace;
}

.engine-line-score.positive { color: #16a34a; }
.engine-line-score.negative { color: #dc2626; }
.engine-line-score.mate { color: #9333ea; }
.engine-line-score.neutral { color: var(--text-muted); }

.engine-line-depth {
    font-size: 11px;
    color: var(--text-muted);
    min-width: 28px;
}

.engine-line-moves {
    flex: 1;
    word-wrap: break-word;
}
```

## Script loading

Add to `index.html` at the bottom, BEFORE the closing `</body>` tag, AFTER chess.js:

```html
<script src="/js/stockfish-service.js"></script>
<script src="/js/engine-ui.js"></script>
```

Order matters: stockfish-service.js first (EngineUI depends on StockfishService).

## Wiring into existing code

### In `positions.js` — showDetail function:

After the board is created (`BoardManager.create('detail-board', pos.fen, ...)`), add:

```javascript
EngineUI.mount('detail-engine-container');
EngineUI.setPosition(pos.fen);
```

When navigating away from detail (e.g., when `showView` is called for a different view), add:

```javascript
EngineUI.unmount();
```

### In `game-viewer.js` — when a game is loaded and when moves are navigated:

On game load:
```javascript
EngineUI.mount('game-engine-container');
EngineUI.setPosition(currentFen);
```

On move navigation (wherever the board position updates after arrow key / click):
```javascript
EngineUI.setPosition(newFen);
```

On leaving game viewer:
```javascript
EngineUI.unmount();
```

### Finding the right hook points:

Read the existing code to find:
- In `positions.js`: the `showDetail()` function — add mount/setPosition at the end
- In `game-viewer.js`: the function that updates the board when stepping through moves — add setPosition there
- In `router.js` or wherever view transitions happen: add unmount when leaving detail or game viewer views

Do NOT guess at function names. Read the actual code, find the actual functions, wire in there.

## Route-change cleanup

**Centralized cleanup — do NOT rely on individual views remembering to unmount.**

Before ANY view switch (regardless of which view is being left), call `EngineUI.unmount()`. This is a single hook point in the routing logic, not scattered across individual view handlers.

Find the single place in `router.js` (or equivalent) where view transitions happen — the function that hides one view and shows another. Add `EngineUI.unmount()` at the TOP of that function, before any view switching logic. This guarantees cleanup regardless of which view is being left.

```javascript
// In the central view-switch function (find the actual function name by reading router.js):
function switchView(newView) {
    EngineUI.unmount();  // Always clean up engine before any view switch
    // ... existing view switch logic ...
}
```

Also add a page unload handler:

```javascript
window.addEventListener('beforeunload', () => {
    StockfishService.destroy();
});
```

## Testing

### Automated tests (parser only)

Create `frontend/test-stockfish-parser.html` — a standalone HTML page that loads chess.js and the parser functions, runs assertions, and displays results in the page. This page must be openable in a browser and show PASS/FAIL for each test.

The file must:
- Include a `<script>` tag loading chess.js from CDN
- Include the `parseInfoLine()` and `uciToSan()` functions (either inline or by loading stockfish-service.js)
- Run ALL the assertions below
- Display each test name + PASS or FAIL in the page body
- Display a summary: "X of Y tests passed"

Do NOT just log to console. Render results visually in the HTML page so the user can verify by opening the file.

Test cases:

```javascript
// Test 1: Parse a cp score line
const line1 = 'info depth 15 seldepth 20 multipv 1 score cp 145 nodes 524831 nps 1049662 time 500 pv e2e4 e7e5 g1f3 b8c6 f1b5';
const result1 = parseInfoLine(line1);
assert(result1.pv === 1);
assert(result1.depth === 15);
assert(result1.scoreCp === 145);
assert(result1.score === '+1.45');
assert(result1.isMate === false);

// Test 2: Parse a mate score line
const line2 = 'info depth 25 seldepth 10 multipv 1 score mate 3 nodes 100000 pv e2e4 e7e5 d1h5';
const result2 = parseInfoLine(line2);
assert(result2.isMate === true);
assert(result2.mateIn === 3);
assert(result2.score === 'M3');

// Test 3: Parse negative mate
const line3 = 'info depth 20 multipv 2 score mate -2 pv a1a2 b2b1q';
const result3 = parseInfoLine(line3);
assert(result3.score === '-M2');
assert(result3.mateIn === -2);

// Test 4: Ignore non-multipv info lines
const line4 = 'info string NNUE evaluation using nn-...';
const result4 = parseInfoLine(line4);
assert(result4 === null);

// Test 5: Ignore bestmove lines
const line5 = 'bestmove e2e4 ponder e7e5';
const result5 = parseInfoLine(line5);
assert(result5 === null);

// Test 6: UCI to SAN conversion
const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const sanMoves = uciToSan(fen, ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
assert(sanMoves[0] === 'e4');
assert(sanMoves[1] === 'e5');
assert(sanMoves[2] === 'Nf3');
assert(sanMoves[3] === 'Nc6');
```

### Manual browser verification (mandatory)

After implementation, verify all of these in the browser:

- [ ] Open a tabiya position. Click "Show Engine". Verify: button changes to "Hide Engine", eval bar appears, 3 lines of analysis appear with scores, depths, and move sequences in SAN notation.
- [ ] The analysis lines update in real time (getting deeper over ~5-10 seconds).
- [ ] Change the lines dropdown to 5. Verify 5 lines now show.
- [ ] Change to 1 line. Verify only 1 line shows.
- [ ] Click "Hide Engine". Analysis disappears. Button says "Show Engine" again.
- [ ] Open DevTools Performance tab. With engine hidden, CPU should be idle. With engine showing, CPU is active. After hiding, CPU returns to idle within 1 second.
- [ ] Open a tactic position. Same engine toggle works identically.
- [ ] Open a game in the game viewer. Engine toggle appears. Turn it on. Step through moves with arrow keys. Analysis restarts on each move (you see the lines reset and deepen again for the new position).
- [ ] Navigate away from a position or game. Come back. Engine is OFF by default (not running from previous visit).
- [ ] Eval bar reflects the score correctly: roughly centered for equal positions, skewed white for white advantage, skewed dark for black advantage. For a clear winning position (like being up a queen), the bar is nearly full.
- [ ] Move sequences show move numbers: "1.e4 e5 2.Nf3 Nc6 3.Bb5" — not just "e4 e5 Nf3 Nc6 Bb5".
- [ ] No console errors at any point during the above.

## Acceptance criteria

- [ ] `frontend/js/stockfish-service.js` exists and implements the service API exactly as specified
- [ ] `frontend/js/engine-ui.js` exists and implements the UI component exactly as specified
- [ ] Engine toggle works on position detail pages (both tabiyas and tactics)
- [ ] Engine toggle works in game viewer with live position tracking
- [ ] Multi-PV dropdown works (1-5 lines, default 3)
- [ ] Eval bar renders and updates correctly
- [ ] UCI-to-SAN conversion produces correct notation
- [ ] Move sequences include move numbers
- [ ] Engine stops when navigating away (verified via CPU usage)
- [ ] All automated parser tests pass
- [ ] All existing tests still pass
- [ ] Manual browser verification checklist above is fully completed

## Commit

```bash
git add -A
git commit -m "Stockfish integration: clean rebuild with service layer + UI component, multi-PV analysis"
```

## What is NOT in this spec

- Play-against-engine mode (Practice feature for tabiyas) — separate future work
- Engine analysis on the Search page — future
- Saving engine analysis to the database — not needed, the user just wants live analysis
- Auto-analysis (engine starts automatically) — always manual toggle
- Engine settings panel (hash size, threads, NNUE toggle) — defaults are fine
