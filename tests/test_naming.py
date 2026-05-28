"""Test that position names are de-chessed as per spec §3"""
import re
import pytest


def test_naming_service_has_no_chess_terms():
    """Verify ADJECTIVES and NOUNS arrays contain no chess-specific terms."""
    
    # Read the naming service file
    with open('frontend/js/naming-service.js', 'r') as f:
        content = f.read()
    
    # Extract ADJECTIVES array
    adj_match = re.search(r'const ADJECTIVES = \[(.*?)\];', content, re.DOTALL)
    assert adj_match, "Could not find ADJECTIVES array"
    adjectives_str = adj_match.group(1)
    
    # Extract NOUNS array
    nouns_match = re.search(r'const NOUNS = \[(.*?)\];', content, re.DOTALL)
    assert nouns_match, "Could not find NOUNS array"
    nouns_str = nouns_match.group(1)
    
    # Extract all words from both arrays
    all_words = []
    for match in re.findall(r"'([^']+)'", adjectives_str + nouns_str):
        all_words.append(match.lower())
    
    # Banned chess terms from spec
    banned_terms = {
        'gambit', 'tactic', 'mate', 'check', 'pin', 'fork', 'skewer', 
        'tempo', 'endgame', 'opening', 'defense', 'attack', 'blitz', 
        'setup', 'motif'
    }
    
    # Check for banned terms
    found_banned = [word for word in all_words if word in banned_terms]
    assert len(found_banned) == 0, f"Found banned chess terms: {found_banned}"
    
    # Verify all words are ≤ 8 characters (length budget)
    long_words = [word for word in all_words if len(word) > 8]
    assert len(long_words) == 0, f"Found words longer than 8 chars: {long_words}"
    
    # Ensure we have enough variety
    assert len(all_words) >= 40, f"Expected at least 40 words total, got {len(all_words)}"