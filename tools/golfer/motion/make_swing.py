# Build swing-model.json for Drill Studio from the CMU golf swings: python3 make_swing.py OUT.json
import os, sys, glob, json
import numpy as np
import bvh, measure, retarget, adjust
HERE = os.path.dirname(os.path.abspath(__file__))
MESH = os.environ.get('GOLFER_MESH', '/tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad/site/golfer-mesh.wasm')
VEC = {'s', 'H', 'Lt', 'F', 'face', 'Fh', 'sd', 'lkp', 'tkp'}

def build():
    path = measure.choose(sorted(glob.glob(os.path.join(HERE, 'cmu', '64_*.bvh'))))
    names, pos, ft = bvh.load(path); fps = 1 / ft
    ph = measure.phases(names, pos, fps); W = retarget.to_world(names, pos, ph); B = retarget.golfer_bones(MESH)
    J = retarget.to_golfer(W, names, B, ph, fps)
    J, ph = adjust.retime(J, ph, fps); J = adjust.posture(J, ph, B); J = adjust.turns(J, ph, B); J = adjust.reach(J, ph, B); J, ball = adjust.club(J, ph); J = adjust.frames(J, ph, ball)
    return path, J, ph, ball

def to_json(path, J, ph, ball):
    n = len(J['pel']); keys = sorted(J)
    def r(v, k): return np.round(v, 4 if k in VEC else 3).tolist()
    frames = [{k: r(J[k][f], k) for k in keys} for f in range(n)]
    return {'v': 1, 'fps': 60, 'phases': ph, 'ball': np.round(ball, 3).tolist(), 'frames': frames,
            'credit': 'CMU mocap ' + os.path.basename(path)[:-4] + ' (mocap.cs.cmu.edu), tour-adjusted'}

if __name__ == '__main__':
    m = to_json(*build())
    with open(sys.argv[1], 'w') as fh: json.dump(m, fh, separators=(',', ':'))
    print('wrote', sys.argv[1], len(m['frames']), 'frames', m['phases'])
