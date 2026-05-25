const SEARCH_START_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';
const SEARCH_PIECES = [
    { color: 'w', type: 'k' }, { color: 'w', type: 'q' }, { color: 'w', type: 'r' },
    { color: 'w', type: 'b' }, { color: 'w', type: 'n' }, { color: 'w', type: 'p' },
    { color: 'b', type: 'k' }, { color: 'b', type: 'q' }, { color: 'b', type: 'r' },
    { color: 'b', type: 'b' }, { color: 'b', type: 'n' }, { color: 'b', type: 'p' },
];
const SEARCH_PIECE_SVG_KEYS = {
    'wk': 'wK', 'wq': 'wQ', 'wr': 'wR', 'wb': 'wB', 'wn': 'wN', 'wp': 'wP',
    'bk': 'bK', 'bq': 'bQ', 'br': 'bR', 'bb': 'bB', 'bn': 'bN', 'bp': 'bP',
};
let searchChess = null;
let searchActiveTool = 'w_p';
let searchAbortController = null;

function _searchSetPhase(phase) {
    const stopBtn = document.getElementById('search-stop-btn');
    const resetBtn = document.getElementById('search-reset-btn');
    const runBtn = document.getElementById('search-run-btn');
    if (stopBtn) stopBtn.style.display = phase === 'searching' ? '' : 'none';
    if (runBtn) runBtn.style.display = phase === 'searching' ? 'none' : '';
    if (resetBtn) resetBtn.style.display = phase === 'results' ? '' : 'none';
}

function initSearchBoard() {
    if (!AppState.searchFen) AppState.searchFen = SEARCH_START_FEN;
    searchChess = new Chess();
    if (!searchChess.load(AppState.searchFen)) searchChess.load(SEARCH_START_FEN);
    searchActiveTool = 'w_p';

    const input = document.getElementById('search-fen');
    if (input) input.value = AppState.searchFen === SEARCH_START_FEN ? '' : AppState.searchFen;
    const pawnRadio = document.querySelector('input[name="search-type"][value="pawn"]');
    if (pawnRadio) pawnRadio.checked = true;

    if (window.BoardManager) {
        BoardManager.create('search-board', AppState.searchFen, { flipped: false });
        BoardManager.enableSquareSelect('search-board', searchOnSquareClick);
    }
    renderSearchPalette();
    _searchSetPhase('build');
}

function renderSearchPalette() {
    const el = document.getElementById('search-palette');
    if (!el) return;
    let html = '<div class="editor-palette" aria-label="Search board pieces">';
    html += '<div class="palette-row">';
    SEARCH_PIECES.forEach(function (p, i) {
        if (i === 6) html += '</div><div class="palette-row">';
        const key = p.color + '_' + p.type;
        const svgKey = SEARCH_PIECE_SVG_KEYS[p.color + p.type];
        const active = searchActiveTool === key ? ' active' : '';
        html += '<button class="palette-btn search-palette-btn' + active + '" data-search-tool="' + key + '" title="' + svgKey + '">';
        html += '<img src="' + PIECE_SVG[svgKey] + '" alt="' + svgKey + '">';
        html += '</button>';
    });
    html += '</div></div>';
    // SAFE_INNER_HTML: Template with controlled palette buttons and trusted SVG images
    el.innerHTML = html;
}

function searchSelectTool(tool) {
    searchActiveTool = tool;
    document.querySelectorAll('.search-palette-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.searchTool === tool);
    });
}

function _syncSearchFen(fen, showInInput) {
    AppState.searchFen = fen;
    const input = document.getElementById('search-fen');
    if (input) input.value = showInInput || fen !== SEARCH_START_FEN ? fen : '';
}

