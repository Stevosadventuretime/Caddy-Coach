"""Smoke test: open the app in a phone-sized headless browser and fail on any page error.
Covers start-up as a visitor and as a signed-in golfer, every main screen, and every drill played from start to end.
The database is faked (empty answers), so nothing real is read or written.
Run: python3 tools/ci/smoke.py [site folder]   (default: the repository root)"""
import json, os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..')
PORT = 8811
STEPS = int(os.environ.get('SMOKE_STEPS', '40'))
fails = []

def fake_server(route):
    route.fulfill(status=200, content_type='application/json', body='[]')

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/'); break
        except Exception: time.sleep(0.1)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for who in ('visitor', 'golfer'):
            ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
            ctx.route('**/*.supabase.co/**', fake_server)
            ctx.route('**/*sentry.io/**', lambda r: r.fulfill(status=200, body='{}'))
            ctx.route('**/fonts.g*/**', lambda r: r.fulfill(status=200, body=''))
            ctx.add_init_script("localStorage.setItem('cc_guest','1')")
            pg = ctx.new_page(); errs = []
            pg.on('pageerror', lambda e, who=who: errs.append(f'{who}: {str(e)[:200]}'))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_timeout(3000)
            if who == 'golfer':
                pg.evaluate("PROF.me={username:'smoke',first:'Smoke',last:'Test'};profHide&&profHide()")
                for n in range(10):
                    try: pg.evaluate(f"tab({n})"); pg.wait_for_timeout(400)
                    except Exception as e: errs.append(f'golfer tab {n}: {str(e)[:160]}')
                pg.evaluate("tab(3)"); pg.wait_for_timeout(600)
                ids = pg.evaluate("DRILL_LIBRARY.map(d=>d.id)")
                for i in ids:
                    r = pg.evaluate(f"""(async()=>{{await openDrill('{i}');const P=DP.player;if(!P)return 'no player';P.pause&&P.pause();
                      for(const v of ['face','dtl']){{P.setView(v);for(let k=0;k<={STEPS};k++){{const t=P.dur*k/{STEPS};try{{P.seek(t)}}catch(x){{closeDrill(true);return v+' t='+t.toFixed(2)+': '+x.message}}}}}}
                      closeDrill(true);return null}})()""")
                    if r: errs.append(f'drill {i} {r}')
                print(f'{len(ids)} drills played')
            else:
                for n in (0, 1, 3):
                    pg.evaluate(f"tab({n})"); pg.wait_for_timeout(400)
            fails += errs; ctx.close()
        b.close()
finally:
    srv.terminate()
print(json.dumps({'errors': fails}, indent=1))
sys.exit(1 if fails else 0)
