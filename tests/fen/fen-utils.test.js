#!/usr/bin/env node
/**
 * fen-utils tests — covers the pure FEN primitives consolidated into
 * frontend/js/fen-utils.js (side-to-move reading, orientation mapping, and the
 * sanitize/complete pipeline). loadChessFromBoardFen needs the global `Chess`
 * and is exercised by the in-app analysis flow, so it's not unit-tested here.
 */

const assert = require('assert');

global.window = {};
const F = require('../../frontend/js/fen-utils.js');

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

console.log('normalizeFen collapses whitespace...');
assert.strictEqual(F.normalizeFen('  8/8/8/8/8/8/8/8   w  -  -  0 1 '), '8/8/8/8/8/8/8/8 w - - 0 1');
console.log('\u2713 normalizeFen');

console.log('getSideToMove / getSideToMoveColor...');
assert.strictEqual(F.getSideToMove(START), 'w');
assert.strictEqual(F.getSideToMove('8/8/8/8/8/8/8/8 b - - 0 1'), 'b');
assert.strictEqual(F.getSideToMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'), 'w'); // board-only defaults to w
assert.strictEqual(F.getSideToMoveColor('8/8/8/8/8/8/8/8 b - - 0 1'), 'black');
assert.strictEqual(F.getSideToMoveColor(START), 'white');
console.log('\u2713 side-to-move helpers');

console.log('sideFromOrientation...');
assert.strictEqual(F.sideFromOrientation('black'), 'b');
assert.strictEqual(F.sideFromOrientation('white'), 'w');
assert.strictEqual(F.sideFromOrientation(undefined), 'w');
console.log('\u2713 sideFromOrientation');

console.log('completeAndSanitizeFen completes a board-only FEN...');
assert.strictEqual(
    F.completeAndSanitizeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'),
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
);
console.log('\u2713 completeAndSanitizeFen (board-only)');

console.log('sanitizeCastlingRights drops rights the placement cannot support...');
// Starting placement supports all four; an empty board supports none.
assert.strictEqual(F.sanitizeCastlingRights('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', 'KQkq'), 'KQkq');
assert.strictEqual(F.sanitizeCastlingRights('8/8/8/8/8/8/8/8', 'KQkq'), '-');
// King on e1 + rook on h1 only → just 'K'.
assert.strictEqual(F.sanitizeCastlingRights('8/8/8/8/8/8/8/4K2R', 'KQ'), 'K');
console.log('\u2713 sanitizeCastlingRights');

console.log('sanitizeEnPassant keeps only legal target squares...');
assert.strictEqual(F.sanitizeEnPassant('e3'), 'e3');
assert.strictEqual(F.sanitizeEnPassant('e6'), 'e6');
assert.strictEqual(F.sanitizeEnPassant('e4'), '-'); // not a 3rd/6th-rank square
assert.strictEqual(F.sanitizeEnPassant(''), '-');
console.log('\u2713 sanitizeEnPassant');

console.log('completeAndSanitizeFen scrubs an impossible castling field...');
assert.strictEqual(
    F.completeAndSanitizeFen('8/8/8/8/8/8/8/8 w KQkq e4 0 1'),
    '8/8/8/8/8/8/8/8 w - - 0 1'
);
console.log('\u2713 completeAndSanitizeFen (scrub)');

console.log('\n\u2705 All fen-utils tests passed!');
