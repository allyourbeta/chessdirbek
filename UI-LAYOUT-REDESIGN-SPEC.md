# UI Layout Redesign Spec

## Goal

Make the app look designed instead of generated. The content is right — the
layout is wrong. This spec restructures spacing, containers, and the position
card format to create visual coherence. NO functionality changes.

---

## Change 1: Navigation bar — bigger, more presence

The nav bar is too thin and the text too small for 5 items. It should feel
like the app's spine, not an afterthought.

### CSS changes in style.css

```css
header {
  padding: var(--sp-4) var(--sp-6);
}
header h1 {
  font-size: var(--fs-22);
}
nav { gap: var(--sp-1); }
nav button {
  font-size: var(--fs-15);
  padding: 8px var(--sp-4);
  border-radius: var(--radius-md);
}
```

This makes the logo bigger (22px), the nav items bigger (15px) with more
padding, and the overall header taller. Feels substantial.

---

## Change 2: Position cards — vertical grid instead of horizontal strips

This is the biggest visual change. Currently each position is a full-width
horizontal strip with a thumbnail on the left and a trash icon on the far
right, with a desert of whitespace in between.

### New layout: 2-up card grid

Each card is a vertical unit:
- Board thumbnail on top (fills the card width)
- Title below the board
- Tags below the title
- Delete icon in the top-right corner of the card

### CSS changes in components.css

Replace `.pos-list` and `.pos-item`:

```css
.pos-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--sp-4);
}
.pos-item {
  display: flex;
  flex-direction: column;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color .12s ease, box-shadow .12s ease;
  box-shadow: var(--shadow-xs);
  overflow: hidden;
  position: relative;
  min-width: 0;
}
.pos-item:hover {
  border-color: var(--primary-300);
  box-shadow: var(--shadow-sm);
}
```

Replace `.mini-board` sizing:

```css
.mini-board {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  border-radius: 0;
  box-shadow: none;
}
```

Add new card interior classes:

```css
.pos-item-body {
  padding: var(--sp-3);
}
.pos-item .title {
  font-size: var(--fs-14);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--sp-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pos-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.pos-item-delete {
  position: absolute;
  top: var(--sp-2);
  right: var(--sp-2);
  background: rgba(255,255,255,0.85);
  border-radius: var(--radius);
  padding: 4px 6px;
  opacity: 0;
  transition: opacity .15s;
}
.pos-item:hover .pos-item-delete {
  opacity: 1;
}
```

### JS template change in position-list.js

Change both `renderTabiyasList()` and `renderTacticsList()` card templates.

From:
```js
`<div class="pos-item" onclick="showDetail(${p.id})">${renderMiniBoard(p.fen)}<div class="title">${title}</div><div>${tags}</div><button class="...pos-item-delete" onclick="...">...</button></div>`
```

To:
```js
`<div class="pos-item" onclick="showDetail(${p.id})">
  ${renderMiniBoard(p.fen)}
  <div class="pos-item-body">
    <div class="title">${p.title || 'Untitled'}</div>
    <div class="pos-item-tags">${p.tags.map(t => '<span class="tag">#' + t.name + '</span>').join('')}</div>
  </div>
  <button class="btn btn-sm btn-ghost pos-item-delete" onclick="event.stopPropagation();deleteFromList(${p.id},'TYPE')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
</div>`
```

Replace `TYPE` with `'tabiya'` in renderTabiyasList and `'puzzle'` in
renderTacticsList (same as current code). The only change is the wrapper
structure — the onclick, IDs, and logic stay identical.

---

## Change 3: List view headers

### Tabiyas (index.html lines ~34-41)

Replace:
```html
<div class="view-header">
  <h2>Tabiyas</h2>
  <button ...>+ New Tabiya</button>
  <button ...>Bulk Add</button>
  <button ...>Editor</button>
  <button ...>Random</button>
  <div id="tabiyas-tag-filters" class="tag-row"></div>
</div>
```

With:
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

### Tactics (lines ~46-53)

Same pattern:
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

### CSS (add to style.css)

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
  font-size: var(--fs-24);
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

---

## Change 4: Games table container

Wrap the games table in a card container for visual framing.

In index.html, the games list div:
```html
<div id="games-list" class="pos-list"></div>
```

Change to:
```html
<div class="card" style="padding:0;overflow:hidden">
  <div id="games-list"></div>
</div>
```

Remove the `pos-list` class from games-list — the games view uses a table,
not the position card grid. The `.card` wrapper gives it a border, background,
and rounded corners.

---

