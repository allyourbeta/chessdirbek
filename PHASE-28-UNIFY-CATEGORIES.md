# Phase 28: Unify Position Categories

## Goal

Replace the duplicated Tactics/Tabiyas code with a single generic "category view" implementation, and add two new tabs: **Endgames** and **Strategy**. All four tabs use identical code — the only difference is which `position_type` value they filter on.

## Context

Today, Tactics and Tabiyas are implemented as near-identical copy-paste code across multiple files (HTML, position-list.js, featured.js, shared.js, router.js). Adding two more tabs would mean four copies of everything. Instead, we generalize into a single parameterized implementation.

## Design Decisions (already agreed)

- Same database table, same `position_type` column — just add two new enum values
- Each position lives in exactly one tab (single `position_type` value, not multi-tab)
- All four tabs have identical behavior (featured board, tag filters, position list, add/edit/delete)
- Duplicate FEN check becomes **global** (across all position types, not per-type)
- `solution_san`, `theme`, `QuizAttempt` fields remain in schema but are unused — leave them alone

## Category Configuration

Define a single config object that drives everything. All tab-specific behavior derives from this:

```javascript
const CATEGORIES = {
    tactics:  { key: 'tactics',  label: 'Tactics',  positionType: 'puzzle',   urlPrefix: '/tactics',  addLabel: 'New Tactic' },
    tabiya:   { key: 'tabiya',   label: 'Tabiya',   positionType: 'tabiya',   urlPrefix: '/tabiya',   addLabel: 'New Tabiya' },
    endings:  { key: 'endings',  label: 'Endings',  positionType: 'endgame',  urlPrefix: '/endings',  addLabel: 'New Ending' },
    strategy: { key: 'strategy', label: 'Strategy', positionType: 'strategy', urlPrefix: '/strategy', addLabel: 'New Strategy' },
};
```

Also define a reverse lookup: `positionType → category key` for use in detail/back-navigation.

```javascript
const TYPE_TO_CATEGORY = {
    puzzle: 'tactics',
    tabiya: 'tabiya',
    endgame: 'endings',
    strategy: 'strategy',
};
```

## Changes by File

### 1. Backend: `backend/models/models.py`

Add two new enum values to `PositionType`:

```python
class PositionType(str, PyEnum):
    puzzle = "puzzle"
    tabiya = "tabiya"
    endgame = "endgame"
    strategy = "strategy"
```

No other model changes. The `position_type` column already uses SQLAlchemy `Enum(PositionType)`.

**Migration:** SQLite doesn't enforce enum values at the database level — SQLAlchemy's `Enum` type does validation in Python. So adding values to the Python enum is sufficient; no ALTER TABLE or migration script needed. Verify this by running the app and creating a test position with `position_type=endgame`.

### 2. Backend: `backend/api/positions.py`

**Duplicate check (lines ~44-54):** Change from per-type to global. Remove the `Position.position_type == data.position_type` filter:

```python
# BEFORE:
existing = db.query(Position).filter(
    Position.fen == data.fen,
    Position.position_type == data.position_type
).first()
if existing:
    position_type_name = "tactic" if data.position_type == PositionType.puzzle else "tabiya"
    raise HTTPException(status_code=409, detail=f"This {position_type_name} position already exists.")

# AFTER:
existing = db.query(Position).filter(Position.fen == data.fen).first()
if existing:
    existing_category = existing.position_type.value  # e.g. "tabiya", "endgame"
    raise HTTPException(
        status_code=409,
        detail=f"This position already exists (in {existing_category})."
    )
```

No other backend changes needed. The existing `?position_type=` query parameter filter already works for any valid enum value.

### 2b. Backend: `backend/api/positions_extra.py`

**Bulk reclassify (line ~55):** The `else` branch hardcodes `PositionType.tabiya`. Fix to use the actual requested type:

```python
# BEFORE:
else:
    # Changing to tabiya
    position.position_type = PositionType.tabiya
# AFTER:
else:
    position.position_type = request.new_type
```

