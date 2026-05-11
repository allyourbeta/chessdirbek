# Phase 18: Complete the Puzzle/Tabiya UI Split + Puzzle Navigation

This phase finishes work that Phase 15 specified but didn't actually implement: the position detail view should show DIFFERENT UI for puzzles vs tabiyas, not the same UI for both.

It also adds the navigation feature that makes puzzle-drilling actually useful: a "Next puzzle" button so you can flip through puzzles like a workbook.

This is two parts. Do them in order. Verify Part 1 visually in the browser before starting Part 2.

---

## Context (read this first)

Current state of the puzzle detail view (verified by user screenshot):

A puzzle position currently shows ALL of these sections, even though most are irrelevant for puzzles:
- Title and tags
- FEN and Notes
- Stockfish Analysis (none)
- **Quiz Stats** — irrelevant, user doesn't quiz puzzles
- Edit / Eval / Play from here / Delete / Back buttons
- **Practice This Position** with engine selector — irrelevant, user doesn't practice puzzles
- **Practice History** with verdict filters — irrelevant
- **Aggregate Stats** — irrelevant

The bolded sections should NOT appear on puzzle pages. Only the title, tags, FEN, notes, board, and a minimal action set should appear.

The user's mental model is now clear:
- A **puzzle** is a position to think about. The user looks, thinks, optionally turns on the engine to verify, then moves to the next puzzle. No tracking. No practice games. No quiz attempts. Just a workbook flip-through experience.
- A **tabiya** is a position to play games from. All the existing Practice features apply.

These are two genuinely different artifacts and the UI must reflect that.

Phase 15 specified this split but the implementation didn't fully execute. The data model is correct (position_type column with values 'puzzle' or 'tabiya') but the rendering layer ignores the type.

---

## Part 1: Make the puzzle and tabiya detail views actually different

### Required puzzle detail view

A puzzle position's detail page shows ONLY these elements, in this order:

**Top of right panel:**
- Title card: position title and tags
- FEN card: FEN string (read-only, copy button)
- Notes card: notes (editable inline if user wants)

**Action buttons** (single row):
- **Show Engine / Hide Engine** (primary toggle button, replaces the current "Eval: OFF" button — see Part 1.5 for renaming)
- Edit
- Delete
- Back

**Bottom of right panel:**
- Nothing else. No Quiz Stats. No Practice This Position. No Practice History. No Aggregate Stats. No "Your Moves From Here." Nothing.

The board on the left stays as it is — board with Flip Board button.

### Required tabiya detail view

A tabiya position's detail page shows the existing tabiya UI mostly unchanged, with ONE exception:

- **Remove Quiz Stats card.** Quiz Stats doesn't apply to tabiyas either. The whole "Quiz Stats" concept is being removed from the codebase in Part 1.6.

Otherwise tabiya pages stay as they currently render: title, tags, FEN, notes, Stockfish Analysis, Edit / Eval / Play from here / Delete / Back, Practice This Position, Practice History, Your Moves From Here.

### Part 1.5: Rename the engine toggle button

Currently the engine toggle reads "Eval: OFF" / "Eval: ON". Rename to:

- "Show Engine" (when engine is currently off)
- "Hide Engine" (when engine is currently on)

Same underlying functionality — turning Stockfish analysis on or off. The new label is clearer for the puzzle workflow where the user is asking "show me the answer" rather than "show me the eval number."

This rename applies in BOTH puzzle and tabiya detail views.

### Part 1.6: Remove Quiz Stats entirely

The Quiz Stats concept doesn't apply to puzzles (no quiz tracking) or tabiyas (different practice model). Remove it from the codebase:

- Remove the Quiz Stats card from all detail views
- Leave the underlying data alone if it's already in the database (don't run a destructive migration just to clean up unused columns) — just stop rendering it
- This is a UI-only removal, not a data deletion

### Part 1.7: Remove the Quiz tab from navigation

The Quiz tab in the top navigation is no longer needed. Its function (work through positions one at a time) is replaced by Part 2's puzzle navigation. Remove the Quiz tab from the nav and its routing.

