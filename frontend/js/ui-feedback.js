/**
 * Transient UI feedback: toasts, button loading state, the top banner, and the
 * prominent notification. Extracted from shared.js as a leaf-level concern with
 * no dependency on routing or app state. All functions are page globals (classic
 * script), and the cross-file ones are also assigned to window for clarity.
 */
function toast(msg, type, duration) {
    var cls = 'toast';
    if (type === true || type === 'error') cls += ' error';
    else if (type === 'warn') cls += ' warn';
    var ms = duration || (type === 'error' || type === true ? 5000 : 3000);
    var el = document.createElement('div');
    el.className = cls;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, ms);
}
function setButtonLoading(btn, loading = true) {
    if (!btn) return;
    if (loading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        // SAFE_INNER_HTML: Static template with controlled button content
        btn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite;width:16px;height:16px;border:2px solid var(--border);border-top:2px solid currentColor;border-radius:50%;vertical-align:middle"></span> ' + btn.textContent;
    } else {
        btn.disabled = false;
        if (btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
            delete btn.dataset.originalText;
        }
    }
}
function topBanner(msg, duration = 3000) {
    const banner = document.getElementById('notification-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.style.display = 'block';
    banner.style.background = 'var(--bg-secondary)';
    banner.style.color = 'var(--text)';
    banner.style.border = '1px solid var(--border)';
    if (duration > 0) {
        setTimeout(() => {
            banner.style.display = 'none';
        }, duration);
    }
}
let notificationTimeout = null;
function showProminentNotification(msg, type = 'info', minDuration = 3000) {
    const banner = document.getElementById('notification-banner');
    if (!banner) return;
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
    
    banner.textContent = msg;
    banner.style.display = 'block';
    if (type === 'accept' || type === 'success') {
        banner.style.background = '#10b981';
        banner.style.color = 'white';
        banner.style.border = 'none';
    } else if (type === 'decline' || type === 'warning') {
        banner.style.background = '#f59e0b';
        banner.style.color = 'white';
        banner.style.border = 'none';
    } else {
        banner.style.background = 'var(--bg-secondary)';
        banner.style.color = 'var(--text)';
        banner.style.border = '1px solid var(--border)';
    }
    if (minDuration >= 3000) {
        // SAFE_INNER_HTML: Template with escaped message content
        banner.innerHTML = Html.escape(msg) + ' <button data-action="hide-notification" style="margin-left:16px;padding:4px 8px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:inherit;cursor:pointer">Dismiss</button>';
    }
    if (minDuration > 0) {
        notificationTimeout = setTimeout(() => {
            banner.style.display = 'none';
            notificationTimeout = null;
        }, minDuration);
    }
}
function hideProminentNotification() {
    const banner = document.getElementById('notification-banner');
    if (banner) banner.style.display = 'none';
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
}

window.toast = toast;
window.setButtonLoading = setButtonLoading;
window.topBanner = topBanner;
window.showProminentNotification = showProminentNotification;
window.hideProminentNotification = hideProminentNotification;
