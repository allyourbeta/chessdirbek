/**
 * Position-list multi-select & bulk actions. Owns the "select mode" toggle,
 * select-all, bulk star/unstar, and clear-selection wiring for the category
 * list, plus the listener bookkeeping that prevents handler accumulation across
 * re-renders. Extracted from position-list.js so that file stays a focused list
 * renderer. Classic script (page globals); `renderCategoryList` (position-list.js)
 * calls `_setupSelectionControls` after each render, and the bulk handlers call
 * back into `renderCategoryList` — both resolve at runtime, so load order between
 * the two files does not matter as long as both load before navigation.
 */
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
