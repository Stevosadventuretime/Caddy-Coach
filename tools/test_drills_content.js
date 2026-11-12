// node --test tools/test_drills_content.js — the written coaching in drills.js
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const SITE = path.join(__dirname, '..') + '/';
const ctx = { THREE: null, console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(SITE + 'drillstudio.js', 'utf8'), ctx); vm.runInContext(fs.readFileSync(SITE + 'drills.js', 'utf8'), ctx);
const L = ctx.DRILL_LIBRARY, done = L.filter(d => d.fault);
const text = d => JSON.stringify([d.name, d.aim, d.fault, d.why, d.kit, d.kitAlt, d.setup, d.steps, d.feel, d.sense, d.mistakes, d.rx, d.success, d.progress, d.note, d.seq.map(k => [k.lab, k.badge, k.say])]);
test('rewritten drills have the full coaching structure', () => {
  assert.ok(done.length >= 5, 'benchmark drills ' + done.length);
  for (const d of done) {
    for (const f of ['aim', 'cat', 'level', 'fault', 'why', 'kit', 'kitAlt', 'setup', 'sense', 'rx', 'note']) assert.ok(d[f], d.id + ' has ' + f);
    assert.ok(['setup', 'grip', 'backswing', 'transition', 'downswing', 'impact', 'finish'].includes(d.cat), d.id + ' category');
    assert.strictEqual(d.feel.length, d.steps.length, d.id + ' one feel per step');
    assert.ok(d.mistakes.every(m => Array.isArray(m) && m.length === 2), d.id + ' mistakes come with their fix');
    assert.ok(d.success.length >= 2 && d.progress.length >= 2, d.id + ' success checks and progression');
    assert.ok(!d.by, d.id + ' no attribution line');
    const steps = new Set(d.seq.map(k => k.step)); for (let i = 0; i < d.steps.length; i++) assert.ok(steps.has(i), d.id + ' demo shows step ' + (i + 1));
    assert.ok(d.seq.some(k => k.ghost || (k.badge && k.badge.tone === 'bad')), d.id + ' shows the wrong version');
  }
});
test('no endorsements or unsourced statistics', () => {
  for (const d of done) { const t = text(d);
    assert.ok(!/\b(uses this|used this|teaches this|tour players (all|always)|\d+ in \d+ (amateurs|golfers)|\d+\s?%)/i.test(t), d.id + ' claim');
    assert.ok(!/\b(Tiger|Rory|McIlroy|Scheffler|Morikawa|Harmon|Sorenstam|Cowen|Player|Jacobsen|Bender|Thurm|Yarwood|Proudman|Stone|Como|Curdt|Els|Johnson)\b/.test(t), d.id + ' names a player or coach'); }
});
