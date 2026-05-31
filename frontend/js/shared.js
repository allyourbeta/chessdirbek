const API = '/api';
function _activateView(viewId, navLabel) {
    // Cleanup previous view if needed
    const activeView = document.querySelector('.view.active');
    if (activeView) {
        const activeId = activeView.id;
        if (activeId === 'view-play' && window.PlayMode) {
            PlayMode.cleanup();
        } else if (activeId === 'view-replay' && window.GameReplay) {
            GameReplay.close();
        }
    }
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('view-' + viewId);
    if (el) el.classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    if (navLabel) {
        document.querySelectorAll('nav button').forEach(b => {
            if (b.textContent === navLabel) b.classList.add('active');
        });
    }
}
function _applyGameFilters(params) {
    const tags = Array.isArray(params.tags) ? params.tags.slice() : [];
    AppState.gameTagFilters = tags;
    AppState.gameCollectionFilter = params.collection_id ? params.collection_id : null;
    AppState.gameResultFilter = params.result || '';
    AppState.gameSearch = params.search || '';
    AppState.gamePage = params.page ? Math.max(0, parseInt(params.page, 10) || 0) : 0;
    const si = document.getElementById('game-search-input');
    if (si) si.value = AppState.gameSearch;
    const rf = document.getElementById('game-result-filter');
    if (rf) rf.value = AppState.gameResultFilter;
}
function _applyPositionFilters(params) {
    const tags = Array.isArray(params.tags) ? params.tags.slice() : [];
    AppState.positionTagFilters = tags;
}

function _focusFenInputForAddPosition() {
    const fenInput = document.getElementById('fen-input');
    if (!fenInput) return;
    // Wait until the add-position view is active and the board/layout work has settled.
    requestAnimationFrame(function() {
        fenInput.focus({ preventScroll: true });
    });
}

