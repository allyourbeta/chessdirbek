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
    let playSessionId = 0;
    
    
    async function start(options) {
        // Starting a new game invalidates any pending engine reply from an older
        // play screen and clears the "thinking" lock that can otherwise make the
        // new board reject user moves.
        playSessionId += 1;
        const sessionId = playSessionId;
        thinking = false;

        // Initialize game state. Normalize the saved FEN into a form chess.js
        // can actually play. Several saved positions are arbitrary diagrams; they
        // display fine in cm-chessboard, but their FEN metadata can contain stale
        // castling/en-passant fields that make chess.js reject the whole FEN.
        const prepared = preparePlayableFen(options.startFen);
        if (!prepared.ok) {
            console.error('[PlayMode.start] Refusing to start invalid FEN', prepared);
            toast('Invalid FEN position — staying on the selected position', 'error');
            game = null;
            return;
        }

        positionId = options.positionId;
        startFen = prepared.fen;
        userColor = normalizeUserColor(options.userColor, startFen);
        engineElo = options.engineElo;
        game = prepared.game;

        if (window.console && console.info) {
            console.info('[PlayMode.start]', {
                positionId,
                originalFen: prepared.originalFen,
                startFen,
                loadedFen: game.fen(),
                userColor,
                turn: game.turn(),
                legalMoves: game.moves().length,
                gameOver: game.game_over(),
                stalemate: game.in_stalemate()
            });
        }
        
        // Set up the board
        const boardEl = document.getElementById('play-board');
        // SAFE_INNER_HTML: Clearing element before board creation
        boardEl.innerHTML = '';
        
        boardManager = BoardManager.create('play-board', startFen, {
            mode: 'play',
            // In Play mode, the user's color must be the side at the bottom.
            // Do not infer this from stale saved-position metadata or route state.
            flipped: (options.boardOrientation || userColor) === 'black',
            inputColor: userColor,
            onMove: handleUserMove
        });
        
        // Initialize UI
        updateMeta();
        updateStatus();
        updateMoveList();
        
        // If engine plays first (user is black and white to move, or vice versa)
        const sideToMove = startFen.split(' ')[1] || 'w';
        const enginePlaysFirst = (userColor === 'black' && sideToMove === 'w') ||
                                (userColor === 'white' && sideToMove === 'b');
        
        if (enginePlaysFirst && sessionId === playSessionId) {
            await engineReply(sessionId);
        }
    }
    
    function handleUserMove(event) {
        if (!game) return false;
        if (thinking) return false; // Engine is thinking
        if (game.game_over()) return false;
        
        // Check if it's user's turn
        const turn = game.turn();
        if ((userColor === 'white' && turn === 'b') || 
            (userColor === 'black' && turn === 'w')) {
            return false;
        }
        
        // cm-chessboard provides squareFrom / squareTo on the validate event.
        const from = event.squareFrom;
        const to = event.squareTo;
        const move = { from: from, to: to };
        
        // Auto-queen promotion: detect a pawn reaching the last rank using the
        // game's own piece data (same approach as the analysis board).
        const piece = game.get(from);
        if (piece && piece.type === 'p' && (to[1] === '8' || to[1] === '1')) {
            move.promotion = 'q';
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
            engineReply(playSessionId);
        }
        
        return true;
    }
    
    async function engineReply(sessionId) {
        sessionId = sessionId || playSessionId;
        if (!game || sessionId !== playSessionId) return;

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
            if (sessionId !== playSessionId || !game) return;
            
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
            if (sessionId !== playSessionId) return;
            console.error('Engine error:', error);
            toast('Engine error', 'error');
        } finally {
            if (sessionId === playSessionId) {
                thinking = false;
                updateStatus();
            }
        }
    }

    function normalizeFen(fen) {
        return (fen || '').trim().replace(/\s+/g, ' ');
    }

    function normalizeUserColor(color, fen) {
        if (color === 'white' || color === 'black') return color;
        const side = normalizeFen(fen).split(' ')[1];
        return side === 'b' ? 'black' : 'white';
    }


    function preparePlayableFen(rawFen) {
        const originalFen = normalizeFen(rawFen);
        const normalizedFen = completeAndSanitizeFen(originalFen);
        const attempts = [];

        function tryLoad(label, fen) {
            const chess = new Chess();
            let loaded = false;
            try {
                loaded = !!(fen && chess.load(fen));
            } catch (error) {
                attempts.push({ label, fen, ok: false, error: String(error) });
                return null;
            }
            attempts.push({ label, fen, ok: loaded });
            return loaded ? chess : null;
        }

        let chess = tryLoad('sanitized', normalizedFen);
        if (chess) {
            return { ok: true, fen: normalizedFen, game: chess, originalFen, attempts };
        }

        // Last-resort metadata scrub: keep the board and side-to-move, but remove
        // optional state that is often wrong in hand-entered / editor-created diagrams.
        const parts = normalizedFen.split(' ');
        const scrubbedFen = [parts[0], parts[1] || 'w', '-', '-', '0', parts[5] || '1'].join(' ');
        chess = tryLoad('scrubbed', scrubbedFen);
        if (chess) {
            return { ok: true, fen: scrubbedFen, game: chess, originalFen, attempts };
        }

        return { ok: false, fen: normalizedFen, originalFen, attempts };
    }

    function completeAndSanitizeFen(fen) {
        const parts = normalizeFen(fen).split(' ');
        const board = parts[0] || '';
        const turn = parts[1] === 'b' ? 'b' : 'w';
        const requestedCastling = parts[2] && parts[2] !== '-' ? parts[2] : '-';
        const castling = sanitizeCastlingRights(board, requestedCastling);
        const ep = sanitizeEnPassant(parts[3]);
        const halfmove = /^\d+$/.test(parts[4] || '') ? parts[4] : '0';
        const fullmove = /^[1-9]\d*$/.test(parts[5] || '') ? parts[5] : '1';
        return [board, turn, castling, ep, halfmove, fullmove].join(' ');
    }

    function sanitizeCastlingRights(board, requested) {
        if (!requested || requested === '-') return '-';
        const pieces = fenPieceMap(board);
        let rights = '';
        if (requested.includes('K') && pieces.e1 === 'K' && pieces.h1 === 'R') rights += 'K';
        if (requested.includes('Q') && pieces.e1 === 'K' && pieces.a1 === 'R') rights += 'Q';
        if (requested.includes('k') && pieces.e8 === 'k' && pieces.h8 === 'r') rights += 'k';
        if (requested.includes('q') && pieces.e8 === 'k' && pieces.a8 === 'r') rights += 'q';
        return rights || '-';
    }

    function fenPieceMap(board) {
        const map = {};
        const rows = (board || '').split('/');
        for (let r = 0; r < rows.length; r += 1) {
            let fileIndex = 0;
            const rank = 8 - r;
            for (const ch of rows[r]) {
                if (/[1-8]/.test(ch)) {
                    fileIndex += Number(ch);
                } else {
                    const file = 'abcdefgh'[fileIndex];
                    if (file) map[file + rank] = ch;
                    fileIndex += 1;
                }
            }
        }
        return map;
    }

    function sanitizeEnPassant(ep) {
        return /^[a-h][36]$/.test(ep || '') ? ep : '-';
    }
    
    function resign() {
        if (!game || game.game_over()) return;
        
        // Determine result from user's perspective (loss)
        const result = userColor === 'white' ? '0-1' : '1-0';
        finalize({ result, outcome: 'resigned' });
    }
    
    async function finalize(overrides = {}) {
        if (!game) return;
        thinking = false;
        const history = game.history();
        const moveCount = history.length;
        
        // Don't save empty games
        if (moveCount < 1) {
            toast('Game abandoned (no moves made)');
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
            
            toast('Game saved');
            
            // Navigate back to the position's detail view so the new game
            // appears in its Past Games list.
            const posType = (window.AppState && AppState.currentDetailType) || 'tabiya';
            setTimeout(() => {
                Router.navigate({ view: 'positionDetail', id: positionId, positionType: posType });
            }, 1000);
        } catch (error) {
            console.error('Failed to save game:', error);
            toast('Failed to save game', 'error');
        }
    }
    
    function updateMeta() {
        PlayView.renderMeta(userColor, engineElo);
    }

    function updateStatus() {
        if (!game) return;
        PlayView.renderStatus(game, userColor, thinking);
    }
    
    function updateMoveList() {
        if (!game) return;
        PlayView.renderMoveList(game);
    }
    
    function cleanup() {
        playSessionId += 1;
        thinking = false;
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
        cleanup,
        getCurrentFen: function() { return game ? game.fen() : null; },
        validateStartFen: function(fen) { return preparePlayableFen(fen); }
    };
})();