async function loadCollectionsView() {
    try {
        AppState.allCollections = await ApiClient.get('/collections/');
    } catch (e) {
        AppState.allCollections = [];
    }
    renderCollectionsView();
}

function renderCollectionsView() {
    const el = document.getElementById('collections-list');
    if (!AppState.allCollections.length) {
        // SAFE_INNER_HTML: Template with escaped content via EmptyStates.render()
        el.innerHTML = EmptyStates.render('No collections yet', 'Create one to organize your games.');
        return;
    }
    // SAFE_INNER_HTML: Template with escaped content - Html.escape() used for collection names and descriptions
    el.innerHTML = AppState.allCollections.map(c => {
        const desc = c.description ? `<div class="text-muted" style="font-size:12px;margin-top:4px">${Html.escape(c.description)}</div>` : '';
        return `<div class="pos-item" data-collection-id="${c.id}">
            <div class="collection-main" style="flex:1;cursor:pointer">
                <div style="font-size:14px;font-weight:500">${Html.escape(c.name)}</div>
                ${desc}
                <div class="text-muted" style="font-size:12px;margin-top:4px">${c.game_count} game(s)</div>
            </div>
            <div class="btn-row" style="margin:0">
                <button class="btn btn-sm collection-review-btn" data-collection-name="${Html.escape(c.name)}">Start Review</button>
                <button class="btn btn-sm collection-edit-btn">Edit</button>
                <button class="btn btn-sm btn-danger collection-delete-btn">Delete</button>
            </div>
        </div>`;
    }).join('');
    
    // Set up event delegation for collections list
    _setupCollectionsEvents(el);
}

function _setupCollectionsEvents(container) {
    // Remove existing event listener to prevent duplicates
    container.removeEventListener('click', _handleCollectionsClick);
    // Add event delegation for collections list clicks
    container.addEventListener('click', _handleCollectionsClick);
}

function _handleCollectionsClick(event) {
    const target = event.target.closest('.collection-review-btn, .collection-edit-btn, .collection-delete-btn, .collection-main');
    if (!target) return;

    const collectionItem = target.closest('.pos-item');
    if (!collectionItem) return;
    
    const collectionId = parseInt(collectionItem.dataset.collectionId, 10);
    if (!collectionId) return;

    if (target.classList.contains('collection-review-btn')) {
        // Handle start review button click
        event.stopPropagation();
        const collectionName = target.dataset.collectionName;
        if (typeof startBatchReview === 'function') {
            startBatchReview(collectionId, collectionName);
        }
    } else if (target.classList.contains('collection-edit-btn')) {
        // Handle edit button click
        event.stopPropagation();
        editCollection(collectionId);
    } else if (target.classList.contains('collection-delete-btn')) {
        // Handle delete button click
        event.stopPropagation();
        deleteCollection(collectionId);
    } else if (target.classList.contains('collection-main')) {
        // Handle collection main area click
        openCollection(collectionId);
    }
}


function escapeJs(s) {
    if (!s) return '';
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function openCollection(id) {
    Router.navigate({ view: 'collectionDetail', id });
}

function showCollectionModal() {
    document.getElementById('collection-edit-id').value = '';
    document.getElementById('collection-name').value = '';
    document.getElementById('collection-description').value = '';
    document.getElementById('collection-modal-title').textContent = 'New Collection';
    document.getElementById('collection-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('collection-name').focus(), 50);
}

function hideCollectionModal() {
    document.getElementById('collection-modal').style.display = 'none';
}

function editCollection(id) {
    const c = AppState.allCollections.find(x => x.id === id);
    if (!c) return;
    document.getElementById('collection-edit-id').value = c.id;
    document.getElementById('collection-name').value = c.name || '';
    document.getElementById('collection-description').value = c.description || '';
    document.getElementById('collection-modal-title').textContent = 'Edit Collection';
    document.getElementById('collection-modal').style.display = 'flex';
}

async function saveCollection() {
    const id = document.getElementById('collection-edit-id').value;
    const name = document.getElementById('collection-name').value.trim();
    const description = document.getElementById('collection-description').value.trim();
    if (!name) { toast('Name is required', true); return; }

    const body = { name, description: description || null };
    try {
        if (id) {
            await ApiClient.put('/collections/' + id, body);
        } else {
            await ApiClient.post('/collections/', body);
        }
        toast(id ? 'Collection updated' : 'Collection created');
        hideCollectionModal();
        loadCollectionsView();
    } catch (e) {
        toast(e.data?.detail || e.message || 'Failed to save', true);
    }
}

async function deleteCollection(id) {
    if (!confirm('Delete this collection? (Games will not be deleted.)')) return;
    try {
        await ApiClient.delete('/collections/' + id);
        toast('Collection deleted');
        loadCollectionsView();
    } catch (e) {
        toast('Failed to delete', true);
    }
}

window.loadCollectionsView = loadCollectionsView;
window.renderCollectionsView = renderCollectionsView;
window.openCollection = openCollection;
window.showCollectionModal = showCollectionModal;
window.hideCollectionModal = hideCollectionModal;
window.editCollection = editCollection;
window.saveCollection = saveCollection;
window.deleteCollection = deleteCollection;
