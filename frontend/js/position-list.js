async function loadPositions() {
    let u = API + '/positions/';
    const tags = AppState.positionTagFilters || [];
    if (tags.length) {
        u += '?' + tags.map(t => 'tags=' + encodeURIComponent(t)).join('&');
    }
    AppState.allPositions = await (await fetch(u)).json();
    renderPositionsList();
}

async function loadTabiyas() {
    let u = API + '/positions/?position_type=tabiya';
    const tags = AppState.positionTagFilters || [];
    if (tags.length) {
        u += '&' + tags.map(t => 'tags=' + encodeURIComponent(t)).join('&');
    }
    const positions = await (await fetch(u)).json();
    AppState.allPositions = positions;
    renderTabiyasList();
}

async function loadTactics() {
    let u = API + '/positions/?position_type=puzzle';
    const tags = AppState.positionTagFilters || [];
    if (tags.length) {
        u += '&' + tags.map(t => 'tags=' + encodeURIComponent(t)).join('&');
    }
    const positions = await (await fetch(u)).json();
    AppState.allPositions = positions;
    renderTacticsList();
}

function mountPositionTagFilter() {
    TagFilter.mount({
        containerId: 'tag-filters',
        state: { tags: AppState.positionTagFilters },
        onChange: tags => {
            AppState.positionTagFilters = tags;
            if (!Router.isRendering()) {
                const route = { view: 'positions', params: tags.length ? { tags: tags.slice() } : {} };
                history.pushState(route, '', Router.build(route));
            }
            loadPositions();
        },
        placeholder: 'Filter by tag...',
    });
}

function mountTabiyaTagFilter() {
    TagFilter.mount({
        containerId: 'tabiyas-tag-filters',
        state: { tags: AppState.positionTagFilters },
        onChange: tags => {
            AppState.positionTagFilters = tags;
            if (!Router.isRendering()) {
                const route = { view: 'tabiyas', params: tags.length ? { tags: tags.slice() } : {} };
                history.pushState(route, '', Router.build(route));
            }
            loadTabiyas();
        },
        placeholder: 'Filter by tag...',
    });
}

function mountTacticsTagFilter() {
    TagFilter.mount({
        containerId: 'tactics-tag-filters',
        state: { tags: AppState.positionTagFilters },
        onChange: tags => {
            AppState.positionTagFilters = tags;
            if (!Router.isRendering()) {
                const route = { view: 'tactics', params: tags.length ? { tags: tags.slice() } : {} };
                history.pushState(route, '', Router.build(route));
            }
            loadTactics();
        },
        placeholder: 'Filter by tag...',
    });
}

function showDetail(id) {
    const pos = AppState.allPositions.find(p => p.id === id);
    const positionType = pos ? pos.position_type : 'tabiya';
    const tags = AppState.positionTagFilters || [];
    const params = tags.length ? { tags: tags.slice() } : {};
    Router.navigate({ view: 'positionDetail', id, positionType, params });
}

function renderPositionsList() {
    const route = Router.current();
    if (route.view === 'tactics') {
        renderTacticsList();
    } else {
        renderTabiyasList();
    }
}

function renderTabiyasList() {
    const el = document.getElementById('tabiyas-list');
    if (!el) return;
    const tabiyas = AppState.allPositions.filter(p => p.position_type === 'tabiya');
    const countEl = document.getElementById('tabiyas-count');
    if (countEl) {
        const tags = AppState.positionTagFilters || [];
        countEl.textContent = tags.length
            ? 'Showing ' + tabiyas.length + ' positions'
            : tabiyas.length + ' positions';
    }
    if (!tabiyas.length) {
        el.innerHTML = `<div class="empty-state"><p>No tabiyas yet</p><p>Click "Add New" to save your first opening position.</p></div>`;
        return;
    }
    el.innerHTML = tabiyas.map(p =>
        `<div class="pos-item" data-pos-id="${p.id}" onclick="showDetail(${p.id})">${renderMiniBoard(p.fen, p.orientation)}<div class="pos-item-body"><div class="title">${p.title || 'Untitled'}</div><div class="pos-item-tags">${p.tags.map(t => '<span class="tag">#' + t.name + '</span>').join('')}</div></div><button class="btn btn-sm btn-ghost pos-item-delete" onclick="event.stopPropagation();deleteFromList(${p.id},'tabiya')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>`
    ).join('');
}

function renderTacticsList() {
    const el = document.getElementById('tactics-list');
    if (!el) return;
    const tactics = AppState.allPositions.filter(p => p.position_type === 'puzzle');
    const countEl = document.getElementById('tactics-count');
    if (countEl) {
        const tags = AppState.positionTagFilters || [];
        countEl.textContent = tags.length
            ? 'Showing ' + tactics.length + ' positions'
            : tactics.length + ' positions';
    }
    if (!tactics.length) {
        el.innerHTML = `<div class="empty-state"><p>No tactics puzzles yet</p><p>Click "Add New" to save your first tactical puzzle.</p></div>`;
        return;
    }
    el.innerHTML = tactics.map(p =>
        `<div class="pos-item" data-pos-id="${p.id}" onclick="showDetail(${p.id})">${renderMiniBoard(p.fen, p.orientation)}<div class="pos-item-body"><div class="title">${p.title || 'Untitled'}</div><div class="pos-item-tags">${p.tags.map(t => '<span class="tag">#' + t.name + '</span>').join('')}</div></div><button class="btn btn-sm btn-ghost pos-item-delete" onclick="event.stopPropagation();deleteFromList(${p.id},'puzzle')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>`
    ).join('');
}

async function deleteFromList(id, type) {
    if (!confirm('Delete this position?')) return;
    if ((await fetch(API + '/positions/' + id, { method: 'DELETE' })).ok) {
        toast('Position deleted');
        if (type === 'puzzle') loadTactics();
        else loadTabiyas();
    }
}

