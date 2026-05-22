var BulkAdd = (function () {
    var _bulkTagState = { tags: [] };

    function init(params) {
        var type = (params && params.type) || 'tabiya';
        var cat = Object.values(CATEGORIES).find(c => c.positionType === type);
        var title = cat ? 'Bulk Add ' + cat.label : 'Bulk Add Positions';
        document.getElementById('bulk-add-title').textContent = title;
        var radios = document.querySelectorAll('input[name="bulk-type"]');
        radios.forEach(function (r) { r.checked = r.value === type; });
        document.getElementById('bulk-fen-input').value = '';
        _bulkTagState.tags = [];
        TagFilter.mount({
            containerId: 'bulk-tags-container',
            state: _bulkTagState,
            onChange: function() {},
            placeholder: 'Add tags...'
        });
        document.getElementById('bulk-progress').style.display = 'none';
        document.getElementById('bulk-results').style.display = 'none';
        document.getElementById('bulk-import-btn').disabled = false;
    }

    function _getType() {
        var checked = document.querySelector('input[name="bulk-type"]:checked');
        return checked ? checked.value : 'tabiya';
    }

    function _completeFen(line) {
        var trimmed = line.trim();
        if (!trimmed) return null;
        var parts = trimmed.split(/\s+/);
        if (parts.length < 1) return null;
        if (parts.length === 1) return trimmed + ' w KQkq - 0 1';
        if (parts.length === 2) return trimmed + ' KQkq - 0 1';
        if (parts.length === 3) return trimmed + ' - 0 1';
        if (parts.length === 4) return trimmed + ' 0 1';
        if (parts.length === 5) return trimmed + ' 1';
        return trimmed;
    }

    async function run() {
        var raw = document.getElementById('bulk-fen-input').value;
        var lines = raw.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        if (!lines.length) { toast('No FENs entered', true); return; }

        var type = _getType();
        var posType = type;  // radio value is already the correct position_type
        var tags = _bulkTagState.tags.slice();

        var fens = [];
        for (var i = 0; i < lines.length; i++) {
            var completed = _completeFen(lines[i]);
            if (completed) fens.push(completed);
        }
        if (!fens.length) { toast('No valid FENs', true); return; }

        var btn = document.getElementById('bulk-import-btn');
        btn.disabled = true;
        var progressEl = document.getElementById('bulk-progress');
        var progressText = document.getElementById('bulk-progress-text');
        var progressCount = document.getElementById('bulk-progress-count');
        var progressBar = document.getElementById('bulk-progress-bar');
        var resultsEl = document.getElementById('bulk-results');
        progressEl.style.display = 'block';
        resultsEl.style.display = 'none';

        var imported = 0, duplicates = 0, errors = [];

        for (var j = 0; j < fens.length; j++) {
            progressText.textContent = 'Importing...';
            progressCount.textContent = (j + 1) + '/' + fens.length;
            progressBar.style.width = ((j + 1) / fens.length * 100) + '%';

            try {
                try {
                    await ApiClient.post('/positions/', {
                        fen: fens[j],
                        title: NamingService.generatePositionName(),
                        position_type: posType,
                        tags: tags,
                    });
                    imported++;
                } catch (apiErr) {
                    if (apiErr.status === 409) {
                        duplicates++;
                    } else {
                        errors.push({ fen: fens[j], error: apiErr.data?.detail || apiErr.message || 'Error' });
                    }
                }
            } catch (e) {
                errors.push({ fen: fens[j], error: e.message });
            }
        }

        progressText.textContent = 'Done';
        btn.disabled = false;
        _showResults(imported, duplicates, errors, fens.length);
    }

    function _showResults(imported, duplicates, errors, total) {
        var el = document.getElementById('bulk-results');
        var html = '<div style="font-size:14px;margin-bottom:8px"><strong>Import Complete</strong></div>';
        html += '<div style="font-size:13px">';
        html += '<div>\u2713 Imported: <strong>' + imported + '</strong> / ' + total + '</div>';
        if (duplicates > 0) html += '<div style="color:var(--text-muted)">\u2022 Duplicates skipped: ' + duplicates + '</div>';
        if (errors.length > 0) {
            html += '<div style="color:var(--danger)">\u2717 Errors: ' + errors.length + '</div>';
            html += '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px">Error details</summary>';
            html += '<div style="max-height:200px;overflow-y:auto;font-size:12px;margin-top:4px">';
            errors.forEach(function (e) {
                html += '<div style="margin-bottom:4px"><code>' + _esc(e.fen) + '</code> — ' + _esc(e.error) + '</div>';
            });
            html += '</div></details>';
        }
        html += '</div>';
        el.innerHTML = html;
        el.style.display = 'block';
    }

    function _esc(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    return { init: init, run: run, currentType: _getType };
})();

window.BulkAdd = BulkAdd;
