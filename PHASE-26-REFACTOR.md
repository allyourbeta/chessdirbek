# Phase 26: Refactor and cleanup

**Goal**: One pass to get the project's housekeeping in order. Four categories of work:

1. **Split oversize files** (4 files over the 300-line limit).
2. **Fix CLAUDE.md** (stale tech stack description, stale bootstrapping reference).
3. **Standardize tests** (shared conftest.py, consistent patterns).
4. **Minor hygiene** (games.py barely over, easy trim).

No feature work. No UI changes. No behavioral changes. Every split is mechanical — move functions from one file to another, update imports/exports, verify everything still works.

**Read first**: `CLAUDE.md`

**Backup**: `./scripts/backup_now.sh` before starting.

---

## Execution order

1. **Part A**: Split `position-list.js` (355 → ~155 + ~200)
2. **Part B**: Split `practice-ui.js` (428 → ~190 + ~240)
3. **Part C**: Split `positions.py` (350 → ~190 + ~160)
4. **Part D**: Split `practice.py` (366 → ~200 + ~170)
5. **Part E**: Trim `games.py` (306 → under 300)
6. **Part F**: Fix CLAUDE.md
7. **Part G**: Standardize tests with conftest.py

Seven commits.

---

### Part A — Split `position-list.js` (355 lines)

Two completely distinct concerns: list management and featured-board management.

#### New file: `frontend/js/featured.js`

Move these functions out of `position-list.js` into a new `featured.js`:

```
loadRandomFeatured        (line ~174)
loadFeaturedById           (line ~200)
flipFeaturedBoard          (line ~227)
loadRandomFeaturedTabiya   (line ~231)
flipFeaturedTabiyaBoard    (line ~253)
loadFeaturedTabiyaById     (line ~257)
editFeaturedPosition       (line ~283)
deleteFeaturedPosition     (line ~291)
forkFeaturedPosition       (line ~320)
```

Plus all their `window.*` exports.

**What stays in `position-list.js`:**

```
loadPositions, loadTabiyas, loadTactics
mountPositionTagFilter, mountTabiyaTagFilter, mountTacticsTagFilter
showDetail
renderPositionsList, renderTabiyasList, renderTacticsList
deleteFromList
randomFromList
```

Plus their `window.*` exports.

#### Dependencies

`featured.js` calls these functions defined in `position-list.js`:
- `loadTactics`, `loadTabiyas` (in `deleteFeaturedPosition`)
- `renderTacticsList`, `renderTabiyasList` (in the `loadRandomFeatured*` and `loadFeaturedById*` functions — re-renders the list after changing the featured ID)
- `showDetail` (in the title onclick handler)

These are all `window.*` globals, so no import needed — just ensure `featured.js` is loaded AFTER `position-list.js` in `index.html`.

`featured.js` also reads/writes:
- `AppState.featuredTacticId`, `AppState.featuredTabiyaId` (defined in `state.js`)
- `AppState.allPositions` (populated by `loadTactics` / `loadTabiyas`)
- `BoardManager`, `EngineUI` (globals from other modules)
- `API` constant, `toast` function (globals)

All of these are window globals. No special wiring needed.

#### Update `frontend/index.html`

Add a new `<script>` tag for `featured.js` immediately AFTER the `position-list.js` tag:

```html
<script src="/js/position-list.js"></script>
<script src="/js/featured.js"></script>
```

#### Acceptance

- [ ] `wc -l frontend/js/position-list.js` is under 200.
- [ ] `wc -l frontend/js/featured.js` is under 220.
- [ ] Tactics page: featured board loads, Flip/Shuffle/Fork work, title clicks through to detail.
- [ ] Tabiyas page: same.
- [ ] Delete from featured board works.
- [ ] Fork from featured board works.
- [ ] Save a new position → featured-after-save works.
- [ ] No console errors.

Commit: `Split position-list.js: extract featured-board functions into featured.js`

---

### Part B — Split `practice-ui.js` (428 lines)

