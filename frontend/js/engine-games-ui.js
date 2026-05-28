/**
 * UI functions for engine games display on the detail page.
 * Split from position-detail.js to keep files under 300 lines.
 */

async function startEnginePlay() {
    const colorSelect = document.getElementById('engine-color-select');
    const difficultySelect = document.getElementById('engine-difficulty-select');
    
    if (!colorSelect || !difficultySelect) return;
    
    const selectedColor = colorSelect.value;
    const engineElo = parseInt(difficultySelect.value);
    const positionId = AppState.currentDetailId;
    // Use the FEN currently shown on the detail page. AppState.currentDetailFen
    // is the saved original and can be stale after navigation/analysis moves.
    const rawFen = getVisibleDetailFen();

    if (!positionId || !rawFen) {
        toast('Failed to start game', 'error');
        return;
    }

    const fenSideToMove = getSideToMoveFromFen(rawFen);
    const detailBoardOrientation = getVisibleDetailBoardOrientation();

    let userColor = selectedColor;
    let startSideToMove = fenSideToMove;

    if (userColor === 'side-to-move') {
        userColor = fenSideToMove;
        startSideToMove = fenSideToMove;
    } else if (userColor === 'random') {
        userColor = Math.random() < 0.5 ? 'white' : 'black';
        // For random color, preserve the FEN's own side-to-move. That means
        // the engine may move first if random gives the non-moving side.
        startSideToMove = fenSideToMove;
    } else if (userColor === 'white' || userColor === 'black') {
        // Explicit "Play as White/Black" in this app is used from diagrams whose
        // FEN side-to-move metadata is often stale. Make the selected side move
        // first instead of trusting the possibly wrong FEN token.
        startSideToMove = userColor;
    } else {
        userColor = fenSideToMove;
        startSideToMove = fenSideToMove;
    }

    // Critical: preserve the board orientation the user was looking at on the
    // detail page. Do NOT flip the play board merely because userColor is black;
    // many imported/saved diagrams already encode black-at-bottom in the piece
    // placement while the board orientation itself is still white-at-bottom.
    const startFen = forceFenSideToMove(rawFen, startSideToMove);

    const prepared = window.PlayMode && PlayMode.validateStartFen
        ? PlayMode.validateStartFen(startFen)
        : { ok: true, fen: startFen };
    if (!prepared.ok) {
        console.error('[startEnginePlay] Invalid FEN; not leaving detail view', {
            rawFen,
            startFen,
            fenSideToMove,
            startSideToMove,
            detailBoardOrientation,
            selectedColor,
            userColor,
            prepared
        });
        toast('Invalid FEN for playable game — staying on this position', 'error');
        return;
    }

    console.info('[startEnginePlay]', {
        positionId,
        rawFen,
        startFen: prepared.fen,
        fenSideToMove,
        startSideToMove,
        detailBoardOrientation,
        selectedColor,
        userColor,
        engineMovesFirst: userColor !== startSideToMove
    });
    
    Router.navigate({ view: 'play' });
    PlayMode.start({
        positionId,
        startFen: prepared.fen,
        userColor,
        engineElo,
        startSource: 'detail-visible-position',
        savedSideToMove: startSideToMove,
        boardOrientation: detailBoardOrientation
    });
}

function getSideToMoveFromFen(fen) {
    const side = (fen || '').trim().split(/\s+/)[1];
    return side === 'b' ? 'black' : 'white';
}

function getVisibleDetailFen() {
    const detailFenEl = document.getElementById('detail-fen');
    const textFen = detailFenEl && detailFenEl.textContent ? detailFenEl.textContent.trim() : '';
    return textFen || AppState.currentDetailFen;
}

function getVisibleDetailBoardOrientation() {
    if (window.BoardManager && typeof BoardManager.isFlipped === 'function') {
        const detailFen = BoardManager.getPosition && BoardManager.getPosition('detail-board');
        if (detailFen) {
            return BoardManager.isFlipped('detail-board') ? 'black' : 'white';
        }
    }
    return AppState.detailFlipped ? 'black' : 'white';
}


