# Renders the drill library's card pictures once, so phones show plain images instead of drawing 30 scenes in 3D.
#   python3 make_posters.py SITE_DIR      (writes SITE_DIR/posters/<id>.jpg and <id>-L.jpg for left-handers)
# Needs Playwright with Chromium. Skips the work when nothing the pictures depend on has changed.
import sys, os, json, base64, hashlib, threading, functools, http.server
from playwright.sync_api import sync_playwright

SITE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = os.path.join(SITE, 'posters')
INPUTS = ['three.min.js', 'drillstudio.js', 'drills.js', 'golfer.js', 'golfer-mesh.wasm', 'swing-model.json'] + \
    sorted(f for f in os.listdir(SITE) if f.startswith('golfer-') and f.endswith(('.jpg', '.png')))
W, H = 240, 300
HARNESS = '''<!doctype html><meta charset="utf-8"><body>
<script src="three.min.js"></script><script src="drillstudio.js"></script><script src="drills.js"></script><script src="golfer.js"></script>
<script>
window.go = async () => {
  await DrillStudio.loadSwing('', 30000); await CCGolfer.load('');
  if (!DrillStudio.webgl() || !CCGolfer.ready()) throw new Error('3D not available');
  const out = {};
  for (const L of [false, true]) { DrillStudio.setMirror(L); for (const d of DRILL_LIBRARY) out[d.id + (L ? '-L' : '')] = DrillStudio.poster(d, %d, %d); }
  return out;
};
</script>''' % (W, H)


def digest():
    h = hashlib.sha1(b'%dx%d' % (W, H))
    for f in INPUTS: h.update(f.encode()); h.update(open(os.path.join(SITE, f), 'rb').read())
    h.update(open(__file__, 'rb').read())
    return h.hexdigest()


def main():
    want = digest(); stamp = os.path.join(OUT, '.inputs')
    if os.path.exists(stamp) and open(stamp).read() == want:
        print('posters up to date'); return
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=SITE))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = 'http://127.0.0.1:%d/' % srv.server_address[1]
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        pg = b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route(base + '__posters.html', lambda r: r.fulfill(status=200, content_type='text/html', body=HARNESS))
        pg.goto(base + '__posters.html')
        out = pg.evaluate('go()')
        b.close()
    srv.shutdown()
    if errs: raise SystemExit('page errors: %s' % errs[:3])
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.jpg'): os.remove(os.path.join(OUT, f))
    for k, url in out.items():
        assert url.startswith('data:image/jpeg;base64,'), k
        open(os.path.join(OUT, k + '.jpg'), 'wb').write(base64.b64decode(url.split(',', 1)[1]))
    open(stamp, 'w').write(want)
    print('wrote %d posters to %s' % (len(out), OUT))


if __name__ == '__main__':
    main()