The file is a single IIFE (`const PracticeUI = (function() { ... })()`) that returns a public API object. Three distinct concerns:

1. **History rendering** (~190 lines): `formatResult`, `resultClass`, `showSaveModal`, `hideSaveModal`, `renderHistory`, `_renderStats`, `_renderRecent`, `_renderTree`, `renderPositionsList`, `populateLevelSelect`.
2. **Inline verdict editing** (~100 lines): `showInlineVerdictEdit`, `hideInlineVerdictEdit`, `saveInlineVerdict`.
3. **Delete with undo** (~140 lines): `showInlineDelete`, `cancelDelete`, `confirmDelete`, `showUndoNotification`, `undoDelete`.

Because this is an IIFE that returns a single `PracticeUI` object, the split has to preserve that pattern. The cleanest approach: extract groups 2 and 3 into a new file.

#### New file: `frontend/js/practice-ui-actions.js`

This file contains the inline verdict editing and delete-with-undo functions. It extends the existing `PracticeUI` object:

```js
// practice-ui-actions.js — inline verdict editing + delete-with-undo
// Extends PracticeUI (defined in practice-ui.js, loaded before this file).
(function(UI) {

    // === Inline verdict editing ===

    // Move showInlineVerdictEdit here (currently ~line 166)
    // Move hideInlineVerdictEdit here (currently ~line 226)
    // Move saveInlineVerdict here (currently ~line 233)

    UI.showInlineVerdictEdit = function(gameId, userColor) { ... };
    UI.hideInlineVerdictEdit = function() { ... };
    UI.saveInlineVerdict = async function(gameId, verdict) { ... };

    // === Delete with undo ===

    // Move showInlineDelete here (currently ~line 277)
    // Move cancelDelete here (currently ~line 305)
    // Move confirmDelete here (currently ~line 312)
    // Move showUndoNotification here (currently ~line 343)
    // Move undoDelete here (currently ~line 381)

    UI.showInlineDelete = function(gameId) { ... };
    UI.cancelDelete = function(gameId) { ... };
    UI.confirmDelete = async function(gameId) { ... };
    UI.showUndoNotification = function(gameId, rowHtml, rowIndex, listEl) { ... };
    UI.undoDelete = async function(gameId) { ... };

})(PracticeUI);
```

The pattern is: `practice-ui.js` defines `PracticeUI` via the IIFE with the history/rendering methods. `practice-ui-actions.js` takes that object and bolts on the action methods. Both files contribute to the same `PracticeUI` global.

#### What stays in `practice-ui.js`

The IIFE, but only containing the history/rendering/display functions and `populateLevelSelect`. The returned object includes only those methods. The IIFE still returns `PracticeUI` as a `const`.

#### Crucial detail: the return statement

The current IIFE ends with:
```js
return {
    showSaveModal, hideSaveModal, renderHistory,
    renderPositionsList, populateLevelSelect,
    showInlineVerdictEdit, hideInlineVerdictEdit, saveInlineVerdict,
    showInlineDelete, cancelDelete, confirmDelete,
    showUndoNotification, undoDelete
};
```

After the split, the IIFE only returns:
```js
return {
    showSaveModal, hideSaveModal, renderHistory,
    renderPositionsList, populateLevelSelect,
};
```

The action methods are added by `practice-ui-actions.js` via the extension pattern.

#### Update `frontend/index.html`

Add `practice-ui-actions.js` immediately AFTER `practice-ui.js`:

```html
<script src="/js/practice-ui.js"></script>
<script src="/js/practice-ui-actions.js"></script>
```

#### Acceptance

- [ ] `wc -l frontend/js/practice-ui.js` is under 200.
- [ ] `wc -l frontend/js/practice-ui-actions.js` is under 250.
- [ ] Practice history renders correctly (stats, recent games, opening tree).
- [ ] Click a verdict to edit it inline → save → updates correctly.
- [ ] Delete a practice game → undo notification appears → undo works.
- [ ] `PracticeUI` object has all methods (check in console: `Object.keys(PracticeUI)`).
- [ ] No console errors.

