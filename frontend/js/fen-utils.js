/**
 * FEN utilities — the single home for reasoning about FEN strings: normalizing,
 * reading/forcing side-to-move, sanitizing/completing partial FENs, and loading
 * a chess.js instance from a possibly-incomplete board.
 *
 * Consolidated here so the play loop (play.js), the analysis board (board.js),
 * and the Lichess/engine handoff (engine-games-ui.js) all share ONE
 * implementation instead of the drifting copies they had before. These are pure
 * (no DOM, no app state); the only external dependency is the global `Chess`
 * (chess.js), used solely by loadChessFromBoardFen at call time.
 */
(function () {
    'use strict';

    function normalizeFen(fen) {
        return (fen || '').trim().replace(/\s+/g, ' ');
    }

    // FEN field 2 as the raw token ('w' | 'b'); defaults to 'w'.
    function getSideToMove(fen) {
        return normalizeFen(fen).split(' ')[1] === 'b' ? 'b' : 'w';
    }

    // Side-to-move expressed as a color word ('white' | 'black').
    function getSideToMoveColor(fen) {
        return getSideToMove(fen) === 'b' ? 'black' : 'white';
    }

    // Board orientation ('white' | 'black') → side-to-move token ('w' | 'b').
    function sideFromOrientation(orientation) {
        return orientation === 'black' ? 'b' : 'w';
    }

    // Map each occupied square (e.g. "e1") to its piece char, from a board field.
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

    // Keep only castling rights actually supported by the piece placement.
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

    function sanitizeEnPassant(ep) {
        return /^[a-h][36]$/.test(ep || '') ? ep : '-';
    }

    // Complete a (possibly partial) FEN to a sane 6-field FEN, dropping castling/
    // en-passant state that the placement can't support. Preserves the board and
    // a valid side-to-move; defaults the rest.
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

    // Force the side-to-move field, completing a partial FEN to 6 fields. Used by
    // the detail "Play"/"Lichess" handoff, where the board orientation the user is
    // looking at — not a possibly-stale FEN token — decides whose move it is.
    function forceFenSideToMove(fen, color) {
        const parts = normalizeFen(fen).split(' ');
        if (!parts[0]) return fen;
        while (parts.length < 6) {
            parts.push(parts.length === 1 ? 'w' : parts.length === 2 ? '-' : parts.length === 3 ? '-' : parts.length === 4 ? '0' : '1');
        }
        parts[1] = color === 'black' ? 'b' : 'w';
        return parts.slice(0, 6).join(' ');
    }

    // Load a chess.js instance from a board that may be board-only or otherwise
    // incomplete (common for imported/OCR'd diagrams, which chess.js can't load
    // as a bare placement). Completes it — side-to-move from the board
    // orientation, neutral castling/ep — trying the oriented side first then the
    // opposite. Returns a Chess instance, or null if nothing legal loads.
    function loadChessFromBoardFen(rawFen, flipped) {
        const fen = normalizeFen(rawFen);
        if (!fen) return null;
        const board = fen.split(' ')[0];
        const givenSide = fen.split(' ')[1];
        const orientedSide = flipped ? 'b' : 'w';
        const primarySide = (givenSide === 'b' || givenSide === 'w') ? givenSide : orientedSide;
        const candidates = [
            fen,
            board + ' ' + primarySide + ' - - 0 1',
            board + ' ' + (primarySide === 'w' ? 'b' : 'w') + ' - - 0 1'
        ];
        for (let i = 0; i < candidates.length; i++) {
            try {
                const chess = new Chess();
                if (chess.load(candidates[i])) return chess;
            } catch (e) { /* try next candidate */ }
        }
        return null;
    }

    // Turn a saved/arbitrary FEN into one chess.js will actually play. Many saved
    // diagrams display fine in cm-chessboard but carry stale castling/en-passant
    // metadata that makes chess.js reject the whole FEN; we first try the
    // sanitized form, then a last-resort scrub (board + side-to-move only).
    // Returns { ok, fen, game?, originalFen, attempts } — `game` is a loaded
    // Chess instance when ok. Requires the global `Chess`.
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

    const FenUtils = {
        normalizeFen,
        getSideToMove,
        getSideToMoveColor,
        sideFromOrientation,
        fenPieceMap,
        sanitizeCastlingRights,
        sanitizeEnPassant,
        completeAndSanitizeFen,
        forceFenSideToMove,
        loadChessFromBoardFen,
        preparePlayableFen
    };

    if (typeof window !== 'undefined') window.FenUtils = FenUtils;
    if (typeof module !== 'undefined' && module.exports) module.exports = FenUtils;
})();
