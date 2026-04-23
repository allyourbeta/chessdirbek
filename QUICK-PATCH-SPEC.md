# Quick Patch — Grid Spacing + FEN Live Update

## Change 1: Double the grid gap for position cards

In `frontend/css/components.css`, find the `.pos-list` rule and change the
gap to `var(--sp-8)` (32px):

```css
.pos-list {
  gap: var(--sp-8);
}
```

Leave `grid-template-columns` as-is.

---

## Change 2: FEN must update on EVERY position change

The FEN display below the board must update in ALL of these scenarios:

1. User drags a piece (analysis mode)
2. User clicks navigation buttons (|< < > >|)
3. User starts/plays a practice game
4. Page loads initially

In `frontend/js/position-detail.js`, find the `loadPositionDetail` function.
There are two callbacks that must BOTH update the FEN:

### Callback 1: onPositionChange (fires when user drags a piece)

Find the `onPositionChange` callback inside `BoardManager.create()`. It must
include:

```js
var fenEl = document.getElementById('detail-fen');
if (fenEl) fenEl.textContent = newFen;
```

### Callback 2: onNavigate (fires when user clicks nav buttons)

Find the `onNavigate` callback inside `MoveNavigator.create()`. It must
include:

```js
var fenEl = document.getElementById('detail-fen');
if (fenEl) fenEl.textContent = fen;
```

### Verify both exist

Open `position-detail.js` and confirm BOTH callbacks contain the FEN update
line. If either is missing, add it. Do not remove any existing lines in
these callbacks — only add the FEN update if it's missing.

---

## Files to change

1. `frontend/css/components.css` — pos-list gap
2. `frontend/js/position-detail.js` — ensure FEN update in both callbacks

## Files NOT to change

Everything else.

---

## Verification

1. Position cards have generous spacing between them
2. Open a tabiya detail page — FEN shows below the board
3. Drag a piece on the board — FEN updates immediately
4. Click nav buttons (< >) — FEN updates
5. Click |< to go back to start — FEN shows starting position
6. No console errors
