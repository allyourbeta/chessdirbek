async function startBatchReview(collectionId, collectionName) {
    try {
        const games = await ApiClient.get('/games/', { collection_id: collectionId });
        if (!games.length) { toast('No games in this collection', true); return; }
        AppState.batchMode = true;
        AppState.batchCollectionId = collectionId;
        AppState.batchCollectionName = collectionName;
        AppState.batchGameIds = games.map(g => g.id);
        AppState.batchIndex = 0;
        await openBatchGame();
    } catch (e) {
        toast('Error starting review', true);
    }
}

async function openBatchGame() {
    const id = AppState.batchGameIds[AppState.batchIndex];
    if (id == null) return;
    // Navigate updates URL + fires render. Then await loadGameDetail so the
    // batch nav update reflects the loaded game.
    const route = { view: 'gameDetail', id };
    history.pushState(route, '', Router.build(route));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-game-viewer').classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => {
        if (b.textContent === 'Games') b.classList.add('active');
    });
    await loadGameDetail(id);
    updateBatchNav();
}

function updateBatchNav() {
    const nav = document.getElementById('batch-nav');
    const prog = document.getElementById('batch-progress');
    if (!nav) return;
    if (AppState.batchMode) {
        nav.style.display = 'flex';
        const total = AppState.batchGameIds.length;
        const cur = AppState.batchIndex + 1;
        const name = AppState.batchCollectionName ? ' — ' + AppState.batchCollectionName : '';
        prog.textContent = 'Game ' + cur + ' of ' + total + name;
    } else {
        nav.style.display = 'none';
    }
}

function batchNextGame() {
    if (!AppState.batchMode) return;
    if (AppState.batchIndex >= AppState.batchGameIds.length - 1) {
        toast('Last game in collection');
        return;
    }
    AppState.batchIndex++;
    openBatchGame();
}

function batchPrevGame() {
    if (!AppState.batchMode) return;
    if (AppState.batchIndex <= 0) {
        toast('First game in collection');
        return;
    }
    AppState.batchIndex--;
    openBatchGame();
}

function exitBatchMode() {
    AppState.batchMode = false;
    AppState.batchCollectionId = null;
    AppState.batchCollectionName = null;
    AppState.batchGameIds = [];
    AppState.batchIndex = 0;
    updateBatchNav();
    Router.navigate({ view: 'collections' });
}

function setupBatchKeys() {
    document.addEventListener('keydown', e => {
        if (!AppState.batchMode) return;
        const gv = document.getElementById('view-game-viewer');
        if (!gv || !gv.classList.contains('active')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!e.shiftKey) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); batchPrevGame(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); batchNextGame(); }
    });
}

setupBatchKeys();

window.startBatchReview = startBatchReview;
window.batchNextGame = batchNextGame;
window.batchPrevGame = batchPrevGame;
window.exitBatchMode = exitBatchMode;
window.updateBatchNav = updateBatchNav;
