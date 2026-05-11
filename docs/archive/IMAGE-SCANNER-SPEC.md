# Image-to-FEN Scanner Spec

## Goal

Allow users to screenshot a chess diagram from a book, website, or PDF,
paste or upload it, and have it automatically converted to a FEN. The
FEN loads into the board editor for verification and saving.

## Approach

Use the Anthropic Claude API (vision) to read the chess position from the
image and return a FEN. The user's board editor provides the correction
step if Claude misreads any pieces.

---

## Backend

### New file: `backend/api/scan.py`

Create a new router with one endpoint:

```python
POST /api/scan-image
```

**Request body**: JSON with a `image` field containing a base64-encoded
image string, and an optional `media_type` field (default `image/png`).

```json
{
  "image": "iVBORw0KGgo...",
  "media_type": "image/png"
}
```

**What it does**:
1. Reads `ANTHROPIC_API_KEY` from environment variable
2. Sends the image to `https://api.anthropic.com/v1/messages` with this
   structure:
   - model: `claude-sonnet-4-20250514`
   - max_tokens: 300
   - messages: one user message with an image content block and a text
     content block containing the prompt

3. The prompt should be:

```
Look at this chess diagram. Determine the exact position of every piece
on the board. Return ONLY a valid FEN string, nothing else. No
explanation, no markdown, no backticks — just the FEN.

Rules:
- Use standard FEN notation: uppercase for white (KQRBNP), lowercase
  for black (kqrbnp)
- Rank 8 (top of board from White's perspective) comes first
- Use numbers for empty squares
- Separate ranks with /
- After the piece placement, add " w - - 0 1" (assume white to move,
  no castling rights, no en passant)
- If the board orientation is unclear, assume white is at the bottom
  (rank 1)
```

4. Parse the response, extract the text content
5. Validate the FEN using `python-chess` (`chess.Board(fen)` — if it
   throws, return a 422 error)
6. Return the FEN:

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
  "success": true
}
```

**Error handling**:
- Missing API key: return 500 with `"ANTHROPIC_API_KEY not configured"`
- API call fails: return 502 with `"Failed to analyze image"`
- FEN validation fails: return 422 with `"Could not determine a valid
  position from this image. Try a clearer screenshot."`

**Use httpx** (already in requirements.txt) to make the API call. Do NOT
add the `anthropic` Python SDK as a dependency.

### Register the router

In `backend/api/__init__.py`, add:
```python
from backend.api.scan import router as scan_router
```

In `backend/main.py`, add:
```python
app.include_router(scan_router, prefix="/api")
```

---

## Frontend

### Add a "Scan Image" button to the board editor

In `frontend/index.html`, in the editor view's right panel (the panel
with Turn to Move, FEN, Title, Tags), add a section at the TOP of the
panel, before "Turn to Move":

```html
<div class="scan-section" style="margin-bottom:var(--sp-4);padding-bottom:var(--sp-4);border-bottom:1px solid var(--border)">
  <button class="btn btn-sm" onclick="BoardEditor.scanImage()" id="scan-btn">
    Scan Image → FEN
  </button>
  <input type="file" id="scan-file-input" accept="image/*" style="display:none"
    onchange="BoardEditor.handleScanFile(this)">
  <div id="scan-status" class="text-muted" style="font-size:12px;margin-top:4px"></div>
</div>
```

### Add scan methods to BoardEditor

In `frontend/js/board-editor.js`, add these methods to the IIFE (before
the `return` statement):

```js
async function scanImage() {
    // Try clipboard first
    if (navigator.clipboard && navigator.clipboard.read) {
        try {
            var items = await navigator.clipboard.read();
            for (var item of items) {
                var imageType = item.types.find(function(t) {
                    return t.startsWith('image/');
                });
                if (imageType) {
                    var blob = await item.getType(imageType);
                    _uploadBlob(blob, imageType);
                    return;
                }
            }
        } catch (e) {
            // Clipboard access denied or no image — fall through to file picker
        }
    }
    // Fall back to file picker
    document.getElementById('scan-file-input').click();
}

function handleScanFile(input) {
    if (input.files && input.files[0]) {
        var file = input.files[0];
        _uploadBlob(file, file.type);
        input.value = '';
    }
}

async function _uploadBlob(blob, mediaType) {
    var status = document.getElementById('scan-status');
    var btn = document.getElementById('scan-btn');
    status.textContent = 'Analyzing image...';
    btn.disabled = true;

    try {
        var reader = new FileReader();
        var base64 = await new Promise(function(resolve, reject) {
            reader.onload = function() { resolve(reader.result.split(',')[1]); };
            reader.onerror = function() { reject(new Error('Failed to read file')); };
            reader.readAsDataURL(blob);
        });

        var res = await fetch(API + '/scan-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64, media_type: mediaType }),
        });

        if (res.ok) {
            var data = await res.json();
            _chess.load(data.fen);
            _turn = _chess.turn();
            var fen = _getFen();
            BoardManager.setPosition(BOARD_ID, fen);
            _updateTurnButtons();
            _updateFenDisplay();
            status.textContent = 'Position loaded — verify and adjust if needed';
            toast('Position scanned successfully');
        } else {
            var err = await res.json();
            status.textContent = err.detail || 'Scan failed';
            toast(err.detail || 'Scan failed', 'error');
        }
    } catch (e) {
        status.textContent = 'Error: ' + e.message;
        toast('Scan error', 'error');
    } finally {
        btn.disabled = false;
    }
}
```

Add these to the return object:
```js
return {
    // ...existing methods...
    scanImage: scanImage,
    handleScanFile: handleScanFile,
};
```

### Clipboard paste support

Also add a paste event listener so the user can just Cmd+V anywhere on
the editor page. Add this inside the `init` function:

```js
document.addEventListener('paste', function(e) {
    if (!document.getElementById('view-editor').classList.contains('active')) return;
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
            e.preventDefault();
            _uploadBlob(items[i].getAsFile(), items[i].type);
            return;
        }
    }
});
```

---

## Environment setup

The `ANTHROPIC_API_KEY` must be set as an environment variable before
starting the server. Add a note to CLAUDE.md under a new section:

```markdown
## Environment Variables

- `ANTHROPIC_API_KEY` — Required for the image-to-FEN scanner. Set before
  starting the server: `export ANTHROPIC_API_KEY=sk-ant-...`
```

---

## Files to create

1. `backend/api/scan.py` — new router with `POST /scan-image` endpoint

## Files to modify

1. `backend/api/__init__.py` — add scan_router import and export
2. `backend/main.py` — include scan_router
3. `frontend/index.html` — add scan section to editor panel
4. `frontend/js/board-editor.js` — add scanImage, handleScanFile,
   _uploadBlob methods and paste listener
5. `CLAUDE.md` — add environment variables section

## Files NOT to change

- All other files

---

## Verification

1. Set `ANTHROPIC_API_KEY` env var, restart server
2. Open the board editor
3. Screenshot a chess diagram from any source
4. Click "Scan Image → FEN" — should try clipboard first, then file picker
5. Select/paste the image — "Analyzing image..." appears
6. After a few seconds, pieces appear on the board
7. FEN field updates
8. Verify the position matches the original diagram
9. Adjust any misread pieces using the palette
10. Save as tabiya or tactic — works normally
11. Test Cmd+V paste directly on the editor page with an image in clipboard
12. Test with a bad image (text screenshot) — should show error message
13. No console errors
14. All other features still work
