# Phase 31: Search Page UX Improvements

Four small fixes to the position search page.

Run `scripts/backup_now.sh` before starting.

## Change 1: Reset Button After Search

After a search completes, show a "Reset" button that clears results, resets the board to empty (not starting position — see Change 2), clears the FEN input, and resets the status text.

**`frontend/index.html`** — In the search panel's button row (line 263 area), add a Reset button next to Search:
```html
<button class="btn" data-action="search-reset" id="search-reset-btn" style="display:none">Reset</button>
```

**`frontend/js/search.js`** — Add a `resetSearch()` function:
```javascript
function resetSearch() {
    var emptyFen = '8/8/8/8/8/8/8/8 w - - 0 1';
    AppState.searchFen = emptyFen;
    document.getElementById('search-fen').value = '';
    BoardManager.setPosition('search-board', emptyFen);
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-status').textContent = '';
    document.getElementById('search-reset-btn').style.display = 'none';
}
```

Show the Reset button after a search completes — in `doPositionSearch()`, after `renderSearchResults(data)`, add:
```javascript
document.getElementById('search-reset-btn').style.display = '';
```

**`frontend/js/action-handlers.js`** — Add handler for `search-reset`:
```javascript
case 'search-reset':
    resetSearch();
    break;
```

Expose `resetSearch` as a window global.

## Change 2: Search Board Defaults to Empty

The search board currently starts with the full starting position. Change it to start with an empty board, since the typical use case is placing a few pawns for a pawn structure search.

**`frontend/js/search.js`** — Change `SEARCH_START_FEN`:
```javascript
const SEARCH_START_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';
```

Also update `searchSetStart()` — rename the button label from "Starting Position" to "Starting Position" and add a separate "Clear Board" action, OR just change the existing button to clear. The simplest approach: change the existing "Starting Position" button to "Clear Board" since that's the more useful reset for search.

**`frontend/index.html`** — Change the button text on line 239:
```html
<button class="btn btn-sm" data-action="search-set-start">Clear Board</button>
```

Keep the `searchSetStart` function but have it use the empty FEN (which it will, since `SEARCH_START_FEN` is now empty).

## Change 3: Editor Opens with Empty Board from Search

When clicking "Open Editor" from the search page, the editor should open with an empty board instead of carrying over the current search FEN.

**`frontend/js/board-editor.js`** — In `openFromSearch()` (line 221), don't pass the FEN:
```javascript
function openFromSearch() {
    Router.navigate({ view: 'editor', params: {} });
}
```

The editor's `init()` function already handles no-FEN by calling `_chess.clear()` (line 41), which gives an empty board. This is the desired behavior.

## Change 4: Larger Search Board

The search board uses `board-wrap` (fixed 450px) inside `board-area` (50/50 grid). Change it to use the `split-layout` with `board-wrap--fluid` to match the category and detail views.

**`frontend/index.html`** — Change the search view layout (lines 233-266):

Replace `<div class="board-area">` with `<div class="split-layout">`.

Replace `<div id="search-board" class="board-wrap"></div>` with `<div id="search-board" class="board-wrap board-wrap--fluid"></div>`.

Wrap the board and its controls in a card div to match the detail view pattern:
```html
<div class="card" style="margin:0;padding:var(--sp-4)">
    <div id="search-board" class="board-wrap board-wrap--fluid"></div>
    <div class="board-controls">
        ...existing controls...
    </div>
</div>
```

## Change 5: Pawn Structure Search as Default

**`frontend/index.html`** — On line 258-259, move the `checked` attribute from "exact" to "pawn":
```html
<label class="radio-label"><input type="radio" name="search-type" value="exact"> Exact position</label>
<label class="radio-label"><input type="radio" name="search-type" value="pawn" checked> Pawn structure</label>
```

## Testing

1. `./test_smoke.sh` must pass
2. Manual checks:
   - Search page opens with empty board (not starting position)
   - "Pawn structure" radio is selected by default
   - Board is large (fluid, matching detail view size)
   - "Open Editor" opens editor with empty board
   - Run a search → "Reset" button appears → click Reset → board clears, results clear, FEN input clears, Reset button hides
   - "Clear Board" button resets to empty board
3. Verify no file exceeds 300 lines

## Files Modified

- `frontend/index.html` (layout, default radio, button text, reset button)
- `frontend/js/search.js` (empty start FEN, resetSearch function)
- `frontend/js/board-editor.js` (openFromSearch drops FEN param)
- `frontend/js/action-handlers.js` (search-reset handler)
