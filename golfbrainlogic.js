// Caddy Coach: My Golf Brain, the rules. Pure logic, no page code. The brain record holds only what the golfer told us
// plus the coach's own history and current focus; swings, rounds and practice are read live from the app's records.
(function (root) {
'use strict';
const DAY = 864e5;
const fmt = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function empty(now) {
  return { v: 1, updatedAt: now || Date.now(), about: { name: '', level: '', goal: '', hand: '', freq: '', conditions: '', target: '' }, history: [], focus: [], refSwing: null, planSess: {} };
}

// keep each priority's start date and status; new ones start as 'new'; at most 3
function mergeFocus(old, top, now) {
  now = now || Date.now();
  const byId = new Map((old || []).map(p => [p.id, p]));
  return (top || []).filter(t => t && t.id).slice(0, 3).map(t => {
    const was = byId.get(t.id);
    return {
      id: t.id, kind: t.kind || 'fault', title: t.title, why: t.why || '', drill: t.drill || null, area: t.area || null,
      measure: t.kind === 'area' ? `Your ${({ tee: 'fairways hit', app: 'greens in regulation', arg: 'up and downs', putt: 'putts per round' })[t.area] || 'round stats'} over your next rounds` : 'Whether it still shows up in your next 2 swings from the same angle',
      since: was ? was.since : now, status: was ? was.status : 'new',
    };
  });
}

// a priority's status from real records. ctx: { swingsSince (count of swings analysed since it started),
// lastTwo (array of the fault ids in each of the last two swings, newest first), areaBetter: {area: true} }
function statusFor(p, ctx) {
  ctx = ctx || {};
  if (p.kind === 'fault') {
    const last = ctx.lastTwo || [];
    if ((ctx.swingsSince || 0) >= 2 && last.length >= 2 && last.every(ids => !ids.includes(p.id))) return 'done';
    if ((ctx.swingsSince || 0) >= 1 && last[0] && !last[0].includes(p.id)) return 'improving';
    if ((ctx.swingsSince || 0) >= 1) return 'working';
    return p.status === 'done' ? 'done' : (p.status || 'new');
  }
  if (p.kind === 'area') return (ctx.areaBetter || {})[p.area] ? 'improving' : (ctx.roundsSince || 0) >= 1 ? 'working' : (p.status || 'new');
  return p.status || 'new';
}

// coaching history: newest first, no repeats of the same advice within a week, at most 100 entries
function logAdvice(history, e, now) {
  now = now || Date.now();
  const h = (history || []).slice();
  if (!e || !e.text) return h;
  if (h.some(x => x.text === e.text && now - x.at < 7 * DAY)) return h;
  h.unshift({ at: now, source: e.source || 'coach', text: String(e.text).slice(0, 240), ref: e.ref || null });
  return h.slice(0, 100);
}

// the last time the coach advised on something (older than a day, so it isn't just this conversation)
function lastAdvice(history, ref, now) {
  now = now || Date.now();
  return (history || []).find(x => x.ref === ref && now - x.at > DAY) || null;
}
function recallLine(history, ref, stillShowing, now) {
  const x = lastAdvice(history, ref, now); if (!x) return '';
  const what = /^Work on: /.test(x.text) ? `working on ${x.text.slice(9).replace(/\.$/, '').toLowerCase()}` : x.text.replace(/\.$/, '');
  return `On ${fmt(x.at)} I suggested${what.startsWith('working') ? ' ' : ': '}${what}. ${stillShowing ? "It's still showing up, so let's keep going with it." : 'It looks better since then.'}`;
}

// "why are you recommending this?", from the priority's own evidence
function whyFor(p) {
  if (!p) return "I'm not recommending anything specific yet, because I haven't got enough of your swings or rounds.";
  const since = p.since ? ` It's been your focus since ${fmt(p.since)}.` : '';
  if (p.kind === 'area') return `${p.title}: ${p.why.toLowerCase()} in your recorded rounds.${since} I'll watch your ${p.measure.replace(/^Your /, '').toLowerCase()} to see if it's working.`;
  return `${p.title}: ${p.why.toLowerCase()}, measured by the camera.${since} Progress is checked by ${p.measure.charAt(0).toLowerCase() + p.measure.slice(1)}.`;
}

const STATUS = { new: 'New', working: 'Working on it', improving: 'Improving', done: 'Sorted' };
const api = { empty, mergeFocus, statusFor, logAdvice, lastAdvice, recallLine, whyFor, STATUS };
if (typeof module !== 'undefined') module.exports = api; else root.GolfBrainLogic = api;
})(typeof window !== 'undefined' ? window : this);
