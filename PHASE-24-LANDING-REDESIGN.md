# Phase 24: Landing page redesign — unified layout, button design, fork action

**Goal**: Redesign both collection landing pages (Tactics + Tabiyas) into a consistent, polished experience. This phase subsumes the incomplete work from Phases 22 and 23.

**What this phase delivers:**
1. Unify Tabiyas to use the same two-column featured-board layout as Tactics.
2. Fix the button design language — introduce a `btn-md` size tier so page-level action buttons match the app's visual weight.
3. Redesign the featured board area — group buttons logically, anchor the title, add a Fork button.
4. Compact the right-column browse header into one tight row.
5. Put the featured position first in the browse list.
6. Implement "Fork" — opens the add form pre-populated from the featured position but saves as a NEW position.

**Read first**: `CLAUDE.md`

**Backup**: `./scripts/backup_now.sh` before starting.

**Scope**: Frontend only. No backend changes.

---

## Current state (post-Phase 21)

- **Tactics**: two-column layout using `tactics-landing` / `tactics-featured` / `tactics-browse` CSS. Small `btn-sm btn-primary` "+ New Tactic" button inline with the heading. No edit/fork/delete on featured board. List is unsorted (newest-first from API).
- **Tabiyas**: single-column, no featured board at all. Small `btn-sm btn-primary` "+ New Tabiya" button in the old `list-header-top` row.
- **Button sizes**: `.btn` = 13px/500wt/6px-12px padding, `.btn-sm` = 12px/4px-9px, `.btn-lg` = 14px/9px-16px. The header nav is 22px/600wt/12px-24px. There's no middle tier for page-level actions — everything in-page uses the tiny 12-13px buttons, which feel disconnected from the header.
- **Phases 22 and 23 did NOT ship** — the spec versions handed to Claude Code predated the design changes discussed in conversation.

---

## Execution order

1. **Part A**: Add `btn-md` size tier and redesign CSS classes.
2. **Part B**: Unify Tabiyas with Tactics two-column layout (markup + JS).
3. **Part C**: Redesign both featured board areas and browse headers.
4. **Part D**: Featured-first sorting in the browse list.
5. **Part E**: Fork action (frontend only — new function, no backend).

Five commits.

---

### Part A — Button design language: add `btn-md`

The app needs a middle tier between the tiny content buttons (13px) and the massive header nav (22px). Page-level actions — `+ New Tactic`, `Fork` — should use this tier.

#### A1. Add `btn-md` to `frontend/css/style.css`

After the existing `.btn-sm` line (~line 530), add:

```css
.btn-md { padding: 8px 18px; font-size: var(--fs-15); font-weight: 600; }
```