function searchOnSquareClick(square) {
    if (!searchChess) searchChess = new Chess(SEARCH_START_FEN);
    if (searchActiveTool === 'eraser') {
        searchChess.remove(square);
    } else {
        const parts = searchActiveTool.split('_');
        const selectedPiece = { color: parts[0], type: parts[1] };
        const existingPiece = searchChess.get(square);

        // Toggle behavior: clicking the same selected piece removes it.
        // Clicking a different piece replaces it. Clicking an empty square places it.
        if (existingPiece && existingPiece.color === selectedPiece.color && existingPiece.type === selectedPiece.type) {
            searchChess.remove(square);
        } else {
            searchChess.put(selectedPiece, square);
        }
    }
    const fen = searchChess.fen();
    BoardManager.setPosition('search-board', fen);
    _syncSearchFen(fen, false);
    document.getElementById('search-status').textContent = '';
}

function renderSearchScope() {
    const el = document.getElementById('search-scope');
    if (!el) return;
    // SAFE_INNER_HTML: Template with escaped content - Html.escape() used for collection names
    el.innerHTML = '<option value="">All games</option>' +
        (AppState.allCollections || []).map(c =>
            `<option value="${c.id}">${Html.escape(c.name)}</option>`
        ).join('');
}

function searchFlipBoard() {
    BoardManager.flip('search-board');
}

function searchSetStart() {
    if (!searchChess) searchChess = new Chess();
    searchChess.load(SEARCH_START_FEN);
    _syncSearchFen(SEARCH_START_FEN, false);
    BoardManager.setPosition('search-board', SEARCH_START_FEN);
    BoardManager.enableSquareSelect('search-board', searchOnSquareClick);
    // SAFE_INNER_HTML: Clearing element content
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-status').textContent = 'Board cleared. Build a new search position.';
    _searchSetPhase('build');
}

function searchLoadFen() {
    const f = document.getElementById('search-fen').value.trim();
    if (!f) { toast('Enter a FEN', true); return; }
    if (!searchChess) searchChess = new Chess();
    if (!searchChess.load(f)) { toast('Invalid FEN', true); return; }
    _syncSearchFen(f, true);
    BoardManager.setPosition('search-board', f);
    BoardManager.enableSquareSelect('search-board', searchOnSquareClick);
}

function searchUseBoard() {
    const fen = BoardManager.getPosition('search-board') || AppState.searchFen || SEARCH_START_FEN;
    if (!searchChess) searchChess = new Chess();
    searchChess.load(fen);
    _syncSearchFen(fen, true);
}

function resetSearch() {
    AppState.searchFen = SEARCH_START_FEN;
    if (searchChess) searchChess.load(SEARCH_START_FEN);
    const input = document.getElementById('search-fen');
    if (input) input.value = '';
    BoardManager.setPosition('search-board', SEARCH_START_FEN);
    BoardManager.enableSquareSelect('search-board', searchOnSquareClick);
    // SAFE_INNER_HTML: Clearing element content
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-status').textContent = 'New search. Place pieces on the board.';
    const pawnRadio = document.querySelector('input[name="search-type"][value="pawn"]');
    if (pawnRadio) pawnRadio.checked = true;
    _searchSetPhase('build');
}

function getSelectedSearchType() {
    const radios = document.querySelectorAll('input[name="search-type"]');
    for (const r of radios) if (r.checked) return r.value;
    return 'pawn';
}

function stopPositionSearch() {
    if (searchAbortController) {
        searchAbortController.abort();
        searchAbortController = null;
    }
    document.getElementById('search-status').textContent = 'Search stopped.';
    _searchSetPhase('build');
}

