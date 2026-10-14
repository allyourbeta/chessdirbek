# SPEC: Duplicate message names the position + search positions by name

Version 01 · written 2026-10-13 12:55 PDT · checked against SPEC_CHECKLIST.md (rules 1-14 and the 2026-10-04 additions)

## What Ashish will see change (visible decisions)

1. **Hotkey capture (Option-Command-V), duplicate board.** The Mac notification now reads `Already saved as swift-otter` instead of `Already saved (duplicate position)`.
2. **Every other duplicate message in the app** uses the same wording: add form, board editor, save-to-category buttons, save-from-game modal. Add form still opens the existing position afterwards, as today.
3. **Save-from-game modal.** A duplicate currently shows `[object Object]`. It will show the same `Already saved as …` text.
4. **Bulk add results.** `Duplicates skipped: 2` becomes `Duplicates skipped: 2 (swift-otter, brave-cottage)`.
5. **Category list filter box (Tactics, Tabiya, Endings, Strategy only).** Placeholder changes from `Filter by tag...` to `Tag or position name...`. The dropdown shows matching tags first, then a small "Positions" label, then up to 8 positions whose title matches, each with its category on the right. Clicking a position opens it. Target: `docs/targets/position-search-dropdown.html`.
6. A position with no title shows as `(untitled)` in both the message and the dropdown.

Nothing else on screen changes. The tag boxes in the editor, add form, bulk add, game import and save modal stay tag-only.

No product decisions are left open.

## Environment facts checked (source of each claim)

- The "two-word code" is the position `title`, auto-filled by `generate_placeholder_name()` when blank. `backend/services/name_service.py:1-9`, `backend/api/positions.py:59`, `:208`. There is no separate code column.
- Duplicate check and 409 body: `backend/api/positions.py:44-56`. Body is `{"detail": {"message": "This position already exists (in <type>).", "existing_id": N}}`. No title is returned.
- Hotkey path: `scripts/chessdirbek_capture.sh` posts to `http://localhost:8000/api/ocr/import`. The 409 branch is line 82, a fixed string. `/api/ocr/import` reuses `create_position` (`backend/api/ocr.py:121-145`), so it returns the same 409 body.
- ApiClient copies `detail.message` into `err.message` and `detail.existing_id` into `err.existingId`. `frontend/js/api-client.js:28-44`.
- 409 call sites: `position-form.js:54-57`, `board-editor.js:213-214`, `shared.js:214-215`, `game-viewer.js:146` (passes the detail object to `toast`, hence `[object Object]`), `bulk-add.js:85-86` and `:106`.
- List endpoint `GET /api/positions/` accepts `search`, matching title OR notes. `backend/api/positions.py:118-151`. No limit parameter.
- The category filter box is `TagFilter.mount` in `position-list.js:29-42`. TagFilter is also mounted in `board-editor.js:57`, `import.js:25`, `bulk-add.js:13`, `position-form.js:10`, `game-viewer.js:120`, `games.js:49`. It only fetches `/tags/?q=`. `frontend/js/tagfilter.js:18-25`.
- Category labels live in `CATEGORIES`, `frontend/js/state.js:44-47` (puzzle→Tactics, endgame→Endings). The backend has no label map.
- Opening a position: `Router.navigate({ view: 'positionDetail', id })`, as in `position-form.js:57`.
- Line counts (300-line limit): tagfilter.js 194, position-list.js 292, shared.js 276, board-editor.js 259, position-form.js 255, bulk-add.js 132, positions.py 270.
- Tests: pytest with in-memory SQLite via `tests/conftest.py`. DB location honours `CHESSDIRBEK_DB_URL` (`backend/database.py:9`). Playwright is installed (`tests/test_frontend_smoke_comprehensive.py:10`). Full suite: `./test_smoke.sh`.
- Project rules read: CLAUDE.md and AGENTS.md. Relevant: 300-line limit, no direct fetch outside api-client.js, every innerHTML needs a `SAFE_INNER_HTML` comment, no duplicated category-label or notification logic, Tenzing backlog commands.
- Live server runs on port 8000. Port 8001 appears nowhere in the repo.

## Rules for this run

- Start: `git status` must be clean. Record `git rev-parse HEAD` in the report.
- Do not run `scripts/chessdirbek_capture.sh`. It uses `osascript`. Never use `osascript`, `killall` or `sudo`.
- Do not touch the live database `chessdirbek.db` or the server on port 8000.
- Test economy: run only the tests for the part you just changed. Run `./test_smoke.sh` once, at the end.
- If a 300-line limit would be crossed, split per CLAUDE.md. Do not ask.
- File findings with `tenzing backlog add dq "<title>"` as they happen. A failing tenzing command is not a reason to stop.

## Part 1 — Backend sends the title (tier: fast · ~10 min)

1. In the 409 in `create_position`, add `"existing_title": existing.title` to `detail`.
2. Set `message` to `Already saved as <title>`. If the title is empty or null, use `Already saved as (untitled)`. Drop the category from the message.
3. Add optional query params to `list_positions`: `title_q: str | None = None` (case-insensitive substring on title only) and `limit: int | None = None`. Leave `search` behaviour unchanged. `list_puzzles` and `list_tabiyas` need no change.
4. Tests in `tests/test_basic_api.py`:
   - Duplicate POST returns 409 with `existing_title` equal to the first position's title, and the message contains it.
   - Duplicate of an auto-named position (title omitted) returns its generated name.
   - Duplicate via `POST /api/ocr/import` is NOT tested here (needs OCR models). The shared code path is the evidence.
   - `title_q=otter&limit=1` returns only title matches, at most one, and ignores a position whose notes contain "otter".
