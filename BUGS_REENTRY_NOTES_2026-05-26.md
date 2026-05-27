# Chess Quiz Re-entry Notes — Engine / Analysis Tree Bugs

Date: 2026-05-26  
Branch: main  
Status: App is usable in parts, but engine-analysis navigation is unstable. Do not build new features on top of this until these bugs are fixed.

## Current Problem Cluster

The engine-analysis / position-detail state model is currently inconsistent. Several symptoms suggest that board state, engine FEN, training side, move history, and UI navigation are not using one clean source of truth.

## Known Bugs

### 1. Physical left/right arrow keys do not navigate the analysis line

Expected:
- Open a saved position.
- Follow an engine line by playing moves.
- Physical keyboard ArrowLeft / ArrowRight should move backward/forward through the moves just played.
- ArrowLeft at the start should stop at the original position.
- ArrowRight at the end should stop at the latest played move.

Current:
- Physical arrow keys do nothing useful.

Likely issue:
- Engine-line moves update the board/engine but do not append to a single local analysis-session history stack, or the keyboard handler reads from the wrong history object.

---

### 2. App repeatedly asks White/Black while navigating an analysis tree

Expected:
- White/Black side check is only for the starting imported position.
- Once the starting side is confirmed, that choice should persist through the analysis line.
- Moving through engine moves should not re-trigger “which side is this?” checks.

Current:
- While navigating through an engine line, the app sometimes asks again which side is to move.

Likely issue:
- The “side-to-move needs check” warning is being recalculated for every derived FEN/ply instead of only the initial imported position.

---

### 3. Engine move side is inconsistent with selected side-to-move

Expected:
- If position is White to move, engine should show legal moves for White.
- If position is Black to move, engine should show legal moves for Black.
- The side-to-move selected for the starting position should determine the initial engine analysis.

Current:
- Sometimes position says one side is to move, but engine appears to show moves for the other side.

Likely issue:
- FEN side-to-move, visual coordinate interpretation, and engine input FEN are not synchronized.

---

### 4. On-screen arrow buttons are broken / sometimes disappear

Expected:
- If on-screen move arrows exist, they should mirror physical ArrowLeft / ArrowRight behavior.
- They should navigate within the current analysis-session history only.

Current:
- Sometimes they appear.
- Sometimes they disappear.
- When visible, they can produce a blank screen or broken state.

Likely issue:
- On-screen arrows may be wired to an older/stale navigator or different history model than the physical keyboard arrows.

## Core Invariant Needed

Position detail should have ONE local analysis session object.

Pseudo-model:

```js
session = {
  positionId,
  startingFen,
  trainingSide, // 'w' or 'b', fixed for this opened position
  currentFen,
  history: [startingFen],
  historyIndex: 0,
}
```

Rules:

1. Opening a saved position creates a fresh session.
2. Opening another position destroys/replaces the previous session.
3. Playing an engine move:
   - truncates future history after current index
   - pushes the new FEN
   - increments historyIndex
   - updates board and engine from that FEN
4. ArrowLeft:
   - if historyIndex > 0, decrement and load that FEN
5. ArrowRight:
   - if historyIndex < history.length - 1, increment and load that FEN
6. Side-to-move warning applies only to the starting/imported position, not derived engine-line positions.
7. Evaluation perspective remains fixed to `trainingSide`, not current side-to-move.

## Do Not Touch Yet

Do not work on:
- new keyboard navigation features
- board editor UI polish
- search UI polish
- new position-list features
- visual redesign

until this engine-analysis session state is stable.

## First Fix to Attempt

Implement or refactor a single `analysisSession` / `positionSession` model in the position-detail layer.

All of these must use the same session object:
- board display
- engine FEN
- physical arrow-key navigation
- on-screen arrow buttons
- engine-line move clicks
- evaluation perspective

## Acceptance Tests

### Test A: Basic line navigation

1. Open a saved position.
2. Confirm White/Black if needed.
3. Turn on engine.
4. Play first engine move.
5. Play second engine move.
6. Press physical ArrowLeft.
7. Board returns to after move 1.
8. Press physical ArrowLeft again.
9. Board returns to original position.
10. Press physical ArrowLeft again.
11. Board stays at original position.
12. Press ArrowRight twice.
13. Board advances through move 1 and move 2.

### Test B: No side prompt during line

1. Open a position with suspect side-to-move.
2. Choose White or Black.
3. Play several engine moves.
4. App should not ask again which side is to move.

### Test C: Engine side consistency

1. Set starting position to White to move.
2. Engine should show White legal moves.
3. Set starting position to Black to move.
4. Engine should show Black legal moves.

### Test D: No cross-position leakage

1. Open position A.
2. Play several moves.
3. Open position B.
4. Press ArrowLeft repeatedly.
5. It must stop at position B’s start.
6. It must never jump back into position A.

## Notes

This is likely not four separate bugs. It is probably one underlying state-model bug: multiple systems maintain their own idea of current board/FEN/history/training side.
