# SPEC: Board editor fixes — kings, castling rights, Search hand-off

Version 02 · written 2026-10-16 15:23 PDT · checked against SPEC_CHECKLIST.md (rules 1-14 and the 2026-10-04 additions)

Replaces version 01 of this file. If version 01 already ran and `FenUtils.placePiece` exists, skip Part 1 and do Parts 2 and 3.

## What Ashish will see change (visible decisions)

1. The white king (and black king) can always be placed. Today it sometimes silently refuses.
2. If that colour's king is already on the board, placing it elsewhere MOVES it. A side cannot have two kings.
3. A position built in the editor saves with correct castling rights. Today, editing from "Starting Position" keeps "KQkq" even after the king or rook is gone.
4. After pressing a Search button in the editor, the Search page board keeps your position when you click a square. Today it jumps back to an older position.
5. Part 1 also applies to the Search page's board.

Nothing else changes. Clicking a piece on a square holding the same piece still removes it.

No product decisions are left open.

## Causes (each reproduced or read in source)

The app uses chess.js 0.10.3 from cdnjs (`frontend/index.html:636`). Reproduced in Node with that exact version.

1. **King refused.** chess.js remembers where each king is and refuses a second one (chess.js 0.10.3 lines 452-458). Placing another piece on top of a king does not clear that memory. Reproduced: king e1 → true; queen e1 → true; king d1 → **false**. Same pattern in `board-editor.js:85-100` and `search.js:76-97`.
2. **Stale castling.** `put` and `remove` never update castling rights. Reproduced: start position, remove h1 and e1, put king d1 → FEN still ends `w KQkq`. chess.js then even offers O-O with no rook. The editor's `_getFen` (`board-editor.js:19-24`) returns this raw FEN to save, copy, display and search. Play mode is already protected by `FenUtils.preparePlayableFen` (`play.js:34`). `FenUtils.completeAndSanitizeFen` (`fen-utils.js:79-89`) already fixes castling, keeps the side to move, and leaves a correct FEN untouched (checked in Node).
3. **Search hand-off.** `board-editor.js` `search()` navigates first, and only 50 ms later sets `AppState.searchFen`. Navigation runs `initSearchBoard` (`shared.js:140-143`, `search.js:25-28`), which loads the OLD `AppState.searchFen` into `searchChess`. The display is then updated, but `searchChess` is not. The first square click redraws from `searchChess`.

## Fix

**Part 1.** Add `FenUtils.placePiece(chess, piece, square)` in `frontend/js/fen-utils.js`. It removes whatever is on `square`; if `piece` is a king, it removes any other king of that colour found by reading the board; then it calls `chess.put`. Both editors call it instead of their bare `.put(...)`. Keep toggle-off and eraser unchanged.

**Part 2.** In `board-editor.js`, `_getFen` returns `FenUtils.completeAndSanitizeFen(...)` of the FEN it builds today (after setting the turn).

**Part 3.** In `board-editor.js` `search()`, set `AppState.searchFen = fen` before `Router.navigate`. Leave the rest of the function as it is.

Do not upgrade chess.js. Do not touch anything else.

## Consequences checked before writing this

- Toggle-off runs before `placePiece`, so it is unchanged. Eraser and Clear Board use `remove`/`load`, which already reset king memory.
- `placePiece` finds the old king by reading the board, so stale memory cannot fool it.
- Sanitising leaves a correct FEN unchanged, including the real starting position with `KQkq`. It keeps the side to move, so the turn buttons still work.
- Duplicate detection compares piece placement only (`backend/api/positions.py` duplicate check), so cleaner castling cannot create new duplicates or hide old ones.
- Part 3: `initSearchBoard` now loads the editor's position into both the board and `searchChess`. The delayed block still sets the search type and runs the search. Setting the board again there is harmless.
- Already-saved positions with stale castling are not rewritten. Play mode already corrects them when played.
- `fen-utils.js` (188 lines) and `board-editor.js` (259 lines) stay under 300.

## Rules for this run

- Start: `git status` clean except untracked spec files. Record `git rev-parse HEAD`.
- Never run `osascript`, `killall`, `sudo` or `scripts/chessdirbek_capture.sh`. Do not touch the live DB or port 8000.
- Do not fix anything else you notice. List it in the report under "Noticed, not touched". Do not file it in Tenzing.

## Tests (tier: integration · ~15 min)

New file `tests/test_editor_board_ui.py`, using the port-8001 temp-server pattern from `tests/test_position_search_ui.py`. Tests use their own sample positions only. They must not depend on any database contents.

1. Logic via `page.evaluate` on a fresh empty `Chess`: king e1, queen e1, king d1 → white king on d1. King e1 then king d1 → exactly one white king, on d1. Same for black.
2. `/editor` clicks: white king e1, white queen e1, white king d1 → FEN shows a white king on d1.
3. `/editor`: Starting Position, erase h1 → editor FEN's castling field has no `K`. Starting Position alone → `KQkq`.
4. `/editor`: build a small position, press a Search button, then click one empty square on the Search board with a piece selected. The Search board shows the editor position plus that one piece.
5. Same click sequence as test 2 on the `/search` board.
6. Show tests 1, 2, 3 and 4 fail before the fix.

Then run, once each:
- `python -m pytest tests/test_editor_board_ui.py -q`
- `./test_smoke.sh`

## Exit

1. Commit. Message: `Board editor: kings always placeable, correct castling rights, Search keeps position`.
2. Do not push.

## Report format

- Starting and ending SHA.
- PROVEN: the tests, with red-before-green for 1-4.
- Noticed, not touched.
- UNVERIFIED: Ashish placing a white king in the live editor.
- Never write "done".