### 3. Frontend: `frontend/index.html`

**Nav bar (lines ~22-27):** Add Endgames and Strategy buttons:

```html
<nav>
    <button onclick="Router.navigate({view:'tactics'})">Tactics</button>
    <button onclick="Router.navigate({view:'tabiya'})">Tabiya</button>
    <button onclick="Router.navigate({view:'endings'})">Endings</button>
    <button onclick="Router.navigate({view:'strategy'})">Strategy</button>
    <button onclick="Router.navigate({view:'games'})">Games</button>
    <button onclick="Router.navigate({view:'search'})">Search</button>
</nav>
```

**"+ New" dropdown menu (lines ~31-38):** Add entries for the two new types:

```html
<button onclick="Router.navigate({view:'addPosition', params:{type:'puzzle'}}); closeNewMenu()">+ New Tactic</button>
<button onclick="Router.navigate({view:'addPosition', params:{type:'tabiya'}}); closeNewMenu()">+ New Tabiya</button>
<button onclick="Router.navigate({view:'addPosition', params:{type:'endgame'}}); closeNewMenu()">+ New Endgame</button>
<button onclick="Router.navigate({view:'addPosition', params:{type:'strategy'}}); closeNewMenu()">+ New Strategy</button>
```

**View containers (lines ~45-100):** Replace the two separate `view-tabiyas` and `view-tactics` divs with a **single** generic `view-category` div. The content will be populated dynamically by JS. Remove `<div id="view-tabiyas">...</div>` (lines 45-72) and `<div id="view-tactics">...</div>` (lines 73-100). Replace with:

```html
<div id="view-category" class="view">
    <div class="collection-landing">
        <div class="collection-featured">
            <div id="cat-featured-board" class="board-wrap" style="width:100%;height:auto;aspect-ratio:1;margin:0 auto"></div>
            <div class="featured-board-controls">
                <button class="btn btn-sm btn-ghost" onclick="flipCategoryFeaturedBoard()">Flip</button>
                <button class="btn btn-sm btn-ghost" onclick="shuffleCategoryFeatured()">Shuffle</button>
            </div>
            <div class="featured-info">
                <div class="featured-title-row">
                    <h3 id="cat-featured-title" class="featured-title"></h3>
                    <button class="btn btn-sm btn-ghost" onclick="forkCategoryFeatured()" title="Fork — copy into a new position">⑂ Fork</button>
                </div>
                <div id="cat-featured-tags" class="featured-tags"></div>
            </div>
            <div id="cat-featured-engine" style="margin-top:14px"></div>
        </div>
        <div class="collection-browse">
            <div class="collection-header-row">
                <h2 id="cat-browse-title" class="collection-title"></h2>
                <span id="cat-count" class="collection-count"></span>
                <button id="cat-add-btn" class="btn btn-md btn-primary"></button>
            </div>
            <div id="cat-tag-filters" class="tag-row" style="margin-bottom:12px"></div>
            <div id="cat-list" class="pos-list"></div>
        </div>
    </div>
</div>
```

**Remaining "Save as Tabiya" buttons** scattered in other views (game detail, search, board editor, etc. — lines 181, 229, 296, 477): Leave these as-is for now. They save to the tabiyas category, which is fine as a default.

### 4. Frontend: `frontend/js/position-list.js`

**Replace the entire file** with a single generic implementation. The duplicated functions (`loadTabiyas`, `loadTactics`, `renderTabiyasList`, `renderTacticsList`, `mountTabiyaTagFilter`, `mountTacticsTagFilter`) all collapse into generic versions:

- `loadCategoryPositions(categoryKey)` — fetches positions filtered by `positionType` from the category config, stores in `AppState.allPositions`, calls `renderCategoryList()`
- `mountCategoryTagFilter(categoryKey)` — mounts tag filter into `cat-tag-filters`, onChange reloads the category
- `renderCategoryList(categoryKey)` — renders the position list into `cat-list`, updates count in `cat-count`
- `showDetail(id)` — unchanged (already generic)
- `deleteFromList(id)` — simplified, reloads current category
- `randomFromList()` — simplified, works from `AppState.allPositions` (already filtered by category)