async function randomFromList(posType) {
    const filtered = AppState.allPositions.filter(p =>
        posType === 'puzzle' ? p.position_type === 'puzzle' : p.position_type === 'tabiya'
    );
    if (!filtered.length) { toast('No positions match these tags', 'warn'); return; }
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    showDetail(pick.id);
}

function loadRandomFeatured() {
    var tactics = AppState.allPositions.filter(function(p) {
        return p.position_type === 'puzzle';
    });
    if (!tactics.length) return;
    var pick = tactics[Math.floor(Math.random() * tactics.length)];
    AppState.featuredTacticId = pick.id;
    BoardManager.create('tactics-featured-board', pick.fen, {
        flipped: pick.orientation === 'black',
        mode: 'analysis',
        onPositionChange: function(newFen) {
            EngineUI.setPosition(newFen);
        },
    });
    EngineUI.mount('tactics-featured-engine');
    EngineUI.setPosition(pick.fen);
    document.getElementById('tactics-featured-title').textContent = pick.title || 'Untitled';
    document.getElementById('tactics-featured-tags').innerHTML =
        pick.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tactics-featured-title').onclick = function() {
        showDetail(pick.id);
    };
    document.getElementById('tactics-featured-title').style.cursor = 'pointer';
}

function loadFeaturedById(id) {
    var pos = AppState.allPositions.find(function(p) {
        return p.id === id && p.position_type === 'puzzle';
    });
    if (!pos) {
        // Fall back to random if the requested position isn't in the list
        // (e.g. tag filter excludes it, or it was deleted between save and render)
        loadRandomFeatured();
        return;
    }
    AppState.featuredTacticId = pos.id;
    BoardManager.create('tactics-featured-board', pos.fen, {
        flipped: pos.orientation === 'black',
    });
    EngineUI.mount('tactics-featured-engine');
    EngineUI.setPosition(pos.fen);
    document.getElementById('tactics-featured-title').textContent = pos.title || 'Untitled';
    document.getElementById('tactics-featured-tags').innerHTML =
        pos.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tactics-featured-title').onclick = function() {
        showDetail(pos.id);
    };
    document.getElementById('tactics-featured-title').style.cursor = 'pointer';
}

function focusTabiyaRow(id) {
    var row = document.querySelector('#tabiyas-list .pos-item[data-pos-id="' + id + '"]');
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('row-highlight');
    setTimeout(function() { row.classList.remove('row-highlight'); }, 1500);
}

function flipFeaturedBoard() {
    BoardManager.flip('tactics-featured-board');
}

function loadRandomFeaturedTabiya() {
    var tabiyas = AppState.allPositions.filter(function(p) {
        return p.position_type === 'tabiya';
    });
    if (!tabiyas.length) return;
    var pick = tabiyas[Math.floor(Math.random() * tabiyas.length)];
    AppState.featuredTabiyaId = pick.id;
    BoardManager.create('tabiyas-featured-board', pick.fen, {
        flipped: pick.orientation === 'black',
    });
    EngineUI.mount('tabiyas-featured-engine');
    EngineUI.setPosition(pick.fen);
    document.getElementById('tabiyas-featured-title').textContent = pick.title || 'Untitled';
    document.getElementById('tabiyas-featured-tags').innerHTML =
        pick.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tabiyas-featured-title').onclick = function() {
        showDetail(pick.id);
    };
    document.getElementById('tabiyas-featured-title').style.cursor = 'pointer';
}

function flipFeaturedTabiyaBoard() {
    BoardManager.flip('tabiyas-featured-board');
}

function loadFeaturedTabiyaById(id) {
    var pos = AppState.allPositions.find(function(p) {
        return p.id === id && p.position_type === 'tabiya';
    });
    if (!pos) {
        // Fall back to random if the requested position isn't in the list
        // (e.g. tag filter excludes it, or it was deleted between save and render)
        loadRandomFeaturedTabiya();
        return;
    }
    AppState.featuredTabiyaId = pos.id;
    BoardManager.create('tabiyas-featured-board', pos.fen, {
        flipped: pos.orientation === 'black',
    });
    EngineUI.mount('tabiyas-featured-engine');
    EngineUI.setPosition(pos.fen);
    document.getElementById('tabiyas-featured-title').textContent = pos.title || 'Untitled';
    document.getElementById('tabiyas-featured-tags').innerHTML =
        pos.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tabiyas-featured-title').onclick = function() {
        showDetail(pos.id);
    };
    document.getElementById('tabiyas-featured-title').style.cursor = 'pointer';
}

window.loadRandomFeatured = loadRandomFeatured;
window.loadFeaturedById = loadFeaturedById;
window.focusTabiyaRow = focusTabiyaRow;
window.flipFeaturedBoard = flipFeaturedBoard;
window.loadRandomFeaturedTabiya = loadRandomFeaturedTabiya;
window.flipFeaturedTabiyaBoard = flipFeaturedTabiyaBoard;
window.loadFeaturedTabiyaById = loadFeaturedTabiyaById;
window.loadPositions = loadPositions;
window.loadTabiyas = loadTabiyas;
window.loadTactics = loadTactics;
window.mountPositionTagFilter = mountPositionTagFilter;
window.mountTabiyaTagFilter = mountTabiyaTagFilter;
window.mountTacticsTagFilter = mountTacticsTagFilter;
window.showDetail = showDetail;
window.renderPositionsList = renderPositionsList;
window.renderTabiyasList = renderTabiyasList;
window.renderTacticsList = renderTacticsList;
window.deleteFromList = deleteFromList;
window.randomFromList = randomFromList;
