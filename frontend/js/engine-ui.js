const EngineUI = (function () {
    let _containerId = null;
    let _currentFen = null;
    let _engineOn = false;
    let _toggleHandler = null;
    let _selectHandler = null;
    let _fenKeyHandler = null;
    let _sideHandler = null;
    let _options = {};
    let _sideNeedsCheck = false;
    let _sideManuallyConfirmed = false;

    function _getLineCount() {
        var sel = document.getElementById('engine-lines-select');
        return sel ? parseInt(sel.value, 10) : 3;
    }

    function _scoreClass(entry) {
        if (entry.isMate) return 'mate';
        if (entry.scoreCp === 0) return 'neutral';
        return entry.scoreCp > 0 ? 'positive' : 'negative';
    }


    function _fenParts(fen) {
        return (fen || '').trim().split(/\s+/);
    }

    function _isValidFenShape(fen) {
        var parts = _fenParts(fen);
        return parts.length >= 2 && (parts[1] === 'w' || parts[1] === 'b');
    }

    function _setFenSide(fen, side) {
        var parts = _fenParts(fen);
        if (!parts.length) return fen;
        while (parts.length < 6) {
            if (parts.length === 1) parts.push(side);
            else if (parts.length === 2) parts.push('-');
            else if (parts.length === 3) parts.push('-');
            else if (parts.length === 4) parts.push('0');
            else if (parts.length === 5) parts.push('1');
        }
        parts[1] = side;
        return parts.join(' ');
    }

    function _getSelectedSide() {
        var white = document.getElementById('engine-side-white');
        var black = document.getElementById('engine-side-black');
        if (black && black.classList.contains('is-active')) return 'b';
        if (white && white.classList.contains('is-active')) return 'w';
        var side = _fenParts(_currentFen)[1];
        return side === 'b' ? 'b' : 'w';
    }

    function _markSideNeedsCheck() {
        if (_sideManuallyConfirmed || _sideNeedsCheck) return;
        _sideNeedsCheck = true;
        _syncFenControls();
    }

    function _fenFromInputWithSide(sideOverride) {
        var input = document.getElementById('engine-fen-input');
        var raw = input ? input.value.trim() : '';
        var side = sideOverride || _getSelectedSide();
        if (!raw && _currentFen) raw = _fenParts(_currentFen)[0] || '';
        if (!raw) return '';

        var parts = _fenParts(raw);
        if (parts.length === 1) {
            // UI displays only the board-placement part. Build a complete engine FEN.
            return parts[0] + ' ' + side + ' - - 0 1';
        }

        // Full FEN pasted/typed by the user. Normalize/override side to match the pill.
        while (parts.length < 6) {
            if (parts.length === 1) parts.push(side);
            else if (parts.length === 2) parts.push('-');
            else if (parts.length === 3) parts.push('-');
            else if (parts.length === 4) parts.push('0');
            else if (parts.length === 5) parts.push('1');
        }
        parts[1] = side;
        return parts.join(' ');
    }

    function _syncFenControls() {
        var input = document.getElementById('engine-fen-input');
        var white = document.getElementById('engine-side-white');
        var black = document.getElementById('engine-side-black');
        var pills = document.getElementById('engine-side-pills');
        var warning = document.getElementById('engine-side-warning');
        var parts = _fenParts(_currentFen);
        var boardPart = parts[0] || '';
        if (input && input.value !== boardPart) input.value = boardPart;
        var side = parts[1];
        var whiteActive = !_sideNeedsCheck && side !== 'b';
        var blackActive = !_sideNeedsCheck && side === 'b';
        if (white) {
            white.classList.toggle('is-active', whiteActive);
            white.setAttribute('aria-pressed', whiteActive ? 'true' : 'false');
        }
        if (black) {
            black.classList.toggle('is-active', blackActive);
            black.setAttribute('aria-pressed', blackActive ? 'true' : 'false');
        }
        if (pills) {
            pills.classList.toggle('needs-check', _sideNeedsCheck);
            pills.style.borderColor = _sideNeedsCheck ? '#f97316' : '';
            pills.style.background = _sideNeedsCheck ? '#fff7ed' : '';
            pills.style.boxShadow = _sideNeedsCheck ? '0 0 0 3px rgba(249, 115, 22, 0.18)' : '';
        }
        [white, black].forEach(function (btn) {
            if (!btn) return;
            if (_sideNeedsCheck && !btn.classList.contains('is-active')) {
                btn.style.background = '#fed7aa';
                btn.style.color = '#9a3412';
            } else {
                btn.style.background = '';
                btn.style.color = '';
            }
        });
        if (warning) {
            warning.style.display = _sideNeedsCheck ? '' : 'none';
            warning.style.color = '#c2410c';
            warning.style.fontSize = '12px';
            warning.style.fontWeight = '700';
            warning.style.whiteSpace = 'nowrap';
        }
    }

    function _notifyManualFenChange() {
        if (_options && typeof _options.onFenChange === 'function' && _currentFen) {
            _options.onFenChange(_currentFen);
        }
    }

    function _applyFenFromInput() {
        var fen = _fenFromInputWithSide();
        if (!fen) return;
        if (!_isValidFenShape(fen)) {
            toast('FEN must include a board position and side to move', 'warn');
            _syncFenControls();
            return;
        }
        _currentFen = fen;
        _sideNeedsCheck = false;
        _sideManuallyConfirmed = true;
        _syncFenControls();
        _notifyManualFenChange();
        if (_engineOn) _startAnalysis();
    }

    function _onFenKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            _applyFenFromInput();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            _syncFenControls();
        }
    }

    function _onSideClick(e) {
        var btn = e && e.currentTarget;
        var side = btn && btn.getAttribute('data-side') === 'b' ? 'b' : 'w';
        _currentFen = _fenFromInputWithSide(side);
        _sideNeedsCheck = false;
        _sideManuallyConfirmed = true;
        _syncFenControls();
        _notifyManualFenChange();
        if (_engineOn && _currentFen) _startAnalysis();
    }

    function _formatMoves(moves, fen, isUciFormat) {
        if (!moves || !moves.length) return '';
        
        // If in UCI format, just display the raw moves with spacing
        if (isUciFormat) {
            return moves.join(' ');
        }
        
        // Otherwise format as SAN with move numbers
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
            // SAFE_INNER_HTML: Static template with no dynamic content
            output.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Analyzing...</div>';
            return;
        }

        if (bar && lines[0]) {
            bar.style.width = _evalPercent(lines[0]) + '%';
        }

        if (!_sideManuallyConfirmed && lines.some(function (entry) { return entry && entry.isUciFormat; })) {
            _markSideNeedsCheck();
        }

        var html = '';
        for (var i = 0; i < lines.length; i++) {
            var entry = lines[i];
            if (!entry) continue;
            var movesText = _formatMoves(entry.moves, _currentFen, entry.isUciFormat);
            // Only render the line if we have moves or at least score/depth
            if (movesText || entry.score) {
                html += '<div class="engine-line">' +
                    '<span class="engine-line-score ' + _scoreClass(entry) + '">' + entry.score + '</span>' +
                    '<span class="engine-line-depth">d' + entry.depth + '</span>' +
                    '<span class="engine-line-moves">' + movesText + '</span>' +
                    '</div>';
            }
        }
        // SAFE_INNER_HTML: Controlled template - only chess evaluation data from trusted engine
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
            // Hide engine - destroy worker completely
            StockfishService.destroy();
            _engineOn = false;
            btn.textContent = 'Show Engine';
            btn.disabled = false;
            if (sel) sel.style.display = 'none';
            if (bar) bar.style.display = 'none';
            if (output) output.style.display = 'none';
            // Clear any stale analysis output
            // SAFE_INNER_HTML: Clearing element content
            if (output) output.innerHTML = '';
            return;
        }

        // Show engine - create fresh worker
        if (StockfishService.state === 'uninitialized' || StockfishService.state === 'destroyed') {
            btn.textContent = 'Loading...';
            btn.disabled = true;
            StockfishService.init().then(function () {
                // Check if EngineUI is still mounted and container exists
                if (!_containerId || !btn) return;
                btn.textContent = 'Hide Engine';
                btn.disabled = false;
                _engineOn = true;
                if (sel) sel.style.display = '';
                if (bar) bar.style.display = '';
                if (output) output.style.display = '';
                if (_currentFen) _startAnalysis();
            }).catch(function (error) {
                // Check if elements still exist before updating
                if (!btn || !_containerId) return;
                console.error('Stockfish init failed:', error);
                btn.textContent = 'Show Engine';
                btn.disabled = false;
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

    function mount(containerId, options) {
        if (_containerId === containerId) {
            _options = options || _options || {};
            return;
        }
        if (_containerId) unmount();

        var container = document.getElementById(containerId);
        if (!container) return;
        _containerId = containerId;
        _options = options || {};

        // SAFE_INNER_HTML: Static template with controlled button actions
        container.innerHTML =
            '<div class="engine-panel">' +
                '<div class="engine-fen-toolbar" aria-label="Engine FEN">' +
                    '<input class="engine-fen-input" id="engine-fen-input" type="text" spellcheck="false" autocomplete="off" aria-label="Engine FEN" />' +
                    '<div class="engine-side-pills" id="engine-side-pills" aria-label="Side to move">' +
                        '<button class="engine-side-pill" id="engine-side-white" type="button" data-side="w" aria-pressed="false">White</button>' +
                        '<button class="engine-side-pill" id="engine-side-black" type="button" data-side="b" aria-pressed="false">Black</button>' +
                    '</div>' +
                    '<span class="engine-side-warning" id="engine-side-warning" style="display:none">check side</span>' +
                '</div>' +
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
        var fenInput = document.getElementById('engine-fen-input');
        var whiteSide = document.getElementById('engine-side-white');
        var blackSide = document.getElementById('engine-side-black');

        _toggleHandler = _toggleEngine;
        _selectHandler = _onLinesChange;
        _fenKeyHandler = _onFenKeydown;
        _sideHandler = _onSideClick;

        if (btn) btn.addEventListener('click', _toggleHandler);
        if (sel) sel.addEventListener('change', _selectHandler);
        if (fenInput) fenInput.addEventListener('keydown', _fenKeyHandler);
        if (fenInput) fenInput.addEventListener('change', _applyFenFromInput);
        if (whiteSide) whiteSide.addEventListener('click', _sideHandler);
        if (blackSide) blackSide.addEventListener('click', _sideHandler);
        _syncFenControls();
    }

    function setPosition(fen) {
        var previousBoard = _fenParts(_currentFen)[0] || '';
        var nextBoard = _fenParts(fen)[0] || '';
        _currentFen = fen;
        // A new board position should be trusted until SAN conversion proves otherwise.
        // Re-setting the same board during engine refreshes should not erase an explicit user choice.
        if (previousBoard !== nextBoard) {
            _sideNeedsCheck = false;
            _sideManuallyConfirmed = false;
        }
        _syncFenControls();
        if (_engineOn) {
            _startAnalysis();
        }
    }

    function unmount() {
        if (!_containerId) return;

        StockfishService.destroy();
        _engineOn = false;

        var btn = document.getElementById('engine-toggle-btn');
        var sel = document.getElementById('engine-lines-select');
        var fenInput = document.getElementById('engine-fen-input');
        var whiteSide = document.getElementById('engine-side-white');
        var blackSide = document.getElementById('engine-side-black');
        if (btn && _toggleHandler) btn.removeEventListener('click', _toggleHandler);
        if (sel && _selectHandler) sel.removeEventListener('change', _selectHandler);
        if (fenInput && _fenKeyHandler) fenInput.removeEventListener('keydown', _fenKeyHandler);
        if (fenInput) fenInput.removeEventListener('change', _applyFenFromInput);
        if (whiteSide && _sideHandler) whiteSide.removeEventListener('click', _sideHandler);
        if (blackSide && _sideHandler) blackSide.removeEventListener('click', _sideHandler);
        _toggleHandler = null;
        _selectHandler = null;
        _fenKeyHandler = null;
        _sideHandler = null;

        var container = document.getElementById(_containerId);
        // SAFE_INNER_HTML: Clearing element content
        if (container) container.innerHTML = '';
        _containerId = null;
        _currentFen = null;
        _sideNeedsCheck = false;
        _sideManuallyConfirmed = false;
        _options = {};
    }

    function show() {
        if (!_containerId) return false;
        if (_engineOn) return true;
        
        var btn = document.getElementById('engine-toggle-btn');
        if (btn && btn.textContent === 'Show Engine') {
            _toggleEngine();
            return true;
        }
        return false;
    }

    function hide() {
        if (!_containerId) return false;
        if (!_engineOn) return true;
        
        var btn = document.getElementById('engine-toggle-btn');
        if (btn && btn.textContent === 'Hide Engine') {
            _toggleEngine();
            return true;
        }
        return false;
    }

    function destroy() {
        StockfishService.destroy();
        _engineOn = false;
        var btn = document.getElementById('engine-toggle-btn');
        if (btn) {
            btn.textContent = 'Show Engine';
            btn.disabled = false;
        }
        var sel = document.getElementById('engine-lines-select');
        var bar = document.getElementById('engine-eval-bar');
        var output = document.getElementById('engine-output');
        if (sel) sel.style.display = 'none';
        if (bar) bar.style.display = 'none';
        if (output) output.style.display = 'none';
    }

    function analyzeCurrentPosition() {
        if (_engineOn && _currentFen) {
            _startAnalysis();
        }
    }

    function teardown() {
        destroy();
    }

    function isEngineOn() {
        return _engineOn;
    }

    return {
        mount: mount,
        setPosition: setPosition,
        unmount: unmount,
        show: show,
        hide: hide,
        destroy: destroy,
        analyzeCurrentPosition: analyzeCurrentPosition,
        teardown: teardown,
        isEngineOn: isEngineOn,
    };
})();

window.EngineUI = EngineUI;
