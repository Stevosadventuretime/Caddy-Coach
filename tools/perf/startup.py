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
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    cdp=ctx.new_cdp_session(pg);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    cdp.send('Profiler.enable');cdp.send('Profiler.setSamplingInterval',{'interval':200});cdp.send('Profiler.start')
    pg.goto('http://127.0.0.1:8766/caddy-coach/');pg.wait_for_timeout(5000)
    prof=cdp.send('Profiler.stop')['profile']
    print('longtasks',pg.evaluate("__lt"))
    nodes={x['id']:x for x in prof['nodes']}; par={}
    for x in prof['nodes']:
        for c in x.get('children',[]): par[c]=x['id']
    selft={};tot={}
    for sid,d in zip(prof['samples'],prof['timeDeltas']):
        cf=nodes[sid]['callFrame'];k='%s %s:%d'%(cf['functionName'] or '(anon)',cf['url'].split('/')[-1],cf['lineNumber']+1)
        selft[k]=selft.get(k,0)+d
        seen=set();i=sid
        while i in nodes:
            cf=nodes[i]['callFrame'];k='%s %s:%d'%(cf['functionName'] or '(anon)',cf['url'].split('/')[-1],cf['lineNumber']+1)
            if k not in seen: tot[k]=tot.get(k,0)+d;seen.add(k)
            i=par.get(i)
    for k,v in sorted(selft.items(),key=lambda x:-x[1])[:14]: print(' self %5d'%(v/1000),k)
    for k,v in sorted(tot.items(),key=lambda x:-x[1])[:30]: print(' total %5d'%(v/1000),k)
    b.close()
