// Tag rendering helper for consistent chip display
window.TagRenderer = window.TagRenderer || {};

/**
 * Render tags as HTML chips with proper escaping
 * @param {Array} tags - Array of tag objects with .name property, or array of strings
 * @returns {string} HTML string for tag chips
 */
window.TagRenderer.renderChips = function(tags) {
    if (!tags || !tags.length) return '';
    
    return tags.map(function(tag) {
        var tagName = typeof tag === 'string' ? tag : tag.name;
        return '<span class="tag">#' + Html.escape(tagName) + '</span>';
    }).join('');
};