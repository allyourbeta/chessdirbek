"""Playwright test for SPEC-CASTLING.md Part 4: the detail-page "Castling
allowed" checkbox, and the editor/Flip-FEN castling behaviour it depends on.

Runs the real built app against a real (temp-file) SQLite database on its own
server, on port 8001 (the pattern from tests/test_editor_board_ui.py). Tests
use only their own sample positions; they never depend on whatever is already
in a database.
"""

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8001
BASE_URL = f"http://localhost:{PORT}"

START_BOARD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
# START_BOARD rotated 180 degrees once (files + ranks reversed): kings sit on
# d1/d8, off the castling-relevant e-file, even though all four rooks are
# still on their home corners. Flip FEN should rotate it back to START_BOARD.
ROTATED_BOARD = "RNBKQBNR/PPPPPPPP/8/8/8/8/pppppppp/rnbkqbnr"


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


@pytest.fixture(scope="module")
def live_server(tmp_path_factory):
    if _port_in_use(PORT):
        pytest.fail(f"Port {PORT} is already in use — refusing to reuse another server.")

    db_path = tmp_path_factory.mktemp("castling_ui_db") / "test.db"
    env = os.environ.copy()
    env["CHESSDIRBEK_DB_URL"] = f"sqlite:///{db_path}"
    env["CHESSDIRBEK_OCR_WARMUP"] = "0"

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", str(PORT)],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    try:
        deadline = time.time() + 15
        up = False
        while time.time() < deadline:
            if _port_in_use(PORT):
                up = True
                break
            if proc.poll() is not None:
                break
            time.sleep(0.2)
        if not up:
            proc.terminate()
            out = proc.stdout.read().decode(errors="ignore") if proc.stdout else ""
            pytest.fail(f"Server on port {PORT} did not start.\n{out}")
        time.sleep(0.5)
        yield BASE_URL
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        yield b
        b.close()


@pytest.fixture
def api(live_server):
    client = httpx.Client(base_url=live_server, timeout=10)
    yield client
    client.close()


def _toggle(page):
    return page.locator("#detail-castling-toggle")


class TestDetailCastlingToggle:
    def test_start_position_sample_shows_ticked_box(self, api, browser, live_server):
        r = api.post("/api/positions/", json={
            "fen": START_BOARD + " w KQkq - 0 1",
            "title": "start-ticked",
            "position_type": "tabiya",
        })
        assert r.status_code == 201, r.text
        pos_id = r.json()["id"]

        page = browser.new_page()
        try:
            page.goto(live_server + f"/tabiya/{pos_id}")
            page.locator("#detail-title").wait_for(state="visible")
            box = _toggle(page)
            box.wait_for(state="visible")
            assert box.is_checked()

            toolbar = page.locator("#detail-move-nav-wrap")
            toolbar.screenshot(path=str(ROOT / "docs" / "targets" / "castling-toggle.actual.png"))
        finally:
            page.close()

    def test_unticking_removes_rights_ticking_restores_them(self, api, browser, live_server):
        # Different board from the other tests (king's pawn pushed one square)
        # so the duplicate check — which now ignores castling — can't collide.
        kings_pawn_board = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR"
        r = api.post("/api/positions/", json={
            "fen": kings_pawn_board + " w KQkq - 0 1",
            "title": "start-roundtrip",
            "position_type": "tabiya",
        })
        assert r.status_code == 201, r.text
        pos_id = r.json()["id"]

        page = browser.new_page()
        try:
            page.goto(live_server + f"/tabiya/{pos_id}")
            box = _toggle(page)
            box.wait_for(state="visible")
            assert box.is_checked()

            box.click()
            page.wait_for_function(
                "() => document.getElementById('detail-castling-toggle') && "
                "!document.getElementById('detail-castling-toggle').checked"
            )
            fen = api.get(f"/api/positions/{pos_id}").json()["fen"]
            assert fen.split()[2] == "-", fen

            box = _toggle(page)
            box.wait_for(state="visible")
            box.click()
            page.wait_for_function(
                "() => document.getElementById('detail-castling-toggle') && "
                "document.getElementById('detail-castling-toggle').checked"
            )
            fen = api.get(f"/api/positions/{pos_id}").json()["fen"]
            assert fen.split()[2] == "KQkq", fen
        finally:
            page.close()

    def test_no_home_squares_king_hides_box(self, api, browser, live_server):
        r = api.post("/api/positions/", json={
            "fen": "8/8/2k5/8/8/2K5/8/8 w - - 0 1",
            "title": "no-home-king",
            "position_type": "tabiya",
        })
        assert r.status_code == 201, r.text
        pos_id = r.json()["id"]

        page = browser.new_page()
        try:
            page.goto(live_server + f"/tabiya/{pos_id}")
            page.locator("#detail-title").wait_for(state="visible")
            page.wait_for_timeout(300)
            box = _toggle(page)
            assert not box.is_visible()
        finally:
            page.close()


class TestFlipFenGrantsCastling:
    def test_flip_fen_on_rotated_board_grants_rights(self, api, browser, live_server):
        r = api.post("/api/positions/", json={
            "fen": ROTATED_BOARD + " w - - 0 1",
            "title": "flip-grants-castling",
            "position_type": "tabiya",
            "orientation": "white",
        })
        assert r.status_code == 201, r.text
        pos_id = r.json()["id"]

        page = browser.new_page()
        try:
            page.goto(live_server + f"/tabiya/{pos_id}")
            page.locator("#detail-title").wait_for(state="visible")
            page.locator('[data-action="flip-detail-fen"]').click()
            page.wait_for_timeout(500)

            fen = api.get(f"/api/positions/{pos_id}").json()["fen"]
            assert fen.split()[0] == START_BOARD, fen
            assert fen.split()[2] == "KQkq", fen
        finally:
            page.close()


class TestEditorHandBuiltBoardGetsCastling:
    def test_king_and_rook_placed_by_hand_get_right(self, browser, live_server):
        page = browser.new_page()
        try:
            page.goto(live_server + "/editor")
            page.locator("#editor-board svg.cm-chessboard").wait_for(state="visible")

            page.locator('#editor-palette .palette-btn[data-tool="w_k"]').click()
            page.locator('#editor-board rect[data-square="e1"]').click(force=True)
            page.locator('#editor-palette .palette-btn[data-tool="w_r"]').click()
            page.locator('#editor-board rect[data-square="h1"]').click(force=True)
            page.locator('#editor-palette .palette-btn[data-tool="b_k"]').click()
            page.locator('#editor-board rect[data-square="e8"]').click(force=True)

            fen = page.locator("#editor-fen").input_value()
            assert fen.split(" ")[2] == "K", fen
        finally:
            page.close()
