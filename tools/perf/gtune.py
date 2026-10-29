import sys,os,base64,io,functools,threading,http.server,numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad/'
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
def serve(d):
    s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=d));threading.Thread(target=s.serve_forever,daemon=True).start();return s.server_address[1]
H='''<!doctype html><script src="three.min.js"></script><script src="drillstudio.js"></script><script src="drills.js"></script><script src="golfer.js"></script>
<script>window.go=async(ids,g)=>{await DrillStudio.loadSwing('',30000);await CCGolfer.load('');DrillStudio.webgl();if(g&&DrillStudio._g)DrillStudio._g(g[0],g[1]);const o={};for(const id of ids)o[id]=DrillStudio.poster(DRILL_LIBRARY.find(d=>d.id===id),240,300);return o}</script>'''
IDS=['handhang','tempo','holdfinish']
def shots(site,g=None):
    port=serve(site)
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']);pg=b.new_page()
        base='http://127.0.0.1:%d/'%port;pg.route(base+'h.html',lambda r:r.fulfill(status=200,content_type='text/html',body=H));pg.goto(base+'h.html')
        o=pg.evaluate('([i,g])=>go(i,g)',[IDS,g]);b.close()
    return {k:np.asarray(Image.open(io.BytesIO(base64.b64decode(v.split(',')[1]))).convert('RGB')).astype(float) for k,v in o.items()}
if __name__=='__main__':
    import shutil
    old=S+'perf/oldsite/'
    if not os.path.exists(old):
        shutil.copytree(S+'site',old,ignore=shutil.ignore_patterns('posters'));shutil.copy(S+'perf/drillstudio.before.js',old+'drillstudio.js')
    A=shots(old)
    for g in [None]:
        B=shots(S+'site',g)
        d=np.mean([np.abs(A[k][160:,:]-B[k][160:,:]).mean() for k in IDS]); m=[ (A[k][160:,:].mean((0,1))-B[k][160:,:].mean((0,1))).round(1).tolist() for k in IDS]
        print(g,'mean abs diff lower half %.1f'%d,m)