This gives `btn-md` buttons:
- `15px` font (vs 12px for sm, 13px for default, 22px for nav)
- `600` weight (matches the nav buttons' weight, not the lighter 500 of default)
- `8px 18px` padding (comfortable click target, substantial feel)

The result: `btn-md btn-primary` will feel like it belongs in the same app as the header nav, while being clearly smaller/subordinate to it.

#### A2. Do NOT touch the header nav buttons

The header stays at 22px/700wt/12px-24px. This tier is only for in-page actions.

#### A3. Acceptance for Part A

- [ ] `.btn-md` class exists and renders at 15px, weight 600, padding 8px 18px.
- [ ] Can test by temporarily adding `btn-md` to any existing button — it's visibly larger than `btn` but smaller than the nav.
- [ ] No existing buttons change appearance.

Commit: `Add btn-md size tier for page-level action buttons`

---

### Part B — Unify Tabiyas with Tactics two-column layout

#### B1. Rename CSS classes in `frontend/css/components.css` (~line 585)

Replace `.tactics-landing` → `.collection-landing`, `.tactics-featured` → `.collection-featured`, `.tactics-browse` → `.collection-browse` in both the class definitions and the `@media` query. Update the section comment.

#### B2. Update `view-tactics` markup in `frontend/index.html` (~line 59)

Change `class="tactics-landing"` → `class="collection-landing"`, `class="tactics-featured"` → `class="collection-featured"`, `class="tactics-browse"` → `class="collection-browse"`. Leave all `id="tactics-*"` attributes alone.

#### B3. Rebuild `view-tabiyas` in `frontend/index.html` (~line 45)

Replace the entire current `view-tabiyas` block with a two-column layout mirroring Tactics:

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
      <h2>Tabiyas</h2>
      <div id="tabiyas-count" class="text-muted" style="font-size:16px;font-weight:500;margin-bottom:8px"></div>
      <div id="tabiyas-tag-filters" class="tag-row"></div>
      <div id="tabiyas-list" class="pos-list"></div>
    </div>
  </div>
</div>
```

This is placeholder markup — Part C will redesign the browse header and featured area. The goal of Part B is structural: get the two-column grid working.

#### B4. Add featured-tabiya JS in `frontend/js/position-list.js`

Add these functions adjacent to the existing `loadRandomFeatured` / `loadFeaturedById`:

```js
function loadRandomFeaturedTabiya() {
    var tabiyas = AppState.allPositions.filter(function(p) {
        return p.position_type === 'tabiya';
    });
    if (!tabiyas.length) return;
    var pick = tabiyas[Math.floor(Math.random() * tabiyas.length)];
    _setFeaturedTabiya(pick);
}

function loadFeaturedTabiyaById(id) {
    var pos = AppState.allPositions.find(function(p) {
        return p.id === id && p.position_type === 'tabiya';
    });
    if (!pos) {
        loadRandomFeaturedTabiya();
        return;
    }
    _setFeaturedTabiya(pos);
}

function _setFeaturedTabiya(pos) {
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
}

function flipFeaturedTabiyaBoard() {
    BoardManager.flip('tabiyas-featured-board');
}

window.loadRandomFeaturedTabiya = loadRandomFeaturedTabiya;
window.loadFeaturedTabiyaById = loadFeaturedTabiyaById;
window.flipFeaturedTabiyaBoard = flipFeaturedTabiyaBoard;
```

Note: I've extracted the common setup into `_setFeaturedTabiya` to reduce duplication between the random and by-ID functions. Do the same for the existing tactics functions — extract into `_setFeaturedTactic(pos)`. This is a small internal refactor that makes both cleaner without changing behavior.

#### B5. Add `featuredTabiyaId` to state

In `frontend/js/state.js`, add to AppState:

```js
featuredTabiyaId: null,
```

#### B6. Update `case 'tabiyas':` in `frontend/js/shared.js`

Replace the current tabiyas route handler with:

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

#### B7. Update `savePosition()` in `frontend/js/position-form.js`

Currently line ~45-55 has separate branches for `featured` (tactics) and `focus` (tabiyas). Replace with a unified path:

```js
const viewToGo = savedType === 'puzzle' ? 'tactics' : 'tabiyas';
Router.navigate(
    { view: viewToGo, params: { featured: saved.id } },
    { replace: true }
);
```

#### B8. Remove `focusTabiyaRow` and `.row-highlight`

- Delete the `focusTabiyaRow` function and its `window.focusTabiyaRow` export from `position-list.js` (~line 206-213).
- Delete the `.pos-item.row-highlight` CSS rule from `components.css` (~line 59).
- In `shared.js`, remove any reference to `focusTabiyaRow` or `params.focus` in the tabiyas case (already replaced in B6).

#### B9. Acceptance for Part B

- [ ] Tabiyas page has two columns: featured board left, browse grid right.
- [ ] Featured tabiya loads randomly on page arrival.
- [ ] Flip and Shuffle work on the featured tabiya board.
- [ ] Clicking featured tabiya title navigates to detail.
- [ ] Save a new tabiya → returns to `/tabiyas` with that tabiya featured.
- [ ] Tactics page still works (now uses `collection-*` classes).
- [ ] No console errors.
- [ ] `grep -rn "focusTabiyaRow\|row-highlight\|params.focus" frontend/` returns nothing.

Commit: `Unify Tabiyas with Tactics two-column layout`

---

### Part C — Redesign featured area and browse header

This is the design-language fix. Two sub-goals: (1) the featured board area has clear visual hierarchy, (2) the browse header is compact with the `+ New` button properly sized.

#### C1. Redesign the featured board area (both pages)

The featured area currently stacks: board → [Flip] [Shuffle] → title → tags → engine.

The problems: Flip/Shuffle and title are all centered with no grouping, the title floats between button rows, and (once we add Fork) the actions on the position need to be visually distinct from the board controls.

**New structure:**

```
┌─────────────────────────────┐
│         [chess board]        │
│                              │
│       [Flip]  [Shuffle]      │  ← board controls: small, ghost-style
│                              │
│  Title of the position   ✂  │  ← title left-aligned, Fork icon right
│  #tag1 #tag2                 │  ← tags left-aligned
│                              │
│  [Show Engine]               │  ← engine panel
└─────────────────────────────┘
```

Key changes:
- Title becomes left-aligned (not centered) — reads more naturally.
- Tags left-aligned to match.
- The Fork button is a small icon button (`✂` scissors or a branch icon) sitting to the right of the title on the same line, so it's clearly "an action on this thing" without being a separate row.
- Flip and Shuffle stay centered below the board — they're board controls, visually subordinate.

**Tactics featured area in `index.html`** — replace the current markup within `collection-featured`:

```html
<div class="collection-featured">
  <div id="tactics-featured-board" class="board-wrap" style="width:100%;height:auto;aspect-ratio:1;margin:0 auto"></div>
  <div class="featured-board-controls">
    <button class="btn btn-sm btn-ghost" onclick="flipFeaturedBoard()">Flip</button>
    <button class="btn btn-sm btn-ghost" onclick="loadRandomFeatured()">Shuffle</button>
  </div>
  <div class="featured-info">
    <div class="featured-title-row">
      <h3 id="tactics-featured-title" class="featured-title"></h3>
      <button class="btn btn-sm btn-ghost" onclick="forkFeaturedPosition('tactics')" title="Fork — copy into a new position">⑂ Fork</button>
    </div>
    <div id="tactics-featured-tags" class="featured-tags"></div>
  </div>
  <div id="tactics-featured-engine" style="margin-top:14px"></div>
</div>
```

**Tabiyas featured area in `index.html`** — same structure, `tabiyas-*` IDs:

```html
<div class="collection-featured">
  <div id="tabiyas-featured-board" class="board-wrap" style="width:100%;height:auto;aspect-ratio:1;margin:0 auto"></div>
  <div class="featured-board-controls">
    <button class="btn btn-sm btn-ghost" onclick="flipFeaturedTabiyaBoard()">Flip</button>
    <button class="btn btn-sm btn-ghost" onclick="loadRandomFeaturedTabiya()">Shuffle</button>
  </div>
  <div class="featured-info">
    <div class="featured-title-row">
      <h3 id="tabiyas-featured-title" class="featured-title"></h3>
      <button class="btn btn-sm btn-ghost" onclick="forkFeaturedPosition('tabiyas')" title="Fork — copy into a new position">⑂ Fork</button>
    </div>
    <div id="tabiyas-featured-tags" class="featured-tags"></div>
  </div>
  <div id="tabiyas-featured-engine" style="margin-top:14px"></div>
</div>
```

Note on the fork icon: `⑂` (Unicode U+2442, OCR fork) is a clean branch symbol. If it doesn't render well across browsers, fall back to `⑂` or just the text "Fork" — check rendering before committing. Alternatives: `⎇` (U+2387) or just no icon.

#### C2. Add CSS for the featured area

In `frontend/css/components.css`:

```css
/* Featured board area structure */
.featured-board-controls {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-top: 10px;
}
.featured-info {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.featured-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.featured-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  cursor: pointer;
  line-height: 1.3;
}
.featured-title:hover {
  color: var(--primary-500);
}
.featured-tags {
  margin-top: 6px;
}
```

The `.featured-info` block has a subtle top border separating the board-control zone from the position-identity zone. This is the "layering" that was missing — a visual boundary between "what you're looking at" (board + controls) and "what this is" (title + tags + actions).

#### C3. Redesign the browse header (both pages)

Replace the current heading area in `collection-browse` with a compact single-row header. The heading, count, and `+ New` button share one line:

```html
<div class="collection-browse">
  <div class="collection-header-row">
    <h2 class="collection-title">Tactics</h2>
    <span id="tactics-count" class="collection-count"></span>
    <button class="btn btn-md btn-primary" onclick="Router.navigate({view:'addPosition', params:{type:'puzzle'}})">+ New Tactic</button>
  </div>
  <div id="tactics-tag-filters" class="tag-row" style="margin-bottom:12px"></div>
  <div id="tactics-list" class="pos-list"></div>
</div>
```

Same for Tabiyas:

```html
<div class="collection-browse">
  <div class="collection-header-row">
    <h2 class="collection-title">Tabiyas</h2>
    <span id="tabiyas-count" class="collection-count"></span>
    <button class="btn btn-md btn-primary" onclick="Router.navigate({view:'addPosition', params:{type:'tabiya'}})">+ New Tabiya</button>
  </div>
  <div id="tabiyas-tag-filters" class="tag-row" style="margin-bottom:12px"></div>
  <div id="tabiyas-list" class="pos-list"></div>
</div>
```

Note: the `+ New` button now uses `btn-md btn-primary` — the new medium tier from Part A.

#### C4. Add CSS for the browse header

In `frontend/css/components.css`:

```css
.collection-header-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.collection-title {
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
  flex: 1;
}
```

The `flex: 1` on `.collection-count` pushes the `+ New` button to the right edge. The count text sits right after the heading on the same baseline, then the button anchors the right side. One line, three elements, clean hierarchy.

#### C5. Remove the old inline style overrides

The existing Tactics markup has inline styles on the heading (`style="font-size:32px;font-weight:700;..."`) and count (`style="font-size:16px;..."`). These are replaced by the CSS classes. Make sure no inline `style` attributes remain on the heading, count, or button elements within `collection-browse` — all styling comes from classes.

#### C6. Update the `_setFeaturedTactic` / `_setFeaturedTabiya` helper functions

The existing `loadRandomFeatured` sets several inline styles on the title element:

```js
document.getElementById('tactics-featured-title').style.cursor = 'pointer';
```

With the new CSS classes (`.featured-title` already has `cursor: pointer`), these inline style assignments are unnecessary. Remove them from the `_setFeaturedTactic` and `_setFeaturedTabiya` helper functions (or from `loadRandomFeatured` / `loadFeaturedById` if Part B's internal refactor wasn't done).

The `.textContent` and `.onclick` assignments still need to happen in JS — those are data-driven. Just drop the `.style.cursor` line.

#### C7. Acceptance for Part C

- [ ] Featured board area: board → [Flip ghost] [Shuffle ghost] → thin separator → title (left-aligned) with Fork button right-aligned → tags below.
- [ ] Flip and Shuffle look like utility controls (ghost style, small).
- [ ] Fork button is small, ghost-styled, clearly subordinate to the title.
- [ ] The title-to-tags zone feels visually separated from the board-controls zone.
- [ ] Browse header: `Tactics 20 positions .............. [+ New Tactic]` — one compact line.
- [ ] `+ New Tactic` button is visibly larger than `btn-sm` buttons, feels proportional to the heading.
- [ ] Both pages are visually consistent.
- [ ] On narrow viewports, the header row wraps gracefully (button drops below heading+count).

Commit: `Redesign featured area and browse header with btn-md tier`

---

### Part D — Featured position first in browse list

#### D1. Sort featured first in `renderTacticsList`

After filtering positions, sort the featured position to index 0:

```js
function renderTacticsList() {
    const el = document.getElementById('tactics-list');
    if (!el) return;
    const tactics = AppState.allPositions.filter(p => p.position_type === 'puzzle');
    // ... count rendering ...

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

The `.filter()` call already returns a new array, so `.sort()` won't mutate `AppState.allPositions`.

#### D2. Same for `renderTabiyasList`

Same pattern using `AppState.featuredTabiyaId`.

#### D3. Re-render list when featured changes

At the end of `loadRandomFeatured` (or `_setFeaturedTactic`), add:
```js
renderTacticsList();
```

Same for `loadRandomFeaturedTabiya` (or `_setFeaturedTabiya`):
```js
renderTabiyasList();
```

This keeps the list order in sync when the user clicks Shuffle.

#### D4. Acceptance for Part D

- [ ] The featured position's tile is always first in the browse list.
- [ ] Click Shuffle → new featured position moves to first slot.
- [ ] Same on both pages.

Commit: `Put featured position first in browse list`

---

### Part E — Fork action

"Fork" opens the add form pre-populated from the featured position but saves as a NEW position (not an edit). The original position is untouched.

#### E1. Add `forkFeaturedPosition` in `frontend/js/position-list.js`

```js
function forkFeaturedPosition(type) {
    var id = type === 'tactics' ? AppState.featuredTacticId : AppState.featuredTabiyaId;
    if (!id) return;
    fetch(API + '/positions/' + id).then(function(r) { return r.json(); }).then(function(pos) {
        // Pre-populate the form with data from the source position
        // but do NOT set edit-id — this creates a new position, not an edit.
        document.getElementById('edit-id').value = '';
        document.getElementById('fen-input').value = pos.fen;
        document.getElementById('pos-title').value = '';  // blank — will auto-generate on save
        window._formTagState.tags = pos.tags.map(function(t) { return t.name; });
        window._initFormTagFilter();
        document.getElementById('pos-notes').value = pos.notes || '';
        document.getElementById('pos-stockfish').value = pos.stockfish_analysis || '';
        document.getElementById('form-title').textContent =
            'Fork from ' + (pos.title || 'untitled');
        document.getElementById('delete-btn').style.display = 'none';
        AppState.boardFen = pos.fen;
        AppState.addPositionType = pos.position_type || 'tabiya';

        Router.navigate({
            view: 'addPosition',
            params: { type: pos.position_type || 'tabiya' }
        });
        BoardManager.setPosition('board', AppState.boardFen);
        if (typeof window._applyFormOrientation === 'function') {
            window._applyFormOrientation(pos.orientation || 'white');
        }
    });
}

window.forkFeaturedPosition = forkFeaturedPosition;
```

Key differences from `editPosition`:
1. `edit-id` is set to `''` (empty) → `savePosition` will do a POST (create) not a PUT (update).
2. `pos-title` is set to `''` (empty) → backend auto-generates a new name on save.
3. `form-title` says "Fork from ..." so the user knows they're creating, not editing.
4. `delete-btn` is hidden — you can't delete a position that doesn't exist yet.

Everything else — FEN, tags, notes, analysis, orientation — is copied from the source.

#### E2. Acceptance for Part E

- [ ] Click Fork on featured tactic → add form opens with FEN loaded on board, tags pre-populated, notes copied, analysis copied. Title field is EMPTY. Form heading says "Fork from [original name]".
- [ ] Edit the board/FEN in the form. Click Save. A NEW position is created with an auto-generated name. The original position is untouched.
- [ ] Navigate back to the tactics list. Both the original and the new fork are in the list.
- [ ] Same flow for tabiyas.
- [ ] The forked position appears as the featured position after save (via the existing `?featured=` flow).

Commit: `Add Fork button to featured position — copies into new position`

---

## File-modification summary

| Part | File | Change |
|---|---|---|
| A | `frontend/css/style.css` | Add `.btn-md` size tier |
| B | `frontend/css/components.css` | Rename `.tactics-*` → `.collection-*` |
| B | `frontend/index.html` | Update tactics classes; rebuild tabiyas view |
| B | `frontend/js/state.js` | Add `featuredTabiyaId: null` |
| B | `frontend/js/position-list.js` | Add `_setFeaturedTabiya`, `loadRandomFeaturedTabiya`, `loadFeaturedTabiyaById`, `flipFeaturedTabiyaBoard`. Optionally refactor tactics equivalents into `_setFeaturedTactic`. Delete `focusTabiyaRow`. |
| B | `frontend/js/shared.js` | Replace `case 'tabiyas':` with featured-aware handler |
| B | `frontend/js/position-form.js` | Unify `savePosition` to use `featured` for both types |
| B | `frontend/css/components.css` | Delete `.pos-item.row-highlight` |
| C | `frontend/index.html` | Redesign both featured areas and browse headers |
| C | `frontend/css/components.css` | Add `.featured-board-controls`, `.featured-info`, `.featured-title-row`, `.featured-title`, `.featured-tags`, `.collection-header-row`, `.collection-title`, `.collection-count` |
| D | `frontend/js/position-list.js` | Sort featured first in both render functions; re-render on featured change |
| E | `frontend/js/position-list.js` | Add `forkFeaturedPosition` |

## File-size check

```bash
wc -l frontend/js/position-list.js
```

Currently 233 lines. Parts B, D, and E add roughly 80 lines total, and Part B deletes ~10 (focusTabiyaRow). Should land around 300. If it crosses, note in OBSERVATIONS.md but don't split mid-phase.

## What NOT to do

- Don't touch the header `+ New ▾` dropdown or any header styling.
- Don't touch backend code.
- Don't add a Delete button on the featured board. (The featured position is first in the list, where each tile already has a delete button.)
- Don't refactor the four `load*Featured*` functions into one parametrized function (BUT do extract `_setFeaturedTactic` / `_setFeaturedTabiya` helpers within Part B to reduce duplication between the random and by-ID variants).
- Don't split files that are over 300 lines. Separate phase.

## Commit strategy

Five commits:
1. `Add btn-md size tier for page-level action buttons`  (Part A)
2. `Unify Tabiyas with Tactics two-column layout`  (Part B)
3. `Redesign featured area and browse header with btn-md tier`  (Part C)
4. `Put featured position first in browse list`  (Part D)
5. `Add Fork button to featured position — copies into new position`  (Part E)

## Final verification

- [ ] Both pages are structurally identical: two-column layout, featured board left, browse right.
- [ ] Featured board area: board → ghost Flip/Shuffle → separator → left-aligned title with Fork → tags.
- [ ] Browse header: `Heading count ............ [+ New btn-md]` — one compact line.
- [ ] `+ New` buttons are `btn-md btn-primary` — visually proportional to the heading, clearly larger than `btn-sm`.
- [ ] Flip/Shuffle are `btn-sm btn-ghost` — subtle, utility-feel.
- [ ] Fork is `btn-sm btn-ghost` — subordinate to the title it sits beside.
- [ ] Featured position is always first in the browse list.
- [ ] Fork → opens add form with FEN/tags/notes from original, title blank, form says "Fork from ...". Save creates NEW position.
- [ ] Save after fork or new → returns with newly-saved position featured.
- [ ] Back button works correctly after save (no stale form in history).
- [ ] Narrow viewports: header row wraps, two-column collapses to single-column.
- [ ] No console errors.
- [ ] `git log --oneline -5` shows the five commits.
