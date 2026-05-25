function setupStaticActions() {
    // Set up click event delegation
    document.addEventListener('click', handleClick);
    
    // Set up change event delegation
    document.addEventListener('change', handleChange);
    
    // Mark as initialized to prevent double setup
    if (!document.body.dataset.actionsInitialized) {
        document.body.dataset.actionsInitialized = 'true';
    }
}

function handleClick(event) {
    const target = event.target;
    
    // Handle data-action attributes
    const action = target.dataset.action;
    if (action) {
        ActionHandlers.execute(action, target, event);
        return;
    }
    
    // Handle data-nav attributes
    const nav = target.dataset.nav;
    if (nav) {
        Router.navigate({view: nav});
        return;
    }
    
    // Handle data-nav-new attributes
    const navNew = target.dataset.navNew;
    if (navNew) {
        if (navNew === 'bulkAdd' || navNew === 'editor' || navNew === 'gameImport') {
            Router.navigate({view: navNew});
        } else {
            Router.navigate({view: 'addPosition', params: {type: navNew}});
        }
        closeNewMenu();
        return;
    }
    
    // Handle data-nav-cancel attributes
    const navCancel = target.dataset.navCancel;
    if (navCancel) {
        Navigation.cancelToFallback({view: navCancel});
        return;
    }
    
    // Handle data-save-board attributes
    const saveBoard = target.dataset.saveBoard;
    const positionType = target.dataset.positionType;
    if (saveBoard && positionType) {
        saveBoardPosition(saveBoard, positionType);
        return;
    }
    
    // Handle data-navigate-puzzle attributes
    const navigatePuzzle = target.dataset.navigatePuzzle;
    if (navigatePuzzle) {
        navigatePuzzle(navigatePuzzle);
        return;
    }
    
    // Handle data-practice-viewer attributes
    const practiceViewer = target.dataset.practiceViewer;
    if (practiceViewer) {
        PracticeViewerActions.execute(practiceViewer);
        return;
    }
    
    // Handle data-practice-save attributes
    const practiceSave = target.dataset.practiceSave;
    if (practiceSave) {
        if (practiceSave === 'default') {
            Practice.confirmSave();
        } else {
            Practice.confirmSave(practiceSave);
        }
        return;
    }
    
    // Handle data-confirm-delete attributes
    const confirmDelete = target.dataset.confirmDelete;
    if (confirmDelete) {
        event.stopPropagation();
        PracticeUI.confirmDelete(parseInt(confirmDelete));
        return;
    }
    
    // Handle data-cancel-delete attributes
    const cancelDelete = target.dataset.cancelDelete;
    if (cancelDelete) {
        event.stopPropagation();
        PracticeUI.cancelDelete(parseInt(cancelDelete));
        return;
    }
    
    // Handle data-undo-delete attributes
    const undoDelete = target.dataset.undoDelete;
    if (undoDelete) {
        event.stopPropagation();
        PracticeUI.undoDelete(parseInt(undoDelete));
        return;
    }
    
    // Handle dynamically generated content
    DynamicClickHandlers.handle(target, event);
}

function handleChange(event) {
    const target = event.target;
    const changeType = target.dataset.change;
    
    switch (changeType) {
        case 'result-filter':
            onResultFilterChange(target);
            break;
        case 'collection-filter':
            onCollectionFilterChange(target);
            break;
        case 'pgn-file':
            handlePgnFile(target);
            break;
        case 'practice-filters':
            Practice.applyFilters();
            break;
    }
}

// Maintain backward compatibility
window.setupStaticActions = setupStaticActions;