# Phase 21: Project Cleanup + Inline Add Buttons + Auto-Generated Names

**Goal**: Bundle three feature improvements with mechanical project-structure cleanup that's been deferred. Five parts, executed in order, each independently testable and committable.

**Features:**
1. Add a `+ New Tactic` button on the Tactics page and `+ New Tabiya` on the Tabiyas page, so users don't have to reach the header dropdown.
2. After saving a position, return to the list view with that position prominently featured (tactics) or focused (tabiyas).
3. When a position is saved without a title, auto-generate a friendly two-word placeholder name (e.g. `swift-otter`) so list rows are always distinguishable instead of a sea of "Untitled".

**Cleanup:**
4. Move stale spec/handoff `.md` files from the project root into `docs/archive/`.
5. Move root-level `test_*.py` files into a `tests/` directory and delete confirmed duplicates.

**Read first**: `CLAUDE.md` for architecture rules and file limits.

**Files NOT to modify** anywhere in this phase:
- The header `+ New ▾` dropdown — leave it alone.
- Backend SQLAlchemy models — `title` is already nullable, no schema migration needed.
- `practice-ui.js` (428 lines, over limit) — needs a real refactor pass, not mid-feature work.
- `practice.py` (366 lines, over limit) — same reason.
- `positions.py` (346 lines, over limit) — we ARE editing this file for Part A, but only making minimal additions (~5 lines). Don't expand it further; the split is a separate phase.

**Backup before starting:** Per CLAUDE.md, run `scripts/backup_now.sh` before beginning. This phase doesn't touch the DB schema, but the cleanup phases move files and the API changes affect title handling — a backup is cheap insurance.

---

## Decisions already made (don't re-litigate)

- **Order**: cleanup phases (Parts D and E) run FIRST so new tests land in the right place. Then feature phases (A, B, C).
- **Button placement**: inline in the existing list-header row, next to the `<h2>` heading. Primary style, small. Mirrors for both Tactics and Tabiyas.
- **State carrier for "feature this newly-saved one"**: URL param `?featured=<id>` on tactics, `?focus=<id>` on tabiyas. Survives hard refresh, back/forward, PWA cold start.
- **Back-button semantics**: post-save navigation uses `Router.navigate(..., { replace: true })` so the add-form doesn't pollute history.
- **Featured/focus param is one-shot**: it controls the *initial* render after save. After consuming it, the URL is cleaned via `Router.syncUrl()` so back-from-detail returns to a clean `/tactics` (fresh random featured).
- **Name generation lives on the backend** in a new pure-function service module. Frontend sends `title: null` (or empty); backend generates if missing.
- **Two-word names**, adjective-noun, hyphenated. ~165×140 word list. No collision checking.
- **Apply to both creates and edits**: if `title` is null/empty after an edit, regenerate.
- **Apply to both tactics and tabiyas**: same logic.

---

## Execution order

1. **Part D**: Move tests into `tests/` and delete stale duplicates (do first so new tests in Part A land in the right place).
2. **Part E**: Archive stale spec/handoff docs (independent of feature work).
3. **Part A**: Backend auto-name generation.
4. **Part B**: Inline `+ New` buttons.
5. **Part C**: Featured-after-save with replace navigation.

Commit after each part. Five small commits, easier to revert any one independently.

---

### Part D — Move tests into `tests/`

The project root currently has 12 `test_*.py` files scattered alongside source code, plus `__pycache__/`. This is a maintenance smell; pytest works much more reliably with a single `tests/` directory.

#### D1. Investigate the duplicate practice test files

Three files exist:
- `test_practice.py` (427 lines) — current
- `test_practice_backup.py` (426 lines) — older, missing the `{games: [...]}` response shape handling
- `test_practice_fixed.py` (427 lines) — older still

Verify by running:
```bash
diff test_practice.py test_practice_backup.py | head -30
diff test_practice.py test_practice_fixed.py | head -30
```

The differences should be small (response-shape handling). Confirm that `test_practice.py` is the most current version, then delete the other two:
```bash
git rm test_practice_backup.py test_practice_fixed.py
```

If for any reason the diff suggests `_fixed.py` is actually newer, STOP and ask.

#### D2. Investigate `fix_test.py`

This is a one-off script:
```python
import re
with open('test_practice.py', 'r') as f:
    content = f.read()
# ... (it modifies test_practice.py in place)
```

It was used once to migrate test_practice.py to a new response shape. Delete it:
```bash
git rm fix_test.py
```

