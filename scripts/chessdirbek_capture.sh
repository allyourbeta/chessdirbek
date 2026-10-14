#!/bin/bash
# chessdirbek quick-capture
# ----------------------------------------------------------------------------
# Copy a chess board image to the clipboard, run this script, pick a category,
# and it OCRs + saves the position into chessdirbek via /api/ocr/import.
#
# TEST IT DIRECTLY (no hotkey needed):
#   1. Copy a board image (Cmd+Shift+4 region, or copy from a PDF)
#   2. ./scripts/chessdirbek_capture.sh
#   A category picker appears; choose one; a notification confirms the save.
#
# Needs `pngpaste` for reading clipboard images (brew install pngpaste).
# Falls back to AppleScript if pngpaste is missing, but pngpaste is reliable.
# ----------------------------------------------------------------------------

# Make sure Homebrew tools (pngpaste, curl) are found even when launched from
# Shortcuts/Double Tap, where PATH is minimal.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

URL="http://localhost:8000/api/ocr/import"
TMP="$(mktemp -d)"
PNG="$TMP/board.png"
trap 'rm -rf "$TMP"' EXIT

notify() { osascript -e "display notification \"$2\" with title \"$1\"" >/dev/null 2>&1; }

# 1. Grab the clipboard image -------------------------------------------------
if command -v pngpaste >/dev/null 2>&1; then
  pngpaste "$PNG" >/dev/null 2>&1
else
  osascript -e "set f to (open for access (POSIX file \"$PNG\") with write permission)" \
            -e "write (the clipboard as «class PNGf») to f" \
            -e "close access f" >/dev/null 2>&1
fi
if [ ! -s "$PNG" ]; then
  notify "chessdirbek" "No image on the clipboard — copy a board first"
  echo "No image on clipboard." >&2
  exit 0
fi

# 2. Pick a category ----------------------------------------------------------
# `choose from list` already pre-highlights "Tactic" via `default items`, but
# when osascript is launched from a hotkey/Shortcut the dialog appears WITHOUT
# keyboard focus — so Return does nothing until you click it. Hosting the dialog
# inside a `tell application "System Events"` + `activate` brings it to the front
# *with* focus, so Tactic is pre-selected and Return saves it immediately (or
# ↑/↓ then Return picks another category). No click needed.
#
# Activating the picker steals focus from whatever app you were in (e.g. the
# browser tab you just screenshotted). We record that app's bundle id before
# activating, then re-activate it after the picker closes — whether you picked
# a category or cancelled — so focus returns to where you were.
CHOICE=$(osascript \
  -e 'tell application "System Events" to set prevID to bundle identifier of first application process whose frontmost is true' \
  -e 'tell application "System Events"' \
  -e '  activate' \
  -e '  set c to choose from list {"Tactic","Tabiya","Ending","Strategy"} with prompt "Save this board to:" default items {"Tactic"}' \
  -e 'end tell' \
  -e 'try' \
  -e '  tell application id prevID to activate' \
  -e 'end try' \
  -e 'if c is false then return ""' \
  -e 'return item 1 of c')
[ -z "$CHOICE" ] && { echo "Cancelled."; exit 0; }
CAT=$(echo "$CHOICE" | tr '[:upper:]' '[:lower:]')

# 3. Encode + POST ------------------------------------------------------------
notify "chessdirbek" "Recognizing board…"
B64=$(base64 -i "$PNG" | tr -d '\n')
printf '{"image_base64":"%s","category":"%s"}' "$B64" "$CAT" > "$TMP/payload.json"
RESP=$(curl -s -m 120 -w $'\n%{http_code}' -X POST "$URL" \
       -H 'Content-Type: application/json' --data @"$TMP/payload.json")
CURL_EXIT=$?
CODE=$(printf '%s' "$RESP" | tail -n1)
BODY=$(printf '%s' "$RESP" | sed '$d')

# 4. Report -------------------------------------------------------------------
case "$CODE" in
  200|201)
    TITLE=$(printf '%s' "$BODY" | sed -n 's/.*"title":"\([^"]*\)".*/\1/p' | tr -d '"\\')
    notify "chessdirbek ✓" "Saved to $CAT: ${TITLE:-position}"
    echo "Saved to $CAT: ${TITLE:-position}" ;;
  409)
    MSG=$(printf '%s' "$BODY" | python3 "$(dirname "$0")/capture_message.py")
    notify "chessdirbek" "$MSG"
    echo "Duplicate." ;;
  503) notify "chessdirbek ✗" "OCR not ready — check the app's OCR debug panel"; echo "OCR not ready: $BODY" ;;
  000)
    if [ "$CURL_EXIT" -eq 28 ]; then
      notify "chessdirbek ✗" "Server is still starting — try again in a minute"
      echo "Server starting (timeout)."
    else
      notify "chessdirbek ✗" "Can't reach the server — is chessdirbek running on :8000?"
      echo "Server unreachable."
    fi ;;
  *)   notify "chessdirbek ✗" "Error $CODE"; echo "Error $CODE: $BODY" ;;
esac
