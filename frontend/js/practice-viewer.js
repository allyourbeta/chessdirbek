// Practice game viewer (Phase 10 follow-up).
// Loads a saved practice game by id, replays PGN via chess.js to build
// a ply-indexed FEN list, then lets the user step through moves with
// arrow keys or nav buttons. Verdict, notes, and deletion are editable.
//
// Failure modes guarded against:
//   - PGN may have been saved with custom [FEN]/[SetUp] headers; load_pgn
//     must honor those so replay starts from root position, not standard start.
//   - If chess.js can't parse the PGN, we still render metadata and the
//     starting FEN (graceful degrade).
//   - Arrow-key handler must not fire when viewer is inactive.

const PracticeViewer = (function () {
    let _game = null;      // raw PracticeGameOut response
    let _fens = [];        // ply-indexed FEN list (len = moves+1)
    let _sans = [];        // SAN list (len = moves)
    let _ply = 0;
    let _flipped = false;
    let _rootFen = null;
    let _notesTimeout = null;  // for debounced auto-save
    let _lastSavedNotes = null;

    function open(id) {
        if (Router.isRendering()) return _load(id);
        Router.navigate({ view: 'practiceGameDetail', id });
    }

    async function _load(id) {
        try {
            const r = await fetch(`${API}/practice/${id}`);
            if (!r.ok) { toast('Failed to load practice game', true); return; }
            _game = await r.json();
        } catch (_) {
            toast('Failed to load practice game', true); return;
        }

        // Ensure engine level metadata is loaded so we can show depth/skill.
        try { if (window.Practice) await Practice.loadLevels(); } catch (_) {}

        // Fetch root position FEN so we can anchor the replay.
        try {
            const rp = await fetch(`${API}/positions/${_game.root_position_id}`);
            const pos = rp.ok ? await rp.json() : null;
            _rootFen = pos ? pos.fen : null;
        } catch (_) { _rootFen = null; }

        _replayPgn();
        _ply = _fens.length - 1;  // start on final position
        _flipped = (_game.user_color === 'black');
        _render();
    }

    function _replayPgn() {
        _fens = [];
        _sans = [];
        if (!window.Chess) { _fens = [_rootFen || '']; return; }
        const chess = new Chess();
        let loaded = false;
        try { loaded = chess.load_pgn(_game.pgn_text); } catch (_) { loaded = false; }

        if (!loaded && _rootFen) {
            // Fallback: start from root and play saved moves via regex.
            try {
                const fallback = new Chess(_rootFen);
                _fens.push(fallback.fen());
                // crude SAN extraction: strip headers, collapse move numbers
                const body = _game.pgn_text.replace(/\[[^\]]+\]/g, '')
                    .replace(/\{[^}]*\}/g, '')
                    .replace(/\d+\.(\.\.)?/g, ' ')
                    .replace(/\s+/g, ' ').trim().split(' ')
                    .filter(tok => tok && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok));
                for (const san of body) {
                    const mv = fallback.move(san, { sloppy: true });
                    if (!mv) break;
                    _sans.push(mv.san);
                    _fens.push(fallback.fen());
                }
                return;
            } catch (_) { /* fall through */ }
        }

        // Rebuild FEN list by replaying history on a fresh board seeded from
        // the PGN's [FEN] header (chess.load_pgn handles this internally).
        const history = chess.history({ verbose: true });
        const startFen = _rootFen || new Chess().fen();
        const replay = new Chess(startFen);
        _fens.push(replay.fen());
        for (const mv of history) {
            const applied = replay.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
            if (!applied) break;
            _sans.push(applied.san);
            _fens.push(replay.fen());
        }
        if (!_fens.length) _fens = [startFen];
    }

    function _render() {
        const g = _game;
        if (!g) return;
        const youColor = g.user_color === 'white' ? 'White' : 'Black';
        const sfColor = g.user_color === 'white' ? 'Black' : 'White';
        const date = g.created_at ? new Date(g.created_at).toLocaleString() : '';
        const verdict = g.user_verdict || g.engine_verdict;
        const result = PracticeUI.formatResult(verdict, g.user_color);
        const vcls = PracticeUI.resultClass(verdict);
        const sfLabel = _engineLabel(g.engine_level);

        document.getElementById('pv-title').textContent =
            `You (${youColor}) vs ${sfLabel} (${sfColor})`;
        document.getElementById('pv-meta').textContent =
            `${date} · ${MoveCounts.formatMoveCountFromPlies(g.move_count, true)} · starting eval ${_fmtEval(g.starting_eval)} · final eval ${_fmtEval(g.final_eval)}`;
        const verdictLabel = verdict || 'unknown';
        document.getElementById('pv-verdict').innerHTML =
            `Result: <span class="${vcls}"><strong>${result}</strong></span>` +
            ` <span class="text-muted" style="font-size:11px">(${verdictLabel})</span>` +
            (g.user_verdict && g.engine_verdict && g.user_verdict !== g.engine_verdict
                ? ` <span class="text-muted" style="font-size:11px">engine suggested: ${g.engine_verdict}</span>` : '');
        const notesEl = document.getElementById('pv-notes');
        notesEl.value = g.notes || '';
        _lastSavedNotes = g.notes || '';
        
        // Set up auto-save on notes
        notesEl.oninput = _onNotesInput;

        _renderMoves();
        BoardManager.create('pv-board', _fens[_ply] || _rootFen, { flipped: _flipped });
        AnnotationPanel.mount('pv-annotation-container');
        AnnotationPanel.setPosition(_fens[_ply] || _rootFen);
    }
    
    function _onNotesInput() {
        // Clear existing timeout
        if (_notesTimeout) clearTimeout(_notesTimeout);
        
        // Set new timeout for 1 second
        _notesTimeout = setTimeout(_autoSaveNotes, 1000);
    }
    
    async function _autoSaveNotes() {
        if (!_game) return;
        const notes = document.getElementById('pv-notes').value;
        
        // Don't save if unchanged
        if (notes === _lastSavedNotes) return;
        
        try {
            const r = await fetch(`${API}/practice/${_game.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            });
            
            if (r.ok) {
                _lastSavedNotes = notes;
                _game = await r.json();
                _showSaveIndicator();
            }
        } catch (_) {
            // Silent failure for auto-save
        }
    }
    
    function _showSaveIndicator() {
        const notesEl = document.getElementById('pv-notes');
        const parent = notesEl.parentElement;
        
        // Check if indicator already exists
        let indicator = document.getElementById('notes-save-indicator');
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.id = 'notes-save-indicator';
            indicator.style.cssText = 'position:absolute;right:8px;top:8px;font-size:11px;color:var(--success);opacity:0;transition:opacity 0.3s';
            indicator.textContent = 'Saved';
            parent.style.position = 'relative';
            parent.appendChild(indicator);
        }
        
        // Show and fade out
        indicator.style.opacity = '1';
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 2000);
    }

    function _engineLabel(level) {
        const levels = window.Practice ? Practice.getLevels() : null;
        if (levels && levels[level]) {
            const l = levels[level];
            return `Stockfish (${level} — depth ${l.depth}, skill ${l.skill})`;
        }
        return `Stockfish (${level})`;
    }

    function _fmtEval(v) { return (v == null || isNaN(v)) ? '—' : (+v).toFixed(2); }

    function _renderMoves() {
        const el = document.getElementById('pv-moves');
        if (!_sans.length) { el.innerHTML = '<p class="text-muted" style="font-size:12px">No moves recorded</p>'; return; }
        // Determine starting move number and side from root FEN.
        const startFen = _rootFen || '';
        const startTurn = startFen.split(' ')[1] === 'b' ? 'b' : 'w';
        let moveNum = parseInt((startFen.split(' ')[5] || '1'), 10) || 1;
        let html = '<table style="width:100%;border-collapse:collapse;font-size:13px">';
        let i = 0;
        if (startTurn === 'b' && _sans.length) {
            const ply = 1;
            html += `<tr><td style="color:var(--text-muted);padding:2px 8px 2px 0;width:30px;text-align:right">${moveNum}...</td>` +
                `<td></td>` +
                `<td class="move-cell" data-ply="${ply}" onclick="PracticeViewer.goTo(${ply})" style="padding:4px 8px;cursor:pointer;border-radius:4px">${_sans[0]}</td></tr>`;
            i = 1;
            moveNum++;
        }
        while (i < _sans.length) {
            const wPly = i + 1;
            const bPly = i + 2;
            const w = _sans[i] || '';
            const b = _sans[i + 1] || '';
            html += `<tr>
                <td style="color:var(--text-muted);padding:2px 8px 2px 0;width:30px;text-align:right">${moveNum}.</td>
                <td class="move-cell" data-ply="${wPly}" onclick="PracticeViewer.goTo(${wPly})" style="padding:4px 8px;cursor:pointer;border-radius:4px">${w}</td>
                <td class="move-cell" data-ply="${bPly}" onclick="PracticeViewer.goTo(${bPly})" style="padding:4px 8px;cursor:pointer;border-radius:4px">${b}</td>
            </tr>`;
            moveNum++;
            i += 2;
        }
        html += '</table>';
        el.innerHTML = html;
        _highlight();
    }

    function _highlight() {
        document.querySelectorAll('#pv-moves .move-cell').forEach(c => {
            c.style.background = '';
            c.style.color = '';
        });
        const active = document.querySelector(`#pv-moves .move-cell[data-ply="${_ply}"]`);
        if (active) {
            active.style.background = 'var(--accent-light)';
            active.style.color = 'var(--accent-dim)';
            active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function goTo(ply) {
        if (!_fens.length) return;
        _ply = Math.max(0, Math.min(ply, _fens.length - 1));
        BoardManager.setPosition('pv-board', _fens[_ply]);
        AnnotationPanel.setPosition(_fens[_ply]);
        _highlight();
    }
    function first() { goTo(0); }
    function prev() { goTo(_ply - 1); }
    function next() { goTo(_ply + 1); }
    function last() { goTo(_fens.length - 1); }
    function flip() { _flipped = !_flipped; BoardManager.create('pv-board', _fens[_ply], { flipped: _flipped }); }

    async function editVerdict() {
        if (!_game) return;
        await Practice.editVerdict(_game.id);
        _load(_game.id);  // reload to show updated verdict
    }

    async function remove() {
        if (!_game) return;
        if (!confirm('Delete this practice game?')) return;
        const r = await fetch(`${API}/practice/${_game.id}`, { method: 'DELETE' });
        if (r.ok) { toast('Practice game deleted'); Navigation.cancelToFallback({ view: 'practice' }); }
        else toast('Delete failed', true);
    }

    // Keyboard nav — only when view is active and focus isn't in an input.
    document.addEventListener('keydown', e => {
        const v = document.getElementById('view-practice-viewer');
        if (!v || !v.classList.contains('active')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        else if (e.key === 'Home') { e.preventDefault(); first(); }
        else if (e.key === 'End') { e.preventDefault(); last(); }
    });

    return { open, _load, goTo, first, prev, next, last, flip, editVerdict, remove };
})();

window.PracticeViewer = PracticeViewer;
