const SelectionManager = {
    // Private state
    _active: false,
    _selectedIds: new Set(),
    _onStateChangeCallback: null,

    // Check if select mode is active
    isActive() {
        return this._active;
    },

    // Enter select mode
    enter() {
        this._active = true;
        this._addSelectModeClass();
        this._notifyStateChange();
    },

    // Exit select mode
    exit() {
        this._active = false;
        this._removeSelectModeClass();
        this.clear();
        this._notifyStateChange();
    },

    // Set select mode active/inactive (legacy compatibility)
    setActive(active) {
        if (active) {
            this.enter();
        } else {
            this.exit();
        }
    },

    // Toggle selection mode
    toggleActive() {
        if (this._active) {
            this.exit();
        } else {
            this.enter();
        }
    },

    // Check if a position is selected
    isSelected(positionId) {
        return this._selectedIds.has(positionId);
    },

    // Toggle selection for a position
    togglePosition(positionId) {
        if (this._selectedIds.has(positionId)) {
            this._selectedIds.delete(positionId);
        } else {
            this._selectedIds.add(positionId);
        }
        this._notifyStateChange();
    },

    // Select all provided position IDs
    selectAll(positionIds) {
        this._selectedIds.clear();
        positionIds.forEach(id => this._selectedIds.add(id));
        this._notifyStateChange();
    },

    // Clear all selections
    clear() {
        this._selectedIds.clear();
        this._notifyStateChange();
    },

    // Get array of selected position IDs
    getSelectedIds() {
        return Array.from(this._selectedIds);
    },

    // Get count of selected positions
    getSelectedCount() {
        return this._selectedIds.size;
    },

    // Set callback for when selection state changes
    onStateChange(callback) {
        this._onStateChangeCallback = callback;
    },

    // Clear the state change callback
    clearStateChangeCallback() {
        this._onStateChangeCallback = null;
    },

    // Private method to notify of state changes
    _notifyStateChange() {
        if (this._onStateChangeCallback) {
            this._onStateChangeCallback({
                active: this._active,
                selectedIds: this.getSelectedIds(),
                selectedCount: this.getSelectedCount()
            });
        }
    },

    // Bulk star selected positions.
    // IMPORTANT: the backend /star endpoint toggles, so this method must
    // only call it for currently-unstarred positions. The desired end state is
    // "all selected positions are starred", not "toggle all selected positions".
    async bulkStar() {
        const selectedIds = this.getSelectedIds();
        if (selectedIds.length === 0) {
            toast('No positions selected', 'warn');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const positionId of selectedIds) {
            try {
                const position = AppState.allPositions?.find(p => p.id === positionId);

                // Already starred counts as success because the requested final
                // state is satisfied. Do NOT call the toggle endpoint.
                if (position && position.starred) {
                    successCount++;
                    continue;
                }

                const data = await ApiClient.patch(`/positions/${positionId}/star`);

                // Update in-memory list. Force the intended end state if the
                // response is missing/unexpected, but normally use API truth.
                const newStarred = data && typeof data.starred === 'boolean' ? data.starred : true;
                if (AppState.allPositions) {
                    const pos = AppState.allPositions.find(p => p.id === positionId);
                    if (pos) pos.starred = newStarred;
                }

                if (window.StarControl) {
                    StarControl.updatePositionStarVisual(positionId, newStarred);
                }

                successCount++;
            } catch (e) {
                console.error('Failed to star position', positionId, e);
                errorCount++;
            }
        }

        if (errorCount > 0) {
            toast(`Starred ${successCount} positions, ${errorCount} failed`, 'warn');
        } else {
            toast(`Starred ${successCount} positions`, 'success');
        }

        this._finishBulkAction();
    },

    // Bulk unstar selected positions.
    // IMPORTANT: the backend /star endpoint toggles, so this method must
    // only call it for currently-starred positions. The desired end state is
    // "all selected positions are unstarred", not "toggle all selected positions".
    async bulkUnstar() {
        const selectedIds = this.getSelectedIds();
        if (selectedIds.length === 0) {
            toast('No positions selected', 'warn');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const positionId of selectedIds) {
            try {
                const position = AppState.allPositions?.find(p => p.id === positionId);

                // Already unstarred counts as success because the requested final
                // state is satisfied. Do NOT call the toggle endpoint.
                if (position && !position.starred) {
                    successCount++;
                    continue;
                }

                const data = await ApiClient.patch(`/positions/${positionId}/star`);

                const newStarred = data && typeof data.starred === 'boolean' ? data.starred : false;
                if (AppState.allPositions) {
                    const pos = AppState.allPositions.find(p => p.id === positionId);
                    if (pos) pos.starred = newStarred;
                }

                if (window.StarControl) {
                    StarControl.updatePositionStarVisual(positionId, newStarred);
                }

                successCount++;
            } catch (e) {
                console.error('Failed to unstar position', positionId, e);
                errorCount++;
            }
        }

        if (errorCount > 0) {
            toast(`Unstarred ${successCount} positions, ${errorCount} failed`, 'warn');
        } else {
            toast(`Unstarred ${successCount} positions`, 'success');
        }

        this._finishBulkAction();
    },

    // After any bulk action, return to neutral browsing mode. This keeps the
    // workflow simple: Select → choose cards → Star/Unstar → back to normal.
    _finishBulkAction() {
        this.setActive(false);

        if (AppState.currentCategory) {
            renderCategoryList(AppState.currentCategory);
        }
    },

    // Add select mode visual class to the main container
    _addSelectModeClass() {
        // Apply to all position type views
        const container = document.getElementById('view-category');
        if (container) {
            container.classList.add('select-mode-active');
        }
        // Also add a body class for global styling
        document.body.classList.add('select-mode-active-global');
    },

    // Remove select mode visual class from the main container
    _removeSelectModeClass() {
        const container = document.getElementById('view-category');
        if (container) {
            container.classList.remove('select-mode-active');
        }
        // Remove body class
        document.body.classList.remove('select-mode-active-global');
    }
};

window.SelectionManager = SelectionManager;