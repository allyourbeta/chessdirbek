# UI Refinements Spec — Tags, FEN, Engine, Grid Spacing

## Goal

Four targeted improvements. No new features. Reduce friction and improve
layout coherence on the detail and form views.

---

## Change 1: Card grid spacing

The position card grid is slightly too cramped. Increase spacing and minimum
card width.

### CSS change in components.css

Find `.pos-list` grid rule and change:
```css
.pos-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--sp-5);
}
```

(The previous values were likely `minmax(240px, 1fr)` and `gap: var(--sp-4)`.)

---

## Change 2: Replace comma-separated tag inputs with TagFilter chips

There are THREE places that use a plain text input for tags with
comma-separated entry. All three must switch to the `TagFilter` component
(already built in `tagfilter.js`).

### The three locations

1. **Add/Edit form** — `<input id="pos-tags">` in index.html (~line 77)
2. **Board editor** — `<input id="editor-pos-tags">` in index.html (~line 420)
3. **Save position modal** — `<input id="save-pos-tags">` in index.html (~line 504)

### For each location, the change is:

#### HTML: Replace the `<input>` with a container div

Example for the add form:
```html
<label>Tags</label>
<div id="pos-tags-container"></div>
```

Same pattern for the other two:
```html
<div id="editor-pos-tags-container"></div>
<div id="save-pos-tags-container"></div>
```

#### JS: Mount TagFilter on the container

For each form, at initialization time, mount TagFilter:

```js
// Create a state object to hold the tags
var formTagState = { tags: [] };

TagFilter.mount({
    containerId: 'pos-tags-container',
    state: formTagState,
    onChange: function(tags) { /* tags array is already in formTagState.tags */ },
    placeholder: 'Add tags...'
});
```

#### JS: Read tags from the state object instead of the input

Everywhere the code currently does:
```js
document.getElementById('pos-tags').value.split(',').map(t => t.trim()).filter(Boolean)
```

Replace with:
```js
formTagState.tags.slice()
```

#### JS: Pre-populate tags when editing

When editing an existing position, set `formTagState.tags = existingTags`
and re-mount or re-render the TagFilter.

### Files that need changes for each tag input:

**Add/Edit form (`pos-tags`)**:
- `frontend/index.html` — replace input with container div
- `frontend/js/position-form.js` — mount TagFilter, read from state,
  pre-populate on edit, clear on clearForm()

**Board editor (`editor-pos-tags`)**:
- `frontend/index.html` — replace input with container div
- `frontend/js/board-editor.js` — mount TagFilter in init(), read from
  state in save()

**Save position modal (`save-pos-tags`)**:
- `frontend/index.html` — replace input with container div
- `frontend/js/game-viewer.js` — mount TagFilter in showSavePositionModal(),
  read from state in doSavePosition()

### Important: TagFilter component API

TagFilter is already defined in `tagfilter.js`. It exports:
```js
window.TagFilter = { mount: mount }
```

The `mount` function takes `{ containerId, state, onChange, placeholder }`.
The `state` object must have a `tags` array. The component mutates
`state.tags` directly and calls `onChange` when tags change.

The component handles: autocomplete from existing tags via the API,
Enter to add, chip display with X to remove, dropdown suggestions.

### Pre-populating for edit mode

When editing a position, the existing tags come as an array of objects
`[{name: 'endgame'}, {name: 'tactics'}]`. Convert to string array
`['endgame', 'tactics']` and set `formTagState.tags = stringArray` before
mounting.

---

## Change 3: Move FEN below the board with live updates

### Current state
FEN is in the right panel as a collapsible card. It shows the original
position FEN and doesn't update when the user makes moves.

### New behavior
- Remove the FEN collapsible card from the right panel
- Add a FEN display directly below the board (below the move navigation row)
- The FEN updates whenever the board position changes (moves, navigation)
- Include a small "Copy" button next to the FEN

### HTML changes in index.html

Remove the entire FEN card block from the right panel (the `<div class="card
collapsible-card" id="fen-card">...</div>` block, approximately lines 249-258).

