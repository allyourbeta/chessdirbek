# Chessquiz Stabilization Refactor Spec

## Purpose

Stabilize the current vanilla-JS chess study app without rewriting it in React or another framework. The goal is to reduce hidden coupling, prevent regressions, and make future feature work safer.

This is a refactor, not a redesign. Preserve existing UX unless a task explicitly says otherwise.

## Current Architecture Observations

The app is currently a static/vanilla frontend with many global objects and functions, backed by a Python/FastAPI backend. This is acceptable for the app size, but the frontend has grown enough that hidden coupling is now causing regressions.

Major coupling points:

- `frontend/index.html` contains the app shell, most view markup, modal markup, script load order, and many inline event handlers.
- JS modules communicate through globals such as `Router`, `AppState`, `Practice`, `PracticeUI`, `StockfishService`, and `EngineUI`.
- Script order matters, but dependencies are implicit.
- Some behavior is split between HTML inline handlers and JS files.
- Some UI labels treat ply counts as chess move counts.
- Engine lifecycle behavior has historically been ambiguous.

## Anti-goals

Do not:

- rewrite the app in React/Vue/Svelte/etc.
- replace the backend
- change the database schema unless explicitly necessary
- redesign the visual UI
- introduce a bundler unless separately approved
- perform a broad “cleanup” without tests or verification
- change routes or URLs unnecessarily

## Phase 0 — Safety Baseline

Before refactoring:

1. Run the app locally using the existing project flow.
2. Verify the following manually:
   - Tactics page loads.
   - Tabiya page loads.
   - Games page loads.
   - Games page displays ECO code plus opening name when available via lookup.
   - Practice game save modal displays full chess moves, not plies.
   - Hide Engine destroys the Stockfish worker.
   - PWA icon still appears in top-left app nav.
3. Create a branch:
   - `stabilization-refactor`

## Phase 1 — Navigation and Cancel Semantics

### Problem

Several editor/create/fork flows need a safe Cancel path. `history.back()` is convenient but weak when the page is opened directly.

### Target

Create a small navigation helper, for example:

```js
const Navigation = {
  cancelToFallback(fallbackRoute) {
    if (window.history.length > 1) {
      window.history.back();
    } else if (window.Router && fallbackRoute) {
      Router.navigate(fallbackRoute.view, fallbackRoute.params || {});
    }
  }
};
```

### Requirements

- Replace direct `history.back()` Cancel buttons with `Navigation.cancelToFallback(...)`.
- Each editor/create page must provide a sensible fallback.
- Do not change Save behavior.
- Do not add unsaved-change prompts yet.

### Acceptance checks

- From a fork flow, Cancel returns to the previous screen.
- From a directly opened editor URL, Cancel returns to a safe default page rather than doing nothing or exiting the app.

## Phase 2 — Engine Lifecycle Ownership

### Problem

Stockfish lifecycle is split between `EngineUI`, `StockfishService`, route changes, and button handlers.

### Target responsibility model

- `StockfishService` only wraps worker protocol: create worker, send UCI commands, parse output, destroy worker.
- `EngineUI` owns the visible engine panel and decides when the engine should start/stop/destroy.
- Route/view code should call `EngineUI.mount(...)` and `EngineUI.unmount()` only.

### Requirements

- `Hide Engine` must call `StockfishService.destroy()`.
- `EngineUI.unmount()` must also destroy the worker.
- Starting a new analysis should not create duplicate workers.
- Re-showing the engine after hide may recreate the worker.
- Keep the current UI appearance.

### Acceptance checks

- Show Engine starts analysis.
- Hide Engine stops CPU use by terminating worker.
- Show Engine again works after Hide Engine.
- Navigating away from a page with engine analysis terminates the worker.

## Phase 3 — Move Count Semantics

### Problem

The app often stores `move_count` as the number of plies/half-moves, but UI labels sometimes call that value “moves.” In chess UX, `53` plies should display as `27 moves`.

### Target

Keep stored values unchanged for now. Treat `move_count` as ply count unless proven otherwise. Convert for display.

### Requirements

Create shared helpers, ideally in a small utility file or shared module:

```js
function fullMoveCountFromPlies(plyCount) {
  return Math.ceil((Number(plyCount) || 0) / 2);
}

function formatMoveCountFromPlies(plyCount, includePlyDetail = false) {
  const plies = Number(plyCount) || 0;
  const moves = fullMoveCountFromPlies(plies);
  return includePlyDetail ? `${moves} moves (${plies} plies)` : `${moves} moves`;
}
```

Use this consistently in:

- practice save modal
- practice history
- practice viewer metadata
- games table move count
- average move-count displays, using average plies / 2 rather than `ceil`

### Acceptance checks

- 53 plies displays as 27 moves.
- 58 plies displays as 29 moves.
- 1 ply displays as 1 move.
- Average move count is converted by division, not by per-game ceiling.

