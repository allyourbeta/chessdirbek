# ChessQuiz UI/UX Cleanup Spec

Multi-phase cleanup pass based on testing feedback. Each phase is run separately in Claude Code. Commit between phases.

**Guiding principles:**
- Match chess mental models (1-0, not "win")
- Clear visual hierarchy with distinct sections
- Prominent notifications for important events
- Scalable patterns for growing data
- Minimize modals; prefer inline edit or dedicated panels

---

## Phase A: Labels, Language, and Icons

Quick wins that improve clarity throughout the app. Pure labeling and icon changes.

### A.1 Section headings

- Add an explicit `<h3>Practice History</h3>` heading above the practice games list in Position detail view
- Add an explicit `<h3>Aggregate Stats</h3>` (or similar) above the stats block
- Add an explicit `<h3>Your Moves From Here</h3>` above the per-position opening tree (if not already present)
- Each major section in Position detail view should have a clear heading

### A.2 Language in forms and controls

- "Turn color" dropdown label → rename to "Your color" (or "Play as")
- The color dropdown options should say "White" and "Black" (not "Turn white")
- The difficulty dropdown labels should be prefixed with engine name in the selector display:
  - Currently shows: `medium (d10, skill 12)`
  - Change to: `Stockfish Medium (d10, skill 12)` — makes opponent explicit
- Engine identifier in the Practice This Position section should always say "Stockfish [level]" in the UI, never just "[level]"

### A.3 Verdict representation

- Replace all instances of "win" / "draw" / "loss" text in UI displays with chess notation: `1-0`, `0-1`, `½-½`
- This includes the verdict edit form/modal: instead of a text input or dropdown with "win/draw/loss", use a dropdown or radio buttons with:
  - `1-0` (White wins)
  - `0-1` (Black wins)
  - `½-½` (Draw)
  - `—` (Abandoned)
- Keep internal data model as-is (`win`, `draw`, `loss`, `abandoned`) — this is purely a display/input labeling change
- The chess notation must correctly reflect absolute result (not user perspective):
  - User played White and won → `1-0`
  - User played White and lost → `0-1`
  - User played Black and won → `0-1`
  - User played Black and lost → `1-0`

### A.4 Icons

- Replace the `×` delete button in Practice History rows with a trash can icon
- Use SVG icons, not emoji or Unicode
- Trash icon should be subtle (muted color) until hovered (red on hover)
- Icon should have aria-label="Delete practice game" for accessibility
- Same trash-can-on-hover-red pattern should be used anywhere else `×` currently represents destructive deletion

### Acceptance criteria

- [ ] All section headings added
- [ ] All labels updated to match chess mental model
- [ ] Verdict shown as chess notation everywhere including edit forms
- [ ] Trash can icon replaces `×` for destructive deletes
- [ ] python test.py && python test_games.py && python test_game_api.py && python test_practice.py

### Manual test script

Open the app in the browser and work through these steps. Every check should pass visually.

**Navigate to a Position with Practice History:**
- [x] The Practice History section has a visible `<h3>` heading labeled "Practice History"
- [x] The aggregate stats block has a visible heading (e.g., "Aggregate Stats" or "Overview")
- [x] The per-position opening tree has a visible heading (e.g., "Your Moves From Here")
- [x] Visual scan: every major section is immediately identifiable by its heading

**Start a practice session:**
- [x] The color selector label says "Your color" (or "Play as"), NOT "Turn color"
- [x] Color options in the dropdown are "White" and "Black", NOT "Turn white"
- [x] The difficulty dropdown selected option displays as "Stockfish Medium (d10, skill 12)" or similar — includes engine name
- [x] Nowhere in the start-practice UI does opponent appear as just "medium" without "Stockfish"

**Check verdict displays:**
- [x] Practice History rows show results as `1-0`, `0-1`, `½-½`, or `—` — never as "win", "draw", "loss", or "abandoned"
- [x] Practice game viewer shows result in chess notation
- [x] Save-game modal (after a game ends) shows result in chess notation
- [x] Correctness spot-check: a game where you played White and won shows `1-0` (not `0-1`)
- [ ] Correctness spot-check: a game where you played Black and won shows `0-1` (not `1-0`)

