/**
 * Centralized position naming service.
 * All automatic position name generation should go through this service.
 */
window.NamingService = (function() {
    'use strict';

    // Adjectives for generated names (short, ≤8 chars each)
    // Names are intentionally generic (non-chess). Only constraint is length so the adjective-noun pair fits the tile.
    const ADJECTIVES = [
        'amber', 'brave', 'calm', 'clever', 'cosmic', 'cozy', 'crisp', 'dapper',
        'eager', 'fuzzy', 'gentle', 'golden', 'happy', 'jolly', 'keen', 'lively',
        'lucky', 'mellow', 'merry', 'nimble', 'plucky', 'quiet', 'rapid', 'shiny',
        'snug', 'spry', 'sunny', 'swift', 'tidy', 'witty', 'zesty'
    ];

    // Nouns for generated names (short, ≤8 chars each)
    // Names are intentionally generic (non-chess). Only constraint is length so the adjective-noun pair fits the tile.
    const NOUNS = [
        'acorn', 'badger', 'beacon', 'cabin', 'cedar', 'comet', 'cove', 'ember',
        'falcon', 'fern', 'harbor', 'heron', 'lark', 'lotus', 'maple', 'marble',
        'meadow', 'otter', 'pebble', 'quartz', 'raven', 'ridge', 'robin', 'sparrow',
        'stone', 'thistle', 'tundra', 'willow'
    ];

    /**
     * Generate a random adjective-noun position name
     * @returns {string} Generated name like "sunny-maple"
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