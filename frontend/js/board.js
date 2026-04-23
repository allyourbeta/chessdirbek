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

function renderMiniBoard(fen) {
    const b = parseFenBoard(fen);
    let h = '<div class="mini-board">';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const l = (r + c) % 2 === 0;
        const p = b[r][c];
        const img = p ? `<img src="${PIECE_SVG[pieceKey(p)]}" style="position:absolute;width:100%;height:100%">` : '';
        h += `<div class="mini-sq ${l ? 'light' : 'dark'}">${img}</div>`;
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
        if (window.playMoveSound) playMoveSound();
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
        board.enableSquareSelect((event) => {
            callback(event.square);
        });
    },

    disableSquareSelect(elementId) {
        const board = this.boards[elementId];
        if (!board) return;
        board.disableSquareSelect();
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
};

window.parseFenBoard = parseFenBoard;
window.renderMiniBoard = renderMiniBoard;
window.BoardManager = BoardManager;
window.MARKER_TYPE = MARKER_TYPE;
window.ARROW_TYPE = ARROW_TYPE;

BoardManager.create('board', AppState.boardFen);
BoardManager.create('detail-board', AppState.boardFen);
setupAutoLoad();
setupKeyboardSave();
setupUrlParams();
setupPuzzleKeyboardShortcuts();
// Start the router: parse current URL and render the matching view.
Router.init();
