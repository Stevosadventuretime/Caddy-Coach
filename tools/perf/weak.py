# Second launch with a weak signal: the page itself takes 4 s to download. How long until the app shows?
import sys, os, time
S='/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad'; sys.path.insert(0,S); os.chdir(S)
import sbmock
from playwright.sync_api import sync_playwright
PORT=os.environ.get('PORT','8766'); slow={'on':False}
def nav(r):
    if slow['on']: time.sleep(4)
    r.continue_()
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844})
    ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**',sbmock.handler)
    ctx.route(lambda u: u.rstrip('/').endswith('/caddy-coach') or u.endswith('/caddy-coach/index.html'), nav)
    pg=ctx.new_page(); pg.goto('http://127.0.0.1:%s/caddy-coach/'%PORT)
    pg.wait_for_function("navigator.serviceWorker&&navigator.serviceWorker.controller||new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',()=>r(true)))",timeout=120000)
    pg.wait_for_timeout(3000)
    slow['on']=True; t0=time.time()
    pg.goto('http://127.0.0.1:%s/caddy-coach/'%PORT, wait_until='commit', timeout=60000)
    pg.wait_for_function("document.getElementById('tabbar')&&document.readyState!=='loading'",timeout=60000)
    print('PORT',PORT,'app on screen after %.2fs'%(time.time()-t0))
    b.close()
