/**
 * Idle reset — return to the home (Tactics) list after the app has been away.
 *
 * WHAT IT DOES
 *   If you come back to Chessdirbek after being away longer than IDLE_RESET_MS
 *   (3 minutes) and you were sitting on a *detail* page, it sends you back to the
 *   Tactics list (the app's home). Rationale: after a break you've mentally lost
 *   the context of one specific position, so the useful place to land is the main
 *   list, not the half-forgotten detail you'd drilled into. Saves a click.
 *
 * WHY TWO "I'M BACK" SIGNALS
 *   - Page Visibility (document hidden -> visible): the reliable signal on phones
 *     and whenever a tab/window is genuinely backgrounded.
 *   - Window focus/blur: the signal that works for a *desktop PWA window* that
 *     stays visible on screen behind another app — there, visibility never flips,
 *     but focus does.
 *   Today this runs as a desktop PWA on the Mac, so focus/blur is what fires in
 *   practice. It is wired for BOTH on purpose: if the app later moves to the
 *   Hermes server and is opened on a phone over Tailscale, the visibility path
 *   already works with no further changes. Both signals feed the same check;
 *   whichever fires first handles the return and clears the timestamp, so the
 *   other one harmlessly no-ops.
 *
 * WARM RESUME vs COLD START
 *   - Warm resume (process still alive — the usual "I always leave it open" case):
 *     handled live by the visibility/focus listeners wired in init().
 *   - Cold start (the OS evicted the PWA while backgrounded, or it was quit /
 *     rebooted): the "away since" timestamp is persisted in localStorage, so
 *     applyColdStart() — called once in main.js *before* Router.init() — can
 *     rewrite the URL to /tactics before the first render, avoiding a flash of
 *     the stale detail page.
 *
 * SCOPE / SAFETY
 *   Only DETAIL_VIEWS are eligible to be reset. Those are read-only pages with no
 *   unsaved state, so a reset can never destroy work. In-progress flows (play vs
 *   engine, practice, add/edit form, board editor, bulk-add, game import) are
 *   deliberately NOT in scope — returning to one leaves it exactly as it was.
 *   To widen/narrow the behaviour, edit DETAIL_VIEWS. To change the timeout, edit
 *   IDLE_RESET_MS. The only action this module ever takes is navigating to the
 *   Tactics list; it touches no backend and no data.
 *
 * WIRING (see main.js):
 *     IdleReset.applyColdStart();   // BEFORE Router.init() — cold-start redirect
 *     Router.init();
 *     IdleReset.init();             // AFTER  Router.init() — live listeners
 *
 * Pure front-end, vanilla JS. Uses one localStorage key (STORAGE_KEY). Every
 * entry point is wrapped in try/catch so a failure here can never break the app.
 */
window.IdleReset = (function () {
    'use strict';

    var IDLE_RESET_MS = 3 * 60 * 1000;   // "a while" = 3 minutes away
    var STORAGE_KEY = 'cd_away_since';    // epoch ms recorded when we went away

    // Read-only detail pages: safe to bounce home from (no unsaved state).
    var DETAIL_VIEWS = {
        positionDetail: true,
        gameDetail: true,
        collectionDetail: true,
        practiceGameDetail: true
    };

    function _isResetEligible(route) {
        return !!(route && DETAIL_VIEWS[route.view]);
    }

    // Record when we went away — but only once per away-cycle, so a later blur
    // (e.g. a confirm() dialog stealing focus) cannot overwrite the true
    // "away since" time with a more recent one.
    function _markAway() {
        try {
            if (localStorage.getItem(STORAGE_KEY) == null) {
                localStorage.setItem(STORAGE_KEY, String(Date.now()));
            }
        } catch (e) { /* localStorage unavailable -> feature simply no-ops */ }
    }

    // Read + clear the away timestamp. Returns elapsed ms, or null if none set.
    function _consumeAway() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw == null) return null;
            localStorage.removeItem(STORAGE_KEY);
            var since = parseInt(raw, 10);
            return isNaN(since) ? null : (Date.now() - since);
        } catch (e) {
            return null;
        }
    }

    // Live handler for "I'm back" (visible/focus) while the app is still running.
    function _onReturn() {
        try {
            var elapsed = _consumeAway();
            if (elapsed == null || elapsed <= IDLE_RESET_MS) return;
            if (_isResetEligible(Router.current())) {
                Router.navigate({ view: 'tactics' }, { replace: true });
            }
        } catch (e) { /* never let a return handler break the app */ }
    }

    // Cold-start path: called BEFORE Router.init(). If we were away long enough
    // AND the URL points at a detail page, rewrite it to /tactics so the very
    // first render is the home list (no flash of the stale detail page).
    function applyColdStart() {
        try {
            var elapsed = _consumeAway();
            if (elapsed == null || elapsed <= IDLE_RESET_MS) return;
            var route = Router.parse(location.pathname, location.search);
            if (_isResetEligible(route)) {
                history.replaceState(null, '', Router.build({ view: 'tactics' }));
            }
        } catch (e) { /* on any error, fall through to normal startup */ }
    }

    // Wire the live listeners. Called AFTER Router.init().
    function init() {
        try {
            document.addEventListener('visibilitychange', function () {
                if (document.hidden) _markAway();
                else _onReturn();
            });
            // Desktop PWA window: visibility may not flip when another app is
            // focused over a still-visible window, but focus/blur does.
            window.addEventListener('blur', _markAway);
            window.addEventListener('focus', _onReturn);
            // Safari/iOS backgrounding + bfcache: pagehide is the reliable "leaving".
            window.addEventListener('pagehide', _markAway);
        } catch (e) { /* listeners are best-effort */ }
    }

    return { applyColdStart: applyColdStart, init: init };
})();
