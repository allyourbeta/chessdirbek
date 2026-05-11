# Chess Study App – Save & Stockfish Reliability Fix Spec

## Objective

Fix three critical user-facing failures:

1. Saving **Tabiyas** does not persist or display correctly
2. Saving **Tactics** does not persist or display correctly
3. Clicking **Run Stockfish** does not immediately show analysis lines (appears to hang)

This spec defines the **minimum required changes** to make these flows reliable end-to-end.

---

## Root Cause Summary (Do Not Skip)

This is **not one bug**. It is a **contract mismatch across layers**:

* DOM IDs do not match JS expectations → nothing renders after save
* Backend schema does not match frontend payload → edits silently fail
* Route state is overwritten → wrong position type saved
* Stockfish output is blocked by async SAN conversion → UI appears frozen
* Duplicate DOM IDs → unpredictable rendering behavior

---

## Section 1 — Save Flow (Tabiya & Tactics)

### 1.1 Rendering Container Mismatch (CRITICAL)

**Problem**

* HTML uses:

  * `tabiyas-list`
  * `tactics-list`
* JS expects:

  * `tabiyas-grid`
  * `tactics-grid`

**Fix**

* Standardize to ONE naming convention
* Update JS to match HTML:

  * `tabiyas-list`
  * `tactics-list`

**Acceptance Criteria**

* After saving a position, it immediately appears in the list without refresh

---

### 1.2 Backend Schema Mismatch (FEN Not Updating)

**Problem**

* Frontend sends:

  ```
  { name, fen, description, difficulty }
  ```
* Backend update schema **does NOT include `fen`**

**Fix**

* Add `fen: Optional[str]` to update schema
* Ensure update endpoint writes FEN to DB

**Acceptance Criteria**

* Editing a position and changing the board updates correctly after reload

---

### 1.3 Route State Corruption (Type Reset Bug)

**Problem**

* Editing sets:

  ```
  AppState.addPositionType = pos.position_type
  ```
* Navigation resets it to `'tabiya'`

**Fix**

* Pass `type` explicitly in navigation:

  ```
  Router.navigate({ view: 'addPosition', type: pos.position_type })
  ```
* Router must respect passed type (no default override)

**Acceptance Criteria**

* Editing a tactic does NOT turn it into a tabiya
* Editing preserves original type

---

### 1.4 Save Confirmation + Logging

**Add minimal logging:**

Frontend:

* Log payload before POST
* Log response after POST

Backend:

* Log incoming payload
* Log DB write success/failure

**Acceptance Criteria**

* Dev console clearly shows save lifecycle

---

## Section 2 — Stockfish Analysis Flow

### 2.1 Immediate Output Requirement (CRITICAL)

**Problem**

* UI waits for `/uci-to-san` API call before showing anything

**Fix**

* Show **raw UCI PV immediately**
* SAN conversion should be:

  * async
  * optional
  * non-blocking

**Acceptance Criteria**

* Within ~200ms of clicking "Run Stockfish", user sees:

  ```
  depth 12 | eval +0.34 | pv e2e4 e7e5 g1f3 ...
  ```

---

### 2.2 Remove Blocking Dependency

**DO NOT block UI on:**

* `/uci-to-san`
* any backend call

**Flow must be:**

```
Stockfish message → render immediately → optionally enhance later
```

---

### 2.3 Worker Listener Cleanup

**Problem**

* Multiple `addEventListener` calls accumulate

**Fix**

* Ensure:

  * Only ONE active listener per analysis session
  * Old listeners are removed or replaced

**Acceptance Criteria**

* Repeated clicks do NOT degrade performance
* No duplicated output lines

---

### 2.4 Duplicate DOM ID (CRITICAL BUG)

**Problem**

* Two elements use:

  ```
  id="engine-eval-display"
  ```

**Fix**

* Ensure ALL IDs are unique
* Update JS selectors accordingly

**Acceptance Criteria**

* Engine output always appears in correct location

---

## Section 3 — Minimal End-to-End Tests

### Test 1 — Create Tabiya

* Add new tabiya
* Verify appears immediately
* Reload page → still exists

### Test 2 — Edit Tabiya

* Change FEN
* Save
* Reload → board reflects change

### Test 3 — Create Tactic

* Add tactic
* Verify appears under tactics (NOT tabiyas)

### Test 4 — Edit Tactic

* Edit tactic
* Confirm it remains a tactic

### Test 5 — Stockfish

* Click "Run Stockfish"
* Within 200ms → raw PV appears
* No hanging

---

## Section 4 — Constraints (VERY IMPORTANT)

Claude MUST:

* ❌ NOT refactor unrelated files
* ❌ NOT introduce new frameworks
* ❌ NOT redesign architecture
* ✅ Only fix broken contracts and flows
* ✅ Prefer minimal, surgical changes

---

## Definition of Done

All of the following must be true:

* Save works for both tabiyas and tactics
* Edits correctly update FEN
* Position type is preserved
* UI updates immediately after save
* Stockfish shows analysis instantly
* No duplicate DOM IDs
* No console errors

---
