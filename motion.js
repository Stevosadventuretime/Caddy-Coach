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
let pressed = null, lastTap = null;
function release() { if (pressed) { pressed.classList.remove('is-pressed'); pressed.style.removeProperty('--press'); pressed = null; } }
document.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const el = e.target.closest && e.target.closest(PRESSABLE);
  if (!el || el.getAttribute('aria-disabled') === 'true') return;
  release();
  pressed = el;
  try { lastTap = { el: el, t: Date.now(), r: el.getBoundingClientRect() }; } catch (_) {}
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

// ---- tab bar: one green marker that slides to the current tab
window.ccTabInd = function () {
  try {
    const bar = document.querySelector('#tabbar .in'); if (!bar) return;
    let ind = bar.querySelector('.tabInd'), fresh = false;
    if (!ind) { ind = document.createElement('span'); ind.className = 'tabInd'; ind.setAttribute('aria-hidden', 'true'); bar.appendChild(ind); fresh = true; }
    const b = bar.querySelector('[data-grp][aria-current="page"]');
    if (!b || !b.offsetWidth) { ind.style.opacity = '0'; return; }
    if (fresh || ind.style.opacity === '0') ind.style.transition = 'none';
    ind.style.opacity = '1';
    ind.style.width = b.offsetWidth + 'px';
    ind.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    if (ind.style.transition === 'none') { ind.getBoundingClientRect(); ind.style.transition = ''; }
  } catch (_) {}
};
let rz = 0;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const i = document.querySelector('.tabInd'); if (i) { i.style.opacity = '0'; } window.ccTabInd(); }, 120); });

// ---- small pop on a tapped icon
window.ccPop = function (el) {
  try { if (el && el.animate && !still()) el.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: S.bouncy.ms, easing: S.bouncy.e }); } catch (_) {}
};

// ---- a page arriving: slides in from the side you're heading towards (dir 1 = from the right, -1 = from the left)
// a big card tapped on Home grows to fill the screen, then fades away over the page it opened
function growFrom(tap, page) {
  const src = tap.el, r = tap.r, cs = getComputedStyle(src);
  let bg = cs.backgroundColor;
  if (!bg || bg === 'transparent' || /rgba\(.*,\s*0\)$/.test(bg)) bg = getComputedStyle(document.body).backgroundColor;
  const W = innerWidth, H = innerHeight, rad = cs.borderTopLeftRadius || '16px';
  const ov = document.createElement('div');
  ov.className = 'ccGrow'; ov.setAttribute('aria-hidden', 'true'); ov.style.background = bg;
  document.body.appendChild(ov);
  const from = 'inset(' + Math.max(0, r.top) + 'px ' + Math.max(0, W - r.right) + 'px ' + Math.max(0, H - r.bottom) + 'px ' + Math.max(0, r.left) + 'px round ' + rad + ')';
  const grow = ov.animate([{ clipPath: from }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: Math.round(S.smooth.ms * 0.8), easing: S.smooth.e, fill: 'forwards' });
  let gone = false;
  const fade = () => { if (gone) return; gone = true; const f = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }); f.onfinish = () => ov.remove(); };
  grow.onfinish = fade;
  setTimeout(fade, S.smooth.ms);
  setTimeout(() => ov.remove(), S.smooth.ms + 700);
  if (page && page.animate) page.animate([{ transform: 'scale(.98)' }, { transform: 'none' }], { duration: S.smooth.ms, easing: S.smooth.e });
}
window.ccPageIn = function (el, dir) {
  try {
    if (!el || !el.animate || still()) return;
    const tap = lastTap;
    if (tap && Date.now() - tap.t < 700 && tap.r.width >= 200 && tap.el.closest && tap.el.closest('#p0') && el.id !== 'p0') { lastTap = null; growFrom(tap, el); return; }
    const from = dir ? 'translateX(' + (dir * 28) + 'px)' : 'translateY(8px)';
    el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], { duration: S.smooth.ms, easing: S.smooth.e });
  } catch (_) {}
};

// ---- bottom sheets: rise on a spring, and drag down (or flick) to close
window.ccSheetIn = function (sheet, scrim) {
  try {
    if (!sheet || !sheet.animate || still()) return;
    sheet.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: S.sheet.ms, easing: S.sheet.e });
    if (scrim && scrim.animate) scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
  } catch (_) {}
};
window.ccDragClose = function (sheet, onClose, handle) {
  try {
    if (!sheet || sheet.dataset.ccDrag) return;
    sheet.dataset.ccDrag = '1';
    const grip = handle || sheet;
    let y0 = 0, y = 0, drag = false, moved = false, pts = [];
    grip.addEventListener('pointerdown', e => {
      if (e.button > 0 || (!handle && e.target.closest('input,textarea,select,[contenteditable]'))) return;
      drag = true; moved = false; y0 = e.clientY; y = 0; pts = [[e.clientY, e.timeStamp]];
    }, { passive: true });
    grip.addEventListener('pointermove', e => {
      if (!drag) return;
      const dy = e.clientY - y0;
      if (!moved) {
        if (dy > 8) { moved = true; sheet.style.transition = 'none'; release(); try { grip.setPointerCapture(e.pointerId); } catch (_) {} }
        else if (dy < -8) { drag = false; return; }
        else return;
      }
      y = Math.max(0, dy);
      sheet.style.transform = 'translateY(' + y + 'px)';
      pts.push([e.clientY, e.timeStamp]); if (pts.length > 5) pts.shift();
    });
    const end = () => {
      if (!drag) return; drag = false;
      if (!moved) return;
      const a = pts[0], b = pts[pts.length - 1], v = (b[0] - a[0]) / Math.max(1, b[1] - a[1]);
      if (y > 90 || v > 0.5) {
        const h = sheet.offsetHeight + 20;
        const an = sheet.animate([{ transform: 'translateY(' + y + 'px)' }, { transform: 'translateY(' + h + 'px)' }], { duration: still() ? 1 : 200, easing: 'ease-in', fill: 'forwards' });
        let done = false;
        const fin = () => { if (done) return; done = true; try { onClose(); } catch (_) {} };
        an.onfinish = fin;
        setTimeout(fin, 320);
      } else {
        sheet.style.transition = still() ? 'none' : 'transform ' + S.sheet.ms + 'ms ' + S.sheet.e;
        sheet.style.transform = '';
        setTimeout(() => { sheet.style.transition = ''; }, S.sheet.ms);
      }
      setTimeout(() => { moved = false; }, 0);
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    sheet.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);
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
