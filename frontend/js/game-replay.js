/**
 * Game replay controller with live evaluation.
 * Uses MoveNavigator for history, requests eval via Engine.evaluate().
 * §5.3 of PLAY-AND-REVIEW-SPEC.md
 */
window.GameReplay = (function() {
    'use strict';
    
    let currentGame = null;
    let fens = [];
    let moveNavigator = null;
    let boardManager = null;
    let currentPly = 0;
    
    async function open(gameId) {
        try {
            // Fetch the game
            const game = await ApiClient.get(`/engine-games/${gameId}`);
            currentGame = game;
            
            // Reconstruct FENs at each ply
            fens = [game.start_fen];
            const chess = new Chess(game.start_fen);
            const moves = game.moves_san.split(' ').filter(m => m);
            
            for (const san of moves) {
                const move = chess.move(san);
                if (move) {
                    fens.push(chess.fen());
                } else {
                    console.error('Invalid SAN move during replay:', san);
                    break;
                }
            }
            
            // Set up the board
            const boardEl = document.getElementById('replay-board');
            if (boardEl) {
                // SAFE_INNER_HTML: Clearing element before board creation
                boardEl.innerHTML = '';
            }
            
            const flipped = game.user_color === 'black';
            boardManager = BoardManager.create('replay-board', game.start_fen, {
                mode: 'view',
                flipped: flipped
            });
            
            // Set up move navigator
            moveNavigator = MoveNavigator.create('replay-nav', {
                fens: fens,
                startIndex: 0,
                boardId: 'replay-board',
                containerId: 'replay-move-nav',
                keyScope: 'view-replay',
                onNavigate: (fen, index) => onStep(fen, index)
            });
            
            // Render move list
            renderMoveList(moves);
            
            // Initial evaluation
            onStep(fens[0], 0);
            
        } catch (error) {
            console.error('Failed to load game:', error);
            toast('Failed to load game', 'error');
        }
    }
    
    async function onStep(fen, plyIndex) {
        currentPly = plyIndex;
        
        // Update FEN label if exists
        const fenLabel = document.getElementById('replay-fen');
        if (fenLabel) {
            fenLabel.textContent = fen;
        }
        
        // Highlight current move in move list
        highlightCurrentMove(plyIndex);
        
        // Request evaluation
        try {
            const evalResult = await Engine.evaluate(fen, { depth: 12 });
            
            // Render eval bar
            EvalBar.render('replay-eval', evalResult);
            
            // Render best line in SAN
            if (evalResult.bestLineUci && evalResult.bestLineUci.length > 0) {
                const bestLineSan = convertUciLineToSan(fen, evalResult.bestLineUci);
                const bestLineEl = document.getElementById('replay-bestline');
                if (bestLineEl) {
                    bestLineEl.textContent = 'Best: ' + bestLineSan.join(' ');
                }
            } else {
                const bestLineEl = document.getElementById('replay-bestline');
                if (bestLineEl) {
                    bestLineEl.textContent = '';
                }
            }
        } catch (error) {
            console.error('Evaluation error:', error);
            EvalBar.clear('replay-eval');
        }
    }
    
    function convertUciLineToSan(startFen, uciMoves) {
        const chess = new Chess(startFen);
        const sanMoves = [];
        
        for (const uci of uciMoves) {
            // Convert UCI to move object
            const move = {
                from: uci.slice(0, 2),
                to: uci.slice(2, 4)
            };
            if (uci.length > 4) {
                move.promotion = uci[4];
            }
            
            // Try to make the move
            const result = chess.move(move);
            if (result) {
                sanMoves.push(result.san);
            } else {
                break; // Invalid move in line
            }
            
            // Limit display to 5 moves
            if (sanMoves.length >= 5) break;
        }
        
        return sanMoves;
    }
    
    function renderMoveList(moves) {
        const listEl = document.getElementById('replay-move-list');
        if (!listEl) return;
        
        if (moves.length === 0) {
            // SAFE_INNER_HTML: Static text
            listEl.innerHTML = '<span class="no-moves">No moves</span>';
            return;
        }
        
        const html = moves.map((move, i) => {
            const moveNum = Math.floor(i / 2) + 1;
            const prefix = i % 2 === 0 ? `${moveNum}.` : '';
            return `<span class="move" data-ply="${i + 1}">${prefix}${move}</span>`;
        }).join(' ');
        
        // SAFE_INNER_HTML: Controlled content from game moves
        listEl.innerHTML = html;
        
        // Add click handlers to jump to moves
        listEl.querySelectorAll('.move').forEach(el => {
            el.style.cursor = 'pointer';
            el.onclick = () => {
                const ply = parseInt(el.dataset.ply);
                if (moveNavigator && ply >= 0 && ply < fens.length) {
                    moveNavigator.goToIndex(ply);
                }
            };
        });
    }
    
    function highlightCurrentMove(plyIndex) {
        const listEl = document.getElementById('replay-move-list');
        if (!listEl) return;
        
        // Remove existing highlights
        listEl.querySelectorAll('.move').forEach(el => {
            el.style.background = '';
            el.style.color = '';
        });
        
        // Highlight current move
        if (plyIndex > 0) {
            const currentMoveEl = listEl.querySelector(`[data-ply="${plyIndex}"]`);
            if (currentMoveEl) {
                currentMoveEl.style.background = 'var(--primary-100)';
                currentMoveEl.style.color = 'var(--primary-700)';
            }
        }
    }
    
    function close() {
        if (moveNavigator) {
            MoveNavigator.destroy('replay-nav');
            moveNavigator = null;
        }
        if (boardManager) {
            BoardManager.destroy('replay-board');
            boardManager = null;
        }
        Engine.stop();
        currentGame = null;
        fens = [];
    }
    
    function getCurrentFen() {
        return fens[currentPly] || null;
    }
    
    // Public API
    return {
        open,
        close,
        getCurrentFen
    };
})();