## Change 5: Board editor — unified container

The board editor has two columns (board + palette on left, form on right) that
float independently. Wrap them in a shared card.

In index.html, the editor view (around line 392):

Find the `<div class="board-area">` inside `view-editor` and add a card
wrapper around it:

```html
<div class="card" style="padding:var(--sp-4)">
  <div class="board-area">
    ...existing board + panel content...
  </div>
</div>
```

This puts both columns inside a single bordered container so they read as
one unit.

---

## Change 6: Below-board controls — grouped

Every board has controls below it that are currently in one flat row.
Group them.

### CSS (add to components.css)

```css
.board-controls {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  margin-top: var(--sp-3);
  flex-wrap: wrap;
}
.control-group {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}
```

### Apply to detail view (lines ~233-239)

Replace:
```html
<div class="btn-row" style="margin-top:12px">
  <span id="detail-move-nav" ...></span>
  <button ... >Flip</button>
  <button ... >+ Tabiya</button>
  <button ... >+ Tactic</button>
  <button ... id="detail-random-btn">Random</button>
</div>
```

With:
```html
<div class="board-controls">
  <div class="control-group">
    <span id="detail-move-nav" style="display:inline-flex;gap:4px;align-items:center"></span>
    <button class="btn btn-sm" onclick="flipDetailBoard()">Flip</button>
  </div>
  <div class="control-group">
    <button class="btn btn-success btn-sm" onclick="saveBoardPosition('detail-board','tabiya')">+ Tabiya</button>
    <button class="btn btn-success btn-sm" onclick="saveBoardPosition('detail-board','puzzle')">+ Tactic</button>
  </div>
  <div class="control-group">
    <button class="btn btn-sm" id="detail-random-btn" onclick="randomFromDetail()">Shuffle</button>
  </div>
</div>
```

### Apply to game viewer (lines ~127-134)

Replace the `<div class="nav-btns">` with:
```html
<div class="board-controls">
  <div class="control-group">
    <span id="gv-move-nav" style="display:inline-flex;gap:4px;align-items:center"></span>
    <button class="btn btn-sm" onclick="gvFlip()">Flip</button>
    <button class="btn btn-sm" onclick="undoGameBoard()">Undo</button>
    <button class="btn btn-sm" onclick="resetGameBoard()">Reset</button>
  </div>
  <div class="control-group">
    <button class="btn btn-success btn-sm" onclick="saveBoardPosition('game-board','tabiya')">+ Tabiya</button>
    <button class="btn btn-success btn-sm" onclick="saveBoardPosition('game-board','puzzle')">+ Tactic</button>
  </div>
</div>
```

### Apply to search view (lines ~170-175)

Same pattern for the buttons below the search board.

---

## Change 7: Labels — remove all-caps

In style.css, the `label` rule:
- Remove `text-transform: uppercase`
- Remove `letter-spacing: 0.06em`

Also remove from: `.tree-panel-header`, `.quiz-answer h3`, `.play-msg`,
`.games-table thead th`.

---

## Change 8: Rename "Random" to "Shuffle"

Change every button label that says "Random" to "Shuffle". This includes
buttons in: Tabiyas header, Tactics header, detail view, and anywhere else.

Do NOT change JS function names — only the visible text in HTML.

---

## Files to change

1. `frontend/index.html` — header restructuring, board control grouping,
   editor wrapper, games wrapper, button labels
2. `frontend/css/style.css` — nav sizing, list-header classes, label rule
3. `frontend/css/components.css` — pos-list grid, pos-item vertical card,
   mini-board responsive, board-controls, control-group, pos-item-delete
   hover reveal
4. `frontend/js/position-list.js` — card template HTML only (vertical layout
   with pos-item-body wrapper). No logic changes.

## Files NOT to change

- All other JS files
- Backend files
- CLAUDE.md

---

## Verification

1. Position cards display in a 2-3 column grid (not full-width strips)
2. Each card: board on top, title + tags below, delete appears on hover
3. Nav bar feels substantial — larger text, more padding
4. Tabiyas/Tactics headers: title + CTA on row 1, filter + tools on row 2
5. Board editor: both columns sit inside a single card container
6. Games table: wrapped in a card with border and rounded corners
7. Below-board controls: navigation grouped, save actions grouped, separated
8. Labels: sentence case everywhere
9. "Shuffle" instead of "Random" on all buttons
10. ALL buttons still work — click through each one on every view
11. Tag filters still work
12. Responsive: narrow browser still usable
13. No console errors
14. No JS functionality changed
