const DynamicClickHandlers = {
    handle(target, event) {
        // Handle move cells in game viewer and practice viewer
        if (target.classList.contains('move-cell')) {
            const ply = parseInt(target.dataset.ply);
            if (target.closest('#gv-moves')) {
                goToPly(ply);
            } else if (target.closest('#pv-moves')) {
                PracticeViewer.goTo(ply);
            }
            return;
        }
        
        // Handle game rows
        if (target.tagName === 'TR' && target.closest('#games-list')) {
            const gameId = parseInt(target.dataset.gameId);
            if (gameId) {
                openGame(gameId);
            }
            return;
        }
        
        // Handle game select checkboxes
        if (target.classList.contains('game-select')) {
            const gameId = parseInt(target.dataset.id);
            toggleGameSelect(gameId, target.checked);
            event.stopPropagation();
            return;
        }
        
        // Handle pagination buttons
        if (target.classList.contains('games-prev-btn')) {
            gamesPrevPage();
            return;
        }
        if (target.classList.contains('games-next-btn')) {
            gamesNextPage();
            return;
        }
        
        // Handle opening tree rows
        if (target.classList.contains('tree-row')) {
            const fen = target.dataset.fen;
            if (fen) {
                onTreeMoveClick(fen);
            }
            return;
        }
        
        // Handle search/editor palette buttons. Use closest() so clicks on the piece image
        // are handled the same as clicks on the button shell.
        const searchPaletteBtn = target.closest('[data-search-tool]');
        if (searchPaletteBtn) {
            const tool = searchPaletteBtn.dataset.searchTool;
            if (tool && window.searchSelectTool) {
                searchSelectTool(tool);
            }
            return;
        }

        const editorPaletteBtn = target.closest('[data-tool]');
        if (editorPaletteBtn && editorPaletteBtn.classList.contains('palette-btn')) {
            const tool = editorPaletteBtn.dataset.tool;
            if (tool) {
                BoardEditor.selectTool(tool);
            }
            return;
        }
        
        // Handle practice UI elements
        if (target.closest('.pos-item')) {
            this.handlePosItemClick(target, event);
            return;
        }
        
        // Handle prominent notification dismiss
        if (target.closest('#notification-banner') && target.tagName === 'BUTTON') {
            hideProminentNotification();
            return;
        }
    },

    handlePosItemClick(target, event) {
        const posItem = target.closest('.pos-item');
        
        // Handle practice viewer open
        if (target.id && target.id.startsWith('verdict-display-')) {
            const gameId = parseInt(target.id.replace('verdict-display-', ''));
            const userColor = target.dataset.userColor || '';
            PracticeUI.showInlineVerdictEdit(gameId, userColor);
            event.stopPropagation();
            return;
        }
        
        // Handle delete buttons
        if (target.id && target.id.startsWith('delete-btn-')) {
            const gameId = parseInt(target.id.replace('delete-btn-', ''));
            PracticeUI.showInlineDelete(gameId);
            event.stopPropagation();
            return;
        }
        
        // Handle position navigation
        const positionId = posItem.dataset.positionId;
        const gameId = posItem.dataset.gameId;
        const halfMove = posItem.dataset.halfMove;
        const practiceGameId = posItem.dataset.practiceGameId;
        
        if (positionId) {
            Router.navigate({view: 'positionDetail', id: positionId});
        } else if (gameId && halfMove) {
            openSearchResult(parseInt(gameId), parseInt(halfMove));
        } else if (practiceGameId) {
            PracticeViewer.open(parseInt(practiceGameId));
        }
    }
};