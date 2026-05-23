async function loadPositionDetail(id) {
    const pos = await ApiClient.get('/positions/' + id);
    AppState.currentDetailId = id;
    AppState.currentDetailFen = pos.fen;
    AppState.currentDetailType = pos.position_type || 'tabiya';
    // Honor the saved per-position orientation (default 'white' if missing).
    const flipped = pos.orientation === 'black';
    AppState.detailFlipped = flipped;

    // A practice move list belongs to the currently active practice game, not
    // merely to the detail page. Clear stale moves whenever a new position is
    // loaded so a previous game cannot visually leak into the next position.
    if (window.Practice && typeof Practice.clearMoveList === 'function') {
        Practice.clearMoveList();
    }
    
    document.getElementById('detail-title').textContent = pos.title || 'Untitled';
    
    const detailStar = document.getElementById('detail-star');
    detailStar.dataset.positionId = pos.id;
    // SAFE_INNER_HTML: Controlled content - StarControl.renderStarIcon returns static SVG
    detailStar.innerHTML = StarControl.renderStarIcon(pos.starred);
    document.getElementById('detail-fen').textContent = pos.fen;
    const notesEl = document.getElementById('detail-notes');
    notesEl.value = pos.notes || '';
    notesEl._lastSaved = pos.notes || '';
    notesEl.oninput = _onDetailNotesInput;
    notesEl.onblur = _autoSaveDetailNotes;
    // SAFE_INNER_HTML: Template with escaped content via TagRenderer.renderChips()
    document.getElementById('detail-tags').innerHTML = TagRenderer.renderChips(pos.tags);
    _initCollapsibleCards(pos.notes);
    
    if (pos.position_type === 'puzzle') {
        document.getElementById('detail-stockfish-card').style.display = 'none';
        document.getElementById('detail-stats-card').style.display = 'none';
        document.getElementById('practice-section').style.display = 'none';
        document.getElementById('practice-history-section').style.display = 'none';
        document.getElementById('aggregate-stats-section').style.display = 'none';
        document.getElementById('your-moves-section').style.display = 'none';
        
        var catKey = TYPE_TO_CATEGORY[pos.position_type] || 'tabiya';
        var backLabel = CATEGORIES[catKey] ? CATEGORIES[catKey].label : 'Tabiya';
        const backBtn = document.getElementById('detail-back-btn');
        if (backBtn) backBtn.textContent = 'Back to ' + backLabel;
        
        document.getElementById('prev-puzzle-btn').style.display = 'none';
        document.getElementById('next-puzzle-btn').style.display = 'none';
        const counter = document.getElementById('puzzle-counter');
        if (counter) counter.style.display = 'none';
    } else {
        document.getElementById('detail-stockfish-card').style.display = 'none';
        document.getElementById('detail-stats-card').style.display = 'none';
        document.getElementById('practice-section').style.display = '';
        document.getElementById('practice-history-section').style.display = '';
        document.getElementById('aggregate-stats-section').style.display = '';
        document.getElementById('your-moves-section').style.display = '';
        
        var catKey = TYPE_TO_CATEGORY[pos.position_type] || 'tabiya';
        var backLabel = CATEGORIES[catKey] ? CATEGORIES[catKey].label : 'Tabiya';
        const backBtn = document.getElementById('detail-back-btn');
        if (backBtn) backBtn.textContent = 'Back to ' + backLabel;
        
        document.getElementById('prev-puzzle-btn').style.display = 'none';
        document.getElementById('next-puzzle-btn').style.display = 'none';
        const counter = document.getElementById('puzzle-counter');
        if (counter) counter.style.display = 'none';
        
        if (window.Practice) {
            Practice.loadPracticeHistory(id);
            Practice.loadLevels().then(() => PracticeUI.populateLevelSelect(Practice.getLevels()));
        }
    }
    
    var navKeyScope = pos.position_type === 'puzzle' ? null : 'view-detail';
    MoveNavigator.create('detail-nav', {
        fens: [pos.fen],
        startIndex: 0,
        boardId: 'detail-board',
        containerId: 'detail-move-nav',
        keyScope: navKeyScope,
        onNavigate: function (fen) {
            EngineUI.setPosition(fen);
            AnnotationPanel.setPosition(fen);
            document.getElementById('detail-fen').textContent = fen;
        },
    });
    BoardManager.create('detail-board', pos.fen, {
        flipped: flipped,
        mode: 'analysis',
        onPositionChange: function (newFen) {
            MoveNavigator.push('detail-nav', newFen);
            EngineUI.setPosition(newFen);
            AnnotationPanel.setPosition(newFen);
            document.getElementById('detail-fen').textContent = newFen;
        },
    });

    AnnotationPanel.mount('detail-annotation-container');
    AnnotationPanel.setPosition(pos.fen);
    EngineUI.mount('detail-engine-container');
    EngineUI.setPosition(pos.fen);
}

function toggleCollapsible(id) {
    var card = document.getElementById(id);
    if (card) card.classList.toggle('expanded');
}

function copyFen() {
    FenActions.copyCurrentFen();
}

function _initCollapsibleCards(notes) {
    var notesCard = document.getElementById('notes-card');
    var notesLabel = document.getElementById('notes-card-label');
    if (notesCard) {
        if (notes && notes.trim()) {
            notesCard.classList.add('expanded');
            // SAFE_INNER_HTML: Static template with controlled styling
            if (notesLabel) notesLabel.innerHTML = 'Your Notes <span class="text-muted" style="font-size:11px;font-weight:normal">(auto-saved)</span>';
        } else {
            notesCard.classList.remove('expanded');
            // SAFE_INNER_HTML: Static template with controlled styling
            if (notesLabel) notesLabel.innerHTML = 'Notes <span class="text-muted" style="font-size:11px;font-weight:normal">(click to add)</span>';
        }
    }
}

