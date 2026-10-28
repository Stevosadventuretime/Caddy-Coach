# Real swing motion for the drill golfer

## Why

The 3D golfer in Drill Studio moves by blending between a handful of hand-made poses (address, top, impact, finish),
driven by about a dozen simple controls (bend, turn, arm swing and so on). The result looks robotic: the timing is
even, the legs barely work, the trail foot never really releases, and the finish never fully rotates. Owen wants the
golfer to move like a real person, because unnatural movement is what most gives away a 3D figure.

A test that drove the golfer from Owen's own phone videos showed that the simple controls can't express real motion
(the finish and leg action were lost). Owen chose to give the golfer a proper motion skeleton, moved joint by joint.

## Goals

- The full swing in every drill is real human motion: legs, hips, trail-foot release, a fully rotated finish.
- The model swing teaches good technique: tempo and key positions in line with published tour averages.
- Drills keep everything they have now: labels pinned to the body, hand-path traces, red "not this" ghosts,
  camera angles, steps, slow-mo.

## Non-goals

- Turning Owen's video tracking into a feature (it's kept for a later "your swing vs the model" comparison).
- Separate swings per club (driver, wedge). One iron swing for now.
- Changing what any drill teaches, or its steps and text.

## Anti-goals (a failure even if it works)

- Copying a named player's swing or using broadcast footage.
- Drills loading noticeably slower: the motion file stays under 100 KB.
- Breaking the drills that use special poses (club down the spine, arms crossed, chair, wall, walking, hanging arm).

## Source motion

CMU Graphics Lab Motion Capture Database, subject 64, swings 64_01 to 64_10 (BVH conversion by Bruce Hahne,
120 fps, 31 joints). Licence: "free for use in research and commercial projects worldwide"; credit goes in
CREDITS.txt ("The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with
funding from NSF EIA-0196217."). Measured: backswing about 0.7 s, downswing about 0.5 s (ratio about 1.4:1),
shoulders about 70° and hips about 35° turned at the top (measured flat), hips about 50° open at impact.
It's a competent but gentle swing.

## Approaches considered

1. **Joint tracks from motion capture, adjusted towards tour numbers** (chosen). Use real optical capture for
   natural whole-body movement; re-time it and adjust key angles in joint space to match tour averages.
   Trades some authenticity (the adjustments are ours) for a swing worth copying.
2. **Joint tracks from Owen's videos.** Real, but two unsynchronised phone angles give rough depth and blur through
   impact, and the swing has amateur habits that every user would copy. Kept for later comparisons.
3. **Keep the simple controls, borrow only the timing.** Cheap, but leaves the robotic positions. Rejected by Owen.

## Design

### Offline tool: `tools/golfer/mocap.py`

Reads the CMU BVH files and writes `swing-model.json` for the site.

1. **Pick the swing.** Measure all ten swings; choose the one closest to the targets below with clean data
   (no marker glitches or foot slide).
2. **Convert to the app's world.** Metres, y up, x toward the target, z toward the ball, right-handed, feet on the
   ground at y = 0, centred like the drill rig's address (ankles at x = ±stance).
3. **Retarget to the golfer's proportions.** Scale to the golfer's height, then rebuild each limb from the hip and
   shoulder outwards, keeping the captured directions but the golfer mesh's bone lengths, so poses don't stretch.
4. **Adjust towards tour averages,** blended smoothly by swing phase so nothing jumps:
   - tempo 3:1 (backswing about 0.75 s, downswing about 0.25 s); the address, top pause and finish hold keep their
     natural timing
   - shoulders about 90° and hips about 45° turned at the top (measured about the spine); hips about 40° open and
     shoulders about 20–25° open at impact; chest facing the target at the finish
   - done by rotating the upper body (and arms with it) about the spine, and the pelvis about vertical, by the
     difference from the captured angle at that phase
5. **The club.** Capture has no club, so the shaft runs from the lead hand through the trail hand and on to
   the clubhead (club length from the rig, 0.89 m), with the clubhead held at the ball at address and impact by a
   small wrist correction.
6. **Output:** the same joint names the rig produces (`pel, s, H, Lt, F, neck, head, face, ls, le, lh, ts, te, th,
   lhip, thip, lk, tk, la, ta, lt, tt, lhl, thl, club, hands, clubhead, seat`), sampled at 60 fps for the swing,
   rounded to millimetres, plus the frame numbers of the standard phases (address, takeaway, half, top, down,
   impact, through, finish).

### In the app (`drillstudio.js`)

- Load `swing-model.json` with the golfer; if it's missing or fails, everything works exactly as today.
- A key that uses a standard swing pose **without overrides** (`{k: 'top'}`) takes its joints from the motion
  file at that phase. Moving between two such keys plays the captured frames in between, using real timing within
  the drill's segment length, instead of blending controls.
- A key **with overrides** (`{k: 'address', o: {arms: 'back'}}`) or a special pose keeps today's rig. Moves into or
  out of it blend joint positions over the segment.
- One function gives the joints at any moment (`jointsAt(dr, t)`). The golfer, labels, hand-path traces, arrows and
  camera all use it, so overlays stay attached to the body.
- The red fault ghost stays on the rig (it shows a deliberate fault pose).
- The simple stick-figure fallback (no WebGL) is unchanged.

## Constraints

- Plain JS, no new libraries; works offline (the file is cached by the service worker like the other golfer files).
- Motion file under 100 KB.
- Existing tests pass; drill screenshots are compared before and after.

## How we'll know it worked

- Side-by-side frames (top, impact, finish) from face-on and down-the-line, compared with the hand-made swing.
- Measured from the output: tempo about 3:1; turn angles within about 5° of the targets.
- Bone lengths constant throughout (no stretching); feet don't slide while planted.
- All 30 drills open and play without errors; a visual check of the special-pose drills.

## Left to the builder

- Exact phase detection thresholds, smoothing, and how the wrist correction is weighted.
- The 60 fps sampling and rounding, if the size budget allows more or needs less.
