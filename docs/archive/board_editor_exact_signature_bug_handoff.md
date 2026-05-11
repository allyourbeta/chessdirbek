# Exact Bug: `enableSquareSelect` is being called with the wrong signature

## Root cause

In the latest snapshot, `frontend/js/board.js` is calling cm-chessboard like this:

```js
board.enableSquareSelect((event) => {
    callback(event.square);
});
```

That is wrong.

According to cm-chessboard v8, the method signature is:

```js
enableSquareSelect(eventType, eventHandler)
```

So the first argument must be an event type such as:

```js
POINTER_EVENTS.pointerdown
```

and the second argument is the handler.

Because the current code passes only one argument, and passes the handler where the event type should go, square selection is never wired correctly. The board renders, but clicking squares does nothing.

This is why the board editor still looks alive but cannot place pieces.

---

## Exact fix

In `frontend/js/board.js`, ensure the cm-chessboard import includes `POINTER_EVENTS`:

```js
import { Chessboard, COLOR, FEN, INPUT_EVENT_TYPE, POINTER_EVENTS }
    from "https://cdn.jsdelivr.net/npm/cm-chessboard@8/src/Chessboard.js";
```

Then change the broken code from:

```js
board.enableSquareSelect((event) => {
    callback(event.square);
});
```

to:

```js
board.enableSquareSelect(POINTER_EVENTS.pointerdown, (event) => {
    callback(event.square);
});
```

---

## Also fix disable

If `disableSquareSelect()` is currently called with no argument, that may also be wrong.

Change it to disable the same event type:

```js
board.disableSquareSelect(POINTER_EVENTS.pointerdown);
```

---

## What to verify after patching

1. Open board editor
2. Click white queen in palette
3. Click d4
4. Confirm queen appears on d4
5. Confirm FEN updates
6. Click eraser
7. Click d4
8. Confirm queen disappears

---

## Important note

Do not redesign the editor again.
Do not switch to drag-and-drop.
Do not rewrite routing or globals.

This is a narrow integration bug: wrong method signature on `enableSquareSelect`.
