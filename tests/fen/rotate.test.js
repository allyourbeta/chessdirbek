#!/usr/bin/env node
/**
 * FenActions.rotateFen180 tests - plain Node assertions.
 * Tests the pure 180° FEN rotation used by the Flip-FEN button to correct
 * boards captured from the wrong side (e.g. a Black-perspective screenshot run
 * through an OCR/FEN site that assumed White-on-bottom).
 */

const assert = require('assert');

// Provide the window global the module attaches to (same pattern as engine tests).
global.window = {};
global.navigator = {};

// Load the module (attaches to global.window.FenActions).
require('../../frontend/js/fen-actions.js');

const { rotateFen180 } = global.window.FenActions._test;

// 1. Real fixture: the exact Black-perspective capture Ashish provided, board-only.
//    180° rotation must produce the canonical position; shape stays board-only.
console.log('Testing real capture fixture...');
const captured = '3RR1K1/1P1Q2P1/1PP1N2P/4b2p/2b1B3/3p2q1/1pp3p1/r2k1r2';
const canonical = '2r1k2r/1p3pp1/1q2p3/3B1b2/p2b4/P2N1PP1/1P2Q1P1/1K1RR3';
assert.strictEqual(rotateFen180(captured), canonical);
console.log('\u2713 fixture rotates to canonical (board-only shape preserved)');

// 2. Reversibility: rotating twice restores the original (the OCR error is its
//    own inverse, so the button is a safe toggle).
console.log('Testing reversibility...');
assert.strictEqual(rotateFen180(rotateFen180(captured)), captured);
const startBoard = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
assert.strictEqual(rotateFen180(rotateFen180(startBoard)), startBoard);
console.log('\u2713 rotateFen180 is its own inverse');

// 3. Start position rotates to the king/queen-mirrored layout (sanity on file reversal).
console.log('Testing start-position rotation...');
assert.strictEqual(
    rotateFen180(startBoard),
    'RNBKQBNR/PPPPPPPP/8/8/8/8/pppppppp/rnbkqbnr'
);
console.log('\u2713 start position rotates correctly (files reversed, colors unchanged)');

// 4. Full FEN: side-to-move preserved; castling + en-passant reset to '-';
//    move counters preserved; output stays full-length.
console.log('Testing full-FEN field handling...');
const full = rotateFen180('r1bqk2r/pppp1ppp/2n2n2/8/8/2N2N2/PPPP1PPP/R1BQK2R w KQkq e3 5 12');
const parts = full.split(' ');
assert.strictEqual(parts.length, 6);
assert.strictEqual(parts[1], 'w', 'side-to-move preserved');
assert.strictEqual(parts[2], '-', 'castling reset');
assert.strictEqual(parts[3], '-', 'en-passant reset');
assert.strictEqual(parts[4], '5', 'halfmove preserved');
assert.strictEqual(parts[5], '12', 'fullmove preserved');

// Black-to-move token is preserved too.
assert.strictEqual(rotateFen180('8/8/8/8/8/8/8/4K2k b - - 0 1').split(' ')[1], 'b');
console.log('\u2713 full-FEN side/castling/ep/counters handled correctly');

// 5. Piece colors are never swapped during rotation.
console.log('Testing color preservation...');
const before = captured;
const after = rotateFen180(before);
const countUpper = (s) => (s.split('/').join('').match(/[A-Z]/g) || []).length;
const countLower = (s) => (s.split('/').join('').match(/[a-z]/g) || []).length;
assert.strictEqual(countUpper(after), countUpper(before), 'white piece count unchanged');
assert.strictEqual(countLower(after), countLower(before), 'black piece count unchanged');
console.log('\u2713 piece colors preserved');

// 6. Malformed / non-board input returns null (callers must not silently no-op).
console.log('Testing rejection of bad input...');
assert.strictEqual(rotateFen180(''), null);
assert.strictEqual(rotateFen180(null), null);
assert.strictEqual(rotateFen180(undefined), null);
assert.strictEqual(rotateFen180('not a fen'), null);
assert.strictEqual(rotateFen180('8/8/8 w - - 0 1'), null, '3-rank board rejected');
assert.strictEqual(rotateFen180('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w - - 0 1'), null, '7-rank board rejected');
assert.strictEqual(rotateFen180('rnbqkbn/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'), null, 'short rank rejected');
console.log('\u2713 malformed input returns null');

console.log('\n\u2705 All rotateFen180 tests passed!');
