var MoveNavigator = (function () {
    var _instances = {};
    var _keyHandlers = {};

    function create(id, opts) {
        // Recreating a navigator with the same id must first remove any old
        // keydown listener. Otherwise one ArrowLeft/ArrowRight press can fire
        // multiple stale handlers after opening/changing positions.
        destroy(id);
        var inst = {
            id: id,
            fens: opts.fens || [],
            idx: opts.startIndex || 0,
            onNavigate: opts.onNavigate || null,
            boardId: opts.boardId || null,
            containerId: opts.containerId || null,
            keyScope: opts.keyScope || null,
        };
        _instances[id] = inst;
        _render(inst);
        if (inst.keyScope) _bindKeys(inst);
        return inst;
    }

    function destroy(id) {
        if (_keyHandlers[id]) {
            document.removeEventListener('keydown', _keyHandlers[id], true);
            delete _keyHandlers[id];
        }
        delete _instances[id];
    }

    function push(id, fen) {
        var inst = _instances[id];
        if (!inst) return;
        if (inst.idx < inst.fens.length - 1) {
            inst.fens = inst.fens.slice(0, inst.idx + 1);
        }
        inst.fens.push(fen);
        inst.idx = inst.fens.length - 1;
        _render(inst);
    }

    function goTo(id, idx) {
        var inst = _instances[id];
        if (!inst) return;
        idx = Math.max(0, Math.min(idx, inst.fens.length - 1));
        if (idx === inst.idx) return;
        inst.idx = idx;
        _apply(inst);
        _render(inst);
    }

    function first(id) { goTo(id, 0); }
    function prev(id) { var i = _instances[id]; if (i) goTo(id, i.idx - 1); }
    function next(id) { var i = _instances[id]; if (i) goTo(id, i.idx + 1); }
    function last(id) { var i = _instances[id]; if (i) goTo(id, i.fens.length - 1); }

    function getIndex(id) { var i = _instances[id]; return i ? i.idx : 0; }
    function getLength(id) { var i = _instances[id]; return i ? i.fens.length : 0; }
    function getFen(id) { var i = _instances[id]; return i ? i.fens[i.idx] : null; }

    function setFens(id, fens, idx) {
        var inst = _instances[id];
        if (!inst) return;
        inst.fens = fens;
        inst.idx = idx || 0;
        _render(inst);
    }

    function _apply(inst) {
        var fen = inst.fens[inst.idx];
        if (inst.boardId) {
            BoardManager.setPosition(inst.boardId, fen);
            // Don't reset analysis origin when navigating - that clears the board's move history
        }
        if (inst.onNavigate) inst.onNavigate(fen, inst.idx);
    }

    function _render(inst) {
        var el = inst.containerId ? document.getElementById(inst.containerId) : null;
        if (!el) return;
        var len = inst.fens.length;
        var atFirst = inst.idx <= 0;
        var atLast = inst.idx >= len - 1;
        // SAFE_INNER_HTML: Static template with controlled numeric values (indices and lengths)
        el.innerHTML =
            '<button class="btn btn-sm"' + (atFirst ? ' disabled' : '') + ' data-nav="first">|&lt;</button>' +
            '<button class="btn btn-sm"' + (atFirst ? ' disabled' : '') + ' data-nav="prev">&lt;</button>' +
            '<span class="text-muted" style="font-size:12px;min-width:48px;text-align:center">' +
                (len > 1 ? (inst.idx + 1) + '/' + len : '') + '</span>' +
            '<button class="btn btn-sm"' + (atLast ? ' disabled' : '') + ' data-nav="next">&gt;</button>' +
            '<button class="btn btn-sm"' + (atLast ? ' disabled' : '') + ' data-nav="last">&gt;|</button>';
        el.onclick = function (e) {
            var btn = e.target.closest('[data-nav]');
            if (!btn || btn.disabled) return;
            var a = btn.dataset.nav;
            if (a === 'first') first(inst.id);
            else if (a === 'prev') prev(inst.id);
            else if (a === 'next') next(inst.id);
            else if (a === 'last') last(inst.id);
        };
    }

    function _bindKeys(inst) {
        if (_keyHandlers[inst.id]) {
            document.removeEventListener('keydown', _keyHandlers[inst.id], true);
            delete _keyHandlers[inst.id];
        }
        var handler = function (e) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
            if (!_instances[inst.id]) return;
            var scope = document.getElementById(inst.keyScope);
            if (!scope || !scope.classList.contains('active')) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); prev(inst.id); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); next(inst.id); }
            else if (e.key === 'Home') { e.preventDefault(); first(inst.id); }
            else if (e.key === 'End') { e.preventDefault(); last(inst.id); }
        };
        _keyHandlers[inst.id] = handler;
        // Use capture phase so the handler fires before any element-level
        // listeners (e.g. cm-chessboard SVG) can swallow the event.
        document.addEventListener('keydown', handler, true);
    }

    return {
        create: create, destroy: destroy, push: push,
        goTo: goTo, first: first, prev: prev, next: next, last: last,
        getIndex: getIndex, getLength: getLength, getFen: getFen,
        setFens: setFens,
    };
})();
window.MoveNavigator = MoveNavigator;
