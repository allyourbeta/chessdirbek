# SPEC: One button layout for every board screen

Version 01 · written 2026-10-16 18:29 PDT · checked against SPEC_CHECKLIST.md (rules 1-14 and the 2026-10-04 additions)

## What Ashish will see change (visible decisions, layout approved 2026-10-16)

The rule, left to right under every board: **move arrows · Flip · Random, Lichess · tools for that screen.** Page actions: **Back first, Delete last on the right.** Target: `docs/targets/board-toolbars.html`.

1. **Position page:** Flip FEN moves after Lichess, next to the castling box. Page actions become ← Previous, Back, Edit, then Delete on the right, then Next →. Previous and Next keep their places at the two ends and still show only in puzzle flow.
2. **Category preview:** same buttons, same order as today, now in the position page's button style and left-aligned.
3. **Game viewer:** Lichess moves before Undo and Reset. Delete moves to the right end of its row.
4. **Engine game replay:** new Flip button. Lichess moves from the right panel to under the board.
5. **Practice game viewer:** new Lichess button. Page actions become Back, Edit verdict, then Delete on the right.
6. **Play vs engine:** new toolbar under the board with Flip (new) and Lichess. Lichess leaves the right panel in both its places.
7. **Board setup screens (Editor, Search, Add form):** Flip, Clear Board, Starting Position in that order, Cancel on the right. This adds **Starting Position to Search** and **Clear Board to the Add form**, which they lack today. The Add form's "Flip Board" becomes "Flip".
8. **Add form row:** grouped as Paste board image, Load Board, Editor · Flip, Clear Board, Starting Position · Save Position, then Cancel on the right.
9. Every Lichess button reads "Lichess" with the small external-link icon. "Analyze on Lichess" disappears.

Nothing else changes. No product decisions are left open.

## Facts checked (source of each claim)

- Screens and buttons: `frontend/index.html` — Add form 124-132, Game viewer 202-215 and 233-234, Search 255-260, Position page 321-345 and 375-379, Editor 457-462, Practice viewer 512-518 and 527-531, Play 538-562, Replay 576-598, Category preview in `view-category` (`.featured-board-controls`).
- Toolbar CSS: `.board-controls` and `.control-group` (`frontend/css/components.css:639-650`). The bigger button style is scoped to the position page only, `#view-detail .board-controls .btn` (`:656-664`). `.featured-board-controls` centres its buttons (`:934-939`). Separator `.ctl-sep` (`:668-675`).
- Move arrows are rendered by `MoveNavigator.create(id, { containerId })` into a span: `detail-move-nav`, `gv-move-nav` (`game-viewer.js:41-45`), `replay-move-nav` (`game-replay.js:50-56`). Practice viewer arrows are static buttons.
- `data-action="analyze-on-lichess"` calls `FenActions.analyzeOnLichess()` (`action-handlers.js:167`), which uses `BoardManager.getCurrentFen()`. That already covers `view-practice-viewer`, `view-play` and `view-replay` (`board.js:190-240`). The position page uses its own `analyze-detail-on-lichess`.
- Play board orientation comes from `boardOrientation || userColor` at creation (`play.js:72`). `BoardManager.flip(id)` exists (used by `flip-detail-board`).
- Search "Clear Board" loads an empty board (`search.js:113-121`, `SEARCH_START_FEN = '8/8/8/8/8/8/8/8 w - - 0 1'`). Add form "Starting Position" is `setStartPos` (`position-form.js:113-119`).
- Line counts: `search.js` 282, `position-form.js` 255, `game-replay.js` 212, `play-view.js` 115.

## Rules for this run

- Start: `git status` clean except untracked spec files. Record `git rev-parse HEAD`.
- Never run `osascript`, `killall`, `sudo` or `scripts/chessdirbek_capture.sh`. Do not touch the live DB or port 8000.
- Move existing buttons; do not rewrite their handlers. Keep every `data-action` value unless this spec names a new one.
- Tests use their own sample data. None may depend on database contents.
- Do not fix anything else you notice. List it under "Noticed, not touched". Do not file it in Tenzing.
- If a file would pass 300 lines, put the new handlers in a new small module rather than asking.

## Part 1 — One shared toolbar style (tier: fast · ~5 min)

1. Add a class `board-toolbar` for every under-board toolbar. Move the two `#view-detail .board-controls ...` rules to `.board-toolbar .btn` and `.board-toolbar .control-group`.
2. Toolbars are left-aligned. Groups are separated by `.ctl-sep`.
3. Remove the centring and button overrides of `.featured-board-controls` once the preview uses `board-controls board-toolbar`.

## Part 2 — Reorder and move (tier: fast · ~15 min)

Apply visible decisions 1-9 in `index.html`, using the position page's markup pattern: `<div class="board-controls board-toolbar"><div class="control-group">…</div></div>` with `.ctl-sep` between groups. Page-action rows push Delete right with `margin-left:auto` on a spacer or the Delete button.

- Replay: wrap `#replay-move-nav` in the toolbar with Flip and Lichess, the way `#gv-move-nav` is wrapped. Keep the id.
- Play: new toolbar between the board and the FEN bar.
- Lichess buttons: same text and the same icon SVG as the position page's Lichess button.

## Part 3 — The new buttons (tier: fast · ~10 min)

1. Replay Flip: new action `replay-flip` → `BoardManager.flip('replay-board')`.
2. Play Flip: new action `play-flip` → `BoardManager.flip('play-board')`. Display only. Moves must still work after flipping.
3. Practice viewer Lichess: reuse `analyze-on-lichess`.
4. Search Starting Position: new action `search-start-position`, mirroring `searchSetStart` but with the standard starting FEN.
5. Add form Clear Board: new action `clear-add-board`, mirroring `setStartPos` with `8/8/8/8/8/8/8/8 w - - 0 1`.

## Part 4 — Make the rule a check (tier: fast · ~10 min)

Checklist rule 11. Add `audit_board_toolbars()` to `static_audits.py`, reading `index.html`:
- No text "Analyze on Lichess".
- Every button with a Lichess action has text starting "Lichess".
- In every `board-toolbar`, Flip comes before Lichess, and move arrows (if any) come first.
- In every button row holding a Delete button, Delete is the last button except an optional "Next →".
- Show it fails on today's `index.html` before Part 2, then passes.

Command: `python3 static_audits.py`

## Part 5 — Behaviour tests and screenshots (tier: integration · ~15 min)

New file `tests/test_board_toolbars_ui.py`, port-8001 temp-server pattern, own sample data seeded through the real API:
- Replay Flip changes board orientation. Play Flip changes orientation and a legal move still plays.
- Practice viewer Lichess opens a lichess.org URL containing the viewer's FEN (intercept `window.open`).
- Search Starting Position loads the start position. Add form Clear Board empties the board and FEN box.
- Screenshot every changed screen to `docs/targets/actual/`. If a screen cannot be reached with API-seeded data, say which and why in the report.

Command: `python -m pytest tests/test_board_toolbars_ui.py -q`

## Exit

1. `./test_smoke.sh` once.
2. Commit. Message: `One button layout for every board screen`.
3. Do not push.

## Report format

- Starting and ending SHA.
- PROVEN: audit red-before-green, behaviour tests, screenshot paths.
- Screens not screenshotted, and why.
- Noticed, not touched.
- UNVERIFIED: Ashish using the screens.
- Never write "done".
