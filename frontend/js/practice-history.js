const PracticeHistory = (function () {
    let currentFilters = { verdict: '', engine_level: '', sort: 'recent' };
    let currentOffset = 0;
    let totalCount = 0;
    const PAGE_SIZE = 10;

    async function load(positionId, append = false) {
        if (!positionId) return;
        try {
            const params = new URLSearchParams({
                root_position_id: positionId,
                limit: PAGE_SIZE,
                offset: append ? currentOffset : 0,
                sort: currentFilters.sort || 'recent'
            });
            if (currentFilters.verdict) params.append('verdict', currentFilters.verdict);
            if (currentFilters.engine_level) params.append('engine_level', currentFilters.engine_level);

            const statsParams = new URLSearchParams();
            if (currentFilters.verdict) statsParams.append('verdict', currentFilters.verdict);
            if (currentFilters.engine_level) statsParams.append('engine_level', currentFilters.engine_level);

            const [stats, gamesData, tree] = await Promise.all([
                ApiClient.get(`/practice/stats/${positionId}`, Object.fromEntries(statsParams.entries())),
                ApiClient.get(`/practice/`, Object.fromEntries(params.entries())),
                ApiClient.get(`/practice/tree/${positionId}`),
            ]);

            const games = gamesData.games || gamesData;
            totalCount = gamesData.total_count || games.length;

            if (!append) currentOffset = 0;
            currentOffset += games.length;

            const filterInfo = document.getElementById('practice-filter-info');
            const filterText = document.getElementById('practice-filter-text');
            if (currentFilters.verdict || currentFilters.engine_level) {
                filterInfo.style.display = 'block';
                filterText.textContent = 'Showing ' + stats.total_games + ' of ' + totalCount + ' games (filtered)';
            } else {
                filterInfo.style.display = 'none';
            }

            const paginationEl = document.getElementById('practice-pagination');
            if (paginationEl) {
                paginationEl.style.display = currentOffset < totalCount ? 'block' : 'none';
            }

            PracticeUI.renderHistory(stats, games, tree, append);
        } catch (_) {
            const el = document.getElementById('practice-stats');
            // SAFE_INNER_HTML: Static error message template
            if (el) el.innerHTML = '<p class="text-muted">Could not load practice history</p>';
        }
    }

    function applyFilters() {
        const verdictEl = document.getElementById('practice-verdict-filter');
        const levelEl = document.getElementById('practice-level-filter');
        const sortEl = document.getElementById('practice-sort');
        currentFilters = {
            verdict: verdictEl ? verdictEl.value : '',
            engine_level: levelEl ? levelEl.value : '',
            sort: sortEl ? sortEl.value : 'recent'
        };
        currentOffset = 0;
        if (AppState.currentDetailId) {
            load(AppState.currentDetailId, false);
        }
    }

    function clearFilters() {
        document.getElementById('practice-verdict-filter').value = '';
        document.getElementById('practice-level-filter').value = '';
        document.getElementById('practice-sort').value = 'recent';
        applyFilters();
    }

    function showMore() {
        if (AppState.currentDetailId) {
            load(AppState.currentDetailId, true);
        }
    }

    async function editVerdict(id) {
        const game = await ApiClient.get(`/practice/${id}`);
        const userColor = game.user_color;
        const options = ['1-0 (White wins)', '0-1 (Black wins)', '½-½ (Draw)', '— (Abandoned)'];
        const v = prompt('Select verdict:\n' + options.join('\n'), '');
        if (v == null) return;
        let verdict = '';
        if (v.includes('1-0')) verdict = userColor === 'white' ? 'win' : 'loss';
        else if (v.includes('0-1')) verdict = userColor === 'black' ? 'win' : 'loss';
        else if (v.includes('½-½')) verdict = 'draw';
        else if (v.includes('—')) verdict = 'abandoned';
        else { toast('Invalid verdict', true); return; }
        try {
            await ApiClient.put(`/practice/${id}`, { user_verdict: verdict });
            toast('Verdict updated');
            if (AppState.currentDetailId) load(AppState.currentDetailId);
        } catch (_) {
            toast('Update failed', true);
        }
    }

    async function deleteGame(id) {
        if (!confirm('Delete this practice game?')) return;
        try {
            await ApiClient.delete(`/practice/${id}`);
            toast('Practice game deleted');
            if (AppState.currentDetailId) load(AppState.currentDetailId);
            const cur = Router.current();
            if (cur && cur.view === 'practice') Practice.loadPracticeTab();
        } catch (_) {
            toast('Delete failed', true);
        }
    }

    return { load, applyFilters, clearFilters, showMore, editVerdict, deleteGame };
})();

window.PracticeHistory = PracticeHistory;
