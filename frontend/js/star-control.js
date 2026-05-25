const StarControl = {
    // Star icons
    STAR_SVG_FILLED: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#f4b400" stroke="#f4b400" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    STAR_SVG_EMPTY: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',

    // Render star icon based on state
    renderStarIcon(starred) {
        return starred ? this.STAR_SVG_FILLED : this.STAR_SVG_EMPTY;
    },

    // Render a position star control
    renderPositionStar(position) {
        return `<span class="pos-item-star" data-star-kind="position" data-position-id="${position.id}">${this.renderStarIcon(position.starred)}</span>`;
    },

    // Render a game star control
    renderGameStar(game) {
        return `<span class="game-star-toggle" data-star-kind="game" data-game-id="${game.id}">${this.renderStarIcon(game.starred)}</span>`;
    },

    // Render a starred-only filter star
    renderStarFilter(active) {
        return this.renderStarIcon(active);
    },

    // Initialize position star handlers for a container
    initPositionStarHandlers(container) {
        if (!container) return;
        
        // Remove existing listeners to prevent duplicates
        container.removeEventListener('click', this._handlePositionStarClick.bind(this));
        container.addEventListener('click', this._handlePositionStarClick.bind(this));
    },

    // Initialize star filter handler
    initStarFilterHandler(element, callback) {
        if (!element || !callback) return;
        
        element.removeEventListener('click', element._starFilterHandler);
        element._starFilterHandler = (event) => {
            event.preventDefault();
            event.stopPropagation();
            callback();
        };
        element.addEventListener('click', element._starFilterHandler);
    },

    // Update position star visual state
    updatePositionStarVisual(positionId, starred) {
        const stars = document.querySelectorAll(`[data-star-kind="position"][data-position-id="${positionId}"]`);
        stars.forEach(star => {
            // SAFE_INNER_HTML: Using renderStarIcon() SVG output
            star.innerHTML = this.renderStarIcon(starred);
        });
    },

    // Update star filter visual state  
    updateStarFilterVisual(element, active) {
        if (!element) return;
        // SAFE_INNER_HTML: Using renderStarFilter() SVG and safe string concatenation
        element.innerHTML = this.renderStarFilter(active);
        if (active) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
    },

    // Handle position star clicks
    async _handlePositionStarClick(event) {
        const starElement = event.target.closest('[data-star-kind="position"]');
        if (!starElement) return;

        event.preventDefault();
        event.stopPropagation();

        const positionId = parseInt(starElement.dataset.positionId, 10);
        if (!positionId) return;

        try {
            const data = await ApiClient.patch(`/positions/${positionId}/star`);
            
            // Update in-memory list
            if (AppState.allPositions) {
                const pos = AppState.allPositions.find(p => p.id === positionId);
                if (pos) pos.starred = data.starred;
            }

            // Update all visual instances of this position's star
            this.updatePositionStarVisual(positionId, data.starred);

            // Re-render list if starred filter is active to maintain filtering
            if (AppState.starredFilter && AppState.currentCategory) {
                renderCategoryList(AppState.currentCategory);
            }
        } catch (e) {
            toast('Failed to toggle star', 'error');
        }
    },

    // Handle game star clicks
    async _handleGameStarClick(event) {
        const starElement = event.target.closest('[data-star-kind="game"]');
        if (!starElement) return;

        event.preventDefault();
        event.stopPropagation();

        const gameId = parseInt(starElement.dataset.gameId, 10);
        if (!gameId) return;

        try {
            const data = await ApiClient.patch(`/games/${gameId}/star`);
            
            // Update in-memory list
            if (AppState.allGames) {
                const game = AppState.allGames.find(g => g.id === gameId);
                if (game) game.starred = data.starred;
            }

            // Update visual
            // SAFE_INNER_HTML: Using renderStarIcon() SVG output
            starElement.innerHTML = this.renderStarIcon(data.starred);

            // Re-render list if starred filter is active to maintain filtering
            if (AppState.gameStarredFilter) {
                renderGamesList();
            }
        } catch (e) {
            toast('Failed to toggle star', 'error');
        }
    },

    // Global star click handler for all star types
    handleGlobalStarClick(event) {
        const starElement = event.target.closest('[data-star-kind]');
        if (!starElement) return;

        const starKind = starElement.dataset.starKind;

        if (starKind === 'position') {
            this._handlePositionStarClick(event);
        }
        if (starKind === 'game') {
            this._handleGameStarClick(event);
        }
        // Filter stars are handled by their specific callbacks via initStarFilterHandler
    },

    // Initialize global star click delegation
    initGlobalHandlers() {
        // Remove existing global handler
        if (document._starControlGlobalHandler) {
            document.removeEventListener('click', document._starControlGlobalHandler);
        }
        
        // Add new global handler
        document._starControlGlobalHandler = this.handleGlobalStarClick.bind(this);
        document.addEventListener('click', document._starControlGlobalHandler);
    }
};

window.StarControl = StarControl;