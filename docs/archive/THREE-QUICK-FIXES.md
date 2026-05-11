# Three Quick Fixes — Run in Order

Save this file to your project root, then run each section as a separate Claude Code prompt.

---

## Prompt 1: Restore Tabiya Practice Functionality

```
The tabiya practice functionality (Phase 10) was accidentally disabled during Phase 19 restructuring. Two things need fixing:

PROBLEM 1: In frontend/js/positions.js, the tabiya branch of showDetail() (the else block starting around line 185) hides all practice elements — it's identical to the puzzle branch. The tabiya branch should SHOW these elements, not hide them:
- practice-section → display = '' (show)
- practice-history-section → display = '' (show)  
- aggregate-stats-section → display = '' (show, it's inside practice-history-section)
- your-moves-section → display = '' (show)

PROBLEM 2: The practice-section div in index.html (around line 272) is EMPTY — the "Practice This Position" form was stripped out. It used to contain:
- A difficulty dropdown (engine levels: easy, medium, hard, max with depth/skill info)
- A color selector ("Your color" dropdown: White/Black)
- A "Start practice" button

Restore this form HTML inside the practice-section div. The form should:
- Load engine levels from Practice.loadLevels() on display
- On "Start practice" click, start a practice game against Stockfish at the selected difficulty
- The practice game logic is already in practice.js — find the startGame or similar function and wire the button to it

Also: in the tabiya branch, after showing the practice sections, load the practice history for the current position. Look at how Practice.loadPracticeHistory() was called previously and add that call back.

The puzzle branch should remain unchanged — all practice elements stay hidden for tactics.

After changes, verify in browser:
- Open a tabiya → Practice This Position card shows with difficulty dropdown and Start Practice button
- Practice History card shows with any existing games
- Your Moves From Here card shows
- Open a tactic → none of these appear (only title, FEN, notes, engine, action buttons)

After changes: python test.py && python test_games.py && python test_game_api.py && python test_practice.py && python test_position_types.py
```

---

## Prompt 2: Verify Search (manual — no Claude Code needed)

Do this yourself in the browser. No code changes unless something is broken.

1. Click the "Search" tab in the nav
2. You should see a board and a FEN input field
3. Test exact position search:
   - Paste this FEN (a common Sicilian position): rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5
   - Make sure "Exact position" radio is selected
   - Click Search
   - If you have Sicilian games imported, results should appear
   - If you have no games with this position, try the starting position FEN instead
4. Test pawn structure search:
   - Select "Pawn structure" radio
   - Use the same FEN (or any FEN)
   - Click Search
   - Results should show all games that have the same pawn skeleton, regardless of piece placement
5. Click a search result — it should open the game viewer at the matching move

If any of this is broken, describe the failure and I'll write a fix prompt.

---

## Prompt 3: UI Refresh Pass

```
Quick UI polish pass. Do NOT restructure or refactor — just improve visual consistency and spacing. Read the existing CSS in frontend/css/style.css and frontend/css/components.css before making changes.

Changes to make:

1. TURN INDICATOR: On position detail pages (both tabiya and tactic), add a visible turn indicator below the board, next to "Flip Board". Show "White to move" or "Black to move" based on the FEN. Use a small circle (white or dark) plus text. Extract the turn from the FEN (the letter after the first space: 'w' or 'b').

2. NAV STYLING: The top nav buttons should have clear active state. The currently active tab should have a bottom border or background color that makes it obviously selected. Inactive tabs should be clearly distinct from the active one.

3. CARD CONSISTENCY: All cards on detail pages should have identical border-radius, padding, and shadow/border treatment. Scan all .card usages and ensure they share the same CSS values. Current state may have inconsistencies from multiple phases of changes.

4. EMPTY STATES: When a list is empty (no practice games, no search results, no tactics saved), show a friendly message with a subtle icon or illustration. Not just blank space. Check: tactics list when empty, practice history when no games, search results when no matches.

5. BUTTON CONSISTENCY: All buttons should follow the same size/padding scale. Primary actions (Start Practice, Show Engine, Search) should be visually distinct from secondary actions (Edit, Delete, Back). Scan all .btn usages for consistency.

6. TYPOGRAPHY: Ensure heading sizes follow a clear hierarchy:
   - Page titles: 24px
   - Card headers: 16px, font-weight 600
   - Labels (FEN, YOUR NOTES, etc.): 12px uppercase, muted color
   - Body text: 14px
   Check for any elements that deviate from this scale and fix them.

7. BOARD CARD: The board on the left should be in a card that matches the right panel cards. Same border/shadow treatment. The board should not float in raw whitespace.

Do NOT change any functionality. Only CSS and minor HTML class/attribute changes. Do NOT modify any JavaScript logic.

After changes, verify in browser:
- Overall visual impression is cleaner and more consistent
- Turn indicator shows correctly (White to move / Black to move)
- Active nav tab is obvious
- Cards look uniform
- Buttons are consistent
- No console errors
- All existing functionality still works

After changes: python test.py && python test_games.py && python test_game_api.py && python test_practice.py && python test_position_types.py
```

---

## Execution Order

1. Run Prompt 1 (restore tabiya practice). Verify in browser. Commit:
   ```bash
   git add -A && git commit -m "Restore tabiya practice functionality (start practice form + show practice history)" && git push
   ```

2. Do Prompt 2 yourself (manual search verification). If broken, tell Claude Code what failed. If working, move on.

3. Run Prompt 3 (UI refresh). Verify in browser. Commit:
   ```bash
   git add -A && git commit -m "UI refresh: turn indicator, nav styling, card consistency, typography hierarchy" && git push
   ```
