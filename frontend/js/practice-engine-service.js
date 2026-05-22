const PracticeEngineService = (function () {
    let _worker = null;
    let _state = 'uninitialized'; // uninitialized, loading, ready, destroyed
    let _generation = 0;

    function _setState(newState) {
        _state = newState;
    }

    function getState() {
        return _state;
    }

    function isRunning() {
        return _state === 'ready' && _worker !== null;
    }

    function start(level, engineLevels) {
        if (_state === 'loading' || _state === 'ready') {
            return Promise.reject(new Error('Engine already starting or started'));
        }

        _setState('loading');
        _generation += 1;
        var currentGeneration = _generation;
        
        return new Promise(function (resolve, reject) {
            try {
                _worker = new Worker('/vendor/stockfish/stockfish.wasm.js');
                var phase = 'uci';
                
                function onMessage(e) {
                    // Protect against stale callbacks after destruction or restart
                    if (_state === 'destroyed' || !_worker || currentGeneration !== _generation) {
                        return;
                    }
                    
                    var line = typeof e.data === 'string' ? e.data : '';
                    if (phase === 'uci' && line.includes('uciok')) {
                        phase = 'ready';
                        var lvl = engineLevels && engineLevels[level];
                        _worker.postMessage('setoption name Skill Level value ' + (lvl ? lvl.skill : 10));
                        _worker.postMessage('setoption name Use NNUE value true');
                        _worker.postMessage('isready');
                    } else if (phase === 'ready' && line === 'readyok') {
                        phase = 'done';
                        _worker.onmessage = null;
                        _setState('ready');
                        resolve();
                    }
                }
                
                _worker.onmessage = onMessage;
                _worker.postMessage('uci');
                
                setTimeout(function () {
                    if (phase !== 'done' && _worker) {
                        _worker.terminate();
                        _worker = null;
                        _setState('destroyed');
                        reject(new Error('Engine initialization timeout'));
                    }
                }, 10000);
                
            } catch (error) {
                _setState('destroyed');
                _worker = null;
                reject(error);
            }
        });
    }

    function getMove(fen, depth) {
        if (!isRunning()) {
            return Promise.reject(new Error('Engine not ready'));
        }

        var currentGeneration = _generation;
        
        return new Promise(function (resolve, reject) {
            function onMessage(e) {
                // Protect against stale callbacks after destruction or restart
                if (_state === 'destroyed' || !_worker || currentGeneration !== _generation) {
                    _worker.removeEventListener('message', onMessage);
                    reject(new Error('Engine session invalidated'));
                    return;
                }
                
                var line = e.data;
                if (typeof line !== 'string' || !line.startsWith('bestmove')) return;
                
                _worker.removeEventListener('message', onMessage);
                var uci = line.split(' ')[1];
                if (!uci || uci === '(none)') {
                    reject(new Error('No move found'));
                    return;
                }
                resolve(uci);
            }

            _worker.addEventListener('message', onMessage);
            _worker.postMessage('position fen ' + fen);
            _worker.postMessage('go depth ' + depth);
        });
    }

    function stop() {
        if (_worker && _state !== 'destroyed') {
            _worker.terminate();
        }
        _worker = null;
        _generation += 1; // Invalidate any pending async operations
        _setState('uninitialized');
    }

    function destroy() {
        if (_worker && _state !== 'destroyed') {
            _worker.terminate();
        }
        _worker = null;
        _generation += 1; // Invalidate any pending async operations
        _setState('destroyed');
    }

    return {
        start: start,
        stop: stop,
        destroy: destroy,
        getMove: getMove,
        isRunning: isRunning,
        getState: getState
    };
})();

window.PracticeEngineService = PracticeEngineService;