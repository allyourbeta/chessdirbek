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
