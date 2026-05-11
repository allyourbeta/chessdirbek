# Phase 22: Unify Tabiyas landing + redesign + New buttons

**Goal**: Two corrections to Phase 21, which shipped using an earlier draft of the spec that predated the design conversation:

1. **Unify the Tabiyas landing with the Tactics layout.** Today Tactics has a two-column "featured board + browse grid" landing; Tabiyas is a single column with no featured board. Make Tabiyas use the same shell. After this phase, both pages have identical structure — same shape, different content.

2. **Redesign the `+ New` buttons.** Today both buttons are small (`btn-sm`) and crammed into the heading row. Move them to a dedicated action bar above the list, full-size primary style, paired with the tag filter on the right.

3. **Replace the `?focus=` Tabiyas scaffolding with the same `?featured=` mechanism Tactics uses.** Phase 21 introduced a `focus` URL param + `focusTabiyaRow()` + `.row-highlight` CSS to handle the post-save flow for Tabiyas (since it had no featured board). With Tabiyas now getting a featured board, all of that special-case code is redundant — collapse it into the same path Tactics uses.

**Read first**: `CLAUDE.md` for architecture rules and file limits. Also skim Phase 21 (`PHASE-21-CLEANUP-AND-UX.md`) to understand what already shipped.

**Backup before starting**: run `./scripts/backup_now.sh` per CLAUDE.md.

**Files NOT to modify**:
- The header `+ New ▾` dropdown.
- Backend code (Phase 21 backend work is correct as-is).
- `practice-ui.js` (428 lines, over limit) — separate refactor phase.
- `practice.py`, `positions.py` — same.

---

## What's currently shipped (after Phase 21)

For reference while reading this spec:

- `frontend/index.html` line ~45: `view-tabiyas` is the old single-column layout — no featured board.
- `frontend/index.html` line ~59: `view-tactics` is the two-column layout with `tactics-landing` / `tactics-featured` / `tactics-browse` CSS classes. The `+ New Tactic` button is inline next to the heading, small.
- `frontend/css/components.css` line ~585: `.tactics-landing` / `.tactics-featured` / `.tactics-browse` styles.
- `frontend/css/components.css` line ~59: `.pos-item.row-highlight` CSS (will be removed).
- `frontend/js/position-list.js` line ~181: `loadFeaturedById` (keep, will mirror for tabiyas).
- `frontend/js/position-list.js` line ~206: `focusTabiyaRow` (will be removed).
- `frontend/js/shared.js` line ~140 area: `tabiyas` route case handles `?focus=` (will be replaced with `?featured=`).
- `frontend/js/position-form.js` line ~50: saves tabiyas with `params: { focus: saved.id }` (will be `featured`).

---

## Execution order

1. **Part A**: Unify CSS class names + Tabiyas markup.
2. **Part B**: Mirror featured-board JS functions for Tabiyas.
3. **Part C**: Redesign action bar — move `+ New` buttons above the list with the filter.
4. **Part D**: Collapse `?focus=` scaffolding into `?featured=`.

Commit after each part. Four commits.

---

### Part A — Unify CSS classes and rebuild the Tabiyas markup

#### A1. Rename CSS classes in `frontend/css/components.css` (~line 585)

Current:
```css
/* ------------------------------------------------------------------
   Tactics landing — featured board + browse grid
   ------------------------------------------------------------------ */
.tactics-landing {
  display: grid;
  grid-template-columns: 480px 1fr;
  gap: var(--sp-8);
  align-items: start;
}
.tactics-featured {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-5);
  box-shadow: var(--shadow-sm);
}
.tactics-browse {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-5);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}
@media (max-width: 960px) {
  .tactics-landing {
    grid-template-columns: 1fr;
  }
}
```

Change to:
```css
/* ------------------------------------------------------------------
   Collection landing (Tactics + Tabiyas) — featured board + browse grid
   ------------------------------------------------------------------ */
.collection-landing {
  display: grid;
  grid-template-columns: 480px 1fr;
  gap: var(--sp-8);
  align-items: start;
}
.collection-featured {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-5);
  box-shadow: var(--shadow-sm);
}
.collection-browse {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-5);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}
@media (max-width: 960px) {
  .collection-landing {
    grid-template-columns: 1fr;
  }
}
```

