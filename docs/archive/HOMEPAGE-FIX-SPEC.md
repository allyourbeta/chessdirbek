# Homepage Fix Spec — Default Route + Board Colors + Layout Polish

## Problem

Three issues with the current tactics landing page:

1. `localhost:8000` defaults to Tabiyas, not Tactics
2. Featured board (cm-chessboard) uses different square colors than the
   card thumbnails (mini-board), creating a jarring mismatch
3. The layout needs polish — spacing, proportions

---

## Fix 1: Default route to Tactics

### router.js

Line 49: change `'tabiyas'` to `'tactics'`:
```js
if (!parts.length) return { view: 'tactics', params: q };
```

Line 94 (fallback at end of parse): change `'tabiyas'` to `'tactics'`:
```js
return { view: 'tactics', params: q };
```

### shared.js

The `default:` case in `renderRoute` (around line 206) already routes to
tactics. Verify it does — if not, change it to:
```js
default:
    _activateView('tactics', 'Tactics');
    mountTacticsTagFilter();
    loadTactics().then(function() { loadRandomFeatured(); });
```

---

## Fix 2: Match board square colors

The mini-board thumbnails use CSS variables `--light-sq: #EEE5CF` and
`--dark-sq: #7B8FAA`. The cm-chessboard (featured board, detail boards,
game viewer boards) uses its own default theme from the CDN CSS.

Override cm-chessboard's square colors to match the mini-boards. Add this
CSS to `style.css` (after the cm-chessboard CSS import, so it overrides):

```css
/* Match cm-chessboard square colors to mini-board thumbnails */
.cm-chessboard .square.white {
  fill: var(--light-sq);
}
.cm-chessboard .square.black {
  fill: var(--dark-sq);
}
```

If the cm-chessboard CSS uses different class names for squares, inspect
the actual rendered SVG to find the correct selectors. The key is: ALL
boards everywhere in the app must use the same two colors for light and
dark squares.

### Alternative if CSS override doesn't work

cm-chessboard v8 supports custom themes via the `style.cssClass` prop.
In `board.js`, when creating boards, the config already sets
`cssClass: "default"`. If CSS override isn't sufficient, create a custom
CSS class that defines the square colors and use that instead of "default".

---

## Fix 3: Layout polish

### Tactics landing grid — increase gap

In `components.css`, change `.tactics-landing`:
```css
.tactics-landing {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--sp-8);
  align-items: start;
}
```

Changed `gap` from `var(--sp-6)` (24px) to `var(--sp-8)` (32px).

### Featured card — remove the card wrapper border

The featured tactic is wrapped in a `.card` div which adds a border and
background. Remove the card wrapper — let the board sit directly in the
featured column. The board itself has enough visual weight.

In `index.html`, change the featured section from:
```html
<div class="tactics-featured">
  <div class="card" style="padding:var(--sp-4)">
    <div id="tactics-featured-board" class="board-wrap"></div>
    ...
  </div>
</div>
```

To:
```html
<div class="tactics-featured">
  <div id="tactics-featured-board" class="board-wrap"></div>
  <div class="board-controls">
    <div class="control-group">
      <button class="btn btn-sm" onclick="flipFeaturedBoard()">Flip</button>
      <button class="btn btn-sm" onclick="loadRandomFeatured()">Shuffle</button>
    </div>
  </div>
  <h3 id="tactics-featured-title" style="margin-top:var(--sp-3);font-size:var(--fs-16);font-weight:600;cursor:pointer"></h3>
  <div id="tactics-featured-tags" style="margin-top:var(--sp-1)"></div>
  <button class="btn btn-sm" id="tactics-engine-btn" onclick="toggleFeaturedEngine()" style="margin-top:var(--sp-3)">Show Engine</button>
  <div id="tactics-featured-engine" style="margin-top:var(--sp-2)"></div>
</div>
```

No card wrapper. The board, controls, title, tags, and engine sit directly
in the featured column.

### Card grid — more breathing room

In `components.css`, change `.pos-list`:
```css
.pos-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--sp-5);
}
```

The `minmax(200px, 1fr)` ensures cards aren't too wide in the tactics
browse column (which is narrower than a full-width page).

### Browse header — simpler

The tactics browse header currently has a `list-header` with nested divs.
Simplify to just the title and filter on one line:

```html
<div class="tactics-browse">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3)">
    <h2 style="font-size:var(--fs-18);font-weight:700">Tactics</h2>
    <div id="tactics-tag-filters" class="tag-row"></div>
  </div>
  <div id="tactics-count" class="text-muted" style="font-size:13px;margin-bottom:var(--sp-3)"></div>
  <div id="tactics-list" class="pos-list"></div>
</div>
```

---

## Files to change

1. `frontend/js/router.js` — lines 49 and 94, change default from
   'tabiyas' to 'tactics'
2. `frontend/css/style.css` — add cm-chessboard square color overrides
3. `frontend/css/components.css` — tactics-landing gap, pos-list grid
4. `frontend/index.html` — tactics featured section (remove card wrapper),
   tactics browse header (simplify)

## Files NOT to change

- All JS files except router.js
- Backend files
- CLAUDE.md

---

## Verification

1. Navigate to `localhost:8000` — lands on Tactics tab with featured board
2. Featured board and card thumbnails use the SAME square colors
3. Featured board has no card border — sits directly in the column
4. Comfortable gap between featured board and card grid
5. Card grid shows 2 columns of compact cards
6. Click "+ New ▾" dropdown — all items work
7. Click a card — navigates to detail page
8. Click Shuffle — loads different tactic
9. Click Flip — flips featured board
10. Navigate to Tabiyas — still works
11. Navigate to Games, Search — still work
12. No console errors
