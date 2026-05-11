# Phase 23: Landing page polish — layout, ordering, featured actions

**Goal**: Three improvements to the collection landing pages (Tactics + Tabiyas):

1. **Fix the right-column layout.** The heading, count, button, and filter are stacked too loosely — the list tiles start too far down. Compact them into two tight rows so the browse grid starts immediately.
2. **Put the featured position first in the list.** Currently the list is newest-first (from the API). Move the featured position to slot 0 so the user can find it immediately — especially to delete or click into it.
3. **Add Edit and Delete buttons to the featured board area.** Currently the only way to edit or delete a position is to click through to the detail view. Add small action buttons directly below the featured board's title/tags, so the user can act on the featured position without drilling in.

**Read first**: `CLAUDE.md`

**Backup**: `./scripts/backup_now.sh` before starting.

**Scope**: Frontend only. No backend changes. Both Tactics and Tabiyas pages.

---

## Part A — Compact right-column layout

### The problem

The `collection-browse` panel currently stacks four loosely-spaced elements vertically:

```
Heading (Tactics)        [+ New Tactic btn]   [filter]   ← one flex row
Count (20 positions)                                      ← own block
                         — gap —
List tiles                                                ← starts too far down
```

The button is small (`btn-sm` was removed but the layout still has excess vertical space). The heading, count, and action bar are each on their own row, making the right column feel sparse next to the visually heavy featured board on the left.

### The fix

Compress into two rows:

```
Row 1:  Tactics · 20 positions                [+ New Tactic]
Row 2:  [Filter by tag...                                   ]
        ─────────────────────────────────────────────────────
        [tile] [tile] [tile] ...
```

- **Row 1**: Heading and count share one line. Count is muted inline text after the heading (not its own block). `+ New` button is right-aligned, full-size primary.
- **Row 2**: Filter input takes its own row, full width within the browse panel.
- **List tiles**: Start immediately after the filter. No extra gap.

### A1. Update Tactics `collection-browse` in `frontend/index.html`

Find the current Tactics `collection-browse` markup and replace it with:

```html
<div class="collection-browse">
  <div class="collection-header-row">
    <div class="collection-header-left">
      <h2>Tactics</h2>
      <span id="tactics-count" class="collection-count"></span>
    </div>
    <button class="btn btn-primary" onclick="Router.navigate({view:'addPosition', params:{type:'puzzle'}})">+ New Tactic</button>
  </div>
  <div id="tactics-tag-filters" class="tag-row" style="margin-bottom:12px"></div>
  <div id="tactics-list" class="pos-list"></div>
</div>
```

### A2. Update Tabiyas `collection-browse` in `frontend/index.html`

Same pattern for the Tabiyas panel:

```html
<div class="collection-browse">
  <div class="collection-header-row">
    <div class="collection-header-left">
      <h2>Tabiyas</h2>
      <span id="tabiyas-count" class="collection-count"></span>
    </div>
    <button class="btn btn-primary" onclick="Router.navigate({view:'addPosition', params:{type:'tabiya'}})">+ New Tabiya</button>
  </div>
  <div id="tabiyas-tag-filters" class="tag-row" style="margin-bottom:12px"></div>
  <div id="tabiyas-list" class="pos-list"></div>
</div>
```

### A3. Add CSS for `.collection-header-row` and `.collection-count`

In `frontend/css/components.css`, near the `.collection-landing` block:

```css
.collection-header-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.collection-header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.collection-header-left h2 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
  margin: 0;
}
.collection-count {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 400;
}
```

### A4. Delete the old `.collection-action-bar` CSS

If Phase 22 added `.collection-action-bar` styles, remove them — they're replaced by `.collection-header-row`.

### A5. Update count rendering in `frontend/js/position-list.js`

The count elements changed from `<div>` blocks to `<span>` inline elements. The rendering code in `renderTacticsList` and `renderTabiyasList` already sets `.textContent` on the count element — that should Just Work since `<span>` and `<div>` both support `.textContent`. Verify the count still displays. If the existing code sets `.innerHTML` on an outer div, adjust the selector — the IDs (`tactics-count`, `tabiyas-count`) haven't changed.

### A6. Acceptance for Part A

- [ ] Both pages show heading + count on one line, button right-aligned on that same line.
- [ ] Filter sits on its own row below the header row.
- [ ] List tiles start immediately after the filter — minimal vertical gap.
- [ ] On narrow viewports (~400px), the button wraps below the heading/count — nothing overflows.
- [ ] The right column feels dense and scannable, not spacious.

