// Practice sessions (Phase 10) — pure rendering helpers.
// Split from practice.js to honor the 300-line limit.

const PracticeUI = (function () {

    // Map (verdict, user_color) -> standard chess result notation.
    // Abandoned / unknown -> em-dash. Draw -> ½-½. Wins/losses resolved
    // to the absolute "1-0" / "0-1" from the game's perspective.
    function formatResult(verdict, userColor) {
        if (!verdict) return '—';
        if (verdict === 'draw') return '½-½';
        if (verdict === 'abandoned') return '—';
        const isWhite = userColor === 'white';
        if (verdict === 'win') return isWhite ? '1-0' : '0-1';
        if (verdict === 'loss') return isWhite ? '0-1' : '1-0';
        return '—';
    }

    function resultClass(verdict) {
        if (verdict === 'win') return 'correct';
        if (verdict === 'loss') return 'incorrect';
        return 'text-muted';
    }

    function showSaveModal(active, pending) {
        const m = document.getElementById('practice-save-modal');
        if (!m) return;
        const body = document.getElementById('practice-save-body');
        const verdict = Practice.guessVerdict();
        const suggestedResult = formatResult(verdict, active.userColor);
        body.innerHTML = '<p style="margin-bottom:8px"><strong>' + MoveCounts.formatMoveCountFromPlies(pending.moveCount, true) + '</strong> as ' + Html.escape(active.userColor) + ' vs Stockfish (' + Html.escape(active.level) + ')</p>' +
            '<p class="text-muted" style="font-size:12px;margin-bottom:12px">Suggested result: <strong>' + suggestedResult + '</strong>' +
            (verdict !== '?' ? ' <span style="margin-left:6px">(' + verdict + ')</span>' : '') + '</p>' +
            '<label>Notes (optional)</label><textarea id="practice-save-notes" placeholder="Your reflections on this game..."></textarea>';
        m.style.display = 'flex';
    }

    function hideSaveModal() {
        const m = document.getElementById('practice-save-modal');
        if (m) m.style.display = 'none';
    }

    function renderHistory(stats, games, tree, append = false) {
        const statsEl = document.getElementById('practice-stats');
        const listEl = document.getElementById('practice-recent-list');
        const treeEl = document.getElementById('practice-tree');
        if (statsEl) _renderStats(statsEl, stats);
        if (listEl) _renderRecent(listEl, games, append);
        if (treeEl) _renderTree(treeEl, tree);
    }

    function _renderStats(el, s) {
        if (!s || !s.total_games) {
            el.innerHTML = '<p class="text-muted" style="font-size:13px">No practice games yet</p>';
            return;
        }
        const wr = (s.win_rate * 100).toFixed(0);
        const decided = s.wins + s.draws + s.losses;
        let html = `
            <div style="font-size:13px;margin-bottom:6px">
                <strong>${s.total_games}</strong> games &mdash;
                <span class="correct">${s.wins}W</span> /
                ${s.draws}D /
                <span class="incorrect">${s.losses}L</span>
                ${s.abandoned ? `(${s.abandoned} abandoned)` : ''}
                &middot; win rate <strong>${wr}%</strong>
            </div>
            <div style="font-size:12px;margin-bottom:4px">
                vs Stockfish: <strong>${s.wins}/${decided}</strong> wins (${wr}%)
            </div>
            <div class="text-muted" style="font-size:12px;margin-bottom:8px">
                Avg ${MoveCounts.formatAverageMoveCountFromPlies(s.avg_move_count)}, avg final eval
                ${s.avg_final_eval != null ? s.avg_final_eval.toFixed(2) : '—'}
            </div>`;
        if (s.by_engine_level && s.by_engine_level.length > 1) {
            html += `<div class="stats-breakdown">
                <details style="font-size:12px">
                    <summary class="text-muted" style="cursor:pointer">Breakdown by level</summary>
                    <div style="padding:4px 0 0 12px;margin-top:4px">`;
            s.by_engine_level.forEach(b => {
                const br = (b.win_rate * 100).toFixed(0);
                const bd = b.wins + b.draws + b.losses;
                html += `<div style="margin-bottom:2px">Stockfish <strong>${b.engine_level}</strong>: ${b.wins}/${bd} wins (${br}%)</div>`;
            });
            html += '</div></details></div>';
        }
        el.innerHTML = html;
    }

    function _renderRecent(el, games, append = false) {
        if (!append && (!games || !games.length)) { 
            // Check if this is because of filters
            const hasFilters = document.getElementById('practice-verdict-filter')?.value || 
                              document.getElementById('practice-level-filter')?.value;
            if (hasFilters) {
                el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">No games match these filters. Try adjusting your filters or <a href="#" onclick="Practice.clearFilters();return false">clear filters</a>.</div>';
            } else {
                el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">No practice games yet. Start practicing to see your history here.</div>';
            }
            return; 
        }
        if (!games || !games.length) return;
        
        const rows = games.map(g => {
            const v = g.user_verdict || g.engine_verdict;
            const vcls = resultClass(v);
            const result = formatResult(v, g.user_color);
            const date = g.created_at ? new Date(g.created_at).toLocaleDateString() : '';
            return `<div class="pos-item" style="padding:8px 12px;margin-bottom:8px;font-size:12px;cursor:pointer;border:1px solid var(--grey-100);border-radius:4px" onclick="PracticeViewer.open(${g.id})" title="Click to review this game">
                <span style="flex:1">${Html.escape(date)} &mdash; ${Html.escape(g.user_color)} vs Stockfish, ${MoveCounts.formatMoveCountFromPlies(g.move_count, true)} &middot;
                    <span id="verdict-display-${g.id}" class="${vcls}" style="cursor:pointer;position:relative;text-decoration:underline;text-decoration-color:transparent;transition:text-decoration-color 0.2s" onmouseover="this.style.textDecorationColor='currentColor'" onmouseout="this.style.textDecorationColor='transparent'" onclick="event.stopPropagation();PracticeUI.showInlineVerdictEdit(${g.id}, '${g.user_color}')" title="Click to edit verdict">
                        <strong>${result}</strong>
                    </span>
                </span>
                <button id="delete-btn-${g.id}" class="btn btn-sm btn-ghost" style="color:var(--text-muted);transition:color 0.2s" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-muted)'" onclick="event.stopPropagation();PracticeUI.showInlineDelete(${g.id})" aria-label="Delete practice game">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>`;
        }).join('');
        
        if (append) {
            el.innerHTML += rows;
        } else {
            el.innerHTML = rows;
        }
    }

    function _renderTree(el, tree) {
        if (!tree || !tree.moves || !tree.moves.length) { el.innerHTML = ''; return; }
        const rows = tree.moves.map(m => {
            const wr = (m.win_rate * 100).toFixed(0);
            return `<div class="tree-row" style="display:flex;gap:8px;padding:3px 6px;font-size:12px">
                <span style="min-width:50px;font-weight:600">${m.san}</span>
                <span class="text-muted">${m.games} games</span>
                <span style="margin-left:auto">${wr}% win</span>
            </div>`;
        }).join('');
        el.innerHTML = rows;
    }

    function renderPositionsList(summaries) {
        const el = document.getElementById('practice-positions-list');
        if (!el) return;
        if (!summaries || !summaries.length) {
            el.innerHTML = `<div class="empty-state"><p>No practice games yet</p><p>Open a saved position and click "Practice this position".</p></div>`;
            return;
        }
        el.innerHTML = summaries.map(s => {
            const wr = (s.win_rate * 100).toFixed(0);
            const last = s.last_played ? new Date(s.last_played).toLocaleDateString() : '—';
            return `<div class="pos-item" onclick="Router.navigate({view:'positionDetail',id:${s.position_id}})">
                ${renderMiniBoard(s.fen)}
                <div class="title">${Html.escape(s.title || 'Untitled')}</div>
                <div class="text-muted" style="font-size:12px">${s.total_games} games &middot; ${wr}% win &middot; ${last}</div>
            </div>`;
        }).join('');
    }

    
    function populateLevelSelect(engineLevels) {
        const sel = document.getElementById('practice-level');
        if (!sel || !engineLevels) return;
        if (sel.options.length) return;
        Object.keys(engineLevels).forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            const levelName = k.charAt(0).toUpperCase() + k.slice(1);
            opt.textContent = `Stockfish ${levelName} (d${engineLevels[k].depth}, skill ${engineLevels[k].skill})`;
            sel.appendChild(opt);
        });
        sel.value = 'medium';
    }
    

    return {
        showSaveModal, hideSaveModal, renderHistory,
        renderPositionsList, populateLevelSelect,
        formatResult,
        fullMoveCountFromPlies: MoveCounts.fullMoveCountFromPlies,
        formatMoveCountFromPlies: MoveCounts.formatMoveCountFromPlies,
        formatAverageMoveCountFromPlies: MoveCounts.formatAverageMoveCountFromPlies,
        resultClass,
    };
})();

window.PracticeUI = PracticeUI;
