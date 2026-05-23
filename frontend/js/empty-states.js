// Empty state rendering helper
window.EmptyStates = window.EmptyStates || {};

/**
 * Render a standard empty state with title and subtitle
 * @param {string} title - Main empty state message
 * @param {string} subtitle - Secondary helpful message
 * @returns {string} HTML string for empty state
 */
window.EmptyStates.render = function(title, subtitle) {
    return `<div class="empty-state"><p>${Html.escape(title)}</p><p>${Html.escape(subtitle)}</p></div>`;
};