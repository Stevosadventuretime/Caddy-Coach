import sys, os, json; sys.path.insert(0, '/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad'); os.chdir(sys.path[0])
from playwright.sync_api import sync_playwright
import sbmock
nom = json.load(open('cmap/nom.json'))[0]['geojson']['coordinates'][0]
poly = [[round(la, 6), round(lo, 6)] for lo, la in nom]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']); ctx = b.new_context(service_workers='block')
    ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**', sbmock.handler)
    for h in ['https://overpass-api.de/**', 'https://overpass.kumi.systems/**', 'https://overpass.private.coffee/**']: ctx.route(h, lambda r: r.abort())
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8766/caddy-coach/'); pg.wait_for_timeout(2000)
    r = pg.evaluate("""async (args)=>{const [poly,old]=args;const c=JSON.parse(JSON.stringify(KNOWN_COURSES.find(x=>x.key==='chorlton-cum-hardy-golf-club')));if(old){c.lat=53.4262;c.lon=-2.2901}c.key+=old?'-old':'-new';c._site={lat:53.4266749,lon:-2.2750912,poly};
      const holes=c.tees.find(t=>t.name==='Yellow').holes;const gf=await gfFindGreens(c,holes);if(!gf)return null;
      return {outline:gf.outline,n:gf.cands.length,cands:gf.cands.map(g=>[g.lat,g.lon,g.q]),route:Object.fromEntries(Object.entries(gf.route).map(([n,v])=>[n,v.i>=0?[gf.cands[v.i].lat,gf.cands[v.i].lon]:null]))}}""", [poly, False])
    json.dump(r, open('cmap/gfreal.json', 'w')); print('outline', r and r['outline'], 'cands', r and r['n'], 'errs', errs[:2])
    b.close()
