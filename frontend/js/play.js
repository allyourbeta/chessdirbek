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
    let ended = false;            // true once the game is concluded/resigned/ended
    let boardOrientation = null;  // remembered so "Play again" reuses the same view
    
    
    async function start(options) {
        // Starting a new game invalidates any pending engine reply from an older
        // play screen and clears the "thinking" lock that can otherwise make the
        // new board reject user moves.
        playSessionId += 1;
        const sessionId = playSessionId;
        thinking = false;
        ended = false;

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
        boardOrientation = options.boardOrientation || null;
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
        PlayView.showActions('active');
        
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
        if (ended) return false;
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
            concludeNatural();
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
                concludeNatural();
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
                concludeNatural();
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
    
    // --- Game conclusion -----------------------------------------------------
    // Three ways a game ends, all funnelling into a sticky "finished" panel
    // (no more auto-navigation): natural end (checkmate/draw), Resign (a loss),
    // and End game (user stops; result is then marked manually).

    function computeNaturalResult() {
        if (game.in_checkmate()) {
            // "1-0" if black is mated, "0-1" if white is mated.
            return { result: game.turn() === 'b' ? '1-0' : '0-1', outcome: 'checkmate' };
        }
        if (game.in_stalemate()) return { result: '1/2-1/2', outcome: 'stalemate' };
        if (game.in_threefold_repetition()) return { result: '1/2-1/2', outcome: 'threefold' };
        if (game.insufficient_material()) return { result: '1/2-1/2', outcome: 'insufficient' };
        if (game.in_draw()) return { result: '1/2-1/2', outcome: 'fifty-move' };
        return { result: '*', outcome: null };
    }

    async function saveGame(result, outcome) {
        if (!game) return false;
        const history = game.history();
        if (history.length < 1) return false; // never save an empty game
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
                move_count: history.length
            });
            return true;
        } catch (error) {
            console.error('Failed to save game:', error);
            toast('Failed to save game', 'error');
            return false;
        }
    }

    // Freeze the board and switch to a terminal panel. Stays on the play screen
    // so the user can study the final position and choose what to do next.
    function enterFinished(statusText) {
        ended = true;
        thinking = false;
        BoardManager.disableMoveInput('play-board');
        if (statusText) {
            PlayView.renderFinalStatus(statusText);
        } else {
            updateStatus(); // natural game_over → renderStatus shows the result
        }
        PlayView.showActions('finished');
    }

    async function concludeNatural() {
        if (!game || ended) return;
        ended = true;
        thinking = false;
        const { result, outcome } = computeNaturalResult();
        const saved = await saveGame(result, outcome);
        if (saved) toast('Game saved');
        enterFinished();
    }

    async function resign() {
        if (!game || game.game_over() || ended) return;
        const result = userColor === 'white' ? '0-1' : '1-0';
        const saved = await saveGame(result, 'resigned');
        if (saved) toast('Game saved');
        enterFinished('You resigned');
    }

    // User stops a game that isn't over. We don't save yet — we show the
    // result picker so they can mark it (or leave it unfinished).
    function endGame() {
        if (!game || ended) return;
        if (game.history().length < 1) {
            // Nothing was played; there's nothing to mark or save.
            backToDetail();
            return;
        }
        ended = true;
        thinking = false;
        BoardManager.disableMoveInput('play-board');
        PlayView.renderFinalStatus('Game ended — mark the result below');
        PlayView.showActions('mark');
    }

    // Called from the result-picker buttons after End game.
    async function markResult(kind) {
        if (!game) return;
        let result = '*';
        let outcome = 'unfinished';
        if (kind === 'win') {
            result = userColor === 'white' ? '1-0' : '0-1';
            outcome = 'manual';
        } else if (kind === 'loss') {
            result = userColor === 'white' ? '0-1' : '1-0';
            outcome = 'manual';
        } else if (kind === 'draw') {
            result = '1/2-1/2';
            outcome = 'manual';
        }
        const saved = await saveGame(result, outcome);
        if (saved) toast('Game saved');
        backToDetail();
    }

    function playAgain() {
        start({
            positionId: positionId,
            startFen: startFen,
            userColor: userColor,
            engineElo: engineElo,
            boardOrientation: boardOrientation
        });
    }

    function backToDetail() {
        const posType = (window.AppState && AppState.currentDetailType) || 'tabiya';
        Router.navigate({ view: 'positionDetail', id: positionId, positionType: posType });
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
        endGame,
        markResult,
        playAgain,
        cleanup,
        getCurrentFen: function() { return game ? game.fen() : null; },
        validateStartFen: function(fen) { return preparePlayableFen(fen); }
    };
})();