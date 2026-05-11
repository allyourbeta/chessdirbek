# Lichess Import: Bug Fix + UI Cleanup

This spec has two parts. **Part 1 must be fully working before Part 2 begins.** Do not start Part 2 if Part 1 is incomplete.

---

## Part 1: Fix the "Import as Puzzles" bug

### The bug

Currently, after a successful Lichess studies download, clicking "Import as Puzzles" produces a toast: "Failed to read PGN file." This happens even on immediate retry (within 1 second of download completing). The bug is reproducible 100% of the time.

### Root cause investigation (mandatory before fixing)

Before writing any fix, do the following:

1. Add temporary verbose logging to BOTH:
   - The download endpoint: log the exact path where the temp PGN file is written, log the timestamp, log the file size after writing
   - The "Import as Puzzles" endpoint: log the exact path it's looking for, log whether the file exists at that path, log the timestamp, log the working directory

2. Reproduce the bug locally and read the logs. The logs will reveal which of these is true:
   - Path mismatch: download writes to path X, import looks at path Y
   - File deleted: download writes the file successfully, but it's gone by the time import runs
   - Permissions: file exists but isn't readable
   - Something else entirely

3. Write down the root cause in a comment at the top of the changed file before fixing it.

This step is mandatory. Do not skip it. The bug has been "fixed" multiple times based on assumption rather than evidence and the fixes haven't worked.

### Mandatory architecture for the fix

The fix must use this approach. Do not implement an alternative.

**Each "Import as..." button does its own complete download + processing in a single request.** There is no shared temp file between the download endpoint and the import endpoints. There is no "two step" workflow on the backend.

The frontend flow becomes:
1. User enters username + token, clicks "Download Studies" → backend fetches studies, returns the PGN content directly in the response (or a summary + the PGN content cached briefly in memory keyed by a random token)
2. User clicks "Import as Puzzles" → backend either re-fetches from Lichess OR uses the in-memory cached PGN keyed by the token from step 1
3. User clicks "Import as Games" → same as step 2 but for games

The simplest implementation: **re-fetch from Lichess on each "Import as..." click.** The Lichess API is fast (~15 seconds for 14 studies) and idempotent. This eliminates ALL shared-state bugs by design.

To make this not feel slow to the user:
- Cache the most recent download result in a server-side dict keyed by a random session token (NOT by user ID — keep it stateless)
- The dict has a 10-minute expiration
- The "Import as Puzzles" / "Import as Games" buttons send the session token, and the backend tries the cache first, falling back to a fresh download if expired

If implementing the in-memory cache feels complex, just re-fetch. Correctness over performance for this use case.

### Required test that proves the bug is fixed

Add a test to `test_lichess_import.py` (or `test_puzzle_import.py`) named `test_import_as_puzzles_succeeds_after_download`:

```python
def test_import_as_puzzles_succeeds_after_download():
    """
    Reproduces the user-reported bug: download Lichess studies, then
    immediately import as puzzles. This must succeed.
    """
    # Mock Lichess API
    # 1. Trigger the download endpoint
    # 2. Wait 0 seconds (simulate immediate click)
    # 3. Trigger the "Import as Puzzles" endpoint
    # 4. Assert HTTP 200 (not 500)
    # 5. Assert puzzles were actually created in the test database
    # 6. Assert NO "Failed to read PGN file" error in any response or log
```

This test MUST pass at the end of Part 1. It is the proof that the bug is fixed.

Also add: `test_import_as_puzzles_succeeds_after_delay` — same as above but with a 30-second sleep between download and import. This proves the temp-file-expiration class of bug doesn't recur.

### Part 1 acceptance criteria

Do not move to Part 2 until ALL of these pass:

