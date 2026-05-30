#!/bin/bash
# chessquiz quick-capture
# ----------------------------------------------------------------------------
# Copy a chess board image to the clipboard, run this script, pick a category,
# and it OCRs + saves the position into chessquiz via /api/ocr/import.
#
# TEST IT DIRECTLY (no hotkey needed):
#   1. Copy a board image (Cmd+Shift+4 region, or copy from a PDF)
#   2. ./scripts/chessquiz_capture.sh
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
  notify "chessquiz" "No image on the clipboard — copy a board first"
  echo "No image on clipboard." >&2
  exit 0
fi

# 2. Pick a category ----------------------------------------------------------
CHOICE=$(osascript \
  -e 'set c to choose from list {"Tactic","Tabiya","Ending","Strategy"} with prompt "Save this board to:" default items {"Tactic"}' \
  -e 'if c is false then return ""' \
  -e 'return item 1 of c')
[ -z "$CHOICE" ] && { echo "Cancelled."; exit 0; }
CAT=$(echo "$CHOICE" | tr '[:upper:]' '[:lower:]')

# 3. Encode + POST ------------------------------------------------------------
notify "chessquiz" "Recognizing board…"
B64=$(base64 -i "$PNG" | tr -d '\n')
printf '{"image_base64":"%s","category":"%s"}' "$B64" "$CAT" > "$TMP/payload.json"
RESP=$(curl -s -m 60 -w $'\n%{http_code}' -X POST "$URL" \
       -H 'Content-Type: application/json' --data @"$TMP/payload.json")
CODE=$(printf '%s' "$RESP" | tail -n1)
BODY=$(printf '%s' "$RESP" | sed '$d')

# 4. Report -------------------------------------------------------------------
case "$CODE" in
  200|201)
    TITLE=$(printf '%s' "$BODY" | sed -n 's/.*"title":"\([^"]*\)".*/\1/p')
    notify "chessquiz ✓" "Saved to $CAT: ${TITLE:-position}"
    echo "Saved to $CAT: ${TITLE:-position}" ;;
  409) notify "chessquiz" "Already saved (duplicate position)"; echo "Duplicate." ;;
  503) notify "chessquiz ✗" "OCR not ready — check the app's OCR debug panel"; echo "OCR not ready: $BODY" ;;
  000) notify "chessquiz ✗" "Can't reach the server — is chessquiz running on :8000?"; echo "Server unreachable." ;;
  *)   notify "chessquiz ✗" "Error $CODE"; echo "Error $CODE: $BODY" ;;
esac
