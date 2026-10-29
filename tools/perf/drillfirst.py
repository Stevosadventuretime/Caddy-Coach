# Whole-app smoothness audit on a slowed phone: startup, each tab switch, scrolling each tab.
import sys, os, json
S='/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad'; sys.path.insert(0,S); os.chdir(S)
exec(open('sa15.py').read().split('with sync_playwright() as p:\n')[0])
import sbmock
PORT=os.environ.get('PORT','8766')
INIT="""
window.__lt=[];new PerformanceObserver(l=>l.getEntries().forEach(e=>__lt.push([Math.round(e.startTime),Math.round(e.duration)]))).observe({type:'longtask',buffered:true});
window.__fr=null;window.__frStart=()=>{__fr=[];let t0=performance.now();const f=t=>{if(!__fr)return;__fr.push(t-t0);t0=t;requestAnimationFrame(f)};requestAnimationFrame(f)};
window.__frStop=()=>{const a=__fr;__fr=null;return a};
"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,service_workers='block',has_touch=False)
    ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**',sbmock.handler)
    ctx.add_init_script(INIT)
    for ep in ['https://overpass-api.de/**','https://overpass.kumi.systems/**','https://overpass.private.coffee/**']: ctx.route(ep,ov)
    ctx.route('https://nominatim.openstreetmap.org/**',nom2);ctx.route('https://server.arcgisonline.com/**',tile)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    cdp=ctx.new_cdp_session(pg);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    pg.goto('http://127.0.0.1:8766/caddy-coach/');pg.wait_for_timeout(5000)
    pg.evaluate("document.getElementById('prof')&&(document.getElementById('prof').style.display='none')")
    r=pg.evaluate("""()=>new Promise(res=>{const t0=performance.now();tab(3);const t1=performance.now();document.body.offsetHeight;const t2=performance.now();requestAnimationFrame(()=>{const t3=performance.now();requestAnimationFrame(()=>res([Math.round(t1-t0),Math.round(t2-t1),Math.round(t3-t2),Math.round(performance.now()-t3)]))})})""")
    print('first drills: js %d layout %d toFrame %d nextFrame %d'%tuple(r), 'total',sum(r))
    print('card sizes',pg.evaluate("[...document.querySelectorAll('.dcard')].slice(0,3).map(e=>[e.offsetWidth,e.offsetHeight])"), pg.evaluate("document.querySelectorAll('.dcard').length"))
    b.close()
