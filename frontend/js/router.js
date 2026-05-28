// Client-side router. Single source of truth for "what view are we on".
//
// Route object shape:
//   { view: 'positions'|'positionDetail'|'addPosition'|'games'|'gameDetail'
//         | 'gameImport'|'collections'|'collectionDetail'|'search'|'quiz',
//     id?: number, params?: object }
//
// Failure modes guarded against:
//   - popstate must only RENDER, never pushState (else back-forward loops).
//   - Filter handlers call navigate(); during render, filter UIs re-mount
//     from state — they must NOT fire onChange on mount (tagfilter.js
//     only fires on user events, verified).
//   - During render, _isRendering flag suppresses stray navigate() calls
//     from filter setters so URL stays stable mid-render.

const Router = (function () {
    let _isRendering = false;

    function _qs(obj) {
        const parts = [];
        Object.entries(obj || {}).forEach(([k, v]) => {
            if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
            if (Array.isArray(v)) v.forEach(x => parts.push(`${k}=${encodeURIComponent(x)}`));
            else parts.push(`${k}=${encodeURIComponent(v)}`);
        });
        return parts.length ? '?' + parts.join('&') : '';
    }

    function _parseQuery(search) {
        const out = { tags: [] };
        if (!search) return out;
        const s = search.startsWith('?') ? search.slice(1) : search;
        s.split('&').filter(Boolean).forEach(pair => {
            const [k, v] = pair.split('=');
            const key = decodeURIComponent(k);
            const val = v == null ? '' : decodeURIComponent(v);
            if (key === 'tag' || key === 'tags') out.tags.push(val);
            else out[key] = val;
        });
        return out;
    }

    // Parse URL -> route object
    function parse(pathname, search) {
        const path = pathname || '/';
        const q = _parseQuery(search || '');
        const parts = path.split('/').filter(Boolean);
        // '/' or no parts -> tabiyas
        if (!parts.length) return { view: 'tactics', params: q };

        const [a, b] = parts;
        // Check if 'a' is a known category key
        if (CATEGORIES[a]) {
            if (!b) return { view: a, params: q };
            if (b === 'new') return { view: 'addPosition', params: Object.assign(q, { type: CATEGORIES[a].positionType }) };
            const id = parseInt(b, 10);
            if (!isNaN(id)) return { view: 'positionDetail', id, positionType: CATEGORIES[a].positionType, params: q };
        }
        // Legacy redirect for old tabiyas URL (plural to singular)
        if (a === 'tabiyas') {
            if (!b) return { view: 'tabiya', params: q };
            if (b === 'new') return { view: 'addPosition', params: Object.assign(q, { type: 'tabiya' }) };
            const id = parseInt(b, 10);
            if (!isNaN(id)) return { view: 'positionDetail', id, positionType: 'tabiya', params: q };
        }
        // Legacy positions URL support
        if (a === 'positions') {
            if (!b) return { view: 'tabiya', params: q };
            if (b === 'new') return { view: 'addPosition', params: Object.assign(q, { type: 'tabiya' }) };
            const id = parseInt(b, 10);
            if (!isNaN(id)) return { view: 'positionDetail', id, positionType: 'tabiya', params: q };
        }
        if (a === 'games') {
            if (!b) return { view: 'games', params: q };
            if (b === 'import') return { view: 'gameImport', params: q };
            const id = parseInt(b, 10);
            if (!isNaN(id)) return { view: 'gameDetail', id, params: q };
        }
        if (a === 'collections') {
            if (!b) return { view: 'collections', params: q };
            const id = parseInt(b, 10);
            if (!isNaN(id)) return { view: 'collectionDetail', id, params: q };
        }
        if (a === 'search') return { view: 'search', params: q };
        if (a === 'practice') {
            if (b === 'games') {
                const id = parseInt(parts[2], 10);
                if (!isNaN(id)) return { view: 'practiceGameDetail', id, params: q };
            }
            return { view: 'practice', params: q };
        }
        if (a === 'bulk-add') return { view: 'bulkAdd', params: q };
        if (a === 'editor') return { view: 'editor', params: q };
        if (a === 'play') return { view: 'play', params: q };
        if (a === 'replay') return { view: 'replay', params: q };
        if (a === 'add') return { view: 'addPosition', params: q };

        return { view: 'tactics', params: q };
    }

    // route object -> URL path + query
    function build(route) {
        const p = route.params || {};
        // Handle category views generically
        if (CATEGORIES[route.view]) {
            return CATEGORIES[route.view].urlPrefix + _qs(p);
        }
        
        switch (route.view) {
            case 'positionDetail': 
                var catKey = TYPE_TO_CATEGORY[route.positionType] || 'tabiya';
                return CATEGORIES[catKey].urlPrefix + '/' + route.id + _qs(p);
            case 'addPosition':    
                var addType = p && p.type ? p.type : 'tabiya';
                var addCatKey = Object.keys(CATEGORIES).find(k => CATEGORIES[k].positionType === addType) || 'tabiya';
                return CATEGORIES[addCatKey].urlPrefix + '/new' + _qs(p);
            case 'games':          return '/games' + _qs(p);
            case 'gameDetail':     return `/games/${route.id}` + _qs(p);
            case 'gameImport':     return '/games/import' + _qs(p);
            case 'collections':    return '/collections' + _qs(p);
            case 'collectionDetail': return `/collections/${route.id}` + _qs(p);
            case 'search':         return '/search' + _qs(p);
            case 'bulkAdd':        return '/bulk-add' + _qs(p);
            case 'editor':         return '/editor' + _qs(p);
            case 'play':           return '/play' + _qs(p);
            case 'replay':         return '/replay' + _qs(p);
            case 'practice':       return '/practice' + _qs(p);
            case 'practiceGameDetail': return `/practice/games/${route.id}` + _qs(p);
            default:               return '/tactics';
        }
    }

    function navigate(route, opts) {
        if (_isRendering) return;
        opts = opts || {};
        const url = build(route);
        if (opts.replace) history.replaceState(route, '', url);
        else {
            history.pushState(route, '', url);
            if (window.Navigation) Navigation.recordPush();
        }
        render(route);
    }

    // Replace the URL without pushing a history entry or re-rendering.
    // Used by filter handlers that already reloaded data — only URL needs sync.
    function syncUrl(route) {
        if (_isRendering) return;
        const url = build(route);
        history.replaceState(route, '', url);
    }

    function render(route) {
        _isRendering = true;
        try {
            renderRoute(route);
        } finally {
            _isRendering = false;
        }
    }

    function _onPopState(e) {
        if (window.Navigation) Navigation.recordPop();
        const route = (e && e.state) || parse(location.pathname, location.search);
        render(route);
    }

    function init() {
        window.addEventListener('popstate', _onPopState);
        const route = parse(location.pathname, location.search);
        // Replace so the initial entry has a state object attached.
        history.replaceState(route, '', build(route));
        if (window.Navigation) Navigation.reset();
        render(route);
    }

    function current() {
        return parse(location.pathname, location.search);
    }

    function isRendering() { return _isRendering; }

    return { parse, build, navigate, syncUrl, render, init, current, isRendering };
})();

window.Router = Router;
