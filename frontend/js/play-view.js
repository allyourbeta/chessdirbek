/**
 * Play view rendering — pure DOM updates for the play-vs-engine screen.
 * Stateless: every function takes the current game/context as arguments and
 * writes only to the DOM. Game flow lives in play.js; this file never mutates
 * game state. Keeping presentation here keeps play.js focused on logic and both
 * files under the 300-line limit.
 */
window.PlayView = (function() {
    'use strict';

    // Maps engine Elo to the human label shown in the difficulty selector.
    const ELO_LABELS = {
        1320: 'Beginner',
        1600: 'Casual',
        2000: 'Intermediate',
        2400: 'Strong',
        3190: 'Maximum'
    };

    function eloLabel(elo) {
        return ELO_LABELS[elo] || ('~' + elo + ' Elo');
    }

    /** Render the "You: White / Engine: Casual" chip row. */
    function renderMeta(userColor, engineElo) {
        const metaEl = document.getElementById('play-meta');
        if (!metaEl) return;
        const colorLabel = userColor === 'white' ? '♔ White' : '♚ Black';
        // SAFE_INNER_HTML: Controlled content - fixed labels and a numeric Elo
        metaEl.innerHTML =
            '<span class="play-chip">You: <strong>' + colorLabel + '</strong></span>' +
            '<span class="play-chip">Engine: <strong>' + eloLabel(engineElo) + '</strong></span>';
    }

    /** Render the large status line (your move / thinking / result). */
    function renderStatus(game, userColor, thinking) {
        const statusEl = document.getElementById('play-status');
        if (!statusEl) return;
        statusEl.classList.remove('is-thinking', 'is-over');

        if (game.game_over()) {
            statusEl.classList.add('is-over');
            if (game.in_checkmate()) {
                const winner = game.turn() === 'b' ? 'White' : 'Black';
                const youWon = (winner.toLowerCase() === userColor);
                statusEl.textContent = 'Checkmate — ' + winner + ' wins' + (youWon ? ' 🎉' : '');
            } else if (game.in_stalemate()) {
                statusEl.textContent = 'Stalemate — draw';
            } else if (game.in_draw()) {
                statusEl.textContent = 'Draw';
            } else {
                statusEl.textContent = 'Game over';
            }
            return;
        }

        if (thinking) {
            statusEl.classList.add('is-thinking');
            statusEl.textContent = 'Engine thinking';
            return;
        }

        const turn = game.turn();
        const isUserTurn = (userColor === 'white' && turn === 'w') ||
                           (userColor === 'black' && turn === 'b');
        if (isUserTurn) {
            statusEl.textContent = 'Your move';
        } else {
            statusEl.classList.add('is-thinking');
            statusEl.textContent = 'Engine thinking';
        }
    }

    /** Render the running SAN move list. */
    function renderMoveList(game) {
        const moveListEl = document.getElementById('play-move-list');
        if (!moveListEl) return;
        const history = game.history();
        const html = history.map((move, i) => {
            const moveNum = Math.floor(i / 2) + 1;
            const prefix = i % 2 === 0 ? (moveNum + '.') : '';
            return '<span class="move">' + prefix + move + '</span>';
        }).join(' ');
        // SAFE_INNER_HTML: Controlled content - SAN moves from game.history()
        moveListEl.innerHTML = html || '<span class="no-moves">No moves yet</span>';
    }

    return { eloLabel, renderMeta, renderStatus, renderMoveList };
})();