**Edit a verdict:**
- [ ] The verdict edit control shows options in chess notation: `1-0`, `0-1`, `½-½`, `—`
- [ ] No "win / draw / loss" text appears in the edit UI
- [ ] After editing, the display updates to show the new verdict in chess notation

**Check the trash icon:**
- [ ] The delete button in each Practice History row shows a trash can icon, not `×`
- [ ] Icon is muted/grey by default
- [ ] Icon turns red on hover
- [ ] Hovering shows "Delete practice game" tooltip (or aria-label is set correctly)
- [ ] Clicking still triggers the delete confirmation flow

**Check everywhere else `×` was used for destructive deletes:**
- [ ] Position delete (if present as a button) uses trash icon
- [ ] Any other delete buttons consistent with trash icon pattern

If any item fails, do NOT commit. Report the failure to Claude Code with specifics.

### Commit
```bash
git add -A
git commit -m "UI cleanup A: chess-native labels, explicit section headings, trash icon for deletes"
```

---

## Phase B: Notification Visibility

Important events should be obvious, not hidden in the corner.

### B.1 Draw offer response

Currently a small toast in bottom-right. Change to prominent center-stage notification.

Requirements:
- When Stockfish responds to a draw offer (accept or decline), show a **centered modal-style notification** in the middle of the board area or as a banner directly above the board
- Duration: at least 3 seconds, or until user dismisses
- Accept: green theme, clear message "Stockfish accepted your draw offer. Game ends ½-½."
- Decline: amber theme, clear message "Stockfish declined your draw offer. Play continues."
- On accept: after notification, transition to save-game flow
- User must have enough time to notice and read the message — no auto-dismissing in under 3 seconds

### B.2 Import preparation feedback

Currently the "preparing import" stage is silent for several minutes on large files — looks frozen.

Requirements:
- While the backend is parsing the PGN file (before streaming starts), show:
  - An animated spinner
  - Text like "Preparing import..." or "Parsing PGN file..."
  - Elapsed time counter
- Transition to the full progress bar once the streaming `start` event arrives
- User should never see a static "please wait" with no feedback

### B.3 Import page state reset

Historical text from previous import attempts lingers in the form.

Requirements:
- Every time the user navigates to the Import PGN page (whether from Games tab or directly via URL), reset all form fields to empty defaults
- Clear: file input, textarea preview, tags input, collection dropdown, "new collection" input
- If the user navigates away and back, a completed import's state should NOT be remembered

### B.4 Other ambient feedback

- When a practice game is auto-saved, show a clearer acknowledgment (brief top-banner, not bottom-corner toast)
- When a position is deleted, brief top-banner confirmation: "Position deleted"
- When an import completes successfully, brief top-banner: "Imported X games" (replacing the in-place progress view)

### Acceptance criteria

- [ ] Draw offer responses show prominently, not as corner toast
- [ ] Import preparation stage shows a spinner and elapsed time
- [ ] Import form resets on each navigation to the page
- [ ] Other important confirmations moved to top banner or otherwise made more visible
- [ ] python test.py && python test_games.py && python test_game_api.py && python test_practice.py

### Manual test script

**Draw offer — forced decline:**
- [ ] Start a practice session as White against Stockfish Hard
- [ ] Play standard moves so that the position is balanced or slightly favoring Stockfish
- [ ] Offer a draw
- [ ] Expected: prominent centered notification (banner or modal-style) says "Stockfish declined your draw offer. Play continues."
- [ ] The notification is visible for at least 3 seconds or until dismissed
- [ ] You did NOT miss the notification — it's unmissable
- [ ] Notification is amber/warning colored, not green
- [ ] Game continues normally after dismissing