The current active category is stored in `AppState.currentCategory` (a key like `'endgames'`).

**Window globals to export:** `loadCategoryPositions`, `mountCategoryTagFilter`, `renderCategoryList`, `showDetail`, `deleteFromList`, `randomFromList`.

**Remove old globals:** `loadPositions`, `loadTabiyas`, `loadTactics`, `mountPositionTagFilter`, `mountTabiyaTagFilter`, `mountTacticsTagFilter`, `renderPositionsList`, `renderTabiyasList`, `renderTacticsList`.

### 5. Frontend: `frontend/js/featured.js`

**Replace the duplicated featured functions** with generic ones:

- `loadRandomCategoryFeatured()` — picks random position from `AppState.allPositions`, loads into `cat-featured-board`, updates `cat-featured-title` and `cat-featured-tags`. Stores ID in `AppState.featuredCategoryId`.
- `loadCategoryFeaturedById(id)` — loads specific position as featured, falls back to random if not found.
- `flipCategoryFeaturedBoard()` — flips `cat-featured-board`.
- `shuffleCategoryFeatured()` — alias for `loadRandomCategoryFeatured()`.
- `forkCategoryFeatured()` — forks from `AppState.featuredCategoryId`, pre-fills form with current category's `positionType`.
- `editFeaturedPosition()` — simplified, uses `AppState.featuredCategoryId`.
- `deleteFeaturedPosition()` — simplified, reloads current category after delete.

**Remove old globals:** `loadRandomFeatured`, `loadFeaturedById`, `flipFeaturedBoard`, `loadRandomFeaturedTabiya`, `flipFeaturedTabiyaBoard`, `loadFeaturedTabiyaById`.

**New globals:** `loadRandomCategoryFeatured`, `loadCategoryFeaturedById`, `flipCategoryFeaturedBoard`, `shuffleCategoryFeatured`, `forkCategoryFeatured`, `editFeaturedPosition`, `deleteFeaturedPosition`.

### 6. Frontend: `frontend/js/shared.js` — `renderRoute()`

**Replace the separate `tabiyas` and `tactics` cases** (lines ~133-161) with a single handler that covers all four category keys:

```javascript
case 'tactics':
case 'tabiya':
case 'endings':
case 'strategy':
    _applyPositionFilters(params);
    var cat = CATEGORIES[route.view];
    AppState.currentCategory = route.view;
    _activateView('category', cat.label);
    // Set dynamic text content
    document.getElementById('cat-browse-title').textContent = cat.label;
    document.getElementById('cat-add-btn').textContent = '+ ' + cat.addLabel;
    document.getElementById('cat-add-btn').onclick = function() {
        Router.navigate({view:'addPosition', params:{type: cat.positionType}});
    };
    mountCategoryTagFilter(route.view);
    loadCategoryPositions(route.view).then(function() {
        var featuredId = params.featured ? parseInt(params.featured, 10) : null;
        if (featuredId && !isNaN(featuredId)) {
            loadCategoryFeaturedById(featuredId);
            Router.syncUrl({ view: route.view, params: {} });
        } else {
            loadRandomCategoryFeatured();
        }
    });
    break;
```

**`addPosition` case (lines ~168-175):** Update to use `CATEGORIES` for the form title. Currently it says "New Tactic" or "New Tabiya" — generalize:

```javascript
case 'addPosition':
    _activateView('add', 'Add New');
    AppState.addPositionType = (route.params && route.params.type) || 'tabiya';
    // Find the matching category label for the form title
    var addCat = Object.values(CATEGORIES).find(c => c.positionType === AppState.addPositionType);
    document.getElementById('form-title').textContent = addCat ? addCat.addLabel : 'New Position';
    BoardManager.setPosition('board', AppState.boardFen);
    _initFormTagFilter();
    break;
```

