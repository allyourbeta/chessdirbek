const Practice = (function () {
    let engineLevels = null;
    let active = null;
    let pendingSave = null;
    let forcedVerdict = null;
    let _playChess = null;
    let _playBoardId = null;
    let _practiceGeneration = 0;

    async function loadLevels() {
        if (engineLevels) return engineLevels;
        engineLevels = await ApiClient.get('/practice/engine-levels');
        return engineLevels;
    }
    function getLevels() { return engineLevels; }
    function isActive() { return !!active; }
    function getActive() { return active; }
    function getPendingSave() { return pendingSave; }

    function _getDepth(level) { var l = engineLevels && engineLevels[level]; return l ? l.depth : 10; }

    async function startFromDetail() {
        toast('Practice vs engine is temporarily disabled (engine rebuild in progress)', 'warn');
        return;
    }

    function _syncPracticePosition(fen) {
        if (!fen) return;
        BoardManager.setPosition(_playBoardId, fen);
        AnnotationPanel.setPosition(fen);
        var fenEl = document.getElementById('detail-fen');
        if (fenEl) fenEl.textContent = fen;
    }

    function _updatePracticeMoveList() {
        var el = document.getElementById('practice-move-list');
        if (!el || !_playChess || !active) return;
        var hist = _playChess.history();
        // SAFE_INNER_HTML: Clearing element content
        if (!hist.length) { el.innerHTML = ''; return; }
        var startNum = parseInt(active.startFen.split(' ')[5], 10) || 1;
        var isBlackStart = active.startFen.split(' ')[1] === 'b';
        var html = '', i = 0;
        if (isBlackStart && hist.length) {
            html += startNum + '... ' + hist[0] + ' '; i = 1; startNum++;
        }
        while (i < hist.length) {
            html += '<b>' + startNum + '.</b>' + hist[i];
            if (hist[i + 1]) html += ' ' + hist[i + 1];
            html += ' '; startNum++; i += 2;
        }
        // SAFE_INNER_HTML: Controlled template - only chess moves (SAN notation) from trusted source
        el.innerHTML = html;
        el.scrollTop = el.scrollHeight;
    }

    function resign() {
        toast('No practice game in progress', 'warn');
    }
    function stopAndAbandon() { forcedVerdict = 'abandoned'; }
    function guessVerdict() { return '?'; }

    async function confirmSave(userVerdict) {
        if (!pendingSave || !active) { PracticeUI.hideSaveModal(); return; }
        var notesEl = document.getElementById('practice-save-notes');
        try {
            await ApiClient.post('/practice/', {
                root_position_id: active.rootPositionId, pgn_text: pendingSave.pgn, user_color: active.userColor,
                final_fen: pendingSave.finalFen, move_count: pendingSave.moveCount, engine_name: 'Stockfish',
                engine_level: active.level, starting_eval: null, final_eval: pendingSave.finalEval,
                user_verdict: userVerdict || null, notes: notesEl ? notesEl.value.trim() || null : null,
            });
            topBanner('Practice game saved');
        } catch (e) {
            console.error(e);
            toast('Save failed', true);
        }
        active = null; pendingSave = null; forcedVerdict = null;
        PracticeUI.hideSaveModal();
        if (AppState.currentDetailId) loadPracticeHistory(AppState.currentDetailId);
    }

    function discard() { active = null; pendingSave = null; forcedVerdict = null; PracticeUI.hideSaveModal(); toast('Practice game discarded'); }

    function loadPracticeHistory(posId, append) { return PracticeHistory.load(posId, append); }
    async function loadPracticeTab() { await loadLevels(); PracticeUI.populateLevelSelect(engineLevels); PracticeUI.renderPositionsList(await ApiClient.get('/practice/positions')); }

    function clearMoveList() {
        var el = document.getElementById('practice-move-list');
        // SAFE_INNER_HTML: Clearing element content
        if (el) el.innerHTML = '';
    }

    function getPlayChess() { return _playChess; }

    return {
        startFromDetail: startFromDetail, confirmSave: confirmSave, discard: discard, isActive: isActive,
        loadPracticeHistory: loadPracticeHistory, loadPracticeTab: loadPracticeTab, loadLevels: loadLevels, getLevels: getLevels,
        editVerdict: id => PracticeHistory.editVerdict(id), deleteGame: id => PracticeHistory.deleteGame(id),
        guessVerdict: guessVerdict, getActive: getActive, getPendingSave: getPendingSave, resign: resign, stopAndAbandon: stopAndAbandon,
        applyFilters: () => PracticeHistory.applyFilters(), clearFilters: () => PracticeHistory.clearFilters(), showMore: () => PracticeHistory.showMore(),
        getPlayChess: getPlayChess, clearMoveList: clearMoveList,
    };
})();
window.Practice = Practice;
