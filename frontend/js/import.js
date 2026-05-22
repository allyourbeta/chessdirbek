let _importFile = null;
let _importJobId = null;
let _importAbort = null;
var _importTagState = { tags: [] };

function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function _fmtEta(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return '—';
    if (seconds < 60) return `~${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m < 60) return `~${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `~${h}h ${m % 60}m`;
}

function resetImportView() {
    document.getElementById('import-pgn').value = '';
    _importTagState.tags = [];
    TagFilter.mount({
        containerId: 'import-tags-container',
        state: _importTagState,
        onChange: function() {},
        placeholder: 'Add tags...'
    });
    document.getElementById('import-new-coll').value = '';
    document.getElementById('import-result').innerHTML = '';
    document.getElementById('import-file-name').textContent = '';
    document.getElementById('import-force').checked = false;
    document.getElementById('import-pgn-file').value = '';
    _importFile = null;
    _importJobId = null;
    _importAbort = null;
    renderImportCollections();
}

function renderImportCollections() {
    const el = document.getElementById('import-collection-select');
    if (!el) return;
    el.innerHTML = '<option value="">None</option>' +
        AppState.allCollections.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function handlePgnFile(input) {
    const file = input.files[0];
    if (!file) { _importFile = null; return; }
    _importFile = file;
    document.getElementById('import-file-name').textContent =
        `${file.name} (${formatBytes(file.size)}) — will upload on Import`;
    document.getElementById('import-pgn').value = '';
    document.getElementById('import-pgn').placeholder =
        `File selected: ${file.name}. Click Import to upload, or clear file and paste PGN here.`;
}

async function _createNewCollectionIfNeeded(collIds) {
    const newCollName = document.getElementById('import-new-coll').value.trim();
    if (!newCollName) return;
    try {
        const nc = await ApiClient.post('/collections/', {name: newCollName});
        collIds.push(nc.id);
        await loadCollections();
    } catch (e) {
        if (e.status === 409) return;
        console.error(e);
        toast('Failed to create collection', true);
    }
}

function _renderImportResult(resultEl, data) {
    const dup = data.duplicates || 0;
    let html = `<p style="color:var(--green)">Imported ${data.imported} game(s)`;
    if (dup > 0) html += ` <span class="text-muted">(${dup} duplicate${dup === 1 ? '' : 's'} skipped)</span>`;
    html += '</p>';
    if (data.failed > 0) html += `<p style="color:var(--red)">${data.failed} failed</p>`;
    if (data.errors && data.errors.length) {
        html += `<details><summary style="cursor:pointer;color:var(--text-muted)">Errors</summary>` +
                `<pre style="font-size:12px;color:var(--red);margin-top:8px">${data.errors.join('\n')}</pre></details>`;
    }
    resultEl.innerHTML = html;
}

function _renderProgress(resultEl, ev) {
    const processed = ev.processed || 0;
    const total = ev.total || 0;
    const pct = total > 0 ? Math.min(100, (processed / total) * 100) : 0;
    const elapsed = ev.elapsed_seconds || 0;
    const imported = ev.imported || 0;
    const rate = elapsed > 0 ? processed / elapsed : 0;
    const remaining = rate > 0 ? (total - processed) / rate : Infinity;
    resultEl.innerHTML = `
        <div style="margin-bottom:8px;font-size:13px">
            <strong>${processed}</strong> of <strong>${total}</strong> games processed
            &middot; <span class="text-muted">${imported} imported, ${ev.duplicates || 0} dup, ${ev.failed || 0} failed</span>
        </div>
        <div style="width:100%;height:14px;background:var(--grey-100);border-radius:6px;overflow:hidden">
            <div style="height:100%;width:${pct.toFixed(1)}%;background:var(--green);transition:width 0.2s"></div>
        </div>
        <div style="margin-top:6px;font-size:12px;color:var(--text-muted)">
            ${pct.toFixed(1)}% &middot; ${elapsed.toFixed(1)}s elapsed &middot; ${_fmtEta(remaining)} remaining
        </div>`;
}

function _showImportUI(importing) {
    const importBtn = document.getElementById('import-go-btn');
    const cancelBtn = document.getElementById('import-cancel-btn');
    if (importBtn) importBtn.style.display = importing ? 'none' : '';
    if (cancelBtn) cancelBtn.style.display = importing ? '' : 'none';
}

async function _streamImport(resultEl, pgn, tags, collIds, force) {
    _importAbort = new AbortController();
    let finalResult = null;
    let lastError = null;
    let preparationStarted = Date.now();
    let preparationInterval = null;
    let hasStarted = false;
    
    // Show preparation feedback with spinner and timer
    const showPreparationFeedback = () => {
        const elapsed = Math.floor((Date.now() - preparationStarted) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeStr = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `0:${seconds.toString().padStart(2, '0')}`;
        
        resultEl.innerHTML = `
            <div style="text-align:center;padding:20px">
                <div style="display:inline-block;animation:spin 1s linear infinite;width:24px;height:24px;border:3px solid var(--border);border-top:3px solid var(--accent);border-radius:50%"></div>
                <p style="margin-top:12px;font-size:14px">Parsing PGN file...</p>
                <p style="margin-top:8px;font-size:12px;color:var(--text-muted)">Elapsed: ${timeStr}</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>`;
    };
    
    // Start showing preparation feedback immediately
    showPreparationFeedback();
    preparationInterval = setInterval(showPreparationFeedback, 1000);
    
    const res = await fetch(API + '/games/import/stream', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({pgn_text: pgn, tags, collection_ids: collIds, force}),
        signal: _importAbort.signal,
    });
    if (!res.ok || !res.body) {
        if (preparationInterval) clearInterval(preparationInterval);
        throw new Error('Stream failed: ' + res.status);
    }
    _importJobId = res.headers.get('X-Job-Id');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buf += decoder.decode(value, {stream: true});
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = chunk.split('\n').find(l => l.startsWith('data:'));
            if (!line) continue;
            let ev;
            try { ev = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }
            if (ev.type === 'start') {
                _importJobId = ev.job_id || _importJobId;
                hasStarted = true;
                // Clear preparation feedback when actual processing starts
                if (preparationInterval) {
                    clearInterval(preparationInterval);
                    preparationInterval = null;
                }
            }
            else if (ev.type === 'progress') _renderProgress(resultEl, ev);
            else if (ev.type === 'done') finalResult = ev;
            else if (ev.type === 'error') lastError = ev.detail || 'Import failed';
        }
    }
    if (preparationInterval) clearInterval(preparationInterval);
    if (lastError) throw new Error(lastError);
    return finalResult;
}

