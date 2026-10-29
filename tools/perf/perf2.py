# The drill player renders smaller when frames are slow (software GL here is slow), and never below the floor.
import sys, os; sys.path.insert(0, '/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad'); os.chdir(sys.path[0])
exec(open('sa15.py').read().split('with sync_playwright() as p:\n')[0])
import sbmock
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=1, service_workers='block')
    ctx.route('https://dhrzscyirgvjwnvgdpqt.supabase.co/**', sbmock.handler)
    pg, errs = page(ctx); pg.wait_for_timeout(1500)
    pg.evaluate("document.getElementById('prof')&&(document.getElementById('prof').style.display='none')")
    pg.evaluate('tab(3)'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelectorAll('#drillList [data-open]')[1].click()")
    s = []
    for i in range(12): pg.wait_for_timeout(5000); s.append(pg.evaluate("[DrillStudio.stats().scale, DrillStudio.stats().renders, document.querySelector('.dsGl').width, document.querySelector('.dsOverlay').width]"))
    print(s)
    ok = s[-1][0] < 1 and s[-1][0] >= 0.7 and s[-1][2] < s[-1][3]
    print('PASS' if ok else 'FAIL', 'resolution adapted, overlay kept full size', s[-1]); print('errors', errs[:3])
    pg.reload(); pg.wait_for_timeout(2000); pg.evaluate("document.getElementById('prof')&&(document.getElementById('prof').style.display='none')")
    pg.evaluate('tab(3)'); pg.wait_for_timeout(300); pg.evaluate("document.querySelectorAll('#drillList [data-open]')[1].click()"); pg.wait_for_timeout(3000)
    s2 = pg.evaluate("DrillStudio.stats().scale")
    print('PASS' if s2 == s[-1][0] else 'FAIL', 'next visit starts at the learned size', s2)
    b.close()
