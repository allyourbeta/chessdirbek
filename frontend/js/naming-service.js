/**
 * Centralized position naming service.
 * All automatic position name generation should go through this service.
 */
window.NamingService = (function() {
    'use strict';

    // Adjectives for generated names (short, ≤8 chars each)
    const ADJECTIVES = [
        'sharp', 'bold', 'solid', 'deep', 'calm', 'active', 'precise', 'fluid',
        'tricky', 'clear', 'quiet', 'fierce', 'clever', 'subtle', 'modern',
        'classic', 'quick', 'smooth', 'tight', 'open', 'wild', 'safe',
        'risky', 'fresh', 'clean', 'neat', 'strong', 'weak', 'fast', 'slow'
    ];

    // Nouns for generated names (short, ≤8 chars each)  
    const NOUNS = [
        'setup', 'pattern', 'study', 'puzzle', 'theme', 'motif', 'idea',
        'line', 'plan', 'tactic', 'endgame', 'opening', 'attack', 'defense',
        'fork', 'pin', 'skewer', 'trap', 'gambit', 'storm', 'break',
        'mate', 'check', 'blitz', 'tempo', 'space', 'center', 'wing'
    ];

    /**
     * Generate a random adjective-noun position name
     * @returns {string} Generated name like "sharp-tactic"
     */
    function generatePositionName() {
        const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        return adjective + '-' + noun;
    }

    /**
     * Generate a name for a position from a game
     * @param {Object} game - Game object with white, black properties
     * @param {number} ply - Current ply number
     * @param {Array} movesSan - Array of moves in SAN notation
     * @returns {string} Game-based name like "Kasparov vs Karpov - after 15.Nf3"
     */
    function generateGamePositionName(game, ply, movesSan) {
        const white = game.white || '?';
        const black = game.black || '?';
        let moveDesc;
        
        if (ply === 0) {
            moveDesc = 'starting position';
        } else {
            const moveNum = MoveCounts.fullMoveCountFromPlies(ply);
            const movePrefix = ply % 2 === 1 ? '' : '...';
            const move = movesSan[ply - 1];
            moveDesc = `after ${moveNum}.${movePrefix}${move}`;
        }
        
        return `${white} vs ${black} - ${moveDesc}`;
    }

    /**
     * Generate a fork name from a source position
     * @param {string} sourceTitle - Title of the source position
     * @returns {string} Fork name like "Fork from Brilliant Tactic"
     */
    function generateForkName(sourceTitle) {
        const cleanTitle = sourceTitle || 'untitled';
        return `Fork from ${cleanTitle}`;
    }

    /**
     * Generate a name when forking from a position detail
     * @param {string} sourceTitle - Title from detail element or fallback
     * @returns {string} Fork name like "From Brilliant Tactic"
     */
    function generateFromPositionName(sourceTitle) {
        const cleanTitle = sourceTitle || 'position';
        return `From ${cleanTitle}`;
    }

    /**
     * Get fallback name for positions with no title
     * @returns {string} Always returns "Untitled"
     */
    function getFallbackName() {
        return 'Untitled';
    }

    /**
     * Generate appropriate name based on context
     * @param {Object} options - Context options
     * @param {Object} options.game - Game object (for game positions)
     * @param {number} options.ply - Current ply (for game positions)
     * @param {Array} options.movesSan - Move array (for game positions)
     * @param {string} options.sourceTitle - Source title (for forks)
     * @param {string} options.type - Name type: 'game', 'fork', 'fromPosition', 'random', 'fallback'
     * @returns {string} Generated name
     */
    function generateNameByContext(options = {}) {
        const { type, game, ply, movesSan, sourceTitle } = options;

        switch (type) {
            case 'game':
                return generateGamePositionName(game, ply, movesSan);
            case 'fork':
                return generateForkName(sourceTitle);
            case 'fromPosition':
                return generateFromPositionName(sourceTitle);
            case 'random':
                return generatePositionName();
            case 'fallback':
            default:
                return getFallbackName();
        }
    }

    // Public API
    return {
        generatePositionName,
        generateGamePositionName,
        generateForkName,
        generateFromPositionName,
        getFallbackName,
        generateNameByContext
    };
})();