import sys,os,functools,threading,http.server,statistics
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad/'
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
def serve(d):
    s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=d));threading.Thread(target=s.serve_forever,daemon=True).start();return s.server_address[1]
H='''<!doctype html><script src="three.min.js"></script><script src="drillstudio.js"></script><script src="drills.js"></script><script src="golfer.js"></script>
<script>window.go=async(id,W,H,n)=>{await DrillStudio.loadSwing('',30000);await CCGolfer.load('');DrillStudio.webgl();const d=DRILL_LIBRARY.find(x=>x.id===id);
DrillStudio.poster(d,W,H-1);const t=[];for(let i=0;i<n;i++){const a=performance.now();DrillStudio.poster(d,W,H+i);t.push(performance.now()-a)}return t}</script>'''
pages={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
    for tag,site in [('old',S+'perf/oldsite/'),('new',S+'site/')]:
        port=serve(site);pg=b.new_page();base='http://127.0.0.1:%d/'%port
        pg.route(base+'h.html',lambda r:r.fulfill(status=200,content_type='text/html',body=H));pg.goto(base+'h.html');pages[tag]=pg
    R={'old':[],'new':[]}
    for W,Hh in [(732,915),(512,640)]:
        R={'old':[],'new':[]}
        for rnd in range(4):
            for tag in ['old','new']: R[tag]+=pages[tag].evaluate('([a,b,c,d])=>go(a,b,c,d)',[sys.argv[1] if len(sys.argv)>1 else 'tempo',W,Hh+rnd*10,5])
        print(W,Hh,{k:round(statistics.median(v)) for k,v in R.items()})
    b.close()
