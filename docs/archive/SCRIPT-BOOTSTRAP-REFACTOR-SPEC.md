# Script Bootstrap Refactor Spec (Future)

Status: **PLANNED** — not urgent, do when convenient.

## Context

As of April 2026, the app bootstraps from `board.js`, which is a `type="module"`
script that does two very different jobs:

1. **Library**: defines `BoardManager`, `parseFenBoard`, `renderMiniBoard`, and
   exposes them on `window`
2. **App bootstrap**: creates initial boards, calls setup functions, and calls
   `Router.init()` to start routing

This dual role caused a hard-to-debug startup ordering bug with the board
editor (see `BOARD-EDITOR-FIX-SPEC.md`). Any future feature that adds a new
global (like `BoardEditor`) via a separate module will hit the same timing
problem: `Router.init()` fires before the new module has executed.

## The problem pattern

```
board.js (module)          board-editor.js (module)
  │                           │
  ├─ define BoardManager      │  (hasn't run yet)
  ├─ setup calls              │
  └─ Router.init()            │
       └─ renderRoute()       │
            └─ BoardEditor.init()  ← undefined!
                               │
                               ├─ define BoardEditor  ← too late
                               └─ window.BoardEditor = ...
```

## Proposed fix: single entrypoint

Create `frontend/js/main.js` as the sole bootstrap module. All other modules
become pure libraries with no startup side effects.

### board.js changes
Remove everything after line 228 (the `window.*` assignments). Specifically,
remove:
```js
BoardManager.create('board', AppState.boardFen);
BoardManager.create('detail-board', AppState.boardFen);
setupAutoLoad();
setupKeyboardSave();
setupUrlParams();
setupPuzzleKeyboardShortcuts();
Router.init();
```

### New file: main.js
```js
// main.js — single app entrypoint
// All modules are loaded via import; startup happens here.

import "./board.js";        // sets window.BoardManager
import "./board-editor.js"; // sets window.BoardEditor

// Create default boards
BoardManager.create('board', AppState.boardFen);
BoardManager.create('detail-board', AppState.boardFen);

// Run setup
setupAutoLoad();
setupKeyboardSave();
setupUrlParams();
setupPuzzleKeyboardShortcuts();

// Start routing — all globals are guaranteed to exist
Router.init();
```

### index.html changes
Replace:
```html
<script src="/js/board-editor.js"></script>
<script type="module" src="/js/board.js"></script>
```
With:
```html
<script type="module" src="/js/main.js"></script>
```

### board-editor.js changes
Can optionally become a proper ES module with `export`, but the current
`window.BoardEditor` pattern works fine too.

## Benefits
- Startup order is explicit and guaranteed
- Adding new globals/modules just means adding an import to main.js
- board.js becomes a pure library with no side effects
- Easier to reason about, easier to debug

## Risks
- Touches board.js, which is critical infrastructure (every board depends on it)
- Needs testing of all views, not just the editor
- The setup functions (`setupAutoLoad`, etc.) are defined in other regular
  scripts — need to verify they're available when main.js runs

## Test plan
After refactoring, verify ALL views work:
- Tabiyas list and detail
- Tactics list and detail
- Games list, game viewer, import
- Collections
- Search (exact and pawn structure)
- Board editor (full interaction test)
- Practice (quiz flow, history, viewer)
- Opening tree
- Bulk add
- Direct URL navigation to each view
