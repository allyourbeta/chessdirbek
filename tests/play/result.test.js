#!/usr/bin/env node
/**
 * play-result tests — the pure engine-game result rules extracted from play.js:
 * computeNaturalResult (from a finished game) and resultForOutcome (manual
 * end-game marking). saveEngineGame hits the API and is not unit-tested here.
 */

const assert = require('assert');
const PlayResult = require('../../frontend/js/play-result.js');

// Minimal fake chess.js game: only the terminal predicates result logic reads.
function fakeGame(flags) {
    const f = flags || {};
    return {
        turn: () => f.turn || 'w',
        in_checkmate: () => !!f.checkmate,
        in_stalemate: () => !!f.stalemate,
        in_threefold_repetition: () => !!f.threefold,
        insufficient_material: () => !!f.insufficient,
        in_draw: () => !!f.draw
    };
}

console.log('computeNaturalResult: checkmate maps to the side that delivered it...');
// Black to move and mated → White delivered mate → "1-0".
assert.deepStrictEqual(
    PlayResult.computeNaturalResult(fakeGame({ checkmate: true, turn: 'b' })),
    { result: '1-0', outcome: 'checkmate' }
);
// White to move and mated → "0-1".
assert.deepStrictEqual(
    PlayResult.computeNaturalResult(fakeGame({ checkmate: true, turn: 'w' })),
    { result: '0-1', outcome: 'checkmate' }
);
console.log('\u2713 checkmate → winner by side to move');

console.log('computeNaturalResult: draw variants...');
assert.deepStrictEqual(PlayResult.computeNaturalResult(fakeGame({ stalemate: true })), { result: '1/2-1/2', outcome: 'stalemate' });
assert.deepStrictEqual(PlayResult.computeNaturalResult(fakeGame({ threefold: true })), { result: '1/2-1/2', outcome: 'threefold' });
assert.deepStrictEqual(PlayResult.computeNaturalResult(fakeGame({ insufficient: true })), { result: '1/2-1/2', outcome: 'insufficient' });
assert.deepStrictEqual(PlayResult.computeNaturalResult(fakeGame({ draw: true })), { result: '1/2-1/2', outcome: 'fifty-move' });
console.log('\u2713 stalemate / threefold / insufficient / fifty-move');

console.log('computeNaturalResult: not over → unresolved...');
assert.deepStrictEqual(PlayResult.computeNaturalResult(fakeGame({})), { result: '*', outcome: null });
console.log('\u2713 ongoing game → "*"');

console.log('resultForOutcome: manual marks are from the user POV...');
assert.deepStrictEqual(PlayResult.resultForOutcome('win', 'white'),  { result: '1-0', outcome: 'manual' });
assert.deepStrictEqual(PlayResult.resultForOutcome('win', 'black'),  { result: '0-1', outcome: 'manual' });
assert.deepStrictEqual(PlayResult.resultForOutcome('loss', 'white'), { result: '0-1', outcome: 'manual' });
assert.deepStrictEqual(PlayResult.resultForOutcome('loss', 'black'), { result: '1-0', outcome: 'manual' });
assert.deepStrictEqual(PlayResult.resultForOutcome('draw', 'white'), { result: '1/2-1/2', outcome: 'manual' });
assert.deepStrictEqual(PlayResult.resultForOutcome('unfinished', 'white'), { result: '*', outcome: 'unfinished' });
assert.deepStrictEqual(PlayResult.resultForOutcome('anything-else', 'black'), { result: '*', outcome: 'unfinished' });
console.log('\u2713 win/loss/draw/unfinished mapping');

// FenUtils.preparePlayableFen needs the global Chess; verify it at least exists
// and is wired through (full behavior is covered by in-app play + fen-utils tests).
global.window = {};
const FenUtils = require('../../frontend/js/fen-utils.js');
assert.strictEqual(typeof FenUtils.preparePlayableFen, 'function', 'preparePlayableFen should be on FenUtils');
console.log('\u2713 FenUtils.preparePlayableFen is exported');

console.log('\n\u2705 All play-result tests passed!');
