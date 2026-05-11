# Phase 20: Core Functionality Fixes

**Goal**: Make the basic CRUD loop work end-to-end. No new features. Fix what's broken, verify it works.

**Read first**: `CLAUDE.md` for architecture rules and file limits.

---

## Bug 1: Save Position Broken (Critical)

### Problem

Clicking "Save Position" from the Add form (reached via "+ New Tabiya" or "+ New Tactic") silently fails to save with the correct `position_type`. The root cause is a chain of omissions:

1. `renderRoute` case `addPosition` (shared.js ~line 180) ignores the `type` param from the route, so the form has no idea whether the user clicked "+ New Tabiya" or "+ New Tactic".
2. `savePosition()` (positions.js ~line 112) never includes `position_type` in the POST body. The backend defaults to `tabiya`.
3. The backend (positions.py ~line 46) rejects puzzles without `solution_san`, but since `position_type` is never sent as `puzzle`, this validator never fires — the position just silently saves as a tabiya.
4. After saving, line 120 reads `position-type-select` to decide navigation — but that element doesn't exist in the HTML, so it always navigates to tabiyas.
5. The `editPosition()` function (positions.js ~line 220) also doesn't preserve `position_type` when loading a position into the edit form.

### Fix

#### Step 1: Store position type in form state

In `renderRoute` case `addPosition` (shared.js), read `params.type` and store it:

```js
case 'addPosition':
    _activateView('add', 'Add New');
    AppState.addPositionType = (route.params && route.params.type) || 'tabiya';
    document.getElementById('form-title').textContent =
        AppState.addPositionType === 'puzzle' ? 'New Tactic' : 'New Tabiya';
    BoardManager.setPosition('board', AppState.boardFen);
    break;
```

Add `addPositionType: 'tabiya'` to AppState in state.js.

#### Step 2: Include position_type in POST body

In `savePosition()` (positions.js ~line 112), add `position_type` to the body:

```js
const body = {
    fen,
    title: title || null,
    notes: notes || null,
    stockfish_analysis: sf || null,
    position_type: AppState.addPositionType || 'tabiya',
    tags
};
```

#### Step 3: Fix post-save navigation

Replace line 120-121:

```js
const viewToGo = AppState.addPositionType === 'puzzle' ? 'tactics' : 'tabiyas';
```

#### Step 4: Make solution_san optional for manual creation

In `backend/api/positions.py` ~line 46, remove or relax the `solution_san` requirement:

```python
# Remove this block:
# if data.position_type == PositionType.puzzle and not data.solution_san:
#     raise HTTPException(status_code=400, detail="Puzzles must have a solution")
```

Also remove the Pydantic validator in `schemas.py` ~line 34-39 that enforces the same rule.

Rationale: When manually adding tactics from the UI, you often don't have a single "solution" move — you're saving interesting positions. The solution field can remain optional and be filled in later via edit.

#### Step 5: Preserve position_type during edit

In `editPosition()` (positions.js ~line 220), after loading the position data, set `AppState.addPositionType`:

```js
AppState.addPositionType = pos.position_type || 'tabiya';
```

And in `clearForm()`, reset it:

```js
AppState.addPositionType = 'tabiya';
```

### Acceptance Criteria

1. Click "+ New Tabiya" → enter FEN → click Save → position appears in Tabiyas list
2. Click "+ New Tactic" → enter FEN → click Save → position appears in Tactics list
3. Open a tabiya detail → click Edit → change title → Save → still a tabiya, appears in Tabiyas
4. Open a tactic detail → click Edit → change title → Save → still a tactic, appears in Tactics
5. Form title says "New Tabiya" or "New Tactic" depending on entry point
6. After save, user is navigated to the correct list (tabiyas or tactics)

---

## Bug 2: Stockfish Analysis Not Working

### Problem

Clicking "Run Stockfish" in the Add form shows "Analyzing..." and "Thinking..." but never displays analysis lines.

Root cause: `initStockfish()` (stockfish.js) fetches Stockfish 10.0.2 from cdnjs as a blob and creates a Web Worker. This approach has two failure modes:
- The CDN URL may be stale or blocked
- The blob-to-Worker pattern can fail silently with CSP restrictions
- Stockfish.js 10.0.2 is ancient and has compatibility issues with modern browsers

The `onmessage` handler waits for `info depth` lines, then calls the backend `/chess/uci-to-san` endpoint to convert UCI to SAN before displaying. If the worker never sends messages, the UI stays stuck at "Analyzing...".

There is also a **separate** engine code path in `engine.js` (`toggleEngine` / `requestEval`) used by the detail view's "Show Engine" button. Both share `AppState.sfWorker` but have completely independent message handlers that overwrite each other via `AppState.sfWorker.onmessage = ...`.

### Fix

#### Step 1: Self-host Stockfish instead of CDN

Download the lite single-threaded Stockfish WASM build from npm (`stockfish` package, version 16 or 17 — not 18, which changed the API significantly). Place it in `frontend/vendor/`:

```
frontend/vendor/stockfish/stockfish-16-single.js
```

