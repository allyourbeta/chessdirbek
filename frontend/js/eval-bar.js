/**
 * Evaluation bar component for displaying engine evaluation.
 * Maps scores to visual White/Black advantage representation.
 * §5.4 of PLAY-AND-REVIEW-SPEC.md
 */
window.EvalBar = (function() {
    'use strict';
    
    const CLAMP_CP = 1000; // Clamp centipawn display to ±10.00 for bar fill
    
    function render(containerId, score) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Determine score text
        let scoreText = '—';
        let whitePercent = 50;
        
        if (score) {
            if (score.mate !== null) {
                // Mate score
                const mateNum = Math.abs(score.mate);
                scoreText = score.mate > 0 ? `M${mateNum}` : `-M${mateNum}`;
                // Mate is absolute - full bar to winning side
                whitePercent = score.mate > 0 ? 100 : 0;
            } else if (score.scoreCp !== null) {
                // Centipawn score
                const cp = score.scoreCp / 100; // Convert to pawns
                scoreText = cp >= 0 ? `+${cp.toFixed(2)}` : cp.toFixed(2);
                
                // Clamp for visual representation
                const clampedCp = Math.max(-CLAMP_CP, Math.min(CLAMP_CP, score.scoreCp));
                // Map to 0-100% (50% is equal, 100% is +10 or more, 0% is -10 or less)
                whitePercent = 50 + (clampedCp / CLAMP_CP) * 50;
            }
        }
        
        // Update bar fill
        const bar = container.querySelector('.eval-bar');
        if (bar) {
            bar.style.background = `linear-gradient(to right, white ${whitePercent}%, black ${whitePercent}%)`;
        }
        
        // Update text
        const text = container.querySelector('.eval-text');
        if (text) {
            text.textContent = scoreText;
            // Color based on who's better
            if (score && score.mate !== null) {
                text.style.color = score.mate > 0 ? '#4a9eff' : '#ff4a4a';
            } else if (score && score.scoreCp !== null) {
                if (Math.abs(score.scoreCp) < 50) {
                    text.style.color = 'var(--text-muted)';
                } else {
                    text.style.color = score.scoreCp > 0 ? '#4a9eff' : '#ff4a4a';
                }
            } else {
                text.style.color = 'var(--text-muted)';
            }
        }
    }
    
    function clear(containerId) {
        render(containerId, null);
    }
    
    // Public API
    return {
        render,
        clear
    };
})();