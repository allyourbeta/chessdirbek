async function loadCategoryPositions(categoryKey) {
    const category = CATEGORIES[categoryKey];
    if (!category) {
        console.error('Unknown category:', categoryKey);
        return;
    }
    
    let u = API + '/positions/?position_type=' + category.positionType;
    const tags = AppState.positionTagFilters || [];
    if (tags.length) {
        u += '&' + tags.map(t => 'tags=' + encodeURIComponent(t)).join('&');
    }
    
    const positions = await ApiClient.get(u.replace(API, ''));
    AppState.allPositions = positions;
    renderCategoryList(categoryKey);
}

function mountCategoryTagFilter(categoryKey) {
    const category = CATEGORIES[categoryKey];
    if (!category) {
        console.error('Unknown category:', categoryKey);
        return;
    }

    TagFilter.mount({
        containerId: 'cat-tag-filters',
        state: { tags: AppState.positionTagFilters },
        onChange: tags => {
            AppState.positionTagFilters = tags;
            if (!Router.isRendering()) {
                const route = { view: categoryKey, params: tags.length ? { tags: tags.slice() } : {} };
                history.pushState(route, '', Router.build(route));
            }
            loadCategoryPositions(categoryKey);
        },
        placeholder: 'Filter by tag...',
    });
}

function renderCategoryList(categoryKey) {
    const category = CATEGORIES[categoryKey];
    if (!category) {
        console.error('Unknown category:', categoryKey);
        return;
    }
    
    const el = document.getElementById('cat-list');
    if (!el) return;
    
    const positions = AppState.allPositions.filter(p => p.position_type === category.positionType);
    const countEl = document.getElementById('cat-count');
    if (countEl) {
        const tags = AppState.positionTagFilters || [];
        countEl.textContent = tags.length
            ? 'Showing ' + positions.length + ' positions'
            : positions.length + ' positions';
    }
    
    if (!positions.length) {
        const emptySingular = category.label.toLowerCase().slice(0, -1); // Remove 's' from plural
        // SAFE_INNER_HTML: Static template with controlled variable interpolation
        el.innerHTML = `<div class="empty-state"><p>No ${emptySingular} positions yet</p><p>Click "Add New" to save your first ${emptySingular} position.</p></div>`;
        return;
    }
    
    // Put featured position first so it's always easy to find
    // Then starred positions, then everything else
    const featuredId = AppState.featuredCategoryId;
    positions.sort(function(a, b) {
        // Featured always first
        if (featuredId) {
            if (a.id === featuredId) return -1;
            if (b.id === featuredId) return 1;
        }
        // Starred before unstarred
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
        return 0; // preserve existing order within same group
    });
    
    // SAFE_INNER_HTML: Template with escaped content - Html.escape() used for titles
    el.innerHTML = positions.map(p => {
        const isFeatured = featuredId && p.id === featuredId;
        const featuredClass = isFeatured ? ' pos-item--featured' : '';
        const starHtml = p.starred ? '<span class="pos-item-star">' + STAR_SVG_FILLED + '</span>' : '';
        return `<div class="pos-item${featuredClass}" data-pos-id="${p.id}">${renderMiniBoard(p.fen, p.orientation)}<div class="pos-item-body"><div class="title">${starHtml}${Html.escape(p.title || 'Untitled')}</div></div><button class="btn btn-sm btn-ghost pos-item-delete" data-delete-id="${p.id}" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>`;
    }).join('');
    
    // Set up event delegation for the position list
    _setupPositionListEvents(el);
}

function showDetail(id) {
    const pos = AppState.allPositions.find(p => p.id === id);
    const positionType = pos ? pos.position_type : 'tabiya';
    const tags = AppState.positionTagFilters || [];
    const params = tags.length ? { tags: tags.slice() } : {};
    Router.navigate({ view: 'positionDetail', id, positionType, params });
}

async function deleteFromList(id) {
    if (!confirm('Delete this position?')) return;
    try {
        await ApiClient.delete('/positions/' + id);
        toast('Position deleted');
        // Reload current category
        if (AppState.currentCategory) {
            loadCategoryPositions(AppState.currentCategory);
        }
    } catch (e) {
        toast('Delete failed', true);
    }
}

async function randomFromList() {
    if (!AppState.allPositions.length) { 
        toast('No positions match these tags', 'warn'); 
        return; 
    }
    const pick = AppState.allPositions[Math.floor(Math.random() * AppState.allPositions.length)];
    showDetail(pick.id);
}

// Legacy loadPositions function for backward compatibility
async function loadPositions() {
    let u = API + '/positions/';
    const tags = AppState.positionTagFilters || [];
    if (tags.length) {
        u += '?' + tags.map(t => 'tags=' + encodeURIComponent(t)).join('&');
    }
    AppState.allPositions = await ApiClient.get(u.replace(API, ''));
    renderPositionsList();
}

function renderPositionsList() {
    const route = Router.current();
    if (route.view === 'tactics') {
        renderCategoryList('tactics');
    } else {
        renderCategoryList('tabiya');
    }
}

function _setupPositionListEvents(container) {
    // Remove existing event listener to prevent duplicates
    container.removeEventListener('click', _handlePositionListClick);
    // Add event delegation for position list clicks
    container.addEventListener('click', _handlePositionListClick);
}

function _handlePositionListClick(event) {
    const target = event.target.closest('.pos-item-delete, .pos-item');
    if (!target) return;

    if (target.classList.contains('pos-item-delete')) {
        // Handle delete button click
        event.stopPropagation();
        const positionId = parseInt(target.dataset.deleteId, 10);
        if (positionId) deleteFromList(positionId);
    } else if (target.classList.contains('pos-item')) {
        // Handle position item click
        const positionId = parseInt(target.dataset.posId, 10);
        if (positionId) showDetail(positionId);
    }
}

window.loadCategoryPositions = loadCategoryPositions;
window.mountCategoryTagFilter = mountCategoryTagFilter;
window.renderCategoryList = renderCategoryList;
window.showDetail = showDetail;
window.deleteFromList = deleteFromList;
window.randomFromList = randomFromList;

// Keep legacy functions for backward compatibility
window.loadPositions = loadPositions;
window.renderPositionsList = renderPositionsList;