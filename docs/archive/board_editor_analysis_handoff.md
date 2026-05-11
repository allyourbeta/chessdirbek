# Board Editor Load Failure Analysis and Fix Plan

## Summary

The board editor is not failing because `type="module"` scripts cannot run without imports. That is legal and should work.

The real issue is architectural: the app currently uses **multiple independent root scripts/modules with side effects**, and `board.js` is **bootstrapping the application too early** by calling `Router.init()` before the board editor module is guaranteed to have attached `window.BoardEditor`.

As a result, when the router activates the editor view and calls `BoardEditor.init(params)`, `window.BoardEditor` is still undefined.

---

## What is known from the behavior

### Symptoms
- `window.BoardEditor` is `undefined`
- The board editor HTML shell renders, so the route/view itself is present
- Buttons visible in HTML throw errors when clicked because `BoardEditor` is undefined
- No editor board, palette, or FEN wiring appears

### What still works
- Other views render normally
- `BoardManager` works
- `Chess` works
- Router works
- Other globals are present
- The board-editor file is served by FastAPI and fetchable

### Important negative evidence
- No 404 for `board-editor.js`
- No syntax error reported
- No obvious parse/import error reported in console

That means this is likely **not** a simple file-serving problem or a basic syntax problem.

---

## Root cause

## 1. `board.js` is acting as both a library and the app bootstrap

From inspection, `board.js` does not just define `BoardManager`; it also performs startup side effects and calls:

```js
Router.init();
```

That means `board.js` is currently the file that starts routing and therefore starts view initialization.

This is a problem because `board-editor.js` is a **separate root module/script** whose only job is to attach `window.BoardEditor`.

So the current architecture is roughly:

- `board.js`
  - define `BoardManager`
  - do setup work
  - call `Router.init()`
- `board-editor.js`
  - later attach `window.BoardEditor`

That is fragile because the router can try to use `BoardEditor` before `board-editor.js` has finished executing.

---

## 2. Separate root modules do not guarantee application-level dependency ordering

Even if the script tags appear in a certain order in `index.html`, separate `<script type="module" ...>` tags are **independent module graphs**.

The important point is:

- `board-editor.js` is **not imported by** `board.js`
- `board.js` therefore does **not depend on** `board-editor.js`
- but `board.js` still starts the entire app

So the app starts from one module while silently assuming another module has already attached globals.

That is the wrong dependency direction.

---

## 3. Top-level `var` inside a module is not a browser global

In a classic script, top-level `var Foo = ...` becomes global.

In an ES module, top-level declarations are **module-scoped**, not global.

So inside `board-editor.js`, this:

```js
var BoardEditor = ...
```

does **not** by itself create `window.BoardEditor`.

Only this part does:

```js
window.BoardEditor = BoardEditor;
```

So if the file has not executed yet, or if execution is delayed relative to router startup, `window.BoardEditor` remains undefined.

---

## Why the original import problem matters, but is not the current root issue

The original version of `board-editor.js` used an import like:

```js
import { Chessboard, COLOR, FEN, POINTER_EVENTS } from ".../Chessboard.js"
```

and `POINTER_EVENTS` does not exist in cm-chessboard v8.

That absolutely could have caused module loading failure earlier.

However, after removing that import, the deeper design issue still remains:

- `board-editor.js` is still a separate startup unit
- `board.js` is still bootstrapping the app independently
- the router still assumes `BoardEditor` already exists

So even after removing the bad import, the app architecture is still brittle.

---

## Why there may be no useful console error

This kind of bug can feel “silent” because the failure is timing/bootstrapping related, not necessarily parse-related.

Possible sequence:

1. `board.js` loads and executes
2. `board.js` calls `Router.init()`
3. router navigates/render route logic
4. editor route tries `BoardEditor.init(...)`
5. `window.BoardEditor` is not yet attached
6. downstream code fails from `undefined`

