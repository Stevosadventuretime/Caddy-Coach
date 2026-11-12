# The drill standard (from the Stage 2 benchmark)

Five drills were rebuilt first: Club down the spine, Alignment-stick station, Helicopter turns, Step-through
finish and Impact position hold. This page records what they settled, so the rest of the library can follow the
same standard without every drill looking the same.

## Written coaching

Every drill has these fields in `drills.js`, and the drill sheet shows them in this order:

| Field | Shown as | Rule |
|---|---|---|
| `aim` | the line under the name on the card | One sentence: what gets better. |
| `fault` | What it fixes | The fault in plain words, as the golfer would see or feel it. |
| `why` | Why it matters | What the fault does to contact, direction or distance. No statistics without a source. |
| `kit`, `kitAlt` | Kit, and a line under the facts | `kitAlt` always gives a home or no-kit alternative. |
| `setup` | Setup | Where to stand, where the ball, club or aid goes. |
| `steps`, `feel` | Step by step | As many steps as the drill needs (not always 4). One short feel per step. The demo shows every step. |
| `sense` | What you should feel | The physical sensation, including what a wrong feeling means. |
| `mistakes` | Common mistakes | `[mistake, fix]` pairs: what goes wrong, how to tell, what to do. |
| `rx` | Practice | Sets, reps, rest, and what to change as it gets easier. |
| `success` | You're doing it right when | Things the golfer can check, ideally without a coach. |
| `progress` | Take it to the ball | Rehearsal, then practice swings, half shots and full shots. |
| `note` | a note at the end | Where golfers differ. Every drill says what is personal rather than a rule. |
| `cat`, `level` | card and filters | Category and difficulty for browsing. |

Words to avoid: no named player or coach as using or teaching a drill, no "tour players do X" or "N in 10 amateurs"
claims, no left/right where it depends on the golfer's hand (say "to one side of the target", or add "for a
right-hander"). `tools/test_drills_content.js` checks this.

## Choreography

The demo follows what the drill teaches, not a template. The building blocks:

- **Start position** held long enough to read the labels (about 2 seconds), entered with `cut: true` so a loop
  doesn't animate from the last pose back to the first.
- **Slow rehearsal** (`pace: 'slow'`): the key move at roughly a third of real speed, with a chip on the picture.
- **Key position** (`pace: 'hold'`, often with `say`): the thing being taught, held 2 to 3 seconds, with labels and
  reference lines.
- **Not this**: a red ghost of the fault, held about 2.5 seconds, with its own red line or label so the difference is
  obvious. Only faults that look clearly different are shown.
- **Real speed** (`pace: 'real'`) and the step back to address.
- **Progression** where it helps: the impact drill cuts from the bag to a ball; the posture drill cuts from the club
  on the back to the club in the hands.

How each benchmark uses them:

| Drill | Shape |
|---|---|
| Club down the spine | start, slow hinge, hold with a plumb line, two faults (waist bend, squat), club in hand |
| Alignment station | view from behind the ball to the target, build the station stick by stick from above, shoulders vs feet fault, a real-speed shot down the line |
| Helicopter turns | arms out face-on, slow turn back in posture (side-on, spine and arm lines), hips, standing-up fault, slow turn through, a rhythm set with spoken counts |
| Step-through | slow swing with the weight moving, the trail foot actually stepping through, hold, hanging-back fault, real speed |
| Impact hold | bag, slow swing into it, 3-second hold from two angles, flip fault, firmer hit, cut to a ball and a half shot |

## Cameras

| View | Use |
|---|---|
| `side` (new) | posture: spine, hips and knees in profile, close |
| `dtl` | turn, plane, early extension |
| `face` | weight shift, sway, head movement, impact |
| `tqf` | hips open at impact |
| `line` (new) | behind the ball, looking down the target line to a flag |
| `over` (new) | straight down: feet, ball and sticks |
| `hands` (new) | close on the hands and club |

A drill uses one main view and changes only when the next point needs another angle (at most two or three).

## Animation system changes

All in `drillstudio.js` (and one line in `golfer.js`); every drill gets them:

- **Feet step instead of sliding.** When a foot is in a different place at the next key, it lifts, travels and lands
  inside its own part of the move; if both move, they go one after the other like walking. New `tyaw`/`lyaw` turn a
  foot (a foot that has walked through points at the target).
- **Standing up straight looks straight.** The "stand tall" correction used to tip an upright golfer forward 17°;
  upright poses now rise straight up.
- **Club down the spine lies on the back** (it was tilted about 10° off the spine and floating behind it).
- **Reference lines** (`ln`): spine, shoulder line, plumb lines, shaft line; drawn on the red ghost when red.
- **Pace chip** (`pace`) and **camera cuts** (`cut`).
- **Ghost props**: the red ghost carries its own club-down-the-spine or stick across the chest.
- **Props**: a target flag, a proper impact bag that gives when hit; keys can hide the ball (`noball`) and a hit can
  land in the bag (`bag`).

## Checks

- `node --test tools/test_drills_content.js` (coaching structure, no endorsements or statistics)
- `node --test tools/golfer/motion/test_drill_motion.js` (feet step, standing straight, club on the back, club length,
  arm reach, planted feet, ghosts)
- Contact sheets of every keyframe and the middle of every move, right- and left-handed, looked at by eye.
