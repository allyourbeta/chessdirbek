const Practice = (function () {
    let engineLevels = null;
    let active = null;
    let pendingSave = null;
    let forcedVerdict = null;
    let _playWorker = null;
    let _playChess = null;
    let _playBoardId = null;

    async function loadLevels() {
        if (engineLevels) return engineLevels;
        engineLevels = await ApiClient.get('/practice/engine-levels');
        return engineLevels;
    }
    function getLevels() { return engineLevels; }
    function isActive() { return !!active; }
    function getActive() { return active; }
    function getPendingSave() { return pendingSave; }

    function _createPlayWorker(level) {
        return new Promise(function (resolve, reject) {
            var w = new Worker('/vendor/stockfish/stockfish.wasm.js');
            var phase = 'uci';
            w.onmessage = function (e) {
                var line = typeof e.data === 'string' ? e.data : '';
                if (phase === 'uci' && line.includes('uciok')) {
                    phase = 'ready';
                    var lvl = engineLevels && engineLevels[level];
                    w.postMessage('setoption name Skill Level value ' + (lvl ? lvl.skill : 10));
                    w.postMessage('setoption name Use NNUE value true');
                    w.postMessage('isready');
                } else if (phase === 'ready' && line === 'readyok') {
                    phase = 'done'; w.onmessage = null; resolve(w);
                }
            };
            w.postMessage('uci');
            setTimeout(function () {
                if (phase !== 'done') { w.terminate(); reject(new Error('timeout')); }
            }, 10000);
        });
    }
    function _destroyPlayWorker() { if (_playWorker) { _playWorker.terminate(); _playWorker = null; } }
    function _getDepth(level) { var l = engineLevels && engineLevels[level]; return l ? l.depth : 10; }

    async function startFromDetail() {
        if (!AppState.currentDetailId || !AppState.currentDetailFen) return;
        await loadLevels();
        var levelSel = document.getElementById('practice-level');
        var colorSel = document.getElementById('practice-color');
        var level = levelSel ? levelSel.value : 'medium';
        var turnColor = AppState.currentDetailFen.split(' ')[1] === 'b' ? 'black' : 'white';
        var userColor = colorSel && colorSel.value ? colorSel.value : turnColor;
        active = { rootPositionId: AppState.currentDetailId, startFen: AppState.currentDetailFen,
            userColor: userColor, level: level, startingEval: null };
        try { _playWorker = await _createPlayWorker(level); }
        catch (_) { toast('Failed to start Stockfish', true); active = null; return; }
        _playBoardId = 'detail-board';
        _playChess = new Chess(AppState.currentDetailFen);
        BoardManager.create(_playBoardId, AppState.currentDetailFen, {
            flipped: userColor === 'black', mode: 'play', onMove: _onPlayerMove });
        MoveNavigator.create('detail-nav', {
            fens: [AppState.currentDetailFen], startIndex: 0,
            containerId: 'detail-move-nav',
            onNavigate: function (fen) {
                EngineUI.setPosition(fen);
                AnnotationPanel.setPosition(fen);
                var fenEl = document.getElementById('detail-fen');
                if (fenEl) fenEl.textContent = fen;
            },
        });
        _setPlayingUI(true);
        toast('Practice: ' + userColor + ' vs Stockfish (' + level + ')');
        var engineFirst = (userColor === 'white' && _playChess.turn() === 'b') ||
            (userColor === 'black' && _playChess.turn() === 'w');
        if (engineFirst) setTimeout(_makeEngineMove, 300);
    }

    var _playHideIds = ['practice-history-section', 'your-moves-section', 'detail-actions-card',
        'notes-card'];

    function _setPlayingUI(playing) {
        var fc = document.getElementById('practice-form-controls');
        var pc = document.getElementById('practice-playing-controls');
        var ml = document.getElementById('practice-move-list');
        if (fc) fc.style.display = playing ? 'none' : '';
        if (ml) ml.style.display = playing ? '' : 'none';
        _playHideIds.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.display = playing ? 'none' : '';
        });
        if (playing && !pc) {
            var section = document.getElementById('practice-section');
            if (!section) return;
            var div = document.createElement('div');
            div.id = 'practice-playing-controls';
            div.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';
            div.innerHTML = '<span style="font-size:13px">Playing as <strong>' +
                active.userColor + '</strong> vs Stockfish (' + active.level + ')</span>' +
                '<button class="btn btn-sm" id="practice-resign-btn">Resign</button>' +
                '<button class="btn btn-danger btn-sm" id="practice-stop-btn">Stop</button>';
            section.appendChild(div);
            document.getElementById('practice-resign-btn').onclick = resign;
            document.getElementById('practice-stop-btn').onclick = function () {
                stopAndAbandon(); _captureEndOfGame();
            };
        } else if (!playing && pc) { pc.remove(); }
    }

    function _syncPracticePosition(fen) {
        if (!fen) return;
        BoardManager.setPosition(_playBoardId, fen);
        EngineUI.setPosition(fen);
        AnnotationPanel.setPosition(fen);
        var fenEl = document.getElementById('detail-fen');
        if (fenEl) fenEl.textContent = fen;
    }

    function _updatePracticeMoveList() {
        var el = document.getElementById('practice-move-list');
        if (!el || !_playChess || !active) return;
        var hist = _playChess.history();
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
        el.innerHTML = html;
        el.scrollTop = el.scrollHeight;
    }

    function _onPlayerMove(event) {
        if (!_playChess || !active) return false;
        var piece = _playChess.get(event.squareFrom);
        if (!piece) return false;
        var uw = active.userColor === 'white';
        if ((uw && piece.color !== 'w') || (!uw && piece.color !== 'b')) return false;
        var promo;
        if (piece.type === 'p' && event.squareTo[1] === (piece.color === 'w' ? '8' : '1')) promo = 'q';
        var move = _playChess.move({ from: event.squareFrom, to: event.squareTo, promotion: promo });
        if (!move) return false;
        var currentFen = _playChess.fen();
        _syncPracticePosition(currentFen);
        MoveNavigator.push('detail-nav', currentFen);
        _updatePracticeMoveList();
        if (_playChess.game_over()) { _onGameOver(); return true; }
        setTimeout(_makeEngineMove, 200);
        return true;
    }

    function _makeEngineMove() {
        if (!active || !_playWorker || !_playChess || _playChess.game_over()) {
            if (_playChess && _playChess.game_over()) _onGameOver();
            return;
        }
        var fen = _playChess.fen(), depth = _getDepth(active.level);
        var handler = function (e) {
            var l = e.data;
            if (typeof l !== 'string' || !l.startsWith('bestmove')) return;
            _playWorker.removeEventListener('message', handler);
            var uci = l.split(' ')[1];
            if (!uci || uci === '(none)') return;
            _playChess.move({ from: uci.substring(0, 2), to: uci.substring(2, 4),
                promotion: uci.length > 4 ? uci[4] : undefined });
            BoardManager.setPosition(_playBoardId, _playChess.fen());
            MoveNavigator.push('detail-nav', _playChess.fen());
            EngineUI.setPosition(_playChess.fen());
            AnnotationPanel.setPosition(_playChess.fen());
            _updatePracticeMoveList();
            if (_playChess.game_over()) _onGameOver();
        };
        _playWorker.addEventListener('message', handler);
        _playWorker.postMessage('position fen ' + fen);
        _playWorker.postMessage('go depth ' + depth);
    }

    function _onGameOver() {
        var msg = 'Game over: ';
        if (_playChess.in_checkmate()) {
            var loser = _playChess.turn(), uw = active.userColor === 'white';
            msg += ((loser === 'w' && !uw) || (loser === 'b' && uw))
                ? 'Checkmate! You win.' : 'Checkmate. Engine wins.';
        } else if (_playChess.in_stalemate()) msg += 'Draw by stalemate.';
        else if (_playChess.in_draw()) msg += 'Draw.';
        else msg += 'Game ended.';
        topBanner(msg, 5000);
        _captureEndOfGame();
    }

    function _movesToPgn(chess, startFen) {
        try {
            var hist = chess.history(), body = '';
            var moveNum = parseInt(startFen.split(' ')[5], 10) || 1, i = 0;
            if (startFen.split(' ')[1] === 'b' && hist.length) {
                body += moveNum + '... ' + hist[0] + ' '; i = 1; moveNum++;
            }
            while (i < hist.length) {
                body += moveNum + '. ' + hist[i];
                if (hist[i + 1]) body += ' ' + hist[i + 1];
                body += ' '; moveNum++; i += 2;
            }
            return '[FEN "' + startFen + '"]\n[SetUp "1"]\n\n' + body.trim() + '\n';
        } catch (_) { return '[FEN "' + startFen + '"]\n[SetUp "1"]\n\n'; }
    }

    function _captureEndOfGame() {
        if (!active || !_playChess) return;
        pendingSave = { pgn: _movesToPgn(_playChess, active.startFen),
            finalFen: _playChess.fen(), moveCount: _playChess.history().length, finalEval: null };
        if (forcedVerdict) {
            var v = forcedVerdict; forcedVerdict = null; confirmSave(v); return;
        }
        PracticeUI.showSaveModal(active, pendingSave);
    }

    function _teardown() {
        _setPlayingUI(false); _destroyPlayWorker();
        if (_playBoardId && AppState.currentDetailFen) {
            MoveNavigator.create('detail-nav', {
                fens: [AppState.currentDetailFen], startIndex: 0,
                boardId: 'detail-board', containerId: 'detail-move-nav',
                keyScope: 'view-detail',
                onNavigate: function (f) {
                    EngineUI.setPosition(f);
                    AnnotationPanel.setPosition(f);
                    var fenEl = document.getElementById('detail-fen');
                    if (fenEl) fenEl.textContent = f;
                },
            });
            BoardManager.create(_playBoardId, AppState.currentDetailFen, {
                flipped: false, mode: 'analysis',
                onPositionChange: function (f) {
                    MoveNavigator.push('detail-nav', f);
                    EngineUI.setPosition(f);
                    AnnotationPanel.setPosition(f);
                    var fenEl = document.getElementById('detail-fen');
                    if (fenEl) fenEl.textContent = f;
                } });
            EngineUI.setPosition(AppState.currentDetailFen);
            AnnotationPanel.setPosition(AppState.currentDetailFen);
            var fenEl = document.getElementById('detail-fen');
            if (fenEl) fenEl.textContent = AppState.currentDetailFen;
        }
        _playChess = null; _playBoardId = null;
    }

    function resign() {
        if (!active) { toast('No practice game in progress', true); return; }
        if (!confirm('Resign this game? It will be saved as a loss.')) return;
        forcedVerdict = 'loss'; _captureEndOfGame();
    }
    function stopAndAbandon() { forcedVerdict = 'abandoned'; }
    function guessVerdict() {
        if (!pendingSave || !active || !_playChess) return '?';
        if (_playChess.in_checkmate()) {
            var loser = _playChess.turn(), uw = active.userColor === 'white';
            return ((loser === 'w' && !uw) || (loser === 'b' && uw)) ? 'win' : 'loss';
        } return (_playChess.in_draw() || _playChess.in_stalemate()) ? 'draw' : '?';
    }

    async function confirmSave(userVerdict) {
        if (!pendingSave || !active) { PracticeUI.hideSaveModal(); _teardown(); return; }
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
        PracticeUI.hideSaveModal(); _teardown();
        if (AppState.currentDetailId) loadPracticeHistory(AppState.currentDetailId);
    }

    function discard() { active = null; pendingSave = null; forcedVerdict = null; PracticeUI.hideSaveModal(); _teardown(); toast('Practice game discarded'); }

    function loadPracticeHistory(posId, append) { return PracticeHistory.load(posId, append); }
    async function loadPracticeTab() { await loadLevels(); PracticeUI.populateLevelSelect(engineLevels); PracticeUI.renderPositionsList(await ApiClient.get('/practice/positions')); }

    return {
        startFromDetail: startFromDetail, confirmSave: confirmSave, discard: discard, isActive: isActive,
        loadPracticeHistory: loadPracticeHistory, loadPracticeTab: loadPracticeTab, loadLevels: loadLevels, getLevels: getLevels,
        editVerdict: id => PracticeHistory.editVerdict(id), deleteGame: id => PracticeHistory.deleteGame(id),
        guessVerdict: guessVerdict, getActive: getActive, getPendingSave: getPendingSave, resign: resign, stopAndAbandon: stopAndAbandon,
        applyFilters: () => PracticeHistory.applyFilters(), clearFilters: () => PracticeHistory.clearFilters(), showMore: () => PracticeHistory.showMore(),
    };
})();
window.Practice = Practice;
