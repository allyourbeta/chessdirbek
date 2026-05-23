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