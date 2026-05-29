"""Integration tests for play mode (§5.2)."""
import re


def test_play_js_exists_and_loaded():
    """Verify play.js is created and loaded before main.js (and play-result.js before play.js)."""
    # Check file exists
    with open('frontend/js/play.js', 'r') as f:
        content = f.read()
        assert 'window.PlayMode' in content
        assert 'async function start(' in content or 'start(' in content
        assert 'handleUserMove' in content
        assert 'engineReply' in content
        assert 'game.game_over()' in content  # Uses snake_case chess.js 0.10.3

    # The game-result rules were extracted to play-result.js.
    with open('frontend/js/play-result.js', 'r') as f:
        result_content = f.read()
        assert 'window.PlayResult' in result_content
        assert 'game.in_checkmate()' in result_content

    # Check loaded in index.html before main.js
    with open('frontend/index.html', 'r') as f:
        html = f.read()
        # Find script positions
        engine_pos = html.find('src="/js/engine.js"')
        result_pos = html.find('src="/js/play-result.js"')
        play_pos = html.find('src="/js/play.js"')
        main_pos = html.find('src="/js/main.js"')

        assert engine_pos > 0, "engine.js not found in index.html"
        assert result_pos > 0, "play-result.js not found in index.html"
        assert play_pos > 0, "play.js not found in index.html"
        assert main_pos > 0, "main.js not found in index.html"
        assert engine_pos < play_pos < main_pos, "Scripts must load in order: engine -> play -> main"
        assert result_pos < play_pos, "play-result.js must load before play.js"


def test_play_view_html_structure():
    """Verify play view HTML elements exist."""
    with open('frontend/index.html', 'r') as f:
        html = f.read()
        
        # Check play view exists
        assert 'id="view-play"' in html
        assert 'id="play-board"' in html
        assert 'id="play-status"' in html
        assert 'id="play-move-list"' in html
        
        # Check play controls on detail page
        assert 'id="engine-play-section"' in html
        assert 'id="engine-color-select"' in html
        assert 'id="engine-difficulty-select"' in html
        assert 'data-action="engine-play-start"' in html
        assert 'data-action="engine-play-resign"' in html
        
        # Check engine games section
        assert 'id="engine-games-section"' in html
        assert 'id="engine-games-list"' in html


def test_action_handlers_registered():
    """Verify engine play action handlers are registered."""
    with open('frontend/js/action-handlers.js', 'r') as f:
        content = f.read()
        assert "case 'engine-play-start':" in content
        assert "case 'engine-play-resign':" in content
        assert 'startEnginePlay()' in content
        assert 'PlayMode.resign()' in content


def test_chess_js_snake_case_methods():
    """Verify the play flow uses chess.js 0.10.3 snake_case methods.

    The result predicates now live in play-result.js (extracted from play.js),
    so we check both files together.
    """
    with open('frontend/js/play.js', 'r') as f:
        play = f.read()
    with open('frontend/js/play-result.js', 'r') as f:
        result = f.read()

    # Snake_case methods, in whichever file now owns them.
    assert 'game.game_over()' in play
    assert 'game.in_checkmate()' in result
    assert 'game.in_stalemate()' in result
    assert 'game.in_threefold_repetition()' in result
    assert 'game.insufficient_material()' in result or 'game.in_draw()' in result

    # Should NOT use camelCase (newer chess.js) anywhere in the play flow.
    for content in (play, result):
        assert 'isGameOver()' not in content
        assert 'isCheckmate()' not in content
        assert 'isStalemate()' not in content
        

def test_uci_conversion_logic():
    """Verify UCI to chess.js move conversion is implemented."""
    with open('frontend/js/play.js', 'r') as f:
        content = f.read()
        
        # Should handle UCI format conversion
        assert 'uci.slice(0, 2)' in content or 'uci.substring(0, 2)' in content
        assert 'uci.slice(2, 4)' in content or 'uci.substring(2, 4)' in content
        # Should handle promotion
        assert 'promotion' in content