"""Integration tests for game replay (§5.3/§5.4)."""
import re


def test_replay_files_exist_and_loaded():
    """Verify game-replay.js and eval-bar.js are created and loaded."""
    # Check game-replay.js
    with open('frontend/js/game-replay.js', 'r') as f:
        content = f.read()
        assert 'window.GameReplay' in content
        assert 'async function open(' in content or 'open(' in content
        assert 'Engine.evaluate' in content
        assert 'MoveNavigator.create' in content
        assert 'convertUciLineToSan' in content
        assert 'onStep' in content
    
    # Check eval-bar.js
    with open('frontend/js/eval-bar.js', 'r') as f:
        content = f.read()
        assert 'window.EvalBar' in content
        assert 'render' in content
        assert 'scoreCp' in content
        assert 'mate' in content
        assert 'whitePercent' in content
    
    # Check loaded in index.html
    with open('frontend/index.html', 'r') as f:
        html = f.read()
        evalbar_pos = html.find('src="/js/eval-bar.js"')
        replay_pos = html.find('src="/js/game-replay.js"')
        main_pos = html.find('src="/js/main.js"')
        
        assert evalbar_pos > 0, "eval-bar.js not found in index.html"
        assert replay_pos > 0, "game-replay.js not found in index.html"
        assert evalbar_pos < replay_pos < main_pos, "Scripts must load in order: eval-bar -> replay -> main"


def test_replay_view_html_structure():
    """Verify replay view HTML elements exist."""
    with open('frontend/index.html', 'r') as f:
        html = f.read()
        
        # Check replay view exists
        assert 'id="view-replay"' in html
        assert 'id="replay-board"' in html
        assert 'id="replay-move-nav"' in html
        assert 'id="replay-eval"' in html
        assert 'id="replay-eval-bar"' in html
        assert 'id="replay-eval-text"' in html
        assert 'id="replay-bestline"' in html
        assert 'id="replay-move-list"' in html


def test_engine_games_ui_handlers():
    """Verify engine game UI handlers are defined."""
    with open('frontend/js/engine-games-ui.js', 'r') as f:
        content = f.read()
        assert 'function openEngineGame' in content or 'async function openEngineGame' in content
        assert 'function deleteEngineGame' in content or 'async function deleteEngineGame' in content
        assert 'GameReplay.open' in content
        assert 'ApiClient.delete' in content


def test_action_handlers_for_games():
    """Verify game action handlers are registered."""
    with open('frontend/js/action-handlers.js', 'r') as f:
        content = f.read()
        assert "case 'engine-game-open':" in content
        assert "case 'engine-game-delete':" in content
        assert "case 'replay-back':" in content
        assert 'openEngineGame' in content
        assert 'deleteEngineGame' in content


def test_eval_score_normalization():
    """Verify eval bar handles White's POV normalization."""
    with open('frontend/js/eval-bar.js', 'r') as f:
        content = f.read()
        # Should handle both positive and negative scores
        assert 'score.mate > 0' in content
        assert 'score.scoreCp' in content
        assert 'whitePercent' in content
        # Should clamp display
        assert 'CLAMP' in content or 'clamp' in content or '1000' in content


def test_cleanup_on_view_change():
    """Verify cleanup happens when leaving play/replay views."""
    with open('frontend/js/shared.js', 'r') as f:
        content = f.read()
        assert 'PlayMode.cleanup()' in content
        assert 'GameReplay.close()' in content