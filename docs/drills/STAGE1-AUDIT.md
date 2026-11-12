# Drill library audit (Stage 1)

All 30 drills were played in the app (headless Chromium, real 3D golfer, motion capture loaded) and a still was taken
at the end of every keyframe, with that frame's step, camera, labels and verdict written underneath. Every contact
sheet was looked at. The written text of every drill was read against its demo.

## What is wrong across the whole library

| Problem | How widespread |
|---|---|
| A "by" line naming a tour player, coach or magazine (e.g. "Collin Morikawa used this at the U.S. Open"). None is sourced; several claim a named player uses the drill. | 30 of 30 |
| Unsourced statistics ("7 in 10 amateurs", "36° vs 20°", "lose about 10%", tempo claims about named players) | 6 drills |
| Exactly 4 steps and 4 "feel" lines, whatever the drill needs | 30 of 30 |
| No success criteria, no progression to hitting balls, no equipment alternatives | 30 of 30 |
| Same swing template (`swing()`), so many drills show the same full swing | 13 drills |
| Face-on camera, even where the fault can only be seen from the side or above | 17 of 30 |
| An incorrect ("not this") demonstration | only 12 of 30, and 3 of those barely differ from the correct pose |
| Walking into position slides the feet across the ground | every drill that uses `walk`, `stance`, `tfx` or `lfx` |
| No visible difference between a slow rehearsal and a real-speed rep | 30 of 30 |
| Verdict badges sometimes on the wrong frame (e.g. "Hips stayed back" shown at the finish) | 3 drills |

## Drill by drill

Verdict: **Keep** (sound and mostly right), **Fix** (sound drill, demo or text wrong), **Rework** (demo does not show the drill).

| Drill | Purpose | Verdict | What's wrong |
|---|---|---|---|
| Club down the spine | Hip hinge at address | Fix (benchmark) | Camera from behind at 3/4, so the spine angle can't be read; club not clearly on the 3 contact points; the squat "not this" barely differs; no waist-bend comparison |
| Hand-hang distance | Distance from the ball | Keep | Hanging trail hand hard to see at this distance; the check is presented as a rule for every body type |
| Alignment-stick station | Aim and ball position | Rework (benchmark) | Toe-line stick lies under the toes; ball stick runs through the ball; no target, so "parallel" means nothing; shoulders never shown; golfer slides sideways into place |
| Spine-tilt check | Driver set-up tilt | Rework | Text says club upright at the chin, tilt until it touches the lead knee; the demo shows arms hanging and none of it |
| Chair drill | Early extension | Keep | Good ghost. Gap between the seat and chair; "7 in 10 amateurs" is unsourced |
| Water bottle | Early extension | Fix | Near-duplicate of the chair; bottle too small to see; "Hips stayed back" badge on the finish frame; no incorrect demo |
| Head against the wall | Head depth | Keep | Towel not drawn; dip ghost fine |
| Helicopter turns | Shoulder turn in posture | Fix (benchmark) | The "standing up" ghost overlaps the golfer from face-on, so it barely reads; no spine-angle reference |
| Umbrella outside trail foot | Sway | Keep | Clear sway ghost |
| Shadow drill | Head and sway | Fix | Balls tiny; steps 1 and 2 identical |
| Step-back setup | Width and centring | Rework | Demo never shows feet together or the step |
| Trail shoulder behind your head | Fuller shoulder turn | Keep | OK from above |
| Trail pocket back | Hip turn | Fix | A generic swing; no incorrect demo; overlaps the previous drill |
| Thumb-grip top check | Arm structure at the top | Fix | Half-way pose shows the arms in a T; needs a close view of the hands |
| Lead-arm-only swings | Lead arm / chicken wing | Keep | Clear chicken-wing ghost |
| Stop at the top | Transition | Fix | Identical animation to the tempo drill |
| Tour Tempo 3-to-1 | Tempo | Fix | "Tour Tempo" is a commercial programme's name; claims about named players |
| Feet-together swings | Balance | Keep | No incorrect demo |
| Stick over the ball | Over the top | Rework | The stick lies flat on the ground instead of angled over the ball, so the drill can't be understood |
| Headcover outside the ball | Over the top | Keep | Placement plausible |
| Two-ball gate | Path | Fix | Balls drawn as tiny dots |
| Glove under trail arm | Connection | Fix | Generic swing; listed as an over-the-top fix, which is a stretch |
| Trail heel down | Early extension | Keep | |
| Step-through finish | Weight transfer | Rework (benchmark) | The step is barely visible and the foot slides; no incorrect demo |
| Two sticks for weight shift | Hip shift vs slide | Keep | Clear slide ghost |
| Belt-loop stick click | Hip rotation at impact | Keep | "36° vs 20°" statistic unsourced |
| Impact position hold | Impact | Rework (benchmark) | No impact bag shown; ground sticks barely visible; no incorrect (flip) demo |
| Split-hand pump | Arm extension | Fix | Hands don't visibly split |
| Doorway head check | Head moving forward | Keep | Clear ghost |
| Hold the finish | Balance | Keep | Good count and ghost; claims about named players |

Near-duplicate groups (to be given distinct jobs, not deleted): over the top (stick over, headcover, two-ball gate,
glove); early extension (chair, bottle, heel down); head (wall, doorway, shadow); turn (helicopter, trail shoulder,
trail pocket); tempo (stop at the top, 3-to-1); weight shift (step-through, two sticks, belt click, impact hold).

## Benchmark five

| Coaching type | Drill | Why this one |
|---|---|---|
| Setup and posture | Club down the spine | Needs a side-on camera, a prop on the body and a body-shape comparison (hinge vs bend from the waist) |
| Alignment and position | Alignment-stick station | Needs an overhead/behind camera, ground props, a target, and a comparison of something other than the body's shape (aim) |
| Backswing and rotation | Helicopter turns | A special pose (arms out) rather than a swing; the test is the turn in posture |
| Downswing and weight transfer | Step-through finish | Lower-body movement and a real step: tests that feet can lift and move without sliding |
| Impact | Impact position hold | Needs a training aid (impact bag), a held key position, a clear wrong version (flip) and progression to shots |

These five exercise different cameras, props, poses and comparison types, so what is built for them carries to the rest.