#### D3. Move remaining tests into `tests/`

```bash
mkdir -p tests
git mv test.py tests/
git mv test_db_config.py tests/
git mv test_game_api.py tests/
git mv test_games.py tests/
git mv test_orientation.py tests/
git mv test_position_types.py tests/
git mv test_practice.py tests/
git mv test_puzzle_navigation.py tests/
touch tests/__init__.py
git add tests/__init__.py
```

#### D4. Move `cleanup_test_data.py` to `scripts/`

It's a one-time DB cleanup utility. The `scripts/` directory already exists for ops scripts:
```bash
git mv cleanup_test_data.py scripts/
```

#### D5. Delete root `__pycache__`

```bash
rm -rf __pycache__
```

Ensure `.gitignore` already contains `__pycache__/` (it should). If not, add it.

#### D6. Verify tests still pass

Tests may have hardcoded relative paths or imports. From the project root:
```bash
python -m pytest tests/ -x
```

If anything breaks because of relative imports (e.g. `from backend.api import ...`), fix the imports — pytest run from the root with a `tests/` directory and the `backend/` package alongside should Just Work, but some tests may have older patterns.

For tests that use `subprocess` or `httpx` against a running server URL, no changes needed.

#### D7. Update any test-runner references

Check `test.py` (the master runner, if it imports other test modules) — update imports if needed.

Check `run.sh` for any test-running invocations.

Check `CLAUDE.md` — if it references test file locations, update those references.

#### D8. Acceptance for Part D

- [ ] No `test_*.py` files remain in the project root.
- [ ] `tests/` directory exists with: `__init__.py`, `test.py`, `test_db_config.py`, `test_game_api.py`, `test_games.py`, `test_orientation.py`, `test_position_types.py`, `test_practice.py`, `test_puzzle_navigation.py`.
- [ ] `test_practice_backup.py`, `test_practice_fixed.py`, `fix_test.py` no longer exist.
- [ ] `cleanup_test_data.py` is in `scripts/`.
- [ ] `__pycache__` is gone from root.
- [ ] `python -m pytest tests/` runs and the previously-passing tests still pass.
- [ ] Single commit: "Move tests into tests/, delete stale duplicates".

---

### Part E — Archive stale spec/handoff docs

The project root has 30+ `.md` files. Most are completed-phase specs or stale handoffs. Move them out of the way so the root only shows active work.

#### E1. Create archive directory

```bash
mkdir -p docs/archive
```

#### E2. Move completed-phase and handoff docs

These are the files to move (verified as historical context, not active work):

```bash
git mv BOARD-EDITOR-FIX-SPEC.md docs/archive/
git mv BOOTSTRAP-REFACTOR-DIFFS.md docs/archive/
git mv GLOBAL-FEN-ANNOTATIONS-SPEC.md docs/archive/
git mv HOMEPAGE-EXACT-DIFFS.md docs/archive/
git mv HOMEPAGE-FIX-SPEC.md docs/archive/
git mv IMAGE-SCANNER-SPEC.md docs/archive/
git mv LICHESS-IMPORT-FIX-SPEC.md docs/archive/
git mv MODAL_AUDIT.md docs/archive/
git mv NAV-LANDING-TAGS-SPEC.md docs/archive/
git mv PHASE-16-DATA-SAFETY.md docs/archive/
git mv PHASE-18-PUZZLE-UI-SPEC.md docs/archive/
git mv PHASE-19-RESET-SPEC.md docs/archive/
git mv PHASE-20-CORE-FIXES.md docs/archive/
git mv QUICK-PATCH-SPEC.md docs/archive/
git mv SCRIPT-BOOTSTRAP-REFACTOR-SPEC.md docs/archive/
git mv STOCKFISH-REBUILD-SPEC.md docs/archive/
git mv STOCKFISH_REBUILD_SPEC_CLEAN.md docs/archive/
git mv THREE-QUICK-FIXES.md docs/archive/
git mv UI-LAYOUT-REDESIGN-SPEC.md docs/archive/
git mv UI-POLISH-SPEC.md docs/archive/
git mv UI-REFINEMENTS-SPEC.md docs/archive/
git mv board_editor_analysis_handoff.md docs/archive/
git mv board_editor_exact_signature_bug_handoff.md docs/archive/
git mv board_editor_input_failure_handoff.md docs/archive/
git mv chessquiz-ui-cleanup-spec-v2.md docs/archive/
git mv claude-code-prompt.md docs/archive/
git mv next_fix.md docs/archive/
git mv stock_spec.md docs/archive/
```