#### A2. Update `view-tactics` markup in `frontend/index.html` (~line 59)

Find and replace every occurrence within the `view-tactics` block:
- `class="tactics-landing"` → `class="collection-landing"`
- `class="tactics-featured"` → `class="collection-featured"`
- `class="tactics-browse"` → `class="collection-browse"`

Leave all `id="tactics-featured-board"` / `id="tactics-featured-title"` etc. IDs unchanged — those are still tactics-specific and referenced by JS.

#### A3. Rebuild `view-tabiyas` markup in `frontend/index.html` (~line 45)

Replace the entire current `view-tabiyas` block:

```html
<div id="view-tabiyas" class="view">
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
  <div id="tabiyas-count" class="text-muted" style="font-size:16px;font-weight:500;margin-bottom:8px"></div>
  <div id="tabiyas-list" class="pos-list"></div>
</div>
```

with a two-column layout mirroring Tactics (same shell, `tabiyas-*` IDs):

```html
<div id="view-tabiyas" class="view">
  <div class="collection-landing">
    <div class="collection-featured">
      <div id="tabiyas-featured-board" class="board-wrap" style="width:100%;height:auto;aspect-ratio:1;margin:0 auto"></div>
      <div style="display:flex;gap:6px;margin-top:10px;justify-content:center">
        <button class="btn btn-sm" onclick="flipFeaturedTabiyaBoard()">Flip</button>
        <button class="btn btn-sm" onclick="loadRandomFeaturedTabiya()">Shuffle</button>
      </div>
      <h3 id="tabiyas-featured-title" style="margin-top:14px;font-size:22px;font-weight:700;cursor:pointer;text-align:center"></h3>
      <div id="tabiyas-featured-tags" style="margin-top:6px;text-align:center"></div>
      <div id="tabiyas-featured-engine" style="margin-top:14px"></div>
    </div>
    <div class="collection-browse">
      <h2 style="font-size:32px;font-weight:700;color:var(--text);letter-spacing:-0.02em;margin:0 0 4px 0">Tabiyas</h2>
      <div id="tabiyas-count" class="text-muted" style="font-size:14px;font-weight:500;margin-bottom:14px"></div>
      <!-- Action bar markup added in Part C -->
      <div id="tabiyas-tag-filters" class="tag-row"></div>
      <div id="tabiyas-list" class="pos-list" style="margin-top:14px"></div>
    </div>
  </div>
</div>
```

The `randomFromList('tabiya')` Shuffle button is gone from the heading row; the new Shuffle button lives below the featured board and calls `loadRandomFeaturedTabiya()` instead — same affordance, relocated to match Tactics.

#### A4. Acceptance for Part A

- [ ] Tactics page renders exactly as before (CSS rename is purely cosmetic to the class names — visual output unchanged).
- [ ] Tabiyas page now has two columns: a (currently empty) featured board placeholder on the left, browse grid on the right.
- [ ] No console errors. (The empty featured board will look blank until Part B wires up `loadRandomFeaturedTabiya`.)
- [ ] At narrow viewports (<960px) both pages still collapse to single-column.

Commit: `Unify Tabiyas landing layout with Tactics (CSS + markup)`

---

### Part B — Wire up the featured-tabiya JS

#### B1. Add state in `frontend/js/state.js`

Add to the AppState object (alongside `featuredTacticId` if it exists, or just at the end of the existing properties):

```js
featuredTabiyaId: null,
```

#### B2. Add featured-tabiya functions in `frontend/js/position-list.js`

Adjacent to the existing `loadRandomFeatured` (the tactics one, around line 156-185 area), add:

