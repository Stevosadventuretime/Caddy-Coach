# Whole-app smoothness audit on a slowed phone: startup, each tab switch, scrolling each tab.
import sys, os, json
S='/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad'; sys.path.insert(0,S); os.chdir(S)
exec(open('sa15.py').read().split('with sync_playwright() as p:\n')[0])
import sbmock
PORT=sys.argv[1] if len(sys.argv)>1 else '8766'
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
    ctx.grant_permissions(['geolocation']);ctx.set_geolocation({'latitude':53.4242,'longitude':-2.2683,'accuracy':5});ctx.route('http://127.0.0.1:8766/lf/**',lambda r:r.fulfill(status=200,content_type='text/javascript',body=open(S+r.request.url.split('8766')[1]).read()));pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    cdp=ctx.new_cdp_session(pg);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    pg.goto('http://127.0.0.1:8766/caddy-coach/');pg.wait_for_timeout(4000)
    pg.evaluate("document.getElementById('prof')&&(document.getElementById('prof').style.display='none')")
    pg.evaluate("tab(8)"); pg.wait_for_timeout(500)
    pg.evaluate("rtOpenCourse(Object.assign({},KNOWN_COURSES.find(c=>c.key==='chorlton-cum-hardy-golf-club')))"); pg.wait_for_timeout(1500)
    pg.click('[data-rt=start]'); pg.wait_for_timeout(800)
    pg.evaluate("__lt.length=0;window.__T0=performance.now()")
    t=pg.evaluate("""()=>new Promise(r=>{const t0=performance.now();document.querySelector('[data-gps=open]').click();requestAnimationFrame(()=>requestAnimationFrame(()=>r(Math.round(performance.now()-t0))))})""")
    pg.wait_for_timeout(4000)
    print('GPS open %dms, longtasks'%t,pg.evaluate("__lt.map(([s,d])=>[Math.round(s-__T0),d])"))
    # walking: position updates every second
    pg.evaluate("__lt.length=0;__frStart()")
    for i in range(10):
        ctx.set_geolocation({'latitude':53.4242+i*0.00008,'longitude':-2.2683-i*0.0004,'accuracy':5}); pg.wait_for_timeout(1000)
    fr=pg.evaluate("__frStop()"); print('walking 10s: frames',len(fr),'janky',[round(x) for x in fr if x>34],'longtasks',pg.evaluate("__lt.map(x=>x[1])"))
    # panning the map with a finger-drag
    box=pg.evaluate("(()=>{const m=document.querySelector('.leaflet-container');if(!m)return null;const r=m.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
    print('map box',box)
    if box:
        pg.evaluate("__lt.length=0;__frStart()")
        cx,cy=box[0]+box[2]/2,box[1]+box[3]/2
        for rep in range(3):
            pg.mouse.move(cx,cy);pg.mouse.down()
            for i in range(30): pg.mouse.move(cx-i*4,cy+i*3); pg.wait_for_timeout(16)
            pg.mouse.up()
            pg.mouse.move(cx,cy);pg.mouse.down()
            for i in range(30): pg.mouse.move(cx+i*4,cy-i*3); pg.wait_for_timeout(16)
            pg.mouse.up()
        pg.wait_for_timeout(500)
        fr=pg.evaluate("__frStop()"); print('panning: frames',len(fr),'janky',[round(x) for x in fr if x>34],'longtasks',pg.evaluate("__lt.map(x=>x[1])"))
    # next hole
    for k in range(3):
        pg.evaluate("__lt.length=0")
        t=pg.evaluate("""()=>new Promise(r=>{const b=document.querySelector('[data-gps=next]');if(!b)return r(-1);const t0=performance.now();b.click();requestAnimationFrame(()=>requestAnimationFrame(()=>r(Math.round(performance.now()-t0))))})""")
        pg.wait_for_timeout(1500); print('next hole %dms'%t,'longtasks',pg.evaluate("__lt.map(x=>x[1])"))
    print('errors',[e for e in errs][:4])
    b.close()
