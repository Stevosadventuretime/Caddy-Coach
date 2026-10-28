# Real Swing Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The drill golfer's full swing plays real motion-captured movement, adjusted towards tour averages, in every drill.

**Architecture:** An offline Python tool turns a CMU motion-capture swing into `swing-model.json`: per-frame joint positions in the drill rig's world and joint names, retargeted to the golfer's bone lengths and adjusted for tempo and turn. `drillstudio.js` loads it and gets joints from a single `jointsAt(dr, t)`. Plain standard swing keys play the captured frames; keys with overrides keep the parametric rig; changes between the two blend joint positions.

**Tech Stack:** Python 3 + numpy/scipy (tool), plain JS (three.js r128 app), node for JS unit tests, Playwright for app tests.

**Spec:** `docs/superpowers/specs/2026-10-28-real-swing-motion-design.md`

**Where things live:** app sources are edited in the scratchpad (`$S = /tmp/claude-0/-home-claude/2adf77d1-861f-56c4-a071-a71d0d17c501/scratchpad`): `$S/site/*.js`, `/mnt/user-data/outputs/golf-coach.html`, `$S/build_standalone.py`. `python3 $S/build_standalone.py` builds `$S/standalone/caddy-coach`, which is copied into the repo `/home/claude/caddy-coach` to publish. The tool and its tests live in the repo under `tools/golfer/motion/`. The CMU files are already in `$S/cmu/64_01.bvh … 64_10.bvh`. Starting points exist in `$S/mocap/bvh.py` (BVH reader with forward kinematics), `$S/mocap/kin.py` (phase detection and turn angles) and `$S/mocap/rigpy.py` (Python port of the rig, checked equal to the JS).

## Global Constraints

