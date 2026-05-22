var _saveTagState = { tags: [] };
var _saveTagFilter = null;

function openGame(id) {
    // If called during render (deep link), skip pushState — router is already
    // rendering; just load data into the already-active view.
    if (Router.isRendering()) return loadGameDetail(id);
    Router.navigate({ view: 'gameDetail', id });
}

// Data loader — called by renderRoute for /games/:id.
async function loadGameDetail(id) {
    const res = await fetch(API + '/games/' + id);
    if (!res.ok) { toast('Failed to load game', true); return; }
    const game = await res.json();
    AppState.currentGame = game;
    AppState.currentPly = 0;

    document.getElementById('gv-white').textContent = game.white || '?';
    document.getElementById('gv-black').textContent = game.black || '?';
    document.getElementById('gv-result').textContent = game.result || '*';
    document.getElementById('gv-event').textContent = game.event || '';
    document.getElementById('gv-date').textContent = game.date_played || '';
    const ecoStr = (window.EcoOpenings && typeof EcoOpenings.labelFor === 'function')
        ? EcoOpenings.labelFor(game.eco, game.opening)
        : [game.eco, game.opening].filter(Boolean).join(' - ');
    document.getElementById('gv-opening').textContent = ecoStr;
    document.getElementById('gv-tags').innerHTML = game.tags.map(t => `<span class="tag">#${Html.escape(t.name)}</span>`).join('');

    renderMoveList();
    BoardManager.create('game-board', game.fens[0], {
        flipped: false,
        mode: 'analysis',
        onPositionChange: function (newFen) {
            EngineUI.setPosition(newFen);
            AnnotationPanel.setPosition(newFen);
        },
    });
    MoveNavigator.create('game-nav', {
        fens: game.fens,
        startIndex: 0,
        boardId: 'game-board',
        containerId: 'gv-move-nav',
        keyScope: 'view-game-viewer',
        onNavigate: function (fen, idx) {
            AppState.currentPly = idx;
            highlightCurrentMove();
            EngineUI.setPosition(fen);
            AnnotationPanel.setPosition(fen);
        },
    });
    highlightCurrentMove();
    if (typeof updateBatchNav === 'function') updateBatchNav();

    AnnotationPanel.mount('game-annotation-container');
    AnnotationPanel.setPosition(game.fens[0]);
    EngineUI.mount('game-engine-container');
    EngineUI.setPosition(game.fens[0]);
}

function renderMoveList() {
    const g = AppState.currentGame;
    if (!g) return;
    const el = document.getElementById('gv-moves');
    let html = '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    for (let i = 0; i < g.moves_san.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const wMove = g.moves_san[i];
        const bMove = i + 1 < g.moves_san.length ? g.moves_san[i + 1] : '';
        const wComment = g.comments[i];
        const bComment = i + 1 < g.comments.length ? g.comments[i + 1] : null;

        html += '<tr>';
        html += `<td style="color:var(--text-muted);padding:2px 8px 2px 0;width:30px;text-align:right">${moveNum}.</td>`;
        html += `<td class="move-cell" data-ply="${i + 1}" onclick="goToPly(${i + 1})" style="padding:4px 8px;cursor:pointer;border-radius:4px">${wMove}</td>`;
        html += `<td class="move-cell" data-ply="${i + 2}" onclick="goToPly(${i + 2})" style="padding:4px 8px;cursor:pointer;border-radius:4px">${bMove}</td>`;
        html += '</tr>';

        if (wComment || bComment) {
            html += '<tr><td></td><td colspan="2" style="padding:2px 8px;font-size:11px;color:var(--text-muted);font-style:italic">';
            if (wComment) html += Html.escape(wComment) + ' ';
            if (bComment) html += Html.escape(bComment);
            html += '</td></tr>';
        }
    }
    html += '</table>';
    el.innerHTML = html;
}

function goToPly(ply) {
    MoveNavigator.goTo('game-nav', ply);
}

function highlightCurrentMove() {
    document.querySelectorAll('#gv-moves .move-cell').forEach(c => {
        c.style.background = '';
        c.style.color = '';
    });
    const active = document.querySelector(`#gv-moves .move-cell[data-ply="${AppState.currentPly}"]`);
    if (active) {
        active.style.background = 'var(--accent-light)';
        active.style.color = 'var(--accent-dim)';
        active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function gvFlip() { BoardManager.flip('game-board'); }

function showSavePositionModal() {
    const g = AppState.currentGame;
    if (!g) return;
    const ply = AppState.currentPly;
    const fen = g.fens[ply];
    const moveDesc = ply === 0 ? 'starting position' : `after ${Math.ceil(ply / 2)}. ${ply % 2 === 1 ? '' : '...'}${g.moves_san[ply - 1]}`;
    const title = `${g.white || '?'} vs ${g.black || '?'} - ${moveDesc}`;

    document.getElementById('save-pos-fen').value = fen;
    document.getElementById('save-pos-title').value = title;
    _saveTagState.tags = g.tags.map(t => t.name);
    _saveTagFilter = TagFilter.mount({
        containerId: 'save-pos-tags-container',
        state: _saveTagState,
        onChange: function() {},
        placeholder: 'Add tags...'
    });
    document.getElementById('save-pos-notes').value = '';
    document.getElementById('save-pos-modal').style.display = 'flex';
    document.getElementById('save-pos-notes').focus();
}

function hideSavePositionModal() {
    document.getElementById('save-pos-modal').style.display = 'none';
}

async function doSavePosition() {
    const fen = document.getElementById('save-pos-fen').value;
    const title = document.getElementById('save-pos-title').value.trim();
    const tags = _saveTagState.tags.slice();
    const notes = document.getElementById('save-pos-notes').value.trim();

    const res = await fetch(API + '/positions/', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({fen, title: title || null, notes: notes || null, tags})
    });
    if (res.ok) {
        toast('Position saved!');
        hideSavePositionModal();
    } else {
        const err = await res.json();
        toast(err.detail || 'Error saving', true);
    }
}

function backToGames() {
    if (AppState.batchMode) {
        AppState.batchMode = false;
        AppState.batchCollectionId = null;
        AppState.batchCollectionName = null;
        AppState.batchGameIds = [];
        AppState.batchIndex = 0;
        if (typeof updateBatchNav === 'function') updateBatchNav();
    }
    Navigation.cancelToFallback({ view: 'games' });
}

async function deleteCurrentGame() {
    const g = AppState.currentGame;
    if (!g) return;
    const label = `${g.white || '?'} vs ${g.black || '?'}`;
    if (!confirm(`Delete this game (${label})? This cannot be undone.`)) return;
    const res = await fetch(API + '/games/' + g.id, { method: 'DELETE' });
    if (res.ok) {
        toast('Game deleted');
        AppState.currentGame = null;
        backToGames();
        if (typeof loadGames === 'function') loadGames();
    } else {
        toast('Failed to delete game', true);
    }
}

function undoGameBoard() {
    BoardManager.undoAnalysis('game-board');
}

function resetGameBoard() {
    BoardManager.resetAnalysis('game-board');
}

window.openGame = openGame;
window.loadGameDetail = loadGameDetail;
window.goToPly = goToPly;
window.gvFlip = gvFlip;
window.showSavePositionModal = showSavePositionModal;
window.hideSavePositionModal = hideSavePositionModal;
window.doSavePosition = doSavePosition;
window.backToGames = backToGames;
window.deleteCurrentGame = deleteCurrentGame;
window.undoGameBoard = undoGameBoard;
window.resetGameBoard = resetGameBoard;
