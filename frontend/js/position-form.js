var _formTagState = { tags: [] };
var _formTagFilter = null;

function _initFormTagFilter() {
    _formTagFilter = TagFilter.mount({
        containerId: 'pos-tags-container',
        state: _formTagState,
        onChange: function() {},
        placeholder: 'Add tags...'
    });
}

async function savePosition() {
    const editId = document.getElementById('edit-id').value;
    const fen = document.getElementById('fen-input').value.trim();
    const title = document.getElementById('pos-title').value.trim();
    const tags = _formTagState.tags.slice();
    const notes = document.getElementById('pos-notes').value.trim();
    const sf = document.getElementById('pos-stockfish').value.trim();
    if (!fen) { toast('FEN is required', true); return; }
    const body = { 
        fen, 
        title: title || null, 
        notes: notes || null, 
        stockfish_analysis: sf || null, 
        position_type: AppState.addPositionType || 'tabiya',
        tags 
    };
    let res;
    if (editId) res = await fetch(API + '/positions/' + editId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    else res = await fetch(API + '/positions/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
        toast(editId ? 'Position updated!' : 'Position saved!');
        clearForm();
        const viewToGo = AppState.addPositionType === 'puzzle' ? 'tactics' : 'tabiyas';
        Router.navigate({ view: viewToGo });
    } else {
        const err = await res.json();
        const errorMsg = err.detail || 'Error saving';
        toast(errorMsg, true);
        const formTitle = document.getElementById('form-title');
        if (formTitle && err.detail && err.detail.includes('already exists')) {
            formTitle.style.color = 'var(--danger, red)';
            formTitle.textContent = err.detail;
            setTimeout(() => {
                formTitle.style.color = '';
                formTitle.textContent = AppState.addPositionType === 'puzzle' ? 'New Tactic' : 'New Tabiya';
            }, 3000);
        }
    }
}

async function deletePosition() {
    const id = document.getElementById('edit-id').value;
    if (!id || !confirm('Delete this position?')) return;
    if ((await fetch(API + '/positions/' + id, { method: 'DELETE' })).ok) {
        topBanner('Position deleted');
        clearForm();
        Router.navigate({ view: 'tabiyas' });
    }
}

function loadFen() {
    const f = document.getElementById('fen-input').value.trim();
    if (f) {
        AppState.boardFen = f;
        BoardManager.setPosition('board', AppState.boardFen);
    }
}

function setStartPos() {
    const f = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    document.getElementById('fen-input').value = f;
    AppState.boardFen = f;
    BoardManager.setPosition('board', AppState.boardFen);
}

function flipBoard() {
    BoardManager.flip('board');
}

function clearForm() {
    document.getElementById('edit-id').value = '';
    document.getElementById('fen-input').value = '';
    document.getElementById('pos-title').value = '';
    document.getElementById('pos-notes').value = '';
    document.getElementById('pos-stockfish').value = '';
    document.getElementById('form-title').textContent = 'New Position';
    document.getElementById('delete-btn').style.display = 'none';
    AppState.boardFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    AppState.addPositionType = 'tabiya';
    BoardManager.create('board', AppState.boardFen, { flipped: false });
    const saved = AppState.lastTags || localStorage.getItem('chessquiz-last-tags') || '';
    _formTagState.tags = saved ? saved.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];
    _initFormTagFilter();
}

function setupAutoLoad() {
    const inp = document.getElementById('fen-input');
    inp.addEventListener('input', () => {
        const v = inp.value.trim();
        if (v.includes('/') && v.length > 10) {
            AppState.boardFen = v;
            BoardManager.setPosition('board', AppState.boardFen);
        }
    });
}

function setupKeyboardSave() {
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            const addView = document.getElementById('view-add');
            if (addView && addView.classList.contains('active')) {
                savePosition();
            }
        }
    });
}

function setupUrlParams() {
    const p = new URLSearchParams(window.location.search);
    const fen = p.get('fen');
    if (fen) {
        document.getElementById('fen-input').value = fen;
        AppState.boardFen = fen;
        BoardManager.setPosition('board', AppState.boardFen);
        window.history.replaceState(null, '', '/positions/new');
    }
}

const _origSavePosition = savePosition;
savePosition = async function() {
    AppState.lastTags = _formTagState.tags.join(', ');
    localStorage.setItem('chessquiz-last-tags', AppState.lastTags);
    return _origSavePosition.apply(this, arguments);
};

async function loadPuzzleNavigation(puzzleId) {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const tags = params.getAll('tag');
    
    let url = API + `/positions/${puzzleId}/navigation`;
    if (tags.length > 0) {
        url += '?' + tags.map(t => 'tags=' + encodeURIComponent(t)).join('&');
    }
    
    const nav = await (await fetch(url)).json();
    
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
        
        if (e.key === 'ArrowRight' && AppState.puzzleNavigation.next_id) {
            e.preventDefault();
            navigateToPuzzle(AppState.puzzleNavigation.next_id);
        } else if (e.key === 'ArrowLeft' && AppState.puzzleNavigation.previous_id) {
            e.preventDefault();
            navigateToPuzzle(AppState.puzzleNavigation.previous_id);
        }
    });
}

window.savePosition = savePosition;
window.deletePosition = deletePosition;
window.loadFen = loadFen;
window.setStartPos = setStartPos;
window.flipBoard = flipBoard;
window.clearForm = clearForm;
window.setupAutoLoad = setupAutoLoad;
window.setupKeyboardSave = setupKeyboardSave;
window.setupUrlParams = setupUrlParams;
window._formTagState = _formTagState;
window._initFormTagFilter = _initFormTagFilter;
window.loadPuzzleNavigation = loadPuzzleNavigation;
window.navigateToPuzzle = navigateToPuzzle;
window.navigatePuzzle = navigatePuzzle;
window.setupPuzzleKeyboardShortcuts = setupPuzzleKeyboardShortcuts;
