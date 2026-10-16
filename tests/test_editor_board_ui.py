"""Playwright test for SPEC-EDITOR-KING.md: kings are always placeable (editor
and Search board), the editor saves correct castling rights, and the editor's
"Search" hand-off no longer drops the first click back to a stale position.

Runs the real built app against a real (temp-file) SQLite database on its own
server, on port 8001, so FenUtils.placePiece and completeAndSanitizeFen are
proven end-to-end against the real chess.js 0.10.3 served from cdnjs, not a
mock. Tests use only their own sample positions; they never depend on
whatever is already in a database.
"""

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8001
BASE_URL = f"http://localhost:{PORT}"


def _port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


@pytest.fixture(scope="module")
def live_server(tmp_path_factory):
    if _port_in_use(PORT):
        pytest.fail(f"Port {PORT} is already in use — refusing to reuse another server.")

    db_path = tmp_path_factory.mktemp("editor_board_db") / "test.db"
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


def _select_editor_tool(page, tool):
    page.locator(f'#editor-palette .palette-btn[data-tool="{tool}"]').click()


def _click_editor_square(page, square):
    page.locator(f'#editor-board rect[data-square="{square}"]').click(force=True)


def _select_search_tool(page, tool):
    page.locator(f'#search-palette .search-palette-btn[data-search-tool="{tool}"]').click()


def _click_search_square(page, square):
    page.locator(f'#search-board rect[data-square="{square}"]').click(force=True)


def _editor_fen(page):
    return page.locator("#editor-fen").input_value()


class TestPlacePieceLogic:
    """Item 1: pure chess.js logic, exercised via page.evaluate — no editor UI
    involved. Any page that loaded fen-utils.js and chess.js will do."""

    def test_king_always_placeable_white(self, live_server, browser):
        page = browser.new_page()
        try:
            page.goto(live_server + "/editor")
            page.wait_for_function("() => window.FenUtils && window.Chess")

            result = page.evaluate(
                """() => {
                    const chess = new Chess();
                    chess.load('8/8/8/8/8/8/8/8 w - - 0 1');
                    FenUtils.placePiece(chess, {type: 'k', color: 'w'}, 'e1');
                    FenUtils.placePiece(chess, {type: 'q', color: 'w'}, 'e1');
                    FenUtils.placePiece(chess, {type: 'k', color: 'w'}, 'd1');
                    return chess.fen();
                }"""
            )
            board = result.split(" ")[0]
            assert "K" in board
            assert chess_square_piece(board, "d1") == "K"
            assert chess_square_piece(board, "e1") == "Q"
        finally:
            page.close()

    def test_king_to_king_relocation_exactly_one_king(self, live_server, browser):
        page = browser.new_page()
        try:
            page.goto(live_server + "/editor")
            page.wait_for_function("() => window.FenUtils && window.Chess")

            result = page.evaluate(
                """() => {
                    const chess = new Chess();
                    chess.load('8/8/8/8/8/8/8/8 w - - 0 1');
                    FenUtils.placePiece(chess, {type: 'k', color: 'w'}, 'e1');
                    FenUtils.placePiece(chess, {type: 'k', color: 'w'}, 'd1');
                    return chess.fen();
                }"""
            )
            board = result.split(" ")[0]
            assert board.count("K") == 1
            assert chess_square_piece(board, "d1") == "K"

            result_black = page.evaluate(
                """() => {
                    const chess = new Chess();
                    chess.load('8/8/8/8/8/8/8/8 w - - 0 1');
                    FenUtils.placePiece(chess, {type: 'k', color: 'b'}, 'e8');
                    FenUtils.placePiece(chess, {type: 'k', color: 'b'}, 'd8');
                    return chess.fen();
                }"""
            )
            board_black = result_black.split(" ")[0]
            assert board_black.count("k") == 1
            assert chess_square_piece(board_black, "d8") == "k"
        finally:
            page.close()


def chess_square_piece(board_field, square):
    """Read the piece letter at `square` from a FEN board field, or None."""
    files = "abcdefgh"
    file_idx = files.index(square[0])
    rank = int(square[1])
    row = board_field.split("/")[8 - rank]
    col = 0
    for ch in row:
        if ch.isdigit():
            col += int(ch)
        else:
            if col == file_idx:
                return ch
            col += 1
    return None