```js
function loadRandomFeaturedTabiya() {
    var tabiyas = AppState.allPositions.filter(function(p) {
        return p.position_type === 'tabiya';
    });
    if (!tabiyas.length) return;
    var pick = tabiyas[Math.floor(Math.random() * tabiyas.length)];
    AppState.featuredTabiyaId = pick.id;
    BoardManager.create('tabiyas-featured-board', pick.fen, {
        flipped: pick.orientation === 'black',
    });
    EngineUI.mount('tabiyas-featured-engine');
    EngineUI.setPosition(pick.fen);
    document.getElementById('tabiyas-featured-title').textContent = pick.title || 'Untitled';
    document.getElementById('tabiyas-featured-tags').innerHTML =
        pick.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tabiyas-featured-title').onclick = function() {
        showDetail(pick.id);
    };
    document.getElementById('tabiyas-featured-title').style.cursor = 'pointer';
}

function flipFeaturedTabiyaBoard() {
    BoardManager.flip('tabiyas-featured-board');
}

function loadFeaturedTabiyaById(id) {
    var pos = AppState.allPositions.find(function(p) {
        return p.id === id && p.position_type === 'tabiya';
    });
    if (!pos) {
        // Fall back to random if the requested position isn't in the list
        // (e.g. tag filter excludes it, or it was deleted between save and render)
        loadRandomFeaturedTabiya();
        return;
    }
    AppState.featuredTabiyaId = pos.id;
    BoardManager.create('tabiyas-featured-board', pos.fen, {
        flipped: pos.orientation === 'black',
    });
    EngineUI.mount('tabiyas-featured-engine');
    EngineUI.setPosition(pos.fen);
    document.getElementById('tabiyas-featured-title').textContent = pos.title || 'Untitled';
    document.getElementById('tabiyas-featured-tags').innerHTML =
        pos.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tabiyas-featured-title').onclick = function() {
        showDetail(pos.id);
    };
    document.getElementById('tabiyas-featured-title').style.cursor = 'pointer';
}

window.loadRandomFeaturedTabiya = loadRandomFeaturedTabiya;
window.flipFeaturedTabiyaBoard = flipFeaturedTabiyaBoard;
window.loadFeaturedTabiyaById = loadFeaturedTabiyaById;
```

These mirror the existing `loadRandomFeatured` / `flipFeaturedBoard` / `loadFeaturedById` for tactics, with `position_type === 'tabiya'` instead of `'puzzle'` and `tabiyas-featured-*` DOM IDs instead of `tactics-featured-*`. Known duplication — refactor in a later phase.

#### B3. Update tabiyas route handler in `frontend/js/shared.js`

