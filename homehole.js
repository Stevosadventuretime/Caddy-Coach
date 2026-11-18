// Caddy Coach: Home on a phone is laid over an aerial golf course. Scrolling flies down the course, a ball flight draws
// from the tee to a flag, and a pill counts the yards down to the pin. Only while Home shows on a phone (body.homeImm,
// set in app-4.js); everywhere else the layer is hidden. Photo: Unsplash (free licence), Bernd Dittrich.
(function () {
'use strict';
const NS = 'http://www.w3.org/2000/svg', HOLE = 412, TEE = 255;    // a 412-yard hole; the tee shot covers 255 of them
const ROUTE = 'M250 110 Q 330 420 410 800 Q 470 1010 500 1190', SHOT1 = 'M250 110 Q 330 420 410 800';
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const bg = document.createElement('div');
bg.id = 'holeBg'; bg.setAttribute('aria-hidden', 'true');
bg.innerHTML = `<img src="home-course.jpg" alt="" decoding="async">
<svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMid slice">
 <path class="hbRoute" d="${ROUTE}"/><path class="hbTrail" d="${ROUTE}"/>
 <circle class="hbLand" cx="410" cy="800" r="16"/>
 <g transform="translate(500 1190)"><ellipse rx="9" ry="4" fill="rgba(0,0,0,.45)"/><line x1="0" y1="0" x2="0" y2="-62" stroke="#fff" stroke-width="4"/><path d="M2 -62 L40 -50 L2 -38Z" fill="#f3c43a"/></g>
 <circle class="hbBall" r="10" cx="250" cy="110"/>
</svg>`;
const shade = document.createElement('div'); shade.id = 'holeShade'; shade.setAttribute('aria-hidden', 'true');
const pin = document.createElement('div');
pin.id = 'holePin'; pin.setAttribute('aria-hidden', 'true');   // decoration: the numbers are made up for the picture
pin.innerHTML = '<i></i><b>412</b><span>yds to pin</span><em>Tee</em>';
document.body.prepend(shade); document.body.prepend(bg); document.body.appendChild(pin);

const trail = bg.querySelector('.hbTrail'), ball = bg.querySelector('.hbBall'), land = bg.querySelector('.hbLand');
const yds = pin.querySelector('b'), stage = pin.querySelector('em');
let L = 0, seg1 = 0.5, H = 0, vh = 0, on = false;
function measure() {
  try {
    L = trail.getTotalLength();
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', SHOT1); seg1 = p.getTotalLength() / L;
    trail.style.strokeDasharray = L;
  } catch (_) {}
}
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
  if (!L) measure(); if (!L) return;
  trail.style.strokeDashoffset = (L * (1 - p)).toFixed(1);
  const pt = trail.getPointAtLength(L * p); ball.setAttribute('cx', pt.x.toFixed(1)); ball.setAttribute('cy', pt.y.toFixed(1));
  land.classList.toggle('on', p >= seg1);
  const y = p < seg1 ? Math.round(HOLE - TEE * (p / seg1)) : Math.round((HOLE - TEE) * (1 - (p - seg1) / (1 - seg1)));
  yds.textContent = Math.max(0, y);
  pin.classList.toggle('show', scrollY > 60);   // hidden at the very top, so it never sits over the stats
  stage.textContent = p < 0.03 ? 'Tee' : p < seg1 ? 'Tee shot' : p < 0.92 ? 'Approach' : p < 0.995 ? 'On the green' : 'In the hole';
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
    tb.style.setProperty('--barA', Math.min(.62, Math.max(0, scrollY / 180 * .62)).toFixed(3));
  };
}
// the page grows as Home's cards fill in, so re-measure the scroll range then
try { if (window.ResizeObserver) new ResizeObserver(() => { if (on) draw(); }).observe(document.getElementById('p0')); } catch (_) {}
measure(); setTimeout(sync, 0);
})();
