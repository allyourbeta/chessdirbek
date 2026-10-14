"""Playwright reproduction for Tenzing dq-soeiit: the detail page's green
category buttons ("+ Ending" etc.) are supposed to MOVE the open position to
that category. If the move condition in saveBoardPosition (frontend/js/shared.js)
is false for some entry path, the backend instead treats the click as "save a
new position with this FEN", sees the duplicate, and the toast says
"Already saved as ..." instead of moving anything.

Runs the real built app against a real (temp-file) SQLite database on its own
server, on port 8001 (the pattern from tests/test_position_search_ui.py), and
tries every path a position can be opened from before the button is clicked.
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

_BACK_RANKS = ["6k1", "5k2", "4k3", "3k4", "2k5"]


def _fen_for(n):
    # Distinct, legal positions (king on a different file each time) so each
    # test's seed is never a duplicate FEN of another test's -- dedup is an
    # exact-string check in the backend.
    return f"{_BACK_RANKS[n]}/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1"


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


@pytest.fixture(scope="module")
def live_server(tmp_path_factory):
    if _port_in_use(PORT):
        pytest.fail(f"Port {PORT} is already in use — refusing to reuse another server.")

    db_path = tmp_path_factory.mktemp("recategorize_db") / "test.db"
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


def _seed_tactic(api, title, n):
    r = api.post("/api/positions/", json={
        "fen": _fen_for(n), "title": title, "position_type": "puzzle",
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _click_plus_ending(page):
    page.locator('[data-save-board="detail-board"][data-position-type="endgame"]').click()
    page.wait_for_timeout(300)


def _assert_moved_not_duplicated(api, position_id, baseline_count):
    toast_text = None
    all_positions = api.get("/api/positions/", params={"limit": 1000}).json()
    assert len(all_positions) == baseline_count, (
        f"expected no new position, baseline={baseline_count} now={len(all_positions)}"
    )
    moved = api.get(f"/api/positions/{position_id}").json()
    assert moved["position_type"] == "endgame", moved


class TestRecategorizeFromEveryEntryPath:
    def test_from_tactics_list(self, live_server, browser, api):
        pos_id = _seed_tactic(api, "from-list", 0)
        baseline = len(api.get("/api/positions/", params={"limit": 1000}).json())

        page = browser.new_page()
        try:
            page.goto(live_server + "/tactics")
            item = page.locator(f'.pos-item[data-pos-id="{pos_id}"]')
            item.wait_for(state="visible")
            item.click()
            page.locator("#detail-title").wait_for(state="visible")

            _click_plus_ending(page)

            toast = page.locator(".toast").last
            toast_text = toast.inner_text() if toast.count() else ""
            assert "Already saved" not in toast_text, toast_text
            _assert_moved_not_duplicated(api, pos_id, baseline)
        finally:
            page.close()

    def test_from_featured_board(self, live_server, browser, api):
        pos_id = _seed_tactic(api, "from-featured", 1)
        baseline = len(api.get("/api/positions/", params={"limit": 1000}).json())

        page = browser.new_page()
        try:
            page.goto(live_server + "/tactics")
            # The featured board shows a random position; force it to ours via
            # the featured-by-id URL param the router already supports.
            page.goto(live_server + f"/tactics?featured={pos_id}")
            title = page.locator("#cat-featured-title")
            title.wait_for(state="visible")
            page.wait_for_function(
                "document.getElementById('cat-featured-title').textContent.trim().length > 0"
            )
            title.click()
            page.locator("#detail-title").wait_for(state="visible")

            _click_plus_ending(page)

            toast = page.locator(".toast").last
            toast_text = toast.inner_text() if toast.count() else ""
            assert "Already saved" not in toast_text, toast_text
            _assert_moved_not_duplicated(api, pos_id, baseline)
        finally:
            page.close()

    def test_from_position_search_dropdown(self, live_server, browser, api):
        pos_id = _seed_tactic(api, "swift-search-target", 2)
        baseline = len(api.get("/api/positions/", params={"limit": 1000}).json())

        page = browser.new_page()
        try:
            page.goto(live_server + "/tactics")
            tag_input = page.locator("#cat-tag-filters .tagfilter-input")
            tag_input.wait_for(state="visible")
            tag_input.fill("swift-search-target")

            dropdown = page.locator("#cat-tag-filters .tagfilter-dropdown")
            dropdown.locator(".tagfilter-pos").first.wait_for(state="visible")
            dropdown.locator(".tagfilter-pos").first.click()

            page.locator("#detail-title").wait_for(state="visible")

            _click_plus_ending(page)

            toast = page.locator(".toast").last
            toast_text = toast.inner_text() if toast.count() else ""
            assert "Already saved" not in toast_text, toast_text
            _assert_moved_not_duplicated(api, pos_id, baseline)
        finally:
            page.close()

    def test_after_stepping_moves_forward_and_back(self, live_server, browser, api):
        pos_id = _seed_tactic(api, "from-move-nav", 3)
        baseline = len(api.get("/api/positions/", params={"limit": 1000}).json())

        page = browser.new_page()
        try:
            page.goto(live_server + f"/tactics/{pos_id}")
            page.locator("#detail-title").wait_for(state="visible")

            # Make a move on the board, then undo it with prev/next (Home then
            # back to the end) to return to the originally-saved position.
            page.locator("#detail-board svg.cm-chessboard").wait_for(state="visible")
            # Drag a pawn forward one square to create a navigator entry.
            from_sq = page.locator('#detail-board rect[data-square="f2"]')
            to_sq = page.locator('#detail-board rect[data-square="f3"]')
            if from_sq.count() and to_sq.count():
                from_sq.hover()
                page.mouse.down()
                to_sq.hover()
                page.mouse.up()
                page.wait_for_timeout(200)

            nav_first = page.locator('#detail-move-nav [data-move-nav="first"]')
            if nav_first.count() and not nav_first.is_disabled():
                nav_first.click()
                page.wait_for_timeout(200)

            _click_plus_ending(page)

            toast = page.locator(".toast").last
            toast_text = toast.inner_text() if toast.count() else ""
            assert "Already saved" not in toast_text, toast_text
            _assert_moved_not_duplicated(api, pos_id, baseline)
        finally:
            page.close()

    def test_from_url_deep_link(self, live_server, browser, api):
        pos_id = _seed_tactic(api, "from-deep-link", 4)
        baseline = len(api.get("/api/positions/", params={"limit": 1000}).json())

        page = browser.new_page()
        try:
            page.goto(live_server + f"/tactics/{pos_id}")
            page.locator("#detail-title").wait_for(state="visible")

            _click_plus_ending(page)

            toast = page.locator(".toast").last
            toast_text = toast.inner_text() if toast.count() else ""
            assert "Already saved" not in toast_text, toast_text
            _assert_moved_not_duplicated(api, pos_id, baseline)
        finally:
            page.close()