**`positionDetail` case (line ~164):** Update the nav context to use `TYPE_TO_CATEGORY`:

```javascript
case 'positionDetail':
    _applyPositionFilters(params);
    var catKey = TYPE_TO_CATEGORY[route.positionType] || 'tabiya';
    var navLabel = CATEGORIES[catKey] ? CATEGORIES[catKey].label : 'Tabiya';
    _activateView('detail', navLabel);
    loadPositionDetail(route.id);
    break;
```

**`saveBoardPosition` function (line ~267):** Update toast message:

```javascript
// BEFORE:
if (res.ok) toast('\u2713 Saved as ' + (positionType === 'tabiya' ? 'tabiya' : 'tactic'));
// AFTER:
var savedCat = Object.values(CATEGORIES).find(c => c.positionType === positionType);
if (res.ok) toast('\u2713 Saved as ' + (savedCat ? savedCat.label.toLowerCase() : positionType));
```

### 7. Frontend: `frontend/js/router.js`

**`parse()` function:** Add cases for `endgames` and `strategy`. Better yet, generalize — check if `a` is a known category key:

```javascript
// Replace the individual tabiyas/tactics/positions blocks with:
if (CATEGORIES[a]) {
    if (!b) return { view: a, params: q };
    if (b === 'new') return { view: 'addPosition', params: Object.assign(q, { type: CATEGORIES[a].positionType }) };
    const id = parseInt(b, 10);
    if (!isNaN(id)) return { view: 'positionDetail', id, positionType: CATEGORIES[a].positionType, params: q };
}
```

Keep the legacy `/positions` redirect to `tabiya`. Also add a legacy redirect for `/tabiyas` → `tabiya` (since the URL is changing from plural to singular).

**`build()` function:** Add cases for the new views, or generalize similarly:

```javascript
if (CATEGORIES[route.view]) {
    return CATEGORIES[route.view].urlPrefix + _qs(p);
}
```

Update `positionDetail` to use `TYPE_TO_CATEGORY`:

```javascript
case 'positionDetail':
    var catKey = TYPE_TO_CATEGORY[route.positionType] || 'tabiya';
    return CATEGORIES[catKey].urlPrefix + '/' + route.id + _qs(p);
```

Update `addPosition`:

```javascript
case 'addPosition':
    var addType = p && p.type ? p.type : 'tabiya';
    var addCatKey = Object.keys(CATEGORIES).find(k => CATEGORIES[k].positionType === addType) || 'tabiya';
    return CATEGORIES[addCatKey].urlPrefix + '/new' + _qs(p);
```

### 8. Frontend: `frontend/js/position-detail.js`

**Back button text (lines ~28-29, ~43-44):** Both the `if` and `else` branches currently hardcode the back button text. Generalize both to use `TYPE_TO_CATEGORY`:

```javascript
var catKey = TYPE_TO_CATEGORY[pos.position_type] || 'tabiya';
var backLabel = CATEGORIES[catKey] ? CATEGORIES[catKey].label : 'Tabiya';
backBtn.textContent = 'Back to ' + backLabel;
```

**`deleteFromDetail()` (line ~214):** Currently hardcodes `'tactics'` or `'tabiyas'`. Use `TYPE_TO_CATEGORY` for the return view:

```javascript
// BEFORE:
const viewToReturn = (pos && pos.position_type === 'puzzle') ? 'tactics' : 'tabiyas';
// AFTER:
const viewToReturn = (pos && TYPE_TO_CATEGORY[pos.position_type]) || 'tabiya';
```

**`randomFromDetail()` (lines ~221-238):** Currently has this logic:
```javascript
const posType = type === 'puzzle' ? 'puzzle' : 'tabiya';  // BUG: collapses all non-puzzle to 'tabiya'
```
Fix to pass through the actual type directly:
```javascript
const posType = type;  // 'puzzle', 'tabiya', 'endgame', or 'strategy'
```
Also line ~235, the `positionType` on the navigate call:
```javascript
// BEFORE:
Router.navigate({ view: 'positionDetail', id: pos.id, positionType: posType === 'puzzle' ? 'puzzle' : undefined, params });
// AFTER:
Router.navigate({ view: 'positionDetail', id: pos.id, positionType: posType, params });
```

