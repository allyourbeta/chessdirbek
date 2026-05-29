#!/usr/bin/env node
/**
 * Engine lifecycle tests using a mock Worker. Covers the three bugs fixed in
 * engine.js: search timeout (no more infinite "Engine thinking" hang), init
 * retry after a failed boot, and the stop-race (a stale bestmove from a stopped
 * search must not resolve a newer request).
 */

const assert = require('assert');

// --- Minimal mock Worker ------------------------------------------------------
// Each test installs a `script` describing how the fake engine responds to UCI
// commands. Responses are delivered asynchronously (setTimeout 0) like a real
// worker thread.
let mockScript = null;
class MockWorker {
    constructor() { this.onmessage = null; this.onerror = null; this.terminated = false; }
    postMessage(cmd) {
        if (this.terminated || !mockScript) return;
        const emit = (line) => setTimeout(() => { if (this.onmessage) this.onmessage({ data: line }); }, 0);
        mockScript(cmd, emit, this);
    }
    terminate() { this.terminated = true; }
}

global.window = {};
global.WebAssembly = {};
global.Worker = MockWorker;

require('../../frontend/js/engine.js');
const Engine = global.window.Engine;
Engine._test.setTimeouts({ initTimeoutMs: 80, searchMarginMs: 40, evalTimeoutMs: 120 });

// Standard healthy engine: boots, and answers `go` with a bestmove.
function healthyScript(bestmove) {
    return (cmd, emit) => {
        if (cmd === 'uci') emit('uciok');
        else if (cmd === 'isready') emit('readyok');
        else if (cmd.startsWith('go')) emit('bestmove ' + bestmove);
    };
}

function run() {
    return runInitRetry()
        .then(runBestMoveResolves)
        .then(runSearchTimeout)
        .then(runStopRaceDrain);
}

// 1. Init retry: first boot never sends readyok (times out); a later call with a
//    healthy engine must succeed instead of returning the cached rejection.
async function runInitRetry() {
    console.log('Testing init retry after failed boot...');
    Engine._test.reset();
    mockScript = (cmd, emit) => { if (cmd === 'uci') emit('uciok'); /* never readyok */ };
    let firstFailed = false;
    try { await Engine.init(); } catch (_) { firstFailed = true; }
    assert.ok(firstFailed, 'first init should reject on timeout');

    // Now a healthy engine — init must retry (not reuse the rejected promise).
    mockScript = healthyScript('e2e4');
    await Engine.init();
    console.log('\u2713 init retries after a failed boot');
}

// 2. bestMove resolves with the parsed move.
async function runBestMoveResolves() {
    console.log('Testing bestMove resolves...');
    Engine._test.reset();
    mockScript = healthyScript('d2d4');
    const res = await Engine.bestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', { movetimeMs: 5 });
    assert.strictEqual(res.bestMove, 'd2d4');
    console.log('\u2713 bestMove resolves with parsed move');
}

// 3. Search timeout: engine boots but never answers `go` → bestMove rejects
//    (instead of hanging forever).
async function runSearchTimeout() {
    console.log('Testing search timeout...');
    Engine._test.reset();
    mockScript = (cmd, emit) => {
        if (cmd === 'uci') emit('uciok');
        else if (cmd === 'isready') emit('readyok');
        // never responds to `go`
    };
    let timedOut = false;
    try {
        await Engine.bestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', { movetimeMs: 5 });
    } catch (e) {
        timedOut = /timed out/i.test(e.message);
    }
    assert.ok(timedOut, 'bestMove should reject on timeout');
    console.log('\u2713 search rejects on timeout (no infinite hang)');
}

// 4. Stop race: while a slow search is pending, a second bestMove is issued.
//    Stopping the first makes the engine emit a STALE bestmove; the drain
//    handshake must ignore it and resolve the second request with the new move.
async function runStopRaceDrain() {
    console.log('Testing stop-race drain...');
    Engine._test.reset();

    let phase = 0; // 0: first search pending, 1: draining, 2: second search
    mockScript = (cmd, emit, self) => {
        if (cmd === 'uci') { emit('uciok'); return; }
        if (cmd === 'isready') {
            // The drain isready: first deliver the STALE bestmove from the
            // stopped search, THEN readyok (real engine ordering).
            if (phase === 1) { emit('bestmove STALE'); }
            emit('readyok');
            if (phase === 1) phase = 2;
            return;
        }
        if (cmd === 'stop') { phase = 1; return; }
        if (cmd.startsWith('go')) {
            if (phase === 0) { /* first search: never answers on its own */ return; }
            if (phase === 2) { emit('bestmove g1f3'); }
        }
    };

    // Boot first.
    await Engine.init();
    // First search: will hang until we start the second (which stops it).
    const first = Engine.bestMove('8/8/8/8/8/8/8/8 w - - 0 1', { movetimeMs: 1000 }).catch(() => 'cancelled');
    // Give the first `go` a tick to register as currentRequest.
    await new Promise((r) => setTimeout(r, 5));
    // Second search overlaps → triggers stop + drain.
    const second = await Engine.bestMove('8/8/8/8/8/8/8/8 w - - 0 1', { movetimeMs: 5 });
    assert.strictEqual(second.bestMove, 'g1f3', 'second request must get its own move, not STALE');
    await first;
    console.log('\u2713 stale bestmove from a stopped search is ignored (drain works)');
}

run().then(() => {
    console.log('\n\u2705 All engine lifecycle tests passed!');
    process.exit(0);
}).catch((e) => {
    console.error('\u274c Engine lifecycle test failed:', e);
    process.exit(1);
});