function getSavedSideToMoveColor(fen) {
    // Source of truth at click time: the actual detail board currently on screen.
    // This matters because the user can flip the detail board after loading, and
    // older saved rows can have stale/missing orientation metadata. The Play start
    // context must match what the user is looking at when they press Play.
    if (window.BoardManager && typeof BoardManager.isFlipped === 'function') {
        const detailFen = BoardManager.getPosition && BoardManager.getPosition('detail-board');
        if (detailFen) {
            return BoardManager.isFlipped('detail-board') ? 'black' : 'white';
        }
    }

    const orientation = AppState.currentDetailOrientation || (AppState.detailFlipped ? 'black' : 'white');
    if (orientation === 'black' || orientation === 'white') return orientation;
    return getSideToMoveFromFen(fen);
}

function forceFenSideToMove(fen, color) {
    const parts = (fen || '').trim().replace(/\s+/g, ' ').split(' ');
    if (!parts[0]) return fen;
    while (parts.length < 6) {
        parts.push(parts.length === 1 ? 'w' : parts.length === 2 ? '-' : parts.length === 3 ? '-' : parts.length === 4 ? '0' : '1');
    }
    parts[1] = color === 'black' ? 'b' : 'w';
    return parts.slice(0, 6).join(' ');
}

async function loadEngineGames(positionId) {
    try {
        const games = await ApiClient.get(`/positions/${positionId}/engine-games`);
        const listEl = document.getElementById('engine-games-list');
        
        if (!listEl) return;
        
        if (games.length === 0) {
            // SAFE_INNER_HTML: Static text content
            listEl.innerHTML = '<div class="text-muted" style="font-size:13px">No games yet</div>';
            return;
        }
        
        const html = games.map(game => {
            const date = new Date(game.created_at).toLocaleDateString();
            const eloLabel = {1320: 'Beginner', 1600: 'Casual', 2000: 'Intermediate', 2400: 'Strong', 3190: 'Maximum'}[game.engine_elo] || game.engine_elo;
            const moveText = game.move_count === 1 ? '1 move' : `${game.move_count} moves`;
            
            return `
                <div class="game-item" style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
                    <div style="flex:1">
                        <span style="font-size:13px">${date}</span>
                        <span style="margin:0 4px">·</span>
                        <span style="font-size:13px">${game.user_color}</span>
                        <span style="margin:0 4px">vs</span>
                        <span style="font-size:13px">${eloLabel}</span>
                        <span style="margin:0 4px">·</span>
                        <strong>${game.result}</strong>
                        <span style="margin:0 4px">·</span>
                        <span style="font-size:12px;color:var(--text-muted)">${moveText}</span>
                    </div>
                    <div style="display:flex;gap:4px">
                        <button class="btn btn-xs" data-action="engine-game-open" data-game-id="${game.id}">View</button>
                        <button class="btn btn-xs btn-danger" data-action="engine-game-delete" data-game-id="${game.id}">🗑</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // SAFE_INNER_HTML: Controlled content from API with escaped values
        listEl.innerHTML = html;
    } catch (error) {
        console.error('Failed to load engine games:', error);
    }
}

async function openEngineGame(gameId) {
    if (!gameId) return;
    
    // Navigate synchronously, then open immediately.
    Router.navigate({ view: 'replay' });
    GameReplay.open(gameId);
}

async function deleteEngineGame(gameId) {
    if (!gameId) return;
    
    if (!confirm('Delete this game?')) return;
    
    try {
        await ApiClient.delete(`/engine-games/${gameId}`);
        toast('Game deleted');
        
        // Refresh the list
        const positionId = AppState.currentDetailId;
        if (positionId) {
            loadEngineGames(positionId);
        }
    } catch (error) {
        console.error('Failed to delete game:', error);
        toast('Failed to delete game', 'error');
    }
}

window.startEnginePlay = startEnginePlay;
window.loadEngineGames = loadEngineGames;
window.openEngineGame = openEngineGame;
window.deleteEngineGame = deleteEngineGame;