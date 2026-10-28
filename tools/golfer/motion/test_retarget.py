import os, unittest
import numpy as np
import bvh, measure, retarget
HERE = os.path.dirname(os.path.abspath(__file__))
MESH = os.environ.get('GOLFER_MESH', '/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad/site/golfer-mesh.wasm')

class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        names, pos, ft = bvh.load(os.path.join(HERE, 'cmu', '64_08.bvh')); cls.fps = 1 / ft
        cls.ph = measure.phases(names, pos, cls.fps)
        cls.world = retarget.to_world(names, pos, cls.ph)
        cls.bones = retarget.golfer_bones(MESH)
        cls.J = retarget.to_golfer(cls.world, names, cls.bones, cls.ph, cls.fps)
        cls.names = names

    def test_target_line_is_plus_x(self):
        a = self.ph['address']; J = self.J
        self.assertGreater(J['lhip'][a, 0], J['thip'][a, 0]); self.assertGreater(J['la'][a, 0], J['ta'][a, 0])
        self.assertGreater(((J['lh'][a] + J['th'][a]) / 2)[2], J['pel'][a, 2])

    def test_feet_on_ground(self):
        a = self.ph['address']; J = self.J
        for k in ('la', 'ta'): self.assertTrue(0.06 <= J[k][a, 1] <= 0.09, (k, J[k][a, 1]))
        for k in ('lt', 'tt'): self.assertLess(abs(J[k][a, 1] - 0.02), 0.01, (k, J[k][a, 1]))

    def test_bone_lengths_constant(self):
        J, B = self.J, self.bones
        for s in 'lt':
            for a_, b_, n in [(s + 'hip', s + 'k', 'thigh'), (s + 'k', s + 'a', 'shin'), (s + 's', s + 'e', 'uarm'), (s + 'e', s + 'w', 'forearm')]:
                L = np.linalg.norm(J[a_] - J[b_], axis=1)
                self.assertLess(np.abs(L - B[n]).max(), 0.002, (a_, b_))

    def test_directions_kept(self):
        # arms keep the captured directions exactly; legs bend a little differently because the feet are pinned
        ix = {n: i for i, n in enumerate(self.names)}; W = self.world; moving = slice(self.ph['takeaway'], self.ph['finish'])
        def maxang(cap, ret):
            c = (cap * ret).sum(1) / np.linalg.norm(cap, axis=1) / np.linalg.norm(ret, axis=1)
            return np.degrees(np.arccos(np.clip(c[moving], -1, 1))).max()
        self.assertLess(maxang(W[:, ix['LeftForeArm']] - W[:, ix['LeftArm']], self.J['le'] - self.J['ls']), 1.0)
        self.assertLess(maxang(W[:, ix['RightHand']] - W[:, ix['RightForeArm']], self.J['tw'] - self.J['te']), 1.0)
        self.assertLess(maxang(W[:, ix['LeftFoot']] - W[:, ix['LeftLeg']], self.J['la'] - self.J['lk']), 15.0)

    def test_planted_feet_dont_slide(self):
        # the ball of each foot stays put from address to the top (the lead heel may lift, as it does in the capture)
        a, t = self.ph['address'], self.ph['top']
        for k in ('lt', 'tt'): self.assertLess(np.linalg.norm((self.J[k][a:t + 1] - self.J[k][a])[:, [0, 2]], axis=1).max(), 0.02, k)

if __name__ == '__main__': unittest.main()
