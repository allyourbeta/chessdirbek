async function loadGames() {
    const offset = AppState.gamePage * AppState.gamePageSize;
    try {
        AppState.allGames = await ApiClient.get('/games/', Object.assign(_currentGamesParams(), { limit: AppState.gamePageSize, offset }));
    } catch (e) {
        console.error(e);
        AppState.allGames = [];
    }
    // Fetch total count in parallel for pagination
    try {
        const cd = await ApiClient.get('/games/count', _currentGamesParams());
        AppState.gameTotalCount = cd.count || 0;
    } catch (e) {
        console.error(e);
        AppState.gameTotalCount = AppState.allGames.length;
    }
    AppState.selectedGameIds = new Set();
    renderGamesList();
}

// Build current Games-view route params from AppState.
function _currentGamesParams() {
    const p = {};
    if (AppState.gameTagFilters && AppState.gameTagFilters.length) p.tags = AppState.gameTagFilters.slice();
    if (AppState.gameCollectionFilter) p.collection_id = AppState.gameCollectionFilter;
    if (AppState.gameResultFilter) p.result = AppState.gameResultFilter;
    if (AppState.gameSearch) p.search = AppState.gameSearch;
    if (AppState.gamePage) p.page = AppState.gamePage;
    if (AppState.gameStarredFilter) p.starred = true;
    return p;
}

// Push a new history entry reflecting current filter state WITHOUT
// re-rendering (caller is already on Games view and will call loadGames()).
function _pushGamesUrl() {
    if (Router.isRendering()) return;
    const route = { view: 'games', params: _currentGamesParams() };
    history.pushState(route, '', Router.build(route));
}

// Update URL in place (no new history entry) — for debounced/typed input.
function _replaceGamesUrl() {
    if (Router.isRendering()) return;
    const route = { view: 'games', params: _currentGamesParams() };
    history.replaceState(route, '', Router.build(route));
}

function mountGameTagFilter() {
    TagFilter.mount({
        containerId: 'game-tag-filters',
        state: { tags: AppState.gameTagFilters },
        onChange: tags => {
            AppState.gameTagFilters = tags;
            AppState.gamePage = 0;
            _pushGamesUrl();
            loadGames();
        },
        placeholder: 'Filter by tag...',
    });
}

async function loadCollections() {
    AppState.allCollections = await ApiClient.get('/collections/');
    renderCollectionFilter();
    renderImportCollections();
}

const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function _gameDate(g) {
    if (!g.date_played) return '';
    // PGN dates are "YYYY.MM.DD" with "??" or "0" for unknown parts.
    const parts = g.date_played.split('.');
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const yOk = year && /^\d{4}$/.test(year);
    const mOk = month && /^\d{1,2}$/.test(month) && +month >= 1 && +month <= 12;
    const dOk = day && /^\d{1,2}$/.test(day) && +day >= 1 && +day <= 31;
    if (yOk && mOk && dOk) return `${_MONTHS[+month - 1]} ${+day}, ${year}`;
    if (yOk && mOk) return `${_MONTHS[+month - 1]} ${year}`;
    if (yOk) return year;
    return '';
}

function _gameOpening(g) {
    return EcoOpenings.labelFor(g.eco, g.opening);
}

