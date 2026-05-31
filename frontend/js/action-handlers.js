// Return from Play/Replay to the position's detail page if we know which
// position we came from, otherwise fall back to its category list. Uses the
// real Router/Navigation API (there is no Navigation.back()).
function _backToDetailOrCategory() {
    var id = window.AppState && AppState.currentDetailId;
    var type = (window.AppState && AppState.currentDetailType) || 'tabiya';
    if (id) {
        Router.navigate({ view: 'positionDetail', id: id, positionType: type });
    } else {
        var catKey = (window.TYPE_TO_CATEGORY && TYPE_TO_CATEGORY[type]) || 'tabiya';
        Router.navigate({ view: catKey });
    }
}

const ActionHandlers = {
    execute(action, target, event) {
        // Handle stopPropagation for certain actions
        const stopPropActions = ['copy-fen'];
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
            case 'analyze-featured-on-lichess':
                analyzeFeaturedOnLichess();
                break;
            case 'randomize-position-list':
                randomizePositionList();
                break;
            case 'save-position':
                savePosition();
                break;
            case 'load-fen':
                loadFen();
                break;
            case 'ocr-paste-image':
                OcrImport.pasteFromButton(target);
                break;
            case 'ocr-check-status':
                OcrImport.checkStatus();
                break;
            case 'ocr-download-models':
                OcrImport.downloadModels(target);
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
            case 'search-stop':
                stopPositionSearch();
                break;
            case 'search-reset':
                resetSearch();
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
            case 'flip-detail-fen':
                FenFlip.flipFromDetail();
                break;
            case 'random-from-detail':
                randomFromDetail();
                break;
            case 'copy-fen':
                copyFen();
                break;
            case 'copy-play-fen': {
                const _pf = document.getElementById('play-fen');
                if (_pf && window.FenActions) FenActions.copyFen(_pf.textContent);
                break;
            }
            case 'analyze-on-lichess':
                FenActions.analyzeOnLichess();
                break;
            case 'analyze-detail-on-lichess':
                analyzeDetailOnLichess();
                break;
            case 'engine-play-start':
                startEnginePlay();
                break;
            case 'engine-play-resign':
                if (window.PlayMode) {
                    PlayMode.resign();
                }
                break;
            case 'engine-play-end':
                if (window.PlayMode) {
                    PlayMode.endGame();
                }
                break;
            case 'engine-play-mark':
                if (window.PlayMode) {
                    PlayMode.markResult(target.dataset.result);
                }
                break;
            case 'engine-play-again':
                if (window.PlayMode) {
                    PlayMode.playAgain();
                }
                break;
            case 'engine-play-back-detail':
                _backToDetailOrCategory();
                break;
            case 'play-back':
                if (confirm('Leave this game?')) {
                    _backToDetailOrCategory();
                }
                break;
            case 'engine-game-open':
                openEngineGame(target.dataset.gameId);
                break;
            case 'engine-game-delete':
                deleteEngineGame(target.dataset.gameId);
                break;
            case 'replay-back':
                _backToDetailOrCategory();
                break;
            case 'start-title-edit':
                startTitleEdit();
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
            case 'bulk-add-run':
                BulkAdd.run();
                break;
            case 'bulk-add-cancel':
                Navigation.cancelToFallback({view: TYPE_TO_CATEGORY[BulkAdd.currentType()] || 'tabiya'});
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
            case 'cancel-add-position':
                Navigation.cancelToFallback({view: TYPE_TO_CATEGORY[AppState.addPositionType] || 'tabiya'});
                break;
        }
    }
};