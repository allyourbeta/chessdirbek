function loadRandomCategoryFeatured() {
    if (!AppState.currentCategory || !AppState.allPositions.length) return;
    
    const pick = AppState.allPositions[Math.floor(Math.random() * AppState.allPositions.length)];
    AppState.featuredCategoryId = pick.id;
    
    BoardManager.create('cat-featured-board', pick.fen, {
        flipped: pick.orientation === 'black',
        mode: 'analysis',
        onPositionChange: function(newFen) {
            EngineUI.setPosition(newFen);
        },
    });
    EngineUI.mount('cat-featured-engine');
    EngineUI.setPosition(pick.fen);
    document.getElementById('cat-featured-title').textContent = pick.title || 'Untitled';
    document.getElementById('cat-featured-tags').innerHTML =
        pick.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('cat-featured-title').onclick = function() {
        showDetail(pick.id);
    };
    document.getElementById('cat-featured-title').style.cursor = 'pointer';
    renderCategoryList(AppState.currentCategory);
}

function loadCategoryFeaturedById(id) {
    const pos = AppState.allPositions.find(function(p) {
        return p.id === id;
    });
    if (!pos) {
        // Fall back to random if the requested position isn't in the list
        // (e.g. tag filter excludes it, or it was deleted between save and render)
        loadRandomCategoryFeatured();
        return;
    }
    AppState.featuredCategoryId = pos.id;
    BoardManager.create('cat-featured-board', pos.fen, {
        flipped: pos.orientation === 'black',
        mode: 'analysis',
        onPositionChange: function(newFen) {
            EngineUI.setPosition(newFen);
        },
    });
    EngineUI.mount('cat-featured-engine');
    EngineUI.setPosition(pos.fen);
    document.getElementById('cat-featured-title').textContent = pos.title || 'Untitled';
    document.getElementById('cat-featured-tags').innerHTML =
        pos.tags.map(function(t) { return '<span class="tag">#' + t.name + '</span>'; }).join('');
    document.getElementById('cat-featured-title').onclick = function() {
        showDetail(pos.id);
    };
    document.getElementById('cat-featured-title').style.cursor = 'pointer';
    renderCategoryList(AppState.currentCategory);
}

function flipCategoryFeaturedBoard() {
    BoardManager.flip('cat-featured-board');
}

function shuffleCategoryFeatured() {
    loadRandomCategoryFeatured();
}

function editFeaturedPosition() {
    const id = AppState.featuredCategoryId;
    if (!id) return;
    // Reuse the existing editPosition flow: set the detail ID, call editPosition
    AppState.currentDetailId = id;
    editPosition();
}

async function deleteFeaturedPosition() {
    const id = AppState.featuredCategoryId;
    if (!id || !confirm('Delete this position?')) return;
    const res = await fetch(API + '/positions/' + id, { method: 'DELETE' });
    if (res.ok) {
        toast('Position deleted');
        if (AppState.currentCategory) {
            loadCategoryPositions(AppState.currentCategory).then(function() { 
                loadRandomCategoryFeatured(); 
            });
        }
    }
}

function forkCategoryFeatured() {
    const id = AppState.featuredCategoryId;
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

// Legacy functions for backward compatibility
function loadRandomFeatured() {
    if (AppState.currentCategory === 'tactics') {
        loadRandomCategoryFeatured();
    }
}

function loadFeaturedById(id) {
    if (AppState.currentCategory === 'tactics') {
        loadCategoryFeaturedById(id);
    }
}

function flipFeaturedBoard() {
    flipCategoryFeaturedBoard();
}

function loadRandomFeaturedTabiya() {
    if (AppState.currentCategory === 'tabiya') {
        loadRandomCategoryFeatured();
    }
}

function flipFeaturedTabiyaBoard() {
    flipCategoryFeaturedBoard();
}

function loadFeaturedTabiyaById(id) {
    if (AppState.currentCategory === 'tabiya') {
        loadCategoryFeaturedById(id);
    }
}

window.loadRandomCategoryFeatured = loadRandomCategoryFeatured;
window.loadCategoryFeaturedById = loadCategoryFeaturedById;
window.flipCategoryFeaturedBoard = flipCategoryFeaturedBoard;
window.shuffleCategoryFeatured = shuffleCategoryFeatured;
window.forkCategoryFeatured = forkCategoryFeatured;
window.editFeaturedPosition = editFeaturedPosition;
window.deleteFeaturedPosition = deleteFeaturedPosition;

// Keep legacy functions for backward compatibility
window.loadRandomFeatured = loadRandomFeatured;
window.loadFeaturedById = loadFeaturedById;
window.flipFeaturedBoard = flipFeaturedBoard;
window.loadRandomFeaturedTabiya = loadRandomFeaturedTabiya;
window.flipFeaturedTabiyaBoard = flipFeaturedTabiyaBoard;
window.loadFeaturedTabiyaById = loadFeaturedTabiyaById;