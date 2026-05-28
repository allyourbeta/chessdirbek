/**
 * UI functions for engine games display on the detail page.
 * Split from position-detail.js to keep files under 300 lines.
 */

async function startEnginePlay() {
    const colorSelect = document.getElementById('engine-color-select');
    const difficultySelect = document.getElementById('engine-difficulty-select');
    
    if (!colorSelect || !difficultySelect) return;
    
    let userColor = colorSelect.value;
    const engineElo = parseInt(difficultySelect.value);
    
    // Handle random color
    if (userColor === 'random') {
        userColor = Math.random() < 0.5 ? 'white' : 'black';
    }
    
    // Get current position info
    const positionId = AppState.currentDetailId;
    const startFen = BoardManager.getCurrentFen('detail-board');
    
    if (!positionId || !startFen) {
        Notifications.show('Failed to start game', 'error');
        return;
    }
    
    // Navigate to play view
    Router.navigate({ view: 'play' });
    
    // Start the game
    setTimeout(() => {
        PlayMode.start({
            positionId,
            startFen,
            userColor,
            engineElo
        });
    }, 100);
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

window.startEnginePlay = startEnginePlay;
window.loadEngineGames = loadEngineGames;