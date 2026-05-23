import re
from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import app


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
client = TestClient(app)


def test_app_shell_loads_with_nav_and_icon():
    response = client.get("/tactics")
    assert response.status_code == 200
    html = response.text
    assert 'src="/icon-192.png"' in html
    for label in ["Tactics", "Tabiya", "Games", "Search"]:
        assert f">{label}<" in html


def test_frontend_script_order_keeps_bootstrap_last():
    html = client.get("/").text
    scripts = re.findall(r'<script(?: type="module")? src="([^"]+)"', html)
    assert "/js/navigation.js" in scripts
    assert "/js/api-client.js" in scripts
    assert "/js/html-utils.js" in scripts
    assert "/js/move-count.js" in scripts
    assert scripts.index("/js/api-client.js") < scripts.index("/js/games.js")
    assert scripts.index("/js/board-editor.js") < scripts.index("/js/main.js")
    assert scripts[-1] == "/js/main.js"


def test_pwa_manifest_references_existing_icons():
    manifest = client.get("/manifest.json")
    assert manifest.status_code == 200
    data = manifest.json()
    icon_paths = [icon["src"] for icon in data["icons"]]
    assert "/icon-192.png" in icon_paths
    assert "/icon-512.png" in icon_paths
    for path in icon_paths:
        assert (FRONTEND / path.lstrip("/")).exists()


def test_static_helper_contracts_are_present():
    eco = (FRONTEND / "js" / "eco-openings.js").read_text()
    move_counts = (FRONTEND / "js" / "move-count.js").read_text()
    stockfish = (FRONTEND / "js" / "stockfish-service.js").read_text()
    assert "labelFor" in eco
    assert "formatMoveCountFromPlies" in move_counts
    assert "formatAverageMoveCountFromPlies" in move_counts
    assert "terminate()" in stockfish


def test_games_page_structure():
    """Games page contains structure for rendering game rows."""
    html = client.get("/games").text
    assert "view-games" in html  # Main games view container
    assert "tag-filters" in html or "filters" in html  # Filter controls 
    assert "No games" in html or "game" in html  # Either empty state or games present


def test_eco_opening_label_integration():
    """ECO opening display integration is present in relevant JS files."""
    games_js = (FRONTEND / "js" / "games.js").read_text()
    game_viewer_js = (FRONTEND / "js" / "game-viewer.js").read_text()
    
    # Check that games.js uses ECO lookup
    assert "EcoOpenings" in games_js
    
    # Check that game viewer uses ECO lookup  
    assert "EcoOpenings.labelFor" in game_viewer_js


def test_practice_move_count_display():
    """Practice save modal uses proper move count conversion from plies."""
    practice_ui = (FRONTEND / "js" / "practice-ui.js").read_text()
    
    # Check that practice UI uses MoveCounts helper for move display
    assert "MoveCounts.formatMoveCountFromPlies" in practice_ui
    assert "showSaveModal" in practice_ui


def test_engine_destruction_path():
    """Engine has destruction/termination capability."""
    stockfish = (FRONTEND / "js" / "stockfish-service.js").read_text()
    engine_ui = (FRONTEND / "js" / "engine-ui.js").read_text()
    
    # Check destruction methods exist
    assert "destroy(" in stockfish or "terminate(" in stockfish
    assert "unmount" in engine_ui or "destroy" in engine_ui


def test_editor_cancel_button_structure():
    """Editor pages contain cancel button structure.""" 
    html = client.get("/add").text
    
    # Check for cancel-related elements
    assert "cancel" in html.lower() or "Cancel" in html
    # Check for cancel functionality via data-action or Navigation helper
    cancel_patterns = ["Navigation.cancelToFallback", "history.back", "data-action=\"cancel\"", "data-action=\"collection-cancel\""]
    has_cancel_functionality = any(pattern in html for pattern in cancel_patterns)
    assert has_cancel_functionality, "No cancel functionality found"