## Phase 4 — ECO Opening Lookup Ownership

### Problem

ECO lookup currently depends on script load order and a global lookup object.

### Target

Make ECO lookup explicit and difficult to silently break.

### Requirements

- Keep static lookup data local; no runtime network dependency.
- Maintain a single source of truth for ECO code → opening name.
- Add a small service API:

```js
EcoOpenings.nameFor(code)
EcoOpenings.labelFor(code, pgnOpeningName)
```

- Games page should call `labelFor(...)` and not duplicate fallback logic.
- If script-order globals remain, add clear guards and console warnings.

### Acceptance checks

- Games page shows `B22 — Sicilian Defense: Alapin Variation` or equivalent.
- PGN-provided `[Opening "..."]` takes precedence over ECO lookup.
- Missing ECO code does not crash rendering.

## Phase 5 — API Client Wrapper

### Problem

Frontend code performs many direct `fetch(...)` calls with repeated JSON parsing and inconsistent error handling.

### Target

Introduce a thin `api-client.js`, no framework required.

### Example API

```js
const ApiClient = {
  async get(path, params = {}) {},
  async post(path, body = {}) {},
  async put(path, body = {}) {},
  async delete(path) {}
};
```

### Requirements

- Preserve existing backend endpoints.
- Centralize JSON parsing.
- Throw useful errors on non-2xx responses.
- Keep current loading/error UX unless a view already has a better pattern.
- Migrate one file at a time.

### Acceptance checks

- Games list still loads.
- Import PGN still works.
- Practice save still works.
- Position save still works.
- Failed requests are logged or surfaced consistently.

## Phase 6 — Reduce Inline Event Handlers Gradually

### Problem

Inline handlers in HTML make behavior hard to find and refactor.

### Target

Move toward JS-owned event binding without rewriting the whole app.

### Requirements

- Do not remove all inline handlers in one pass.
- Start with modal buttons and editor action buttons.
- Use stable IDs or `data-action` attributes.
- Attach listeners inside view/modal initialization functions.
- Avoid duplicate listeners on repeated route renders.

### Acceptance checks

- No button loses behavior.
- Repeated navigation does not create duplicate event firing.
- Code search for a button’s ID or data-action reveals its behavior.

## Phase 7 — Rendering Safety

### Problem

Some user-controlled fields are rendered with `innerHTML`. PGN headers, notes, player names, tags, and comments can contain unexpected content.

### Target

Use safe text insertion by default.

### Requirements

- Prefer `textContent` for user-controlled text.
- If template strings with `innerHTML` remain, escape every user-controlled value.
- Keep a single escaping helper.
- Audit Games, Practice history, Position details, and Import flows first.

### Acceptance checks

- Player name containing `<script>` displays as literal text.
- Notes containing HTML display safely unless intentionally rendered as markdown/html.
- No visible UX regression.

## Phase 8 — Backend Query Efficiency

### Problem

Some backend flows may use N+1 query patterns, especially position search over games.

### Target

Batch-load related game rows where possible.

### Requirements

- Identify loops that query one row per match.
- Replace with `WHERE id IN (...)` style queries.
- Preserve ordering from the original match list.
- Add or update tests if backend tests exist.

### Acceptance checks

- Position search returns same results as before.
- Query count is reduced for large result sets.
- No schema change required.

## Phase 9 — Smoke Tests

### Problem

Recent regressions were frontend integration bugs not caught by backend tests.

### Target

Add a small set of Playwright smoke tests only if the project already supports or can easily support them.

### Suggested tests

1. App loads and navbar appears.
2. Games page renders rows.
3. ECO opening label appears when lookup exists.
4. Practice save modal displays full moves from plies.
5. Hide Engine destroys worker or at least calls the destroy path.
6. New Tabiya/fork editor page has a Cancel button.
7. PWA manifest references expected icon files.

### Requirements

- Keep tests minimal.
- Do not add a complex CI setup yet.
- Tests should be runnable locally with one command.

## Implementation Discipline

Work in small commits:

1. `Add navigation cancel helper`
2. `Centralize Stockfish engine lifecycle`
3. `Normalize move count display from plies`
4. `Centralize ECO opening labels`
5. `Add API client wrapper`
6. `Move modal button handlers out of inline HTML`
7. `Harden user-text rendering`
8. `Optimize backend game lookup queries`
9. `Add frontend smoke tests`

After each commit:

- run the app
- perform relevant manual acceptance checks
- avoid combining unrelated changes

## Done Definition

The stabilization pass is complete when:

- no current UX feature is lost
- Hide Engine fully stops Stockfish
- ECO names reliably render
- move counts display as chess full moves, not plies
- editor/create flows have safe Cancel behavior
- at least the highest-risk frontend flows have smoke tests or manual acceptance notes
- future changes no longer require guessing script order or global state ownership
