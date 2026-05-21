const EngineUI = (function () {
    let _containerId = null;
    let _currentFen = null;
    let _engineOn = false;
    let _toggleHandler = null;
    let _selectHandler = null;

    function _getLineCount() {
        var sel = document.getElementById('engine-lines-select');
        return sel ? parseInt(sel.value, 10) : 3;
    }

    function _scoreClass(entry) {
        if (entry.isMate) return 'mate';
        if (entry.scoreCp === 0) return 'neutral';
        return entry.scoreCp > 0 ? 'positive' : 'negative';
    }

    function _formatMoves(moves, fen) {
        if (!moves || !moves.length) return '';
        var isBlack = fen && fen.split(' ')[1] === 'b';
        var fullMoveNum = fen ? parseInt(fen.split(' ')[5], 10) || 1 : 1;
        var parts = [];
        var plyOffset = isBlack ? 1 : 0;

        for (var i = 0; i < moves.length; i++) {
            var ply = plyOffset + i;
            var moveNum = fullMoveNum + Math.floor(ply / 2);
            if (ply % 2 === 0) {
                parts.push(moveNum + '.' + moves[i]);
            } else if (i === 0 && isBlack) {
                parts.push(moveNum + '...' + moves[i]);
            } else {
                parts.push(moves[i]);
            }
        }
        return parts.join(' ');
    }

    function _evalPercent(entry) {
        if (!entry) return 50;
        if (entry.isMate) {
            return entry.mateIn > 0 ? 100 : 0;
        }
        var cp = entry.scoreCp || 0;
        return 50 + 50 * (2 / (1 + Math.exp(-cp / 250)) - 1);
    }

    function _renderLines(lines) {
        var output = document.getElementById('engine-output');
        var bar = document.getElementById('engine-eval-bar-fill');
        if (!output) return;

        if (!lines || !lines.length) {
            output.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Analyzing...</div>';
            return;
        }

        if (bar && lines[0]) {
            bar.style.width = _evalPercent(lines[0]) + '%';
        }

        var html = '';
        for (var i = 0; i < lines.length; i++) {
            var entry = lines[i];
            if (!entry) continue;
            html += '<div class="engine-line">' +
                '<span class="engine-line-score ' + _scoreClass(entry) + '">' + entry.score + '</span>' +
                '<span class="engine-line-depth">d' + entry.depth + '</span>' +
                '<span class="engine-line-moves">' + _formatMoves(entry.moves, _currentFen) + '</span>' +
                '</div>';
        }
        output.innerHTML = html;
    }

    function _startAnalysis() {
        _renderLines([]);
        StockfishService.analyze(_currentFen, {
            multiPV: _getLineCount(),
            onUpdate: _renderLines,
        });
    }

    function _toggleEngine() {
        var btn = document.getElementById('engine-toggle-btn');
        var sel = document.getElementById('engine-lines-select');
        var bar = document.getElementById('engine-eval-bar');
        var output = document.getElementById('engine-output');
        if (!btn) return;

        if (_engineOn) {
            StockfishService.stop();
            _engineOn = false;
            btn.textContent = 'Show Engine';
            btn.disabled = false;
            if (sel) sel.style.display = 'none';
            if (bar) bar.style.display = 'none';
            if (output) output.style.display = 'none';
            return;
        }

        if (StockfishService.state === 'uninitialized' || StockfishService.state === 'destroyed') {
            btn.textContent = 'Loading...';
            btn.disabled = true;
            StockfishService.init().then(function () {
                btn.textContent = 'Hide Engine';
                btn.disabled = false;
                _engineOn = true;
                if (sel) sel.style.display = '';
                if (bar) bar.style.display = '';
                if (output) output.style.display = '';
                if (_currentFen) _startAnalysis();
            });
            return;
        }

        _engineOn = true;
        btn.textContent = 'Hide Engine';
        if (sel) sel.style.display = '';
        if (bar) bar.style.display = '';
        if (output) output.style.display = '';
        if (_currentFen) _startAnalysis();
    }

    function _onLinesChange() {
        if (_engineOn && _currentFen) {
            _startAnalysis();
        }
    }

    function mount(containerId) {
        if (_containerId === containerId) return;
        if (_containerId) unmount();

        var container = document.getElementById(containerId);
        if (!container) return;
        _containerId = containerId;

        container.innerHTML =
            '<div class="engine-panel">' +
                '<div class="engine-controls">' +
                    '<button class="btn btn-md engine-toggle" id="engine-toggle-btn">Show Engine</button>' +
                    '<select class="select-input engine-lines-select" id="engine-lines-select" style="display:none">' +
                        '<option value="1">1 line</option>' +
                        '<option value="2">2 lines</option>' +
                        '<option value="3" selected>3 lines</option>' +
                        '<option value="4">4 lines</option>' +
                        '<option value="5">5 lines</option>' +
                    '</select>' +
                '</div>' +
                '<div class="engine-eval-bar" id="engine-eval-bar" style="display:none">' +
                    '<div class="engine-eval-bar-fill" id="engine-eval-bar-fill"></div>' +
                '</div>' +
                '<div class="engine-output" id="engine-output" style="display:none"></div>' +
            '</div>';

        var btn = document.getElementById('engine-toggle-btn');
        var sel = document.getElementById('engine-lines-select');

        _toggleHandler = _toggleEngine;
        _selectHandler = _onLinesChange;

        if (btn) btn.addEventListener('click', _toggleHandler);
        if (sel) sel.addEventListener('change', _selectHandler);
    }

    function setPosition(fen) {
        _currentFen = fen;
        if (_engineOn) {
            _startAnalysis();
        }
    }

    function unmount() {
        if (!_containerId) return;

        StockfishService.stop();
        _engineOn = false;

        var btn = document.getElementById('engine-toggle-btn');
        var sel = document.getElementById('engine-lines-select');
        if (btn && _toggleHandler) btn.removeEventListener('click', _toggleHandler);
        if (sel && _selectHandler) sel.removeEventListener('change', _selectHandler);
        _toggleHandler = null;
        _selectHandler = null;

        var container = document.getElementById(_containerId);
        if (container) container.innerHTML = '';
        _containerId = null;
        _currentFen = null;
    }

    return {
        mount: mount,
        setPosition: setPosition,
        unmount: unmount,
    };
})();

window.EngineUI = EngineUI;
