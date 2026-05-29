/**
 * Flip-FEN action: corrects a saved position that was captured from the wrong
 * side of the board — typically a Black-perspective screenshot run through an
 * OCR/FEN site that assumed White-on-bottom, which records the whole position
 * rotated 180°.
 *
 * It rotates the stored FEN 180° (FenActions.rotateFen180) AND flips the saved
 * display-orientation flag. Those two operations cancel visually — the diagram
 * looks unchanged — while the underlying FEN becomes canonical and the board
 * coordinates become correct (a1 in the top-right for a Black study). The
 * operation is reversible: applying it twice restores the original.
 *
 * Single owner for both entry points (list-thumbnail button + detail toolbar)
 * so the rotate-and-save logic is never duplicated.
 */
window.FenFlip = (function () {
    'use strict';

    // Rotate + flip orientation + persist via the central API client. Returns the
    // updated position on success, or null on failure (after surfacing a toast).
    async function _applyAndSave(pos) {
        if (!pos || !pos.fen) {
            toast('No position to flip', true);
            return null;
        }
        var rotated = FenActions.rotateFen180(pos.fen);
        if (!rotated) {
            // rotateFen180 refused (not a parseable 8-rank board) — never no-op silently.
            toast('Could not flip this FEN', true);
            return null;
        }
        var newOrientation = pos.orientation === 'black' ? 'white' : 'black';
        try {
            var updated = await ApiClient.put('/positions/' + pos.id, {
                fen: rotated,
                orientation: newOrientation
            });
            toast('FEN corrected \u2713');
            return updated;
        } catch (e) {
            toast('Flip failed', true);
            return null;
        }
    }

    // From a list thumbnail: AppState.allPositions already carries fen +
    // orientation (PositionBrief), so we can act on it directly. Reload the
    // current category afterwards so the row re-renders (mirrors deleteFromList).
    async function flipFromList(id) {
        var pos = (AppState.allPositions || []).find(function (p) { return p.id === id; });
        var updated = await _applyAndSave(pos);
        if (updated && AppState.currentCategory) {
            loadCategoryPositions(AppState.currentCategory);
        }
    }

    // From the detail toolbar: fetch the freshest copy so we never rotate a stale
    // FEN, then fully reload the detail view to redraw the board with corrected
    // coordinates (pieces stay put; a1 moves to the top-right for a Black study).
    async function flipFromDetail() {
        var id = window.AppState && AppState.currentDetailId;
        if (!id) return;
        var pos;
        try {
            pos = await ApiClient.get('/positions/' + id);
        } catch (e) {
            toast('Flip failed', true);
            return;
        }
        var updated = await _applyAndSave(pos);
        if (updated) {
            loadPositionDetail(id);
        }
    }

    return { flipFromList: flipFromList, flipFromDetail: flipFromDetail };
})();