Add below the board controls (after the btn-row / board-controls div, inside
the left column card):

```html
<div class="fen-bar" style="margin-top:var(--sp-2)">
  <code id="detail-fen" class="fen-display" style="flex:1"></code>
  <button class="btn btn-sm" onclick="event.stopPropagation();copyFen()" title="Copy FEN">Copy</button>
</div>
```

### CSS (add to components.css)
```css
.fen-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
```

### JS changes in position-detail.js

The FEN should update whenever the board position changes. In
`loadPositionDetail()`, the board is created with an `onPositionChange`
callback. Add FEN update there:

```js
onPositionChange: function (newFen) {
    MoveNavigator.push('detail-nav', newFen);
    EngineUI.setPosition(newFen);
    document.getElementById('detail-fen').textContent = newFen;
},
```

Also update FEN when navigating with MoveNavigator:
```js
onNavigate: function (fen) {
    EngineUI.setPosition(fen);
    document.getElementById('detail-fen').textContent = fen;
},
```

The initial FEN is already set on line 9: `document.getElementById('detail-fen').textContent = pos.fen;` — this stays.

Also remove the `toggleCollapsible` references for `fen-card` and the
`_initCollapsibleCards` logic that deals with `fen-card`.

---

## Change 4: Move engine below the board

### Current state
The engine analysis panel is in the right column as a card
(`<div id="detail-engine-container" class="card"></div>`, line 272).

### New behavior
Move it to the left column, below the FEN bar. The engine analyzes the
position on the board — it belongs next to the board.

### HTML changes in index.html

Remove `<div id="detail-engine-container" class="card"></div>` from the
right panel.

Add it in the left column, after the FEN bar:
```html
<div id="detail-engine-container" style="margin-top:var(--sp-2)"></div>
```

Note: do NOT add the `card` class here — `EngineUI.mount()` renders its
own panel HTML inside this container.

### JS changes

None — `EngineUI.mount('detail-engine-container')` works regardless of
where the container div lives in the DOM. The ID is the same.

---

## Files to change

1. `frontend/index.html` — tag input replacements (3 locations), FEN card
   removal, FEN bar addition, engine container move
2. `frontend/css/components.css` — grid spacing, fen-bar
3. `frontend/js/position-form.js` — TagFilter mount, read tags from state,
   clear/pre-populate
4. `frontend/js/board-editor.js` — TagFilter mount in init(), read from
   state in save()
5. `frontend/js/game-viewer.js` — TagFilter mount in modal show, read from
   state in save
6. `frontend/js/position-detail.js` — update FEN on position change and
   navigation, remove fen-card collapsible logic

## Files NOT to change

- `frontend/js/tagfilter.js` — the component is already built
- `frontend/js/engine-ui.js` — no changes needed
- `frontend/js/stockfish-service.js` — no changes needed
- Backend files
- CLAUDE.md

---

## Verification

1. **Card grid**: position cards have comfortable spacing, not cramped
2. **Add form tags**: type a tag name, see autocomplete, press Enter, chip
   appears. Click X to remove. No comma-separated input anywhere.
3. **Board editor tags**: same chip behavior
4. **Save position modal tags**: same chip behavior
5. **Saving works**: save a position with tags via chips. Verify tags appear
   on the saved position.
6. **Editing preserves tags**: edit a position — existing tags appear as
   chips. Add/remove tags. Save. Verify.
7. **FEN below board**: FEN string visible below the board, not in right panel
8. **FEN updates on moves**: drag a piece on the board, FEN updates. Step
   through moves with nav buttons, FEN updates.
9. **Copy FEN**: click Copy button, paste elsewhere — correct FEN
10. **Engine below board**: "Show Engine" appears below the FEN, analysis
    lines render below the board
11. **Engine still works**: click Show Engine, lines appear. Make a move,
    lines update.
12. **Right panel cleaner**: only title/tags, notes, actions, practice
13. **No console errors**
14. **All other views still work**