The current `case 'tabiyas':` (around line ~133-144 area) looks like this (it shipped with Phase 21's `?focus=` mechanism):

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

Replace with the featured-aware version (mirroring `case 'tactics':`):

```js
case 'tabiyas':
    _applyPositionFilters(params);
    _activateView('tabiyas', 'Tabiyas');
    mountTabiyaTagFilter();
    loadTabiyas().then(function() {
        var featuredId = params.featured ? parseInt(params.featured, 10) : null;
        if (featuredId && !isNaN(featuredId)) {
            loadFeaturedTabiyaById(featuredId);
            Router.syncUrl({ view: 'tabiyas', params: {} });
        } else {
            loadRandomFeaturedTabiya();
        }
    });
    break;
```

#### B4. Acceptance for Part B

- [ ] Navigate to `/tabiyas`. Featured board loads with a random tabiya. Title and tags appear below.
- [ ] Click the featured tabiya title → navigates to its detail.
- [ ] Click "Flip" below the featured tabiya → board flips.
- [ ] Click "Shuffle" below the featured tabiya → board changes to a different random tabiya.
- [ ] Engine analysis ("Show Engine") works on the featured tabiya.
- [ ] Tactics page still works identically.
- [ ] No console errors.

Commit: `Mirror featured-board JS for tabiyas landing`

---

### Part C — Redesign action bar with `+ New` buttons

The existing inline buttons are too small and crammed against the heading. Move both to a dedicated action bar above the list.

#### C1. Update Tactics view in `frontend/index.html`

The Tactics view currently has (within `collection-browse`):

```html
<div class="collection-browse">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
    <h2 style="font-size:32px;font-weight:700;color:var(--text);letter-spacing:-0.02em;margin:0">Tactics</h2>
    <button class="btn btn-sm btn-primary" onclick="Router.navigate({view:'addPosition', params:{type:'puzzle'}})">+ New Tactic</button>
    <div id="tactics-tag-filters" class="tag-row" style="margin-left:auto"></div>
  </div>
  <div id="tactics-count" class="text-muted" style="font-size:16px;font-weight:500;margin-bottom:14px"></div>
  <div id="tactics-list" class="pos-list"></div>
</div>
```

Change to:

```html
<div class="collection-browse">
  <h2 style="font-size:32px;font-weight:700;color:var(--text);letter-spacing:-0.02em;margin:0 0 4px 0">Tactics</h2>
  <div id="tactics-count" class="text-muted" style="font-size:14px;font-weight:500;margin-bottom:14px"></div>
  <div class="collection-action-bar">
    <button class="btn btn-primary" onclick="Router.navigate({view:'addPosition', params:{type:'puzzle'}})">+ New Tactic</button>
    <div id="tactics-tag-filters" class="tag-row"></div>
  </div>
  <div id="tactics-list" class="pos-list"></div>
</div>
```

Structural changes:
1. Heading is standalone — no longer in a flex row with the button.
2. Count sits right below the heading, clean.
3. New `collection-action-bar` row holds the primary button on the left, filter on the right.
4. Button is `btn btn-primary` (not `btn-sm`) — full-size, weighty.

#### C2. Update Tabiyas view in `frontend/index.html`

Apply the same pattern inside the Tabiyas view's `collection-browse` block (set up in Part A):

```html
<div class="collection-browse">
  <h2 style="font-size:32px;font-weight:700;color:var(--text);letter-spacing:-0.02em;margin:0 0 4px 0">Tabiyas</h2>
  <div id="tabiyas-count" class="text-muted" style="font-size:14px;font-weight:500;margin-bottom:14px"></div>
  <div class="collection-action-bar">
    <button class="btn btn-primary" onclick="Router.navigate({view:'addPosition', params:{type:'tabiya'}})">+ New Tabiya</button>
    <div id="tabiyas-tag-filters" class="tag-row"></div>
  </div>
  <div id="tabiyas-list" class="pos-list"></div>
</div>
```

#### C3. Add `.collection-action-bar` CSS

In `frontend/css/components.css`, near the `.collection-landing` block from Part A:

```css
.collection-action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.collection-action-bar > .tag-row {
  margin-left: auto;
  flex: 1;
  min-width: 200px;
}
```

`flex-wrap: wrap` + `min-width: 200px` on the filter keep the bar usable on narrow viewports — the filter drops below the button when there's no room.

#### C4. Acceptance for Part C

- [ ] Both pages show a `+ New …` primary button in its own row, sized like other primary buttons in the app (not `btn-sm`).
- [ ] Heading and count read cleanly above, without the button competing for attention.
- [ ] Filter sits to the right of the button on the same row.
- [ ] On narrow viewports (~400px wide), the filter wraps to a second line, doesn't squash the button.
- [ ] Both pages look structurally identical at this point — same heading style, same action bar, same browse grid.

Commit: `Redesign + New buttons into dedicated action bar`

---

### Part D — Remove `?focus=` scaffolding, collapse to `?featured=`

Phase 21 introduced a separate `?focus=` URL param + `focusTabiyaRow()` function + `.pos-item.row-highlight` CSS to handle "scroll to the saved tabiya in the list" since tabiyas had no featured board. With the featured board now in place (Part A), all of that is redundant — collapse onto the same `?featured=` mechanism Tactics uses.

#### D1. Update `savePosition()` in `frontend/js/position-form.js`

Around line 45-55, currently:

```js
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
```

Replace with a single unified path:

```js
const viewToGo = savedType === 'puzzle' ? 'tactics' : 'tabiyas';
Router.navigate(
    { view: viewToGo, params: { featured: saved.id } },
    { replace: true }
);
```

#### D2. Delete `focusTabiyaRow` in `frontend/js/position-list.js`

Around line 206-212 — delete the function and its `window.focusTabiyaRow = ...` export. The route handler in `shared.js` was already updated in Part B to use `loadFeaturedTabiyaById` instead.

#### D3. Delete `.pos-item.row-highlight` CSS

In `frontend/css/components.css` around line 59, delete the `.pos-item.row-highlight` rule. (If there's anything else nearby that was added in Phase 21 to support row-highlight — e.g. a transition rule on `.pos-item` that only existed to support the highlight — leave the base `.pos-item` styles alone but remove anything specifically about `.row-highlight`.)

#### D4. Confirm `data-pos-id` attributes

Phase 21 added `data-pos-id="${p.id}"` to list items in `renderTabiyasList` and `renderTacticsList` (in `position-list.js`). These were added to support `focusTabiyaRow`'s `querySelector`. With `focusTabiyaRow` gone, the `data-pos-id` attributes are no longer used — but they're harmless and arguably useful for future selector-based work, so **leave them in place**. This is a deliberate choice: removing them now would be needless churn.

#### D5. Acceptance for Part D

- [ ] `grep -rn "focus.*saved\|focusTabiyaRow\|row-highlight" frontend/` returns no results (other than possibly the `data-pos-id` attribute which is unrelated to focus).
- [ ] Save a new tabiya → lands on `/tabiyas?featured=<id>` → featured board shows the new tabiya → URL cleans to `/tabiyas` after render.
- [ ] Save a new tactic → same flow on `/tactics`.
- [ ] Edit an existing tabiya → save → featured board shows the edited tabiya.
- [ ] No console errors.

Commit: `Collapse ?focus= tabiyas flow into ?featured= unified path`

---

## What NOT to do

- Don't refactor the four `load*Featured*` functions into a single parametrized function. They duplicate, that's a known smell, separate refactor phase.
- Don't touch the header `+ New ▾` dropdown.
- Don't touch backend code — Phase 21 shipped it correctly.
- Don't split any file that's over 300 lines. Separate phase.
- Don't remove `data-pos-id` attributes — they're harmless and possibly useful later.
- Don't try to fix unrelated bugs you spot along the way — note them in `OBSERVATIONS.md`.

## File-modification summary

| Part | File | Change |
|---|---|---|
| A | `frontend/css/components.css` | Rename `.tactics-*` → `.collection-*`, update comment |
| A | `frontend/index.html` | Update `view-tactics` classes; rebuild `view-tabiyas` with two-column layout |
| B | `frontend/js/state.js` | Add `featuredTabiyaId: null` |
| B | `frontend/js/position-list.js` | Add `loadRandomFeaturedTabiya`, `flipFeaturedTabiyaBoard`, `loadFeaturedTabiyaById` |
| B | `frontend/js/shared.js` | Update `case 'tabiyas':` to use `?featured=` and call new functions |
| C | `frontend/index.html` | Restructure `view-tactics` and `view-tabiyas` action bars |
| C | `frontend/css/components.css` | Add `.collection-action-bar` styles |
| D | `frontend/js/position-form.js` | Collapse tactics/tabiyas branches into single `featured` path |
| D | `frontend/js/position-list.js` | Delete `focusTabiyaRow` and its export |
| D | `frontend/css/components.css` | Delete `.pos-item.row-highlight` rule |

## File-size discipline

After all parts:
```bash
wc -l frontend/js/*.js frontend/css/*.css | sort -rn | head -10
```

`position-list.js` is the file growing the most (~70 lines added in Part B, ~10 removed in Part D). Should land near or just over 250 lines. If it crosses 300, stop and split.

## Commit strategy

Four commits, one per part:
1. `Unify Tabiyas landing layout with Tactics (CSS + markup)`  (Part A)
2. `Mirror featured-board JS for tabiyas landing`  (Part B)
3. `Redesign + New buttons into dedicated action bar`  (Part C)
4. `Collapse ?focus= tabiyas flow into ?featured= unified path`  (Part D)

## Final verification

- [ ] Tactics and Tabiyas pages look structurally identical: same two-column shape, same action bar style, same featured-board interactions.
- [ ] Save a new tactic → lands on Tactics page with new tactic featured.
- [ ] Save a new tabiya → lands on Tabiyas page with new tabiya featured.
- [ ] Both pages have full-size primary `+ New …` buttons in dedicated action bars.
- [ ] Hit Back from either page (after save) → goes to wherever you were before clicking + New (NOT the empty form).
- [ ] Click featured position → see detail → hit Back → fresh random featured loads (no `?featured=` in URL).
- [ ] No console errors anywhere.
- [ ] No leftover `focus`/`row-highlight` code (`grep -rn "focusTabiyaRow\|row-highlight" frontend/` returns nothing).
- [ ] `git log --oneline -4` shows the four expected commits.
