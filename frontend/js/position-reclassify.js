/**
 * Reclassify a position from the detail view: move it between categories
 * (Tactics/Tabiya/Endings/Strategy). Backend already supports this via
 * PUT /positions/{id} with a new position_type.
 *
 * UX model = "file and return": apply the change, drop back to the SOURCE
 * category list (where the position now disappears), and show a toast that
 * confirms where it went with a one-click Undo. Split out of position-detail.js
 * to honor the 300-line file limit.
 *
 * Depends on globals: AppState, CATEGORIES, TYPE_TO_CATEGORY, ApiClient, Router,
 * toast (all loaded before this script).
 */

function _categoryLabelForType(type) {
    var catKey = (TYPE_TO_CATEGORY && TYPE_TO_CATEGORY[type]) || 'tabiya';
    return (CATEGORIES[catKey] && CATEGORIES[catKey].label) || 'Tabiya';
}

function toggleReclassifyMenu() {
    var menu = document.getElementById('reclassify-menu');
    if (!menu) return;
    var opening = (menu.style.display === 'none' || menu.style.display === '');
    // Hide the option matching the current type — you can't move to where you are.
    var cur = AppState.currentDetailType || 'tabiya';
    menu.querySelectorAll('[data-reclassify]').forEach(function (b) {
        b.style.display = (b.dataset.reclassify === cur) ? 'none' : '';
    });
    menu.style.display = opening ? 'block' : 'none';
}

function closeReclassifyMenu() {
    var menu = document.getElementById('reclassify-menu');
    if (menu) menu.style.display = 'none';
}

async function reclassifyFromDetail(newType) {
    closeReclassifyMenu();
    var id = AppState.currentDetailId;
    if (!id) return;
    var oldType = AppState.currentDetailType || 'tabiya';
    if (newType === oldType) return;

    // Snapshot the pre-change state so Undo can fully restore it (a tactic that
    // loses its solution on the way out gets it back on Undo).
    var undoPayload = AppState.currentDetailUndo || { position_type: oldType };

    var body = { position_type: newType };
    // Moving TO a tactic requires a solution move (backend enforces this too).
    if (newType === 'puzzle') {
        var sol = (window.prompt('Solution move (SAN, e.g. "Qxh7+") — required for a tactic:') || '').trim();
        if (!sol) { toast('Reclassify cancelled — a tactic needs a solution', 'warn'); return; }
        body.solution_san = sol;
    }

    try {
        await ApiClient.put('/positions/' + id, body);
    } catch (e) {
        toast('Reclassify failed', 'error');
        return;
    }

    var toLabel = _categoryLabelForType(newType);
    var sourceCat = (TYPE_TO_CATEGORY && TYPE_TO_CATEGORY[oldType]) || 'tabiya';
    // File and return: land back where you were triaging.
    Router.navigate({ view: sourceCat });
    _showReclassifyUndo(id, undoPayload, toLabel, sourceCat);
}

function _showReclassifyUndo(id, undoPayload, toLabel, sourceCat) {
    var el = document.createElement('div');
    el.className = 'toast';
    var msg = document.createElement('span');
    msg.textContent = '\u2713 Moved to ' + toLabel + '  \u00b7  ';
    var btn = document.createElement('button');
    btn.className = 'toast-undo';
    btn.textContent = 'Undo';
    el.appendChild(msg);
    el.appendChild(btn);
    document.body.appendChild(el);

    var done = false;
    var timer = setTimeout(function () { if (!done) el.remove(); }, 6000);
    btn.addEventListener('click', async function () {
        done = true;
        clearTimeout(timer);
        el.remove();
        try {
            await ApiClient.put('/positions/' + id, undoPayload);
            toast('Move undone');
            Router.navigate({ view: sourceCat });
        } catch (e) {
            toast('Undo failed', 'error');
        }
    });
}

// Close the menu on any outside click (mirrors the New-menu behavior).
document.addEventListener('click', function (e) {
    if (!e.target.closest('#reclassify-dropdown')) closeReclassifyMenu();
});

window.toggleReclassifyMenu = toggleReclassifyMenu;
window.closeReclassifyMenu = closeReclassifyMenu;
window.reclassifyFromDetail = reclassifyFromDetail;
