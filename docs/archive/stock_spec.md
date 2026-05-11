# Chess Study App – Save / Delete / Duplicate Prevention / Stockfish Fix Spec

## Goal

Fix the remaining core functionality problems in the chess study app:

1. Tabiyas render correctly
2. Tactics render correctly
3. Each tabiya/tactic detail page has a working Delete button
4. Duplicate positions are not allowed when adding new tabiyas/tactics
5. Duplicate attempts show a meaningful, visible error message
6. Stockfish runs correctly and immediately shows analysis lines instead of staying stuck on “Thinking...”

This spec is for **minimal, surgical fixes only**.

---

## Root Cause Framing

Do not assume the Stockfish issue is only a UI problem.

The bug may be in one or more of these layers:

- engine asset path is wrong
- backend static-file serving does not expose the Stockfish directory
- worker/script fails to load in browser
- event listeners are wrong
- engine messages are received but not rendered
- SAN conversion or other async processing blocks visible output

Claude must verify the whole chain rather than tweaking blindly.

---

## Section 1 — Delete Button for Tabiyas and Tactics

### Requirement
Each tabiya and tactic detail page must visibly include a Delete button.

### Behavior
- Clicking Delete should ask for confirmation
- If confirmed, the position is deleted from the database
- After deletion, user is navigated back to the correct list page:
  - deleted tabiya → Tabiyas list
  - deleted tactic → Tactics list

### Acceptance Criteria
- Delete button is visible on both tabiya and tactic detail views
- Delete actually removes the position
- Reload confirms it is gone
- Navigation returns user to the correct list

---

## Section 2 — Duplicate Prevention on Add

### Requirement
Do not allow creation of duplicate tabiyas or tactics.

### Definition of duplicate
Use the app’s existing duplicate logic if already present.
If there is existing backend or DB-level uniqueness behavior, reuse it rather than inventing a new duplicate system.

If no reliable existing enforcement exists, duplicate detection should be based on the intended current app rule, most likely:
- same position type
- same FEN
and possibly same name if the app already uses that

Claude must inspect current code and preserve existing intended behavior.

### UX requirement
If user tries to add a duplicate:
- do not silently fail
- do not just log to console
- show a clear visible error in the UI

### Good error message examples
- “This tabiya already exists.”
- “A tactic with this position already exists.”
- “Duplicate position not allowed.”

### Acceptance Criteria
- Duplicate adds are blocked
- User sees clear on-screen feedback
- Non-duplicate positions still save normally

---

## Section 3 — Stockfish Must Actually Run

### Requirement
Clicking “Run Stockfish” must cause analysis output to appear quickly.
The UI must not remain indefinitely at “Thinking...”.

---

### 3.1 Verify engine asset loading first

Claude must explicitly verify:

- where the frontend expects the Stockfish file to be
- whether that file actually exists in the repo
- whether the backend serves that file path as static content
- whether browser-side loading succeeds

If frontend references something like:
- `/vendor/stockfish/...`

then backend must mount/serve `/vendor` correctly.

### Acceptance Criteria
- Stockfish engine file loads successfully in browser
- No 404 or missing-worker failure
- No silent failure due to unserved static path

---

### 3.2 Do not leave UI at “Thinking...” without diagnostics

If engine initialization fails:
- user should see a visible error message
- console should show actionable log output

Examples:
- “Stockfish failed to load.”
- “Engine worker could not be initialized.”

Do not leave the user with only “Thinking...”.

---

### 3.3 Immediate visible output

As soon as Stockfish sends analysis info lines, render them immediately.

Do not block visible output on:
- SAN conversion
- backend round-trips
- any optional post-processing

If necessary:
- show raw PV first
- enhance later

### Acceptance Criteria
Within a short time after clicking Run Stockfish, user sees analysis lines such as depth/eval/PV.

---

### 3.4 Worker / listener correctness

Claude must inspect and fix:
- worker construction
- message listeners
- duplicate listeners
- old listeners not being removed
- incorrect onmessage wiring

### Acceptance Criteria
- repeated runs do not stack broken listeners
- output does not duplicate unexpectedly
- engine responds consistently

---

## Section 4 — Visible Error Handling

For both duplicate-save errors and Stockfish failures:

### Requirement
Errors must be visible in the UI, not only in console logs.

### Acceptance Criteria
- add duplicate → visible message
- engine load/init failure → visible message
- save failure → visible message

---

## Section 5 — Minimal Verification Checklist

Claude must test these flows in code and report exactly what was fixed.

### CRUD / duplicate tests
1. Add new tabiya → succeeds
2. Add duplicate tabiya → blocked with visible error
3. Add new tactic → succeeds
4. Add duplicate tactic → blocked with visible error
5. Delete tabiya → removed and navigates back correctly
6. Delete tactic → removed and navigates back correctly

### Stockfish tests
1. Click Run Stockfish
2. Confirm engine asset actually loads
3. Confirm worker initializes
4. Confirm first analysis lines render
5. If engine fails, visible error appears instead of permanent “Thinking...”

---

## Section 6 — Constraints

Claude must:
- make minimal, surgical changes
- not refactor unrelated architecture
- not change styling unnecessarily
- not invent a new data model
- reuse existing duplicate logic where available
- fix root cause, not just symptoms

---

## Definition of Done

All of the following are true:

- Delete button exists and works for tabiyas
- Delete button exists and works for tactics
- Duplicate adds are blocked
- Duplicate attempts show a visible message
- Stockfish file/worker loads correctly
- Stockfish analysis lines appear instead of permanent “Thinking...”
- Engine failures show visible errors
- No console-only silent failure for core flows