Commit: `Compact collection browse header into two tight rows`

---

## Part B — Featured position first in the list

### The problem

The featured board shows a random position, but the list is ordered newest-first from the API. The user has to visually scan the list to find the featured position — especially annoying if they want to delete it.

### The fix

After rendering the list, move the featured position's tile to slot 0. This is a frontend sort — don't change the API. The rest of the list stays in newest-first order.

### B1. Update `renderTacticsList` in `frontend/js/position-list.js`

Currently:
```js
function renderTacticsList() {
    ...
    el.innerHTML = tactics.map(p => ...
```

Change the sort to put the featured position first:

```js
function renderTacticsList() {
    const el = document.getElementById('tactics-list');
    if (!el) return;
    const tactics = AppState.allPositions.filter(p => p.position_type === 'puzzle');
    ...
    // Put featured position first so it's always easy to find
    const featuredId = AppState.featuredTacticId;
    if (featuredId) {
        tactics.sort(function(a, b) {
            if (a.id === featuredId) return -1;
            if (b.id === featuredId) return 1;
            return 0; // preserve existing order for everything else
        });
    }
    el.innerHTML = tactics.map(p => ...
```

**Important**: `AppState.allPositions` is the shared data array. Use `.filter()` (which returns a new array) before `.sort()` so you're sorting the filtered copy, not mutating the shared array. The existing code already does `.filter()` first, so `.sort()` on the result is safe.

### B2. Same for `renderTabiyasList`

Same pattern, using `AppState.featuredTabiyaId`:

```js
const featuredId = AppState.featuredTabiyaId;
if (featuredId) {
    tabiyas.sort(function(a, b) {
        if (a.id === featuredId) return -1;
        if (b.id === featuredId) return 1;
        return 0;
    });
}
```

### B3. Re-render list when featured position changes

When the user clicks Shuffle on the featured board, the featured position changes but the list doesn't re-render. The featured-first sort would be stale.

In `loadRandomFeatured` (and its `loadRandomFeaturedTabiya` mirror, and both `loadFeaturedById` / `loadFeaturedTabiyaById`), **add a call to re-render the list** after updating `AppState.featuredTacticId` / `AppState.featuredTabiyaId`:

At the end of `loadRandomFeatured`, add:
```js
renderTacticsList();
```

At the end of `loadRandomFeaturedTabiya`, add:
```js
renderTabiyasList();
```

Same for `loadFeaturedById` and `loadFeaturedTabiyaById`. This ensures the list order stays in sync when the featured position changes.

### B4. Acceptance for Part B

- [ ] Open Tactics page. The featured position's tile is always the first tile in the list.
- [ ] Click Shuffle. The new featured position moves to first position.
- [ ] Same behavior on Tabiyas.
- [ ] The rest of the list order is unchanged (newest-first).

Commit: `Put featured position first in browse grid`

---

## Part C — Edit and Delete buttons on the featured board

### The problem

The user wants to quickly edit or delete the featured position without clicking through to the detail view first. Currently the featured board area shows: board → flip/shuffle buttons → title → tags → engine. No action buttons.

### The fix

Add a small action row below the title/tags with Edit and Delete buttons. These call the same functions used elsewhere in the app — no new backend work.

### C1. Add action row to Tactics featured area in `frontend/index.html`

After the `tactics-featured-tags` div and before the `tactics-featured-engine` div, insert:

```html
<div id="tactics-featured-actions" class="featured-actions-row">
  <button class="btn btn-sm" onclick="editFeaturedPosition('tactics')">Edit</button>
  <button class="btn btn-sm btn-danger" onclick="deleteFeaturedPosition('tactics')">Delete</button>
</div>
```

### C2. Same for Tabiyas featured area in `frontend/index.html`

After `tabiyas-featured-tags`, before `tabiyas-featured-engine`:

```html
<div id="tabiyas-featured-actions" class="featured-actions-row">
  <button class="btn btn-sm" onclick="editFeaturedPosition('tabiyas')">Edit</button>
  <button class="btn btn-sm btn-danger" onclick="deleteFeaturedPosition('tabiyas')">Delete</button>
</div>
```

### C3. Add CSS for `.featured-actions-row`

In `frontend/css/components.css`:

```css
.featured-actions-row {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}
```

### C4. Add `editFeaturedPosition` and `deleteFeaturedPosition` in `frontend/js/position-list.js`

