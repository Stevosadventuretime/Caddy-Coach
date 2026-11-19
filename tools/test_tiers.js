// What each plan includes (tiers.js): everything open while payments are off; Free/Plus/Pro otherwise.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../tiers.js');
const NOW = Date.parse('2026-11-19T12:00:00Z');
const on = { switchOn: true, now: NOW };

test('while the switch is off everyone gets everything', () => {
  assert.strictEqual(T.tierFor(null, { switchOn: false }), 'pro');
  for (const f of Object.keys(T.FEATURES)) assert.ok(T.can(T.tierFor(null, {}), f), f);
});

test('the app owner and the in-Claude version are always Pro', () => {
  assert.strictEqual(T.tierFor(null, { ...on, owner: true }), 'pro');
  assert.strictEqual(T.tierFor(null, { ...on, hostedInClaude: true }), 'pro');
});

test('free limits and features', () => {
  const t = T.tierFor(null, on);
  assert.strictEqual(t, 'free');
  assert.strictEqual(T.limit(t, 'swingsPerMonth'), 3);
  assert.strictEqual(T.limit(t, 'coachPerDay'), 5);
  assert.ok(T.can(t, 'rounds') && T.can(t, 'friends') && T.can(t, 'coach'));
  assert.ok(!T.can(t, 'progress') && !T.can(t, 'reportFull') && !T.can(t, 'reference'));
});

test('Plus and Pro get the right features', () => {
  const plus = T.tierFor({ plan: 'plus', status: 'active' }, on), pro = T.tierFor({ plan: 'pro', status: 'trialing' }, on);
  assert.deepStrictEqual([plus, pro], ['plus', 'pro']);
  assert.ok(T.can(plus, 'progress') && T.can(plus, 'trace') && !T.can(plus, 'reference'));
  assert.ok(T.can(pro, 'reference') && T.can(pro, 'progress'));
  assert.strictEqual(T.limit(plus, 'coachPerDay'), Infinity);
});

test('lapsed subscriptions get 3 days of grace, unknown plans fall back to Free', () => {
  const end = d => new Date(NOW - d * 864e5).toISOString();
  assert.strictEqual(T.tierFor({ plan: 'plus', status: 'active', current_period_end: end(2) }, on), 'plus');
  assert.strictEqual(T.tierFor({ plan: 'plus', status: 'active', current_period_end: end(4) }, on), 'free');
  assert.strictEqual(T.tierFor({ plan: 'gold', status: 'active' }, on), 'free');
  assert.strictEqual(T.tierFor({ plan: 'plus', status: 'canceled' }, on), 'free');
  assert.strictEqual(T.tierFor({ plan: 'plus_yearly', status: 'active' }, on), 'plus');
  assert.strictEqual(T.tierFor({ plan: 'year', status: 'active' }, on), 'plus', 'what the payment webhook writes today');
});
