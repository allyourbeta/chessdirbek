"""Tests for scripts/capture_message.py, the hotkey-capture notification text helper.

Run as a subprocess (stdin -> stdout), the same way chessdirbek_capture.sh calls it.
"""

import json
import subprocess
import sys
from pathlib import Path

HELPER = Path(__file__).resolve().parent.parent / "scripts" / "capture_message.py"


def run_helper(stdin_text: str) -> str:
    result = subprocess.run(
        [sys.executable, str(HELPER)],
        input=stdin_text,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


class TestCaptureMessage:
    def test_real_409_body_from_test_client(self, test_client):
        """A real 409 body produced by the API prints its message."""
        fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
        test_client.post("/api/positions/", json={
            "fen": fen, "title": "Named One", "position_type": "tabiya"
        })
        r = test_client.post("/api/positions/", json={
            "fen": fen, "title": "Named Two", "position_type": "tabiya"
        })
        assert r.status_code == 409
        out = run_helper(r.text)
        assert out == "Already saved as Named One"

    def test_title_with_double_quote_is_stripped(self):
        """A title containing a double quote can't break the AppleScript string."""
        body = json.dumps({
            "detail": {
                "message": 'Already saved as My "Favorite" Line',
                "existing_id": 1,
                "existing_title": 'My "Favorite" Line',
            }
        })
        out = run_helper(body)
        assert '"' not in out
        assert "\\" not in out
        assert out == "Already saved as My Favorite Line"

    def test_garbage_input_falls_back(self):
        """Unparseable input gives the generic fallback, not a crash."""
        out = run_helper("not json at all {{{")
        assert out == "Already saved (duplicate position)"
