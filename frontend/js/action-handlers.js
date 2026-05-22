const ActionHandlers = {
    execute(action, target, event) {
        // Handle stopPropagation for certain actions
        const stopPropActions = ['toggle-featured-star', 'copy-fen', 'toggle-detail-star'];
        if (stopPropActions.includes(action)) {
            event.stopPropagation();
        }
        
        switch (action) {
            case 'toggle-new-menu':
                toggleNewMenu();
                break;
            case 'toggle-mute':
                toggleMute();
                break;
            case 'flip-category-featured-board':
                flipCategoryFeaturedBoard();
                break;
            case 'shuffle-category-featured':
                shuffleCategoryFeatured();
                break;
            case 'show-featured-detail':
                showDetail(AppState.featuredCategoryId);
                break;
            case 'fork-category-featured':
                forkCategoryFeatured();
                break;
            case 'toggle-featured-star':
                toggleFeaturedStar();
                break;
            case 'save-position':
                savePosition();
                break;
            case 'load-fen':
                loadFen();
                break;
            case 'set-start-pos':
                setStartPos();
                break;
            case 'flip-board':
                flipBoard();
                break;
            case 'open-editor-from-form':
                openEditorFromForm();
                break;
            case 'clear-form':
                clearForm();
                break;
            case 'delete-position':
                deletePosition();
                break;
            case 'toggle-select-all-games':
                toggleSelectAllGames(target.checked);
                break;
            case 'delete-selected-games':
                deleteSelectedGames();
                break;
            case 'batch-prev-game':
                batchPrevGame();
                break;
            case 'batch-next-game':
                batchNextGame();
                break;
            case 'exit-batch-mode':
                exitBatchMode();
                break;
            case 'gv-flip':
                gvFlip();
                break;
            case 'undo-game-board':
                undoGameBoard();
                break;
            case 'reset-game-board':
                resetGameBoard();
                break;
            case 'show-save-position-modal':
                showSavePositionModal();
                break;
            case 'toggle-opening-tree':
                toggleOpeningTree();
                break;
            case 'back-to-games':
                backToGames();
                break;
            case 'delete-current-game':
                deleteCurrentGame();
                break;
            case 'show-collection-modal':
                showCollectionModal();
                break;
            case 'search-flip-board':
                searchFlipBoard();
                break;
            case 'search-set-start':
                searchSetStart();
                break;
            case 'search-load-fen':
                searchLoadFen();
                break;
            case 'search-use-board':
                searchUseBoard();
                break;
            case 'open-board-editor-from-search':
                BoardEditor.openFromSearch();
                break;
            case 'do-position-search':
                doPositionSearch();
                break;
            case 'clear-import-file':
                clearImportFile();
                break;
            case 'do-import':
                doImport();
                break;
            case 'cancel-import':
                cancelImport();
                break;
            case 'flip-detail-board':
                flipDetailBoard();
                break;
            case 'random-from-detail':
                randomFromDetail();
                break;
            case 'copy-fen':
                copyFen();
                break;
            case 'start-title-edit':
                startTitleEdit();
                break;
            case 'toggle-detail-star':
                toggleDetailStar();
                break;
            case 'edit-position':
                editPosition();
                break;
            case 'delete-from-detail':
                deleteFromDetail();
                break;
            case 'detail-back':
                Navigation.cancelToFallback({view: TYPE_TO_CATEGORY[AppState.currentDetailType] || 'tabiya'});
                break;
            case 'practice-start-from-detail':
                Practice.startFromDetail();
                break;
            case 'practice-clear-filters':
                Practice.clearFilters();
                break;
            case 'practice-show-more':
                Practice.showMore();
                break;
            case 'bulk-add-run':
                BulkAdd.run();
                break;
            case 'bulk-add-cancel':
                Navigation.cancelToFallback({view: TYPE_TO_CATEGORY[BulkAdd.currentType()] || 'tabiya'});
                break;
            case 'practice-discard':
                Practice.discard();
                break;
            // Modal actions
            case 'save-pos-confirm':
                doSavePosition();
                break;
            case 'save-pos-cancel':
                hideSavePositionModal();
                break;
            case 'collection-save':
                saveCollection();
                break;
            case 'collection-cancel':
                hideCollectionModal();
                break;
            case 'hide-notification':
                hideProminentNotification();
                break;
        }
    }
};