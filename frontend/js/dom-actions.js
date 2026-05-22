function setupStaticActions() {
    const actions = {
        'save-pos-confirm-btn': function () { doSavePosition(); },
        'save-pos-cancel-btn': function () { hideSavePositionModal(); },
        'collection-save-btn': function () { saveCollection(); },
        'collection-cancel-btn': function () { hideCollectionModal(); },
    };
    Object.entries(actions).forEach(function ([id, handler]) {
        const el = document.getElementById(id);
        if (!el || el.dataset.boundAction) return;
        el.dataset.boundAction = '1';
        el.addEventListener('click', handler);
    });
}

window.setupStaticActions = setupStaticActions;