class TestEditorKingUI:
    """Item 2: the same sequence, driven through real clicks on /editor."""

    def test_editor_second_king_click_moves_it(self, live_server, browser):
        page = browser.new_page()
        try:
            page.goto(live_server + "/editor")
            page.locator("#editor-board svg.cm-chessboard").wait_for(state="visible")

            _select_editor_tool(page, "w_k")
            _click_editor_square(page, "e1")
            _select_editor_tool(page, "w_q")
            _click_editor_square(page, "e1")
            _select_editor_tool(page, "w_k")
            _click_editor_square(page, "d1")

            board = _editor_fen(page).split(" ")[0]
            assert chess_square_piece(board, "d1") == "K"
            assert chess_square_piece(board, "e1") == "Q"
            assert board.count("K") == 1
        finally:
            page.close()


class TestEditorCastlingRights:
    """Item 3: the editor's displayed FEN carries only castling rights the
    placement actually supports."""

    def test_starting_position_keeps_kqkq(self, live_server, browser):
        page = browser.new_page()
        try:
            page.goto(live_server + "/editor")
            page.locator('[data-editor-action="start"]').click()
            fen = _editor_fen(page)
            assert fen.split(" ")[2] == "KQkq"
        finally:
            page.close()

    def test_erasing_h1_rook_drops_k_right_only(self, live_server, browser):
        page = browser.new_page()
        try:
            page.goto(live_server + "/editor")
            page.locator('[data-editor-action="start"]').click()

            _select_editor_tool(page, "eraser")
            _click_editor_square(page, "h1")

            fen = _editor_fen(page)
            castling = fen.split(" ")[2]
            assert "K" not in castling
            assert castling == "Qkq"
        finally:
            page.close()


class TestEditorSearchHandoff:
    """Item 4: pressing a Search button from the editor must hand the SAME
    position to the Search board immediately — not 50ms later — so a click
    that lands on the Search board before that delay elapses still builds on
    the editor's position instead of on AppState.searchFen's stale default
    (the full starting position, state.js:34), which `initSearchBoard` loads
    into `searchChess` as soon as navigation runs.

    The click is driven by calling `searchOnSquareClick` directly, with no
    wait after pressing Search, so the test lands inside that race window
    deterministically rather than hoping a real click is fast enough."""

    def test_search_board_keeps_editor_position_on_first_click(self, live_server, browser):
        page = browser.new_page()
        try:
            page.goto(live_server + "/editor")
            page.locator("#editor-board svg.cm-chessboard").wait_for(state="visible")

            _select_editor_tool(page, "w_k")
            _click_editor_square(page, "e4")

            page.locator('[data-editor-action="search"][data-search-type="pawn"]').click()

            fen = page.evaluate(
                "() => { searchActiveTool = 'b_p'; searchOnSquareClick('a5'); return searchChess.fen(); }"
            )
            board = fen.split(" ")[0]
            assert chess_square_piece(board, "e4") == "K"
            assert chess_square_piece(board, "a5") == "p"
            # The stale default (state.js:34) is the full starting position;
            # confirm we did not just build on top of that instead.
            assert chess_square_piece(board, "e2") is None
        finally:
            page.close()


class TestSearchBoardKingUI:
    """Item 5: the same king-placement sequence as TestEditorKingUI, but on
    the Search page's own board."""

    def test_search_board_second_king_click_moves_it(self, live_server, browser):
        page = browser.new_page()
        try:
            page.goto(live_server + "/search")
            page.locator("#search-board svg.cm-chessboard").wait_for(state="visible")

            _select_search_tool(page, "w_k")
            _click_search_square(page, "e1")
            _select_search_tool(page, "w_q")
            _click_search_square(page, "e1")
            _select_search_tool(page, "w_k")
            _click_search_square(page, "d1")

            fen = page.evaluate("() => searchChess.fen()")
            board = fen.split(" ")[0]
            assert chess_square_piece(board, "d1") == "K"
            assert chess_square_piece(board, "e1") == "Q"
            assert board.count("K") == 1
        finally:
            page.close()
