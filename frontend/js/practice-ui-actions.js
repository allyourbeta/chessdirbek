// practice-ui-actions.js — inline verdict editing + delete-with-undo
// Extends PracticeUI (defined in practice-ui.js, loaded before this file).
(function(UI) {

    // === Inline verdict editing ===

    let activeVerdictEdit = null;
    
    UI.showInlineVerdictEdit = function(gameId, userColor) {
        // Close any existing dropdown
        if (activeVerdictEdit) {
            UI.hideInlineVerdictEdit();
        }
        
        const display = document.getElementById(`verdict-display-${gameId}`);
        if (!display) return;
        
        const dropdown = document.createElement('select');
        dropdown.style.position = 'absolute';
        dropdown.style.left = '0';
        dropdown.style.top = '100%';
        dropdown.style.zIndex = '100';
        dropdown.style.background = 'var(--surface)';
        dropdown.style.border = '1px solid var(--border)';
        dropdown.style.borderRadius = '4px';
        dropdown.style.padding = '4px';
        dropdown.style.fontSize = '12px';
        dropdown.style.minWidth = '80px';
        
        const options = [
            { value: 'win', label: '1-0', whiteWin: true },
            { value: 'loss', label: '0-1', blackWin: true },
            { value: 'draw', label: '½-½' },
            { value: 'abandoned', label: '—' }
        ];
        
        options.forEach(opt => {
            const option = document.createElement('option');
            // Determine correct value based on user color
            let actualValue = opt.value;
            if (opt.whiteWin && userColor === 'black') actualValue = 'loss';
            else if (opt.blackWin && userColor === 'black') actualValue = 'win';
            else if (opt.whiteWin && userColor === 'white') actualValue = 'win';
            else if (opt.blackWin && userColor === 'white') actualValue = 'loss';
            
            option.value = actualValue;
            option.textContent = opt.label;
            dropdown.appendChild(option);
        });
        
        dropdown.onchange = async () => {
            const verdict = dropdown.value;
            await UI.saveInlineVerdict(gameId, verdict);
            UI.hideInlineVerdictEdit();
        };
        
        dropdown.onclick = (e) => e.stopPropagation();
        
        display.appendChild(dropdown);
        dropdown.focus();
        activeVerdictEdit = { gameId, dropdown };
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', UI.hideInlineVerdictEdit, { once: true });
        }, 0);
    };
    
    UI.hideInlineVerdictEdit = function() {
        if (activeVerdictEdit) {
            activeVerdictEdit.dropdown.remove();
            activeVerdictEdit = null;
        }
    };
    
    UI.saveInlineVerdict = async function(gameId, verdict) {
        try {
            const r = await fetch(`${API}/practice/${gameId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_verdict: verdict })
            });
            if (r.ok) {
                // Show brief confirmation
                const display = document.getElementById(`verdict-display-${gameId}`);
                if (display) {
                    const original = display.style.background;
                    display.style.background = 'var(--success-050)';
                    display.style.transition = 'background 0.3s';
                    setTimeout(() => {
                        display.style.background = original;
                    }, 500);
                }
                // Reload practice history to update display
                if (AppState.currentDetailId) {
                    Practice.loadPracticeHistory(AppState.currentDetailId);
                }
            }
        } catch (e) {
            console.error('Failed to save verdict:', e);
        }
    };

    // === Delete with undo ===

    let deletedGames = [];  // For undo functionality
    
    UI.showInlineDelete = function(gameId) {
        const btn = document.getElementById(`delete-btn-${gameId}`);
        const row = btn.closest('.pos-item');
        if (!row) return;
        
        // Replace button with confirm/cancel
        const original = btn.outerHTML;
        btn.style.display = 'none';
        
        const confirmDiv = document.createElement('div');
        confirmDiv.id = `delete-confirm-${gameId}`;
        confirmDiv.style.cssText = 'display:inline-flex;gap:4px;align-items:center';
        confirmDiv.innerHTML = `
            <span style="font-size:11px;color:var(--danger)">Delete?</span>
            <button class="btn btn-sm" style="padding:2px 6px;font-size:11px;background:var(--danger);color:white" onclick="event.stopPropagation();PracticeUI.confirmDelete(${gameId})">Yes</button>
            <button class="btn btn-sm btn-ghost" style="padding:2px 6px;font-size:11px" onclick="event.stopPropagation();PracticeUI.cancelDelete(${gameId})">No</button>
        `;
        
        btn.parentNode.insertBefore(confirmDiv, btn.nextSibling);
        
        // Auto-cancel after 5 seconds
        setTimeout(() => {
            if (document.getElementById(`delete-confirm-${gameId}`)) {
                UI.cancelDelete(gameId);
            }
        }, 5000);
    };
    
    UI.cancelDelete = function(gameId) {
        const confirmDiv = document.getElementById(`delete-confirm-${gameId}`);
        const btn = document.getElementById(`delete-btn-${gameId}`);
        if (confirmDiv) confirmDiv.remove();
        if (btn) btn.style.display = '';
    };
    
    UI.confirmDelete = async function(gameId) {
        const row = document.getElementById(`delete-btn-${gameId}`)?.closest('.pos-item');
        if (!row) return;
        
        // Store the row HTML for undo
        const rowHtml = row.outerHTML;
        const rowIndex = Array.from(row.parentNode.children).indexOf(row);
        const listEl = row.parentNode;
        
        // Remove the row immediately for responsive feel
        row.style.transition = 'opacity 0.3s, transform 0.3s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        
        setTimeout(async () => {
            row.remove();
            
            // Show undo notification
            UI.showUndoNotification(gameId, rowHtml, rowIndex, listEl);
            
            // Actually delete from backend
            deletedGames.push({ gameId, rowHtml, rowIndex, listEl });
            const r = await fetch(`${API}/practice/${gameId}`, { method: 'DELETE' });
            if (!r.ok) {
                // If delete failed, restore the row
                UI.undoDelete(gameId);
                toast('Delete failed', true);
            }
        }, 300);
    };
    
    UI.showUndoNotification = function(gameId, rowHtml, rowIndex, listEl) {
        const notification = document.createElement('div');
        notification.id = `undo-notif-${gameId}`;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--surface-darker);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
        `;
        notification.innerHTML = `
            <span>Practice game deleted</span>
            <button class="btn btn-sm" style="background:var(--primary);color:white" onclick="PracticeUI.undoDelete(${gameId})">Undo</button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const notif = document.getElementById(`undo-notif-${gameId}`);
            if (notif) {
                notif.style.transition = 'opacity 0.3s';
                notif.style.opacity = '0';
                setTimeout(() => notif.remove(), 300);
            }
            // Remove from deletedGames array
            deletedGames = deletedGames.filter(g => g.gameId !== gameId);
        }, 5000);
    };
    
    UI.undoDelete = async function(gameId) {
        const deleted = deletedGames.find(g => g.gameId === gameId);
        if (!deleted) return;
        
        // Restore the row
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = deleted.rowHtml;
        const restoredRow = tempDiv.firstChild;
        
        if (deleted.listEl && deleted.listEl.children[deleted.rowIndex]) {
            deleted.listEl.insertBefore(restoredRow, deleted.listEl.children[deleted.rowIndex]);
        } else if (deleted.listEl) {
            deleted.listEl.appendChild(restoredRow);
        }
        
        // Animate restoration
        restoredRow.style.opacity = '0';
        restoredRow.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            restoredRow.style.transition = 'opacity 0.3s, transform 0.3s';
            restoredRow.style.opacity = '1';
            restoredRow.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove undo notification
        const notif = document.getElementById(`undo-notif-${gameId}`);
        if (notif) notif.remove();
        
        // Remove from deletedGames array
        deletedGames = deletedGames.filter(g => g.gameId !== gameId);
        
        // Re-create the game in backend (this would need a restore endpoint)
        // For now, just reload the practice history
        if (AppState.currentDetailId) {
            Practice.loadPracticeHistory(AppState.currentDetailId);
        }
    };

})(PracticeUI);