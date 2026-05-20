var BoardEditor = (function () {
    var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    var BOARD_ID = 'editor-board';
    var _chess = null;
    var _activeTool = 'eraser';
    var _turn = 'w';
    var _editorTagState = { tags: [] };
    var _editorTagFilter = null;
    var PIECES = [
        { color: 'w', type: 'k' }, { color: 'w', type: 'q' }, { color: 'w', type: 'r' },
        { color: 'w', type: 'b' }, { color: 'w', type: 'n' }, { color: 'w', type: 'p' },
        { color: 'b', type: 'k' }, { color: 'b', type: 'q' }, { color: 'b', type: 'r' },
        { color: 'b', type: 'b' }, { color: 'b', type: 'n' }, { color: 'b', type: 'p' },
    ];
    var PIECE_SVG_KEYS = {
        'wk': 'wK', 'wq': 'wQ', 'wr': 'wR', 'wb': 'wB', 'wn': 'wN', 'wp': 'wP',
        'bk': 'bK', 'bq': 'bQ', 'br': 'bR', 'bb': 'bB', 'bn': 'bN', 'bp': 'bP',
    };
    function _getFen() {
        var raw = _chess.fen();
        var parts = raw.split(' ');
        parts[1] = _turn;
        return parts.join(' ');
    }
    function _createBoard(fen) {
        var el = document.getElementById(BOARD_ID);
        if (!el) return;
        BoardManager.create(BOARD_ID, fen);
        BoardManager.enableSquareSelect(BOARD_ID, function (square) {
            _onSquareClick(square);
        });
    }
    function init(params) {
        var fen = (params && params.fen) ? decodeURIComponent(params.fen) : null;
        _chess = new Chess();
        if (fen && _chess.load(fen)) {
            _turn = _chess.turn();
        } else {
            _chess.clear();
            _turn = 'w';
        }
        _activeTool = 'eraser';

        _createBoard(_getFen());

        _renderPalette();
        _updateTurnButtons();
        _updateFenDisplay();

        document.getElementById('editor-pos-title').value = '';
        _editorTagState.tags = [];
        _editorTagFilter = TagFilter.mount({
            containerId: 'editor-pos-tags-container',
            state: _editorTagState,
            onChange: function() {},
            placeholder: 'Add tags...'
        });
    }
    function _onSquareClick(square) {
        if (_activeTool === 'eraser') {
            _chess.remove(square);
        } else {
            var parts = _activeTool.split('_');
            _chess.put({ type: parts[1], color: parts[0] }, square);
        }
        var fen = _getFen();
        BoardManager.setPosition(BOARD_ID, fen);
        _updateFenDisplay();
    }
    function _renderPalette() {
        var el = document.getElementById('editor-palette');
        if (!el) return;
        var html = '<div class="editor-palette">';
        html += '<div class="palette-row">';
        PIECES.forEach(function (p, i) {
            if (i === 6) html += '</div><div class="palette-row">';
            var key = p.color + '_' + p.type;
            var svgKey = PIECE_SVG_KEYS[p.color + p.type];
            var active = _activeTool === key ? ' active' : '';
            html += '<button class="palette-btn' + active + '" data-tool="' + key + '" onclick="BoardEditor.selectTool(\'' + key + '\')">';
            html += '<img src="' + PIECE_SVG[svgKey] + '" alt="' + svgKey + '">';
            html += '</button>';
        });
        html += '</div>';
        html += '<div class="palette-row">';
        var eraserActive = _activeTool === 'eraser' ? ' active' : '';
        html += '<button class="palette-btn eraser-btn' + eraserActive + '" data-tool="eraser" onclick="BoardEditor.selectTool(\'eraser\')">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        html += '</button>';
        html += '</div>';
        html += '</div>';
        el.innerHTML = html;
    }
    function selectTool(tool) {
        _activeTool = tool;
        var btns = document.querySelectorAll('.palette-btn');
        btns.forEach(function (b) {
            b.classList.toggle('active', b.dataset.tool === tool);
        });
    }
    function setTurn(t) {
        _turn = t;
        var fen = _getFen();
        BoardManager.setPosition(BOARD_ID, fen);
        _updateTurnButtons();
        _updateFenDisplay();
    }
    function _updateTurnButtons() {
        var wBtn = document.getElementById('editor-turn-w');
        var bBtn = document.getElementById('editor-turn-b');
        if (wBtn) {
            wBtn.className = _turn === 'w' ? 'btn btn-sm btn-primary' : 'btn btn-sm';
        }
        if (bBtn) {
            bBtn.className = _turn === 'b' ? 'btn btn-sm btn-primary' : 'btn btn-sm';
        }
    }
    function _updateFenDisplay() {
        var el = document.getElementById('editor-fen');
        if (el) el.value = _getFen();
    }
    function clear() {
        _chess.clear();
        var fen = _getFen();
        BoardManager.setPosition(BOARD_ID, fen);
        _updateFenDisplay();
    }
    function startPos() {
        _chess.load(START_FEN);
        _turn = 'w';
        _updateTurnButtons();
        var fen = _getFen();
        BoardManager.setPosition(BOARD_ID, fen);
        _updateFenDisplay();
    }
    function flip() {
        BoardManager.flip(BOARD_ID);
    }
    function copyFen() {
        var fen = _getFen();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(fen);
            toast('FEN copied');
        }
    }
    async function save(posType) {
        var fen = _getFen();
        var title = document.getElementById('editor-pos-title').value.trim() || 'Untitled';
        var tags = _editorTagState.tags.slice();
        var res = await fetch(API + '/positions/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: fen, title: title, position_type: posType, tags: tags }),
        });
        if (res.ok) {
            var data = await res.json();
            var savedCat = Object.values(CATEGORIES).find(c => c.positionType === posType);
            toast('\u2713 Saved as ' + (savedCat ? savedCat.label.toLowerCase() : posType));
            Router.navigate({ view: 'positionDetail', id: data.id, positionType: posType });
        } else if (res.status === 409) {
            toast('Position already saved', 'warn');
        } else {
            var err = await res.json();
            toast(err.detail || 'Error saving', 'error');
        }
    }
    function search(searchType) {
        var fen = _getFen();
        Router.navigate({ view: 'search' });
        setTimeout(function () {
            var fenInput = document.getElementById('search-fen');
            if (fenInput) fenInput.value = fen;
            AppState.searchFen = fen;
            BoardManager.setPosition('search-board', fen);
            var radios = document.querySelectorAll('input[name="search-type"]');
            radios.forEach(function (r) { r.checked = r.value === searchType; });
            doPositionSearch();
        }, 50);
    }
    function openFromSearch() {
        var fen = document.getElementById('search-fen').value.trim();
        var params = {};
        if (fen) params.fen = fen;
        Router.navigate({ view: 'editor', params: params });
    }
    return {
        init: init,
        selectTool: selectTool,
        setTurn: setTurn,
        clear: clear,
        startPos: startPos,
        flip: flip,
        copyFen: copyFen,
        save: save,
        search: search,
        openFromSearch: openFromSearch,
    };
})();

window.BoardEditor = BoardEditor;
