# SPEC: Castling rights by default, with a per-position toggle

Version 01 · written 2026-10-16 16:31 PDT · checked against SPEC_CHECKLIST.md (rules 1-14 and the 2026-10-04 additions)

## What Ashish will see change (visible decisions, approved 2026-10-16)

1. A position imported from an image (hotkey or paste in the app) can castle when king and rook sit on their starting squares. Today it never can.
2. Same for positions built in the board editor.
3. FEN text that already states castling rights keeps them, trimmed to what the pieces allow. FEN text with no castling field gets the default.
4. Positions saved from real games keep their real castling rights.
5. **Flip FEN** recalculates castling after rotating.
6. New checkbox **Castling allowed** on the position page toolbar, after the Lichess button. Shown only when at least one king and rook are on their starting squares. Unticking saves at once and removes all castling rights. Ticking restores every right the pieces allow. Target: `docs/targets/castling-toggle.html`.
7. All existing positions get the same rule once, after a database backup.
8. The duplicate check ignores castling. The same board with the same side to move counts as a duplicate whatever its castling field says.

Nothing else changes. No product decisions are left open.

## Facts checked (source of each claim)

- OCR always emits castling `-`: `tests/test_ocr_orientation.py:28`. `_build_result` (`backend/services/ocr_service.py:153-171`) feeds both `POST /api/ocr` (in-app paste) and `POST /api/ocr/import` (hotkey).
- Create: `create_position` validates then checks duplicates by exact full FEN, `Position.fen == data.fen` (`backend/api/positions.py:40-45`). Update: `positions.py:213-217` validates and stores `data.fen` as given. No duplicate check on update.
- `fen` is not unique in the schema (`backend/models/models.py:42`). Positions store no game link.
- Annotations key a position by board + side to move, via a private helper `_normalize_fen_key` (`backend/api/annotations.py:13-17`). Castling changes do not affect annotations.
- python-chess accepts FENs with missing fields (`chess_service.set_side_to_move` docstring). Some stored FENs may be board-only.
- Bulk add completes board-only lines to `w KQkq - 0 1` without checking pieces (`frontend/js/bulk-add.js:29-40`).
- Editor FEN: `_getFen` in `frontend/js/board-editor.js:19-25`, now passes through `FenUtils.completeAndSanitizeFen`.
- `FenUtils.sanitizeCastlingRights(board, requested)` keeps only rights with king on e1/e8 and rook on h1/a1/h8/a8 (`frontend/js/fen-utils.js`). Asking for `KQkq` returns every supported right.
- Flip FEN: `FenActions.rotateFen180` resets castling to `-` (`frontend/js/fen-actions.js:150-155`); `FenFlip._applyAndSave` PUTs it (`frontend/js/fen-flip.js`). `tests/fen/rotate.test.js` tests the pure rotation only.
- Detail board analysis loads the stored FEN with its castling field (`FenUtils.loadChessFromBoardFen`, first candidate).
- Detail toolbar buttons: `frontend/index.html:325-330`.
- DB: `sqlite:///./chessdirbek.db` unless `CHESSDIRBEK_DB_URL` (`backend/database.py:9`). `backups/` and `*.db` are gitignored (`.gitignore:36,48`).
- Line counts: `positions.py` 281, `chess_service.py` 200, `fen-utils.js` 216, `position-detail.js` 254, `fen-flip.js` 77.

## Rules for this run

- Start: `git status` clean except untracked spec files. Record `git rev-parse HEAD`.
- Never run `osascript`, `killall`, `sudo` or `scripts/chessdirbek_capture.sh`.
- The only write to the live database is Part 5, after its backup. Nothing else touches it.
- Tests use their own sample positions. None may depend on database contents.
- If an existing test asserts castling `-` for a board that now gets rights, update that expectation. Change nothing else about it.
- Do not fix anything else you notice. List it under "Noticed, not touched". Do not file it in Tenzing.
- If a file would pass 300 lines, move the new helpers to a new module rather than asking.

## Part 1 — Backend rule, one place (tier: fast · ~10 min)

In `backend/services/chess_service.py` add:
- `supported_castling(board)` → the rights the placement allows, or `-`.
- `normalize_castling(fen)` → a full 6-field FEN. Missing castling field: use `supported_castling`. Present: keep the requested rights that are supported. Missing side defaults to `w`, ep to `-`, counters to `0 1`.
- `position_key(fen)` → `"<board> <side>"`, side defaulting to `w`. `annotations.py` switches to it and drops its private copy.

