/**
 * Detail toolbar "Castling allowed" checkbox (SPEC-CASTLING.md). Hidden
 * entirely when the stored board supports no castling right at all; otherwise
 * shown, ticked when the stored FEN's castling field is not '-'. Toggling it
 * writes the FEN's castling field straight through PUT /positions/{id} (the
 * backend trims to what the pieces allow) and reloads the detail view so the
 * board and AppState.currentDetailFen reflect the saved result.
 */
var CastlingToggle = (function () {
    'use strict';
    var CHECKBOX_ID = 'detail-castling-toggle';

    function _label(box) {
        return box ? box.closest('label') : null;
    }

    // Called from loadPositionDetail on every detail load.
    function sync(pos) {
        var box = document.getElementById(CHECKBOX_ID);
        if (!box) return;
        var label = _label(box);
        var supported = FenUtils.supportedCastling(pos.fen);
        var display = supported === '-' ? 'none' : '';
        if (label) label.style.display = display;
        else box.style.display = display;
        if (supported === '-') return;
        var castling = FenUtils.normalizeFen(pos.fen).split(' ')[2] || '-';
        box.checked = castling !== '-';
    }

    // Delegated via data-change="castling-toggle" in event-delegation.js.
    async function onChange(box) {
        var id = window.AppState && AppState.currentDetailId;
        var fen = window.AppState && AppState.currentDetailFen;
        if (!box || !id || !fen) return;
        var parts = FenUtils.normalizeFen(fen).split(' ');
        while (parts.length < 6) {
            parts.push(parts.length === 1 ? 'w' : parts.length === 2 ? '-' : parts.length === 3 ? '-' : parts.length === 4 ? '0' : '1');
        }
        parts[2] = box.checked ? 'KQkq' : '-';
        try {
            await ApiClient.put('/positions/' + id, { fen: parts.slice(0, 6).join(' ') });
        } catch (e) {
            toast('Failed to update castling', true);
            box.checked = !box.checked;
            return;
        }
        loadPositionDetail(id);
    }

    return { sync: sync, onChange: onChange };
})();

window.CastlingToggle = CastlingToggle;