async function doPositionSearch() {
    searchUseBoard();
    const fen = document.getElementById('search-fen').value.trim() || AppState.searchFen;
    if (!fen) { toast('Enter a FEN', true); return; }
    const boardPart = fen.split(' ')[0];
    if (boardPart === '8/8/8/8/8/8/8/8') {
        toast('Place at least one piece on the board', true);
        return;
    }

    const searchType = getSelectedSearchType();
    const scopeVal = document.getElementById('search-scope').value;
    const status = document.getElementById('search-status');
    const results = document.getElementById('search-results');

    status.textContent = 'Searching...';
    // SAFE_INNER_HTML: Clearing element content
    results.innerHTML = '';
    _searchSetPhase('searching');
    searchAbortController = new AbortController();

    let data;
    try {
        data = await ApiClient.post('/games/search-position', { fen, search_type: searchType }, { signal: searchAbortController.signal });
    } catch (e) {
        if (e.name === 'AbortError') {
            status.textContent = 'Search stopped.';
        } else {
            const msg = e.data?.detail || 'Search failed';
            status.textContent = msg;
        }
        searchAbortController = null;
        _searchSetPhase('build');
        return;
    }
    searchAbortController = null;

    if (scopeVal) {
        const scopeId = parseInt(scopeVal, 10);
        try {
            const scopedGames = await ApiClient.get('/games/', { collection_id: scopeId });
            const scopedIds = new Set(scopedGames.map(g => g.id));
            data = data.filter(r => scopedIds.has(r.game_id));
        } catch (_) {}
    }

    status.textContent = data.length + ' match(es)';
    renderSearchResults(data);
    _searchSetPhase('results');
}

function renderSearchResults(data) {
    const el = document.getElementById('search-results');
    const countLabel = data.length === 1 ? '1 match' : data.length + ' matches';
    const header = '<div class="search-results-header"><div><h3>Results</h3><p class="text-muted">' + countLabel + ' found</p></div><button class="btn btn-primary" data-action="search-reset">New Search</button></div>';
    if (!data.length) {
        // SAFE_INNER_HTML: Template with escaped content via EmptyStates.render()
        el.innerHTML = header + EmptyStates.render('No matches', 'Try a different position or search type.');
        return;
    }
    // SAFE_INNER_HTML: Template with escaped content - Html.escape() used for player names and events
    el.innerHTML = header + '<div class="search-results-grid">' + data.map(r => {
        const w = r.white || '?';
        const b = r.black || '?';
        const res = r.result || '*';
        const ecoLabel = EcoOpenings.labelFor(r.eco, null);
        const eco = ecoLabel ? `<span class="text-muted" style="font-size:12px">${ecoLabel}</span>` : '';
        const evt = r.event ? `<span class="text-muted" style="font-size:12px">${Html.escape(r.event)}</span>` : '';
        const moveNum = MoveCounts.fullMoveCountFromPlies(r.half_move);
        const moveLabel = r.half_move === 0 ? 'start' : ('after ' + moveNum + (r.half_move % 2 === 1 ? '.' : '...'));
        return `<div class="pos-item" data-game-id="${r.game_id}" data-half-move="${r.half_move}">
            <div style="flex:1">
                <div style="font-size:14px;font-weight:500">${Html.escape(w)} vs ${Html.escape(b)} <span class="text-muted">${res}</span></div>
                <div style="margin-top:4px">${eco} ${evt}</div>
                <div class="text-muted" style="font-size:12px;margin-top:4px">match: ${moveLabel}</div>
            </div>
        </div>`;
    }).join('') + '</div>';
    
    // Initialize keyboard navigation for search results
    setTimeout(() => {
        if (window.KeyboardNavigation) {
            KeyboardNavigation.initGrid('search-results', '.pos-item');
        }
    }, 50);
}

async function openSearchResult(gameId, halfMove) {
    const route = { view: 'gameDetail', id: gameId };
    history.pushState(route, '', Router.build(route));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-game-viewer').classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => {
        if (b.textContent === 'Games') b.classList.add('active');
    });
    await loadGameDetail(gameId);
    if (typeof goToPly === 'function') goToPly(halfMove);
}

window.initSearchBoard = initSearchBoard;
window.renderSearchScope = renderSearchScope;
window.searchFlipBoard = searchFlipBoard;
window.searchSetStart = searchSetStart;
window.searchLoadFen = searchLoadFen;
window.searchUseBoard = searchUseBoard;
window.searchSelectTool = searchSelectTool;
window.resetSearch = resetSearch;
window.doPositionSearch = doPositionSearch;
window.stopPositionSearch = stopPositionSearch;
window.openSearchResult = openSearchResult;
