// Reusable tag filter: search input + autocomplete + removable chips.
// One instance per view. Call TagFilter.mount({containerId, state, onChange}).
//
// state is a mutable object the caller owns: { tags: [] }. The component
// mutates state.tags and invokes onChange(state.tags) whenever the list
// changes (chip added/removed/cleared).
//
// Opt-in option `searchPositions: true` (only position-list.js's category
// filter box uses this) additionally matches the query against position
// titles and lists them below the tags, under a "Positions" label. Tag
// and position results share one highlight index, so arrow keys move
// through both as a single list.
//
// Runtime sequence notes:
//  - keyup on input debounces 180ms then fetches /tags/?q=... (race: a newer
//    fetch must not be overwritten by a stale one; we track a request id).
//    With searchPositions on, the title lookup rides the same request id.
//  - Enter commits the highlighted tag or opens the highlighted position;
//    with nothing highlighted it commits the raw input text as a tag.
//  - Clicking outside the dropdown closes it (mousedown on document).
//  - Chips have unique class so the container can also host the input.

(function () {
    const DEBOUNCE_MS = 180;

    async function fetchSuggestions(q) {
        if (!q || !q.trim()) return [];
        try {
            return await ApiClient.get('/tags/', { q: q.trim(), limit: 15 });
        } catch (e) {
            return [];
        }
    }

    async function fetchPositionMatches(q, searchPositions) {
        if (!searchPositions || !q || !q.trim()) return [];
        try {
            return await ApiClient.get('/positions/', { title_q: q.trim(), limit: 8 });
        } catch (e) {
            return [];
        }
    }

    function categoryLabelFor(positionType) {
        const catKey = TYPE_TO_CATEGORY[positionType];
        const cat = catKey && CATEGORIES[catKey];
        return cat ? cat.label : positionType;
    }

    function mount({ containerId, state, onChange, placeholder, searchPositions }) {
        const el = document.getElementById(containerId);
        if (!el) return;
        state.tags = state.tags || [];

        // SAFE_INNER_HTML: Clearing element content
        el.innerHTML = '';
        el.classList.add('tagfilter');

        const chipsEl = document.createElement('div');
        chipsEl.className = 'tagfilter-chips';

        const inputWrap = document.createElement('div');
        inputWrap.className = 'tagfilter-input-wrap';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder || 'Filter by tag...';
        input.className = 'tagfilter-input';
        input.autocomplete = 'off';

        const dropdown = document.createElement('div');
        dropdown.className = 'tagfilter-dropdown';
        dropdown.style.display = 'none';

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'tagfilter-reset';
        resetBtn.textContent = 'All';
        resetBtn.title = 'Clear all filters';

        inputWrap.appendChild(input);
        inputWrap.appendChild(dropdown);
        el.appendChild(chipsEl);
        el.appendChild(inputWrap);
        el.appendChild(resetBtn);

        let suggestions = [];
        let positionResults = [];
        let highlight = -1;
        let reqId = 0;
        let debounceTimer = null;

        function renderChips() {
            // SAFE_INNER_HTML: Template with escaped content - Html.escape() used for tag names
            chipsEl.innerHTML = state.tags.length
                ? state.tags.map((t, i) =>
                    `<span class="tagfilter-chip">#${Html.escape(t)}<span class="tagfilter-chip-x" data-i="${i}" title="Remove">&times;</span></span>`
                ).join('')
                : '';
            chipsEl.querySelectorAll('.tagfilter-chip-x').forEach(x => {
                x.addEventListener('click', () => {
                    const i = +x.dataset.i;
                    state.tags.splice(i, 1);
                    renderChips();
                    if (onChange) onChange(state.tags);
                });
            });
            resetBtn.style.display = state.tags.length ? 'inline-flex' : 'none';
        }

        function hideDropdown() {
            dropdown.style.display = 'none';
            highlight = -1;
        }

        function renderDropdown() {
            if (!suggestions.length && !positionResults.length) { hideDropdown(); return; }
            let html = suggestions.map((s, i) =>
                `<div class="tagfilter-option" data-kind="tag" data-name="${Html.escape(s.name)}">#${Html.escape(s.name)}</div>`
            ).join('');
            if (positionResults.length) {
                html += '<div class="tagfilter-section">Positions</div>';
                html += positionResults.map((p, i) => {
                    const title = p.title || '(untitled)';
                    return `<div class="tagfilter-option tagfilter-pos" data-kind="position" data-id="${p.id}">` +
                        `<span>${Html.escape(title)}</span>` +
                        `<span class="tagfilter-pos-cat">${Html.escape(categoryLabelFor(p.position_type))}</span></div>`;
                }).join('');
            }
            // SAFE_INNER_HTML: Template with escaped content - Html.escape() used for all tag/position text
            dropdown.innerHTML = html;
            const options = dropdown.querySelectorAll('.tagfilter-option');
            options.forEach((opt, i) => {
                opt.classList.toggle('active', i === highlight);
                opt.addEventListener('mousedown', e => {
                    e.preventDefault();
                    if (opt.dataset.kind === 'position') {
                        openPosition(+opt.dataset.id);
                    } else {
                        applyTag(opt.dataset.name);
                    }
                });
            });
            dropdown.style.display = 'block';
        }

        function applyTag(name) {
            const clean = (name || '').trim().toLowerCase().replace(/^#/, '');
            if (!clean) return;
            if (!state.tags.includes(clean)) {
                state.tags.push(clean);
                renderChips();
                if (onChange) onChange(state.tags);
            }
            input.value = '';
            suggestions = [];
            positionResults = [];
            hideDropdown();
        }

        function openPosition(id) {
            Router.navigate({ view: 'positionDetail', id: id });
            input.value = '';
            suggestions = [];
            positionResults = [];
            hideDropdown();
        }

        async function runSearch() {
            const q = input.value;
            const mine = ++reqId;
            const [tagResults, posResults] = await Promise.all([
                fetchSuggestions(q),
                fetchPositionMatches(q, searchPositions),
            ]);
            if (mine !== reqId) return; // stale response; ignore
            // Filter out already-applied tags
            suggestions = tagResults.filter(r => !state.tags.includes(r.name));
            positionResults = posResults;
            highlight = (suggestions.length || positionResults.length) ? 0 : -1;
            renderDropdown();
        }

        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            if (!input.value.trim()) { suggestions = []; positionResults = []; hideDropdown(); return; }
            debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
        });

        input.addEventListener('keydown', e => {
            const total = suggestions.length + positionResults.length;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!total) return;
                highlight = (highlight + 1) % total;
                renderDropdown();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!total) return;
                highlight = (highlight - 1 + total) % total;
                renderDropdown();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (highlight >= 0 && highlight < suggestions.length) {
                    applyTag(suggestions[highlight].name);
                } else if (highlight >= suggestions.length && positionResults[highlight - suggestions.length]) {
                    openPosition(positionResults[highlight - suggestions.length].id);
                } else if (input.value.trim()) {
                    applyTag(input.value);
                }
            } else if (e.key === 'Escape') {
                hideDropdown();
            } else if (e.key === 'Backspace' && !input.value && state.tags.length) {
                state.tags.pop();
                renderChips();
                if (onChange) onChange(state.tags);
            }
        });

        input.addEventListener('focus', () => {
            if (input.value.trim()) runSearch();
        });

        document.addEventListener('mousedown', e => {
            if (!el.contains(e.target)) hideDropdown();
        });

        resetBtn.addEventListener('click', () => {
            if (!state.tags.length) return;
            state.tags.length = 0;
            renderChips();
            if (onChange) onChange(state.tags);
        });

        renderChips();

        return {
            clear() {
                state.tags.length = 0;
                input.value = '';
                suggestions = [];
                positionResults = [];
                renderChips();
                hideDropdown();
            },
            refresh: renderChips,
        };
    }


    window.TagFilter = { mount };
})();
