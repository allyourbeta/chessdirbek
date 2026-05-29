// FEN-related actions helper
window.FenActions = window.FenActions || {};

/**
 * Copy the current board's FEN to clipboard and show notification
 */
window.FenActions.copyCurrentFen = function() {
    var fen = BoardManager.getCurrentFen();
    if (!fen) {
        toast('No position to copy', true);
        return;
    }
    
    if (!navigator.clipboard) {
        toast('Clipboard not available', true);
        return;
    }
    
    navigator.clipboard.writeText(fen).then(function() {
        toast('FEN copied');
    }).catch(function() {
        toast('Copy failed', true);
    });
};

/**
 * Copy a specific FEN to clipboard and show notification
 */
window.FenActions.copyFen = function(fen) {
    if (!fen) {
        toast('No position to copy', true);
        return;
    }
    
    if (!navigator.clipboard) {
        toast('Clipboard not available', true);
        return;
    }
    
    navigator.clipboard.writeText(fen).then(function() {
        toast('FEN copied');
    }).catch(function() {
        toast('Copy failed', true);
    });
};

/**
 * Open the current board position on Lichess analysis board.
 * Lichess URL format: https://lichess.org/analysis/standard/{FEN}
 * where spaces in the FEN are replaced with underscores.
 */
window.FenActions.analyzeOnLichess = function(fen) {
    fen = fen || (window.BoardManager && BoardManager.getCurrentFen());
    if (!fen) {
        toast('No position to analyze', true);
        return;
    }
    var encoded = fen.replace(/ /g, '_');
    var url = 'https://lichess.org/analysis/standard/' + encoded;

    // Open as a sized popup positioned over the current window so it reads as a
    // companion analysis panel rather than being flung to another tab/space.
    // (Lichess forbids iframing /analysis via X-Frame-Options, so a popup window
    // is the closest we can get to an in-context overlay.)
    var w = Math.min(1000, Math.max(760, Math.floor(window.outerWidth * 0.6)));
    var h = Math.min(900, Math.max(640, Math.floor(window.outerHeight * 0.85)));
    var left = window.screenX + Math.max(0, Math.floor((window.outerWidth - w) / 2));
    var top = window.screenY + Math.max(0, Math.floor((window.outerHeight - h) / 2));
    var features = 'noopener,popup=yes,width=' + w + ',height=' + h +
                   ',left=' + left + ',top=' + top;
    var win = window.open(url, 'lichess-analysis', features);
    // Popup blocked → fall back to a normal new tab so the action never silently fails.
    if (!win) window.open(url, '_blank', 'noopener');
};

/**
 * Open a specific FEN on Lichess (for contexts where getCurrentFen
 * might return the wrong board, e.g. game viewer).
 */
window.FenActions.analyzeOnLichessFen = function(fen) {
    if (!fen) {
        toast('No position to analyze', true);
        return;
    }
    FenActions.analyzeOnLichess(fen);
};

/**
 * Rotate a FEN's piece placement 180° (reverse the rank order AND reverse the
 * files within each rank).
 *
 * This is the exact inverse of the error produced when a board is photographed
 * from Black's side and run through an OCR/FEN site that assumes White is on the
 * bottom: such a site records every piece at the square 180° opposite its true
 * square — the whole position rotated. Applying this rotation restores the
 * canonical position (a1 = White's near-right corner).
 *
 * The transform is purely positional; piece COLORS are never changed, and it is
 * its own inverse (rotating twice yields the original placement).
 *
 * Side-to-move is preserved — whose turn it is does not depend on how the board
 * was photographed. Castling and en-passant rights cannot survive a rotation and
 * are meaningless on a screenshot capture, so they are reset to '-'. Input shape
 * is preserved: a board-only FEN returns board-only; a full FEN returns full.
 *
 * Returns the rotated FEN string, or null if the input is not a parseable
 * 8-rank board (so callers can distinguish "refused" from a valid result).
 */
window.FenActions.rotateFen180 = function (fen) {
    if (!fen || typeof fen !== 'string') return null;
    var parts = fen.trim().replace(/\s+/g, ' ').split(' ');
    var ranks = (parts[0] || '').split('/');
    if (ranks.length !== 8) return null;

    // Expand each rank to exactly 8 cells (null = empty square).
    var grid = [];
    for (var i = 0; i < 8; i++) {
        var cells = [];
        for (var c = 0; c < ranks[i].length; c++) {
            var ch = ranks[i].charAt(c);
            if (ch >= '1' && ch <= '8') {
                var n = ch.charCodeAt(0) - 48;
                for (var k = 0; k < n; k++) cells.push(null);
            } else {
                cells.push(ch);
            }
        }
        if (cells.length !== 8) return null; // malformed rank — refuse, don't mangle
        grid.push(cells);
    }

    // 180° rotation: reverse rank order, and reverse files within each rank.
    var rotatedRanks = [];
    for (var r = 7; r >= 0; r--) {
        var row = grid[r].slice().reverse();
        var s = '', empty = 0;
        for (var f = 0; f < 8; f++) {
            if (row[f] === null) {
                empty++;
            } else {
                if (empty) { s += empty; empty = 0; }
                s += row[f];
            }
        }
        if (empty) s += empty;
        rotatedRanks.push(s);
    }
    var board = rotatedRanks.join('/');

    // Board-only input → board-only output (preserve shape).
    if (parts.length <= 1) return board;

    var side = parts[1] === 'b' ? 'b' : 'w';
    var half = /^\d+$/.test(parts[4] || '') ? parts[4] : '0';
    var full = /^[1-9]\d*$/.test(parts[5] || '') ? parts[5] : '1';
    // Castling (field 3) and en-passant (field 4) reset to '-'.
    return [board, side, '-', '-', half, full].join(' ');
};

// Test hook for Node-based unit tests (see tests/fen/rotate.test.js).
window.FenActions._test = Object.assign({}, window.FenActions._test, {
    rotateFen180: window.FenActions.rotateFen180
});