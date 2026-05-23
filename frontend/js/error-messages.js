// Error message normalization helper
window.ErrorMessages = window.ErrorMessages || {};

/**
 * Normalize error objects to user-friendly messages
 * @param {Error|Object|string} error - The error to normalize
 * @param {string} fallback - Default message if error is unclear
 * @returns {string} User-friendly error message
 */
window.ErrorMessages.normalize = function(error, fallback) {
    fallback = fallback || 'An error occurred';
    
    if (!error) return fallback;
    
    // String errors
    if (typeof error === 'string') {
        return error.trim() || fallback;
    }
    
    // API error objects with .data.detail
    if (error.data && error.data.detail) {
        return error.data.detail;
    }
    
    // Standard Error objects
    if (error.message) {
        return error.message;
    }
    
    // Fallback for unknown error types
    return fallback;
};