If the underlying Quiz components, routes, or backend endpoints are still needed for some other reason, leave them in place but unreachable from nav. If they're truly unused, delete them. Use judgment — don't delete things that are imported elsewhere.

### Part 1 acceptance criteria

ALL of these must be visually verified in the browser, not just inferred from passing tests:

- [ ] Open a puzzle position. Verify ONLY title/tags, FEN, notes, action buttons (Show Engine / Edit / Delete / Back), and board are visible. NO quiz stats, NO practice this position, NO practice history, NO aggregate stats, NO your moves from here.
- [ ] Open a tabiya position. Verify all existing tabiya features still work (Practice This Position, Practice History, etc.) but Quiz Stats is gone.
- [ ] The engine toggle reads "Show Engine" when off and "Hide Engine" when on, in both puzzle and tabiya views.
- [ ] Clicking "Show Engine" on a puzzle turns on Stockfish analysis with the eval and best-move arrow displayed (same as current Eval: ON behavior).
- [ ] The Quiz tab is no longer in the top nav.
- [ ] Visiting the old Quiz URL directly returns 404 or redirects somewhere sensible (Puzzles tab is fine).
- [ ] No console errors in browser DevTools when viewing puzzle or tabiya pages.
- [ ] All existing tests still pass: python test.py && python test_games.py && python test_game_api.py && python test_practice.py && python test_lichess_import.py && python test_position_types.py

### Commit Part 1 before starting Part 2

```bash
git add -A
git commit -m "Phase 18 Part 1: complete puzzle/tabiya UI split, rename Eval to Show/Hide Engine, remove Quiz tab"
```

---

## Part 2: Puzzle navigation (Next / Previous)

Do not start until Part 1 is committed.

### Goal

When viewing a puzzle, the user should be able to flip to the next or previous puzzle without going back to the list. This is the workbook-flip-through experience.

### Required UI

On puzzle detail pages, add navigation buttons. Place them prominently — these are now the primary actions for puzzle drill mode.

Layout:
- Existing action button row gains: **Previous Puzzle** | **Next Puzzle**
- These are the two most prominent buttons
- "Next Puzzle" is primary (blue), "Previous Puzzle" is secondary (outlined)
- Keep Show/Hide Engine, Edit, Delete, Back in the same row but visually less prominent
- Best layout: a single row like: `[← Previous] [Show Engine] [Edit] [Delete] [Back] [Next →]` with Next being the primary blue button on the right

Keyboard shortcuts (nice-to-have, not required):
- Right arrow → Next Puzzle
- Left arrow → Previous Puzzle
- Spacebar → toggle Show/Hide Engine

### Behavior