Unit tests in `tests/test_castling_rules.py` with sample FENs: start position; king moved; one rook missing; board-only; `-` given; unsupported rights trimmed; `position_key` of full and board-only FENs.

## Part 2 — Apply it (tier: fast · ~10 min)

1. `create_position`: after validation, `data.fen = normalize_castling(data.fen)`. Duplicate check: fetch rows whose `fen` starts with the incoming board, then compare `position_key` in Python. Message and 409 body unchanged.
2. `update_position`: when `fen` is given, store `normalize_castling(fen)`.
3. `_build_result` in `ocr_service.py`: set the castling field to `supported_castling` of the board, after the side-to-move step.
4. Tests: OCR result for a home-squares board gets rights, both orientations. Create with `-`, then the same board with `KQkq` → 409. Board-only stored row matches a full FEN. Same board, other side to move → not a duplicate. Create with `KQkq` on a board without rooks → stored as `-`. Show the duplicate and OCR tests fail first.

Commands: `python -m pytest tests/test_castling_rules.py tests/test_ocr_orientation.py tests/test_basic_api.py -q`

## Part 3 — Frontend: editor and Flip FEN (tier: fast · ~5 min)

1. `FenUtils.supportedCastling(fen)` → supported rights or `-` (wraps the existing sanitizer with `KQkq`).
2. Editor `_getFen`: request `KQkq` before sanitising, so a hand-built board gets every supported right.
3. `FenFlip._applyAndSave`: after rotating, set the castling field to `KQkq` (or leave a board-only result board-only). The backend trims it.

## Part 4 — Castling toggle (tier: integration · ~15 min)

1. New module `frontend/js/castling-toggle.js`, loaded after `position-detail.js`. Checkbox `#detail-castling-toggle` with label "Castling allowed", placed after the Lichess button. Match `docs/targets/castling-toggle.html`.
2. On each detail load: hide it when `FenUtils.supportedCastling(pos.fen)` is `-`. Otherwise show it, ticked when the stored castling field is not `-`.
3. On change: PUT the position's FEN with castling `KQkq` (ticked) or `-` (unticked), then reload the detail page so the board and `AppState.currentDetailFen` use the new FEN.
4. Playwright tests in `tests/test_castling_ui.py`, port-8001 temp server, own sample data:
   - A start-position-like sample shows the box ticked. Untick → API returns castling `-`. Tick → `KQkq`.
   - A sample with no king on e1/e8 hides the box.
   - Editor: empty board, white king e1, white rook h1, black king e8 → editor FEN castling `K`.
   - Flip FEN on a sample whose rotated board has kings and rooks at home → castling granted.
   - Screenshot of the toolbar with the box to `docs/targets/castling-toggle.actual.png`.
   - Show the toggle test fails first.

Command: `python -m pytest tests/test_castling_ui.py tests/test_editor_board_ui.py -q`

## Part 5 — Existing positions, once (tier: live · ~5 min)

Reason for a live check: this writes the real database.

1. New script `scripts/migrate_castling.py`, using `backend.database` so `CHESSDIRBEK_DB_URL` is honoured. For each position: castling field missing or `-` → `supported_castling`; otherwise keep only supported rights. `--dry-run` prints how many rows would change and five examples. It is idempotent.
2. Test it first on a temp SQLite file with sample rows: dry run counts, apply, second run changes 0.
3. Live: `mkdir -p backups && cp chessdirbek.db backups/chessdirbek-pre-castling-$(date +%Y%m%d-%H%M).db`. Then dry run, then apply, then dry run again (must show 0). Report all three outputs.
4. Restore command for the report: `cp backups/<that file> chessdirbek.db`.

## Exit

1. `./test_smoke.sh` once.
2. `tenzing backlog done dq-vzg5xj` (the open "Fix castling rights" item).
3. Commit. Message: `Castling rights by default with per-position toggle`.
4. Do not push.

## Report format

- Starting and ending SHA.
- PROVEN: each part's tests, red-before-green where required, migration outputs, screenshot path.
- The backup file name and restore command.
- Noticed, not touched.
- UNVERIFIED: Ashish importing a home-squares board by hotkey and castling on it.
- Never write "done".
