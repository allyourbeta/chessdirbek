function loadRandomFeatured() {
    var tactics = AppState.allPositions.filter(function(p) {
        return p.position_type === 'puzzle';
    });
    if (!tactics.length) return;
    var pick = tactics[Math.floor(Math.random() * tactics.length)];
    AppState.featuredTacticId = pick.id;
    BoardManager.create('tactics-featured-board', pick.fen, {
        flipped: pick.orientation === 'black',
        mode: 'analysis',
        onPositionChange: function(newFen) {
            EngineUI.setPosition(newFen);
        },
    });
    EngineUI.mount('tactics-featured-engine');
    EngineUI.setPosition(pick.fen);
    document.getElementById('tactics-featured-title').textContent = pick.title || 'Untitled';
    document.getElementById('tactics-featured-tags').innerHTML =
        pick.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tactics-featured-title').onclick = function() {
        showDetail(pick.id);
    };
    document.getElementById('tactics-featured-title').style.cursor = 'pointer';
    renderTacticsList();
}

function loadFeaturedById(id) {
    var pos = AppState.allPositions.find(function(p) {
        return p.id === id && p.position_type === 'puzzle';
    });
    if (!pos) {
        // Fall back to random if the requested position isn't in the list
        // (e.g. tag filter excludes it, or it was deleted between save and render)
        loadRandomFeatured();
        return;
    }
    AppState.featuredTacticId = pos.id;
    BoardManager.create('tactics-featured-board', pos.fen, {
        flipped: pos.orientation === 'black',
    });
    EngineUI.mount('tactics-featured-engine');
    EngineUI.setPosition(pos.fen);
    document.getElementById('tactics-featured-title').textContent = pos.title || 'Untitled';
    document.getElementById('tactics-featured-tags').innerHTML =
        pos.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tactics-featured-title').onclick = function() {
        showDetail(pos.id);
    };
    document.getElementById('tactics-featured-title').style.cursor = 'pointer';
    renderTacticsList();
}

function flipFeaturedBoard() {
    BoardManager.flip('tactics-featured-board');
}

function loadRandomFeaturedTabiya() {
    var tabiyas = AppState.allPositions.filter(function(p) {
        return p.position_type === 'tabiya';
    });
    if (!tabiyas.length) return;
    var pick = tabiyas[Math.floor(Math.random() * tabiyas.length)];
    AppState.featuredTabiyaId = pick.id;
    BoardManager.create('tabiyas-featured-board', pick.fen, {
        flipped: pick.orientation === 'black',
    });
    EngineUI.mount('tabiyas-featured-engine');
    EngineUI.setPosition(pick.fen);
    document.getElementById('tabiyas-featured-title').textContent = pick.title || 'Untitled';
    document.getElementById('tabiyas-featured-tags').innerHTML =
        pick.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tabiyas-featured-title').onclick = function() {
        showDetail(pick.id);
    };
    document.getElementById('tabiyas-featured-title').style.cursor = 'pointer';
    renderTabiyasList();
}

function flipFeaturedTabiyaBoard() {
    BoardManager.flip('tabiyas-featured-board');
}

function loadFeaturedTabiyaById(id) {
    var pos = AppState.allPositions.find(function(p) {
        return p.id === id && p.position_type === 'tabiya';
    });
    if (!pos) {
        // Fall back to random if the requested position isn't in the list
        // (e.g. tag filter excludes it, or it was deleted between save and render)
        loadRandomFeaturedTabiya();
        return;
    }
    AppState.featuredTabiyaId = pos.id;
    BoardManager.create('tabiyas-featured-board', pos.fen, {
        flipped: pos.orientation === 'black',
    });
    EngineUI.mount('tabiyas-featured-engine');
    EngineUI.setPosition(pos.fen);
    document.getElementById('tabiyas-featured-title').textContent = pos.title || 'Untitled';
    document.getElementById('tabiyas-featured-tags').innerHTML =
        pos.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('tabiyas-featured-title').onclick = function() {
        showDetail(pos.id);
    };
    document.getElementById('tabiyas-featured-title').style.cursor = 'pointer';
    renderTabiyasList();
}

function editFeaturedPosition(type) {
    var id = type === 'tactics' ? AppState.featuredTacticId : AppState.featuredTabiyaId;
    if (!id) return;
    // Reuse the existing editPosition flow: set the detail ID, call editPosition
    AppState.currentDetailId = id;
    editPosition();
}

async function deleteFeaturedPosition(type) {
    var id = type === 'tactics' ? AppState.featuredTacticId : AppState.featuredTabiyaId;
    if (!id || !confirm('Delete this position?')) return;
    var res = await fetch(API + '/positions/' + id, { method: 'DELETE' });
    if (res.ok) {
        toast('Position deleted');
        if (type === 'tactics') {
            loadTactics().then(function() { loadRandomFeatured(); });
        } else {
            loadTabiyas().then(function() { loadRandomFeaturedTabiya(); });
        }
    }
}

function forkFeaturedPosition(type) {
    var id = type === 'tactics' ? AppState.featuredTacticId : AppState.featuredTabiyaId;
    if (!id) return;
    fetch(API + '/positions/' + id).then(function(r) { return r.json(); }).then(function(pos) {
        // Pre-populate the form with data from the source position
        // but do NOT set edit-id — this creates a new position, not an edit.
        document.getElementById('edit-id').value = '';
        document.getElementById('fen-input').value = pos.fen;
        document.getElementById('pos-title').value = '';  // blank — will auto-generate on save
        window._formTagState.tags = pos.tags.map(function(t) { return t.name; });
        window._initFormTagFilter();
        document.getElementById('pos-notes').value = pos.notes || '';
        document.getElementById('pos-stockfish').value = pos.stockfish_analysis || '';
        document.getElementById('delete-btn').style.display = 'none';
        AppState.boardFen = pos.fen;
        AppState.addPositionType = pos.position_type || 'tabiya';

        Router.navigate({
            view: 'addPosition',
            params: { type: pos.position_type || 'tabiya' }
        });
        // These must come AFTER Router.navigate since renderRoute overwrites them
        BoardManager.create('board', AppState.boardFen, {
            mode: 'analysis',
            onPositionChange: function(newFen) {
                document.getElementById('fen-input').value = newFen;
                AppState.boardFen = newFen;
            },
        });
        if (typeof window._applyFormOrientation === 'function') {
            window._applyFormOrientation(pos.orientation || 'white');
        }
        document.getElementById('form-title').textContent =
            'Fork from ' + (pos.title || 'untitled');
    });
}

window.loadRandomFeatured = loadRandomFeatured;
window.loadFeaturedById = loadFeaturedById;
window.flipFeaturedBoard = flipFeaturedBoard;
window.loadRandomFeaturedTabiya = loadRandomFeaturedTabiya;
window.flipFeaturedTabiyaBoard = flipFeaturedTabiyaBoard;
window.loadFeaturedTabiyaById = loadFeaturedTabiyaById;
window.editFeaturedPosition = editFeaturedPosition;
window.deleteFeaturedPosition = deleteFeaturedPosition;
window.forkFeaturedPosition = forkFeaturedPosition;