**Puzzle vs non-puzzle branching (lines ~20-55):** Keep as-is. The `if (pos.position_type === 'puzzle')` branch hides practice/history/stats for Tactics. The `else` branch shows them — this automatically covers `tabiya`, `endgame`, and `strategy`. No change needed.

### 9. Frontend: `frontend/js/position-form.js`

**IMPORTANT — this file has multiple hardcoded type references that must be updated:**

**`savePosition()` line ~48:** After successful save, navigates to the correct tab:
```javascript
// BEFORE:
const viewToGo = savedType === 'puzzle' ? 'tactics' : 'tabiyas';
// AFTER:
const viewToGo = TYPE_TO_CATEGORY[savedType] || 'tabiya';
```

**`savePosition()` line ~63:** Error state resets the form title:
```javascript
// BEFORE:
formTitle.textContent = savedType === 'puzzle' ? 'New Tactic' : 'New Tabiya';
// AFTER:
var addCat = Object.values(CATEGORIES).find(c => c.positionType === savedType);
formTitle.textContent = addCat ? addCat.addLabel : 'New Position';
```

**`deletePosition()` line ~75:** After delete, currently hardcodes navigate to `'tabiyas'`:
```javascript
// BEFORE:
Router.navigate({ view: 'tabiyas' });
// AFTER:
Router.navigate({ view: TYPE_TO_CATEGORY[AppState.addPositionType] || 'tabiya' });
```

### 10. Frontend: `frontend/js/state.js`

Replace `featuredTacticId` and `featuredTabiyaId` with a single `featuredCategoryId`:

```javascript
// REMOVE:
featuredTacticId: null,
featuredTabiyaId: null,
// ADD:
featuredCategoryId: null,
currentCategory: null,
```

Also add `CATEGORIES` and `TYPE_TO_CATEGORY` to this file (see section 13).

### 11. Frontend: `frontend/js/board-editor.js`

**Line ~157:** Toast message hardcodes 'tactic'/'tabiya':
```javascript
// BEFORE:
toast('\u2713 Saved as ' + (posType === 'puzzle' ? 'tactic' : 'tabiya'));
// AFTER:
var savedCat = Object.values(CATEGORIES).find(c => c.positionType === posType);
toast('\u2713 Saved as ' + (savedCat ? savedCat.label.toLowerCase() : posType));
```

**Line ~158-159:** Navigation after save hardcodes `positionType` logic:
```javascript
// BEFORE:
var routeType = posType === 'puzzle' ? 'puzzle' : undefined;
Router.navigate({ view: 'positionDetail', id: data.id, positionType: routeType });
// AFTER:
Router.navigate({ view: 'positionDetail', id: data.id, positionType: posType });
```

The editor's save buttons in `index.html` currently only offer "Save as Tabiya" and "Save as Tactic". Leave as-is — adding all four types to the editor is not needed now.

### 12. Frontend: `frontend/js/bulk-add.js`

**Line ~6:** Title hardcodes two options:
```javascript
// BEFORE:
var title = type === 'puzzle' ? 'Bulk Add Tactics' : 'Bulk Add Tabiyas';
// AFTER:
var cat = Object.values(CATEGORIES).find(c => c.positionType === type);
var title = cat ? 'Bulk Add ' + cat.label : 'Bulk Add Positions';
```

**Line ~9:** Radio button selection hardcodes two values:
```javascript
// BEFORE:
radios.forEach(function (r) { r.checked = r.value === (type === 'puzzle' ? 'puzzle' : 'tabiya'); });
// AFTER:
radios.forEach(function (r) { r.checked = r.value === type; });
```

