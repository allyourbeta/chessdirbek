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
        // info depth 12 ... score cp 34 ... pv e2e4 e7e5 ...
        // info depth 12 ... score mate -3 ... pv ...
        const depthMatch = line.match(/depth\s+(\d+)/);
        const depth = depthMatch ? parseInt(depthMatch[1]) : null;
        
        const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
        const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);
        
        const pvMatch = line.match(/pv\s+(.+?)(?:\s+upperbound|\s+lowerbound|$)/);
        const pvUci = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];
        
        return {
            depth,
            scoreCp: cpMatch ? parseInt(cpMatch[1]) : null,
            mate: mateMatch ? parseInt(mateMatch[1]) : null,
            pvUci
        };
    }

    function normalizeScore(score, sideToMove) {
        // UCI scores are from side to move POV; normalize to White's POV
        const isBlackToMove = sideToMove === 'b';
        
        if (score.scoreCp !== null) {
            return {
                scoreCp: isBlackToMove ? -score.scoreCp : score.scoreCp,
                mate: null
            };
        }
        
        if (score.mate !== null) {
            return {
                scoreCp: null,
                mate: isBlackToMove ? -score.mate : score.mate
            };
        }
        
        return { scoreCp: null, mate: null };
    }

    function getSideToMove(fen) {
        // FEN field 2 is 'w' or 'b'
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
            let uciReady = false;
            let readyOk = false;
            
            const timeout = setTimeout(() => {
                reject(new Error('Engine initialization timeout'));
            }, 10000);
            
            worker.onmessage = function(e) {
                const line = e.data;
                
                if (line === 'uciok') {
                    uciReady = true;
                    sendCommand('isready');
                } else if (line === 'readyok') {
                    readyOk = true;
                    clearTimeout(timeout);
                    resolve();
                }
                
                // Handle ongoing requests
                if (currentRequest) {
                    currentRequest.handleLine(line);
                }
            };
            
            worker.onerror = function(e) {
                clearTimeout(timeout);
                reject(new Error('Worker error: ' + e.message));
            };
            
            sendCommand('uci');
        });
    }

    // Public API
    window.Engine = {
        async init() {
            if (!initPromise) {
                initPromise = createWorker();
            }
            return initPromise;
        },

        async bestMove(fen, options = {}) {
            await this.init();
            
            const myGen = ++generation;
            const elo = Math.max(1320, Math.min(3190, options.elo || 1600));
            const movetimeMs = options.movetimeMs || 1000;
            
            return new Promise((resolve) => {
                // Stop any existing search
                if (currentRequest) {
                    sendCommand('stop');
                }
                
                currentRequest = {
                    generation: myGen,
                    handleLine(line) {
                        if (generation !== myGen) return; // Stale response
                        
                        if (line.startsWith('bestmove')) {
                            const result = parseBestMove(line);
                            currentRequest = null;
                            resolve(result);
                        }
                    }
                };
                
                // Configure for limited strength play
                sendCommand('setoption name UCI_LimitStrength value true');
                sendCommand(`setoption name UCI_Elo value ${elo}`);
                sendCommand('ucinewgame');
                sendCommand(`position fen ${fen}`);
                sendCommand(`go movetime ${movetimeMs}`);
            });
        },

        async evaluate(fen, options = {}) {
            await this.init();
            
            const myGen = ++generation;
            const depth = options.depth || 12;
            const sideToMove = getSideToMove(fen);
            
            return new Promise((resolve) => {
                // Stop any existing search
                if (currentRequest) {
                    sendCommand('stop');
                }
                
                let lastInfo = null;
                
                currentRequest = {
                    generation: myGen,
                    handleLine(line) {
                        if (generation !== myGen) return; // Stale response
                        
                        if (line.startsWith('info') && line.includes(' pv ')) {
                            lastInfo = parseInfoLine(line);
                        } else if (line.startsWith('bestmove') && lastInfo) {
                            const normalized = normalizeScore(lastInfo, sideToMove);
                            currentRequest = null;
                            resolve({
                                scoreCp: normalized.scoreCp,
                                mate: normalized.mate,
                                bestLineUci: lastInfo.pvUci || [],
                                depth: lastInfo.depth || depth
                            });
                        }
                    }
                };
                
                // Configure for full-strength eval
                sendCommand('setoption name UCI_LimitStrength value false');
                sendCommand('setoption name MultiPV value 1');
                sendCommand(`position fen ${fen}`);
                sendCommand(`go depth ${depth}`);
            });
        },

        stop() {
            if (worker) {
                sendCommand('stop');
                currentRequest = null;
            }
        },

        // Export parsers for testing
        _test: {
            parseBestMove,
            parseInfoLine,
            normalizeScore
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