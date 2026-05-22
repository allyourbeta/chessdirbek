let _treeVisible = false;
let _treeData = null;

function toggleOpeningTree() {
    _treeVisible = !_treeVisible;
    const panel = document.getElementById('opening-tree-panel');
    const btn = document.getElementById('opening-tree-btn');
    if (_treeVisible) {
        panel.style.display = 'block';
        btn.textContent = 'Hide Explorer';
        loadOpeningTree();
    } else {
        panel.style.display = 'none';
        btn.textContent = 'Opening Explorer';
        _treeData = null;
    }
}

async function loadOpeningTree(fen) {
    if (!_treeVisible) return;
    const g = AppState.currentGame;
    if (!fen && g) {
        fen = g.fens[AppState.currentPly];
    }
    if (!fen) return;

    const el = document.getElementById('opening-tree-content');
    el.innerHTML = '<div style="color:var(--text-muted);font-size:12px">Loading...</div>';

    try {
        _treeData = await ApiClient.get('/opening-tree/', { fen });
        renderOpeningTree();
    } catch (e) {
        el.innerHTML = '<div style="color:var(--red);font-size:12px">Error loading tree</div>';
    }
}

function renderOpeningTree() {
    const el = document.getElementById('opening-tree-content');
    if (!_treeData || !_treeData.moves.length) {
        el.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px">No games found for this position.</div>';
        return;
    }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<tr class="text-muted" style="border-bottom:1px solid var(--border)">';
    html += '<th style="text-align:left;padding:4px 8px">Move</th>';
    html += '<th style="text-align:right;padding:4px 6px">Games</th>';
    html += '<th style="text-align:right;padding:4px 6px">White</th>';
    html += '<th style="text-align:right;padding:4px 6px">Draw</th>';
    html += '<th style="text-align:right;padding:4px 6px">Black</th>';
    html += '<th style="padding:4px 6px;width:80px"></th>';
    html += '</tr>';

    for (const m of _treeData.moves) {
        const wPct = m.games > 0 ? Math.round(m.white_wins / m.games * 100) : 0;
        const dPct = m.games > 0 ? Math.round(m.draws / m.games * 100) : 0;
        const bPct = m.games > 0 ? Math.round(m.black_wins / m.games * 100) : 0;
        const fenEsc = m.fen.replace(/'/g, "\\'");

        html += '<tr class="tree-row" style="cursor:pointer;border-bottom:1px solid var(--border)" data-fen="' + fenEsc + '">';
        html += `<td style="padding:4px 8px;color:var(--accent);font-weight:500">${m.san}</td>`;
        html += `<td style="text-align:right;padding:4px 6px">${m.games}</td>`;
        html += `<td style="text-align:right;padding:4px 6px;color:var(--text-muted)">${wPct}%</td>`;
        html += `<td style="text-align:right;padding:4px 6px;color:var(--text-muted)">${dPct}%</td>`;
        html += `<td style="text-align:right;padding:4px 6px;color:var(--text-muted)">${bPct}%</td>`;
        html += '<td style="padding:4px 6px">';
        html += `<div style="display:flex;height:10px;border-radius:3px;overflow:hidden;background:var(--border)">`;
        if (wPct > 0) html += `<div style="width:${wPct}%;background:#f0f0f0"></div>`;
        if (dPct > 0) html += `<div style="width:${dPct}%;background:var(--text-muted)"></div>`;
        if (bPct > 0) html += `<div style="width:${bPct}%;background:#555"></div>`;
        html += '</div></td>';
        html += '</tr>';
    }

    html += '</table>';
    html += `<div style="font-size:11px;color:var(--text-muted);padding:6px 8px 0">${_treeData.total_games} game(s) in database</div>`;
    el.innerHTML = html;
}

function onTreeMoveClick(fen) {
    BoardManager.setPosition('game-board', fen);
    const g = AppState.currentGame;
    if (g) {
        const idx = g.fens.indexOf(fen);
        if (idx >= 0) {
            AppState.currentPly = idx;
            highlightCurrentMove();
        }
    }
    loadOpeningTree(fen);
}

const _origGoToPly = window.goToPly;
window.goToPly = function(ply) {
    _origGoToPly(ply);
    if (_treeVisible) loadOpeningTree();
};

window.toggleOpeningTree = toggleOpeningTree;
window.loadOpeningTree = loadOpeningTree;
window.onTreeMoveClick = onTreeMoveClick;
