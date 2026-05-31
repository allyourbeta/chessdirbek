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
    if (AppState.positionSort && AppState.positionSort !== 'newest') {
        u += '&sort=' + AppState.positionSort;
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

    // Mount starred filter toggle button
    const starToggle = document.getElementById('starred-filter-toggle');
    if (starToggle) {
        function updateStarToggle() {
            const isActive = AppState.starredFilter || false;
            StarControl.updateStarFilterVisual(starToggle, isActive);
        }
        updateStarToggle();
        
        StarControl.initStarFilterHandler(starToggle, function() {
            AppState.starredFilter = !AppState.starredFilter;
            updateStarToggle();
            renderCategoryList(categoryKey);
        });
    }

    // Mount sort dropdown
    const sortSelect = document.getElementById('position-sort');
    if (sortSelect) {
        sortSelect.value = AppState.positionSort || 'newest';
        sortSelect.addEventListener('change', function() {
            AppState.positionSort = this.value;
            loadCategoryPositions(categoryKey);
        });
    }

    // Mount selection controls
    _setupSelectionControls(categoryKey);
}

function renderCategoryList(categoryKey) {
    const category = CATEGORIES[categoryKey];
    if (!category) {
        console.error('Unknown category:', categoryKey);
        return;
    }
    
    const el = document.getElementById('cat-list');
    if (!el) return;
    
    let positions = AppState.allPositions.filter(p => p.position_type === category.positionType);
    
    // Apply starred filter if enabled
    if (AppState.starredFilter) {
        positions = positions.filter(p => p.starred);
    }
    
    const countEl = document.getElementById('cat-count');
    if (countEl) {
        const tags = AppState.positionTagFilters || [];
        const starFilter = AppState.starredFilter ? ' (starred only)' : '';
        countEl.textContent = tags.length || AppState.starredFilter
            ? 'Showing ' + positions.length + ' positions' + starFilter
            : positions.length + ' positions';
    }
    
    if (!positions.length) {
        const emptySingular = category.label.toLowerCase().slice(0, -1); // Remove 's' from plural
        // SAFE_INNER_HTML: Template with escaped content via EmptyStates.render()
        el.innerHTML = EmptyStates.render(`No ${emptySingular} positions yet`, `Click "Add New" to save your first ${emptySingular} position.`);
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
        const isSelected = SelectionManager && SelectionManager.isSelected(p.id);
        const selectedClass = isSelected ? ' pos-item--selected' : '';
        const starHtml = StarControl.renderPositionStar(p);
        // Date is intentionally not shown inline — it lives in a hover tooltip,
        // used only to confirm a position actually saved and the list order is right.
        const addedTitle = p.created_at ? 'Added ' + new Date(p.created_at).toLocaleString() : '';
        return `<div class="pos-item${featuredClass}${selectedClass}" data-pos-id="${p.id}" title="${Html.escape(addedTitle)}">${renderMiniBoard(p.fen, p.orientation)}<div class="pos-item-body"><div class="title">${starHtml}${Html.escape(p.title || 'Untitled')}</div></div><button class="btn btn-sm btn-ghost pos-item-flip" data-flip-id="${p.id}" title="Flip FEN — rotate the position 180° to fix a board captured from the wrong side"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg></button><button class="btn btn-sm btn-ghost pos-item-delete" data-delete-id="${p.id}" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>`;
    }).join('');
    
    // Set up event delegation for the position list
    _setupPositionListEvents(el);
    
    // Set up star control handlers
    StarControl.initPositionStarHandlers(el);
    
    // Initialize keyboard navigation
    setTimeout(() => {
        if (window.KeyboardNavigation) {
            KeyboardNavigation.initGrid('cat-list', '.pos-item');
        }
    }, 50);
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
    const target = event.target.closest('.pos-item-delete, .pos-item-flip, .pos-item');
    if (!target) return;

    if (target.classList.contains('pos-item-delete')) {
        // Handle delete button click
        event.stopPropagation();
        const positionId = parseInt(target.dataset.deleteId, 10);
        if (positionId) deleteFromList(positionId);
    } else if (target.classList.contains('pos-item-flip')) {
        // Handle flip-FEN button click (must not also open the position)
        event.stopPropagation();
        const positionId = parseInt(target.dataset.flipId, 10);
        if (positionId) FenFlip.flipFromList(positionId);
    } else if (target.classList.contains('pos-item')) {
        // Handle position item click
        const positionId = parseInt(target.dataset.posId, 10);
        if (!positionId) return;
        
        if (SelectionManager && SelectionManager.isActive()) {
            // In select mode, toggle selection
            SelectionManager.togglePosition(positionId);
        } else {
            // In normal mode, open position
            showDetail(positionId);
        }
    }
}

// Re-order the currently-loaded list into a new random order, in place.
// Uses a Fisher–Yates shuffle: walk from the last index down to the first, and
// at each position i swap with a randomly chosen earlier-or-equal index j. That
// produces an unbiased permutation in a single pass. Math.random() reseeds every
// call, so each click yields a different order (and a different set on top). This
// is purely client-side on the already-fetched array — no server round-trip — and
// works as a button because a <select> won't re-fire when its value is unchanged.
function randomizePositionList() {
    const arr = AppState.allPositions;
    if (!arr || arr.length < 2) return;
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    if (AppState.currentCategory) renderCategoryList(AppState.currentCategory);
}

window.loadCategoryPositions = loadCategoryPositions;
window.mountCategoryTagFilter = mountCategoryTagFilter;
window.renderCategoryList = renderCategoryList;
window.showDetail = showDetail;
window.deleteFromList = deleteFromList;
window.randomFromList = randomFromList;
window.randomizePositionList = randomizePositionList;

// Keep legacy functions for backward compatibility
window.loadPositions = loadPositions;
window.renderPositionsList = renderPositionsList;