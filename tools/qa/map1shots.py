import sys, os; sys.path.insert(0, '/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad'); os.chdir(sys.path[0])
exec(open('qa/map1.py').read().split('with sync_playwright() as p:\n')[0])
from PIL import Image
shots=[]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    sbmock.DB['hole_maps'].clear()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block'); ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**', sbmock.handler)
    pg, errs = page(ctx); pg.evaluate("document.getElementById('prof')&&(document.getElementById('prof').style.display='none')")
    pg.evaluate("tab(0)"); pg.wait_for_timeout(1500); pg.locator('#homeMap').screenshot(path='qa/m_home.png'); shots.append('qa/m_home.png')
    start_round(pg); pg.evaluate("cmOpen()"); pg.wait_for_timeout(200); pg.click('[data-cm=begin]'); pg.wait_for_timeout(300)
    pg.evaluate("GPS.cm.step='tee';GPS.cm.tee=null;GPS.cm.green=null;cmDraw();gpsPanel()")
    tap(pg, 53.42420, -2.26830); tap(pg, 53.42553, -2.27454); pg.wait_for_timeout(2500); pg.screenshot(path='qa/m_front.png'); shots.append('qa/m_front.png')
    tap(pg, 53.42548, -2.27440); tap(pg, 53.42558, -2.27468); pg.wait_for_timeout(300); pg.screenshot(path='qa/m_fair.png'); shots.append('qa/m_fair.png')
    tap(pg, 53.42480, -2.27150); pg.evaluate("cmFrame()"); pg.wait_for_timeout(2500); pg.screenshot(path='qa/m_check.png'); shots.append('qa/m_check.png')
    pg.click('[data-cm=save]'); pg.wait_for_timeout(300); ctx.close()
    sbmock.DB['hole_maps'][:] = [dict(r, device='someone-else-1234') for r in sbmock.DB['hole_maps']]
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block'); ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**', sbmock.handler)
    pg, errs = page(ctx); start_round(pg); pg.wait_for_timeout(1500)
    pg.evaluate("GPS.pos={lat:53.4242,lng:-2.2683,acc:5};GPS.framed=false;gpsDrawHole(true);gpsPanel()"); pg.wait_for_timeout(2500); pg.screenshot(path='qa/m_confirm.png'); shots.append('qa/m_confirm.png')
    print('errs', errs[:3]); b.close()
ims=[Image.open(f) for f in shots[1:]];w,h=ims[0].size;S=Image.new('RGB',(w*len(ims),h),'white')
for i,im in enumerate(ims): S.paste(im,(w*i,0))
S.thumbnail((2400,2400));S.save('/mnt/user-data/outputs/course-mapping-screens.jpg',quality=85)