async function doImport() {
    const resultEl = document.getElementById('import-result');
    const pasted = document.getElementById('import-pgn').value.trim();

    if (!_importFile && !pasted) {
        toast('Paste or upload PGN first', true);
        return;
    }

    const tags = _importTagState.tags.slice();
    const collSelect = document.getElementById('import-collection-select');
    const collIds = collSelect.value ? [parseInt(collSelect.value)] : [];
    const force = document.getElementById('import-force').checked;

    _showImportUI(true);
    resultEl.innerHTML = '<p class="text-muted">Starting import…</p>';

    try {
        await _createNewCollectionIfNeeded(collIds);
        const pgn = _importFile ? await _importFile.text() : pasted;
        const data = await _streamImport(resultEl, pgn, tags, collIds, force);
        if (!data) {
            resultEl.innerHTML = '<p style="color:var(--red)">Import ended unexpectedly</p>';
            return;
        }
        if (data.cancelled) {
            resultEl.innerHTML = '<p style="color:var(--red)">Import cancelled. No games were saved.</p>';
            return;
        }
        _renderImportResult(resultEl, data);
        if (data.imported > 0) {
            topBanner(`Imported ${data.imported} game${data.imported === 1 ? '' : 's'}`);
            setTimeout(() => { Router.navigate({ view: 'games' }); }, 1500);
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            resultEl.innerHTML = '<p style="color:var(--red)">Import cancelled. No games were saved.</p>';
        } else {
            resultEl.innerHTML = `<p style="color:var(--red)">Import error: ${e.message || e}</p>`;
        }
    } finally {
        _showImportUI(false);
        _importJobId = null;
        _importAbort = null;
    }
}

async function cancelImport() {
    if (!_importJobId) { return; }
    if (!confirm('Cancel this import? All games will be rolled back.')) return;
    try {
        await ApiClient.post('/games/import/cancel/' + _importJobId, {});
    } catch (_) {}
    // Abort the stream so the reader exits promptly.
    if (_importAbort) { try { _importAbort.abort(); } catch (_) {} }
}

function clearImportFile() {
    _importFile = null;
    document.getElementById('import-pgn-file').value = '';
    document.getElementById('import-file-name').textContent = '';
    document.getElementById('import-pgn').placeholder = 'Paste one or more PGN games...';
}

window.resetImportView = resetImportView;
window.renderImportCollections = renderImportCollections;
window.handlePgnFile = handlePgnFile;
window.doImport = doImport;
window.cancelImport = cancelImport;
window.clearImportFile = clearImportFile;