Commit: `Split practice-ui.js: extract verdict editing and delete actions`

---

### Part C — Split `positions.py` (350 lines)

CRUD endpoints vs. specialized/bulk endpoints.

#### New file: `backend/api/positions_extra.py`

Move these endpoints out of `positions.py`:

```python
@router.post("/bulk-reclassify", ...)      # line ~254
def bulk_reclassify(...)

@router.get("/{position_id}/navigation")   # line ~300
def get_puzzle_navigation(...)
```

Plus any imports they need (`BulkReclassifyRequest`, `BulkReclassifyResponse`, puzzle navigation schemas).

The new file creates its own `router = APIRouter(prefix="/positions", tags=["positions"])` — same prefix, same tags. Both routers get mounted in `main.py`.

#### Update `backend/main.py`

Add the new router:

```python
from backend.api.positions_extra import router as positions_extra_router
app.include_router(positions_extra_router)
```

#### What stays in `positions.py`

The core CRUD: `_get_or_create_tags`, `create_position`, `list_puzzles`, `list_tabiyas`, `list_positions`, `random_position`, `get_position`, `update_position`, `delete_position`.

#### Acceptance

- [ ] `wc -l backend/api/positions.py` is under 260.
- [ ] `wc -l backend/api/positions_extra.py` is under 120.
- [ ] `POST /api/positions/bulk-reclassify` still works.
- [ ] `GET /api/positions/{id}/navigation` still works.
- [ ] All existing position CRUD endpoints work.
- [ ] Tests pass: `python -m pytest tests/` (or `python tests/test.py` — whichever runner the project uses).

Commit: `Split positions.py: extract bulk-reclassify and puzzle navigation`

---

### Part D — Split `practice.py` (366 lines)

Session management vs. analytics/aggregation.

#### New file: `backend/api/practice_stats.py`

Move these endpoints and helpers:

```python
def _aggregate(games)                          # line ~33 (helper used by stats)
def _effective_verdict(pg)                     # line ~28 (helper used by _aggregate)

@router.get("/positions", ...)                 # line ~154
def list_practice_positions(...)

@router.get("/stats/{position_id}", ...)       # line ~189
def get_practice_stats(...)

@router.get("/tree/{position_id}", ...)        # line ~258
def get_practice_tree(...)

def _first_move_from_root(pgn_text, root_fen)  # line ~306 (helper used by tree)
```

New file creates its own `router = APIRouter(prefix="/practice", tags=["practice"])`.

#### Update `backend/main.py`

Add the new router:

```python
from backend.api.practice_stats import router as practice_stats_router
app.include_router(practice_stats_router)
```

#### What stays in `practice.py`

Session CRUD: `get_engine_levels`, `create_practice_game`, `list_practice_games`, `get_practice_game`, `update_practice_game`, `delete_practice_game`.

#### Acceptance

- [ ] `wc -l backend/api/practice.py` is under 200.
- [ ] `wc -l backend/api/practice_stats.py` is under 200.
- [ ] Practice stats, per-position summaries, and opening tree still load.
- [ ] Practice session CRUD still works.
- [ ] Tests pass.

Commit: `Split practice.py: extract stats, tree, and position summaries`

---

### Part E — Trim `games.py` (306 lines)

Only 6 lines over. Look for low-hanging fruit:

- Remove blank lines between tightly-related statements.
- Collapse single-use helper functions inline if they're short.
- Move any docstrings that are excessively verbose.

Do NOT split the file — it's not worth the churn for 6 lines. Just get it under 300.

If it can't be trimmed to under 300 without hurting readability, leave it and note in OBSERVATIONS.md. 6 lines over is not worth sacrificing clarity.

#### Acceptance

- [ ] `wc -l backend/api/games.py` is 300 or fewer, OR a note in OBSERVATIONS.md explains why it's not.
- [ ] No behavioral changes.
- [ ] Tests pass.

Commit: `Trim games.py to under 300 lines`

---

### Part F — Fix CLAUDE.md

Three stale sections need updating.

