import sys, os, re
S='/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad'; sys.path.insert(0,S); os.chdir(S)
import sbmock
from playwright.sync_api import sync_playwright
D=S+'/perfa/upd/caddy-coach/'
def ready(pg): pg.wait_for_function("document.getElementById('tabbar')&&document.readyState!=='loading'",timeout=60000)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844})
    ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**',sbmock.handler)
    pg=ctx.new_page(); pg.goto('http://127.0.0.1:8771/caddy-coach/')
    pg.wait_for_function("navigator.serviceWorker.controller||new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',()=>r(true)))",timeout=120000); pg.wait_for_timeout(2000)
    v1=pg.evaluate("CC_VER"); print('v1',v1)
    # offline launch
    ctx.set_offline(True); pg.reload(); ready(pg); print('offline launch works:',pg.evaluate("CC_VER")==v1); ctx.set_offline(False)
    # deploy a new version
    for f in ['index.html','sw.js']:
        t=open(D+f).read().replace(v1,'NEWVER0001'); open(D+f,'w').write(t)
    pg.reload(); ready(pg); print('launch right after deploy shows',pg.evaluate("CC_VER"))
    pg.wait_for_function("navigator.serviceWorker.controller&&navigator.serviceWorker.getRegistration().then(r=>r&&r.active&&r.active.scriptURL&&!r.installing&&!r.waiting)",timeout=60000); pg.wait_for_timeout(4000)
    pg.reload(); ready(pg); print('next launch shows',pg.evaluate("CC_VER"))
    b.close()
