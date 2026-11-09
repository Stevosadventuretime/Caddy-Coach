import os, json, unittest, subprocess, sys, tempfile
import numpy as np
import bvh, measure, retarget, adjust
HERE = os.path.dirname(os.path.abspath(__file__))
MESH = os.environ.get('GOLFER_MESH', os.path.join(HERE, '..', '..', '..', 'golfer-mesh.wasm'))
NAMES = ['pel', 's', 'H', 'Lt', 'F', 'neck', 'head', 'face', 'ls', 'le', 'lh', 'ts', 'te', 'th', 'lhip', 'thip', 'lk', 'tk', 'la', 'ta', 'lt', 'tt',
         'lhl', 'thl', 'club', 'hands', 'clubhead', 'seat', 'bum', 'Fh', 'belt']

def ang(line, axis, ref):
    pl = line - np.outer(line @ axis, axis); r = ref - axis * (ref @ axis)
    pl /= np.linalg.norm(pl, axis=1, keepdims=True); r /= np.linalg.norm(r)
    return np.degrees(np.arctan2(np.cross(r, pl) @ axis, pl @ r))

class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        names, pos, ft = bvh.load(os.path.join(HERE, 'cmu', '64_08.bvh')); fps = 1 / ft
        ph = measure.phases(names, pos, fps); W = retarget.to_world(names, pos, ph); B = retarget.golfer_bones(MESH)
        J = retarget.to_golfer(W, names, B, ph, fps)
        J, ph = adjust.retime(J, ph, fps); J = adjust.posture(J, ph, B); J = adjust.turns(J, ph, B); J = adjust.grip(J, ph, B); J = adjust.reach(J, ph, B); J, ball = adjust.club(J, ph); J = adjust.frames(J, ph, ball)
        cls.J, cls.ph, cls.ball = J, ph, ball
        J0, ph0 = adjust.retime(retarget.to_golfer(W, names, B, measure.phases(names, pos, fps), fps), measure.phases(names, pos, fps), fps)
        cls.noreach = adjust.turns(adjust.posture(J0, ph0, B), ph0, B)
        a = ph['address']; spine = J['neck'][a] - J['pel'][a]; spine /= np.linalg.norm(spine)
        sl = J['ls'] - J['ts']; hl = J['lhip'] - J['thip']
        cls.S = ang(sl, spine, sl[a]); cls.Hh = ang(hl, np.array([0, 1.0, 0]), hl[a])
        if cls.S[ph['top']] < 0: cls.S, cls.Hh = -cls.S, -cls.Hh

    def test_tempo(self):
        p = self.ph; tempo = (p['top'] - p['address']) / (p['impact'] - p['top'])
        self.assertTrue(2.7 <= tempo <= 3.3, tempo); self.assertTrue(0.22 <= (p['impact'] - p['top']) / 60 <= 0.28)

    def test_turn_targets(self):
        p = self.ph
        self.assertTrue(93 <= self.S[p['top']] <= 103, self.S[p['top']]); self.assertTrue(43 <= self.Hh[p['top']] <= 53, self.Hh[p['top']])
        self.assertTrue(-43 <= self.Hh[p['impact']] <= -33, self.Hh[p['impact']]); self.assertTrue(-17 <= self.S[p['impact']] <= -7, self.S[p['impact']])
        F = self.J['F'][p['finish']]; Fh = F * [1, 0, 1]; Fh /= np.linalg.norm(Fh)
        self.assertLess(np.degrees(np.arccos(np.clip(Fh @ [1, 0, 0], -1, 1))), 25)

    def test_club_at_ball(self):
        for k in ('address', 'impact'):
            self.assertLess(np.linalg.norm(self.J['clubhead'][self.ph[k]] - self.ball), 0.03, k)
        L = np.linalg.norm(self.J['club'][:, 1] - self.J['lh'], axis=1)
        self.assertLess(np.abs(L - 0.89).max(), 0.001)

    def test_golf_posture(self):
        # bent from the hips like a golfer at address (the capture stands nearly upright)
        a = self.ph['address']; sp = self.J['neck'][a] - self.J['pel'][a]
        bend = np.degrees(np.arctan2(np.hypot(sp[0], sp[2]), sp[1])); self.assertTrue(28 <= bend <= 45, bend)

    def test_ball_on_the_ground_in_front(self):
        self.assertTrue(0.01 <= self.ball[1] <= 0.05, self.ball); self.assertTrue(0.35 <= self.ball[2] <= 0.75, self.ball)

    def test_clubhead_up_at_the_top(self):
        t = self.ph['top']; self.assertGreater(self.J['clubhead'][t][1], self.J['hands'][t][1] - 0.2)

    def test_reach_doesnt_squat(self):
        i = self.ph['impact']; self.assertLess(abs(self.J['pel'][i][1] - self.noreach['pel'][i][1]), 0.02)

    def test_trail_hand_on_the_club(self):
        a, b = self.J['club'][:, 0], self.J['club'][:, 1]; d = (b - a) / np.linalg.norm(b - a, axis=1, keepdims=True)
        r = self.J['th'] - a; off = np.linalg.norm(r - d * (r * d).sum(1, keepdims=True), axis=1)
        self.assertLess(off.max(), 0.01)
        L = np.linalg.norm(self.J['th'] - self.J['ts'], axis=1); self.assertLess(L.max(), 0.262 + 0.266 + 0.07)

    def test_lead_arm_stays_firm(self):
        # good players keep the lead arm close to straight from address through impact (it was bent to ~120 degrees)
        J = self.J
        for k in ('address', 'top', 'impact'):
            i = self.ph[k]; u, v = J['ls'][i] - J['le'][i], J['lh'][i] - J['le'][i]
            a = np.degrees(np.arccos(np.clip(u @ v / np.linalg.norm(u) / np.linalg.norm(v), -1, 1))); self.assertGreater(a, 155, k)

    def test_head_steady(self):
        a, i = self.ph['address'], self.ph['impact']; d = np.linalg.norm((self.J['head'][a:i + 1] - self.J['head'][a])[:, [0, 2]], axis=1)
        self.assertLess(d.max(), 0.14)

    def test_paths_are_in_the_repo(self):
        import make_swing; root = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
        self.assertTrue(os.path.abspath(make_swing.MESH).startswith(root), make_swing.MESH)

    def test_no_jumps(self):
        for n in ['pel', 'neck', 'head', 'ls', 'ts', 'lk', 'tk', 'la', 'ta', 'lt', 'tt']:
            self.assertLess(np.linalg.norm(np.diff(self.J[n], axis=0), axis=1).max(), 0.12, n)
        for n in ['le', 'te']:   # elbows whip through impact with the hands (smoothly: ~8 m/s at the release)
            self.assertLess(np.linalg.norm(np.diff(self.J[n], axis=0), axis=1).max(), 0.16, n)
        for n in ['lh', 'th']:   # a straight lead arm swings the hands on a wider, faster arc
            self.assertLess(np.linalg.norm(np.diff(self.J[n], axis=0), axis=1).max(), 0.22, n)

    def test_file_schema(self):
        out = os.path.join(tempfile.mkdtemp(), 'swing-model.json')
        subprocess.run([sys.executable, os.path.join(HERE, 'make_swing.py'), out], check=True, cwd=HERE, env=dict(os.environ, GOLFER_MESH=MESH))
        m = json.load(open(out))
        self.assertEqual(m['v'], 1); self.assertEqual(m['fps'], 60)
        order = ['address', 'takeaway', 'half', 'top', 'down', 'impact', 'through', 'finish']
        self.assertEqual([m['phases'][k] for k in order], sorted(m['phases'][k] for k in order))
        for f in m['frames']:
            for n in NAMES: self.assertIn(n, f)
        self.assertEqual(len(m['ball']), 3)

if __name__ == '__main__': unittest.main()
