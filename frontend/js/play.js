/**
 * Play mode controller - manages games against the chess engine.
 * Owns one chess.js instance per game, delegates to BoardManager for display.
 * §5.2 of PLAY-AND-REVIEW-SPEC.md
 */
window.PlayMode = (function() {
    'use strict';
    
    let game = null;
    let boardManager = null;
    let positionId = null;
    let startFen = null;
    let userColor = null;
    let engineElo = null;
    let thinking = false;
    
    async function start(options) {
        // Initialize game state
        positionId = options.positionId;
        startFen = options.startFen;
        userColor = options.userColor;
        engineElo = options.engineElo;
        
        // Create new chess.js instance
        game = new Chess(startFen);
        if (!game) {
            Notifications.show('Invalid FEN position', 'error');
            Navigation.back();
            return;
        }
        
        // Set up the board
        const boardEl = document.getElementById('play-board');
        // SAFE_INNER_HTML: Clearing element before board creation
        boardEl.innerHTML = '';
        
        boardManager = BoardManager.create('play-board', startFen, {
            mode: 'play',
            flipped: userColor === 'black',
            onMove: handleUserMove
        });
        
        // Initialize UI
        updateStatus();
        updateMoveList();
        
        // If engine plays first (user is black and white to move, or vice versa)
        const sideToMove = startFen.split(' ')[1] || 'w';
        const enginePlaysFirst = (userColor === 'black' && sideToMove === 'w') ||
                                (userColor === 'white' && sideToMove === 'b');
        
        if (enginePlaysFirst) {
            await engineReply();
        }
    }
    
    function handleUserMove(event) {
        if (thinking) return false; // Engine is thinking
        if (game.game_over()) return false;
        
        // Check if it's user's turn
        const turn = game.turn();
        if ((userColor === 'white' && turn === 'b') || 
            (userColor === 'black' && turn === 'w')) {
            return false;
        }
        
        // Build move object
        const move = {
            from: event.from,
            to: event.to
        };
        
        // Auto-queen promotion (same as analysis board)
        if (event.piece && event.piece.toLowerCase() === 'p') {
            const toRank = event.to[1];
            if (toRank === '8' || toRank === '1') {
                move.promotion = 'q';
            }
        }
        
        // Try the move
        const result = game.move(move);
        if (!result) {
            return false; // Invalid move, board snaps back
        }
        
        // Update display
        BoardManager.setPosition('play-board', game.fen());
        updateMoveList();
        updateStatus();
        
        // Check for game end
        if (game.game_over()) {
            finalize();
        } else {
            // Engine's turn
            engineReply();
        }
        
        return true;
    }
    
    async function engineReply() {
        // Guard: only if it's engine's turn and game not over
        const turn = game.turn();
        if ((userColor === 'white' && turn === 'w') || 
            (userColor === 'black' && turn === 'b')) {
            return;
        }
        if (game.game_over()) {
            return;
        }
        
        thinking = true;
        updateStatus();
        
        try {
            const response = await Engine.bestMove(game.fen(), { elo: engineElo });
            
            if (!response || !response.bestMove) {
                // Engine has no move (game is over)
                finalize();
                return;
            }
            
            // Convert UCI to chess.js format
            const uci = response.bestMove;
            const engineMove = {
                from: uci.slice(0, 2),
                to: uci.slice(2, 4)
            };
            if (uci.length > 4) {
                engineMove.promotion = uci[4];
            }
            
            // Make the move
            const result = game.move(engineMove);
            if (!result) {
                console.error('Engine gave invalid move:', uci);
                return;
            }
            
            // Update display
            BoardManager.setPosition('play-board', game.fen());
            updateMoveList();
            updateStatus();
            
            // Check for game end
            if (game.game_over()) {
                finalize();
            }
        } catch (error) {
            console.error('Engine error:', error);
            Notifications.show('Engine error', 'error');
        } finally {
            thinking = false;
            updateStatus();
        }
    }
    
    function resign() {
        if (!game || game.game_over()) return;
        
        // Determine result from user's perspective (loss)
        const result = userColor === 'white' ? '0-1' : '1-0';
        finalize({ result, outcome: 'resigned' });
    }
    
    async function finalize(overrides = {}) {
        const history = game.history();
        const moveCount = history.length;
        
        // Don't save empty games
        if (moveCount < 1) {
            Notifications.show('Game abandoned (no moves made)', 'info');
            return;
        }
        
        // Determine result and outcome
        let result = '*';
        let outcome = null;
        
        if (overrides.result) {
            result = overrides.result;
            outcome = overrides.outcome;
        } else if (game.in_checkmate()) {
            // Result: "1-0" if black is mated, "0-1" if white is mated
            result = game.turn() === 'b' ? '1-0' : '0-1';
            outcome = 'checkmate';
        } else if (game.in_stalemate()) {
            result = '1/2-1/2';
            outcome = 'stalemate';
        } else if (game.in_threefold_repetition()) {
            result = '1/2-1/2';
            outcome = 'threefold';
        } else if (game.insufficient_material()) {
            result = '1/2-1/2';
            outcome = 'insufficient';
        } else if (game.in_draw()) {
            result = '1/2-1/2';
            outcome = 'fifty-move';
        }
        
        // Save the game
        try {
            await ApiClient.post('/engine-games', {
                position_id: positionId,
                start_fen: startFen,
                moves_san: history.join(' '),
                user_color: userColor,
                engine_elo: engineElo,
                result: result,
                outcome: outcome,
                final_fen: game.fen(),
                move_count: moveCount
            });
            
            Notifications.show('Game saved', 'success');
            
            // Navigate back to detail view
            setTimeout(() => {
                Navigation.navigateToDetail(positionId);
            }, 1000);
        } catch (error) {
            console.error('Failed to save game:', error);
            Notifications.show('Failed to save game', 'error');
        }
    }
    
    function updateStatus() {
        const statusEl = document.getElementById('play-status');
        if (!statusEl) return;
        
        if (game.game_over()) {
            if (game.in_checkmate()) {
                const winner = game.turn() === 'b' ? 'White' : 'Black';
                statusEl.textContent = `Checkmate! ${winner} wins`;
            } else if (game.in_stalemate()) {
                statusEl.textContent = 'Stalemate!';
            } else if (game.in_draw()) {
                statusEl.textContent = 'Draw!';
            }
        } else if (thinking) {
            statusEl.textContent = 'Engine thinking…';
        } else {
            const turn = game.turn();
            const isUserTurn = (userColor === 'white' && turn === 'w') || 
                              (userColor === 'black' && turn === 'b');
            statusEl.textContent = isUserTurn ? 'Your move' : 'Engine thinking…';
        }
    }
    
    function updateMoveList() {
        const moveListEl = document.getElementById('play-move-list');
        if (!moveListEl) return;
        
        const history = game.history();
        const html = history.map((move, i) => {
            const moveNum = Math.floor(i / 2) + 1;
            const prefix = i % 2 === 0 ? `${moveNum}.` : '';
            return `<span class="move">${prefix}${move}</span>`;
        }).join(' ');
        
        // SAFE_INNER_HTML: Controlled content - move list from game.history() with escaped text
        moveListEl.innerHTML = html || '<span class="no-moves">No moves yet</span>';
    }
    
    function cleanup() {
        if (boardManager) {
            BoardManager.destroy('play-board');
            boardManager = null;
        }
        game = null;
        Engine.stop();
    }
    
    // Public API
    return {
        start,
        resign,
        cleanup
    };
})();