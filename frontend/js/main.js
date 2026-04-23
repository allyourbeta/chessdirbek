// main.js — single app entrypoint.
// All modules are loaded via import. Startup happens here, after
// all libraries and globals are guaranteed to exist.

import "./board.js";  // sets window.BoardManager, etc.

// Create default boards
BoardManager.create('board', AppState.boardFen);
BoardManager.create('detail-board', AppState.boardFen);

// Run setup (defined in position-form.js, loaded as regular script before this)
setupAutoLoad();
setupKeyboardSave();
setupUrlParams();
setupPuzzleKeyboardShortcuts();

// Start the router — all globals are guaranteed to exist at this point.
Router.init();