function renderRoute(route) {
    AnnotationPanel.unmount();
    // Clean up add form keyboard shortcut when leaving the add view
    if (typeof cleanupAddFormKeyboardShortcut === 'function') {
        cleanupAddFormKeyboardShortcut();
    }
    const params = (route && route.params) || {};
    switch (route.view) {
        case 'tactics':
        case 'tabiya':
        case 'endings':
        case 'strategy':
            _applyPositionFilters(params);
            var cat = CATEGORIES[route.view];
            AppState.currentCategory = route.view;
            _activateView('category', cat.label);
            // Set dynamic text content
            document.getElementById('cat-browse-title').textContent = cat.label;
            document.getElementById('cat-add-btn').textContent = '+ ' + cat.addLabel;
            document.getElementById('cat-add-btn').onclick = function() {
                Router.navigate({view:'addPosition', params:{type: cat.positionType}});
            };
            mountCategoryTagFilter(route.view);
            loadCategoryPositions(route.view).then(function() {
                var featuredId = params.featured ? parseInt(params.featured, 10) : null;
                if (featuredId && !isNaN(featuredId)) {
                    loadCategoryFeaturedById(featuredId);
                    Router.syncUrl({ view: route.view, params: {} });
                } else {
                    loadRandomCategoryFeatured();
                }
            });
            break;
        case 'positionDetail':
            _applyPositionFilters(params);
            var catKey = TYPE_TO_CATEGORY[route.positionType] || 'tabiya';
            var navLabel = CATEGORIES[catKey] ? CATEGORIES[catKey].label : 'Tabiya';
            _activateView('detail', navLabel);
            loadPositionDetail(route.id);
            break;
        case 'play':
            _activateView('play', 'Practice');
            // PlayMode.start is called by the action handler after navigation
            break;
        case 'replay':
            _activateView('replay', 'Game Replay');
            // GameReplay.open is called by the action handler after navigation
            break;
        case 'addPosition':
            _activateView('add', 'Add New');
            AppState.addPositionType = (route.params && route.params.type) || 'tabiya';
            // Find the matching category label for the form title
            var addCat = Object.values(CATEGORIES).find(c => c.positionType === AppState.addPositionType);
            document.getElementById('form-title').textContent = addCat ? addCat.addLabel : 'New Position';
            BoardManager.setPosition('board', AppState.boardFen);
            _initFormTagFilter();
            _focusFenInputForAddPosition();
            // Setup Cmd/Ctrl+Enter keyboard shortcut
            if (typeof setupAddFormKeyboardShortcut === 'function') {
                setupAddFormKeyboardShortcut();
            }
            break;
        case 'games':
            _applyGameFilters(params);
            _activateView('games', 'Games');
            mountGameTagFilter();
            _mountGameStarredFilter();
            loadGames();
            loadCollections();
            break;
        case 'gameDetail':
            _activateView('game-viewer', 'Games');
            loadGameDetail(route.id);
            break;
        case 'gameImport':
            _activateView('import', 'Games');
            loadCollections().then(resetImportView);
            break;
        case 'collections':
            _activateView('collections', 'Collections');
            loadCollectionsView();
            break;
        case 'collectionDetail':
            // Collection detail = games list filtered by collection id
            AppState.gameCollectionFilter = String(route.id);
            _activateView('games', 'Games');
            mountGameTagFilter();
            loadGames();
            loadCollections();
            break;
        case 'search':
            _activateView('search', 'Search');
            loadCollections().then(renderSearchScope);
            initSearchBoard();
            break;
        case 'bulkAdd':
            _activateView('bulk-add', null);
            BulkAdd.init(params);
            break;
        case 'editor':
            _activateView('editor', null);
            BoardEditor.init(params);
            break;
        case 'practice':
            _activateView('practice', 'Practice');
            Practice.loadPracticeTab();
            break;
        case 'practiceGameDetail':
            _activateView('practice-viewer', 'Practice');
            PracticeViewer._load(route.id);
            break;
        default:
            _activateView('tactics', 'Tactics');
            mountTacticsTagFilter();
            loadTactics().then(function() { loadRandomFeatured(); });
    }
}
const _LEGACY_VIEWS = {
    positions: { view: 'positions' },
    add: { view: 'addPosition' },
    games: { view: 'games' },
    collections: { view: 'collections' },
    search: { view: 'search' },
    practice: { view: 'practice' },
    import: { view: 'gameImport' },
};
function showView(name) {
    const route = _LEGACY_VIEWS[name];
    if (route) {
        if (route.view === 'games' && AppState.gameCollectionFilter) {
            route.params = { collection_id: AppState.gameCollectionFilter };
        }
        Router.navigate(route);
        return;
    }
    const labels = { detail: 'Positions', 'game-viewer': 'Games' };
    _activateView(name, labels[name]);
}
async function saveBoardPosition(boardId, positionType) {
    // Use getCurrentFen to get actual visible position, fallback to specific board
    var fen = BoardManager.getCurrentFen() || BoardManager.getPosition(boardId);
    if (!fen) { toast('No position on board', true); return; }
    var title;
    if (AppState.currentGame) {
        var g = AppState.currentGame, ply = AppState.currentPly;
        title = NamingService.generateGamePositionName(g, ply, g.moves_san);
    } else if (AppState.currentDetailId) {
        var el = document.getElementById('detail-title');
        var sourceTitle = el ? el.textContent : null;
        title = NamingService.generateFromPositionName(sourceTitle);
    } else {
        title = NamingService.getFallbackName();
    }
    var savedCat = Object.values(CATEGORIES).find(c => c.positionType === positionType);
    try {
        await ApiClient.post('/positions/', { fen: fen, title: title, position_type: positionType });
        toast('\u2713 Saved as ' + (savedCat ? savedCat.label.toLowerCase() : positionType));
    } catch (e) {
        if (e.status === 409) {
            toast('Position already saved', 'warn');
        } else {
            toast(e.data?.detail || e.message || 'Error saving', 'error');
        }
    }
}
// Load staunty piece sprites for mini boards
fetch('https://cdn.jsdelivr.net/npm/cm-chessboard@8/assets/pieces/staunty.svg')
  .then(r => r.text())
  .then(svg => { 
    const spriteEl = document.getElementById('piece-sprites');
    if (spriteEl) {
      // SAFE_INNER_HTML: Loading trusted SVG content from CDN
      spriteEl.innerHTML = svg;
    }
  })
  .catch(() => {
    // Fallback to base64 pieces if sprite loading fails
    console.warn('Failed to load staunty sprites, using fallback pieces');
  });

function _mountGameStarredFilter() {
    const starToggle = document.getElementById('game-starred-filter');
    if (starToggle) {
        function updateStarToggle() {
            const isActive = AppState.gameStarredFilter || false;
            StarControl.updateStarFilterVisual(starToggle, isActive);
        }
        updateStarToggle();
        
        StarControl.initStarFilterHandler(starToggle, function() {
            AppState.gameStarredFilter = !AppState.gameStarredFilter;
            AppState.gamePage = 0;
            updateStarToggle();
            _pushGamesUrl();
            loadGames();
        });
    }
}

window.API = API;
window.showView = showView;
window.saveBoardPosition = saveBoardPosition;
window.addEventListener('beforeunload', function () { 
});
function toggleNewMenu() {
    var menu = document.getElementById('new-dropdown-menu');
    if (menu) menu.style.display = menu.style.display === 'none' ? '' : 'none';
}
function closeNewMenu() {
    var menu = document.getElementById('new-dropdown-menu');
    if (menu) menu.style.display = 'none';
}
document.addEventListener('click', function(e) {
    if (!e.target.closest('#new-dropdown')) closeNewMenu();
});

window.toggleNewMenu = toggleNewMenu;
window.closeNewMenu = closeNewMenu;
window.renderRoute = renderRoute;

/* Star functionality has been moved to StarControl module */
