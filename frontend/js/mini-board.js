/**
 * Mini-board thumbnail renderer. Produces the small static board previews used
 * in position lists. Extracted from board.js (an ES module) into a classic
 * script so it sits alongside the other DOM helpers and can be called as a
 * page global. Depends on PIECE_SVG / pieceKey (piece-assets.js); prefers the
 * inlined SVG sprite sheet (#piece-sprites) and falls back to base64 images.
 */
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
            // SAFE_INNER_HTML: Reading SVG sprite content to check for piece availability
            const useSprite = p && spriteEl && spriteEl.innerHTML.includes(`id="${pid}"`);
            const img = p ? (useSprite 
                ? `<svg viewBox="0 0 45 45" style="position:absolute;width:100%;height:100%"><use href="#${pid}"/></svg>`
                : `<img src="${PIECE_SVG[pieceKey(p)]}" style="position:absolute;width:100%;height:100%">`) : '';
            h += `<div class="mini-sq ${l ? 'light' : 'dark'}">${img}</div>`;
        }
    }
    return h + '</div>';
}

window.parseFenBoard = parseFenBoard;
window.renderMiniBoard = renderMiniBoard;