#### E3. Files to KEEP at root

These are active reference docs, not historical:

- `CLAUDE.md` — project governance, read first by every agent session
- `README.md` — public entry point
- `ROADMAP.md` — forward-looking, not historical
- `DESIGN.md` — the canonical design doc (72KB — large but living)
- `SPEC-v2.md` — current spec (60KB)
- `GOING_PUBLIC.md` — future-facing
- `BOOKMARKLET.md` — user-facing how-to
- `PUZZLE-VS-TABIYA-DESIGN.md` — current design reference
- `REPERTOIRE-SYSTEM-SPEC.md` — forward-looking, not yet built

If any of these turn out to also be stale on inspection, leave them alone — out of scope.

#### E4. Update README to point at CLAUDE.md

The current README is a stub template. Replace with:

```markdown
# ChessQuiz

Personal chess position quiz app. Save positions (FEN), annotate them with notes and Stockfish analysis, tag them, and quiz yourself.

## Quick start

```bash
pip install -r requirements.txt
./run.sh
```

Then open http://localhost:8000.

## Documentation

- **Architecture and conventions**: [`CLAUDE.md`](CLAUDE.md)
- **Roadmap**: [`ROADMAP.md`](ROADMAP.md)
- **Detailed design**: [`DESIGN.md`](DESIGN.md), [`SPEC-v2.md`](SPEC-v2.md)
- **Going public plan**: [`GOING_PUBLIC.md`](GOING_PUBLIC.md)
- **Historical specs**: [`docs/archive/`](docs/archive/)

## Backups

Automated nightly backups via launchd. See `scripts/backup_database.sh` and the section on backups in `CLAUDE.md`.

Before any destructive operation:
```bash
./scripts/backup_now.sh
```

## Tests

```bash
python -m pytest tests/
```

## License

MIT — see [`LICENSE`](LICENSE).
```

#### E5. Acceptance for Part E

- [ ] Project root has fewer than 12 `.md` files (down from 30+).
- [ ] `docs/archive/` contains the moved historical specs and handoffs.
- [ ] `README.md` is no longer a stub — it points at the real docs.
- [ ] `git status` shows the moves as renames (`R`), not delete+add.
- [ ] Single commit: "Archive stale specs and handoffs into docs/archive".

---

### Part A — Auto-generated names (backend, no UI changes)

#### A1. Create `backend/services/name_service.py`

A pure-function service module. No FastAPI imports. No DB imports. Per the architecture rules in CLAUDE.md (services are pure functions), this just exports `generate_placeholder_name() -> str`.

