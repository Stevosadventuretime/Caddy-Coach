# Smoothness guards: the 3D pictures are painted off-screen by a worker, the warm-up waits while you scroll,
# going back to Drills doesn't rebuild the list, and launches don't wait on a weak signal.
import sys, os, time; sys.path.insert(0, '/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad'); os.chdir(sys.path[0])
os.environ['PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS'] = '1'
exec(open('sa15.py').read().split('with sync_playwright() as p:\n')[0])
import sbmock
F = []
def chk(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: F.append(m)
slow = {'on': False}
def nav(r):
    if slow['on']: time.sleep(4)
    r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block'); ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**', sbmock.handler)
    pg, errs = page(ctx)
    pg.evaluate("document.getElementById('prof')&&(document.getElementById('prof').style.display='none')")
    pg.evaluate("window.__warm=0;document.addEventListener('cc-golfer',()=>{const o=DrillStudio.poster;DrillStudio.poster=function(d,w,h,warm){if(warm)window.__warm=performance.now();return o.apply(this,arguments)}},{once:true})")
    pg.evaluate("tab(3)"); pg.mouse.move(195, 500)
    t0 = pg.evaluate("performance.now()")
    for i in range(80): pg.mouse.wheel(0, 60 if i % 20 < 10 else -60); pg.wait_for_timeout(100)   # 8 s of scrolling
    t1 = pg.evaluate("performance.now()")
    w = pg.evaluate("window.__warm")
    chk(w == 0 or w > t1 - 300, 'the 3D warm-up does not run while the list is being scrolled (warm at %s, scrolling %d-%d)' % (w, t0, t1))
    pg.wait_for_function("window.__warm>0", timeout=90000)
    chk(pg.evaluate("window.__warm") >= t1, 'it runs once scrolling stops')
    pg.evaluate("DrillStudio.prepTextures().then(()=>window.__ptDone=1)"); pg.wait_for_function("window.__ptDone", timeout=30000)
    pg.evaluate("document.querySelector('#drillList .dcard').dataset.mark='1'")
    pg.evaluate("tab(0)"); pg.wait_for_timeout(200); pg.evaluate("tab(3)"); pg.wait_for_timeout(200)
    chk(pg.evaluate("document.querySelector('#drillList .dcard').dataset.mark==='1'"), 'going back to Drills keeps the list (no rebuild, no picture reload)')
    pg.evaluate("document.querySelector('#whereChips [data-w=home]').click()"); pg.wait_for_timeout(200)
    chk(pg.evaluate("!document.querySelector('#drillList .dcard[data-mark]')"), 'changing a filter does rebuild it')
    chk(pg.evaluate("getComputedStyle(document.querySelector('.tabbar')).backdropFilter") in ('none', ''), 'no frosted blur on the tab bar off iPhone')
    chk(not errs, 'no page errors %s' % errs[:3])
    ctx.close()
    # a launch with a weak signal opens from the saved copy
    ctx = b.new_context(viewport={'width': 390, 'height': 844}); ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**', sbmock.handler)
    ctx.route(lambda u: u.rstrip('/').endswith('/caddy-coach') or u.endswith('/caddy-coach/index.html'), nav)
    pg = ctx.new_page(); pg.goto('http://127.0.0.1:8766/caddy-coach/')
    pg.wait_for_function("navigator.serviceWorker.controller||new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',()=>r(true)))", timeout=180000); pg.wait_for_timeout(2000)
    slow['on'] = True; t = time.time()
    pg.goto('http://127.0.0.1:8766/caddy-coach/', wait_until='commit', timeout=60000)
    pg.wait_for_function("document.getElementById('tabbar')&&document.readyState!=='loading'", timeout=60000)
    dt = time.time() - t; chk(dt < 2, 'with a weak signal the app opens from the saved copy in %.2fs' % dt)
    slow['on'] = False; ctx.close(); b.close()
print('FAILURES', len(F))
sys.exit(1 if F else 0)
