const StockfishService = (function () {
    let _worker = null;
    let _state = 'uninitialized';
    let _currentLines = [];
    let _onUpdate = null;
    let _initResolve = null;
    let _initReject = null;
    let _initPromise = null;

    function _send(cmd) {
        if (_worker) _worker.postMessage(cmd);
    }

    function parseInfoLine(line) {
        if (!line || typeof line !== 'string') return null;
        if (!line.startsWith('info ')) return null;

        const tokens = line.split(/\s+/);
        const pvIndex = tokens.indexOf('pv');
        if (pvIndex === -1) return null;

        let multipv = 1;
        const multipvIdx = tokens.indexOf('multipv');
        if (multipvIdx !== -1 && multipvIdx + 1 < tokens.length) {
            multipv = parseInt(tokens[multipvIdx + 1], 10);
        }

        let depth = 0;
        const depthIdx = tokens.indexOf('depth');
        if (depthIdx !== -1 && depthIdx + 1 < tokens.length) {
            depth = parseInt(tokens[depthIdx + 1], 10);
        }

        let scoreCp = null;
        let score = '0.00';
        let isMate = false;
        let mateIn = null;
        const scoreIdx = tokens.indexOf('score');
        if (scoreIdx !== -1 && scoreIdx + 1 < tokens.length) {
            const scoreType = tokens[scoreIdx + 1];
            const scoreVal = parseInt(tokens[scoreIdx + 2], 10);
            if (scoreType === 'cp') {
                scoreCp = scoreVal;
                isMate = false;
                const sign = scoreVal >= 0 ? '+' : '';
                score = sign + (scoreVal / 100).toFixed(2);
            } else if (scoreType === 'mate') {
                isMate = true;
                mateIn = scoreVal;
                scoreCp = null;
                score = scoreVal > 0 ? 'M' + scoreVal : '-M' + Math.abs(scoreVal);
            }
        }

        const uciMoves = tokens.slice(pvIndex + 1);

        return { pv: multipv, depth, scoreCp, score, isMate, mateIn, uciMoves };
    }

    function uciToSan(fen, uciMoves) {
        const chess = new Chess(fen);
        const sanMoves = [];
        for (const uci of uciMoves) {
            const from = uci.substring(0, 2);
            const to = uci.substring(2, 4);
            const promotion = uci.length > 4 ? uci[4] : undefined;
            const move = chess.move({ from, to, promotion });
            if (!move) break;
            sanMoves.push(move.san);
        }
        return sanMoves;
    }

    function _onMessage(e) {
        const line = typeof e.data === 'string' ? e.data : '';

        if (_state === 'loading') {
            if (line.includes('uciok')) {
                _send('isready');
                return;
            }
            if (line === 'readyok') {
                _state = 'ready';
                if (_initResolve) {
                    _initResolve();
                    _initResolve = null;
                    _initReject = null;
                    _initPromise = null;
                }
                return;
            }
            return;
        }

        if (_state === 'analyzing') {
            if (line.startsWith('bestmove')) return;
            const parsed = parseInfoLine(line);
            if (parsed && _onUpdate) {
                const sanMoves = uciToSan(_currentFen, parsed.uciMoves);
                const entry = {
                    pv: parsed.pv,
                    score: parsed.score,
                    scoreCp: parsed.scoreCp,
                    isMate: parsed.isMate,
                    mateIn: parsed.mateIn,
                    depth: parsed.depth,
                    moves: sanMoves,
                };
                _currentLines[parsed.pv - 1] = entry;
                // Only call callback if we're still analyzing (not destroyed)
                if (_state === 'analyzing' && _onUpdate) {
                    _onUpdate(_currentLines.slice());
                }
            }
        }
    }

    let _currentFen = '';

    function init(multiPV) {
        if (_state === 'ready' || _state === 'analyzing') return Promise.resolve();
        if (_state === 'loading') return _initPromise || Promise.resolve();
        
        // Ensure any existing worker is cleaned up
        if (_worker) {
            _worker.terminate();
            _worker = null;
        }
        
        _state = 'loading';
        _currentLines = [];
        _onUpdate = null;
        
        _initPromise = new Promise(function (resolve, reject) {
            _initResolve = resolve;
            _initReject = reject;
            _worker = new Worker('/vendor/stockfish/stockfish.wasm.js');
            _worker.onmessage = _onMessage;
            _send('uci');
        });
        return _initPromise;
    }

    function analyze(fen, options) {
        if (_state !== 'ready' && _state !== 'analyzing') return;
        _send('stop');
        var mpv = (options && options.multiPV) || 3;
        _send('setoption name MultiPV value ' + mpv);
        _send('setoption name Use NNUE value true');
        _send('position fen ' + fen);
        _send('go depth 24');
        _state = 'analyzing';
        _currentFen = fen;
        _currentLines = [];
        _onUpdate = (options && options.onUpdate) || null;
    }

    function stop() {
        if (_worker) _send('stop');
        _state = (_state === 'destroyed') ? 'destroyed' : 'ready';
        _onUpdate = null;
    }

    function destroy() {
        stop();
        if (_worker) {
            _worker.terminate();
            _worker = null;
        }
        if (_initReject) _initReject(new Error('Stockfish worker destroyed'));
        _initResolve = null;
        _initReject = null;
        _initPromise = null;
        _currentLines = [];
        _onUpdate = null;
        _currentFen = '';
        _state = 'destroyed';
    }

    return {
        init: init,
        analyze: analyze,
        stop: stop,
        destroy: destroy,
        get state() { return _state; },
        parseInfoLine: parseInfoLine,
        uciToSan: uciToSan,
    };
})();

window.StockfishService = StockfishService;
