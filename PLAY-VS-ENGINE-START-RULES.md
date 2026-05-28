# Play vs Engine Start Rules

Build 15 fixes the saved-position play start path.

## Intended behavior

1. **Play vs Engine starts from the saved position record** (`AppState.currentDetailFen`).
   - It does not start from a transient analysis-board / MoveNavigator FEN.
   - This prevents stale or corrupted analysis state from producing false game-over states.

2. **Default color is side to move.**
   - If the dropdown is `Play side to move`, the app resolves the user color from the FEN side-to-move field.
   - Explicit `Play as White` / `Play as Black` still wins.

3. **Board orientation follows the user's color.**
   - User as White => White orientation.
   - User as Black => Black orientation.

4. **FEN is explicitly normalized and loaded through chess.js `load()`.**
   - Invalid FENs are rejected before PlayMode starts.
   - PlayMode logs the loaded FEN, turn, legal move count, game-over, and stalemate state to the console.

## Important note

If a future feature wants “Play from the currently visible analysis line,” make it a separate button. Do not overload the saved-position Play button with transient board state.
