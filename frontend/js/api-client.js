const ApiClient = (function () {
    function _url(path, params) {
        const base = path.startsWith('/api') ? path : API + path;
        const query = new URLSearchParams();
        Object.entries(params || {}).forEach(function ([key, value]) {
            if (value == null || value === '') return;
            if (Array.isArray(value)) value.forEach(v => query.append(key, v));
            else query.append(key, value);
        });
        const qs = query.toString();
        return qs ? base + '?' + qs : base;
    }

    async function _parse(res) {
        const text = await res.text();
        if (!text) return null;
        try { return JSON.parse(text); } catch (_) { return text; }
    }

    async function request(method, path, body, options) {
        const opts = Object.assign({ method: method, headers: {} }, options || {});
        if (body !== undefined) {
            opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers);
            opts.body = JSON.stringify(body);
        }
        const res = await fetch(_url(path, opts.params), opts);
        const data = await _parse(res);
        if (!res.ok) {
            // Handle both string and object detail formats
            let message = 'Request failed';
            let existingId = null;
            if (data && data.detail) {
                if (typeof data.detail === 'string') {
                    message = data.detail;
                } else if (data.detail.message) {
                    message = data.detail.message;
                    existingId = data.detail.existing_id;
                }
            }
            const err = new Error(message);
            err.status = res.status;
            err.data = data;
            err.existingId = existingId;
            throw err;
        }
        return data;
    }

    async function streamRequest(method, path, body, signal) {
        const opts = { method: method, headers: {} };
        if (body !== undefined) {
            opts.headers = { 'Content-Type': 'application/json' };
            opts.body = JSON.stringify(body);
        }
        if (signal) {
            opts.signal = signal;
        }
        return await fetch(_url(path), opts);
    }

    return {
        get: function (path, params) { return request('GET', path, undefined, { params: params }); },
        post: function (path, body, options) { return request('POST', path, body, options); },
        put: function (path, body) { return request('PUT', path, body); },
        patch: function (path, body) { return request('PATCH', path, body); },
        delete: function (path) { return request('DELETE', path); },
        request: request,
        streamPost: function (path, body, signal) { return streamRequest('POST', path, body, signal); },
    };
})();

window.ApiClient = ApiClient;
