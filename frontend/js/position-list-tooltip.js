/**
 * Reliable "date added" tooltip for position cards.
 *
 * The native `title` tooltip was the wrong tool: the OS throttles it (~1s delay)
 * and it doesn't fire consistently over the board thumbnail. This custom tip is
 * instant and is appended to <body> with position:fixed, so the card's
 * overflow:hidden can't clip it. The date string lives on `data-added`.
 *
 * Wired by position-list.js (_setupPositionListEvents) via mouseover/mouseout on
 * the list container. Debug-only info, so it's intentionally muted and small.
 */

let _posTip = null;
let _tipItem = null;

function _showPosTip(item) {
    const added = item.dataset.added;
    if (!added) return;
    _hidePosTip();
    _posTip = document.createElement('div');
    _posTip.className = 'pos-tip';
    _posTip.textContent = added;
    document.body.appendChild(_posTip);
    const r = item.getBoundingClientRect();
    const th = _posTip.offsetHeight;
    let top = r.bottom + 4;
    if (top + th > window.innerHeight - 8) top = r.top - th - 4; // flip above if no room
    _posTip.style.left = Math.round(r.left) + 'px';
    _posTip.style.top = Math.round(top) + 'px';
}

function _hidePosTip() {
    if (_posTip) { _posTip.remove(); _posTip = null; }
}

function _onListMouseOver(event) {
    const item = event.target.closest('.pos-item');
    if (!item || item === _tipItem) return;
    _tipItem = item;
    _showPosTip(item);
}

function _onListMouseOut(event) {
    const to = event.relatedTarget;
    if (_tipItem && (!to || !_tipItem.contains(to))) {
        _hidePosTip();
        _tipItem = null;
    }
}

window._onListMouseOver = _onListMouseOver;
window._onListMouseOut = _onListMouseOut;
window._hidePosTip = _hidePosTip;

// Format created_at for display. The server sends naive UTC (no tz marker), so we
// mark it UTC before converting — otherwise the browser reads UTC wall-clock as
// local and the time lands hours in the future.
function _formatAddedLocal(iso) {
    if (!iso) return '';
    var hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
    var d = new Date(hasTz ? iso : iso + 'Z');
    return isNaN(d.getTime()) ? '' : 'Added ' + d.toLocaleString();
}
window._formatAddedLocal = _formatAddedLocal;
