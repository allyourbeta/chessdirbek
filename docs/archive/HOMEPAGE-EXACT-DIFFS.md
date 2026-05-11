# Homepage Design Fix — Exact Diffs

Apply these diffs exactly. Do not interpret, improvise, or add anything.

---

## Diff 1: index.html — header (lines 20-42)

Replace the ENTIRE block from `<header>` to `</header>` with:

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
      <button class="nav-new-btn" onclick="toggleNewMenu()">+ New ▾</button>
      <div class="nav-dropdown-menu" id="new-dropdown-menu" style="display:none">
        <button class="dd-primary" onclick="Router.navigate({view:'addPosition', params:{type:'puzzle'}}); closeNewMenu()">+ New Tactic</button>
        <button class="dd-primary" onclick="Router.navigate({view:'addPosition', params:{type:'tabiya'}}); closeNewMenu()">+ New Tabiya</button>
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

---

## Diff 2: index.html — tactics view (lines 58-87)

Replace the ENTIRE `<div id="view-tactics" ...>...</div>` block with:

```html
<div id="view-tactics" class="view active">
  <div class="tactics-landing">
    <div class="tactics-featured">
      <div id="tactics-featured-board" class="board-wrap"></div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-sm" onclick="flipFeaturedBoard()">Flip</button>
        <button class="btn btn-sm" onclick="loadRandomFeatured()">Shuffle</button>
      </div>
      <h3 id="tactics-featured-title" style="margin-top:12px;font-size:16px;font-weight:600;cursor:pointer"></h3>
      <div id="tactics-featured-tags" style="margin-top:4px"></div>
      <button class="btn btn-sm" style="margin-top:12px" onclick="toggleFeaturedEngine()">Show Engine</button>
      <div id="tactics-featured-engine" style="margin-top:8px"></div>
    </div>
    <div class="tactics-browse">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 style="font-size:20px;font-weight:700;color:var(--text)">Tactics</h2>
        <div id="tactics-tag-filters" class="tag-row"></div>
      </div>
      <div id="tactics-count" class="text-muted" style="font-size:13px;margin-bottom:12px"></div>
      <div id="tactics-list" class="pos-list"></div>
    </div>
  </div>
</div>
```

---

## Diff 3: style.css — replace header and nav CSS (lines 140-232)

Find the block starting with `header {` and ending with
`nav button:focus-visible { ... }`. Replace the ENTIRE block with:

```css
header {
  display: flex;
  align-items: center;
  padding: 12px var(--sp-6);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  position: sticky;
  top: 0;
  z-index: 20;
}
header h1 {
  font-size: var(--fs-20);
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
  flex-shrink: 0;
}
nav {
  display: flex;
  gap: 2px;
  align-items: center;
  margin: 0 auto;
}
nav button {
  position: relative;
  background: none;
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--fs-14);
  font-weight: 500;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: color .15s ease, background-color .15s ease;
}
nav button:hover { color: var(--text); background: var(--grey-050); }
nav button.active {
  color: var(--primary-700);
  background: var(--primary-050);
  font-weight: 600;
}
nav button:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

---

## Diff 4: style.css — replace nav-right and dropdown CSS (lines ~177-225)

Find the block starting with `.nav-right {` through `.nav-dropdown-divider { ... }`.
Replace the ENTIRE block with:

```css
.nav-right {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-shrink: 0;
}
.nav-new-btn {
  font-family: inherit;
  font-size: var(--fs-13);
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--primary-500);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}
.nav-new-btn:hover {
  background: var(--primary-600);
}
.nav-dropdown {
  position: relative;
}
.nav-dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  min-width: 180px;
  z-index: 50;
}
.nav-dropdown-menu button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  font-family: inherit;
  font-size: var(--fs-13);
  font-weight: 400;
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
.nav-dropdown-menu button.dd-primary {
  font-weight: 600;
  color: var(--primary-700);
}
.nav-dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
```

---

## Diff 5: components.css — replace tactics-landing CSS (lines ~541-562)

Replace the entire `.tactics-landing` / `.tactics-featured` /
`.tactics-browse` block and its media query with:

```css
.tactics-landing {
  display: grid;
  grid-template-columns: 450px 1fr;
  gap: 40px;
  align-items: start;
}
.tactics-featured {
  min-width: 0;
}
.tactics-browse {
  min-width: 0;
}
@media (max-width: 960px) {
  .tactics-landing {
    grid-template-columns: 1fr;
  }
}
```

---

## Diff 6: components.css — board color override

Add this at the END of components.css:

```css
/* Match cm-chessboard square colors to mini-board thumbnails */
.cm-chessboard .board .square.white {
  fill: var(--light-sq);
}
.cm-chessboard .board .square.black {
  fill: var(--dark-sq);
}
```

If this does not change the board colors (because the CSS selectors don't
match cm-chessboard's internal structure), try these alternatives one at
a time until one works:

```css
.cm-chessboard .square.white { fill: var(--light-sq); }
.cm-chessboard .square.black { fill: var(--dark-sq); }
```

Or:

```css
.cm-chessboard rect.square.white { fill: var(--light-sq); }
.cm-chessboard rect.square.black { fill: var(--dark-sq); }
```

Test by opening the page and visually confirming the featured board
matches the card thumbnail colors.

---

## Diff 7: router.js — default route

Line 49, change:
```js
if (!parts.length) return { view: 'tabiyas', params: q };
```
to:
```js
if (!parts.length) return { view: 'tactics', params: q };
```

Line 94, change:
```js
return { view: 'tabiyas', params: q };
```
to:
```js
return { view: 'tactics', params: q };
```

---

## Files changed

1. `frontend/index.html` — header and tactics view HTML
2. `frontend/css/style.css` — header, nav, dropdown CSS
3. `frontend/css/components.css` — tactics-landing layout, board color override
4. `frontend/js/router.js` — two lines for default route

## NO other files changed.

---

## Verification

1. `localhost:8000` loads the Tactics tab
2. Nav: logo left, 4 tabs centered, "+ New ▾" solid indigo button right
3. Dropdown opens on click, closes on click outside
4. Featured board on left (450px), card grid on right
5. 40px gap between the two columns
6. No card border around featured board
7. Featured board and card thumbnails use same square colors
8. All nav items, dropdown items, buttons still work
9. No console errors