5. Red before green: run the new duplicate test before editing `positions.py` and show it fail. Then make it pass.

Command: `python -m pytest tests/test_basic_api.py -q`

## Part 2 — Hotkey notification (tier: fast · ~10 min)

1. New file `scripts/capture_message.py`. It reads the response body on stdin and prints one line for the notification. On a 409 it prints `detail.message`. It strips `"` and `\` so the AppleScript string cannot break. On any parse failure it prints `Already saved (duplicate position)`.
2. In `chessdirbek_capture.sh` line 82, replace the fixed text with the helper's output: `MSG=$(printf '%s' "$BODY" | python3 "$(dirname "$0")/capture_message.py")`, then `notify "chessdirbek" "$MSG"`.
3. Apply the same quote-stripping to `$TITLE` on the success line 80. Same defect, one line.
4. Tests in new `tests/test_capture_message.py`: real 409 body from Part 1's test client; a title containing a double quote; garbage input gives the fallback. Run the helper as a subprocess, the way the shell script does.

Command: `python -m pytest tests/test_capture_message.py -q`

## Part 3 — In-app duplicate messages (tier: fast · ~10 min)

1. `api-client.js`: also copy `detail.existing_title` to `err.existingTitle`.
2. `position-form.js:55`: `toast(err.message + ' — opening it.')`.
3. `board-editor.js:214` and `shared.js:215`: `toast(e.message, 'warn')`.
4. `game-viewer.js:146`: use `e.message`. This fixes `[object Object]`.
5. `bulk-add.js`: collect `apiErr.existingTitle || '(untitled)'` per duplicate. Results line: `Duplicates skipped: N (a, b, c)`. Escape names with the existing `_esc`.
6. Rule-as-check (checklist rule 11): add `audit_duplicate_messages()` to `static_audits.py`. It fails if any file in `frontend/js` contains the literal `Position already saved` or `Position already exists`. Show it fail before step 3, pass after.

Command: `python3 static_audits.py`

## Part 4 — Position search in the category filter box (tier: integration · ~25 min including Playwright)

1. `TagFilter.mount` gets an opt-in `searchPositions: true` option. Only `position-list.js` passes it, with placeholder `Tag or position name...`. All other mounts are unchanged.
2. With the option on, each search fetches tags as today and `GET /positions/?title_q=<q>&limit=8` in parallel, through ApiClient. Keep the existing stale-response guard for both.
3. Render: tag rows as today, then a `Positions` section label, then position rows: title left, category label right. Category label comes from `CATEGORIES` via `positionType`. Do not add a backend label map. Match `docs/targets/position-search-dropdown.html`. Comment every innerHTML with `SAFE_INNER_HTML` and escape with `Html.escape`.
4. Keyboard: arrows move through tags and positions as one list. Enter on a tag adds the chip, as today. Enter on a position opens it. Enter with nothing highlighted keeps today's raw-text-as-tag behaviour. Escape closes.
5. Click a position row: `Router.navigate({ view: 'positionDetail', id })`, close the dropdown, clear the input.
6. States (checklist rule 14): no matches (dropdown hidden, as today); tags only (no Positions label); positions only (label, no tag rows); both; untitled title shows `(untitled)`; more than 8 matches shows 8.
7. Playwright test, new file `tests/test_position_search_ui.py`:
   - Start uvicorn on port 8001 with `CHESSDIRBEK_DB_URL` pointing at a temp SQLite file. If 8001 is taken, fail loudly. Do not reuse a server.
   - Seed through the real API: two positions with titles `swift-otter` (puzzle) and `swift-cottage` (endgame), one tag `swift-attack`, one position with "otter" only in its notes.
   - On `/tactics`, type `otter`. Assert exactly one position row, text `swift-otter`, right label `Tactics`. Assert the notes-only position does not appear.
   - Click the row. Assert the detail view shows `swift-otter`.
   - Assert the editor's tag box (`/positions/new`) shows no Positions section for the same query. This proves the opt-in.
   - Save a screenshot of the open dropdown to `docs/targets/position-search-dropdown.actual.png`.
   - Red before green: run the test before Part 4's code and show it fail.

Command: `python -m pytest tests/test_position_search_ui.py -q`

## Part 5 — Exit (tier: full · ~3 min)

1. `./test_smoke.sh` once.
2. Commit with the pre-commit hook active (it stamps the build). Message: `Duplicate message names the position; search positions by name in category filter`.
3. Do not push.

## Report format

- Starting SHA and ending SHA.
- PROVEN: each test above, with red-before-green output for Parts 1, 3 and 4.
- The screenshot path.
- UNVERIFIED: the real hotkey notification on macOS. Ashish checks it by copying a board he already saved and pressing Option-Command-V. Reason this is a live check: it is the path he uses most, and only he can see a macOS notification.
- UNVERIFIED: whether his Shortcut runs the repo copy of `chessdirbek_capture.sh`. If the notification still shows the old text after restart, that is the cause.
- Never write "done".
