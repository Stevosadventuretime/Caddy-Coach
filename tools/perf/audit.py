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
    pg.goto('http://127.0.0.1:%s/caddy-coach/'%PORT);pg.wait_for_timeout(6000)
    nav=pg.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0];const fcp=performance.getEntriesByName('first-contentful-paint')[0];return {dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),fcp:fcp&&Math.round(fcp.startTime)}})()")
    lt=pg.evaluate("__lt.slice()")
    print('STARTUP',nav,'longtasks>50ms in first 6s:',len(lt),'total',sum(d for s,d in lt),'max',max([d for s,d in lt] or [0]))
    print('  biggest',sorted(lt,key=lambda x:-x[1])[:6])
    pg.evaluate("document.getElementById('prof')&&(document.getElementById('prof').style.display='none')")
    res={}
    for n in [0,1,2,3,5,7,8,9,0]:
        pg.evaluate("__lt.length=0")
        t=pg.evaluate("""n=>new Promise(r=>{const t0=performance.now();tab(n);requestAnimationFrame(()=>requestAnimationFrame(()=>r(Math.round(performance.now()-t0))))})""",n)
        pg.wait_for_timeout(1500)
        lt=pg.evaluate("__lt.slice()")
        # scroll the page
        pg.evaluate("__frStart()")
        pg.mouse.move(195,500)
        for i in range(25): pg.mouse.wheel(0,120); pg.wait_for_timeout(40)
        for i in range(25): pg.mouse.wheel(0,-120); pg.wait_for_timeout(40)
        pg.wait_for_timeout(300)
        fr=pg.evaluate("__frStop()")
        jank=[round(x) for x in fr if x>34]
        print('TAB',n,'switch %dms'%t,'longtasks after',[d for s,d in lt],'| scroll frames',len(fr),'janky(>34ms)',len(jank),'worst',max(fr or [0]).__round__())
    print('errors',errs[:5])
    b.close()
