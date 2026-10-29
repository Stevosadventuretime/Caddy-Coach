// node --test test_perf.js — the drill player's adaptive resolution
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const SITE = process.env.SITE || path.join(__dirname, '..', '..', '..') + '/';
const ctx = { THREE: null, console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(SITE + 'drillstudio.js', 'utf8'), ctx);
const D = ctx.DrillStudio, n = (v, k) => Array(k || 45).fill(v);
test('60 fps is not slow', () => assert.strictEqual(D.slowFrames(n(16.7)), false));
test('30 fps is slow', () => assert.strictEqual(D.slowFrames(n(33.3)), true));
test('a few hitches in smooth play are not slow', () => assert.strictEqual(D.slowFrames(n(16.7, 40).concat(n(90, 5))), false));
test('starts at full resolution with a floor of 0.7', () => { assert.strictEqual(D.QUAL.s, 1); assert.strictEqual(D.QUAL.min, 0.7); });
