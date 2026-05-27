const StockfishService = (function () {
    let _worker = null;
    let _state = 'uninitialized';
    let _currentLines = [];
    let _onUpdate = null;
    let _initResolve = null;
    let _initReject = null;
    let _initPromise = null;
    // Each analyze() sends one 'isready' and increments _pendingReady; each
    // 'readyok' decrements it. While _pendingReady > 0 at least one position
    // switch is still unacknowledged, so 'info' lines belong to a superseded
    // search — their moves are illegal in the current _currentFen — and are
    // dropped. A counter (not a boolean) is required because stepping through
    // plies quickly queues several isready/readyok pairs at once.
    let _pendingReady = 0;
    let _sanFailCount = 0;
    let _multiPV = 3;

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
        try {
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
            // If conversion was successful and we got moves, return them
            if (sanMoves.length > 0) {
                return sanMoves;
            }
            // If we got no moves but had UCI moves, log and return raw UCI
            if (uciMoves.length > 0) {
                console.warn('SAN conversion failed for position:', fen, 'UCI moves:', uciMoves);
                return null; // Signal that SAN conversion failed
            }
            return [];
        } catch (error) {
            console.error('SAN conversion error for position:', fen, 'UCI moves:', uciMoves, 'Error:', error);
            return null; // Signal that SAN conversion failed
        }
    }

    function _onMessage(e) {
        const line = typeof e.data === 'string' ? e.data : '';

        if (_state === 'loading') {
            if (line.includes('uciok')) {
                // Set engine options ONCE here, not on every analyze() call.
                // Re-sending options per-ply churns engine state and defeats the
                // transposition-table warm-start that makes tree navigation snappy.
                // A large hash lets the sub-tree of the current line stay resident,
                // so stepping one ply forward warm-starts instead of searching cold.
                _send('setoption name Hash value 512');
                _send('setoption name Use NNUE value true');
                _send('setoption name MultiPV value ' + _multiPV);
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
            // Barrier: each analyze() sends one 'isready' and bumps _pendingReady.
            // Every 'readyok' decrements it. While ANY readyok is still outstanding,
            // info lines belong to a superseded position (their moves are illegal in
            // the current _currentFen), so we drop them. A single boolean barrier was
            // insufficient: stepping through plies quickly queues several isready/
            // readyok pairs, and the first readyok would wrongly open the gate while
            // older positions' lines were still draining — causing SAN failures.
            if (line === 'readyok') {
                if (_pendingReady > 0) _pendingReady--;
                return;
            }
            if (_pendingReady > 0) return;
            if (line.startsWith('bestmove')) return;
            const parsed = parseInfoLine(line);
            if (parsed && _onUpdate) {
                const sanMoves = uciToSan(_currentFen, parsed.uciMoves);
                if (sanMoves === null) {
                    // Past the barrier these moves SHOULD be legal in _currentFen.
                    // Persistent failure means the position's side-to-move is wrong
                    // (an import problem), not a race. Count failures; after a few at
                    // real depth, signal the UI to prompt for a side check — but never
                    // display raw UCI.
                    _sanFailCount++;
                    if (_sanFailCount >= 3 && parsed.depth >= 2 && _onUpdate) {
                        _onUpdate(_currentLines.slice(), { sanFailed: true });
                    }
                    return;
                }
                _sanFailCount = 0;
                const entry = {
                    pv: parsed.pv,
                    score: parsed.score,
                    scoreCp: parsed.scoreCp,
                    isMate: parsed.isMate,
                    mateIn: parsed.mateIn,
                    depth: parsed.depth,
                    moves: sanMoves,
                    isUciFormat: false,
                };

                // Only update if we have a valid PV with moves, or preserve existing
                const existingEntry = _currentLines[parsed.pv - 1];
                if (entry.moves.length > 0 || !existingEntry) {
                    _currentLines[parsed.pv - 1] = entry;
                } else if (existingEntry && entry.moves.length === 0) {
                    // Preserve existing moves if new update has none
                    entry.moves = existingEntry.moves;
                    entry.isUciFormat = existingEntry.isUciFormat;
                    _currentLines[parsed.pv - 1] = entry;
                }

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
        if (typeof multiPV === 'number' && multiPV > 0) _multiPV = multiPV;
        
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
        var mpv = (options && options.multiPV) || _multiPV;
        // Set state and FEN BEFORE issuing commands so the barrier is armed when
        // the first drained 'info' lines from the previous search arrive.
        _state = 'analyzing';
        _currentFen = fen;
        _currentLines = [];
        _onUpdate = (options && options.onUpdate) || null;
        _pendingReady++;
        _sanFailCount = 0;
        _send('stop');
        // Only re-send MultiPV when the user actually changed the line count.
        // Re-sending options every ply churns engine state and would discard the
        // warm transposition table; sending nothing keeps the tree hot so a step
        // into an already-explored line warm-starts instead of searching cold.
        if (mpv !== _multiPV) {
            _multiPV = mpv;
            _send('setoption name MultiPV value ' + mpv);
        }
        _send('position fen ' + fen);
        // 'isready' forces a 'readyok' that, by UCI ordering guarantees, arrives
        // only after the new position is accepted. _onMessage drops every 'info'
        // line until then, so no stale moves are parsed against the new FEN.
        _send('isready');
        _send('go depth 24');
    }

    function stop() {
        if (_worker) _send('stop');
        _state = (_state === 'destroyed') ? 'destroyed' : 'ready';
        _onUpdate = null;
        _pendingReady = 0;
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
        _pendingReady = 0;
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