```python
"""Friendly two-word placeholder names for untitled positions.

Pure module: no I/O, no DB, no framework imports. Returns a hyphenated
adjective-noun string like 'swift-otter' or 'brave-cottage'.

Used by the positions API when a position is created or edited with no
title. Collisions are not checked — these are placeholder labels, not
identifiers (FEN + position_type is the real identity).
"""

import random

_ADJECTIVES = [
    "swift", "brave", "calm", "bright", "quiet", "bold", "gentle", "fierce",
    "kind", "wise", "merry", "lucky", "noble", "humble", "eager", "happy",
    "clever", "graceful", "patient", "loyal", "curious", "honest", "jolly",
    "mighty", "nimble", "polite", "quick", "rare", "smooth", "tender",
    "vivid", "warm", "young", "ancient", "amber", "azure", "crimson",
    "emerald", "golden", "silver", "scarlet", "violet", "indigo", "ivory",
    "jade", "ruby", "alpine", "arctic", "atlantic", "boreal", "coastal",
    "desert", "forest", "highland", "island", "lunar", "meadow", "mountain",
    "ocean", "pacific", "prairie", "river", "solar", "stellar", "sunset",
    "tropical", "tundra", "valley", "wandering", "winter", "summer",
    "autumn", "spring", "morning", "evening", "midnight", "twilight",
    "bouncing", "dancing", "drifting", "floating", "glowing", "humming",
    "jumping", "leaping", "running", "shining", "singing", "soaring",
    "sparkling", "spinning", "wandering", "whirling", "blue", "green",
    "orange", "purple", "red", "yellow", "agile", "alert", "candid",
    "cosmic", "daring", "dapper", "dashing", "delicate", "dreamy",
    "earnest", "easy", "elegant", "fancy", "festive", "fluffy", "fresh",
    "friendly", "fuzzy", "gallant", "giddy", "glad", "gleaming", "gracious",
    "grand", "groovy", "hardy", "harmonious", "helpful", "hopeful", "icy",
    "jovial", "joyful", "lively", "lucid", "luminous", "mellow", "modest",
    "mystic", "novel", "perky", "pleasant", "plucky", "proud", "radiant",
    "regal", "savvy", "serene", "sincere", "snappy", "spirited", "splendid",
    "steady", "stout", "sturdy", "subtle", "sunny", "swift", "tactful",
    "tame", "tidy", "tireless", "tranquil", "trusty", "valiant", "vibrant",
    "vigilant", "vivid", "watchful", "whimsical", "willing", "witty",
    "zealous", "zesty",
]

_NOUNS = [
    "otter", "fox", "wolf", "bear", "lynx", "owl", "hawk", "falcon",
    "eagle", "raven", "robin", "sparrow", "swan", "heron", "crane",
    "puffin", "dolphin", "whale", "seal", "salmon", "trout", "badger",
    "beaver", "rabbit", "hare", "deer", "elk", "moose", "panda", "koala",
    "tiger", "leopard", "cheetah", "jaguar", "panther", "puma", "cougar",
    "horse", "pony", "stallion", "zebra", "antelope", "gazelle", "ibex",
    "ram", "buffalo", "bison", "yak", "camel", "lemur", "monkey", "gibbon",
    "cottage", "cabin", "tower", "castle", "lighthouse", "harbor", "bridge",
    "garden", "orchard", "meadow", "forest", "grove", "thicket", "glade",
    "valley", "canyon", "ridge", "summit", "peak", "plateau", "highland",
    "lowland", "marsh", "lagoon", "bay", "cove", "fjord", "delta",
    "island", "isle", "cape", "shore", "cliff", "beach", "dune", "oasis",
    "spring", "creek", "river", "stream", "brook", "pond", "lake", "sea",
    "ocean", "waterfall", "cascade", "rapids", "fountain", "geyser",
    "comet", "nebula", "galaxy", "planet", "star", "moon", "sun", "aurora",
    "horizon", "dawn", "dusk", "twilight", "sunrise", "sunset", "rainbow",
    "cloud", "mist", "fog", "breeze", "gale", "storm", "tempest", "drizzle",
    "rain", "snow", "frost", "ember", "spark", "flame", "candle", "lantern",
    "beacon", "compass", "lighthouse", "anchor", "sail", "rudder", "mast",
    "harp", "lyre", "flute", "drum", "fiddle", "piano", "violin", "horn",
    "willow", "oak", "pine", "cedar", "maple", "birch", "elm", "fern",
    "moss", "lichen", "ivy", "vine", "rose", "lily", "iris", "daisy",
    "tulip", "violet", "orchid", "poppy", "thistle", "clover", "heather",
    "lavender", "jasmine", "magnolia", "wisteria", "primrose", "honeysuckle",
]


def generate_placeholder_name() -> str:
    """Return a hyphenated adjective-noun pair.

    Example: 'swift-otter', 'brave-cottage', 'amber-sparrow'.
    """
    return f"{random.choice(_ADJECTIVES)}-{random.choice(_NOUNS)}"
```

#### A2. Export from `backend/services/__init__.py`

Add `generate_placeholder_name` to the existing exports alongside `validate_fen` etc.

#### A3. Hook into `backend/api/positions.py`

In `create_position` (~line 39), after FEN validation and before the `Position(...)` construction, normalize the title:

```python
# Auto-generate a friendly placeholder name if title is missing/blank.
# Placeholders aren't unique identifiers — collisions are fine.
title = (data.title or "").strip() or generate_placeholder_name()
```

Then pass `title=title` (not `title=data.title`) into the `Position(...)` constructor.

In `update_position` (~line 198), replace this block:
```python
if data.title is not None:
    position.title = data.title
```
with:
```python
if data.title is not None:
    position.title = data.title.strip() or generate_placeholder_name()
```

Rationale: in the edit flow, `data.title is not None` means the user explicitly sent a title field. If they cleared it (sent `""`), regenerate rather than save empty. If they didn't touch the field at all, the existing title is preserved (the `is not None` guard handles that).

Add `from backend.services import generate_placeholder_name` to the imports at the top.

#### A4. Backend test