**Line ~47:** Position type hardcodes two values:
```javascript
// BEFORE:
var posType = type === 'puzzle' ? 'puzzle' : 'tabiya';
// AFTER:
var posType = type;  // radio value is already the correct position_type
```

**In `index.html`** (around line 420), add radio buttons for the new types:
```html
<label style="font-size:13px"><input type="radio" name="bulk-type" value="tabiya" checked> Tabiya</label>
<label style="font-size:13px"><input type="radio" name="bulk-type" value="puzzle"> Tactic</label>
<label style="font-size:13px"><input type="radio" name="bulk-type" value="endgame"> Ending</label>
<label style="font-size:13px"><input type="radio" name="bulk-type" value="strategy"> Strategy</label>
```

### 13. Where to put `CATEGORIES` and `TYPE_TO_CATEGORY`

These config objects need to be available to `router.js`, `shared.js`, `position-list.js`, `featured.js`, `position-detail.js`, `position-form.js`, `board-editor.js`, and `bulk-add.js`. Since the app uses vanilla JS globals, define them in `state.js` since it's small, already loaded early, and holds app-wide configuration. They will be `window.CATEGORIES` and `window.TYPE_TO_CATEGORY` globals.

### 14. Frontend: `frontend/js/router.js` — default route

Line ~49: The root URL `/` currently resolves to `{ view: 'tactics' }`. Keep this behavior — Tactics remains the default landing tab.

Line ~94: The fallback at the bottom (`return { view: 'tactics', params: q }`) — keep as-is.

Line ~121: The `default` case in `build()` returns `'/positions'`. Change to `'/tactics'` for consistency.

## Regression Risks and Guards

1. **Existing positions still work:** All existing positions with `position_type='puzzle'` or `'tabiya'` continue to display in their same tabs. No data migration needed.
2. **Detail page back-navigation:** The `TYPE_TO_CATEGORY` lookup ensures the back button returns to the correct tab for any position type.
3. **Featured board:** The generic implementation uses `AppState.allPositions` (already filtered by category on load), so featured selection works the same as before.
4. **Duplicate FEN check is now stricter:** Previously you could have the same FEN as both a tactic and a tabiya. Now it's rejected globally. This is intentional — you asked for this. If you have existing duplicate FENs across types, they'll continue to exist in the DB but you won't be able to create new ones.
5. **Games, Collections, Search, Practice, Editor** — none of these are touched. They don't depend on the position category system.
6. **URL changes:** `/tactics` stays the same. `/tabiyas` changes to `/tabiya` (singular) with a legacy redirect for the old URL. New URLs `/endings`, `/strategy`, `/endings/new`, etc. follow the same pattern.
7. **The `position_type` column stays as-is** — no rename to `category`. The column name doesn't matter; the values and behavior are what we're changing.

## Testing Checklist

After implementation, verify:

- [ ] Tactics tab shows only `position_type=puzzle` positions
- [ ] Tabiya tab shows only `position_type=tabiya` positions
- [ ] Endings tab shows only `position_type=endgame` positions
- [ ] Strategy tab shows only `position_type=strategy` positions
- [ ] Adding a position from each tab saves with the correct `position_type`
- [ ] Featured board loads and shuffles in each tab
- [ ] Tag filtering works in each tab
- [ ] Detail page back button goes to the correct tab
- [ ] Duplicate FEN rejected across types (try adding same FEN in two different tabs)
- [ ] Fork from featured works and opens form with correct type
- [ ] Delete from list and from detail both work and return to correct tab
- [ ] Random position navigation from detail page stays within same category
- [ ] Bulk add form shows all four type options
- [ ] Back/forward browser navigation works across tabs
- [ ] `/positions` legacy URL still redirects to tabiya
- [ ] `/tabiyas` legacy URL redirects to tabiya
- [ ] Board editor "Save as Tabiya" still works
- [ ] Practice play from detail page works for Tabiya, Endings, and Strategy
- [ ] Practice sections are HIDDEN for Tactics positions
- [ ] Practice sections are SHOWN for Tabiya, Endings, and Strategy positions