- [ ] Root cause of the bug is documented in a code comment
- [ ] Mandated architecture is implemented (each "Import as..." button does its own complete fetch+process, no shared temp file path)
- [ ] `test_import_as_puzzles_succeeds_after_download` passes
- [ ] `test_import_as_puzzles_succeeds_after_delay` passes
- [ ] Manually verified in browser: enter username + token → click "Download Studies" → wait for completion → click "Import as Puzzles" → puzzles are created → verify by visiting /puzzles tab and counting them
- [ ] Manually verified in browser: same flow but wait 1 minute between download and import → still works
- [ ] All existing tests still pass: python test.py && python test_games.py && python test_game_api.py && python test_practice.py && python test_lichess_import.py
- [ ] Verbose debug logging added during investigation is REMOVED from production code paths (or downgraded to debug-level so it doesn't spam normal logs)

### Commit Part 1 before starting Part 2

```bash
git add -A
git commit -m "Fix: 'Import as Puzzles' fails to read PGN file (root cause: [fill in])"
```

---

## Part 2: UI cleanup

Do not start until Part 1 is committed.

### Goal

Eliminate confusion on the Lichess Import page. At any moment, only the buttons relevant to the current stage should be visible. There should be one obvious primary action.

### Stages and required UI

The page exists in exactly four stages. Each stage has explicit visible elements. NOTHING ELSE should be visible.

**Stage A — Form (initial state)**

Visible:
- Page title: "Import from Lichess"
- Brief instructions
- Form: username field, token field, link to get token
- Buttons: "Download Studies" (primary, blue), "Back to Games" (secondary)

Hidden:
- Result summary
- Import action buttons
- Success state

Behavior:
- "Download Studies" requires both fields filled (button disabled if either is empty)
- "Back to Games" navigates to /games

**Stage B — Downloading (in progress)**

Visible:
- Page title
- Read-only display of entered username (so user remembers what they're downloading)
- Progress display: spinner + current status text ("Fetching study list…", "Downloading study X of Y: [name]")
- Button: "Cancel" (secondary, red text)

Hidden:
- Form fields (or disabled and dimmed)
- Result summary
- Import action buttons
- Success state

Behavior:
- "Cancel" aborts the download and returns to Stage A with form fields preserved
- Progress updates via SSE (existing mechanism)

**Stage C — Download complete, ready to import**

Visible:
- Page title
- Read-only display of username
- Result summary: "Downloaded N studies, M chapters total"
- Buttons (in this order): "Import as Puzzles" (primary, blue), "Import as Games" (secondary, outlined), "Start over" (tertiary, plain text link)

Hidden:
- Form fields
- Progress display
- Success state
- Any "Download Studies" button (you already downloaded, that action is meaningless here)

Behavior:
- "Import as Puzzles" → moves to Stage D
- "Import as Games" → moves to Stage D
- "Start over" → returns to Stage A, clears all state

**Stage D — Importing (in progress)**

Visible:
- Page title
- Read-only display of username
- Read-only display of result summary
- Progress display: spinner + status ("Creating puzzle 47 of 350…")
- The active import button is shown but disabled and shows a spinner
- The other import button is hidden (not just disabled — gone)
- "Cancel" button if cancellation is feasible; otherwise omit

Hidden:
- All other buttons
- Form
- Success state

**Stage E — Success**

Visible:
- Page title
- Big success message: "Imported N puzzles" or "Imported N games"
- Buttons: "Go to Puzzles" (primary, blue) [or "Go to Games" depending on what was imported], "Import more from Lichess" (secondary)

Hidden:
- Everything else

Behavior:
- "Go to Puzzles" → navigates to /puzzles
- "Import more from Lichess" → returns to Stage A with all state cleared

### Toast errors

Improve all error toasts on this page to include the actual underlying error message, not generic messages. Format:

```
[Action that failed]: [actual error from backend]
```

Examples:
- "Download failed: 401 Unauthorized — check your API token"
- "Puzzle import failed: Database constraint violation on position_type"
- NOT: "Failed to read PGN file" (with no further detail)

The actual backend error message comes from the response body. The frontend should extract it and display it.

### Loading states on buttons

When any button triggers an async action (download, import as puzzles, import as games):
- Disable the button immediately
- Show a small spinner inside the button
- Disable all other buttons that could conflict
- On completion (success or failure), re-enable everything appropriately

This prevents double-clicks producing duplicate downloads or imports.

### Part 2 acceptance criteria

- [ ] Page is in exactly one of Stages A, B, C, D, E at any moment — never an in-between state
- [ ] Each stage shows ONLY the elements listed for that stage. No leftover form, no leftover buttons.
- [ ] The "Download Studies" button does not appear after a successful download
- [ ] After a successful import, a clear "Imported N items" success state shows
- [ ] "Go to Puzzles" button appears after successful puzzle import and works
- [ ] All async buttons show loading states during operations
- [ ] Toast errors include the actual underlying error message
- [ ] All existing tests still pass: python test.py && python test_games.py && python test_game_api.py && python test_practice.py && python test_lichess_import.py
- [ ] Manual verification in browser: full happy path (Stage A → B → C → D → E → Go to Puzzles), no leftover UI artifacts
- [ ] Manual verification: cancel during download returns to Stage A with form preserved
- [ ] Manual verification: error during download shows useful error toast and returns to Stage A
- [ ] Manual verification: error during import shows useful error toast and returns to Stage C (so user can retry without re-downloading)

### Commit Part 2

```bash
git add -A
git commit -m "Clean up Lichess Import UI: explicit stage-based UI, single primary action per stage, useful error messages"
```

---

## Final integration check

After both parts are committed:

1. Open the app fresh
2. Go to Games → Import from Lichess
3. Enter username (`StanFurd`) and your API token
4. Click "Download Studies" — verify Stage B shows progress
5. Wait for download to complete — verify Stage C shows summary with two import buttons
6. Click "Import as Puzzles" — verify Stage D shows import progress, then Stage E shows success
7. Click "Go to Puzzles" — verify the puzzles tab now shows the imported puzzles
8. Click on a puzzle — verify it opens correctly with the position and solution
9. Verify each puzzle is tagged with the slugified study name (e.g., #tactics-missed)
10. Spot-check 3-5 puzzles to verify the FEN and solution look correct against the original Lichess study

If all 10 steps pass, the work is complete. Push:

```bash
git push
```

---

## Why this spec is structured this way

- Part 1 is the bug fix; Part 2 is the UI cleanup. Bug must be fixed first because UI changes are pointless on a non-functional flow.
- Mandatory investigation step prevents fix-by-assumption.
- Mandated architecture eliminates the entire bug class instead of fixing one symptom.
- Required test before claiming success prevents "works on my machine."
- Stage-based UI specification is unambiguous — Claude Code can't accidentally leave a stale button visible because every stage's visible elements are explicit.
- Manual verification steps are required because automated tests cannot catch UI artifacts.
- Acceptance criteria use checklists so Claude Code (and you) can verify completeness before commit.
