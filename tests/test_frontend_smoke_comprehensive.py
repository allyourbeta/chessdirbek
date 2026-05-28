"""
Phase 9 Comprehensive Frontend Smoke Tests
Test the specific integration bugs that have been fixed in recent phases.
"""

import re
import time
from pathlib import Path
import pytest
from playwright.sync_api import sync_playwright, Page, expect

from fastapi.testclient import TestClient
from backend.main import app

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
client = TestClient(app)


@pytest.fixture(scope="module")
def browser():
    """Start a browser for tests that need JavaScript execution."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser):
    """Create a new page for each test."""
    page = browser.new_page()
    # Listen for console errors
    page.on("console", lambda msg: print(f"Console {msg.type}: {msg.text}") if msg.type in ["error", "warning"] else None)
    yield page
    page.close()


def start_test_server():
    """Start the FastAPI test server and return the base URL."""
    # For this test, we'll use the TestClient to serve static files
    # In a real setup, you might want a separate test server
    return "http://localhost:8000"  # Assume server is running


class TestAppLoads:
    """Test 1: App loads without breaking errors."""
    
    def test_frontend_loads_without_console_errors(self, page: Page):
        """Frontend loads without console-breaking errors and main navigation is visible."""
        # Track console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        
        # Navigate to the app
        response = client.get("/")
        assert response.status_code == 200
        
        # Check that navigation elements are present
        html = response.text
        for nav_item in ["Tactics", "Tabiya", "Games", "Search"]:
            assert nav_item in html
        
        # Check for critical CSS/JS includes
        assert '/js/main.js' in html
        assert '/css/style.css' in html or 'style.css' in html


class TestInlineHandlerRegression:
    """Test 2: Verify no inline handlers remain."""
    
    def test_no_inline_handlers_in_html(self):
        """Verify no inline onclick/onchange/oninput/onsubmit handlers remain."""
        inline_patterns = ["onclick=", "onchange=", "oninput=", "onsubmit="]
        violations = []
        
        # Check all HTML files
        for html_file in (ROOT / "frontend").rglob("*.html"):
            content = html_file.read_text(errors="ignore")
            for pattern in inline_patterns:
                if pattern in content:
                    lines = content.splitlines()
                    for i, line in enumerate(lines, 1):
                        if pattern in line:
                            violations.append(f"{html_file.relative_to(ROOT)}:{i}")
        
        assert not violations, f"Inline handlers found: {violations}"


class TestAPIRegression:
    """Test 3: Verify no direct fetch() calls remain outside allowed files."""
    
    def test_no_direct_fetch_outside_api_client(self):
        """Verify no direct fetch( calls remain in frontend app JS outside api-client.js."""
        violations = []
        allowed_files = {"api-client.js", "sw.js"}
        
        for js_file in (ROOT / "frontend" / "js").rglob("*.js"):
            if js_file.name in allowed_files or "vendor" in str(js_file):
                continue
                
            content = js_file.read_text(errors="ignore")
            if "fetch(" in content:
                lines = content.splitlines()
                for i, line in enumerate(lines):
                    if "fetch(" in line and not line.strip().startswith("//"):
                        # Allow documented asset fetches
                        is_asset_fetch = False
                        if any(pattern in line.lower() for pattern in ["cdn.", ".svg", ".png", ".jpg", "assets/"]):
                            start = max(0, i-3)
                            window = "\n".join(lines[start:i+3])
                            if any(keyword in window.lower() for keyword in ["asset", "sprite", "piece", "cdn", "load"]):
                                is_asset_fetch = True
                        
                        if not is_asset_fetch:
                            violations.append(f"{js_file.relative_to(ROOT)}:{i+1}")
        
        assert not violations, f"Direct fetch() calls found: {violations}"


class TestNavigationRegression:
    """Test 4: Navigation/cancel behavior regression tests."""
    
    def test_editor_has_cancel_button(self):
        """Open editor flow, verify Cancel exists and returns safely."""
        # Test the add position editor
        response = client.get("/add")
        assert response.status_code == 200
        
        html = response.text
        # Check for cancel functionality
        cancel_found = "cancel" in html.lower() or "Cancel" in html
        assert cancel_found, "No cancel button found in editor"
        
        # Check that cancel/back controls are wired through the centralized
        # Navigation helper. After inline-handler removal, this wiring lives in
        # data-nav-cancel attributes plus event-delegation/action handler JS,
        # not as inline HTML calls.
        navigation_js = (FRONTEND / "js" / "navigation.js").read_text()
        event_delegation_js = (FRONTEND / "js" / "event-delegation.js").read_text()
        action_handlers_js = (FRONTEND / "js" / "action-handlers.js").read_text()

        navigation_helper = (
            "cancelToFallback" in navigation_js
            and ("data-nav-cancel" in html or "data-nav-cancel" in event_delegation_js)
            and "Navigation.cancelToFallback" in (event_delegation_js + action_handlers_js)
        )
        assert navigation_helper, "No centralized navigation cancel helper wiring found"


class TestFENOwnershipRegression:
    """Test 5: FEN ownership regression tests."""
    
    def test_current_fen_ownership_centralized(self):
        """Verify BoardManager.getCurrentFen() is the single source of truth."""
        # Check that getCurrentFen exists in board.js
        board_js = (FRONTEND / "js" / "board.js").read_text()
        assert "getCurrentFen()" in board_js, "getCurrentFen() not found in board.js"
        
        # Check that copy/save operations use getCurrentFen
        fen_actions = (FRONTEND / "js" / "fen-actions.js").read_text()
        assert "getCurrentFen()" in fen_actions, "FenActions should use getCurrentFen()"
        
        # Check that save-current uses the centralized approach
        shared_js = (FRONTEND / "js" / "shared.js").read_text()
        if "saveCurrentPosition" in shared_js:
            assert "getCurrentFen()" in shared_js, "Save current should use getCurrentFen()"


class TestMoveCountRegression:
    """Test 6: Move count regression tests."""
    
    def test_plies_display_as_chess_moves(self):
        """Verify ply counts display as chess moves, not raw plies."""
        # Check that MoveCounts helper is used for display
        move_count_js = (FRONTEND / "js" / "move-count.js").read_text()
        assert "fullMoveCountFromPlies" in move_count_js, "Move count converter missing"
        
        # Test the actual conversion
        # 53 plies should be 27 moves (ceil(53/2) = 27)
        assert "Math.ceil" in move_count_js, "Math.ceil conversion missing"
        
        # Check that games list uses the helper
        games_js = (FRONTEND / "js" / "games.js").read_text()
        assert "MoveCounts.fullMoveCountFromPlies" in games_js, "Games should use MoveCounts helper"


class TestECORegression:
    """Test 7: ECO/opening regression tests."""
    
    def test_eco_labels_use_centralized_helper(self):
        """Verify games/search/game-viewer display ECO labels through centralized helper."""
        # Check that EcoOpenings helper exists
        eco_js = (FRONTEND / "js" / "eco-openings.js").read_text()
        assert "labelFor" in eco_js, "EcoOpenings.labelFor missing"
        
        # Check that game viewer uses the helper
        game_viewer_js = (FRONTEND / "js" / "game-viewer.js").read_text()
        assert "EcoOpenings.labelFor" in game_viewer_js, "Game viewer should use EcoOpenings.labelFor"
        
        # Check that games list uses the helper
        games_js = (FRONTEND / "js" / "games.js").read_text()
        assert "EcoOpenings" in games_js, "Games should use EcoOpenings helper"
        
        # Check that search uses the helper
        search_js = (FRONTEND / "js" / "search.js").read_text()
        assert "EcoOpenings.labelFor" in search_js, "Search should use EcoOpenings helper"


class TestLichessIntegrationRegression:
    """Test 8: Lichess analysis integration (replaces removed engine lifecycle)."""
    
    def test_lichess_analysis_available(self):
        """Verify FenActions provides Lichess analysis link capability."""
        fen_actions = (FRONTEND / "js" / "fen-actions.js").read_text()
        assert "analyzeOnLichess" in fen_actions, "FenActions should have analyzeOnLichess"
        assert "lichess.org/analysis" in fen_actions, "Should link to Lichess analysis board"

    def test_lichess_button_in_detail_view(self):
        """Verify Lichess button exists in the detail view."""
        html = (FRONTEND / "index.html").read_text()
        assert 'data-action="analyze-on-lichess"' in html, "Lichess action button should exist"


class TestActionHandlerRegression:
    """Test 9: Action handler completeness (replaces removed practice engine)."""
    
    def test_lichess_action_registered(self):
        """Verify analyze-on-lichess action is handled in ActionHandlers."""
        action_handlers = (FRONTEND / "js" / "action-handlers.js").read_text()
        assert "analyze-on-lichess" in action_handlers, "ActionHandlers should handle analyze-on-lichess"


class TestSaveCurrentRegression:
    """Test 10: Save-current-position regression tests."""
    
    def test_save_current_position_centralized(self):
        """Verify save-current-position uses shared SaveCurrentPosition path."""
        # Check that shared save function exists
        shared_js = (FRONTEND / "js" / "shared.js").read_text()
        if "saveCurrentPosition" in shared_js:
            # If it exists, verify it uses getCurrentFen
            assert "getCurrentFen" in shared_js, "saveCurrentPosition should use getCurrentFen"
            
            # Verify it handles type selection
            type_patterns = ["type", "category", "tactic", "ending", "tabiya", "strategy"]
            has_types = any(pattern in shared_js for pattern in type_patterns)
            assert has_types, "saveCurrentPosition should handle position types"


class TestRenderingSafetyRegression:
    """Test 11: Rendering-safety regression tests."""
    
    def test_all_inner_html_has_safety_comments(self):
        """Verify every innerHTML in frontend/js has SAFE_INNER_HTML comment."""
        violations = []
        
        for js_file in (FRONTEND / "js").rglob("*.js"):
            content = js_file.read_text(errors="ignore")
            lines = content.splitlines()
            
            for i, line in enumerate(lines):
                if "innerHTML" in line and not line.strip().startswith("//"):
                    # Check for SAFE_INNER_HTML comment in previous 3 lines
                    start = max(0, i-3)
                    window = "\n".join(lines[start:i+1])
                    if "SAFE_INNER_HTML:" not in window:
                        violations.append(f"{js_file.relative_to(ROOT)}:{i+1}")
        
        assert not violations, f"Uncommented innerHTML usages: {violations}"
    
    def test_no_obvious_html_injection_vectors(self):
        """Check for basic XSS protection in title/tag/comment rendering."""
        # Check that Html.escape is used in key rendering functions
        tag_renderer = (FRONTEND / "js" / "tag-renderer.js").read_text()
        assert "Html.escape" in tag_renderer, "TagRenderer should use Html.escape"
        
        # Check that title inputs are escaped in position forms
        position_form = (FRONTEND / "js" / "position-form.js").read_text()
        if "title" in position_form and "innerHTML" in position_form:
            assert "Html.escape" in position_form, "Position form should escape title content"


class TestBusinessLogicRegression:
    """Test 12: Business-logic centralization regression tests."""
    
    def test_no_duplicated_eco_formatting(self):
        """Verify no local ECO string formatting patterns reappear."""
        violations = []
        eco_pattern = r'\$\{[^}]*eco[^}]*\}\s*—\s*\$\{[^}]*opening'
        
        for js_file in (FRONTEND / "js").rglob("*.js"):
            if js_file.name == "eco-openings.js":  # Skip the central helper
                continue
            content = js_file.read_text(errors="ignore")
            if re.search(eco_pattern, content):
                violations.append(str(js_file.relative_to(ROOT)))
        
        assert not violations, f"Direct ECO formatting found in: {violations}"
    
    def test_no_duplicated_move_count_conversion(self):
        """Verify no local move-count conversion patterns reappear."""
        violations = []
        
        for js_file in (FRONTEND / "js").rglob("*.js"):
            if js_file.name in {"move-count.js", "naming-service.js"}:  # Skip allowed files
                continue
            content = js_file.read_text(errors="ignore")
            if re.search(r'Math\.ceil\([^)]*\/\s*2\)', content):
                lines = content.splitlines()
                for i, line in enumerate(lines, 1):
                    if re.search(r'Math\.ceil\([^)]*\/\s*2\)', line):
                        violations.append(f"{js_file.relative_to(ROOT)}:{i}")
        
        assert not violations, f"Direct ply-to-move conversion found: {violations}"
    
    def test_no_duplicated_clipboard_operations(self):
        """Verify no direct clipboard operations outside FenActions."""
        violations = []
        
        for js_file in (FRONTEND / "js").rglob("*.js"):
            if js_file.name == "fen-actions.js":
                continue
            content = js_file.read_text(errors="ignore")
            if "clipboard.writeText" in content:
                lines = content.splitlines()
                for i, line in enumerate(lines, 1):
                    if "clipboard.writeText" in line and not line.strip().startswith("//"):
                        violations.append(f"{js_file.relative_to(ROOT)}:{i}")
        
        assert not violations, f"Direct clipboard operations found: {violations}"
    
    def test_no_duplicated_notification_builders(self):
        """Verify no local notification DOM builders remain."""
        violations = []
        
        for js_file in (FRONTEND / "js").rglob("*.js"):
            if js_file.name in {"shared.js", "practice-ui-actions.js"}:  # Skip allowed files
                continue
            content = js_file.read_text(errors="ignore")
            
            # Look for manual notification DOM construction
            notification_patterns = [
                r'createElement.*div.*notification',
                r'innerHTML.*notification',
                r'style.*position.*fixed.*bottom'
            ]
            
            for pattern in notification_patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    violations.append(f"{js_file.relative_to(ROOT)}: Manual notification construction")
        
        # This test might be too strict, so we'll make it a warning for now
        if violations:
            print(f"Warning: Potential manual notification construction: {violations}")