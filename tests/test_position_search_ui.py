"""Playwright test for the position-search dropdown (SPEC-DUP-NAME-AND-SEARCH.md Part 4).

Runs the real built app against a real (temp-file) SQLite database on its own
server, on port 8001, so the opt-in `searchPositions` behavior in
TagFilter.mount can be proven end-to-end rather than against mocks.
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
SCREENSHOT_PATH = ROOT / "docs" / "targets" / "position-search-dropdown.actual.png"

FEN_OTTER = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
FEN_COTTAGE = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2"
FEN_NOTES_ONLY = "rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq - 0 1"


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


@pytest.fixture(scope="module")
def live_server(tmp_path_factory):
    if _port_in_use(PORT):
        pytest.fail(f"Port {PORT} is already in use — refusing to reuse another server.")

    db_path = tmp_path_factory.mktemp("position_search_db") / "test.db"
    env = os.environ.copy()
    env["CHESSDIRBEK_DB_URL"] = f"sqlite:///{db_path}"

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
        # The socket can accept connections slightly before FastAPI's startup
        # (table creation) has finished; give it a brief moment.
        time.sleep(0.5)
        yield BASE_URL
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest.fixture(scope="module")
def seeded(live_server):
    client = httpx.Client(base_url=live_server, timeout=10)
    r1 = client.post("/api/positions/", json={
        "fen": FEN_OTTER, "title": "swift-otter", "position_type": "puzzle",
    })
    assert r1.status_code == 201, r1.text
    r2 = client.post("/api/positions/", json={
        "fen": FEN_COTTAGE, "title": "swift-cottage", "position_type": "endgame",
        "tags": ["swift-attack"],
    })
    assert r2.status_code == 201, r2.text
    r3 = client.post("/api/positions/", json={
        "fen": FEN_NOTES_ONLY, "title": "no match here", "notes": "an otter swims by",
        "position_type": "tabiya",
    })
    assert r3.status_code == 201, r3.text
    client.close()
    return live_server


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        yield b
        b.close()


class TestPositionSearchDropdown:
    def test_category_filter_searches_positions_by_title(self, seeded, browser):
        page = browser.new_page()
        try:
            page.goto(seeded + "/tactics")
            tag_input = page.locator("#cat-tag-filters .tagfilter-input")
            tag_input.wait_for(state="visible")
            tag_input.fill("otter")

            dropdown = page.locator("#cat-tag-filters .tagfilter-dropdown")
            dropdown.locator(".tagfilter-pos").first.wait_for(state="visible")

            pos_rows = dropdown.locator(".tagfilter-pos")
            assert pos_rows.count() == 1
            assert "swift-otter" in pos_rows.nth(0).inner_text()
            cat_label = pos_rows.nth(0).locator(".tagfilter-pos-cat").inner_text()
            assert cat_label == "Tactics"

            # The notes-only position must not appear under a title search.
            assert "no match here" not in dropdown.inner_text()

            SCREENSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(SCREENSHOT_PATH))

            pos_rows.first.click()
            detail_title = page.locator("#detail-title")
            detail_title.wait_for(state="visible")
            assert "swift-otter" in detail_title.inner_text()
        finally:
            page.close()

    def test_editor_tag_box_has_no_position_search(self, seeded, browser):
        """The editor's tag box is a plain TagFilter mount (no searchPositions: true)."""
        page = browser.new_page()
        try:
            page.goto(seeded + "/positions/new")
            tag_input = page.locator("#pos-tags-container .tagfilter-input")
            tag_input.wait_for(state="visible")
            tag_input.fill("otter")
            page.wait_for_timeout(400)  # let any debounced fetch settle

            dropdown = page.locator("#pos-tags-container .tagfilter-dropdown")
            assert dropdown.locator(".tagfilter-section").count() == 0
            assert dropdown.locator(".tagfilter-pos").count() == 0
        finally:
            page.close()


class TestCategoryUrlCorrection:
    """SPEC-CATEGORY-URL.md: a position always opens under its real category,
    regardless of which path opened it or what the URL claimed."""

    def _cottage_id(self, seeded):
        client = httpx.Client(base_url=seeded, timeout=10)
        try:
            rows = client.get("/api/positions/", params={"title_q": "swift-cottage"}).json()
        finally:
            client.close()
        assert len(rows) == 1, rows
        return rows[0]["id"]

    def test_dropdown_open_lands_on_real_category(self, seeded, browser):
        """swift-cottage is an endgame; opening it from the search dropdown must
        not leave it looking like a Tabiya (dq-xhin4b)."""
        page = browser.new_page()
        try:
            page.goto(seeded + "/tactics")
            tag_input = page.locator("#cat-tag-filters .tagfilter-input")
            tag_input.wait_for(state="visible")
            tag_input.fill("cottage")

            dropdown = page.locator("#cat-tag-filters .tagfilter-dropdown")
            dropdown.locator(".tagfilter-pos").first.wait_for(state="visible")
            dropdown.locator(".tagfilter-pos").first.click()

            detail_title = page.locator("#detail-title")
            detail_title.wait_for(state="visible")
            assert "swift-cottage" in detail_title.inner_text()

            assert page.evaluate("location.pathname").startswith("/endings/")
            endings_btn = page.locator('nav button[data-nav="endings"]')
            assert "active" in (endings_btn.get_attribute("class") or "")
        finally:
            page.close()

    def test_direct_load_with_wrong_category_url_self_corrects(self, seeded, browser):
        """A link naming the wrong category (e.g. bookmarked before a recategorize,
        or just hand-typed) is quietly corrected, without growing history."""
        page = browser.new_page()
        try:
            cottage_id = self._cottage_id(seeded)
            page.goto(seeded + "/tactics")
            baseline_length = page.evaluate("history.length")

            page.goto(seeded + f"/tabiya/{cottage_id}")
            length_after_nav = page.evaluate("history.length")
            assert length_after_nav == baseline_length + 1

            detail_title = page.locator("#detail-title")
            detail_title.wait_for(state="visible")
            assert "swift-cottage" in detail_title.inner_text()

            assert page.evaluate("location.pathname") == f"/endings/{cottage_id}"
            endings_btn = page.locator('nav button[data-nav="endings"]')
            assert "active" in (endings_btn.get_attribute("class") or "")
            # The correction must use replaceState: no new history entry past
            # the one the navigation itself created.
            assert page.evaluate("history.length") == length_after_nav
        finally:
            page.close()

    def test_back_after_dropdown_open_returns_to_originating_list(self, seeded, browser):
        """The URL correction uses replaceState, so Back must still return to the
        list the position was opened from, not get stuck on the detail page."""
        page = browser.new_page()
        try:
            page.goto(seeded + "/tactics")
            tag_input = page.locator("#cat-tag-filters .tagfilter-input")
            tag_input.wait_for(state="visible")
            tag_input.fill("cottage")

            dropdown = page.locator("#cat-tag-filters .tagfilter-dropdown")
            dropdown.locator(".tagfilter-pos").first.wait_for(state="visible")
            dropdown.locator(".tagfilter-pos").first.click()

            detail_title = page.locator("#detail-title")
            detail_title.wait_for(state="visible")
            assert page.evaluate("location.pathname").startswith("/endings/")

            page.go_back()
            page.wait_for_timeout(200)
            assert page.evaluate("location.pathname") == "/tactics"
        finally:
            page.close()
