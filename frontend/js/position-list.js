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
        const selectedClass = isSelected ? ' pos-item--selected selected-panel' : '';
        const starHtml = StarControl.renderPositionStar(p);
        return `<div class="pos-item${featuredClass}${selectedClass}" data-pos-id="${p.id}">${renderMiniBoard(p.fen, p.orientation)}<div class="pos-item-body"><div class="title">${starHtml}${Html.escape(p.title || 'Untitled')}</div></div><button class="btn btn-sm btn-ghost pos-item-delete" data-delete-id="${p.id}" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>`;
    }).join('');
    
    // Set up event delegation for the position list
    _setupPositionListEvents(el);
    
    // Set up star control handlers
    StarControl.initPositionStarHandlers(el);
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

function _setupSelectionControls(categoryKey) {
    const selectToggle = document.getElementById('select-mode-toggle');
    const bulkActionBar = document.getElementById('bulk-action-bar');
    const selectionCount = document.getElementById('selection-count');
    const selectAllBtn = document.getElementById('select-all-btn');
    const bulkStarBtn = document.getElementById('bulk-star-btn');
    const bulkUnstarBtn = document.getElementById('bulk-unstar-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');

    if (!selectToggle || !bulkActionBar || !SelectionManager) return;

    // Update UI when selection state changes
    SelectionManager.onStateChange(function(state) {
        // Update select toggle button text
        selectToggle.textContent = state.active ? 'Done' : 'Select';
        
        // Show/hide bulk action bar - show immediately when entering select mode
        if (state.active) {
            bulkActionBar.style.display = '';
            selectionCount.textContent = state.selectedCount === 0 
                ? 'Select Mode — 0 selected' 
                : `${state.selectedCount} selected`;
        } else {
            bulkActionBar.style.display = 'none';
        }

        // Re-render list to update selection visual state
        renderCategoryList(categoryKey);
    });

    // Select mode toggle
    selectToggle.addEventListener('click', function() {
        SelectionManager.toggleActive();
    });

    // Select all visible positions
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            _selectAllVisiblePositions(categoryKey);
        });
    }

    // Bulk action buttons
    if (bulkStarBtn) {
        bulkStarBtn.addEventListener('click', function() {
            SelectionManager.bulkStar();
        });
    }

    if (bulkUnstarBtn) {
        bulkUnstarBtn.addEventListener('click', function() {
            SelectionManager.bulkUnstar();
        });
    }

    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', function() {
            SelectionManager.clear();
        });
    }
}

function _selectAllVisiblePositions(categoryKey) {
    const category = CATEGORIES[categoryKey];
    if (!category || !AppState.allPositions) return;
    
    // Get currently visible positions (after filters)
    let positions = AppState.allPositions.filter(p => p.position_type === category.positionType);
    
    // Apply starred filter if enabled
    if (AppState.starredFilter) {
        positions = positions.filter(p => p.starred);
    }
    
    // Extract IDs and select them all
    const visibleIds = positions.map(p => p.id);
    SelectionManager.selectAll(visibleIds);
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