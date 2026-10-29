# The satellite green finder stays on the club's own course: it uses the club outline the app already has,
# and starts from inside it, even when OpenStreetMap's data service can't be reached and the stored point is off the course.
import sys, os, json; sys.path.insert(0, '/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad'); os.chdir(sys.path[0])
from playwright.sync_api import sync_playwright
import sbmock
nom = json.load(open('cmap/nom.json'))[0]['geojson']['coordinates'][0]
poly = [[round(la, 6), round(lo, 6)] for lo, la in nom]
F = []
def chk(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: F.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(service_workers='block')
    ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**', sbmock.handler)
    for h in ['https://overpass-api.de/**', 'https://overpass.kumi.systems/**', 'https://overpass.private.coffee/**', 'https://nominatim.openstreetmap.org/**']: ctx.route(h, lambda r: r.abort())
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8766/caddy-coach/'); pg.wait_for_timeout(2000)
    r = pg.evaluate("""async (poly)=>{const c=Object.assign({},KNOWN_COURSES.find(x=>x.key==='chorlton-cum-hardy-golf-club'));c._site={lat:53.4268,lon:-2.2768,poly};
      const out=await gfOutline(c);const st=typeof gfStart==='function'?gfStart(c,out):null;
      return {n:out?out.length:0,start:st,startIn:!!(st&&out&&inPoly(st,out)),pointIn:!!(out&&inPoly({lat:c.lat,lon:c.lon},out)),ver:GF.V}}""", poly)
    print(r)
    chk(r['n'] > 3, 'outline comes from the club outline the app already has (%d points)' % r['n'])
    chk(r['startIn'], 'the finder starts inside the club outline: %s' % r['start'])
    chk(r['pointIn'], "Chorlton's stored location is on its own course")
    chk(r['ver'] >= 3, 'old cached green finds are dropped (version %s)' % r['ver'])
    chk(not errs, 'no page errors %s' % errs[:2])
    b.close()
print('FAILURES', len(F))
