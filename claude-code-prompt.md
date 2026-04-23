Read CLAUDE.md and IMAGE-SCANNER-SPEC.md. This adds a new feature: scan a chess diagram image to extract the FEN.

Key points:
- Create a NEW file backend/api/scan.py — do not add the endpoint to an existing file.
- Use httpx to call the Anthropic API directly — do NOT install the anthropic SDK.
- The API key comes from the ANTHROPIC_API_KEY environment variable.
- Validate the returned FEN with python-chess before sending it to the frontend.
- The frontend changes go in board-editor.js (add methods) and index.html (add button).
- Add clipboard paste support so Cmd+V with an image works on the editor page.
- After all changes, verify no file exceeds 300 lines.
