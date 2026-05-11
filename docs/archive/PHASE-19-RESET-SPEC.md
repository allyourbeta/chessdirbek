# Phase 19: Reset and Restructure

This phase rolls back failed work and restructures the navigation around the user's actual workflow. Goal: a clean, working app where every nav item does something useful and works end-to-end.

## Context for Claude Code

The user has lost confidence in several recent additions because they were claimed to be "complete" but didn't actually work in the browser. Specifically:

- **Phase 15** specced a puzzle/tabiya UI split. The data model split was implemented correctly, but the UI rendering still shows all sections for both types. Despite passing tests, the visible behavior was wrong.
- **Phase 18** was supposed to fix Phase 15's UI split. It also claimed completion. The visible behavior is still wrong.
- **Phase 17** (Lichess Studies Import) imported 350+ chapters that turned out to be garbage from the user's perspective — the studies are FEN-only positions to think about, not positions with recorded solutions.

This phase is a reset. Do not assume previous work is correct. Verify by direct inspection. **Manual browser verification is mandatory before claiming any acceptance criterion is met.**

## Mandatory upfront step: Investigate before writing code

Before any changes, do the following:

1. Read the actual current state of the puzzle detail page rendering code. Identify why the conditional rendering for puzzle vs tabiya hasn't worked despite multiple attempts. Document findings in a comment at the top of the file.
2. Read the actual current state of the engine toggle code. Identify why clicking "Show Engine" / "Eval: ON" on puzzle pages produces no visible result. Document findings.
3. Read the Search functionality code (likely in a search view module). Note whether exact-position search and pawn-structure search are both wired up.

These findings inform the actual fixes. Do not skip this step. Past attempts at fixing the same code failed because they were assumption-based.

---

## Part 1: Delete what doesn't work

### 1.1: Backup the database

Before any deletions, run:
```bash
./scripts/backup_now.sh
```
(Or whatever the manual backup script is named — it was created in Phase 16A.)

Verify a backup file appears in the backups/ directory before proceeding.

### 1.2: Delete all puzzle-typed positions

The user's existing 5 tabiyas (IDs 1-5: Martinez, Dyulgerov, Player3 positions) and any other tabiyas must be preserved. Only puzzle-typed positions are deleted.

Create `scripts/delete_all_puzzles.py`:

```python
"""
One-time cleanup: delete all puzzle-typed positions.
Tabiyas are preserved.
Run after backup.
"""
# Connect to production DB
# Count puzzles: SELECT COUNT(*) FROM positions WHERE position_type = 'puzzle'
# Print: "About to delete N puzzle positions and their tag links. Tabiyas (M positions) will be preserved. Continue? [y/N]"
# On 'y':
#   DELETE FROM position_tags WHERE position_id IN (SELECT id FROM positions WHERE position_type = 'puzzle')
#   DELETE FROM positions WHERE position_type = 'puzzle'
#   Commit
#   Print: "Deleted N puzzles. M tabiyas remain."
# On anything else: abort, print "Cancelled."
```

Run the script. Verify with:
```sql
SELECT COUNT(*) FROM positions WHERE position_type = 'puzzle';  -- should return 0
SELECT COUNT(*) FROM positions WHERE position_type = 'tabiya';  -- should return the existing tabiya count (likely 5+)
```

### 1.3: Remove Lichess Studies import code entirely

Delete:
- The Lichess backend API module (likely `backend/api/lichess.py` — verify path)
- Its registration in the main FastAPI app router
- The Lichess frontend page (find by searching for "Import from Lichess" or `/games/lichess`)
- The "Import from Lichess" button from the Games view
- Client-side routing entry for the Lichess page
- `test_lichess_import.py` and any related test files
- `test_puzzle_import.py` if it exists

Do NOT remove `httpx` from requirements.txt unless `grep -r "import httpx\|from httpx" backend/ tests/` returns no results.

Verify:
- `grep -r "lichess" backend/ frontend/ tests/` returns nothing meaningful (only false positives in comments are acceptable)
- The app starts cleanly: `python -m backend.main` (or whatever the start command is) produces no import errors
- Existing tests still pass

### 1.4: Remove Quiz tab and its code

The Quiz tab serves no purpose now. The tactic study workflow is "browse Tactics list → click tactic → think → engine on for verification."

