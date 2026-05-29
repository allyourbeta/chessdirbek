/**
 * Puzzle-to-puzzle navigation for the position form/detail flow: fetches the
 * prev/next navigation for the current puzzle, wires the on-screen buttons, and
 * handles ArrowLeft/ArrowRight jumping (suppressed while the analysis-tree
 * navigator owns the keys in the detail view). Extracted from position-form.js
 * so that file stays focused on form CRUD + board controls. Classic script
 * (page globals); self-contained — uses only API/ApiClient/Router/AppState/DOM.
 */
async function loadPuzzleNavigation(puzzleId) {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const tags = params.getAll('tag');
    
    let url = API + `/positions/${puzzleId}/navigation`;
    if (tags.length > 0) {
        url += '?' + tags.map(t => 'tags=' + encodeURIComponent(t)).join('&');
    }
    
    const nav = await ApiClient.get(url.replace(API, ''));
    
    document.getElementById('puzzle-current-index').textContent = nav.current_index;
    document.getElementById('puzzle-total-count').textContent = nav.total_count;
    
    const prevBtn = document.getElementById('prev-puzzle-btn');
    const nextBtn = document.getElementById('next-puzzle-btn');
    
    if (nav.previous_id) {
        prevBtn.disabled = false;
        prevBtn.onclick = () => navigateToPuzzle(nav.previous_id);
    } else {
        prevBtn.disabled = true;
    }
    
    if (nav.next_id) {
        nextBtn.disabled = false;
        nextBtn.onclick = () => navigateToPuzzle(nav.next_id);
    } else {
        nextBtn.disabled = true;
    }
    
    AppState.puzzleNavigation = nav;
}

function navigateToPuzzle(puzzleId) {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const tagParams = params.getAll('tag');
    
    const route = { 
        view: 'positionDetail', 
        id: puzzleId 
    };
    
    if (tagParams.length > 0) {
        const queryString = tagParams.map(t => 'tag=' + encodeURIComponent(t)).join('&');
        Router.navigate(route, queryString);
    } else {
        Router.navigate(route);
    }
}

function navigatePuzzle(direction) {
    if (!AppState.puzzleNavigation) return;
    
    if (direction === 'next' && AppState.puzzleNavigation.next_id) {
        navigateToPuzzle(AppState.puzzleNavigation.next_id);
    } else if (direction === 'previous' && AppState.puzzleNavigation.previous_id) {
        navigateToPuzzle(AppState.puzzleNavigation.previous_id);
    }
}

function setupPuzzleKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        if (!AppState.currentDetailType || AppState.currentDetailType !== 'puzzle') return;
        if (!AppState.puzzleNavigation) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        // In the position-detail view the arrow keys belong to the analysis-tree
        // navigator (MoveNavigator, keyScope 'view-detail'). Puzzle-to-puzzle
        // jumping must not also fire there, or one keypress would do both.
        var detailView = document.getElementById('view-detail');
        if (detailView && detailView.classList.contains('active')) return;

        if (e.key === 'ArrowRight' && AppState.puzzleNavigation.next_id) {
            e.preventDefault();
            navigateToPuzzle(AppState.puzzleNavigation.next_id);
        } else if (e.key === 'ArrowLeft' && AppState.puzzleNavigation.previous_id) {
            e.preventDefault();
            navigateToPuzzle(AppState.puzzleNavigation.previous_id);
        }
    });
}

window.loadPuzzleNavigation = loadPuzzleNavigation;
window.navigateToPuzzle = navigateToPuzzle;
window.navigatePuzzle = navigatePuzzle;
window.setupPuzzleKeyboardShortcuts = setupPuzzleKeyboardShortcuts;