```js
function editFeaturedPosition(type) {
    var id = type === 'tactics' ? AppState.featuredTacticId : AppState.featuredTabiyaId;
    if (!id) return;
    // Reuse the existing editPosition flow: set the detail ID, call editPosition
    AppState.currentDetailId = id;
    editPosition();
}

async function deleteFeaturedPosition(type) {
    var id = type === 'tactics' ? AppState.featuredTacticId : AppState.featuredTabiyaId;
    if (!id || !confirm('Delete this position?')) return;
    var res = await fetch(API + '/positions/' + id, { method: 'DELETE' });
    if (res.ok) {
        toast('Position deleted');
        if (type === 'tactics') {
            loadTactics().then(function() { loadRandomFeatured(); });
        } else {
            loadTabiyas().then(function() { loadRandomFeaturedTabiya(); });
        }
    }
}

window.editFeaturedPosition = editFeaturedPosition;
window.deleteFeaturedPosition = deleteFeaturedPosition;
```

`editFeaturedPosition` reuses the existing `editPosition()` function from `position-detail.js`. It works by setting `AppState.currentDetailId` (which `editPosition` reads to fetch the position data and navigate to the edit form). This is the same flow as clicking Edit on the detail view — no new backend calls or forms needed.

`deleteFeaturedPosition` reuses the `DELETE /api/positions/:id` endpoint, then reloads the list and picks a new random featured position. The deleted position disappears from both the featured board and the list.

### C5. Verify `editPosition` works without the full detail view loaded

`editPosition()` in `position-detail.js` (line ~146) does a fresh `fetch(API + '/positions/' + AppState.currentDetailId)` and then navigates to the add-form view. It doesn't depend on the detail view being active — it fetches independently. So calling it from the landing page should work. But test this manually: click Edit on the featured board → the edit form should load with the position's FEN, title, tags, notes, and analysis pre-populated.

If for some reason `editPosition` depends on detail-view DOM elements being present, the safest fix is to just navigate to the detail view and auto-click Edit — but I believe it doesn't, based on the code.

### C6. Acceptance for Part C

- [ ] Featured board area shows Edit and Delete buttons below the title/tags.
- [ ] Click Edit on featured tactic → navigates to edit form with correct position loaded (FEN, title, tags, notes).
- [ ] Click Delete on featured tactic → confirm dialog → position deleted → new random tactic loads → list updates.
- [ ] Same for Tabiyas.
- [ ] Save after editing → returns to the landing with the edited position featured (Phase 22's `?featured=` flow).
- [ ] No console errors.

Commit: `Add Edit and Delete buttons to featured board area`

---

## File-modification summary

| Part | File | Change |
|---|---|---|
| A | `frontend/index.html` | Replace `collection-browse` markup in both Tactics and Tabiyas |
| A | `frontend/css/components.css` | Add `.collection-header-row`, `.collection-header-left`, `.collection-count`. Remove `.collection-action-bar` if present. |
| B | `frontend/js/position-list.js` | Sort featured position first in both `renderTacticsList` and `renderTabiyasList`. Re-render list on featured change. |
| C | `frontend/index.html` | Add `.featured-actions-row` with Edit/Delete buttons in both featured areas |
| C | `frontend/css/components.css` | Add `.featured-actions-row` styles |
| C | `frontend/js/position-list.js` | Add `editFeaturedPosition`, `deleteFeaturedPosition` |

## File-size check

```bash
wc -l frontend/js/position-list.js
```

This file is growing. If it crosses 300 lines after these additions, note it in `OBSERVATIONS.md` but don't split mid-phase.

## What NOT to do

- Don't touch backend ordering — the sort is frontend-only.
- Don't touch the header `+ New ▾` dropdown.
- Don't refactor the featured-board functions into one parametrized function. Separate phase.
- Don't change the detail view's Edit button or delete behavior — those stay as-is.

## Commit strategy

Three commits:
1. `Compact collection browse header into two tight rows`  (Part A)
2. `Put featured position first in browse grid`  (Part B)
3. `Add Edit and Delete buttons to featured board area`  (Part C)

## Final verification

- [ ] Both pages: heading + count share one line, button right-aligned, filter below, tiles start tight.
- [ ] Both pages: featured position is always the first tile in the browse grid.
- [ ] Both pages: Edit and Delete buttons visible below featured board title/tags.
- [ ] Edit from featured → form loads correctly → save → returns with the edited position featured.
- [ ] Delete from featured → confirm → position deleted → new random loads → list updated.
- [ ] Shuffle → featured changes → list re-renders with new featured first.
- [ ] On narrow viewports, everything wraps gracefully.
- [ ] No console errors.
- [ ] `git log --oneline -3` shows the three commits.
