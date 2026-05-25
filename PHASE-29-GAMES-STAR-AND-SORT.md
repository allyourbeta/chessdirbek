# Phase 29: Games Star + Font Bump + Position List Sort

Three small UI/UX improvements. Run `scripts/backup_now.sh` before starting.

## Change 1: Game Star Toggle

Add a starred flag to games, following the exact same pattern as positions.

### Backend

**`backend/models/game_models.py`** — Add `starred` column to `Game`:
```python
from sqlalchemy import Boolean  # add to existing imports

# Add after the updated_at column:
starred = Column(
    Boolean,
    nullable=False,
    default=False,
    server_default="0",
)
```

**DB migration** — Run this against the SQLite database (path: `chessdirbek.db` in project root):
```sql
ALTER TABLE games ADD COLUMN starred BOOLEAN NOT NULL DEFAULT 0;
```

**`backend/api/game_schemas.py`** — Add `starred: bool` to `GameBrief` (after `move_count`):
```python
starred: bool = False
```

**`backend/api/games.py`** — Add a star toggle endpoint. Put it BEFORE the `/{game_id}` GET route to avoid route conflicts:
```python
@router.patch("/{game_id}/star")
def toggle_game_star(game_id: int, db: Session = Depends(get_db)):
    """Toggle the starred flag on a game. Returns new state."""
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    game.starred = not game.starred
    db.commit()
    db.refresh(game)
    return {"id": game.id, "starred": game.starred}
```

Also add `starred` filter support to `_apply_game_filters()`:
```python
def _apply_game_filters(query, tag, tags, collection_id, search, eco, result, starred=None):
    # ... existing logic ...
    if starred is not None:
        query = query.filter(Game.starred == starred)
    return query
```

And add `starred: bool | None = None` parameter to both `list_games()` and `count_games()`, passing it through to `_apply_game_filters`.

### Frontend

**`frontend/js/games.js`** — Modify `renderGamesList()`:

1. Add a star column header after the select column:
   ```html
   <th class="col-star"></th>
   ```

2. Add a star cell in each row after the select cell. Use `StarControl` for consistency:
   ```javascript
   const starHtml = `<span class="game-star-toggle" data-star-kind="game" data-game-id="${g.id}">${StarControl.renderStarIcon(g.starred)}</span>`;
   ```
   ```html
   <td class="col-star">${starHtml}</td>
   ```

3. Add a starred filter button in the header area (next to the existing result filter). Add to `_currentGamesParams()`:
   ```javascript
   if (AppState.gameStarredFilter) p.starred = true;
   ```

**`frontend/js/state.js`** — Add:
```javascript
gameStarredFilter: false,
```

**`frontend/js/star-control.js`** — Add game star handling:

1. Add a `renderGameStar(game)` method (mirrors `renderPositionStar`):
   ```javascript
   renderGameStar(game) {
       return `<span class="game-star-toggle" data-star-kind="game" data-game-id="${game.id}">${this.renderStarIcon(game.starred)}</span>`;
   },
   ```

2. Add `_handleGameStarClick(event)` method:
   - Find closest `[data-star-kind="game"]`
   - Call `ApiClient.patch('/games/' + gameId + '/star')`
   - Update `AppState.allGames` in-memory
   - Update visual via `this.renderStarIcon(data.starred)`
   - If `AppState.gameStarredFilter` is active, call `renderGamesList()` to re-filter
   - IMPORTANT: call `event.stopPropagation()` to prevent the row click from navigating to game detail

3. Add `'game'` case to `handleGlobalStarClick()`:
   ```javascript
   if (starKind === 'game') {
       this._handleGameStarClick(event);
   }
   ```

**`frontend/js/games.js`** — Add starred filter toggle button in the games view header area. Add it as a button next to the existing filters, using the same pattern as the position star filter:
```javascript
// In the games view header (index.html), add a button:
<button id="game-starred-filter" class="btn btn-sm btn-ghost" data-star-kind="filter" title="Show starred only" style="display:flex;align-items:center;gap:4px;padding:4px 8px;font-size:16px;font-weight:600;"></button>
```

Wire it up in `mountGameTagFilter()` or in `renderRoute` for games — toggle `AppState.gameStarredFilter`, call `loadGames()`.

### CSS