function startTitleEdit() {
    var h2 = document.getElementById('detail-title');
    if (!h2 || h2.querySelector('input')) return;
    var current = h2.textContent;
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = current;
    inp.style.cssText = 'font-size:inherit;font-weight:inherit;font-family:inherit;width:100%;border:1px solid var(--primary-300);border-radius:4px;padding:2px 6px';
    h2.textContent = '';
    h2.appendChild(inp);
    inp.focus();
    inp.select();
    inp.onkeydown = function (e) {
        if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
        if (e.key === 'Escape') { e.preventDefault(); h2.textContent = current; }
    };
    inp.onblur = function () {
        var val = inp.value.trim() || 'Untitled';
        h2.textContent = val;
        if (val !== current) _saveTitleToBackend(val);
    };
}

async function _saveTitleToBackend(title) {
    var id = AppState.currentDetailId;
    if (!id) return;
    try {
        await ApiClient.put('/positions/' + id, { title });
        toast('\u2713 Title saved');
    } catch (e) {
        toast('Failed to save title', 'error');
    }
}

function editPosition() {
    if (!AppState.currentDetailId) return;
    ApiClient.get('/positions/' + AppState.currentDetailId).then(pos => {
        document.getElementById('edit-id').value = pos.id;
        document.getElementById('fen-input').value = pos.fen;
        document.getElementById('pos-title').value = pos.title || '';
        _formTagState.tags = pos.tags.map(t => t.name);
        _initFormTagFilter();
        document.getElementById('pos-notes').value = pos.notes || '';
        document.getElementById('pos-stockfish').value = pos.stockfish_analysis || '';
        document.getElementById('form-title').textContent = 'Edit Position';
        document.getElementById('delete-btn').style.display = 'inline-flex';
        AppState.boardFen = pos.fen;
        AppState.addPositionType = pos.position_type || 'tabiya';
        Router.navigate({ view: 'addPosition', params: { type: pos.position_type || 'tabiya' } });
        BoardManager.create('board', AppState.boardFen, {
            mode: 'analysis',
            onPositionChange: function(newFen) {
                document.getElementById('fen-input').value = newFen;
                AppState.boardFen = newFen;
            },
        });
        // Honor the saved orientation when bringing the position into the edit form.
        if (typeof window._applyFormOrientation === 'function') {
            window._applyFormOrientation(pos.orientation || 'white');
        }
    });
}

function flipDetailBoard() {
    BoardManager.flip('detail-board');
}

let _detailNotesTimeout = null;
function _onDetailNotesInput() {
    if (_detailNotesTimeout) clearTimeout(_detailNotesTimeout);
    _detailNotesTimeout = setTimeout(_autoSaveDetailNotes, 1000);
    var lbl = document.getElementById('notes-card-label');
    // SAFE_INNER_HTML: Static template with controlled styling
    if (lbl) lbl.innerHTML = 'Your Notes <span class="text-muted" style="font-size:11px;font-weight:normal">(auto-saved)</span>';
}
async function _autoSaveDetailNotes() {
    if (_detailNotesTimeout) { clearTimeout(_detailNotesTimeout); _detailNotesTimeout = null; }
    const id = AppState.currentDetailId;
    if (!id) return;
    const el = document.getElementById('detail-notes');
    if (!el) return;
    const notes = el.value;
    if (notes === el._lastSaved) return;
    console.log('[NOTES] Saving notes for position', id);
    try {
        await ApiClient.put('/positions/' + id, { notes: notes || null });
        el._lastSaved = notes;
        console.log('[NOTES] Save succeeded');
        topBanner('Notes saved', 1500);
    } catch (e) {
        console.error('[NOTES] Save failed', e);
        toast('Failed to save notes', true);
    }
}

async function deleteFromDetail() {
    const id = AppState.currentDetailId;
    if (!id || !confirm('Delete this position?')) return;
    const pos = AppState.allPositions.find(p => p.id === id);
    const viewToReturn = (pos && TYPE_TO_CATEGORY[pos.position_type]) || 'tabiya';
    try {
        await ApiClient.delete('/positions/' + id);
        topBanner('Position deleted');
        Router.navigate({ view: viewToReturn });
    } catch (e) {
        toast('Delete failed', true);
    }
}

async function randomFromDetail() {
    const id = AppState.currentDetailId;
    const type = AppState.currentDetailType || 'tabiya';
    const posType = type;  // 'puzzle', 'tabiya', 'endgame', or 'strategy'
    const tags = AppState.positionTagFilters || [];
    let u = API + '/positions/random?position_type=' + posType;
    if (id) u += '&exclude_id=' + id;
    if (tags.length) u += '&' + tags.map(t => 'tags=' + encodeURIComponent(t)).join('&');
    try {
        const pos = await ApiClient.get(u.replace(API, ''));
        const params = tags.length ? { tags: tags.slice() } : {};
        Router.navigate({ view: 'positionDetail', id: pos.id, positionType: posType, params });
    } catch (e) {
        if (e.status === 404) {
            toast('No other positions', 'warn');
        } else {
            toast('Error', 'error');
        }
    }
}


window.loadPositionDetail = loadPositionDetail;
window.toggleCollapsible = toggleCollapsible;
window.copyFen = copyFen;
window.startTitleEdit = startTitleEdit;
window.editPosition = editPosition;
window.flipDetailBoard = flipDetailBoard;
window.deleteFromDetail = deleteFromDetail;
window.randomFromDetail = randomFromDetail;
