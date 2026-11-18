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
const SPRINGS = { snappy: [0.35, 0.15], smooth: [0.5, 0] };
try {
  if (window.CSS && CSS.supports('transition-timing-function', 'linear(0, 1)')) {
    for (const k in SPRINGS) {
      const s = spring(SPRINGS[k][0], SPRINGS[k][1]);
      root.style.setProperty('--sp-' + k, s.e);
      root.style.setProperty('--sp-' + k + '-ms', s.ms + 'ms');
    }
  }
} catch (_) {}

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
  if (el.offsetWidth > 240 && !el.style.getPropertyValue('--press')) el.style.setProperty('--press', '.985');
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
})();