- World: x toward the target (lead side), y up, z toward the ball; right-handed; metres; feet on the ground at y = 0.
- Output joint names are exactly the rig's: `pel, s, H, Lt, F, neck, head, face, ls, le, lh, ts, te, th, lhip, thip, lk, tk, la, ta, lt, tt, lhl, thl, club, hands, clubhead, seat, bum, Fh, belt`. (`s, H, Lt, F, face, Fh` are unit vectors; `club` and `belt` are pairs of points.)
- Targets: tempo 3:1 (backswing ≈ 0.75 s, downswing ≈ 0.25 s); at the top shoulders ≈ 90°, hips ≈ 45° (about the spine); at impact hips ≈ 40° open, shoulders 20–25° open; chest facing the target at the finish. Within ±5° and ±0.3 of tempo.
- Club length 0.89 m (the rig's `clen`).
- No size limit on `swing-model.json` for now (Owen, 28 Oct).
- If `swing-model.json` is missing or fails to load, every drill behaves exactly as today.
- No new JS libraries. Credit line in CREDITS.txt: "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217."

## Review Focus

- Left-handed golfers (`DrillStudio.setMirror(true)`): the motion must mirror exactly like the rig does today.
- A drill segment that's shorter or longer than the captured move (e.g. `{k:'top', d:0.4}`): the captured frames play stretched to fit, landing exactly on the key pose at the end of the segment.
- Moves that run backwards or skip phases (finish → address, address → impact, top → address): no snapping; they blend smoothly.
- Scrubbing, step jumps and slow-mo: `jointsAt` depends only on `t`, so the same `t` always gives the same pose.
- "Not this" keys (`badge.tone === 'bad'` without `self`) that copy the previous key's pose: the golfer holds the previous motion pose and the ghost shows the rig fault.

---

### Task 1: Read and measure the CMU swings, choose one

**Files:**
- Create: `tools/golfer/motion/bvh.py` (from `$S/mocap/bvh.py`), `tools/golfer/motion/measure.py`
- Test: `tools/golfer/motion/test_measure.py`

**Interfaces:**
- Produces: `bvh.load(path) -> (names: list[str], pos: ndarray[F, J, 3], frame_time: float)` (frame 0, the T-pose, already dropped; positions in metres with y up).
- Produces: `measure.phases(names, pos, fps) -> dict(address:int, takeaway:int, half:int, top:int, down:int, impact:int, through:int, finish:int)`.
- Produces: `measure.turns(names, pos, ph) -> dict(shTop, hipTop, shImp, hipImp, shFin, hipFin, tempo, back_s, down_s)` (degrees about the spine axis, positive = turned back).
- Produces: `measure.choose(paths) -> path` (the best of 64_01…64_10: smallest weighted distance to the targets, rejecting any swing with a glitch frame where a joint jumps > 0.15 m between frames or a planted foot slides > 3 cm during address).

- [ ] **Step 1: Write the failing tests**

```python
def test_units_and_height():   # 64_06: standing height 1.55–1.95 m, feet within 3 cm of y=0 at address
def test_phases_in_order():    # 64_06: address < takeaway < half < top < down < impact < through < finish
def test_phase_timing():       # 64_06: back_s within 0.6–0.85, down_s within 0.35–0.6 (measured earlier: 0.72, 0.51)
def test_turns_measured():     # 64_06: shTop > hipTop > 20, hipImp < 0 (open)
def test_choose_returns_a_swing():  # choose(all ten) in the ten paths and not rejected for glitches
```

- [ ] **Step 2: Run** `cd tools/golfer/motion && python3 -m pytest test_measure.py -q`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `bvh.py` (copy, add metres conversion: scale so the T-pose in frame 0 measures 1.75 m from sole to head top (the exact size doesn't matter, Task 2 rescales to the golfer), then drop frame 0) and `measure.py` (port phase detection from `$S/mocap/kin.py`: address = last frame with hands within 3 % of their lowest before the top; top = highest hands before the fastest hand speed; impact = lowest hands within 0.9 s after the top; finish = highest hands within 1.2 s after impact; takeaway/half/down/through = when the hands pass 25 % / 60 % of the address-to-top height on the way up, 60 % on the way down, and 60 % after impact). Turns are measured about the address spine axis (pelvis → mid-shoulders), not flat.
- [ ] **Step 4: Run tests.** Expected: PASS. Print the measurements for all ten and the chosen file.
- [ ] **Step 5: Commit** `feat(motion): read and measure CMU golf swings`.

### Task 2: Convert to the drill world and retarget to the golfer

**Files:**
- Create: `tools/golfer/motion/retarget.py`
- Test: `tools/golfer/motion/test_retarget.py`

**Interfaces:**
- Consumes: Task 1 `bvh.load`, `measure.phases`.
- Consumes: golfer bone lengths from the header of `$S/site/golfer-mesh.wasm` (`'CCG1'`, uint32 JSON length, JSON `meta.bones[{n,h,t}]`).
- Produces: `retarget.to_world(names, pos, ph) -> ndarray[F, J, 3]` (rotated so the address target line is +x and the golfer faces +z, mid-ankles at x = 0, z = 0, ground at y = 0).
- Produces: `retarget.to_golfer(world, names, bones) -> dict[str, ndarray[F,3]]` with keys `pel, lhip, thip, lk, tk, la, ta, lt, tt, lhl, thl, neck, head, ls, le, lh, ts, te, th` (positions only).

- [ ] **Step 1: Write the failing tests**

```python
def test_target_line_is_plus_x():   # at address: lhip.x > thip.x, la.x > ta.x, hands.z > pel.z
def test_feet_on_ground():          # at address: min(la.y, ta.y) within 0.06–0.09 (ankle height), toes within 1 cm of y=0.02
def test_bone_lengths_constant():   # thigh, shin, upper arm, forearm lengths equal the golfer's (from golfer-mesh.wasm) within 2 mm in every frame
def test_directions_kept():         # angle between captured and retargeted shin direction < 1° in every frame
def test_planted_feet_dont_slide(): # address→top: lead and trail ankle move < 2 cm
```

- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** Scale to the golfer's height from the mesh (head top to sole), then rebuild each chain outwards from the pelvis (hips → knees → ankles → toes) and from the mid-shoulders (shoulders → elbows → wrists), keeping each captured segment direction and using the mesh bone length (`thigh, shin, foot, uarm, farm+ftw, clav`). Lock planted feet: while a foot's speed is below 0.05 m/s, hold its ankle at the mean planted position and re-solve that leg with the same two-bone IK as `rigpy.ik` (knee pole = captured knee direction).
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(motion): convert CMU swing to the drill world and the golfer's proportions`.

### Task 3: Tour adjustments, club, and the motion file

**Files:**
- Create: `tools/golfer/motion/adjust.py`, `tools/golfer/motion/make_swing.py`
- Test: `tools/golfer/motion/test_adjust.py`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `adjust.retime(J, ph, fps) -> (J, ph)` (piecewise time warp: address hold kept ≤ 0.6 s, backswing 0.75 s, top pause kept, downswing 0.25 s, follow-through and finish at their natural speed; resampled to 60 fps).
- Produces: `adjust.turns(J, ph) -> J` (rotates the upper body (shoulders, arms, neck, head) about the spine axis and the pelvis/hips about vertical, by `target − measured` at each phase, blended between phases with smoothstep; legs re-solved with IK so the feet stay put).
- Produces: `adjust.club(J, ph) -> J` (adds `club, hands, clubhead`; shaft through lead hand → trail hand, length 0.89 m; a wrist correction ≤ 15° keeps the clubhead within 3 cm of the ball at address and impact; the ball position is the address clubhead).
- Produces: `adjust.frames(J) -> J` (adds `s, H, Lt, F, face, Fh, belt, seat, bum, chest` from the positions, defined as in `rig()` in `drillstudio.js`: `H` = unit lhip−thip, `s` = unit pel→neck, `Lt` = unit ls−ts, `F` = unit Lt×s, `face` from the head's forward direction).
- Produces: `make_swing.py <out.json>` writing `{"v":1, "fps":60, "phases":{address,takeaway,half,top,down,impact,through,finish: frame}, "ball":[x,y,z], "frames":[{joint: [x,y,z] | [[x,y,z],[x,y,z]]}], "credit":"CMU mocap 64_NN"}` with positions rounded to 1 mm and vectors to 4 decimals.

- [ ] **Step 1: Write the failing tests**

```python
def test_tempo():          # (top - takeaway… address) / (impact - top) in 2.7–3.3; downswing 0.22–0.28 s
def test_turn_targets():   # at top: shoulders 85–95°, hips 40–50°; at impact: hips -35 to -45°, shoulders -18 to -27°; at finish chest faces within 25° of +x
def test_club_at_ball():   # |clubhead - ball| < 0.03 m at address and impact; |club| = 0.89 m ± 1 mm every frame
def test_no_jumps():       # every joint moves < 0.12 m between consecutive 60 fps frames
def test_file_schema():    # make_swing output: every frame has every Global Constraints joint name; phases in order
```

- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** the four functions and `make_swing.py` (choose → load → to_world → to_golfer → retime → turns → club → frames → write). Write the file to `$S/site/swing-model.json`.
- [ ] **Step 4: Run tests.** Expected: PASS. Then run `python3 make_swing.py $S/site/swing-model.json` and print the measured targets from the output.
- [ ] **Step 5: Commit** `feat(motion): tour-adjusted swing with club, written as swing-model.json`.

### Task 4: Drill Studio plays the motion

**Files:**
- Modify: `$S/site/drillstudio.js` (`prep` ~l.116, `sampleAt` ~l.129, `pathFor` ~l.573, player draw ~l.605 and l.631, `poster` ~l.652, `api` l.665)
- Test: `tools/golfer/motion/test_drill_motion.js` (node, loads `drillstudio.js` with `vm` and `THREE: null` as in `$S/mocap/rigcheck.js`)

**Interfaces:**
- Consumes: Task 3 `swing-model.json` schema.
- Produces: `DrillStudio.setSwing(model | null)` (validates the schema; anything invalid → null), `DrillStudio.loadSwing(base) -> Promise<boolean>` (fetches `base + 'swing-model.json'`; false on any failure), `DrillStudio.jointsAt(dr, t) -> J` (same shape as `rig()`).

Rules for `jointsAt` (the only decisions the tests pin):
- A key is *plain* when its `k` is one of `address, takeaway, half, top, down, impact, through, finish` and it has no `o`; its pose is the motion frame at that phase.
- Between two plain keys whose phases go forward (`address → top`, `top → impact`, `impact → finish`…), play the captured frames between the two phases, mapped linearly onto the segment (`key.lin` keeps linear; otherwise the captured timing already carries the easing).
- Any other pair (override keys, special poses, backwards or skipped phases) blends joint positions with the segment's easing between the two end poses, renormalising unit vectors.
- Holds keep the end pose. "Not this" keys use the previous key's pose as today.
- With no motion loaded, `jointsAt(dr, t)` equals `rig(sampleAt(dr, t).p)` exactly.
- Mirror: apply the same mirroring to motion joints that the rig's joints get today.

- [ ] **Step 1: Write the failing tests**

```js
test('no motion: identical to the rig', …)            // for 3 drills from drills.js, 50 times each: deep-equal rig(sampleAt().p)
test('plain key lands on the motion phase pose', …)    // {k:'top'} at its segment end: J.lh equals frames[phases.top].lh within 1 mm
test('override key keeps the rig', …)                  // {k:'address', o:{arms:'back'}} at segment end equals rig(pose('address',{arms:'back'}))
test('segment length stretches the capture', …)       // address→top with d:0.4 and d:1.2 both start at address and end on the top pose
test('backwards and skipped moves blend smoothly', …)  // finish→address and address→impact: max joint step between samples 1/120 s apart < 0.05 m
test('same t, same pose', …)                           // jointsAt(dr, t) twice, with other calls in between: equal
test('mirror', …)                                      // setMirror(true): J.lh.x equals −(unmirrored J.lh.x) for a plain key
test('bad model is ignored', …)                        // setSwing({v:1, frames:[]}) → behaves as no motion
```

- [ ] **Step 2: Run** `node --test tools/golfer/motion/test_drill_motion.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `setSwing`, `loadSwing`, `jointsAt`; replace `rig(s.p)` in the player draw and `poster` with `jointsAt(dr, t)`, and build `pathFor` from `jointsAt` samples across the segment. Leave the ghost (`rig(key.G)`) and `prep`'s ball/address uses on the rig, except the ball: when motion is loaded, `dr._ball` is the model's `ball`.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(drills): play real swing motion from swing-model.json`.

### Task 5: Wire it into the app and build

**Files:**
- Modify: `/mnt/user-data/outputs/golf-coach.html` (`load3D`: after `drillstudio.js` loads, call `DrillStudio.loadSwing('')` and, when it resolves true, dispatch `cc-golfer` so posters redraw)
- Modify: `$S/build_standalone.py` (copy `site/swing-model.json` as an asset; it's in the service-worker list and the version hash)
- Modify: `$S/CREDITS.txt` (the CMU credit line from Global Constraints)
- Test: `$S/qa/motion1.py` (Playwright, pattern of `$S/qa/drillshots.py`)

- [ ] **Step 1: Write the failing test** `qa/motion1.py`: opens the app, opens 5 drills (0, 1, 7, 9, 11), asserts `swing-model.json` was fetched with 200, `DrillStudio.jointsAt` exists, no page errors; with the request for `swing-model.json` blocked, the same drills open with no errors.
- [ ] **Step 2: Run** `PYTHONPATH=autologin python3 qa/motion1.py`. Expected: FAIL.
- [ ] **Step 3: Implement** the three changes; `python3 build_standalone.py`.
- [ ] **Step 4: Run** `qa/motion1.py` and the full `bash qa/suite.sh > qa/suite.log`. Expected: `FAILURES 0` in motion1; suite as before (known: `gps1`/`lv1` 401s from fake tokens; `auth1` passes on re-run).
- [ ] **Step 5: Commit** in the repo after copying the standalone build: `feat: drills use real swing motion`.

### Task 6: Look at it, then publish

**Files:**
- Test output: `/mnt/user-data/outputs/swing-motion-before-after.mp4`, `$S/qa/drills_motion.jpg`

- [ ] **Step 1: Render** the plain swing (address → top → impact → finish) face-on and down the line, before (rig) and after (motion), as a side-by-side video, plus stills at top, impact and finish. Check: no stretching, feet planted until the trail heel releases, club in the hands, clubhead at the ball at address and impact, finish facing the target.
- [ ] **Step 2: Screenshot all 30 drills** (`IDX=0..29 qa/drillshots.py`) and look at each, especially the special-pose drills (club down the spine, chair, wall, hanging arm, helicopter, walking).
- [ ] **Step 3: Publish:** copy the build into the repo, push (GitHub Pages), and publish the Claude version with `drillstudio.js` and `swing-model.json` in `files`. Check the live site loads `swing-model.json` (200) with `qa/live.py`.
- [ ] **Step 4: Commit** any fixes from the visual check with their own message.