Add `tests/test_name_service.py` (Part D establishes the `tests/` directory):

```python
from backend.services import generate_placeholder_name


def test_name_format():
    name = generate_placeholder_name()
    assert "-" in name
    parts = name.split("-")
    assert len(parts) == 2
    assert all(part.isalpha() and part.islower() for part in parts)


def test_names_vary():
    """Verify the generator produces a reasonable spread, not the same name twice."""
    names = {generate_placeholder_name() for _ in range(50)}
    # ~40,000 combos, 50 draws should be well above 30 unique
    assert len(names) > 30
```

Add an integration test too — POSTing a position with `title: null` should return a position with a non-empty title:

```python
def test_create_position_generates_title_if_missing(client):
    res = client.post("/api/positions/", json={
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "title": None,
        "tags": [],
    })
    assert res.status_code == 201
    body = res.json()
    assert body["title"]
    assert "-" in body["title"]


def test_create_position_keeps_provided_title(client):
    res = client.post("/api/positions/", json={
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "title": "Lucena Position",
        "tags": [],
    })
    assert res.status_code == 201
    assert res.json()["title"] == "Lucena Position"


def test_update_empty_title_regenerates(client):
    # Create with a real title
    res = client.post("/api/positions/", json={
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "title": "Real Title",
        "tags": [],
    })
    pid = res.json()["id"]
    # Edit to clear title
    res = client.put(f"/api/positions/{pid}", json={"title": "   "})
    assert res.status_code == 200
    assert res.json()["title"] != "Real Title"
    assert "-" in res.json()["title"]
```

#### A5. Acceptance for Part A

- [ ] `python -m pytest tests/test_name_service.py` passes.
- [ ] Manually POST `{"fen": "...", "title": null}` via `/docs` — response has a hyphenated two-word title.
- [ ] Manually POST `{"fen": "...", "title": "Lucena Position"}` — title preserved verbatim.
- [ ] PUT a position with `{"title": ""}` — response has a fresh generated name.
- [ ] No frontend changes yet; existing UI still works.

---

### Part B — Inline `+ New` buttons on Tactics and Tabiyas pages

#### B1. Markup change in `frontend/index.html`

**Tactics page** (~line 72 of `index.html`, inside `.tactics-browse`):

Current:
```html
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
  <h2 style="font-size:32px;font-weight:700;color:var(--text);letter-spacing:-0.02em">Tactics</h2>
  <div id="tactics-tag-filters" class="tag-row"></div>
</div>
```

New:
```html
<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
  <h2 style="font-size:32px;font-weight:700;color:var(--text);letter-spacing:-0.02em;margin:0">Tactics</h2>
  <button class="btn btn-sm btn-primary" onclick="Router.navigate({view:'addPosition', params:{type:'puzzle'}})">+ New Tactic</button>
  <div id="tactics-tag-filters" class="tag-row" style="margin-left:auto"></div>
</div>
```

Note the layout shift: the heading + button cluster on the left, tag filters pushed to the right with `margin-left:auto`. `flex-wrap:wrap` keeps it sane on narrow viewports (this matters for PWA / mobile).

**Tabiyas page** (~line 46 of `index.html`, inside `view-tabiyas`):

Current:
```html
<div class="list-header">
  <div class="list-header-top">
    <h2>Tabiyas</h2>
    <button class="btn btn-sm" onclick="randomFromList('tabiya')">Shuffle</button>
  </div>
  <div class="list-header-bar">
    <div id="tabiyas-tag-filters" class="tag-row"></div>
  </div>
</div>
```

New:
```html
<div class="list-header">
  <div class="list-header-top">
    <h2>Tabiyas</h2>
    <button class="btn btn-sm btn-primary" onclick="Router.navigate({view:'addPosition', params:{type:'tabiya'}})">+ New Tabiya</button>
    <button class="btn btn-sm" onclick="randomFromList('tabiya')">Shuffle</button>
  </div>
  <div class="list-header-bar">
    <div id="tabiyas-tag-filters" class="tag-row"></div>
  </div>
</div>
```

The `+ New Tabiya` button sits between the heading and Shuffle — primary-styled so it reads as the canonical add action.

#### B2. Acceptance for Part B