**Draw offer — forced accept:**
- [ ] Start a new practice session as White
- [ ] Play several deliberately terrible moves so Stockfish has a winning position from your perspective (Stockfish sees eval as favoring it)
- [ ] Wait, then offer a draw. Since you're losing badly, Stockfish's perspective is that it's winning → should DECLINE
- [ ] To force acceptance: sacrifice such that Stockfish is the one losing. Then offer a draw → should ACCEPT
- [ ] When Stockfish accepts: prominent green notification "Stockfish accepted your draw offer. Game ends ½-½."
- [ ] Game transitions into the save-game flow after notification

**Import preparation feedback:**
- [ ] Go to Games → Import PGN
- [ ] Select the big 9.86MB Smith-Morra file
- [ ] Click Import
- [ ] Expected: during the "preparing" phase, a visible spinner is shown
- [ ] Expected: text says "Preparing import..." or "Parsing PGN file..."
- [ ] Expected: an elapsed time counter is ticking (e.g., "0:04", "0:08")
- [ ] User never sees a frozen/silent screen
- [ ] Once preparation completes, transitions smoothly to the full progress bar

**Import form state reset:**
- [ ] Go to Import PGN, fill in some tags ("foo, bar"), enter a new collection name ("TestCol")
- [ ] Click Cancel (or navigate away via Games tab)
- [ ] Navigate BACK to Import PGN
- [ ] Expected: all fields are empty — no leftover "foo, bar" tags, no leftover "TestCol" name, no leftover file selected, no leftover PGN text in the textarea

