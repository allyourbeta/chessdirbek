#!/usr/bin/env bash
set -euo pipefail
DEST="frontend/vendor/stockfish"
mkdir -p "$DEST"
TMP="$(mktemp -d)"
echo "Fetching stockfish npm package…"
npm pack stockfish --pack-destination "$TMP" >/dev/null
TGZ="$(ls "$TMP"/stockfish-*.tgz)"
tar xzf "$TGZ" -C "$TMP" \
  package/bin/stockfish-18-lite-single.js \
  package/bin/stockfish-18-lite-single.wasm
cp "$TMP"/package/bin/stockfish-18-lite-single.js  "$DEST/"
cp "$TMP"/package/bin/stockfish-18-lite-single.wasm "$DEST/"
rm -rf "$TMP"
echo "Vendored to $DEST:"
ls -la "$DEST"
# Sanity: wasm should be ~7MB
test "$(stat -f%z "$DEST/stockfish-18-lite-single.wasm" 2>/dev/null || stat -c%s "$DEST/stockfish-18-lite-single.wasm")" -gt 5000000
echo "OK"