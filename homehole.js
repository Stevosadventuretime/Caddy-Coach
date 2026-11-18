// Caddy Coach: Home on a phone is laid over an aerial golf course, and scrolling flies down it. Only while Home shows
// on a phone (body.homeImm, set in app-4.js); everywhere else the layer is hidden. Photo: Unsplash (free licence), Bernd Dittrich.
(function () {
'use strict';
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const bg = document.createElement('div');
bg.id = 'holeBg'; bg.setAttribute('aria-hidden', 'true');
bg.innerHTML = '<img src="home-course.jpg" alt="" decoding="async">';
const shade = document.createElement('div'); shade.id = 'holeShade'; shade.setAttribute('aria-hidden', 'true');
document.body.prepend(shade); document.body.prepend(bg);

let H = 0, vh = 0, on = false;
function size() {
  vh = innerHeight; const vw = innerWidth;
  H = Math.max(vw * 16 / 9, vh * 1.75); const W = H * 9 / 16;
  bg.style.width = W + 'px'; bg.style.height = H + 'px'; bg.style.marginLeft = (-W / 2) + 'px';
  draw();
}
function draw() {
  if (!on) return;
  const max = Math.max(1, document.documentElement.scrollHeight - vh), p = Math.min(1, Math.max(0, scrollY / max));
  bg.style.transform = `translate3d(0,${(-p * (H - vh)).toFixed(1)}px,0)` + (still() ? '' : ` scale(${(1.06 - 0.06 * p).toFixed(4)})`);
}
function sync() {
  const now = document.body.classList.contains('homeImm');
  if (now !== on) { on = now; document.body.classList.toggle('homeHole', on); if (on) size(); if (typeof homeBar === 'function') homeBar(); }
  else if (on) draw();
}
let q = 0;
addEventListener('scroll', () => { if (!on || q) return; q = requestAnimationFrame(() => { q = 0; draw(); }); }, { passive: true });
addEventListener('resize', () => { if (on) size(); });

// follow app-4.js: Home on a phone switches the course on, any other page switches it off
if (typeof homeImmLayout === 'function') {
  const base = window.homeImmLayout;
  window.homeImmLayout = function () { const r = base.apply(this, arguments); sync(); return r; };
}
// the top bar stays in its over-the-photo look for the whole of Home: clear at the top, darker glass as you scroll
if (typeof homeBar === 'function') {
  const base = window.homeBar;
  window.homeBar = function () {
    base.apply(this, arguments);
    if (!on) return;
    const tb = document.querySelector('.topbar'); if (!tb) return;
    document.body.classList.add('homeOver');
    tb.style.setProperty('--barA', Math.min(.86, Math.max(0, scrollY / 160 * .86)).toFixed(3));
  };
}
// the page grows as Home's cards fill in, so re-measure the scroll range then
try { if (window.ResizeObserver) new ResizeObserver(() => { if (on) draw(); }).observe(document.getElementById('p0')); } catch (_) {}
setTimeout(sync, 0);
})();
