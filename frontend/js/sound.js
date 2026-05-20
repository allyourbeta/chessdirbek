let _audioCtx = null;

function _ensureAudioCtx() {
    if (!_audioCtx) {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return _audioCtx;
}

function playMoveSound() {
    if (AppState.soundMuted) return;
    try {
        const ctx = _ensureAudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume().then(function () { _playPip(ctx); });
            return;
        }
        _playPip(ctx);
    } catch (e) {
        console.warn('playMoveSound error:', e);
    }
}

function _playPip(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
}

function toggleMute() {
    AppState.soundMuted = !AppState.soundMuted;
    const btn = document.getElementById('mute-btn');
    if (btn) btn.innerHTML = AppState.soundMuted ? '&#x1f507;' : '&#x1f50a;';
}

window.playMoveSound = playMoveSound;
window.toggleMute = toggleMute;