- [ ] Tactics page shows `+ New Tactic` button next to the Tactics heading.
- [ ] Tabiyas page shows `+ New Tabiya` button next to the Tabiyas heading.
- [ ] Clicking either button navigates to the add form with the correct `position_type` (verify the form title says "New Tactic" or "New Tabiya").
- [ ] Header `+ New ▾` dropdown still works (unchanged).
- [ ] On narrow viewports (resize to ~400px wide), the button row wraps gracefully rather than overflowing.

---

### Part C — Featured-after-save with replace navigation

This is the most subtle part. Read carefully.

#### C1. Update `savePosition()` in `frontend/js/position-form.js` (~line 12)

Currently the function does:
```js
if (res.ok) {
    toast(editId ? 'Position updated!' : 'Position saved!');
    clearForm();
    const viewToGo = savedType === 'puzzle' ? 'tactics' : 'tabiyas';
    Router.navigate({ view: viewToGo });
}
```

Change to:
```js
if (res.ok) {
    const saved = await res.json();
    toast(editId ? 'Position updated!' : 'Position saved!');
    clearForm();
    if (savedType === 'puzzle') {
        Router.navigate(
            { view: 'tactics', params: { featured: saved.id } },
            { replace: true }
        );
    } else {
        Router.navigate(
            { view: 'tabiyas', params: { focus: saved.id } },
            { replace: true }
        );
    }
}
```

Two changes here:
1. Read the response JSON to get the saved position's ID. (Currently the response is discarded.)
2. Pass `{ replace: true }` to `Router.navigate` so the add-form view is removed from history. The router already supports this — see `router.js` line ~126.

#### C2. Update tactics view to consume `featured` param

In `frontend/js/shared.js`, the `case 'tactics':` block currently looks like:
```js
case 'tactics':
    _applyPositionFilters(params);
    _activateView('tactics', 'Tactics');
    mountTacticsTagFilter();
    loadTactics().then(function() { loadRandomFeatured(); });
    break;
```

Change to:
```js
case 'tactics':
    _applyPositionFilters(params);
    _activateView('tactics', 'Tactics');
    mountTacticsTagFilter();
    loadTactics().then(function() {
        var featuredId = params.featured ? parseInt(params.featured, 10) : null;
        if (featuredId && !isNaN(featuredId)) {
            loadFeaturedById(featuredId);
        } else {
            loadRandomFeatured();
        }
    });
    break;
```

#### C3. Add `loadFeaturedById` to `frontend/js/position-list.js`

Adjacent to the existing `loadRandomFeatured` (~line 156). It's a near-clone — keep the duplication for now, refactor later:

```js
function loadFeaturedById(id) {
    var pos = AppState.allPositions.find(function(p) {
        return p.id === id && p.position_type === 'puzzle';
    });
    if (!pos) {
        // Fall back to random if the requested position isn't in the list
        // (e.g. tag filter excludes it, or it was deleted between save and render)
        loadRandomFeatured();
        return;
    }
    AppState.featuredTacticId = pos.id;
    BoardManager.create('tactics-featured-board', pos.fen, {
        flipped: pos.orientation === 'black',
    });
    EngineUI.mount('tactics-featured-engine');
    EngineUI.setPosition(pos.fen);
    document.getElementById('tactics-featured-title').textContent = pos.title || 'Untitled';
    document.getElementById('tactics-featured-tags').innerHTML =
        pos.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tactics-featured-title').onclick = function() {
        showDetail(pos.id);
    };
    document.getElementById('tactics-featured-title').style.cursor = 'pointer';
}
window.loadFeaturedById = loadFeaturedById;
```

(Mirror `loadRandomFeatured` exactly; just pick by ID instead of randomly.)

#### C4. Tabiyas "focus" handling

Tabiyas has no featured board, but we can scroll the matching list row into view and briefly highlight it. In `frontend/js/shared.js`, the `case 'tabiyas':` block becomes:

```js
case 'tabiyas':
    _applyPositionFilters(params);
    _activateView('tabiyas', 'Tabiyas');
    mountTabiyaTagFilter();
    loadTabiyas().then(function() {
        var focusId = params.focus ? parseInt(params.focus, 10) : null;
        if (focusId && !isNaN(focusId)) {
            focusTabiyaRow(focusId);
        }
    });
    break;
```

`loadTabiyas` currently doesn't return a promise — check `position-list.js` and add `return` if needed so the `.then(...)` works.

Add `focusTabiyaRow` to `position-list.js`:

```js
function focusTabiyaRow(id) {
    var row = document.querySelector('#tabiyas-list .pos-item[data-pos-id="' + id + '"]');
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('row-highlight');
    setTimeout(function() { row.classList.remove('row-highlight'); }, 1500);
}
window.focusTabiyaRow = focusTabiyaRow;
```