That can produce downstream errors when buttons are clicked or route code runs, while still not showing a clean “board-editor.js failed to load” message.

---

## Recommended fix

## Best long-term fix: one true entrypoint (`main.js`)

Create a single module whose job is to coordinate startup in the correct order.

### New structure

#### `board.js`
Should only define and expose `BoardManager` and related helpers.

It should **not** call:
- `Router.init()`
- other global app bootstrap code that assumes all modules are ready

#### `board-editor.js`
Should define and expose `BoardEditor`.

It can remain:
- a module that attaches `window.BoardEditor`, or
- better, an actual ES module with exports/imports

#### `main.js`
This becomes the only bootstrapping module.

Example shape:

```js
import "/js/board.js";
import "/js/board-editor.js";

// now all required side effects/globals are installed

BoardManager.create("board", AppState.boardFen);
BoardManager.create("detail-board", AppState.boardFen);

setupAutoLoad();
setupKeyboardSave();
setupUrlParams();
setupPuzzleKeyboardShortcuts();

Router.init();
```

### `index.html`
Load only:

```html
<script type="module" src="/js/main.js"></script>
```

### Why this works
This makes startup explicit:

1. load board support
2. load editor support
3. run bootstrap
4. then initialize router

This removes the race/ordering hazard.

---

## Smallest practical fix

If the goal is a minimal patch without a broader refactor:

### Change `board-editor.js` to a classic script in `index.html`

Because `board-editor.js` no longer has imports, it does not need to be loaded as a module.

Load it like this:

```html
<script src="/js/board-editor.js"></script>
<script type="module" src="/js/board.js"></script>
```

### Why this can work
- `board-editor.js` only defines `window.BoardEditor`
- it does not need `BoardManager` at file-load time
- later, when `BoardEditor.init()` runs, `BoardManager` should already exist because `board.js` has executed

### Caveat
This is a tactical fix, not the clean architecture.

It still relies on globals and implicit ordering, but it may solve the immediate issue quickly.

---

## Recommended implementation plan

## Option A — quick tactical fix
Good for getting unblocked fast.

1. In `index.html`, change `board-editor.js` from:
   ```html
   <script type="module" src="/js/board-editor.js"></script>
   ```
   to:
   ```html
   <script src="/js/board-editor.js"></script>
   ```

2. Ensure that classic script appears **before** the module that bootstraps the app.

3. Hard refresh / disable cache / unregister service worker while testing.

4. Verify:
   - `window.BoardEditor` is defined before routing to editor
   - editor route renders board, palette, FEN field
   - buttons no longer throw undefined errors

## Option B — correct structural fix
Preferred for maintainability.

1. Remove all app bootstrap side effects from `board.js`, especially `Router.init()`
2. Create `main.js`
3. Have `main.js` import/load all required modules
4. Move startup calls into `main.js`
5. Update `index.html` to load only `main.js`
6. Test all routes again

---

## Specific recommendation

I recommend **Option B** if there is time to do it cleanly.

I recommend **Option A** if the immediate goal is simply to get the editor working with the fewest changes.

If doing Option A now, I would still plan to move to Option B later, because the current architecture will remain vulnerable to similar startup bugs.

---

## Extra debugging checks

While implementing, verify these explicitly in DevTools:

```js
window.BoardEditor
window.BoardManager
```

before navigating to the editor route.

Also test whether `Router.init()` is being called before `board-editor.js` finishes loading.

Because a service worker is present, do a hard reload or temporarily unregister it during script-loading debugging.

---

## Final conclusion

This is **not** a “module with no imports cannot execute” issue.

It is a **startup-order / entrypoint architecture** issue:

- `board.js` bootstraps the app too early
- `board-editor.js` is treated as an independent side-effect module
- the router depends on `BoardEditor` before that dependency is explicitly guaranteed

The clean fix is to introduce a single startup entrypoint and stop bootstrapping from `board.js`.
