// Reusable tag filter: search input + autocomplete + removable chips.
// One instance per view. Call TagFilter.mount({containerId, state, onChange}).
//
// state is a mutable object the caller owns: { tags: [] }. The component
// mutates state.tags and invokes onChange(state.tags) whenever the list
// changes (chip added/removed/cleared).
//
// Runtime sequence notes:
//  - keyup on input debounces 180ms then fetches /tags/?q=... (race: a newer
//    fetch must not be overwritten by a stale one; we track a request id).
//  - Enter commits the highlighted suggestion OR the raw input text.
//  - Clicking outside the dropdown closes it (mousedown on document).
//  - Chips have unique class so the container can also host the input.

(function () {
    const DEBOUNCE_MS = 180;

    async function fetchSuggestions(q) {
        if (!q || !q.trim()) return [];
        try {
            const res = await fetch(API + '/tags/?q=' + encodeURIComponent(q.trim()) + '&limit=15');
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    }

    function mount({ containerId, state, onChange, placeholder }) {
        const el = document.getElementById(containerId);
        if (!el) return;
        state.tags = state.tags || [];

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
        let highlight = -1;
        let reqId = 0;
        let debounceTimer = null;

        function renderChips() {
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
            if (!suggestions.length) { hideDropdown(); return; }
            dropdown.innerHTML = suggestions.map((s, i) =>
                `<div class="tagfilter-option ${i === highlight ? 'active' : ''}" data-name="${Html.escape(s.name)}">#${Html.escape(s.name)}</div>`
            ).join('');
            dropdown.style.display = 'block';
            dropdown.querySelectorAll('.tagfilter-option').forEach(opt => {
                opt.addEventListener('mousedown', e => {
                    e.preventDefault();
                    applyTag(opt.dataset.name);
                });
            });
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
            hideDropdown();
        }

        async function runSearch() {
            const q = input.value;
            const mine = ++reqId;
            const results = await fetchSuggestions(q);
            if (mine !== reqId) return; // stale response; ignore
            // Filter out already-applied tags
            suggestions = results.filter(r => !state.tags.includes(r.name));
            highlight = suggestions.length ? 0 : -1;
            renderDropdown();
        }

        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            if (!input.value.trim()) { suggestions = []; hideDropdown(); return; }
            debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!suggestions.length) return;
                highlight = (highlight + 1) % suggestions.length;
                renderDropdown();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!suggestions.length) return;
                highlight = (highlight - 1 + suggestions.length) % suggestions.length;
                renderDropdown();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (highlight >= 0 && suggestions[highlight]) {
                    applyTag(suggestions[highlight].name);
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
                renderChips();
                hideDropdown();
            },
            refresh: renderChips,
        };
    }


    window.TagFilter = { mount };
})();
