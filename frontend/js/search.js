const SEARCH_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function initSearchBoard() {
    if (!AppState.searchFen) AppState.searchFen = SEARCH_START_FEN;
    const input = document.getElementById('search-fen');
    if (input && !input.value) input.value = AppState.searchFen;
    if (window.BoardManager) {
        BoardManager.create('search-board', AppState.searchFen, { flipped: false });
    }
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
    AppState.searchFen = SEARCH_START_FEN;
    document.getElementById('search-fen').value = SEARCH_START_FEN;
    BoardManager.setPosition('search-board', SEARCH_START_FEN);
}

function searchLoadFen() {
    const f = document.getElementById('search-fen').value.trim();
    if (!f) { toast('Enter a FEN', true); return; }
    AppState.searchFen = f;
    BoardManager.setPosition('search-board', f);
}

function searchUseBoard() {
    const fen = BoardManager.getPosition('search-board') || AppState.searchFen;
    document.getElementById('search-fen').value = fen;
    AppState.searchFen = fen;
}

function getSelectedSearchType() {
    const radios = document.querySelectorAll('input[name="search-type"]');
    for (const r of radios) if (r.checked) return r.value;
    return 'exact';
}

async function doPositionSearch() {
    const fen = document.getElementById('search-fen').value.trim() || AppState.searchFen;
    if (!fen) { toast('Enter a FEN', true); return; }

    const searchType = getSelectedSearchType();
    const scopeVal = document.getElementById('search-scope').value;
    const status = document.getElementById('search-status');
    const results = document.getElementById('search-results');

    status.textContent = 'Searching...';
    // SAFE_INNER_HTML: Clearing element content
    results.innerHTML = '';

    let data;
    try {
        data = await ApiClient.post('/games/search-position', { fen, search_type: searchType });
    } catch (e) {
        const msg = e.data?.detail || 'Search failed';
        status.textContent = msg;
        return;
    }

    if (scopeVal) {
        const scopeId = parseInt(scopeVal, 10);
        try {
            const scopedGames = await ApiClient.get('/games/', { collection_id: scopeId });
            const scopedIds = new Set(scopedGames.map(g => g.id));
            data = data.filter(r => scopedIds.has(r.game_id));
        } catch (_) {
            // Ignore scoping errors
        }
    }

    status.textContent = data.length + ' match(es)';
    renderSearchResults(data);
}

function renderSearchResults(data) {
    const el = document.getElementById('search-results');
    if (!data.length) {
        // SAFE_INNER_HTML: Template with escaped content via EmptyStates.render()
        el.innerHTML = EmptyStates.render('No matches', 'Try a different position or search type.');
        return;
    }
    // SAFE_INNER_HTML: Template with escaped content - Html.escape() used for player names and events
    el.innerHTML = data.map(r => {
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
    }).join('');
}

async function openSearchResult(gameId, halfMove) {
    // Push URL + activate view manually (not via navigate) so we can await
    // the fetch and THEN jump to the ply. navigate() would fire-and-forget.
    const route = { view: 'gameDetail', id: gameId };
    history.pushState(route, '', Router.build(route));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-game-viewer').classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => {
        if (b.textContent === 'Games') b.classList.add('active');
    });
    await loadGameDetail(gameId);
    if (typeof goToPly === 'function') {
        goToPly(halfMove);
    }
}

window.initSearchBoard = initSearchBoard;
window.renderSearchScope = renderSearchScope;
window.searchFlipBoard = searchFlipBoard;
window.searchSetStart = searchSetStart;
window.searchLoadFen = searchLoadFen;
window.searchUseBoard = searchUseBoard;
window.doPositionSearch = doPositionSearch;
window.openSearchResult = openSearchResult;
