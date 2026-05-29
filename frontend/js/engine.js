/**
 * Stockfish WASM engine wrapper - stateless oracle behind a Promise wall.
 * Exposes only bestMove() and evaluate() to maintain architectural purity.
 * §5.1 of PLAY-AND-REVIEW-SPEC.md
 */
(function() {
    'use strict';

    let worker = null;
    let initPromise = null;
    let generation = 0;
    let currentRequest = null;

    // Timeouts are module-level so tests can shorten them (see _test.setTimeouts).
    let initTimeoutMs = 10000;       // engine boot (uci + isready handshake)
    let searchMarginMs = 5000;       // grace added on top of a movetime search
    let evalTimeoutMs = 20000;       // depth-based eval can legitimately run long

    // Pure parsing functions (exported for testing)
    function parseBestMove(line) {
        // bestmove e2e4 ponder e7e5
        // bestmove (none)
        const match = line.match(/^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/);
        if (!match) return null;

        const bestMove = match[1] === '(none)' ? null : match[1];
        const ponder = match[2] || undefined;
        return { bestMove, ponder };
    }

    function parseInfoLine(line) {
        const depthMatch = line.match(/depth\s+(\d+)/);
        const depth = depthMatch ? parseInt(depthMatch[1], 10) : null;

        const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
        const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);

        const pvMatch = line.match(/pv\s+(.+?)(?:\s+upperbound|\s+lowerbound|$)/);
        const pvUci = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];

        return {
            depth,
            scoreCp: cpMatch ? parseInt(cpMatch[1], 10) : null,
            mate: mateMatch ? parseInt(mateMatch[1], 10) : null,
            pvUci
        };
    }

    function normalizeScore(score, sideToMove) {
        // UCI scores are from side to move POV; normalize to White's POV
        const isBlackToMove = sideToMove === 'b';

        if (score.scoreCp !== null) {
            return { scoreCp: isBlackToMove ? -score.scoreCp : score.scoreCp, mate: null };
        }
        if (score.mate !== null) {
            return { scoreCp: null, mate: isBlackToMove ? -score.mate : score.mate };
        }
        return { scoreCp: null, mate: null };
    }

    function getSideToMove(fen) {
        return fen.split(' ')[1] || 'w';
    }

    // Worker communication
    function sendCommand(cmd) {
        if (worker) {
            worker.postMessage(cmd);
        }
    }

    function createWorker() {
        if (typeof WebAssembly !== 'object') {
            throw new Error('WebAssembly not supported in this browser');
        }

        worker = new Worker('/vendor/stockfish/stockfish-18-lite-single.js');

        return new Promise((resolve, reject) => {
            // Tear the worker down on a failed boot so init() can build a fresh one.
            const fail = (err) => {
                clearTimeout(timeout);
                try { if (worker) worker.terminate(); } catch (_) { /* ignore */ }
                worker = null;
                reject(err);
            };

            const timeout = setTimeout(function() {
                fail(new Error('Engine initialization timeout'));
            }, initTimeoutMs);

            worker.onmessage = function(e) {
                const line = e.data;

                if (line === 'uciok') {
                    sendCommand('isready');
                } else if (line === 'readyok') {
                    clearTimeout(timeout);
                    resolve();
                }

                // Route every line to the in-flight search (if any).
                if (currentRequest) {
                    currentRequest.handleLine(line);
                }
            };

            worker.onerror = function(e) {
                fail(new Error('Worker error: ' + (e && e.message ? e.message : 'unknown')));
            };

            sendCommand('uci');
        });
    }

    /**
     * Run one search request behind the Promise wall, handling three hazards:
     *  - Timeout: if the worker never returns, the promise rejects instead of
     *    hanging forever (the old "Engine thinking" freeze).
     *  - Stop race: if a previous search is still live, we `stop` + `isready`
     *    and ignore everything until `readyok`, so the stale `bestmove` emitted
     *    by the stopped search can't resolve THIS request with the wrong move.
     *  - Staleness: a newer generation (or stop()) invalidates this request.
     */
    function runSearch(myGen, searchCommands, onLine, timeoutMs) {
        return new Promise((resolve, reject) => {
            let phase = currentRequest ? 'draining' : 'searching';
            let settled = false;

            const settle = (isResolve, value) => {
                if (settled || generation !== myGen) return;
                settled = true;
                clearTimeout(timer);
                if (currentRequest && currentRequest.generation === myGen) currentRequest = null;
                (isResolve ? resolve : reject)(value);
            };

            const timer = setTimeout(function() {
                if (settled) return;
                settled = true;
                if (currentRequest && currentRequest.generation === myGen) currentRequest = null;
                sendCommand('stop');
                reject(new Error('Engine search timed out'));
            }, timeoutMs);

            const fireSearch = () => searchCommands.forEach(sendCommand);

            currentRequest = {
                generation: myGen,
                // Lets stop() settle a pending request instead of leaking it.
                reject: (err) => settle(false, err),
                handleLine(line) {
                    if (generation !== myGen || settled) return;
                    if (phase === 'draining') {
                        if (line === 'readyok') {
                            phase = 'searching';
                            fireSearch();
                        }
                        return; // ignore the stopped search's stale lines
                    }
                    onLine(line, {
                        resolve: (v) => settle(true, v),
                        reject: (e) => settle(false, e)
                    });
                }
            };

            if (phase === 'draining') {
                sendCommand('stop');
                sendCommand('isready');
            } else {
                fireSearch();
            }
        });
    }

    // Public API
    window.Engine = {
        async init() {
            if (!initPromise) {
                // Cache the in-flight boot, but on failure clear it so a later
                // call can retry instead of returning the same rejected promise.
                initPromise = createWorker().catch(function(err) {
                    initPromise = null;
                    throw err;
                });
            }
            return initPromise;
        },

        async bestMove(fen, options = {}) {
            await this.init();

            const myGen = ++generation;
            const elo = Math.max(1320, Math.min(3190, options.elo || 1600));
            const movetimeMs = options.movetimeMs || 1000;

            const cmds = [
                'setoption name UCI_LimitStrength value true',
                'setoption name UCI_Elo value ' + elo,
                'ucinewgame',
                'position fen ' + fen,
                'go movetime ' + movetimeMs
            ];

            return runSearch(myGen, cmds, function(line, ctl) {
                if (line.startsWith('bestmove')) {
                    ctl.resolve(parseBestMove(line));
                }
            }, movetimeMs + searchMarginMs);
        },

        async evaluate(fen, options = {}) {
            await this.init();

            const myGen = ++generation;
            const depth = options.depth || 12;
            const sideToMove = getSideToMove(fen);
            let lastInfo = null;

            const cmds = [
                'setoption name UCI_LimitStrength value false',
                'setoption name MultiPV value 1',
                'position fen ' + fen,
                'go depth ' + depth
            ];

            return runSearch(myGen, cmds, function(line, ctl) {
                if (line.startsWith('info') && line.includes(' pv ')) {
                    lastInfo = parseInfoLine(line);
                } else if (line.startsWith('bestmove') && lastInfo) {
                    const normalized = normalizeScore(lastInfo, sideToMove);
                    ctl.resolve({
                        scoreCp: normalized.scoreCp,
                        mate: normalized.mate,
                        bestLineUci: lastInfo.pvUci || [],
                        depth: lastInfo.depth || depth
                    });
                }
            }, evalTimeoutMs);
        },

        stop() {
            // Settle any pending request (so awaiters don't hang), then advance
            // the generation so late lines / timeouts from it become no-ops.
            if (currentRequest && currentRequest.reject) {
                currentRequest.reject(new Error('Engine stopped'));
            }
            generation += 1;
            if (worker) sendCommand('stop');
            currentRequest = null;
        },

        // Export parsers + timeout setter for testing
        _test: {
            parseBestMove,
            parseInfoLine,
            normalizeScore,
            setTimeouts: function(opts) {
                if (opts.initTimeoutMs != null) initTimeoutMs = opts.initTimeoutMs;
                if (opts.searchMarginMs != null) searchMarginMs = opts.searchMarginMs;
                if (opts.evalTimeoutMs != null) evalTimeoutMs = opts.evalTimeoutMs;
            },
            reset: function() { worker = null; initPromise = null; generation = 0; currentRequest = null; }
        }
    };

    // CommonJS export shim for Node testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            parseBestMove,
            parseInfoLine,
            normalizeScore
        };
    }
})();
