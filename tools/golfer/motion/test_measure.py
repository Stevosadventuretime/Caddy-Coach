import os, glob, unittest
import numpy as np
import bvh, measure
CMU = os.environ.get('CMU_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cmu'))
SW6 = os.path.join(CMU, '64_06.bvh')
ALL = sorted(glob.glob(os.path.join(CMU, '64_0*.bvh')) + glob.glob(os.path.join(CMU, '64_10.bvh')))

class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.names, cls.pos, cls.ft = bvh.load(SW6)
        cls.ix = {n: i for i, n in enumerate(cls.names)}
        cls.ph = measure.phases(cls.names, cls.pos, 1 / cls.ft)

    def test_units_and_height(self):
        a = self.ph['address']; p = self.pos[a]
        sole = p[:, 1].min()                                        # the lowest point of either foot (toe end sites)
        top = self.pos[0, self.ix['Head'], 1] - sole
        self.assertTrue(1.30 < top < 1.95, top)                       # bent over at address, so a bit under standing height
        self.assertLess(abs(sole), 0.03)
        self.assertLess(abs(p[self.ix['LeftToeBase'], 1]), 0.05)

    def test_phases_in_order(self):
        k = ['address', 'takeaway', 'half', 'top', 'down', 'impact', 'through', 'finish']
        v = [self.ph[x] for x in k]
        self.assertEqual(v, sorted(v)); self.assertEqual(len(set(v)), len(v))

    def test_phase_timing(self):
        t = measure.turns(self.names, self.pos, self.ph)
        self.assertTrue(0.6 <= t['back_s'] <= 0.85, t['back_s'])
        self.assertTrue(0.35 <= t['down_s'] <= 0.6, t['down_s'])

    def test_turns_measured(self):
        t = measure.turns(self.names, self.pos, self.ph)
        self.assertGreater(t['shTop'], t['hipTop']); self.assertGreater(t['hipTop'], 20); self.assertLess(t['hipImp'], 0)

    def test_choose_returns_a_swing(self):
        self.assertEqual(len(ALL), 10)
        c = measure.choose(ALL)
        self.assertIn(c, ALL)
        n, p, ft = bvh.load(c)
        self.assertFalse(measure.glitchy(n, p, measure.phases(n, p, 1 / ft)))

if __name__ == '__main__': unittest.main()