function renderGamesList() {
    const el = document.getElementById('games-list');
    if (!AppState.allGames.length && AppState.gameTotalCount === 0) {
        // SAFE_INNER_HTML: Template with escaped content via EmptyStates.render()
        el.innerHTML = EmptyStates.render('No games yet', 'Import PGN games to get started.');
        updateBulkBar();
        renderPager();
        return;
    }
    const rows = AppState.allGames.map(g => {
        const w = Html.escape(g.white || '?');
        const b = Html.escape(g.black || '?');
        const we = g.white_elo ? `<span class="elo">[${g.white_elo}]</span>` : '';
        const be = g.black_elo ? `<span class="elo">[${g.black_elo}]</span>` : '';
        const res = Html.escape(g.result || '*');
        const opening = Html.escape(_gameOpening(g));
        const date = Html.escape(_gameDate(g));
        const checked = AppState.selectedGameIds.has(g.id) ? 'checked' : '';
        const starHtml = `<span class="game-star-toggle" data-star-kind="game" data-game-id="${g.id}">${StarControl.renderStarIcon(g.starred)}</span>`;
        return `<tr data-game-id="${g.id}">
            <td class="col-select">
                <input type="checkbox" class="game-select" data-id="${g.id}" ${checked}>
            </td>
            <td class="col-star">${starHtml}</td>
            <td class="col-players">${w}${we} <span class="text-muted">vs</span> ${b}${be}</td>
            <td class="col-result">${res}</td>
            <td class="col-opening">${opening}</td>
            <td class="col-date">${date}</td>
            <td class="col-moves">${MoveCounts.fullMoveCountFromPlies(g.move_count)}</td>
        </tr>`;
    }).join('');
    // SAFE_INNER_HTML: Template with escaped content - all user data (names, results, openings, dates) passed through Html.escape()
    el.innerHTML = `<table class="games-table">
        <thead><tr>
            <th class="col-select"></th>
            <th class="col-star"></th>
            <th class="col-players">White [Elo] vs Black [Elo]</th>
            <th class="col-result">Result</th>
            <th class="col-opening">Opening</th>
            <th class="col-date">Date</th>
            <th class="col-moves">Moves</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
    updateBulkBar();
    renderPager();
    
    // Initialize keyboard navigation for games table
    setTimeout(() => {
        if (window.KeyboardNavigation) {
            KeyboardNavigation.initGrid('games-list', 'tr[data-game-id]');
        }
    }, 50);
}

function renderPager() {
    let pager = document.getElementById('games-pager');
    if (!pager) {
        pager = document.createElement('div');
        pager.id = 'games-pager';
        pager.className = 'pager';
        const list = document.getElementById('games-list');
        list.parentNode.insertBefore(pager, list.nextSibling);
    }
    const total = AppState.gameTotalCount;
    const size = AppState.gamePageSize;
    const page = AppState.gamePage;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const start = total ? page * size + 1 : 0;
    const end = Math.min(total, (page + 1) * size);
    // SAFE_INNER_HTML: Static template with controlled numeric values
    pager.innerHTML = `
        <button class="btn btn-sm games-prev-btn" ${page <= 0 ? 'disabled' : ''}>&larr; Prev</button>
        <span>${start}–${end} of ${total}</span>
        <button class="btn btn-sm games-next-btn" ${page + 1 >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
    `;
}

function gamesPrevPage() {
    if (AppState.gamePage > 0) {
        AppState.gamePage--;
        _pushGamesUrl();
        loadGames();
    }
}

function gamesNextPage() {
    const totalPages = Math.max(1, Math.ceil(AppState.gameTotalCount / AppState.gamePageSize));
    if (AppState.gamePage + 1 < totalPages) {
        AppState.gamePage++;
        _pushGamesUrl();
        loadGames();
    }
}

function toggleGameSelect(id, checked) {
    if (checked) AppState.selectedGameIds.add(id);
    else AppState.selectedGameIds.delete(id);
    updateBulkBar();
}

function toggleSelectAllGames(checked) {
    if (checked) AppState.allGames.forEach(g => AppState.selectedGameIds.add(g.id));
    else AppState.selectedGameIds.clear();
    document.querySelectorAll('.game-select').forEach(cb => { cb.checked = checked; });
    updateBulkBar();
}

function updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    if (!bar) return;
    const n = AppState.selectedGameIds.size;
    if (n === 0) {
        bar.style.display = 'none';
    } else {
        bar.style.display = 'flex';
        const countEl = document.getElementById('bulk-count');
        if (countEl) countEl.textContent = n + ' selected';
    }
}

async function deleteSelectedGames() {
    const ids = Array.from(AppState.selectedGameIds);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} game(s)? This cannot be undone.`)) return;
    let ok = 0, fail = 0;
    for (const id of ids) {
        try {
            await ApiClient.delete('/games/' + id);
            ok++;
        } catch (e) { console.error(e); fail++; }
    }
    AppState.selectedGameIds = new Set();
    toast(`Deleted ${ok} game(s)` + (fail ? `, ${fail} failed` : ''), fail > 0);
    loadGames();
}

function renderCollectionFilter() {
    const el = document.getElementById('game-collection-filter');
    // SAFE_INNER_HTML: Template with escaped content - Html.escape() used for collection names
    el.innerHTML = '<option value="">All Collections</option>' +
        AppState.allCollections.map(c => `<option value="${c.id}" ${AppState.gameCollectionFilter == c.id ? 'selected' : ''}>${Html.escape(c.name)} (${c.game_count})</option>`).join('');
}

function onCollectionFilterChange(sel) {
    AppState.gameCollectionFilter = sel.value || null;
    AppState.gamePage = 0;
    _pushGamesUrl();
    loadGames();
}

function onResultFilterChange(sel) {
    AppState.gameResultFilter = sel.value || '';
    AppState.gamePage = 0;
    _pushGamesUrl();
    loadGames();
}

let _gameSearchTimer = null;
function onGameSearch() {
    clearTimeout(_gameSearchTimer);
    _gameSearchTimer = setTimeout(() => {
        AppState.gameSearch = document.getElementById('game-search-input').value.trim();
        AppState.gamePage = 0;
        // Typed search = replace URL (don't pollute history per keystroke).
        _replaceGamesUrl();
        loadGames();
    }, 300);
}

window.loadGames = loadGames;
window.loadCollections = loadCollections;
window.renderGamesList = renderGamesList;
window.mountGameTagFilter = mountGameTagFilter;
window.gamesPrevPage = gamesPrevPage;
window.gamesNextPage = gamesNextPage;
window.renderCollectionFilter = renderCollectionFilter;
window.onCollectionFilterChange = onCollectionFilterChange;
window.onResultFilterChange = onResultFilterChange;
window.onGameSearch = onGameSearch;
window.toggleGameSelect = toggleGameSelect;
window.toggleSelectAllGames = toggleSelectAllGames;
window.deleteSelectedGames = deleteSelectedGames;
