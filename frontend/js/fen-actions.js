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