#### F1. Fix the tech stack

The Architecture section says:

```
React (browser)
  ├── Stockfish WASM (engine analysis, client-side)
  ├── react-chessboard (board rendering)
  └── calls → Python backend (FastAPI)
```

and the Tech Stack says:

```
- **Frontend**: React + TypeScript + react-chessboard
```

The frontend is NOT React. It's vanilla JS with cm-chessboard v8 via CDN. Replace both with:

Architecture:
```
Vanilla JS (browser)
  ├── Stockfish WASM (engine analysis, client-side)
  ├── cm-chessboard v8 (board rendering, via CDN)
  └── calls → Python backend (FastAPI)
                ├── python-chess (FEN validation, pawn structure search)
                └── SQLite via SQLAlchemy (persistence)
```

Tech Stack:
```
- **Frontend**: Vanilla JS + cm-chessboard v8 (CDN) + chess.js (move validation)
```

#### F2. Fix the bootstrapping description

The Frontend Architecture Notes section says:

> `board.js` — ES module that imports cm-chessboard v8 from CDN. Defines `BoardManager` (window global). Also bootstraps the app by calling `Router.init()` at the end of its execution.

This is stale. `main.js` now handles bootstrapping. Replace with:

> `board.js` — ES module that imports cm-chessboard v8 from CDN. Defines `BoardManager` (window global). Does NOT bootstrap the app — see `main.js`.
>
> `main.js` — ES module entrypoint. Imports `board.js`, creates default boards, runs setup functions (auto-load, keyboard save, URL params, puzzle shortcuts), then calls `Router.init()` to start the router. This is the single app entrypoint.

#### F3. Update test location reference

If CLAUDE.md mentions test file locations anywhere, update to reference `tests/` directory. Also add a brief note about the test runner:

```
## Tests

Tests live in `tests/`. Two patterns exist:
- Most test files use a custom `check()` harness — run with `python tests/test_<name>.py`.
- `test_name_service.py` uses pytest assertions — run with `python -m pytest tests/test_name_service.py`.

To run all tests: `python tests/test.py` (the master runner).
```

#### F4. Note the new files from this phase

Add `featured.js` and `practice-ui-actions.js` to any file listing or loading-order notes. Add `positions_extra.py` and `practice_stats.py` to the backend structure notes.

#### Acceptance

- [ ] Tech stack accurately says vanilla JS + cm-chessboard, not React.
- [ ] Bootstrapping description references `main.js`, not `board.js`.
- [ ] Test information is accurate.
- [ ] New files from this phase are documented.

Commit: `Fix stale CLAUDE.md: tech stack, bootstrapping, test location`

---

### Part G — Standardize tests with conftest.py

Every test file repeats the same boilerplate:

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["CHESSQUIZ_DB_URL"] = "sqlite:///:memory:"
from backend.main import app
from fastapi.testclient import TestClient
c = TestClient(app)
passed = 0
failed = 0
def check(name, condition, detail=""):
    ...
```

Extract the shared setup into `tests/conftest.py`.

#### G1. Create `tests/conftest.py`

```python
"""Shared test setup for Chessdirbek tests.

Sets up the test database (in-memory SQLite), provides a FastAPI
TestClient, and defines the check() assertion helper used by
the custom test harness.
"""

import os
import sys

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Use in-memory database for tests
os.environ["CHESSQUIZ_DB_URL"] = "sqlite:///:memory:"

from backend.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(app)


def check(name, condition, detail=""):
    """Custom assertion helper used by the test harness.

    Prints ✓/✗ and tracks pass/fail counts via the global
    variables `passed` and `failed` in the calling module.
    """
    import inspect
    frame = inspect.currentframe().f_back
    if condition:
        print(f"  ✓ {name}")
        frame.f_globals['passed'] = frame.f_globals.get('passed', 0) + 1
    else:
        print(f"  ✗ {name}  {detail}")
        frame.f_globals['failed'] = frame.f_globals.get('failed', 0) + 1