For this selector to work, `renderTabiyasList` needs to put `data-pos-id="${p.id}"` on each `.pos-item`. Update both `renderTabiyasList` and `renderTacticsList` (in `position-list.js`) to add `data-pos-id="${p.id}"` to the outer `<div class="pos-item" ...>` — useful for both this feature and future selector-based work.

Add to `frontend/css/components.css` (or wherever list styles live — grep `.pos-item` to find it):

```css
.pos-item.row-highlight {
    background: var(--accent-050, rgba(74, 144, 217, 0.12));
    transition: background 1.2s ease-out;
}
```

If `--accent-050` isn't defined, use a literal `rgba(74, 144, 217, 0.12)` — that's the existing theme color. Check `style.css` for what's defined and pick the closest existing token.

#### C5. URL param does NOT persist in onward navigation

This is the "back returns to fresh random" semantic.

The `?featured` param is only respected on the *first* render. After that, any internal navigation away from the tactics page should produce a clean URL.

Concretely: after the post-save replace-navigate, the URL is `/tactics?featured=42`. The user might:
- Click a tactic row → `showDetail(42)` → navigates to `/tactics/42`. ✓ Clean.
- Hit Back from the detail → browser sends them to `/tactics?featured=42` again. **This is the edge case to watch.**

Two options for that edge case:

(a) Accept the behavior: hitting Back from detail re-features 42. Not the worst — it's the URL they were on.

(b) After consuming the `featured` param on initial render, call `Router.syncUrl({ view: 'tactics', params: {} })` to clean the URL. Then back from detail goes to clean `/tactics` → fresh random.

I recommend (b) — it matches the "fresh random after the moment is over" semantic Ashish chose. Implementation:

In the `case 'tactics':` block, after the `.then(...)` completes successfully with a `featured` param consumed:

```js
case 'tactics':
    _applyPositionFilters(params);
    _activateView('tactics', 'Tactics');
    mountTacticsTagFilter();
    loadTactics().then(function() {
        var featuredId = params.featured ? parseInt(params.featured, 10) : null;
        if (featuredId && !isNaN(featuredId)) {
            loadFeaturedById(featuredId);
            // One-shot: strip the param so Back from detail returns to a clean /tactics
            Router.syncUrl({ view: 'tactics', params: {} });
        } else {
            loadRandomFeatured();
        }
    });
    break;
```

(`Router.syncUrl` already exists in `router.js` line ~133 — it does `history.replaceState` without re-rendering. Exactly the tool for this.)

Same treatment for tabiyas:

```js
case 'tabiyas':
    _applyPositionFilters(params);
    _activateView('tabiyas', 'Tabiyas');
    mountTabiyaTagFilter();
    loadTabiyas().then(function() {
        var focusId = params.focus ? parseInt(params.focus, 10) : null;
        if (focusId && !isNaN(focusId)) {
            focusTabiyaRow(focusId);
            Router.syncUrl({ view: 'tabiyas', params: {} });
        }
    });
    break;
```

#### C6. Acceptance for Part C

End-to-end flow checks:

- [ ] On Tactics page, click `+ New Tactic` → paste a FEN → click Save (no title). Result: lands on `/tactics`, the featured board shows the new tactic with a hyphenated auto-name title, the new tactic appears in the list.
- [ ] Hit browser Back from `/tactics` (after the save). You should NOT see the empty add form — you should go to wherever you were before clicking `+ New Tactic`.
- [ ] Click the newly-featured tactic → see detail → hit Back. Featured board now shows a fresh random tactic, not the one you just clicked.
- [ ] Same flow for Tabiyas: click `+ New Tabiya`, save, lands on `/tabiyas`, the new row is scrolled into view and briefly highlighted.
- [ ] Edit an existing tactic → Save. Lands on `/tactics`, that tactic is featured.
- [ ] Edit an existing tabiya → Save. Lands on `/tabiyas`, that tabiya row is focused.
- [ ] Hard-refresh `/tactics?featured=42` (manually paste into URL bar). Tactic 42 is featured on load, URL then cleans to `/tactics`.
- [ ] If you tag-filter such that tactic 42 is excluded, then save tactic 42, the page falls back to random featured (the `loadFeaturedById` fallback). No error.

---

## File-modification summary