Delete:
- The Quiz nav button
- Quiz view in the HTML
- Quiz-related JS functions
- Quiz routing entry
- Quiz Stats card from any position detail rendering (it shouldn't appear on puzzles or tabiyas)
- Backend Quiz endpoints if they exist (check `backend/api/` for a quiz module)
- Quiz-related tests

Quiz Stats data in the database can stay (no destructive migration). Just stop rendering it.

### Part 1 acceptance criteria

- [ ] `scripts/delete_all_puzzles.py` exists and was run
- [ ] `SELECT COUNT(*) FROM positions WHERE position_type = 'puzzle'` returns 0
- [ ] Tabiya count is unchanged from before
- [ ] No Lichess code remains: `grep -r "lichess" backend/ frontend/ tests/` returns no meaningful matches
- [ ] No Quiz code in nav or routing
- [ ] App starts without errors
- [ ] Existing tests pass: `python test.py && python test_games.py && python test_game_api.py && python test_practice.py && python test_position_types.py`

### Commit Part 1

```bash
git add -A
git commit -m "Phase 19 Part 1: delete all puzzles, remove Lichess import code, remove Quiz tab"
```

---

## Part 2: Restructure top navigation

### 2.1: New nav structure

Replace the current top nav with exactly these 5 items, in this order:

1. **Tabiyas**
2. **Tactics**
3. **Games**
4. **Search**
5. **Import PGN**

Remove:
- Positions (replaced by Tabiyas + Tactics)
- Add New (becomes contextual button inside Tabiyas and Tactics — see 2.2)
- Practice (removed entirely)
- Collections (moved inside Games)

### 2.2: Tabiyas page

Route: `/tabiyas`

This is what was the Positions page filtered to `position_type = 'tabiya'`. Shows:
- List of all tabiya positions
- Each row: title, tags, mini-board preview
- Filters: tag autocomplete (existing component from Phase 9)
- A primary button at the top: **"+ New Tabiya"** — opens the existing Add Position form, but with the position type pre-set to "tabiya"
- Click a row → opens that tabiya's detail page

Confirm the existing tabiya detail page works as it did. (We're cleaning it up in Part 4.)

### 2.3: Tactics page

Route: `/tactics`

This is the Positions page filtered to `position_type = 'puzzle'`. Internally it queries by 'puzzle', user-facing label is "Tactics."

Shows:
- List of all tactic positions (will be empty after Part 1 — that's correct)
- Each row: title, tags, mini-board preview
- Filters: tag autocomplete
- A primary button at the top: **"+ New Tactic"** — opens the existing Add Position form, with position type pre-set to "puzzle"
- Click a row → opens that tactic's detail page

### 2.4: Games tab unchanged but with Collections folded in

Games tab keeps its existing functionality (browse PGN database, view games). Add Collections access as a sub-nav or filter chip within the Games view, NOT as a top-level nav item.

If Collections currently has its own page, leave that page accessible via direct URL but remove the top-nav link. The Collections list can be shown as a sidebar or filter on the Games page.

If repackaging Collections this way is too much work for this phase, just remove Collections from top nav and leave the Collections page accessible via Games → "Browse Collections" link or button. Don't over-invest here.

### 2.5: Search tab — verify it works

Search was specced in Phase 9 with both exact-position and pawn-structure modes. Has not been user-tested.

Manually verify:
1. Open the Search tab
2. Try exact position search: paste a known FEN that exists in the games database, click search, verify results appear
3. Try pawn structure search: enter a pawn pattern (e.g., "Black pawns on c6, d5, e6"), click search, verify results appear

If either mode is broken or missing UI, fix it in this phase. The fix should match the Phase 9 spec (refer to SPEC-v2.md Phase 9 section 8C).

If both modes already work, great — just verify and move on.

### 2.6: Import PGN as top-level nav item

The existing Import PGN flow (currently accessed from inside Games) becomes a top-level nav item. Same functionality, just promoted for visibility.

The Games tab can keep its "Import PGN" button too if you want — having it in two places is fine for discoverability. Or remove it from inside Games to avoid duplication. Pick one and be consistent.

### Part 2 acceptance criteria

Manual browser verification (mandatory):

- [ ] Top nav shows exactly: Tabiyas | Tactics | Games | Search | Import PGN (in that order)
- [ ] No "Positions", "Add New", "Practice", "Collections", or "Quiz" in top nav
- [ ] Tabiyas page shows existing tabiyas (5+) with "+ New Tabiya" button
- [ ] Clicking "+ New Tabiya" opens the position creation form. Saving creates a tabiya (verify with `SELECT position_type FROM positions ORDER BY id DESC LIMIT 1` after saving).
- [ ] Tactics page shows empty list (since we deleted all puzzles in Part 1) with "+ New Tactic" button
- [ ] Clicking "+ New Tactic" opens the same form. Saving creates a puzzle.
- [ ] Games page works as before (browse, click into game viewer)
- [ ] Search tab is accessible. Exact position search works. Pawn structure search works.
- [ ] Import PGN tab is accessible and works (use a small test PGN to verify, don't import anything large)
- [ ] All existing tests pass

### Commit Part 2

```bash
git add -A
git commit -m "Phase 19 Part 2: restructure nav (Tabiyas | Tactics | Games | Search | Import PGN), contextual New buttons"
```

---

## Part 3: Fix the engine toggle on detail pages

### 3.1: Investigate why it currently does nothing

On a puzzle detail page (or tabiya page — same component likely), clicking "Show Engine" / "Eval: ON" / "Eval: OFF" produces no visible result. Stockfish doesn't run, no analysis appears.

Required investigation steps:

1. Open the browser DevTools Console
2. Click the engine toggle button on a puzzle page
3. Note: any console errors? Any network requests?
4. Check the backend terminal for any logs
5. Read the engine toggle JavaScript — find the function it calls
6. Read what that function does — does it actually invoke Stockfish? Does it update the DOM with results?

Document the root cause in a comment before fixing.

### 3.2: Fix the toggle to actually run Stockfish

When the user clicks the engine toggle:

- Stockfish (the WASM engine, already integrated in Phase 7) runs on the current position
- Engine is configured for **multi-PV = 3** (top 3 lines)
- For each of the top 3 lines, display:
  - Eval (e.g., "+1.4" or "M3" for mate)
  - Depth reached
  - Move sequence (in SAN notation, e.g., "1. Nxe5 dxe5 2. Bc4+")
- Display these 3 lines in the area where the engine output is supposed to appear
- The button label updates: "Show Engine" → "Hide Engine" (or "Engine: OFF" → "Engine: ON")
- Clicking again hides the analysis and stops Stockfish

Multi-PV in Stockfish is set via the UCI command `setoption name MultiPV value 3` before starting analysis.

Also: when navigating between pages, if the engine was on, it should stop (don't leave Stockfish running in the background after navigating away).

### 3.3: Apply on both puzzle and tabiya pages

The engine toggle should work identically on both puzzle and tabiya detail pages. If there's currently shared code, fix the shared code. If they're separate, fix both.

### Part 3 acceptance criteria

Manual browser verification:

- [ ] Open a tabiya detail page. Click engine toggle. Verify: 3 lines of analysis appear with eval, depth, and move sequence. Each line is distinct.
- [ ] Click engine toggle again. Analysis disappears. Stockfish stops (no background CPU).
- [ ] Create a new tactic via the New Tactic button. Open it. Click engine toggle. Verify same 3-line output.
- [ ] Navigate from a position with engine ON to a different page. Stockfish stops.
- [ ] Refresh the page. Engine starts in OFF state by default.
- [ ] No console errors during any of the above.
- [ ] All existing tests pass.

### Commit Part 3

```bash
git add -A
git commit -m "Phase 19 Part 3: fix engine toggle to actually run Stockfish multi-PV (3 lines)"
```

---

## Part 4: Complete the puzzle/tabiya UI split

### 4.1: Investigate why previous attempts failed

Phase 15 and Phase 18 both specced this and both failed. Before writing any new code:

1. Read the current position detail page component(s)
2. Find the conditional logic (or lack thereof) for puzzle vs tabiya rendering
3. Determine what previous attempts actually changed (if anything) and why the change didn't take effect

Document findings as a comment.

Common failure modes to check for:
- Conditional renders the same content in both branches
- Conditional check uses wrong field name (e.g., `type` instead of `position_type`)
- Conditional is on a stale variable that doesn't update
- Backend doesn't actually return position_type in the response

### 4.2: Tactic detail page (renamed from puzzle, but internal type is still 'puzzle')

A tactic position detail page shows ONLY:

**Left side:**
- Board (with Flip Board button)

**Right side:**
- Title and tags card
- FEN card (read-only with copy button)
- Notes card (editable inline)
- Action buttons row: **Show Engine** | **Edit** | **Delete** | **Back to Tactics**
- Engine analysis output area (empty until Show Engine is clicked, then shows 3 lines from Part 3)

That is everything. Nothing else renders.

Specifically, NONE of these appear:
- Quiz Stats card
- Practice This Position card
- Practice History card
- Aggregate Stats
- Your Moves From Here card

### 4.3: Tabiya detail page

Stays largely as it currently is, with one exception: remove the Quiz Stats card (it doesn't apply to tabiyas any more than to tactics).

So the tabiya page shows:
- Board with Flip Board
- Title and tags card
- FEN, Notes, Stockfish Analysis card
- Action buttons: Show Engine | Edit | Play from here | Delete | Back to Tabiyas
- Practice This Position card (engine difficulty, color, Start Practice)
- Practice History card (with filters and game list)
- Your Moves From Here card

### 4.4: Removal of Quiz Stats (already covered in Part 1.4 if Quiz removal was complete)

If Quiz Stats was already removed from the rendering during Part 1, just verify nothing remains. If not, remove it now.

### Part 4 acceptance criteria

Manual browser verification (this is critical — past failures slipped past automated tests):

- [ ] Open any tabiya position. Verify all tabiya elements render correctly. Verify Quiz Stats is gone.
- [ ] Open any tactic position (create a test one if Tactics list is empty). Verify ONLY the bare elements render: title/tags, FEN, notes, board, action buttons. NO Quiz Stats. NO Practice This Position. NO Practice History. NO Aggregate Stats. NO "Your Moves From Here."
- [ ] Take a screenshot of each detail page (puzzle and tabiya). Visually compare against the spec. They should look distinctly different.
- [ ] No console errors.
- [ ] All existing tests pass.

### Commit Part 4

```bash
git add -A
git commit -m "Phase 19 Part 4: actually complete the puzzle/tabiya UI split this time"
git push
```

---

## Final integration test

After all four parts are committed and pushed, do this end-to-end verification:

1. Open the app fresh (refresh the browser)
2. Top nav shows: Tabiyas | Tactics | Games | Search | Import PGN
3. Click Tabiyas — see existing tabiyas with "+ New Tabiya" button
4. Click into a tabiya — see the FULL tabiya UI (with Practice History, etc.) but NO Quiz Stats
5. Click Show Engine — 3 lines of Stockfish analysis appear
6. Click Hide Engine — analysis disappears
7. Click Back to Tabiyas, then Tactics
8. Tactics list is empty. Click "+ New Tactic"
9. Set up a position via FEN, save
10. The new tactic appears in the list. Click into it.
11. Tactic detail page shows ONLY: title/tags, FEN, notes, board, action buttons. Nothing else.
12. Click Show Engine — 3 lines of analysis appear
13. Click Search — exact position search works, pawn structure search works
14. Click Import PGN — accessible, works (no need to actually import for this test)
15. Click Games — browse, click into a game, viewer works

If all 15 steps pass, the reset is complete and the app is in a good usable state.

If any step fails, that step's failure is reported back to Claude Code for a focused fix BEFORE moving on.

---

## What's intentionally not in this spec

- "New Tabiya" / "New Tactic" forms asking the user "is this a puzzle or tabiya?" — not needed because the button context implies the type
- Puzzle navigation (Next/Previous within filtered set) — moved to a future phase, not blocking initial usability
- Spaced repetition for tactics — future
- Bulk operations (delete multiple tactics at once) — future
- A "rebuild Lichess import properly" attempt — explicitly abandoned

Reach a stable, working baseline first. Add features later only if real use surfaces the need.

---

## Why this spec is structured this way

- Mandatory upfront investigation prevents fix-by-assumption (the failure mode of Phase 15 and 18)
- Each part commits separately so partial failures don't lose work
- Manual browser verification is required because past phases passed tests but were visually broken
- The "investigate first" requirement appears in every part where existing broken code is being fixed
- Final integration test is the user's actual workflow — if it works end-to-end, the spec succeeded
