import {Chessboard, COLOR, FEN, INPUT_EVENT_TYPE}
    from "https://cdn.jsdelivr.net/npm/cm-chessboard@8/src/Chessboard.js";
import {Markers, MARKER_TYPE}
    from "https://cdn.jsdelivr.net/npm/cm-chessboard@8/src/extensions/markers/Markers.js";
import {Arrows, ARROW_TYPE}
    from "https://cdn.jsdelivr.net/npm/cm-chessboard@8/src/extensions/arrows/Arrows.js";

const CM_ASSETS = "https://cdn.jsdelivr.net/npm/cm-chessboard@8/assets/";

function parseFenBoard(fen) {
    const rows = fen.split(' ')[0].split('/');
    const b = [];
    for (const row of rows) {
        const r = [];
        for (const ch of row) {
            if (ch >= '1' && ch <= '8') for (let i = 0; i < +ch; i++) r.push(null);
            else r.push(ch);
        }
        b.push(r);
    }
    return b;
}

function _playBoardSound() {
    if (window.playMoveSound) window.playMoveSound();
}

function renderMiniBoard(fen, orientation) {
    const b = parseFenBoard(fen);
    const flipped = orientation === 'black';
    let h = '<div class="mini-board">';
    // When flipped (Black on bottom), iterate rows bottom-up and columns right-to-left
    // so the visual ordering matches a board rotated 180°.
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const r = flipped ? 7 - i : i;
            const c = flipped ? 7 - j : j;
            const l = (r + c) % 2 === 0;
            const p = b[r][c];
            // Try to use SVG sprite first, fallback to base64 if sprite not loaded
            const pid = p ? pieceKey(p).toLowerCase() : '';
            const spriteEl = document.getElementById('piece-sprites');
            const useSprite = p && spriteEl && spriteEl.innerHTML.includes(`id="${pid}"`);
            const img = p ? (useSprite 
                ? `<svg viewBox="0 0 45 45" style="position:absolute;width:100%;height:100%"><use href="#${pid}"/></svg>`
                : `<img src="${PIECE_SVG[pieceKey(p)]}" style="position:absolute;width:100%;height:100%">`) : '';
            h += `<div class="mini-sq ${l ? 'light' : 'dark'}">${img}</div>`;
        }
    }
    return h + '</div>';
}

