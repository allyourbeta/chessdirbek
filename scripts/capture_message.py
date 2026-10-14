#!/usr/bin/env python3
"""Turn an /api/ocr/import response body into one notification line.

Reads the HTTP response body on stdin and prints a single line to stdout.
Used by chessdirbek_capture.sh so a macOS notification can show the real
duplicate message (e.g. "Already saved as swift-otter") instead of a fixed
string. Strips `"` and `\\` from the result so it can't break the
AppleScript string the caller embeds it in.

On any parse failure, prints the old fixed fallback.
"""

import json
import sys

FALLBACK = "Already saved (duplicate position)"


def _sanitize(text: str) -> str:
    return text.replace("\\", "").replace('"', "")


def extract_message(body: str) -> str:
    try:
        data = json.loads(body)
        message = data["detail"]["message"]
        if not isinstance(message, str) or not message:
            return FALLBACK
        return _sanitize(message)
    except Exception:
        return FALLBACK


def main() -> None:
    body = sys.stdin.read()
    print(extract_message(body))


if __name__ == "__main__":
    main()