**Part D (cleanup — tests):**

| File | Change |
|---|---|
| `tests/` | NEW directory, with `__init__.py` and 8 moved test files |
| `test_practice_backup.py`, `test_practice_fixed.py`, `fix_test.py` | DELETED — stale |
| `cleanup_test_data.py` | MOVED to `scripts/` |
| `__pycache__/` (root) | DELETED |
| `CLAUDE.md`, `run.sh` | UPDATE only if they reference moved files |

**Part E (cleanup — docs):**

| File | Change |
|---|---|
| `docs/archive/` | NEW directory holding ~28 moved spec/handoff files |
| `README.md` | REWRITTEN — replace stub with real entry-point content |

**Part A (auto-names):**

| File | Change |
|---|---|
| `backend/services/name_service.py` | NEW — pure module exporting `generate_placeholder_name()` |
| `backend/services/__init__.py` | Export `generate_placeholder_name` |
| `backend/api/positions.py` | Use generated name when title missing in create + update (~5 lines added) |
| `tests/test_name_service.py` | NEW — unit + integration tests for name generation |

**Part B (inline buttons):**

| File | Change |
|---|---|
| `frontend/index.html` | Add `+ New Tactic` / `+ New Tabiya` buttons inline in list headers |

**Part C (featured-after-save):**

| File | Change |
|---|---|
| `frontend/js/position-form.js` | `savePosition()`: read response, navigate with `?featured`/`?focus` + `replace: true` |
| `frontend/js/shared.js` | `tactics` / `tabiyas` route cases consume the new params, strip after consumption |
| `frontend/js/position-list.js` | Add `loadFeaturedById`, `focusTabiyaRow`. Add `data-pos-id` to list items. Ensure `loadTabiyas` / `loadTactics` return promises. |
| `frontend/css/components.css` (or `style.css`) | `.pos-item.row-highlight` style |

## File-size discipline

Before finishing, run:
```bash
wc -l frontend/js/*.js backend/api/*.py backend/services/*.py | sort -rn | head -10
```
The new additions are small (~30 lines to `position-list.js`, ~15 to `position-form.js`, ~10 to `shared.js`, ~5 to `positions.py`). None of those files should newly exceed 300 lines. If they do, stop and split.

Note: `practice-ui.js`, `practice.py`, and `positions.py` are already over 300 lines. This phase does NOT split them. `positions.py` gets ~5 lines added — acceptable. The full splits are a separate phase.

## What NOT to do

- Don't refactor `loadRandomFeatured` and `loadFeaturedById` into one function. They share most of their code, but cleanup is a separate refactor pass.
- Don't touch the header `+ New ▾` dropdown.
- Don't change the SQLAlchemy model — `title` is already nullable. The generation happens at the API layer.
- Don't add a collision check on generated names.
- Don't add a "this is auto-generated" badge or italic styling — the name is just the name.
- Don't split `practice-ui.js`, `practice.py`, or `positions.py` even though they're over the 300-line limit. Separate phase.
- Don't move or rename docs that are listed as "KEEP at root" in Part E.
- Don't try to fix unrelated bugs you spot along the way — note them in a new `OBSERVATIONS.md` instead and keep this phase focused.

## Commit strategy

Five commits, one per part, in order:
1. `Move tests into tests/, delete stale duplicates`  (Part D)
2. `Archive stale specs and handoffs into docs/archive`  (Part E)
3. `Auto-generate placeholder names for untitled positions`  (Part A)
4. `Add inline + New Tactic / + New Tabiya buttons`  (Part B)
5. `Feature newly-saved position on tactics/tabiyas page`  (Part C)

This makes any one part revertible without losing the others, and each commit is a clean conceptual unit.

## Final verification (after all five parts)

- [ ] All previously-passing backend tests still pass: `python -m pytest tests/`.
- [ ] All new tests pass: `python -m pytest tests/test_name_service.py`.
- [ ] All file-size limits respected (`wc -l` check above).
- [ ] Manually walk through every acceptance criterion in Parts A-E.
- [ ] No console errors on any view.
- [ ] Header `+ New ▾` dropdown still works.
- [ ] Existing add/edit flows from the position detail view (`+ Tabiya` / `+ Tactic` buttons on the detail board) still work — they benefit from auto-naming too.
- [ ] Project root looks clean: <12 `.md` files, no `test_*.py`, no `__pycache__`.
- [ ] `git log --oneline -5` shows the five expected commits in order.
