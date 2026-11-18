// Caddy Coach motion kit: spring timings, instant button press feedback and haptics.
// Loaded before app-1.js. Springs follow Apple's duration + bounce model and become CSS linear() easings.
(function () {
'use strict';
const root = document.documentElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)');

// ---- springs -> CSS custom properties (--sp-snappy, --sp-snappy-ms, --sp-smooth, --sp-smooth-ms)
function spring(d, b) {
  const w = 2 * Math.PI / d, z = b >= 0 ? 1 - b : 1 / (1 + b), T = d * 1.3, n = 40, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = T * i / n;
    let x;
    if (z < 1) { const wd = w * Math.sqrt(1 - z * z); x = 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); }
    else x = 1 - Math.exp(-w * t) * (1 + w * t);
    pts.push(+x.toFixed(4));
  }
  pts[n] = 1;
  return { e: 'linear(' + pts.join(',') + ')', ms: Math.round(T * 1000) };
}
const SPRINGS = { snappy: [0.35, 0.15], smooth: [0.5, 0], bouncy: [0.5, 0.32], sheet: [0.45, 0.08] };
const FALLBACK = { snappy: ['cubic-bezier(.2,.9,.25,1.1)', 420], smooth: ['cubic-bezier(.2,.8,.2,1)', 600], bouncy: ['cubic-bezier(.3,1.5,.5,1)', 600], sheet: ['cubic-bezier(.2,.9,.25,1.05)', 560] };
const S = {};
let LINEAR = false;
try { LINEAR = !!(window.CSS && CSS.supports('transition-timing-function', 'linear(0, 1)')); } catch (_) {}
for (const k in SPRINGS) {
  S[k] = LINEAR ? spring(SPRINGS[k][0], SPRINGS[k][1]) : { e: FALLBACK[k][0], ms: FALLBACK[k][1] };
  if (LINEAR) { root.style.setProperty('--sp-' + k, S[k].e); root.style.setProperty('--sp-' + k + '-ms', S[k].ms + 'ms'); }
}
window.ccSpring = S;
const still = () => RM.matches;

// ---- press feedback: mark the button the moment a finger lands, before any click handler runs
const PRESSABLE = 'button:not(:disabled),.btn';
let pressed = null;
function release() { if (pressed) { pressed.classList.remove('is-pressed'); pressed.style.removeProperty('--press'); pressed = null; } }
document.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const el = e.target.closest && e.target.closest(PRESSABLE);
  if (!el || el.getAttribute('aria-disabled') === 'true') return;
  release();
  pressed = el;
  if (el.offsetWidth > 240 && !el.style.getPropertyValue('--press')) el.style.setProperty('--press', '.975');
  el.classList.add('is-pressed');
}, { passive: true, capture: true });
['pointerup', 'pointercancel', 'dragstart'].forEach(t => document.addEventListener(t, release, { passive: true, capture: true }));
window.addEventListener('blur', release);
document.addEventListener('scroll', release, { passive: true, capture: true });

// ---- haptics: Android via vibrate, iPhone Safari 17.4+ via the native switch control. Best effort only.
let hap = null;
function switchEl() {
  if (hap || !document.body) return hap;
  const l = document.createElement('label'), i = document.createElement('input');
  i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
  l.setAttribute('aria-hidden', 'true');
  l.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
  l.appendChild(i);
  const stop = e => e.stopPropagation();
  l.addEventListener('click', stop); i.addEventListener('click', stop);
  document.body.appendChild(l);
  return (hap = l);
}
function iosTap() {
  const l = switchEl(); if (!l) return;
  const a = document.activeElement;
  l.click();
  if (a && a !== document.activeElement && a.focus) try { a.focus({ preventScroll: true }); } catch (_) {}
}
window.ccHaptic = function (kind) {
  try {
    if (RM.matches) return;
    if (navigator.vibrate) {
      const ua = navigator.userActivation;
      if (!ua || ua.isActive) navigator.vibrate(kind === 'success' ? [10, 60, 14] : 8);
      return;
    }
    iosTap();
    if (kind === 'success') setTimeout(iosTap, 110);
  } catch (_) {}
};

// ---- rolling numbers: digits roll from the last value shown under the same key, like a scoreboard
const LAST = {};
window.ccRoll = function (el, key) {
  try {
    if (!el) return;
    const to = el.textContent.trim(), from = LAST[key];
    LAST[key] = to;
    if (still() || from == null || from === to || !/^\d+$/.test(to) || !/^\d+$/.test(from) || from.length !== to.length) return;
    const H = el.getBoundingClientRect().height;
    if (!H) return;
    const color = getComputedStyle(el).color;
    el.classList.add('ccRolling');
    const o = document.createElement('span');
    o.className = 'ccOdo'; o.setAttribute('aria-hidden', 'true'); o.style.color = color;
    const cols = [...to].map((d, i) => {
      const c = document.createElement('span');
      c.className = 'ccOdoC';
      for (let k = 0; k < 10; k++) { const s = document.createElement('span'); s.textContent = k; s.style.height = s.style.lineHeight = H + 'px'; c.appendChild(s); }
      c.style.transform = 'translateY(' + (-from[i] * H) + 'px)';
      o.appendChild(c);
      return c;
    });
    el.appendChild(o);
    o.getBoundingClientRect();
    cols.forEach((c, i) => {
      c.style.transition = 'transform ' + S.smooth.ms + 'ms ' + S.smooth.e + ' ' + (cols.length - 1 - i) * 30 + 'ms';
      c.style.transform = 'translateY(' + (-to[i] * H) + 'px)';
    });
    setTimeout(() => { o.remove(); el.classList.remove('ccRolling'); }, S.smooth.ms + cols.length * 30 + 60);
  } catch (_) {}
};

// ---- progress rings (CSS --p from 0 to 1): fill from the last value, or from empty the first time each launch
const RING = {};
let propOK = false;
try { if (window.CSS && CSS.registerProperty) { CSS.registerProperty({ name: '--p', syntax: '<number>', inherits: false, initialValue: '0' }); propOK = true; } } catch (_) { propOK = true; }
window.ccRing = function (el, key) {
  try {
    if (!el) return;
    const to = parseFloat(el.style.getPropertyValue('--p') || getComputedStyle(el).getPropertyValue('--p')) || 0;
    const seen = key in RING, from = seen ? RING[key] : 0;
    RING[key] = to;
    if (still() || from === to || !propOK || !el.animate) return;
    el.animate([{ '--p': from }, { '--p': to }], { duration: Math.round(S.smooth.ms * 1.6), easing: S.smooth.e });
    if (to >= 1 && from < 1 && seen) {
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 520, delay: Math.round(S.smooth.ms * 1.2), easing: 'cubic-bezier(.3,1.4,.5,1)' });
      setTimeout(() => window.ccHaptic('success'), Math.round(S.smooth.ms * 1.2));
    }
  } catch (_) {}
};
})();
