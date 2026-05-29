/**
 * Engine-game result computation and persistence. The pure result rules
 * (computeNaturalResult, resultForOutcome) live here, testable in isolation,
 * alongside the single persistence call (saveEngineGame → POST /engine-games).
 * Extracted from play.js so the controller stays focused on game flow/state.
 */
(function () {
    'use strict';

    // Derive { result, outcome } from a finished chess.js game.
    function computeNaturalResult(game) {
        if (game.in_checkmate()) {
            // "1-0" if Black is mated, "0-1" if White is mated.
            return { result: game.turn() === 'b' ? '1-0' : '0-1', outcome: 'checkmate' };
        }
        if (game.in_stalemate()) return { result: '1/2-1/2', outcome: 'stalemate' };
        if (game.in_threefold_repetition()) return { result: '1/2-1/2', outcome: 'threefold' };
        if (game.insufficient_material()) return { result: '1/2-1/2', outcome: 'insufficient' };
        if (game.in_draw()) return { result: '1/2-1/2', outcome: 'fifty-move' };
        return { result: '*', outcome: null };
    }

    // Map a manual end-game choice ('win'|'loss'|'draw'|'unfinished') to a stored
    // { result, outcome }, from the user's point of view. Anything not win/loss/draw
    // is treated as leaving the game unfinished.
    function resultForOutcome(kind, userColor) {
        if (kind === 'win')  return { result: userColor === 'white' ? '1-0' : '0-1', outcome: 'manual' };
        if (kind === 'loss') return { result: userColor === 'white' ? '0-1' : '1-0', outcome: 'manual' };
        if (kind === 'draw') return { result: '1/2-1/2', outcome: 'manual' };
        return { result: '*', outcome: 'unfinished' };
    }

    // Persist a completed game. Returns true on success, false (with a toast) on failure.
    async function saveEngineGame(payload) {
        try {
            await ApiClient.post('/engine-games', payload);
            return true;
        } catch (error) {
            console.error('Failed to save game:', error);
            if (typeof toast === 'function') toast('Failed to save game', 'error');
            return false;
        }
    }

    const PlayResult = { computeNaturalResult, resultForOutcome, saveEngineGame };
    if (typeof window !== 'undefined') window.PlayResult = PlayResult;
    if (typeof module !== 'undefined' && module.exports) module.exports = PlayResult;
})();
