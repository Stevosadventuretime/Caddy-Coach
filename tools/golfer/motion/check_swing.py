# Checks a built swing-model.json against what skilled golfers do, so a floppy or badly ordered swing can't ship.
#   python3 check_swing.py ../../../swing-model.json      (exit code 1 if any check fails)
# Figures: Okuda, Gribble & Armstrong 2010 (J Sports Sci Med 9:127) and Chu, Sell & Lephart 2010 (J Sports Sci 28:1251)
# for turns and downswing time; Novosel's Tour Tempo for the 3:1 rhythm; lead arm close to straight through impact.
import sys, json, math
import numpy as np

def ang(a, b, c):
    u, v = np.subtract(a, b), np.subtract(c, b); return math.degrees(math.acos(np.clip(u @ v / np.linalg.norm(u) / np.linalg.norm(v), -1, 1)))
def yaw(v): return math.degrees(math.atan2(v[2], v[0]))

def measures(m):
    F, ph, fps = m['frames'], m['phases'], m.get('fps', 60)
    f = lambda k: F[ph[k]]
    out = {}
    for k in ('address', 'top', 'impact'): out['lead_elbow_' + k] = ang(f(k)['ls'], f(k)['le'], f(k)['lh'])
    a = f('address')
    out['shoulder_turn_top'] = abs(yaw(f('top')['Lt']) - yaw(a['Lt'])); out['hip_turn_top'] = abs(yaw(f('top')['H']) - yaw(a['H']))
    out['x_factor_top'] = out['shoulder_turn_top'] - out['hip_turn_top']
    out['hips_open_impact'] = abs(yaw(f('impact')['H']) - yaw(a['H']))
    out['tempo'] = (ph['top'] - ph['address']) / max(1, ph['impact'] - ph['top'])
    out['downswing_s'] = (ph['impact'] - ph['top']) / fps
    hd = [np.linalg.norm(np.subtract(F[i]['head'], a['head'])[[0, 2]]) for i in range(ph['address'], ph['impact'] + 1)]
    out['head_move_cm'] = 100 * max(hd)
    return out

CHECKS = {   # name: (low, high)
    'lead_elbow_address': (155, 181), 'lead_elbow_top': (150, 181), 'lead_elbow_impact': (155, 181),
    'shoulder_turn_top': (85, 110), 'hip_turn_top': (38, 58), 'x_factor_top': (38, 62), 'hips_open_impact': (25, 50),
    'tempo': (2.6, 3.4), 'downswing_s': (0.2, 0.36), 'head_move_cm': (0, 12)}

if __name__ == '__main__':
    m = json.load(open(sys.argv[1])); r = measures(m); bad = 0
    for k, (lo, hi) in CHECKS.items():
        ok = lo <= r[k] <= hi; bad += not ok
        print(('ok  ' if ok else 'FAIL'), k.ljust(20), round(r[k], 2), f'(want {lo}-{hi})')
    sys.exit(1 if bad else 0)