Use version 16 because:
- It still uses the classic Web Worker + UCI `postMessage` API that our code expects
- The lite single-threaded build is ~2MB, no CORS headers needed
- Version 18 changed to a module-based API that would require rewriting both engine.js and stockfish.js

To get the file: `npm pack stockfish@16.0.2`, extract, and copy the lite single-threaded JS file.

#### Step 2: Update initStockfish()

Replace the CDN fetch with a direct Worker from the self-hosted file:

```js
function initStockfish() {
    try {
        AppState.sfWorker = new Worker('/vendor/stockfish/stockfish-16-single.js');
        AppState.sfWorker.onmessage = e => {
            if (typeof e.data === 'string' && e.data.startsWith('uciok')) {
                console.log('Stockfish ready');
            }
        };
        AppState.sfWorker.postMessage('uci');
        console.log('Stockfish worker created');
    } catch (e) {
        console.error('Stockfish init failed:', e);
        const status = document.getElementById('sf-status');
        if (status) status.textContent = 'Engine unavailable';
    }
}
```

#### Step 3: Fix the onmessage conflict

Both `stockfish.js` (`runStockfish`) and `engine.js` (`_doEval`) overwrite `AppState.sfWorker.onmessage`. Whichever runs second kills the other's handler.

Fix: Use `addEventListener('message', ...)` instead of setting `.onmessage` directly. Each handler should check whether it's the intended recipient (the `_evalId` pattern in engine.js already does this; stockfish.js needs a similar guard).

In `stockfish.js`, add a flag:

```js
let _sfRunning = false;

function runStockfish() {
    // ... existing validation ...
    _sfRunning = true;
    const handler = (e) => {
        if (!_sfRunning) return;
        // ... existing info depth / bestmove handling ...
        if (l.startsWith('bestmove')) {
            _sfRunning = false;
        }
    };
    AppState.sfWorker.addEventListener('message', handler);
    // ... send UCI commands ...
}
```

In `engine.js` `_doEval`, similarly use `addEventListener` and remove the listener on completion or cancellation.

#### Step 4: Add error visibility

If Stockfish fails to load or respond, show a clear error instead of silently hanging:

```js
// In initStockfish, add a timeout:
setTimeout(() => {
    if (!AppState.sfWorker) {
        const status = document.getElementById('sf-status');
        if (status) status.textContent = 'Engine failed to load';
    }
}, 10000);
```

In `runStockfish()`, add a timeout for the analysis itself:

```js
const timeout = setTimeout(() => {
    if (_sfRunning) {
        _sfRunning = false;
        document.getElementById('sf-output').textContent = 'Engine not responding. Try reloading the page.';
        document.getElementById('sf-status').textContent = 'Error';
        document.getElementById('sf-btn').disabled = false;
    }
}, 15000);
```

### Acceptance Criteria

1. Open Add form → enter a valid FEN → click "Run Stockfish" → analysis lines appear within a few seconds showing depth, evaluation, and the best line in SAN notation
2. Analysis completes (reaches depth 20) → "Done" status shown → result auto-populated into the Stockfish Analysis textarea
3. On detail view → click "Show Engine" → live evaluation appears below the action buttons
4. Running Stockfish in the add form does NOT break the detail view engine toggle, and vice versa
5. If Stockfish fails to load, user sees "Engine unavailable" or "Engine failed to load" — not an infinite "Analyzing..."

---

## Verification Checklist

After both fixes, manually verify this complete flow:

- [ ] "+ New Tabiya" → paste FEN → Run Stockfish → see analysis → Save → appears in Tabiyas list
- [ ] "+ New Tactic" → paste FEN → Run Stockfish → see analysis → Save → appears in Tactics list
- [ ] Click a tabiya → see detail with notes, tags, stockfish analysis → "Show Engine" works → Edit → Save → still a tabiya
- [ ] Click a tactic → see detail → Edit → Save → still a tactic
- [ ] Delete a position from detail view → removed from list
- [ ] Backend tests pass: `cd backend && python -m pytest` (or equivalent)
- [ ] No JS console errors on any view

---

## Files to Modify

| File | Change |
|---|---|
| `frontend/js/state.js` | Add `addPositionType: 'tabiya'` to AppState |
| `frontend/js/shared.js` | `renderRoute` addPosition case: read type param, set form title |
| `frontend/js/positions.js` | `savePosition()`: include position_type. `editPosition()`: preserve type. `clearForm()`: reset type. Post-save nav: use AppState.addPositionType |
| `frontend/js/stockfish.js` | Replace CDN fetch with self-hosted Worker. Use addEventListener. Add timeout/error handling |
| `frontend/js/engine.js` | Switch from `.onmessage =` to `.addEventListener`. Guard against conflicts with stockfish.js |
| `backend/api/positions.py` | Remove solution_san requirement for puzzle creation |
| `backend/api/schemas.py` | Remove solution_san Pydantic validator |
| `frontend/vendor/stockfish/` | Add self-hosted stockfish-16-single.js |

## Files NOT to Modify

Everything else. No new features. No refactors. No UI changes beyond the form title text.