const BoardManager = {
    boards: {},

    create(elementId, fen, options = {}) {
        if (this.boards[elementId]) {
            this.boards[elementId].destroy();
        }
        const el = document.getElementById(elementId);
        if (!el) return;
        el.innerHTML = '';
        const orientation = options.flipped ? COLOR.black : COLOR.white;
        const board = new Chessboard(el, {
            position: fen,
            orientation: orientation,
            assetsUrl: CM_ASSETS,
            style: {
                cssClass: "default",
                showCoordinates: true,
                pieces: { file: "pieces/staunty.svg" },
                animationDuration: 200,
            },
            extensions: [
                { class: Markers },
                { class: Arrows },
            ],
        });
        this.boards[elementId] = board;
        this.boards[elementId]._fen = fen;
        this.boards[elementId]._flipped = options.flipped || false;

        if (options.mode === 'play' && options.onMove) {
            board.enableMoveInput((event) => {
                if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
                    return true;
                }
                if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
                    return options.onMove(event);
                }
            });
        }

        if (options.mode === 'analysis') {
            board._analysisHistory = [fen];
            board._analysisOrigin = fen;
            board._onPositionChange = options.onPositionChange || null;
            const self = this;
            board.enableMoveInput((event) => {
                if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
                    return true;
                }
                if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
                    const chess = new Chess(board._fen);
                    const from = event.squareFrom;
                    const to = event.squareTo;
                    let promotion = undefined;
                    const piece = chess.get(from);
                    if (piece && piece.type === 'p') {
                        const rank = to.charAt(1);
                        if (rank === '8' || rank === '1') promotion = 'q';
                    }
                    const move = chess.move({ from, to, promotion });
                    if (!move) return false;
                    const newFen = chess.fen();
                    board._fen = newFen;
                    board._analysisHistory.push(newFen);
                    board.setPosition(newFen, true);
                    _playBoardSound();
                    if (board._onPositionChange) board._onPositionChange(newFen);
                    return true;
                }
            });
        }
    },

    setPosition(elementId, fen) {
        const board = this.boards[elementId];
        if (!board) {
            this.create(elementId, fen);
            return;
        }
        board._fen = fen;
        board.setPosition(fen, true);
        _playBoardSound();
    },

    flip(elementId) {
        const board = this.boards[elementId];
        if (!board) return;
        board._flipped = !board._flipped;
        board.setOrientation(board._flipped ? COLOR.black : COLOR.white, true);
    },

    destroy(elementId) {
        const board = this.boards[elementId];
        if (board) {
            board.destroy();
            delete this.boards[elementId];
        }
    },

    getPosition(elementId) {
        const board = this.boards[elementId];
        return board ? board._fen : null;
    },

    isFlipped(elementId) {
        const board = this.boards[elementId];
        return board ? board._flipped : false;
    },

    addMarker(elementId, square, type) {
        const board = this.boards[elementId];
        if (board) board.addMarker(type || MARKER_TYPE.square, square);
    },

    removeMarkers(elementId) {
        const board = this.boards[elementId];
        if (board) board.removeMarkers();
    },

    addArrow(elementId, from, to) {
        const board = this.boards[elementId];
        if (board) board.addArrow(ARROW_TYPE.default, from, to);
    },

    removeArrows(elementId) {
        const board = this.boards[elementId];
        if (board) board.removeArrows();
    },

    enableSquareSelect(elementId, callback) {
        const board = this.boards[elementId];
        if (!board) return;
        const el = document.getElementById(elementId);
        if (!el) return;
        if (board._squareSelectHandler) el.removeEventListener('pointerdown', board._squareSelectHandler);
        board._squareSelectHandler = function (e) {
            const sqEl = e.target.closest('[data-square]');
            if (sqEl) callback(sqEl.getAttribute('data-square'));
        };
        el.addEventListener('pointerdown', board._squareSelectHandler);
    },

    disableSquareSelect(elementId) {
        const board = this.boards[elementId];
        if (!board) return;
        if (board._squareSelectHandler) {
            const el = document.getElementById(elementId);
            if (el) el.removeEventListener('pointerdown', board._squareSelectHandler);
            board._squareSelectHandler = null;
        }
    },

    disableMoveInput(elementId) {
        const board = this.boards[elementId];
        if (!board) return;
        board.disableMoveInput();
    },

    undoAnalysis(elementId) {
        const board = this.boards[elementId];
        if (!board || !board._analysisHistory || board._analysisHistory.length <= 1) return null;
        board._analysisHistory.pop();
        const fen = board._analysisHistory[board._analysisHistory.length - 1];
        board._fen = fen;
        board.setPosition(fen, true);
        if (board._onPositionChange) board._onPositionChange(fen);
        return fen;
    },

    resetAnalysis(elementId) {
        const board = this.boards[elementId];
        if (!board || !board._analysisOrigin) return null;
        const fen = board._analysisOrigin;
        board._analysisHistory = [fen];
        board._fen = fen;
        board.setPosition(fen, true);
        if (board._onPositionChange) board._onPositionChange(fen);
        return fen;
    },

    setAnalysisOrigin(elementId, fen) {
        const board = this.boards[elementId];
        if (!board) return;
        board._analysisOrigin = fen;
        board._analysisHistory = [fen];
    },

    // Shared helper to get current FEN from any active context
    getCurrentFen() {
        // Determine the active view/context and return the current FEN
        const activeView = document.querySelector('.view.active');
        if (!activeView) return null;

        const viewId = activeView.id;

        // Practice mode - use chess.js instance if available, otherwise MoveNavigator
        if (viewId === 'view-practice') {
            if (window.Practice && window.Practice.isActive()) {
                // Get from practice Chess.js instance via Practice module
                const playChess = window.Practice.getPlayChess && window.Practice.getPlayChess();
                if (playChess) return playChess.fen();
            }
            // Fall back to MoveNavigator for detail view
            return MoveNavigator.getFen('detail-nav') || AppState.currentDetailFen;
        }

        // Game viewer - use MoveNavigator
        if (viewId === 'view-game-viewer') {
            return MoveNavigator.getFen('game-nav') || this.getPosition('game-board');
        }

        // Practice game viewer
        if (viewId === 'view-practice-viewer') {
            return this.getPosition('pv-board');
        }

        // Board editor - get from editor's internal state
        if (viewId === 'view-editor') {
            if (window.BoardEditor && window.BoardEditor._getFen) {
                return window.BoardEditor._getFen();
            }
            return this.getPosition('editor-board');
        }

        // Position detail view
        if (viewId === 'view-detail') {
            return MoveNavigator.getFen('detail-nav') || AppState.currentDetailFen;
        }

        // Search view
        if (viewId === 'view-search') {
            return this.getPosition('search-board') || AppState.searchFen;
        }

        // Add position / category views - use form board
        if (viewId === 'view-add' || viewId === 'view-category') {
            return this.getPosition('board') || AppState.boardFen;
        }

        // Default fallback
        return AppState.boardFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    },

    // Update the displayed FEN element if it exists
    updateDisplayedFen() {
        const fen = this.getCurrentFen();
        const fenEl = document.getElementById('detail-fen');
        if (fenEl && fen) {
            fenEl.textContent = fen;
        }
    },
};

window.parseFenBoard = parseFenBoard;
window.renderMiniBoard = renderMiniBoard;
window.BoardManager = BoardManager;
window.MARKER_TYPE = MARKER_TYPE;
window.ARROW_TYPE = ARROW_TYPE;