**Order:** Puzzles are navigated in the order they appear on the Puzzles list page. If the user filtered the list by tag (e.g., #tactics-missed) before clicking into a puzzle, Next/Previous should respect that filter.

**Implementation approach:** When clicking a puzzle from the list, pass the current filter state as URL params (e.g., `/puzzles/123?tag=tactics-missed`). The puzzle detail page reads those params and queries for the next/previous puzzle ID.

**At the boundaries:**
- "Previous" on the first puzzle: button is disabled (greyed out)
- "Next" on the last puzzle: button is disabled OR shows "End of set" message

**Position counter:** Below or above the navigation, show "Puzzle 12 of 247" so the user knows where they are in the set.

### API support needed

A new endpoint or query parameter to get the next/previous puzzle ID given the current puzzle and the filter:

`GET /api/positions/{id}/next?type=puzzle&tag=tactics-missed`
Returns: `{ "next_id": 124, "previous_id": 122, "current_index": 12, "total_count": 247 }`

OR add fields to the existing `GET /api/positions/{id}` response when it's a puzzle:
- `next_puzzle_id`
- `previous_puzzle_id`
- `current_index`
- `total_count`

Either approach is fine. Pick the simpler one.

### Tests

Add to `test_position_types.py` or new `test_puzzle_navigation.py`:

- `test_next_puzzle_returns_next_in_order` — given puzzle 12, returns ID of puzzle 13
- `test_next_puzzle_at_end_returns_null` — last puzzle has no next
- `test_previous_puzzle_at_start_returns_null` — first puzzle has no previous
- `test_next_puzzle_respects_tag_filter` — filtering by tag only returns puzzles with that tag
- `test_navigation_only_returns_puzzles_not_tabiyas` — never navigates to a tabiya from a puzzle context

### Part 2 acceptance criteria

Manual browser verification (mandatory):

- [ ] Open a puzzle from the Puzzles list (with no filter). Click "Next Puzzle" — moves to the next puzzle.
- [ ] Continue clicking Next a few times. Verify each click loads a new puzzle without going back to the list.
- [ ] Click "Previous Puzzle" — goes back one puzzle.
- [ ] Filter the Puzzles list by tag (e.g., #tactics-missed). Click into a puzzle. Click Next. Verify it stays within the filter.
- [ ] At the start of a filtered set, "Previous Puzzle" is disabled.
- [ ] At the end of a filtered set, "Next Puzzle" is disabled (or shows end-of-set message).
- [ ] Position counter ("12 of 247") is visible and updates correctly.
- [ ] Show/Hide Engine still works on each new puzzle as you navigate. Engine state can be either persistent (stays on as you navigate) or reset (off on each new puzzle) — choose persistent because it matches the workflow of "I want engine on for this whole drill session."
- [ ] All tests pass.

### Commit Part 2

```bash
git add -A
git commit -m "Phase 18 Part 2: puzzle navigation with filter-aware Next/Previous, position counter"
git push
```

---

## Final integration test (after both parts committed)

End-to-end workflow that proves the complete puzzle drill experience works:

1. Open the app
2. Navigate to Puzzles tab
3. Filter by `#tactics-2` (or whatever tag has multiple puzzles)
4. Click on the first puzzle
5. Verify: clean puzzle view (no quiz/practice clutter), board shows the position, "Show Engine" button visible, navigation visible, position counter shows "1 of N"
6. Click "Show Engine" — engine analysis appears (eval bar + best move arrow)
7. Click "Next Puzzle" — moves to puzzle 2 of N
8. Verify engine state persists (still on)
9. Click Next a few more times
10. Click Previous to go back
11. Click Back to return to the Puzzles list
12. Verify list still shows the filter applied

If all 12 steps work cleanly, the puzzle drill experience is functional and the user can actually start studying.

---

## Why this spec is structured this way

- Two parts because Part 1 is fixing/completing existing work (Phase 15) and Part 2 is genuinely new functionality. Different cognitive modes for Claude Code.
- Mandatory browser verification because Phase 15's UI failed silently — tests passed but the visual behavior was wrong. Same pattern can recur.
- Explicit "what should NOT appear" sections because Claude Code defaults to additive thinking. Telling it what to remove is essential.
- The renaming (Eval → Show/Hide Engine) and removal (Quiz tab, Quiz Stats) are bundled in because they're conceptually one cleanup: "the puzzle workflow doesn't have quizzing or evaluation, it has engine verification."
- Final integration test reproduces the actual user workflow end-to-end. If this works, the feature is shipped.

---

## What this enables

After Phase 18:

The user can open the Puzzles tab, filter by category (#tactics-missed, #tactics-2, #morra, etc.), click in, and flip through puzzles one at a time using Next/Previous. On each puzzle they think, optionally show the engine for verification, and move on. This is the actual puzzle drill workflow they wanted from the beginning.

This unlocks real use of the 340+ puzzles imported from Lichess.

---

## Out of scope

These can be future improvements but are NOT part of Phase 18:

- Spaced repetition (track which puzzles you've seen recently, prioritize unseen)
- Puzzle of the day
- Random shuffle option for puzzle order
- "Mark this puzzle as solved/missed" (no tracking, per user requirement)
- Moving puzzles between tags
- Bulk reclassifying puzzles → tabiyas (existing UI handles this if needed)
