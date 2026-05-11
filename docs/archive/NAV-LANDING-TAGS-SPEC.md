# Nav Redesign + Tactics Landing + Tag Chips Spec

## Overview

Three changes bundled together:
1. Nav bar redesign with "+ New" dropdown (Option 1)
2. Tactics tab becomes the default landing page with a featured random tactic
3. All comma-separated tag inputs replaced with TagFilter chip component

---

## Change 1: Nav bar — "+ New" dropdown

### Current nav
```
[ChessQuiz]    [Tabiyas] [Tactics] [Games] [Search] [Import PGN] [🔊]
```

Seven items crammed to the right. Import PGN and creator tools (Bulk Add,
Editor) are scattered — some in nav, some in list headers.

### New nav
```
[♞ ChessQuiz]        [Tactics] [Tabiyas] [Games] [Search]        [+ New ▾] [🔊]
```

- Logo on the left
- Four browse tabs centered
- "+ New" dropdown button on the right
- Tactics is first (it's the default/landing tab)
- Sound toggle stays at far right

### "+ New" dropdown contents

When clicked, shows a dropdown menu with:
- **+ New Tactic** (bold — primary action)
- **+ New Tabiya** (bold — primary action)
- **Bulk Add** (normal weight)
- **Editor** (normal weight)
- **Import PGN** (normal weight)

### HTML changes in index.html

Replace the entire `<header>...</header>` block:

```html
<header>
  <h1>♞ ChessQuiz</h1>
  <nav>
    <button onclick="Router.navigate({view:'tactics'})">Tactics</button>
    <button onclick="Router.navigate({view:'tabiyas'})">Tabiyas</button>
    <button onclick="Router.navigate({view:'games'})">Games</button>
    <button onclick="Router.navigate({view:'search'})">Search</button>
  </nav>
  <div class="nav-right">
    <div class="nav-dropdown" id="new-dropdown">
      <button class="btn btn-primary btn-sm" onclick="toggleNewMenu()">+ New ▾</button>
      <div class="nav-dropdown-menu" id="new-dropdown-menu" style="display:none">
        <button onclick="Router.navigate({view:'addPosition', params:{type:'puzzle'}}); closeNewMenu()">+ New Tactic</button>
        <button onclick="Router.navigate({view:'addPosition', params:{type:'tabiya'}}); closeNewMenu()">+ New Tabiya</button>
        <div class="nav-dropdown-divider"></div>
        <button onclick="Router.navigate({view:'bulkAdd'}); closeNewMenu()">Bulk Add</button>
        <button onclick="Router.navigate({view:'editor'}); closeNewMenu()">Editor</button>
        <button onclick="Router.navigate({view:'gameImport'}); closeNewMenu()">Import PGN</button>
      </div>
    </div>
    <button class="mute-btn" onclick="toggleMute()" id="mute-btn" title="Toggle sound">&#x1f50a;</button>
  </div>
</header>
```

### JS for dropdown (add to shared.js)

```js
function toggleNewMenu() {
    var menu = document.getElementById('new-dropdown-menu');
    if (menu) menu.style.display = menu.style.display === 'none' ? '' : 'none';
}
function closeNewMenu() {
    var menu = document.getElementById('new-dropdown-menu');
    if (menu) menu.style.display = 'none';
}
// Close menu when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('#new-dropdown')) closeNewMenu();
});

window.toggleNewMenu = toggleNewMenu;
window.closeNewMenu = closeNewMenu;
```

### CSS (add to style.css)

```css
header {
  display: flex;
  align-items: center;
  padding: var(--sp-4) var(--sp-6);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  position: sticky;
  top: 0;
  z-index: 20;
}
header h1 {
  font-size: var(--fs-22);
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
  flex-shrink: 0;
}
nav {
  display: flex;
  gap: var(--sp-1);
  align-items: center;
  margin: 0 auto;
}
nav button {
  font-size: var(--fs-15);
  padding: 8px var(--sp-4);
  border-radius: var(--radius-md);
}
.nav-right {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-shrink: 0;
}
.nav-dropdown {
  position: relative;
}
.nav-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--sp-1);
  min-width: 180px;
  z-index: 50;
}
.nav-dropdown-menu button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px var(--sp-3);
  font-family: inherit;
  font-size: var(--fs-14);
  color: var(--text);
  background: none;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.1s;
}
.nav-dropdown-menu button:hover {
  background: var(--primary-050);
  color: var(--primary-700);
}
.nav-dropdown-menu button:first-child,
.nav-dropdown-menu button:nth-child(2) {
  font-weight: 600;
  color: var(--primary-700);
}
.nav-dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: var(--sp-1) 0;
}
```

---

## Change 2: Tactics as default landing with featured random tactic

### Current behavior
The app defaults to the Tabiyas tab. The Tactics tab shows only a list.

### New behavior
- Tactics is the default tab (loads on startup)
- The Tactics tab has a two-column layout:
  - **Left**: a board showing a random tactic, with controls (Flip, Shuffle,
    Show Engine) and the position title below it
  - **Right**: the tactics card grid (same as current)
- Clicking a card in the grid navigates to the detail page (no change)
- "Shuffle" on the featured board loads another random tactic

### HTML changes in index.html

Replace the current tactics view:

```html
<div id="view-tactics" class="view">
  <div class="tactics-landing">
    <div class="tactics-featured">
      <div class="card" style="padding:var(--sp-4)">
        <div id="tactics-featured-board" class="board-wrap"></div>
        <div class="board-controls">
          <div class="control-group">
            <button class="btn btn-sm" onclick="flipFeaturedBoard()">Flip</button>
            <button class="btn btn-sm" onclick="loadRandomFeatured()">Shuffle</button>
          </div>
        </div>
        <h3 id="tactics-featured-title" style="margin-top:var(--sp-3);font-size:var(--fs-16);font-weight:600"></h3>
        <div id="tactics-featured-tags" style="margin-top:var(--sp-1)"></div>
        <div id="tactics-featured-engine" style="margin-top:var(--sp-2)"></div>
      </div>
    </div>
    <div class="tactics-browse">
      <div class="list-header">
        <div class="list-header-top">
          <h2>Tactics</h2>
        </div>
        <div class="list-header-bar">
          <div id="tactics-tag-filters" class="tag-row"></div>
        </div>
      </div>
      <div id="tactics-count" class="text-muted" style="font-size:13px;margin-bottom:4px"></div>
      <div id="tactics-list" class="pos-list"></div>
    </div>
  </div>
</div>
```

Note: the "+ New Tactic", "Bulk Add", "Editor" buttons are REMOVED from
the list header — they now live in the nav dropdown.

### CSS (add to style.css or components.css)

```css
.tactics-landing {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--sp-6);
  align-items: start;
}
.tactics-featured {
  width: 450px;
  flex-shrink: 0;
}
.tactics-browse {
  min-width: 0;
}
@media (max-width: 960px) {
  .tactics-landing {
    grid-template-columns: 1fr;
  }
  .tactics-featured {
    width: 100%;
    max-width: 450px;
  }
}
```

### JS changes

Add to position-list.js (or a new file if it would exceed 300 lines):

```js
function loadRandomFeatured() {
    var tactics = AppState.allPositions.filter(function(p) {
        return p.position_type === 'puzzle';
    });
    if (!tactics.length) return;
    var pick = tactics[Math.floor(Math.random() * tactics.length)];
    AppState.featuredTacticId = pick.id;
    BoardManager.create('tactics-featured-board', pick.fen, {
        mode: 'analysis',
        onPositionChange: function(newFen) {
            EngineUI.setPosition(newFen);
        },
    });
    EngineUI.mount('tactics-featured-engine');
    EngineUI.setPosition(pick.fen);
    document.getElementById('tactics-featured-title').textContent = pick.title || 'Untitled';
    document.getElementById('tactics-featured-tags').innerHTML =
        pick.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    // Click the title or board to go to detail
    document.getElementById('tactics-featured-title').onclick = function() {
        showDetail(pick.id);
    };
    document.getElementById('tactics-featured-title').style.cursor = 'pointer';
}

function flipFeaturedBoard() {
    BoardManager.flip('tactics-featured-board');
}

window.loadRandomFeatured = loadRandomFeatured;
window.flipFeaturedBoard = flipFeaturedBoard;
```

### Update renderRoute in shared.js

In the `'tactics'` case, after `loadTactics()`, add:
```js
loadRandomFeatured();
```

So the full case becomes:
```js
case 'tactics':
    _applyPositionFilters(params);
    _activateView('tactics', 'Tactics');
    mountTacticsTagFilter();
    loadTactics().then(function() { loadRandomFeatured(); });
    break;
```

Note: `loadRandomFeatured()` must run AFTER `loadTactics()` completes
because it reads from `AppState.allPositions`.

### Change default route

In shared.js, change the `default:` case:
```js
default:
    _activateView('tactics', 'Tactics');
    mountTacticsTagFilter();
    loadTactics().then(function() { loadRandomFeatured(); });
```

In index.html, change the initial active view from:
```html
<div id="view-tabiyas" class="view active">
```
to:
```html
<div id="view-tabiyas" class="view">
```

And change:
```html
<div id="view-tactics" class="view">
```
to:
```html
<div id="view-tactics" class="view active">
```

### Tabiyas list header cleanup

Since creator tools moved to the nav dropdown, simplify the Tabiyas header:

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

---

## Change 3: Replace ALL comma-separated tag inputs with TagFilter chips

There are FIVE locations. ALL must be converted.

### Location 1: Add/edit form (`pos-tags`)

**index.html**: Replace `<input type="text" id="pos-tags" ...>` with:
```html
<div id="pos-tags-container"></div>
```

**position-form.js**: 
- Add a module-level variable: `var _formTagState = { tags: [] };`
- In `savePosition()`: replace `document.getElementById('pos-tags').value.split(',')...` with `_formTagState.tags.slice()`
- In `clearForm()`: replace `document.getElementById('pos-tags').value = ''` with `_formTagState.tags = []; TagFilter.mount({containerId:'pos-tags-container', state:_formTagState, onChange:function(){}, placeholder:'Add tags...'});`
- When editing (pre-populate): set `_formTagState.tags = existingTags.map(t => t.name)` then mount TagFilter
- At the end of `clearForm()` or on form init, mount TagFilter on the container
- Also update the `_origSavePosition` wrapper's lastTags saving to use `_formTagState.tags.join(', ')` instead of reading from the input

### Location 2: Board editor (`editor-pos-tags`)

**index.html**: Replace `<input type="text" id="editor-pos-tags" ...>` with:
```html
<div id="editor-pos-tags-container"></div>
```

**board-editor.js**:
- Add `var _editorTagState = { tags: [] };` inside the IIFE
- In `init()`: mount TagFilter on `editor-pos-tags-container` with `_editorTagState`
- In `save()`: replace `.value.split(',')...` with `_editorTagState.tags.slice()`
- In `init()`: reset `_editorTagState.tags = []` before mounting

### Location 3: Save position modal (`save-pos-tags`)

**index.html**: Replace `<input type="text" id="save-pos-tags">` with:
```html
<div id="save-pos-tags-container"></div>
```

**game-viewer.js**:
- Add a variable: `var _saveTagState = { tags: [] };`
- In `showSavePositionModal()`: mount TagFilter on `save-pos-tags-container`
- In `doSavePosition()`: replace `.value.split(',')...` with `_saveTagState.tags.slice()`

### Location 4: Bulk add (`bulk-tags-input`)

**index.html**: Replace `<input type="text" id="bulk-tags-input" ...>` with:
```html
<div id="bulk-tags-container"></div>
```

**bulk-add.js**:
- Add a variable for tag state
- In `init()`: mount TagFilter on `bulk-tags-container`
- In `run()`: replace `.value.split(',')...` with tag state `.tags.slice()`
- In `init()` reset: clear tag state before mounting

### Location 5: Import PGN (`import-tags`)

**index.html**: Replace `<input type="text" id="import-tags" ...>` with:
```html
<div id="import-tags-container"></div>
```

**import.js**:
- Add a variable for tag state
- In `resetImportView()`: mount TagFilter on `import-tags-container`
- In `doImport()`: replace `.value.split(',')...` with tag state `.tags.slice()`

### For ALL locations:
- Remove the label text "(comma separated)" — just say "Tags"
- TagFilter.mount takes `{containerId, state, onChange, placeholder}`
- `onChange` can be an empty function since we read from state directly
- Placeholder: `'Add tags...'`

---

## Files to change

1. `frontend/index.html` — nav restructure, tactics view restructure,
   tabiyas header cleanup, all 5 tag input replacements, default active view
2. `frontend/css/style.css` — nav centering, nav-right, nav-dropdown styles,
   tactics-landing grid
3. `frontend/css/components.css` — tactics-featured, board-controls if needed
4. `frontend/js/shared.js` — dropdown toggle/close functions, default route
   change, tactics route update
5. `frontend/js/position-list.js` — loadRandomFeatured, flipFeaturedBoard
6. `frontend/js/position-form.js` — TagFilter mount, read from state
7. `frontend/js/board-editor.js` — TagFilter mount, read from state
8. `frontend/js/game-viewer.js` — TagFilter mount, read from state
9. `frontend/js/bulk-add.js` — TagFilter mount, read from state
10. `frontend/js/import.js` — TagFilter mount, read from state

## Files NOT to change

- `frontend/js/tagfilter.js` — the component is complete
- `frontend/js/engine-ui.js`
- `frontend/js/stockfish-service.js`
- Backend files
- `frontend/js/board.js`

---

## Verification

### Nav
1. Four browse tabs centered in the nav bar
2. "+ New ▾" button on the right — click opens dropdown
3. Dropdown shows: New Tactic, New Tabiya, Bulk Add, Editor, Import PGN
4. Click a dropdown item — navigates correctly, dropdown closes
5. Click outside dropdown — it closes
6. No "Import PGN" in the main nav bar anymore

### Tactics landing
7. App loads to Tactics tab by default
8. Random tactic displayed on a board on the left
9. Title and tags shown below the board
10. "Shuffle" loads a different random tactic
11. "Flip" flips the board
12. Click the tactic title — navigates to detail page
13. Tactics card grid on the right — click a card navigates to detail
14. Navigate back — tactics landing reappears
15. Tag filter works on the grid

### Tabiyas
16. Tabiyas tab shows the card grid with just "Shuffle" in the header
17. No "Bulk Add" or "Editor" buttons (they're in the nav dropdown now)

### Tag chips (ALL FIVE locations)
18. Add form: type a tag, autocomplete appears, Enter adds chip, X removes
19. Board editor: same chip behavior
20. Save position modal: same chip behavior
21. Bulk add: same chip behavior
22. Import PGN: same chip behavior
23. Save a position with chip tags — tags appear correctly on saved position
24. Edit a position — existing tags appear as chips
25. No "(comma separated)" text anywhere

### General
26. All buttons work
27. No console errors
28. Responsive: narrow browser still usable
29. No JS file exceeds 300 lines
