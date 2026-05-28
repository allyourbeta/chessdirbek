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
    window.open(url, '_blank', 'noopener');
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