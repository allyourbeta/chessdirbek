// keyboard-navigation.js - Minimal keyboard navigation for top nav tabs ONLY
// This is a stabilization patch - only top nav tabs have custom arrow key behavior

const KeyboardNavigation = (function() {
    
    // Navigation for top nav bar ONLY
    // Only the main navigation items participate: Tactics, Tabiya, Endgames, Strategy, Games, Search
    function initTopNav() {
        // Target the specific nav element in the header
        const navElement = document.querySelector('header > nav');
        if (!navElement) return;
        
        // Only select direct button children with data-nav attribute (the main nav items)
        const navButtons = Array.from(navElement.querySelectorAll('button[data-nav]'));
        if (!navButtons.length) return;
        
        // Set initial tabindex (roving tabindex pattern)
        navButtons.forEach((btn, i) => {
            btn.tabIndex = i === 0 ? 0 : -1;
            btn.setAttribute('data-nav-index', i);
        });
        
        function focusNavButton(button) {
            if (!button || !navButtons.includes(button)) return;
            navButtons.forEach(btn => btn.tabIndex = -1);
            button.tabIndex = 0;
            button.focus({ preventScroll: true });
        }

        function focusActiveNavButton() {
            const activeButton = navButtons.find(btn => btn.classList.contains('active'))
                                || navButtons.find(btn => btn.tabIndex === 0)
                                || navButtons[0];
            focusNavButton(activeButton);
        }

        // Make the whole header/nav strip a focus-entry target for the top nav.
        // This fixes the common case where focus is down in cards/controls and the
        // user clicks the visible top bar background expecting arrow keys to return
        // to the section tabs. Keep this intentionally scoped to header/nav only.
        const headerElement = navElement.closest('header') || navElement;
        headerElement.addEventListener('pointerdown', function(e) {
            const clickedNavButton = e.target.closest('button[data-nav]');
            if (clickedNavButton && navButtons.includes(clickedNavButton)) {
                focusNavButton(clickedNavButton);
                return;
            }

            // Do not steal focus from the + New menu or other explicit controls on
            // the right side of the header. Empty/header/nav background should focus
            // the active tab; real controls should keep their normal behavior.
            if (e.target.closest('.nav-right, button, input, select, textarea, a')) {
                return;
            }

            if (e.target.closest('header')) {
                e.preventDefault();
                focusActiveNavButton();
            }
        });

        navElement.addEventListener('keydown', function(e) {
            const target = e.target;
            if (!navButtons.includes(target)) return;
            
            const currentIndex = parseInt(target.getAttribute('data-nav-index'), 10);
            let nextIndex = -1;
            
            switch(e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    nextIndex = (currentIndex + 1) % navButtons.length;
                    break;
                    
                case 'ArrowLeft':
                    e.preventDefault();
                    nextIndex = (currentIndex - 1 + navButtons.length) % navButtons.length;
                    break;
                    
                case 'Home':
                    e.preventDefault();
                    nextIndex = 0;
                    break;
                    
                case 'End':
                    e.preventDefault();
                    nextIndex = navButtons.length - 1;
                    break;
                    
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    target.click();
                    return;
            }
            
            if (nextIndex >= 0) {
                // Update tabindex (roving tabindex pattern)
                navButtons[currentIndex].tabIndex = -1;
                navButtons[nextIndex].tabIndex = 0;
                navButtons[nextIndex].focus();
            }
        });
    }
    
    // Stub for initGrid - does nothing now (stabilization)
    // Keeping the function to avoid breaking existing calls, but it does nothing
    function initGrid(containerId, cardSelector) {
        // Intentionally empty - grid navigation disabled for stabilization
        return;
    }
    
    return {
        initTopNav,
        initGrid  // No-op for now
    };
})();

window.KeyboardNavigation = KeyboardNavigation;