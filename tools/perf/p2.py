# Throttled (4x CPU, phone-like) profile with CDP: startup, drill tab, drill open, drill play. Prints JS hotspots per phase.
import sys, json, time, collections; sys.path.insert(0, '/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad')
import os; os.chdir(sys.path[0])
exec(open('sa15.py').read().split('with sync_playwright() as p:\n')[0])
import sbmock
THR = float(os.environ.get('THR', '4'))
INIT = r"""window.__fr=[];(function f(t){__fr.push(t);requestAnimationFrame(f)})(0);"""
def frames(pg, ms):
    pg.evaluate("__fr.length=0"); pg.wait_for_timeout(ms)
    fr = pg.evaluate("__fr.slice()"); d = sorted(b-a for a, b in zip(fr, fr[1:]))
    if not d: return 'no frames'
    return 'fps %.1f p50 %.0f p95 %.0f max %.0f janky(>50ms) %d' % (len(d)/(ms/1000), d[len(d)//2], d[int(len(d)*.95)], d[-1], sum(x > 50 for x in d))
def hot(prof, n=14):
    nodes = {x['id']: x for x in prof['nodes']}
    self_t = collections.Counter(); dt = prof['timeDeltas']; smp = prof['samples']
    for i, s in enumerate(smp): self_t[s] += dt[i] if i < len(dt) else 0
    agg = collections.Counter()
    for nid, t in self_t.items():
        cf = nodes[nid]['callFrame']; key = '%s %s:%d' % (cf['functionName'] or '(anon)', cf['url'].split('/')[-1][:20], cf['lineNumber'])
        agg[key] += t
    tot = sum(agg.values())
    return ['%6.0fms %s' % (v/1000, k) for k, v in agg.most_common(n)] + ['total %.0fms' % (tot/1000)]
def phase(cdp, name, fn):
    cdp.send('Profiler.start'); t = time.time(); r = fn(); el = time.time()-t
    prof = cdp.send('Profiler.stop')['profile']
    print('==', name, '%.2fs' % el, r or '')
    for l in hot(prof): print('   ', l)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, service_workers='block')
    ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**', sbmock.handler)
    ctx.add_init_script(INIT)
    pg0 = ctx.new_page(); cdp = ctx.new_cdp_session(pg0)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': THR}); cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 500})
    # reuse page() helper's routes but on pg0
    pg0.close()
    pg = ctx.new_page(); cdp = ctx.new_cdp_session(pg)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': THR}); cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 500})
    for ep in ['https://overpass-api.de/**']: ctx.route(ep, ov)
    ctx.route('https://nominatim.openstreetmap.org/**', nom2); ctx.route('https://server.arcgisonline.com/**', tile)
    ctx.route('http://127.0.0.1:8766/lf/**', lambda r: r.fulfill(status=200, content_type='text/javascript', body=open(S+r.request.url.split('8766')[1]).read()))
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('script');s.type='module';s.textContent=\"import * as L from '/lf/Lfix/Leaflet.js';window.L=L;\";document.head.appendChild(s)})")
    def start():
        pg.goto(os.environ.get('BASE','http://127.0.0.1:8766/caddy-coach/')); pg.wait_for_load_state('load'); pg.wait_for_timeout(6000)
        return frames(pg, 2000)
    phase(cdp, 'startup+6s', start)
    pg.evaluate("document.getElementById('prof')&&(document.getElementById('prof').style.display='none')")
    def scrollhome():
        pg.evaluate("__fr.length=0;(async()=>{for(let i=0;i<40;i++){scrollBy(0,40);await new Promise(r=>setTimeout(r,25))}for(let i=0;i<40;i++){scrollBy(0,-40);await new Promise(r=>setTimeout(r,25))}})()")
        pg.wait_for_timeout(2500); fr = pg.evaluate("__fr.slice()"); d = sorted(b-a for a, b in zip(fr, fr[1:]))
        return 'scroll p50 %.0f p95 %.0f max %.0f' % (d[len(d)//2], d[int(len(d)*.95)], d[-1])
    phase(cdp, 'home scroll', scrollhome)
    def drilltab():
        pg.evaluate('tab(3)'); pg.wait_for_timeout(5000); return frames(pg, 2000)
    phase(cdp, 'drill tab', drilltab)
    def scrolldr():
        return scrollhome()
    phase(cdp, 'drill list scroll', scrolldr)
    def opendr():
        pg.evaluate("document.querySelectorAll('#drillList [data-open]')[1].click()")
        t = time.time()
        while not pg.evaluate("!!document.querySelector('.dsStage')") and time.time()-t < 30: pg.wait_for_timeout(50)
        o = 'stage after %.2fs' % (time.time()-t); pg.wait_for_timeout(3000); return o
    phase(cdp, 'open drill', opendr)
    def play():
        return frames(pg, 5000)
    phase(cdp, 'drill playing', play)
    print('canvas', pg.evaluate("[...document.querySelectorAll('canvas')].map(c=>[c.width,c.height,c.className||c.id,c.offsetParent?1:0])"))
    print('errors', errs[:5])
    b.close()
