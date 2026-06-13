// main.js — single app entrypoint.
// All modules are loaded via import. Startup happens here, after
// all libraries and globals are guaranteed to exist.

import "./board.js";  // sets window.BoardManager, etc.

// Create default boards
BoardManager.create('board', AppState.boardFen, {
    mode: 'analysis',
    onPositionChange: function(newFen) {
        document.getElementById('fen-input').value = newFen;
        AppState.boardFen = newFen;
    },
});
BoardManager.create('detail-board', AppState.boardFen);

// Run setup (defined in position-form.js, loaded as regular script before this)
setupAutoLoad();
setupAutoGrowTextareas();
setupKeyboardSave();
setupUrlParams();
setupPuzzleKeyboardShortcuts();
setupStaticActions();

// Initialize star control global handlers
StarControl.initGlobalHandlers();

// Initialize keyboard navigation for top navigation
if (window.KeyboardNavigation) {
    KeyboardNavigation.initTopNav();
}

// Idle reset (see idle-reset.js): if we're returning after a long break and the
// URL still points at a detail page, redirect to the Tactics list. This MUST run
// before Router.init() so the first render is home, not the stale detail page.
IdleReset.applyColdStart();

// Start the router — all globals are guaranteed to exist at this point.
Router.init();

// Idle reset: wire the live "came back" listeners now that routing is active.
IdleReset.init();
