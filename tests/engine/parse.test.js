#!/usr/bin/env node
/**
 * Engine module parser tests - plain Node assertions
 * Tests the pure UCI parsing/normalization logic
 */

const assert = require('assert');

// Mock the window object before requiring engine.js
global.window = {};

// Load the engine module (will attach to global.window)
require('../../frontend/js/engine.js');

// Get the test exports
const { parseBestMove, parseInfoLine, normalizeScore } = global.window.Engine._test;

// Test parseBestMove
console.log('Testing parseBestMove...');

const bestMoveResult1 = parseBestMove('bestmove e2e4 ponder e7e5');
assert.deepStrictEqual(bestMoveResult1, { bestMove: 'e2e4', ponder: 'e7e5' });

const bestMoveResult2 = parseBestMove('bestmove d7d8q');
assert.deepStrictEqual(bestMoveResult2, { bestMove: 'd7d8q', ponder: undefined });

const bestMoveResult3 = parseBestMove('bestmove (none)');
assert.deepStrictEqual(bestMoveResult3, { bestMove: null, ponder: undefined });

console.log('✓ parseBestMove tests passed');

// Test parseInfoLine
console.log('Testing parseInfoLine...');

const infoResult1 = parseInfoLine('info depth 12 seldepth 15 score cp 34 nodes 123456 pv e2e4 e7e5 g1f3');
assert.strictEqual(infoResult1.depth, 12);
assert.strictEqual(infoResult1.scoreCp, 34);
assert.strictEqual(infoResult1.mate, null);
assert.deepStrictEqual(infoResult1.pvUci, ['e2e4', 'e7e5', 'g1f3']);

const infoResult2 = parseInfoLine('info depth 8 score mate -3 pv h7h8q h1h8 g7h8');
assert.strictEqual(infoResult2.depth, 8);
assert.strictEqual(infoResult2.scoreCp, null);
assert.strictEqual(infoResult2.mate, -3);
assert.deepStrictEqual(infoResult2.pvUci, ['h7h8q', 'h1h8', 'g7h8']);

const infoResult3 = parseInfoLine('info depth 10 score cp -150 pv d2d4');
assert.strictEqual(infoResult3.depth, 10);
assert.strictEqual(infoResult3.scoreCp, -150);
assert.strictEqual(infoResult3.mate, null);
assert.deepStrictEqual(infoResult3.pvUci, ['d2d4']);

console.log('✓ parseInfoLine tests passed');

// Test normalizeScore
console.log('Testing normalizeScore...');

// Centipawn score, White to move
const normResult1 = normalizeScore({ scoreCp: 34, mate: null }, 'w');
assert.strictEqual(normResult1.scoreCp, 34);
assert.strictEqual(normResult1.mate, null);

// Centipawn score, Black to move (should negate)
const normResult2 = normalizeScore({ scoreCp: 34, mate: null }, 'b');
assert.strictEqual(normResult2.scoreCp, -34);
assert.strictEqual(normResult2.mate, null);

// Mate score, White to move
const normResult3 = normalizeScore({ scoreCp: null, mate: 3 }, 'w');
assert.strictEqual(normResult3.scoreCp, null);
assert.strictEqual(normResult3.mate, 3);

// Mate score, Black to move (should negate)
const normResult4 = normalizeScore({ scoreCp: null, mate: 3 }, 'b');
assert.strictEqual(normResult4.scoreCp, null);
assert.strictEqual(normResult4.mate, -3);

// Negative mate, Black to move
const normResult5 = normalizeScore({ scoreCp: null, mate: -2 }, 'b');
assert.strictEqual(normResult5.scoreCp, null);
assert.strictEqual(normResult5.mate, 2);

console.log('✓ normalizeScore tests passed');

console.log('\n✅ All engine parser tests passed!');