#!/usr/bin/env node
/**
 * forceFenSideToMove tests - plain Node assertions.
 * This is the helper the detail "Lichess" button uses to ensure a board-only
 * FEN (no turn field — common from OCR/FEN sites) is completed with the correct
 * side-to-move before being handed to Lichess, which otherwise defaults to White.
 */

const assert = require('assert');

// fen-utils.js attaches to `window` and also exports via module.exports.
global.window = {};

const { forceFenSideToMove } = require('../../frontend/js/fen-utils.js');

// 1. Board-only FEN + black to move → completed 6-field FEN with a 'b' token.
//    (The real Black-perspective capture, post-rotation, is board-only.)
console.log('Testing board-only completion (black to move)...');
const boardOnly = '2r1k2r/1p3pp1/1q2p3/3B1b2/p2b4/P2N1PP1/1P2Q1P1/1K1RR3';
assert.strictEqual(
    forceFenSideToMove(boardOnly, 'black'),
    boardOnly + ' b - - 0 1'
);
console.log('\u2713 board-only + black → "... b - - 0 1"');

// 2. Board-only + white to move → 'w' token.
console.log('Testing board-only completion (white to move)...');
assert.strictEqual(
    forceFenSideToMove(boardOnly, 'white'),
    boardOnly + ' w - - 0 1'
);
console.log('\u2713 board-only + white → "... w - - 0 1"');

// 3. A full FEN already carrying a turn token gets that token overridden to match
//    the requested color (the orientation is the source of truth at click time),
//    while the other fields are preserved.
console.log('Testing override of existing turn token...');
const full = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 4 9';
assert.strictEqual(
    forceFenSideToMove(full, 'black'),
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 4 9'
);
console.log('\u2713 existing turn token overridden, other fields preserved');

// 4. Idempotent for the matching color.
console.log('Testing idempotency...');
const once = forceFenSideToMove(boardOnly, 'black');
assert.strictEqual(forceFenSideToMove(once, 'black'), once);
console.log('\u2713 re-applying the same color is a no-op');

console.log('\n\u2705 All forceFenSideToMove tests passed!');