**Other ambient feedback:**
- [ ] Finish a practice game (let it end naturally or click Resign)
- [ ] After save, a clearer acknowledgment appears (top banner, not bottom-right toast)
- [ ] Delete a position (if there's a position you can afford to delete)
- [ ] Expected: top-banner confirmation "Position deleted"
- [ ] Complete an import
- [ ] Expected: top-banner says "Imported X games" briefly after completion

If any item fails, do NOT commit. Report the specific failure to Claude Code.

### Commit
```bash
git add -A
git commit -m "UI cleanup B: prominent notifications for draw offers, import feedback, form state reset"
```

---

## Phase C: Visual Hierarchy and Section Separation

The position detail page feels like a pile of data. Add clear visual structure.

### C.1 Card-based layout for Position detail

Break the position detail right panel into distinct **cards** (white background, subtle border, rounded corners, consistent padding). Each card is a visually separate section.

Cards in order:
1. **Header card**: Title, tags
2. **Position info card**: FEN, Your Notes, Stockfish Analysis
3. **Quiz Stats card**: Quiz stats (if any)
4. **Actions card**: Edit, Eval toggle, Play from here, Delete, Back buttons
5. **Practice This Position card**: Difficulty dropdown, color selector, Start practice button
6. **Practice History card**: Aggregate stats + list of practice games
7. **Your Moves From Here card**: Per-position opening tree

Each card has:
- Clear visual separation from adjacent cards (margin between them)
- Optional card header with section title
- Consistent internal padding
- Subtle border OR subtle shadow (pick one, not both)

### C.2 Position detail right panel width

- Ensure the right panel has a reasonable max-width so text doesn't stretch across huge monitors
- Content should remain readable — aim for around 720-900px max content width

### C.3 Practice History internal structure

Within the Practice History card:
- Aggregate stats (total games, W/D/L, win rate, avg moves) should be visually distinct from the game list — perhaps in a mini-panel at the top of the card
- Per-engine-level breakdown ("vs Stockfish: 0/3 wins") below aggregate stats
- Game list below that, with clear separation

### C.4 Spacing scale

Use consistent spacing from Refactoring UI:
- Between major cards: larger gap (24-32px)
- Between sections within a card: medium gap (16-24px)
- Between rows in a list: smaller gap (8-12px)
- Card internal padding: 16-24px

### Acceptance criteria

- [ ] Position detail view uses distinct cards for each major section
- [ ] Visual hierarchy makes sections immediately identifiable at a glance
- [ ] Spacing is consistent and follows a clear scale
- [ ] No "wall of data" feeling — each section feels contained
- [ ] Layout still works on narrower windows (e.g., 1280px wide)
- [ ] python test.py && python test_games.py && python test_game_api.py && python test_practice.py

### Manual test script

**Overall visual scan of Position detail view:**
- [ ] Open a Position that has Practice History, Your Notes, and some saved state
- [ ] Every major section appears as a distinct card (white background, subtle border or shadow)
- [ ] There is clear visual space between cards (you can see where one ends and the next begins)
- [ ] Content does not feel like a "wall of text" — it feels structured

**Count the cards:**
- [ ] Header card (title + tags)
- [ ] Position info card (FEN, notes, Stockfish analysis)
- [ ] Quiz Stats card (even if empty, present)
- [ ] Actions card (buttons row)
- [ ] Practice This Position card (difficulty, color, start button)
- [ ] Practice History card (aggregate stats + game list)
- [ ] Your Moves From Here card (opening tree)

At least 6-7 distinct visual cards should be present.

**Visual consistency:**
- [ ] All cards use the same border radius
- [ ] All cards use the same shadow/border style (pick one, same throughout)
- [ ] All cards use the same internal padding
- [ ] Gaps between cards are consistent (all feel like the same vertical spacing)

**Readability check:**
- [ ] Content width does not stretch to fill ultra-wide monitors — has a max-width
- [ ] Text is readable, not crammed
- [ ] On a 1920px-wide monitor, the content is centered with comfortable margins
- [ ] On a 1280px-wide window, the layout still looks correct (narrower cards, maintains structure)

**Practice History internal structure:**
- [ ] Within the Practice History card, aggregate stats are visually separated from the game list
- [ ] The per-engine-level breakdown ("vs Stockfish: X/Y wins") is distinct from the aggregate line

**Do not break existing functionality:**
- [ ] All buttons still work (Edit, Play from here, Delete, Back, Start practice)
- [ ] Clicking a practice game still opens the viewer
- [ ] Labels from Phase A are still correct (chess notation verdicts, etc.)
- [ ] Notifications from Phase B still work

If any item fails, do NOT commit. Report to Claude Code with specifics.

### Commit
```bash
git add -A
git commit -m "UI cleanup C: card-based layout for position detail, consistent spacing, visual hierarchy"
```

---

## Phase D: Scalability of Lists

Practice History and similar lists must handle growth gracefully.

### D.1 Practice History pagination

When a position has many practice games (10+), the current list becomes unwieldy.

Requirements:
- Show first 10 practice games by default, with pagination or "Show more" button
- Keep the aggregate stats accurate across ALL games, not just visible page
- Sort by date (most recent first) by default

### D.2 Practice History filtering

Add filter controls above the Practice History list:

- Filter by verdict: All / Wins / Draws / Losses / Abandoned
- Filter by engine level: All / Easy / Medium / Hard / Max
- Sort: Most recent / Oldest / Longest game / Shortest game

Filters are client-side (applied to already-loaded data) or server-side query params — either is fine, pick the simpler one. Backend should support these via query params on `GET /api/practice/?root_position_id=X&verdict=loss&engine_level=hard`.

### D.3 Aggregate stats respect filters

When filters are applied, the aggregate stats at the top should reflect the filtered subset, with a clear indicator:

- "Showing 3 of 12 games (filtered)" text above the stats
- A "Clear filters" button when filters are active

### D.4 Empty states

- "No practice games yet" when position has zero
- "No games match these filters" when filters exclude everything (with "Clear filters" suggestion)

### D.5 Automated tests for backend filtering

Phase D adds backend query parameters. These need automated test coverage.

Add tests to `test_practice.py`:

**Filter by verdict:**
- `GET /api/practice/?root_position_id=X&verdict=win` returns only wins for that position
- `GET /api/practice/?root_position_id=X&verdict=loss` returns only losses
- `GET /api/practice/?root_position_id=X&verdict=draw` returns only draws
- `GET /api/practice/?root_position_id=X&verdict=abandoned` returns only abandoned games
- Invalid verdict value returns 400
- No verdict specified returns all games (existing behavior)

**Filter by engine level:**
- `GET /api/practice/?root_position_id=X&engine_level=easy` returns only easy-level games
- `GET /api/practice/?root_position_id=X&engine_level=hard` returns only hard-level games
- Unknown engine_level returns empty list (not an error)

**Combined filters:**
- `?root_position_id=X&verdict=loss&engine_level=medium` returns only losses at medium
- Filters AND together (no OR semantics)

**Sort order:**
- `?root_position_id=X&sort=recent` returns games in descending created_at order (default)
- `?root_position_id=X&sort=oldest` returns games in ascending created_at order
- `?root_position_id=X&sort=longest` returns games sorted by move_count descending
- `?root_position_id=X&sort=shortest` returns games sorted by move_count ascending
- Invalid sort value returns 400

**Pagination:**
- `?root_position_id=X&limit=10&offset=0` returns first 10
- `?root_position_id=X&limit=10&offset=10` returns next 10
- Response includes `total_count` so frontend can display "Showing X of Y"
- limit=0 or limit<0 returns 400
- offset<0 returns 400
- limit defaults to 10 if not specified

**Aggregate stats must respect filters:**
- `GET /api/practice/stats/{position_id}?verdict=loss` returns stats computed only over losses
- `GET /api/practice/stats/{position_id}?engine_level=hard` returns stats only for hard-level games
- total_games in the filtered stats matches the filtered list length

Each test should:
- Create a position with a known set of practice games (mix of verdicts and levels)
- Hit the filtered endpoint
- Assert the response contains exactly the expected subset
- Assert counts and stats match expectations

Aim for at least 15 new tests covering the above cases.

### Acceptance criteria

- [ ] Practice History paginates at 10 games per view
- [ ] Filter controls work for verdict and engine level
- [ ] Sort order can be changed
- [ ] Aggregate stats reflect filtered view with clear indicator
- [ ] Empty states are friendly, not blank
- [ ] Works smoothly with positions that have 30+ practice games
- [ ] At least 15 new automated tests in test_practice.py for the new filter/sort/pagination params
- [ ] python test.py && python test_games.py && python test_game_api.py && python test_practice.py

### Manual test script

**Prerequisites — create test data:**
- [ ] Find or create a Position with at least 15 practice games across a mix of verdicts and engine levels
- [ ] If you don't have one, play several quick practice games (resign quickly) at different difficulty levels to accumulate data

**Pagination:**
- [ ] Navigate to the Position detail view
- [ ] Scroll to Practice History card
- [ ] Verify only 10 games visible initially
- [ ] A "Show more" button (or pagination controls) is visible below the list
- [ ] Click "Show more" (or next page) — more games appear
- [ ] Aggregate stats at the top of the card do NOT change based on pagination — they reflect all games

**Verdict filter:**
- [ ] Filter dropdown visible above the list
- [ ] Select "Losses" — list shows only losses
- [ ] Aggregate stats update to show stats for losses only
- [ ] A text indicator appears: "Showing X of Y games (filtered)"
- [ ] A "Clear filters" button is visible
- [ ] Click "Clear filters" — filter resets, all games visible, indicator disappears

**Engine level filter:**
- [ ] Select "Hard" from engine level filter
- [ ] List shows only hard-level games
- [ ] Combined filters work: Verdict=Loss AND Engine=Hard shows intersection only

**Sort:**
- [ ] Default sort is most recent first (check timestamps)
- [ ] Change to "Oldest" — order reverses
- [ ] Change to "Longest game" — games sort by move count descending
- [ ] Change to "Shortest game" — games sort by move count ascending

**Empty states:**
- [ ] Apply filters that exclude everything (e.g., engine level that doesn't exist in your data)
- [ ] See friendly message "No games match these filters" with a "Clear filters" suggestion
- [ ] Find a Position with zero practice games
- [ ] See friendly message "No practice games yet" — NOT a blank space

**Scalability visual check:**
- [ ] Scrolling the Practice History list is smooth with 30+ games
- [ ] Page does not lag when switching filters

If any item fails, do NOT commit. Report specific failures to Claude Code.

### Commit
```bash
git add -A
git commit -m "UI cleanup D: Practice History pagination, filtering, sorting, empty states"
```

---

## Phase E: Modal Reduction

Replace modals where a non-modal pattern serves the user better.

### E.1 Verdict edit

Currently: a modal opens to edit the verdict. Ugly and overkill for a 4-option choice.

Replace with **inline editing**:
- In both the Practice History row and the practice game viewer, the verdict is shown as clickable text or a small dropdown
- Clicking reveals a dropdown inline (no modal)
- Options: 1-0, 0-1, ½-½, —
- Selecting an option immediately saves and updates the display
- No separate "Save" button needed — change is committed on selection
- Confirmation via brief toast or color flash, not a modal

### E.2 Add/edit notes for practice games

Currently: a modal for notes.

Replace with **inline textarea**:
- Within the practice game viewer card, a notes section with an always-visible textarea
- Debounced auto-save on typing (save 1 second after user stops typing)
- Small "Saved" indicator briefly appears after save
- No "Edit notes" button, no modal — just type

### E.3 Delete confirmation

Currently: modal confirmation.

Replace with **inline confirmation pattern**:
- Click trash icon → icon transforms into "Confirm delete?" with Cancel/Delete buttons inline
- Click elsewhere to cancel
- Click Delete to remove and immediately show undo toast ("Game deleted. Undo") for 5 seconds
- If user clicks Undo within 5 seconds, restore the game
- No modal needed

This pattern is more forgiving than a confirmation modal because it provides undo, and more lightweight.

### E.4 Audit remaining modals

Go through every modal in the app and decide: is this modal justified?
- Draw offer response: YES — needs attention, modal is correct (from Phase B)
- Save practice game prompt: MAYBE — consider inline panel below board
- Delete confirmations: NO — replaced with inline + undo (this phase)
- Verdict edit: NO — replaced with inline (this phase)
- Notes edit: NO — replaced with inline textarea (this phase)

Document remaining modals in a comment in the code so future changes know which ones are intentional.

### Acceptance criteria

- [ ] Verdict edits happen inline, no modal
- [ ] Notes edit happens inline with auto-save, no modal
- [ ] Delete uses inline confirm + undo pattern
- [ ] Only intentional modals remain (draw offer response at minimum)
- [ ] Undo works within 5 seconds of delete
- [ ] python test.py && python test_games.py && python test_game_api.py && python test_practice.py

### Manual test script

**Verdict edit — inline:**
- [ ] Open a practice game viewer
- [ ] Find the verdict display
- [ ] Click it — a dropdown appears inline (no modal opens)
- [ ] Dropdown options: `1-0`, `0-1`, `½-½`, `—`
- [ ] Select a different option — immediately saves
- [ ] Brief confirmation (color flash or small "Saved" indicator) — not a modal
- [ ] Reload the page — the new verdict persists

**Verdict edit from Practice History row:**
- [ ] In the Position detail view, click the verdict in a Practice History row
- [ ] Same inline dropdown appears (no modal)
- [ ] Change succeeds and updates both the row AND the aggregate stats

**Notes edit — inline with auto-save:**
- [ ] Open a practice game viewer
- [ ] Notes textarea is always visible (no "Edit notes" button)
- [ ] Type some text
- [ ] Stop typing, wait ~1 second
- [ ] A "Saved" indicator appears briefly
- [ ] Reload the page — notes persist
- [ ] Edit notes again and navigate away WITHOUT waiting — should still be saved (debounced save triggered on blur as well)

**Delete with inline confirm + undo:**
- [ ] Create a disposable practice game (play a quick game against the engine)
- [ ] In Practice History, click the trash icon
- [ ] The trash icon transforms into "Confirm delete?" with Cancel/Delete buttons inline (NOT a modal)
- [ ] Click Cancel — control reverts to trash icon, game not deleted
- [ ] Click trash again, click Delete
- [ ] Row disappears immediately
- [ ] A toast appears: "Game deleted. Undo" — visible for 5 seconds
- [ ] Click "Undo" within 5 seconds — game is restored to the list
- [ ] Delete another game, wait 6+ seconds, verify Undo is no longer available (toast gone)
- [ ] Reload the page — the un-deleted game persists, the permanently-deleted one is gone

**Click-elsewhere cancel:**
- [ ] Click trash icon to enter confirm state
- [ ] Click somewhere else on the page (outside the row)
- [ ] Confirm state cancels, trash icon restored

**Audit remaining modals:**
- [ ] Draw offer response — still a modal (intentional, from Phase B)
- [ ] Save practice game prompt after game ends — document current behavior
- [ ] No other modals should appear for verdict edits, notes, or deletes
- [ ] Import PGN is still a full page (not a modal) from earlier work

**No regressions:**
- [ ] Labels from Phase A still correct
- [ ] Notifications from Phase B still prominent
- [ ] Card layout from Phase C still intact
- [ ] Filters and pagination from Phase D still work
- [ ] Clicking a practice game still opens the viewer
- [ ] Navigation (back button, URL routing) still works

If any item fails, do NOT commit. Report to Claude Code with specifics.

### Commit
```bash
git add -A
git commit -m "UI cleanup E: replace modals with inline editing, undo for deletes"
```

---

## Execution Order

Run phases in order A → B → C → D → E. Each phase commits separately. Test manually after each phase using the Manual Test Script at the end of that phase.

- Phase A: ~15 min (labels and icons)
- Phase B: ~20 min (notifications)
- Phase C: ~30 min (visual hierarchy)
- Phase D: ~30 min (scalability)
- Phase E: ~30 min (modal reduction)

Total: roughly 2-2.5 hours of Claude Code time, probably 3-4 hours with manual testing between phases.

Do not batch. One phase at a time, verify it works, commit, then proceed. This is especially important for Phase C (layout changes are visual and easy to mess up) and Phase E (modal changes touch many flows).

---

## Final Regression Check (after all 5 phases)

After Phase E is committed, run through this checklist to verify nothing critical broke. This catches cross-phase interactions.

**Core flows still work:**
- [ ] Can create a new Position from a FEN
- [ ] Can save a position from a game
- [ ] Can open a saved Position and see its details
- [ ] Can edit a Position's notes and tags
- [ ] Can delete a Position (with confirmation)
- [ ] Can start a practice session from a Position
- [ ] Can play moves against the engine
- [ ] Can resign a practice game
- [ ] Can offer a draw (accept and decline both work)
- [ ] Can stop a practice game (saves as abandoned)
- [ ] Can open a practice game and review it with arrow keys
- [ ] Can edit the verdict of a saved practice game (now inline)
- [ ] Can add/edit notes on a practice game (now inline)
- [ ] Can delete a practice game (now with undo)

**Import flow still works:**
- [ ] Can import a PGN file
- [ ] Progress bar works
- [ ] Cancel button works (atomic rollback)
- [ ] Duplicate detection works
- [ ] Form resets on navigation away and back

**Navigation:**
- [ ] Browser back button works throughout the app
- [ ] Direct URLs (e.g., `/positions/42`) load the correct view
- [ ] Tab switching works (Positions, Games, Collections, Search, Quiz)

**Other views unchanged in scope but not broken:**
- [ ] Games list still functional with filters and search
- [ ] Collections still work
- [ ] Search still works (exact position, pawn structure)
- [ ] Quiz still works

**Test suites all green:**
- [ ] python test.py
- [ ] python test_games.py
- [ ] python test_game_api.py
- [ ] python test_practice.py
- [ ] Total test count increased (new Phase D tests added)

**Final commit + push:**
```bash
git push
```
- [ ] Pushed to GitHub

If anything from this regression check fails, create a hotfix commit rather than going back through phases. The fix should not require re-doing earlier phases.

---

## Out of Scope for This Spec

These are acknowledged UX issues but not addressed here:

- Final UI design/branding pass (deferred)
- PWA wrapper (deferred)
- Game list (outside practice) pagination beyond current state
- Search/Collections/Quiz view cleanup (only Position detail is addressed)
- Accessibility audit (keyboard navigation, screen reader, color contrast) — future phase
- Mobile/responsive layout — future phase