**`frontend/css/tagfilter.css`** — Add:
```css
.games-table .col-star { width: 36px; text-align: center; padding: 7px 4px; }
.game-star-toggle { cursor: pointer; display: inline-flex; align-items: center; }
```

## Change 2: Games Table Font Bump

The games table currently uses `--fs-13` for body and `--fs-11` for headers. Bump both up.

**`frontend/css/tagfilter.css`** — Change these values:

- `.games-table` font-size: `var(--fs-13)` → `var(--fs-15)`
- `.games-table thead th` font-size: `var(--fs-11)` → `var(--fs-13)`
- `.games-table td` padding: `7px 10px` → `10px 12px`
- `.games-table thead th` padding: `7px 10px` → `10px 12px`
- `.games-table .col-opening` font-size: remove the `font-size: var(--fs-12)` override (inherit from table)
- `.games-table .col-date` font-size: remove the `font-size: var(--fs-12)` override
- `.games-table .col-moves` font-size: remove the `font-size: var(--fs-12)` override
- `.games-table .elo` font-size: `var(--fs-11)` → `var(--fs-13)`
- `.pager` font-size: `var(--fs-13)` → `var(--fs-15)`

## Change 3: Position List Sort Order

Add a sort dropdown to the position browse panel (right side of split layout). Two options: "Newest first" (default, current behavior) and "Oldest first".

### Backend

**`backend/api/positions.py`** — Add `sort` parameter to `list_positions()`:
```python
def list_positions(
    tag: str | None = None,
    tags: list[str] | None = Query(default=None),
    search: str | None = None,
    position_type: Optional[PositionType] = None,
    sort: str = "newest",  # "newest" or "oldest"
    db: Session = Depends(get_db),
):
```

Change the order_by at the end:
```python
order = Position.created_at.desc() if sort != "oldest" else Position.created_at.asc()
return query.order_by(order).all()
```

### Frontend

**`frontend/js/state.js`** — Add:
```javascript
positionSort: 'newest',
```

**`frontend/js/position-list.js`** — Modify `loadCategoryPositions()` to pass sort param:
```javascript
if (AppState.positionSort && AppState.positionSort !== 'newest') {
    u += (u.includes('?') ? '&' : '?') + 'sort=' + AppState.positionSort;
}
```

**`frontend/index.html`** — Add a sort dropdown in the filter row (line ~81-84 area, inside the `filter-row` div, after the starred filter toggle):
```html
<select id="position-sort" class="select-input" style="font-size:14px;font-weight:600;">
    <option value="newest">Newest first</option>
    <option value="oldest">Oldest first</option>
</select>
```

**`frontend/js/position-list.js`** — In `mountCategoryTagFilter()`, wire up the sort dropdown:
```javascript
const sortSelect = document.getElementById('position-sort');
if (sortSelect) {
    sortSelect.value = AppState.positionSort || 'newest';
    sortSelect.addEventListener('change', function() {
        AppState.positionSort = this.value;
        loadCategoryPositions(categoryKey);
    });
}
```

**Sort interaction with featured/starred**: The existing client-side sort in `renderCategoryList` (featured first, then starred, then rest) should remain unchanged. The server-side sort determines the order *within* each of those groups. So "oldest first" means: featured card → starred positions oldest-first → unstarred positions oldest-first.

## Testing

After all changes:

1. `./test_smoke.sh` must pass
2. Manual checks:
   - Games page: click star on a game row — star toggles, row click still navigates
   - Games page: enable starred filter — only starred games shown
   - Games page: verify larger font looks good, no overflow/truncation
   - Category view: change sort dropdown — list re-orders
   - Category view: "Oldest first" with starred positions — starred still float to top within their group
3. Verify no file exceeds 300 lines

## Files Modified

- `backend/models/game_models.py` (add starred column)
- `backend/api/game_schemas.py` (add starred to GameBrief)
- `backend/api/games.py` (add star endpoint, starred filter param)
- `backend/api/positions.py` (add sort param)
- `frontend/js/state.js` (add gameStarredFilter, positionSort)
- `frontend/js/games.js` (star column, starred filter)
- `frontend/js/star-control.js` (game star handler)
- `frontend/js/position-list.js` (sort dropdown wiring)
- `frontend/index.html` (star filter button, sort dropdown)
- `frontend/css/tagfilter.css` (star column CSS, font bump)
