"""Playwright tests for SPEC-TOOLBARS.md: one shared under-board toolbar style,
with Flip / Random, Lichess grouped consistently and new buttons (Replay Flip,
Play Flip, Practice viewer Lichess, Search Starting Position, Add form Clear
Board) wired to real BoardManager/FenActions code.

Runs the real built app against a real (temp-file) SQLite database on its own
server, on port 8001 (the pattern from tests/test_position_search_ui.py).
Tests use only their own sample data, seeded through the real API; none
depend on whatever is already in a database.
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
SHOT_DIR = ROOT / "docs" / "targets" / "actual"

STANDARD_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
EMPTY_BOARD_FEN = "8/8/8/8/8/8/8/8 w - - 0 1"

_BACK_RANKS = ["6k1", "5k2", "4k3", "3k4", "2k5"]


def _fen_for(n):
    # Distinct, legal positions (king on a different file each time) so each
    # test's seed is never a duplicate FEN of another test's — dedup is an
    # exact-string check in the backend.
    return f"{_BACK_RANKS[n]}/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1"


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


@pytest.fixture(scope="module")
def live_server(tmp_path_factory):
    if _port_in_use(PORT):
        pytest.fail(f"Port {PORT} is already in use — refusing to reuse another server.")

    db_path = tmp_path_factory.mktemp("board_toolbars_db") / "test.db"
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


def _seed_position(api, title, fen, position_type="tabiya"):
    r = api.post("/api/positions/", json={"fen": fen, "title": title, "position_type": position_type})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _seed_game(api, white="A", black="B"):
    pgn = f'[Event "Test"]\n[White "{white}"]\n[Black "{black}"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 1-0\n'
    r = api.post("/api/games/", json={"pgn_text": pgn})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _shoot(page, name):
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOT_DIR / f"{name}.png"), full_page=True)


def _drag_square(page, board_id, frm, to):
    src = page.locator(f'#{board_id} rect[data-square="{frm}"]')
    dst = page.locator(f'#{board_id} rect[data-square="{to}"]')
    sb = src.bounding_box()
    db = dst.bounding_box()
    page.mouse.move(sb["x"] + sb["width"] / 2, sb["y"] + sb["height"] / 2)
    page.mouse.down()
    page.mouse.move(db["x"] + db["width"] / 2, db["y"] + db["height"] / 2, steps=5)
    page.mouse.up()


class TestPositionPageToolbar:
    """Screenshot the reordered position-page toolbar (Flip FEN now after
    Lichess) and page-action row (Delete pushed right, before Next)."""

    def test_position_page_screenshot(self, live_server, browser, api):
        pos_id = _seed_position(api, "toolbars-position-page", _fen_for(0))
        page = browser.new_page()
        try:
            page.goto(live_server + f"/tabiya/{pos_id}")
            page.locator("#detail-title").wait_for(state="visible")
            _shoot(page, "position_page")

            # Flip FEN now sits after Lichess, right before the castling box.
            toolbar = page.locator("#detail-move-nav-wrap")
            html = toolbar.inner_html()
            assert html.index("Lichess") < html.index("Flip FEN")
        finally:
            page.close()


class TestCategoryPreviewToolbar:
    def test_category_preview_screenshot(self, live_server, browser, api):
        _seed_position(api, "toolbars-category-preview", _fen_for(1))
        page = browser.new_page()
        try:
            page.goto(live_server + "/tabiya")
            page.locator("#cat-featured-title").wait_for(state="visible")
            page.wait_for_function(
                "document.getElementById('cat-featured-title').textContent.trim().length > 0"
            )
            _shoot(page, "category_preview")
        finally:
            page.close()


class TestGameViewerToolbar:
    def test_game_viewer_screenshot(self, live_server, browser, api):
        game_id = _seed_game(api)
        page = browser.new_page()
        try:
            page.goto(live_server + f"/games/{game_id}")
            page.locator("#game-board svg.cm-chessboard").wait_for(state="visible")
            _shoot(page, "game_viewer")

            # Lichess now sits before Undo/Reset.
            toolbar = page.locator("#view-game-viewer .board-toolbar .control-group").first
            html = toolbar.inner_html()
            assert html.index("Lichess") < html.index("Undo")
        finally:
            page.close()


class TestReplayFlip:
    def test_replay_flip_changes_orientation(self, live_server, browser, api):
        pos_id = _seed_position(api, "toolbars-replay", _fen_for(2))
        after_e4_e5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
        r = api.post("/api/engine-games", json={
            "position_id": pos_id,
            "start_fen": STANDARD_START_FEN,
            "moves_san": "e4 e5",
            "user_color": "white",
            "engine_elo": 1600,
            "result": "*",
            "final_fen": after_e4_e5,
            "move_count": 2,
        })
        assert r.status_code == 201, r.text
        game_id = r.json()["id"]

        page = browser.new_page()
        try:
            page.goto(live_server + f"/tabiya/{pos_id}")
            page.locator("#detail-title").wait_for(state="visible")
            page.locator(f'[data-action="engine-game-open"][data-game-id="{game_id}"]').click()
            page.locator("#replay-board svg.cm-chessboard").wait_for(state="visible")
            _shoot(page, "engine_replay")

            before = page.evaluate("() => BoardManager.isFlipped('replay-board')")
            page.locator('[data-action="replay-flip"]').click()
            after = page.evaluate("() => BoardManager.isFlipped('replay-board')")
            assert after != before
        finally:
            page.close()


class TestPlayFlipAndMove:
    def test_play_flip_changes_orientation_and_move_still_works(self, live_server, browser, api):
        pos_id = _seed_position(api, "toolbars-play", STANDARD_START_FEN)
        page = browser.new_page()
        try:
            page.goto(live_server + f"/tabiya/{pos_id}")
            page.locator("#detail-title").wait_for(state="visible")
            page.select_option("#engine-color-select", "side-to-move")
            page.locator('[data-action="engine-play-start"]').click()
            page.locator("#play-board svg.cm-chessboard").wait_for(state="visible")
            _shoot(page, "play_vs_engine")

            before = page.evaluate("() => BoardManager.isFlipped('play-board')")
            page.locator('[data-action="play-flip"]').click()
            after = page.evaluate("() => BoardManager.isFlipped('play-board')")
            assert after != before

            # A legal move still plays after flipping the display orientation —
            # squares are located fresh (post-flip) so the drag targets the
            # visually-correct squares regardless of board rotation.
            _drag_square(page, "play-board", "e2", "e4")
            page.wait_for_function(
                "() => PlayMode.getCurrentFen() && PlayMode.getCurrentFen().split(' ')[0] !== "
                "'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'"
            )
            fen = page.evaluate("() => PlayMode.getCurrentFen()")
            assert fen.split(" ")[0] == "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR"
        finally:
            page.close()


class TestPracticeViewerLichess:
    """The Practice game viewer's own open/load path (PracticeViewer._load) is
    not implemented anywhere in frontend/js — see "Noticed, not touched" in
    the report. This test activates #view-practice-viewer directly (the same
    _activateView the real router calls) and populates pv-board with
    BoardManager.create the same way a working _load would, so it still
    proves the real toolbar markup + the reused analyze-on-lichess action
    against real production code, without depending on the missing module."""

    def test_practice_viewer_lichess_opens_lichess_with_fen(self, live_server, browser):
        fen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1"
        page = browser.new_page()
        try:
            page.goto(live_server + "/")
            page.wait_for_function("() => window.BoardManager && window._activateView")
            page.evaluate(
                "(fen) => { _activateView('practice-viewer', 'Practice'); "
                "BoardManager.create('pv-board', fen, {mode: 'view'}); }",
                fen,
            )
            page.locator("#pv-board svg.cm-chessboard").wait_for(state="visible")
            _shoot(page, "practice_viewer")

            page.evaluate(
                "() => { window.__opened = null; "
                "window.open = (url) => { window.__opened = url; return {}; }; }"
            )
            page.locator('#pv-nav-btns [data-action="analyze-on-lichess"]').click()
            opened = page.evaluate("() => window.__opened")
            assert opened is not None
            assert opened == "https://lichess.org/analysis/standard/" + fen.replace(" ", "_")
        finally:
            page.close()


class TestSearchStartingPosition:
    def test_search_starting_position_loads_start_position(self, live_server, browser):
        page = browser.new_page()
        try:
            page.goto(live_server + "/search")
            page.locator("#search-board svg.cm-chessboard").wait_for(state="visible")

            # Clear first so the Starting Position click is an observable change.
            page.locator('[data-action="search-set-start"]').click()
            fen = page.evaluate("() => searchChess.fen()")
            assert fen.split(" ")[0] == "8/8/8/8/8/8/8/8"

            page.locator('[data-action="search-start-position"]').click()
            _shoot(page, "search")
            fen = page.evaluate("() => searchChess.fen()")
            assert fen.split(" ")[0] == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
        finally:
            page.close()


class TestAddFormClearBoard:
    def test_add_form_clear_board_empties_board_and_fen_box(self, live_server, browser):
        page = browser.new_page()
        try:
            page.goto(live_server + "/tabiya/new")
            page.locator("#board svg.cm-chessboard").wait_for(state="visible")
            _shoot(page, "add_form")

            page.locator('[data-action="clear-add-board"]').click()
            assert page.locator("#fen-input").input_value() == EMPTY_BOARD_FEN
            board_fen = page.evaluate("() => BoardManager.getPosition('board')")
            assert board_fen.split(" ")[0] == "8/8/8/8/8/8/8/8"
        finally:
            page.close()


class TestEditorToolbar:
    def test_editor_screenshot(self, live_server, browser):
        page = browser.new_page()
        try:
            page.goto(live_server + "/editor")
            page.locator("#editor-board svg.cm-chessboard").wait_for(state="visible")
            _shoot(page, "editor")
        finally:
            page.close()