```

**Note on the `check` function**: The current pattern uses module-level `passed`/`failed` globals in each test file. The `conftest.py` version uses `inspect` to update the caller's globals. This preserves the existing behavior where each test file tracks its own counts. Verify this works by running one test file and checking the summary output.

If the `inspect` approach is too fragile, a simpler alternative: keep `check` in each file but just import `client` from conftest. That still eliminates the sys.path / env / TestClient boilerplate (~8 lines per file).

#### G2. Update each test file

For each test file in `tests/` (except `test_name_service.py` which already uses pytest):

Replace the boilerplate header:
```python
import sys, os
sys.path.insert(0, ...)
os.environ["CHESSQUIZ_DB_URL"] = ...
from backend.main import app
from fastapi.testclient import TestClient
c = TestClient(app)
passed = 0
failed = 0
def check(name, condition, detail=""):
    ...
```

With:
```python
from conftest import client as c, check

passed = 0
failed = 0
```

If a test file uses `client` instead of `c` as the variable name, adjust accordingly.

**Important**: Some test files import additional things from `backend` (models, schemas). Those imports stay — only the shared boilerplate moves to conftest.

#### G3. Verify `test_name_service.py` works with conftest

`test_name_service.py` uses pytest assertions and imports `client` directly. It should still work — `conftest.py` sets up the environment and exports `client`, which pytest auto-discovers. Verify it still runs with `python -m pytest tests/test_name_service.py`.

#### G4. Verify the custom test runner

`tests/test.py` is the master runner that imports and runs other test modules. After the refactor, verify:
```bash
python tests/test.py
```
Still runs all tests and reports pass/fail counts.

#### Acceptance

- [ ] `tests/conftest.py` exists with shared setup.
- [ ] No test file has the sys.path / env var / TestClient boilerplate (except conftest).
- [ ] `python tests/test.py` passes (master runner).
- [ ] `python tests/test_practice.py` passes (individual file).
- [ ] `python -m pytest tests/test_name_service.py` passes (pytest file).
- [ ] Test output format unchanged (✓/✗ with counts).

Commit: `Standardize tests: extract shared setup into conftest.py`

---

## File-size verification

After all parts, run:
```bash
echo "=== Frontend JS ===" && wc -l frontend/js/*.js | sort -rn | head -15
echo "=== Backend Python ===" && find backend -name "*.py" -not -path "*__pycache__*" | xargs wc -l | sort -rn | head -15
```

Every file should be under 300 lines. The only exceptions are files explicitly noted in OBSERVATIONS.md with justification.

## What NOT to do

- No feature work. No UI changes. No behavioral changes.
- Don't rename functions. Don't change function signatures.
- Don't refactor the four `load*Featured*` functions into one parametrized function. That's a design change, not a mechanical split.
- Don't convert the custom `check()` test harness to pytest. That's a migration project, not a cleanup pass. Just centralize the shared setup.
- Don't change `index.html` script order beyond adding the new script tags in the correct position.
- Don't touch `board.js`, `main.js`, `state.js`, or `router.js`.

## Commit strategy

Seven commits:
1. `Split position-list.js: extract featured-board functions into featured.js`
2. `Split practice-ui.js: extract verdict editing and delete actions`
3. `Split positions.py: extract bulk-reclassify and puzzle navigation`
4. `Split practice.py: extract stats, tree, and position summaries`
5. `Trim games.py to under 300 lines`
6. `Fix stale CLAUDE.md: tech stack, bootstrapping, test location`
7. `Standardize tests: extract shared setup into conftest.py`

## Final verification

- [ ] Every JS file under 300 lines.
- [ ] Every Python file under 300 lines (or justified in OBSERVATIONS.md).
- [ ] All tests pass.
- [ ] All pages render correctly — Tactics, Tabiyas, Games, Search, Detail, Add/Edit, Practice, Board Editor.
- [ ] No console errors on any page.
- [ ] CLAUDE.md accurately describes the current tech stack, bootstrapping, and test setup.
- [ ] `git log --oneline -7` shows the seven expected commits.
