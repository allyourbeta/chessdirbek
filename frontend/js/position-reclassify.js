/**
 * Reclassify a position between categories (Tactics/Tabiya/Endings/Strategy),
 * from either the detail view (dropdown) or the category list (per-card Move
 * button). Backend supports it via PUT /positions/{id} with a new position_type.
 *
 * UX = "file and return": apply the change, refresh the list / return to the
 * source, and show a toast with a one-click Undo. Split out of position-detail.js
 * and position-list.js to honor the 300-line file limit.
 *
 * Depends on globals: AppState, CATEGORIES, TYPE_TO_CATEGORY, ApiClient, Router,
 * loadCategoryPositions, toast.
 */

function _categoryLabelForType(type) {
    var catKey = (TYPE_TO_CATEGORY && TYPE_TO_CATEGORY[type]) || 'tabiya';
    return (CATEGORIES[catKey] && CATEGORIES[catKey].label) || 'Tabiya';
}

// [position_type, label] pairs for every category, derived from the central
// CATEGORIES map (no duplicated label strings).
function _reclassifyTargets() {
    return Object.keys(TYPE_TO_CATEGORY).map(function (type) {
        return [type, _categoryLabelForType(type)];
    });
}

// Moving TO a tactic needs a solution move. Returns the body to PUT, or null if
// the user cancelled the solution prompt.
function _reclassifyBody(newType) {
    var body = { position_type: newType };
    if (newType === 'puzzle') {
        var sol = (window.prompt('Solution move (SAN, e.g. "Qxh7+") \u2014 required for a tactic:') || '').trim();
        if (!sol) { toast('Move cancelled \u2014 a tactic needs a solution', 'warn'); return null; }
        body.solution_san = sol;
    }
    return body;
}

// Toast confirming the move, with an Undo that runs the supplied callback.
function _showReclassifyUndo(toLabel, onUndo) {
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
        try { await onUndo(); toast('Move undone'); }
        catch (e) { toast('Undo failed', 'error'); }
    });
}

/* ---- From the detail view: removed. Reclassify is now list-only (per-card
   Move button). Shared helpers above are reused by the list path below. ---- */

/* ---- From the category list (per-card Move button) ---- */

var _listMoveMenu = null;

function closeListMoveMenu() {
    if (_listMoveMenu) { _listMoveMenu.remove(); _listMoveMenu = null; }
}

function openListMoveMenu(button, id) {
    closeListMoveMenu();
    var item = (AppState.allPositions || []).find(function (p) { return p.id === id; });
    var currentType = item ? item.position_type : null;

    var menu = document.createElement('div');
    menu.className = 'nav-dropdown-menu list-move-menu';
    menu.style.position = 'fixed';
    menu.style.right = 'auto';
    menu.style.minWidth = '150px';
    _reclassifyTargets().forEach(function (t) {
        if (t[0] === currentType) return;
        var b = document.createElement('button');
        b.textContent = t[1];
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            closeListMoveMenu();
            reclassifyFromList(id, t[0]);
        });
        menu.appendChild(b);
    });
    document.body.appendChild(menu);
    _listMoveMenu = menu;

    // Anchor below the button, clamped to the viewport.
    var r = button.getBoundingClientRect();
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    var left = Math.min(r.left, window.innerWidth - 8 - mw);
    var top = r.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = r.top - 4 - mh;
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';
}

async function reclassifyFromList(id, newType) {
    var item = (AppState.allPositions || []).find(function (p) { return p.id === id; });
    if (!item) return;
    var oldType = item.position_type;
    if (newType === oldType) return;

    var undoPayload = { position_type: oldType, solution_san: item.solution_san, theme: item.theme };
    var body = _reclassifyBody(newType);
    if (!body) return;

    try { await ApiClient.put('/positions/' + id, body); }
    catch (e) { toast('Move failed', 'error'); return; }

    if (AppState.currentCategory) await loadCategoryPositions(AppState.currentCategory);
    _showReclassifyUndo(_categoryLabelForType(newType), async function () {
        await ApiClient.put('/positions/' + id, undoPayload);
        if (AppState.currentCategory) await loadCategoryPositions(AppState.currentCategory);
    });
}

document.addEventListener('click', function (e) {
    if (_listMoveMenu && !e.target.closest('.list-move-menu') && !e.target.closest('.pos-item-move')) {
        closeListMoveMenu();
    }
});
window.addEventListener('scroll', closeListMoveMenu, true);

window.openListMoveMenu = openListMoveMenu;
window.closeListMoveMenu = closeListMoveMenu;
window.reclassifyFromList = reclassifyFromList;
