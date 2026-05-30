// Board-image -> FEN import + an in-browser debug panel (prototype).
//
// Lets you paste/upload a chessboard image in the Add view; it calls the local
// backend's /api/ocr, fills #fen-input, renders the board, and aligns orientation.
// The debug panel surfaces status, downloads the model, and shows raw FEN/errors
// inline so you never have to touch the terminal to iterate.
//
// No raw fetch (uses ApiClient); writes only textContent (no innerHTML).
// SAFE_INNER_HTML: this module assigns no innerHTML.
const OcrImport = (function () {
    function _out(value) {
        const el = document.getElementById('ocr-debug-out');
        if (!el) return;
        el.textContent = (typeof value === 'string') ? value : JSON.stringify(value, null, 2);
    }

    function _blobToBase64(blob) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
            reader.onerror = function () { reject(new Error('Could not read the image')); };
            reader.readAsDataURL(blob);
        });
    }

    async function _recognizeAndFill(blob, btn) {
        if (!blob) { toast('No image found — copy or pick a board first', 'warn'); return; }
        if (btn) setButtonLoading(btn, true);
        _out('Recognizing…');
        try {
            const imageBase64 = await _blobToBase64(blob);
            const res = await ApiClient.post('/api/ocr', { image_base64: imageBase64 });
            const fen = res && res.fen;
            _out(res);
            if (!fen) { toast('No board recognized in that image', 'warn'); return; }
            const input = document.getElementById('fen-input');
            if (input) input.value = fen;
            if (typeof loadFen === 'function') loadFen();
            const wantBlack = res.orientation === 'black';
            if (window.BoardManager && BoardManager.isFlipped('board') !== wantBlack) {
                BoardManager.flip('board');
            }
            toast('Board recognized — check it, then Save');
        } catch (err) {
            const detail = (err && (err.message || (err.data && err.data.detail))) || 'Could not read that image';
            _out('ERROR (' + (err && err.status) + '): ' + detail);
            toast(detail, 'error');
        } finally {
            if (btn) setButtonLoading(btn, false);
        }
    }

    // Button trigger: pull an image straight off the clipboard.
    async function pasteFromButton(btn) {
        if (!navigator.clipboard || !navigator.clipboard.read) {
            toast('Clipboard image access unavailable — use the file picker below', 'warn');
            return;
        }
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const type = item.types.find(function (t) { return t.startsWith('image/'); });
                if (type) { return _recognizeAndFill(await item.getType(type), btn); }
            }
            toast('No image on the clipboard — copy a board first', 'warn');
        } catch (err) {
            toast('Clipboard read was blocked — use the file picker below', 'warn');
        }
    }

    // File-picker trigger (most reliable for iterating).
    function recognizeFile(input) {
        const file = input && input.files && input.files[0];
        if (file) _recognizeAndFill(file, null);
    }

    // Ctrl+V trigger: only on the Add view, only for image payloads.
    function _onPaste(event) {
        const addView = document.getElementById('view-add');
        if (!addView || !addView.classList.contains('active')) return;
        const items = (event.clipboardData && event.clipboardData.items) || [];
        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                event.preventDefault();
                _recognizeAndFill(item.getAsFile(), null);
                return;
            }
        }
    }

    async function checkStatus() {
        _out('Checking…');
        try { _out(await ApiClient.get('/api/ocr/status')); }
        catch (err) { _out('ERROR: ' + ((err && err.message) || err)); }
    }

    async function downloadModels(btn) {
        if (btn) setButtonLoading(btn, true);
        _out('Downloading models… (this can take a minute)');
        try {
            const res = await ApiClient.post('/api/ocr/download-models', {});
            _out(res);
            toast(res && res.models_present ? 'Models ready' : 'Download finished but no models found', res && res.models_present ? undefined : 'warn');
        } catch (err) {
            _out('ERROR: ' + ((err && err.message) || err));
            toast('Model download failed — see the debug box', 'error');
        } finally {
            if (btn) setButtonLoading(btn, false);
        }
    }

    function init() {
        document.addEventListener('paste', _onPaste);
        const file = document.getElementById('ocr-file');
        if (file) file.addEventListener('change', function () { recognizeFile(file); });
    }

    return {
        init: init,
        pasteFromButton: pasteFromButton,
        checkStatus: checkStatus,
        downloadModels: downloadModels,
    };
})();

window.OcrImport = OcrImport;
document.addEventListener('DOMContentLoaded', function () { OcrImport.init(); });
