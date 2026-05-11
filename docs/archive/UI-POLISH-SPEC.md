# UI Polish Spec v3 — List Headers, Cards, and Button Alignment

## Goal

Reorganize the Tabiyas and Tactics list views so the layout feels intentional.
Also compact the position cards. Minimal changes, big visual impact.

---

## Change 1: List view headers — Tabiyas

### Current (index.html lines ~34-41)
```html
<div class="view-header">
  <h2>Tabiyas</h2>
  <button class="btn btn-primary" onclick="...">+ New Tabiya</button>
  <button class="btn btn-sm" onclick="...">Bulk Add</button>
  <button class="btn btn-sm" onclick="...">Editor</button>
  <button class="btn btn-sm" onclick="...">Random</button>
  <div id="tabiyas-tag-filters" class="tag-row"></div>
</div>
```

### Replace with
```html
<div class="list-header">
  <div class="list-header-top">
    <h2>Tabiyas</h2>
    <button class="btn btn-primary btn-sm" onclick="Router.navigate({view:'addPosition', params:{type:'tabiya'}})">+ New Tabiya</button>
  </div>
  <div class="list-header-bar">
    <div id="tabiyas-tag-filters" class="tag-row"></div>
    <div class="list-header-tools">
      <button class="btn btn-sm" onclick="randomFromList('tabiya')">Shuffle</button>
      <button class="btn btn-sm btn-ghost" onclick="Router.navigate({view:'bulkAdd', params:{type:'tabiya'}})">Bulk Add</button>
      <button class="btn btn-sm btn-ghost" onclick="Router.navigate({view:'editor', params:{type:'tabiya'}})">Editor</button>
    </div>
  </div>
</div>
```

### Do the same for Tactics (lines ~46-53)
```html
<div class="list-header">
  <div class="list-header-top">
    <h2>Tactics</h2>
    <button class="btn btn-primary btn-sm" onclick="Router.navigate({view:'addPosition', params:{type:'puzzle'}})">+ New Tactic</button>
  </div>
  <div class="list-header-bar">
    <div id="tactics-tag-filters" class="tag-row"></div>
    <div class="list-header-tools">
      <button class="btn btn-sm" onclick="randomFromList('puzzle')">Shuffle</button>
      <button class="btn btn-sm btn-ghost" onclick="Router.navigate({view:'bulkAdd', params:{type:'puzzle'}})">Bulk Add</button>
      <button class="btn btn-sm btn-ghost" onclick="Router.navigate({view:'editor', params:{type:'puzzle'}})">Editor</button>
    </div>
  </div>
</div>
```

### New CSS (add to style.css)
```css
.list-header {
  margin-bottom: var(--sp-4);
}
.list-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-3);
}
.list-header-top h2 {
  font-size: var(--fs-22);
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.02em;
}
.list-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.list-header-tools {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  flex-shrink: 0;
}
```

### What this creates

Row 1: `Tabiyas ...................... [+ New Tabiya]`
Row 2: `[Filter by tag...] [chips...]     [Shuffle] Bulk Add  Editor`

- Title and primary CTA are alone on top — clear hierarchy
- Filter takes up the left side of row 2 — it's the main interaction
- "Shuffle" is a normal button (you use it often)
- "Bulk Add" and "Editor" are ghost buttons (power-user tools, visually quiet)
- Everything on row 2 is the same height because they're all `btn-sm`

---

## Change 2: Compact position cards

### CSS changes in components.css

Change `.mini-board`:
```css
width: 100px;
height: 100px;
```

Change `.pos-item` padding:
```css
padding: var(--sp-2) var(--sp-3);
```

### JS template change in position-list.js

This is the ONLY JS change — modifying the HTML template string, not logic.

In both `renderTabiyasList()` and `renderTacticsList()`, change the card
template from:

```
<div class="pos-item" onclick="...">
  ${renderMiniBoard(p.fen)}
  <div class="title">${title}</div>
  <div>${tags}</div>
  <button class="...pos-item-delete">...</button>
</div>
```

To:

```
<div class="pos-item" onclick="...">
  ${renderMiniBoard(p.fen)}
  <div class="pos-item-info">
    <div class="title">${title}</div>
    <div class="pos-item-tags">${tags}</div>
  </div>
  <button class="...pos-item-delete">...</button>
</div>
```

### New CSS (add to components.css)
```css
.pos-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pos-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
```

This makes the title and tags stack vertically next to the thumbnail,
eliminating the void. The delete button stays on the far right.

---

## Change 3: Rename "Random" to "Shuffle" everywhere

In index.html, find every button with text "Random" and change to "Shuffle".
This includes:
- Tabiyas header (already done in Change 1)
- Tactics header (already done in Change 1)
- Detail view `detail-random-btn` — change label to "Shuffle"
- Any other occurrence

Do NOT change the JS function names (`randomFromList`, `randomFromDetail`).
Only change the visible button label text.

---

## Change 4: Labels — remove all-caps

In `style.css`, the `label` rule has:
```css
text-transform: uppercase;
letter-spacing: 0.06em;
```

Remove both properties.

Also remove `text-transform: uppercase` and `letter-spacing: 0.06em` from:
- `.tree-panel-header` in components.css
- `.quiz-answer h3` in components.css
- `.play-msg` in components.css
- `.games-table thead th` in tagfilter.css

---

## Files to change

1. `frontend/index.html` — header restructuring, button labels
2. `frontend/css/style.css` — list-header classes, label rule
3. `frontend/css/components.css` — mini-board size, pos-item padding,
   pos-item-info, pos-item-tags
4. `frontend/js/position-list.js` — card template string ONLY (wrap title
   and tags in a div). No logic changes.

## Files NOT to change

- All other JS files
- `frontend/css/tagfilter.css` (except removing uppercase from thead th)
- `backend/` anything
- `CLAUDE.md`

---

## Verification

1. Tabiyas: title and [+ New Tabiya] on row 1, filter + tools on row 2
2. Tactics: identical layout pattern
3. "Shuffle" appears instead of "Random" on every button
4. Position cards: thumbnail ~100px, title and tags stacked vertically beside it
5. No void/desert in the middle of cards
6. Ghost buttons (Bulk Add, Editor) are visually quieter than Shuffle
7. All buttons still work — click each one
8. Tag filter still works — type, select, clear
9. Labels are sentence case everywhere
10. No console errors
11. Responsive: narrow browser still looks reasonable
