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
        const selectedClass = isSelected ? ' pos-item--selected' : '';
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

// Track current event handlers to avoid accumulation
let _currentSelectionHandlers = {
    selectToggle: null,
    selectAllBtn: null,
    bulkStarBtn: null,
    bulkUnstarBtn: null,
    clearSelectionBtn: null
};

function _setupSelectionControls(categoryKey) {
    const selectToggle = document.getElementById('select-mode-toggle');
    const bulkActionBar = document.getElementById('bulk-action-bar');
    const selectionCount = document.getElementById('selection-count');
    const selectAllBtn = document.getElementById('select-all-btn');
    const bulkStarBtn = document.getElementById('bulk-star-btn');
    const bulkUnstarBtn = document.getElementById('bulk-unstar-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');

    if (!selectToggle || !bulkActionBar || !SelectionManager) return;

    // Clean up previous event listeners to prevent accumulation
    _cleanupSelectionHandlers();

    // Clear previous state change callback to prevent stale references
    SelectionManager.clearStateChangeCallback();

    // Exit selection mode when switching categories to avoid confusion
    if (SelectionManager.isActive()) {
        SelectionManager.exit();
    }

    // Create new handlers for this category
    const selectToggleHandler = function() {
        SelectionManager.toggleActive();
    };

    const selectAllHandler = function() {
        _toggleAllVisiblePositions(categoryKey);
    };

    const bulkStarHandler = function() {
        SelectionManager.bulkStar();
    };

    const bulkUnstarHandler = function() {
        SelectionManager.bulkUnstar();
    };

    const clearSelectionHandler = function() {
        SelectionManager.clear();
    };

    // Store handlers for cleanup
    _currentSelectionHandlers.selectToggle = selectToggleHandler;
    _currentSelectionHandlers.selectAllBtn = selectAllHandler;
    _currentSelectionHandlers.bulkStarBtn = bulkStarHandler;
    _currentSelectionHandlers.bulkUnstarBtn = bulkUnstarHandler;
    _currentSelectionHandlers.clearSelectionBtn = clearSelectionHandler;

    // Attach event listeners
    selectToggle.addEventListener('click', selectToggleHandler);
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllHandler);
    }
    
    if (bulkStarBtn) {
        bulkStarBtn.addEventListener('click', bulkStarHandler);
    }

    if (bulkUnstarBtn) {
        bulkUnstarBtn.addEventListener('click', bulkUnstarHandler);
    }

    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearSelectionHandler);
    }

    // Update UI when selection state changes
    SelectionManager.onStateChange(function(state) {
        // Update select toggle button text
        selectToggle.textContent = state.active ? 'Done' : 'Select';
        
        // Hide star filter when in select mode (it's confusing)
        const starToggle = document.getElementById('starred-filter-toggle');
        if (starToggle) {
            starToggle.style.display = state.active ? 'none' : '';
        }
        
        // Show/hide bulk action bar - show immediately when entering select mode
        if (state.active) {
            bulkActionBar.style.display = '';
            selectionCount.textContent = state.selectedCount === 0 
                ? 'Select positions' 
                : `${state.selectedCount} selected`;
                
            // Update "All" button text based on current selection
            if (selectAllBtn) {
                const category = CATEGORIES[categoryKey];
                if (category) {
                    let visiblePositions = AppState.allPositions.filter(p => p.position_type === category.positionType);
                    if (AppState.starredFilter) {
                        visiblePositions = visiblePositions.filter(p => p.starred);
                    }
                    const visibleIds = visiblePositions.map(p => p.id);
                    const allSelected = visibleIds.length > 0 && 
                                       visibleIds.every(id => state.selectedIds.includes(id));
                    selectAllBtn.textContent = allSelected ? 'None' : 'All';
                }
            }
        } else {
            bulkActionBar.style.display = 'none';
        }

        // Re-render list to update selection visual state
        renderCategoryList(categoryKey);
    });
}

function _cleanupSelectionHandlers() {
    const selectToggle = document.getElementById('select-mode-toggle');
    const selectAllBtn = document.getElementById('select-all-btn');
    const bulkStarBtn = document.getElementById('bulk-star-btn');
    const bulkUnstarBtn = document.getElementById('bulk-unstar-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');

    // Remove previous event listeners if they exist
    if (_currentSelectionHandlers.selectToggle && selectToggle) {
        selectToggle.removeEventListener('click', _currentSelectionHandlers.selectToggle);
    }
    if (_currentSelectionHandlers.selectAllBtn && selectAllBtn) {
        selectAllBtn.removeEventListener('click', _currentSelectionHandlers.selectAllBtn);
    }
    if (_currentSelectionHandlers.bulkStarBtn && bulkStarBtn) {
        bulkStarBtn.removeEventListener('click', _currentSelectionHandlers.bulkStarBtn);
    }
    if (_currentSelectionHandlers.bulkUnstarBtn && bulkUnstarBtn) {
        bulkUnstarBtn.removeEventListener('click', _currentSelectionHandlers.bulkUnstarBtn);
    }
    if (_currentSelectionHandlers.clearSelectionBtn && clearSelectionBtn) {
        clearSelectionBtn.removeEventListener('click', _currentSelectionHandlers.clearSelectionBtn);
    }

    // Clear stored handlers
    _currentSelectionHandlers = {
        selectToggle: null,
        selectAllBtn: null,
        bulkStarBtn: null,
        bulkUnstarBtn: null,
        clearSelectionBtn: null
    };
}

function _toggleAllVisiblePositions(categoryKey) {
    const category = CATEGORIES[categoryKey];
    if (!category || !AppState.allPositions) return;
    
    // Get currently visible positions (after filters)
    let positions = AppState.allPositions.filter(p => p.position_type === category.positionType);
    
    // Apply starred filter if enabled
    if (AppState.starredFilter) {
        positions = positions.filter(p => p.starred);
    }
    
    // Extract IDs 
    const visibleIds = positions.map(p => p.id);
    const currentSelected = SelectionManager.getSelectedIds();
    
    // Check if all visible are selected
    const allSelected = visibleIds.length > 0 && 
                       visibleIds.every(id => currentSelected.includes(id));
    
    if (allSelected) {
        // If all are selected, deselect all visible ones
        visibleIds.forEach(id => {
            if (SelectionManager.isSelected(id)) {
                SelectionManager.togglePosition(id);
            }
        });
    } else {
        // Otherwise, select all visible ones
        visibleIds.forEach(id => {
            if (!SelectionManager.isSelected(id)) {
                SelectionManager.togglePosition(id);
            }
        });
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