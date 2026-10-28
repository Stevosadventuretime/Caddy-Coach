import os, json, unittest, subprocess, sys, tempfile
import numpy as np
import bvh, measure, retarget, adjust
HERE = os.path.dirname(os.path.abspath(__file__))
MESH = os.environ.get('GOLFER_MESH', '/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad/site/golfer-mesh.wasm')
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
        J, ph = adjust.retime(J, ph, fps); J = adjust.posture(J, ph, B); J = adjust.turns(J, ph, B); J = adjust.reach(J, ph, B); J, ball = adjust.club(J, ph); J = adjust.frames(J, ph, ball)
        cls.J, cls.ph, cls.ball = J, ph, ball
        a = ph['address']; spine = J['neck'][a] - J['pel'][a]; spine /= np.linalg.norm(spine)
        sl = J['ls'] - J['ts']; hl = J['lhip'] - J['thip']
        cls.S = ang(sl, spine, sl[a]); cls.Hh = ang(hl, np.array([0, 1.0, 0]), hl[a])
        if cls.S[ph['top']] < 0: cls.S, cls.Hh = -cls.S, -cls.Hh

    def test_tempo(self):
        p = self.ph; tempo = (p['top'] - p['address']) / (p['impact'] - p['top'])
        self.assertTrue(2.7 <= tempo <= 3.3, tempo); self.assertTrue(0.22 <= (p['impact'] - p['top']) / 60 <= 0.28)

    def test_turn_targets(self):
        p = self.ph
        self.assertTrue(85 <= self.S[p['top']] <= 95, self.S[p['top']]); self.assertTrue(40 <= self.Hh[p['top']] <= 50, self.Hh[p['top']])
        self.assertTrue(-45 <= self.Hh[p['impact']] <= -35, self.Hh[p['impact']]); self.assertTrue(-27 <= self.S[p['impact']] <= -18, self.S[p['impact']])
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

    def test_no_jumps(self):
        for n in ['pel', 'neck', 'head', 'ls', 'ts', 'le', 'te', 'lk', 'tk', 'la', 'ta', 'lt', 'tt']:
            self.assertLess(np.linalg.norm(np.diff(self.J[n], axis=0), axis=1).max(), 0.12, n)
        for n in ['lh', 'th']:
            self.assertLess(np.linalg.norm(np.diff(self.J[n], axis=0), axis=1).max(), 0.2, n)

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
