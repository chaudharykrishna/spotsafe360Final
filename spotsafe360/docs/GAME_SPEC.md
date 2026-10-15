# SpotSafe 360 - game specification (final, Phase 7)

Version 1.0.0 freeze candidate, 13 Sep 2026. Owner: M1. Technical owner: M2 with agent.
This is the authoritative behaviour spec. Player-facing instructions live in
Prototype_Instructions.docx, next to this folder. Architecture decisions
live in ADR.md. Build history lives in PHASE_PLAN.md and CHANGELOG.md.

## 1. Product in one paragraph

A first-person hazard perception training game set in a constructed 3D warehouse
goods-in bay. The player walks the bay, finds nine hazards and one safe-practice
distractor, and learns the why and the control for each through short visual-first
feedback cards. Two modes (Training, Time Attack), three difficulties (Simple,
Standard, Expert), a short quick-check quiz between the round and the review, a
review screen with a top-down map and reaction times, a local top-five leaderboard, a full keyboard and screen-reader route (list mode), and a
WebXR VR entry with an honest desktop fallback. Runs offline from a folder, with
nothing to install and no personal data.

## 2. Pages and file map

- index.html: the portal. Pure DOM. Never loads the 3D engine; its CSP has no
  unsafe-eval. Name, six avatars, mode tiles, difficulty segment, Start Game,
  leaderboard, how-to-play overlay, privacy footer.
- game.html: the round. A-Frame scene, HUD, reticle, feedback card, pause, review,
  list-mode and VR-card overlays, engine-failure banner with self-diagnosis.
- js/boot.js: error collector loaded first on the game page.
- js/hazards.js: all content data. CONFIG (scoring, difficulties, bounds, colliders,
  quiz size and quiz points), HAZARDS (9), DISTRACTORS (1), LISTINGS (list-mode
  wording), QUIZ (10-question pool), STRINGS (all UI text).
- js/portal.js: portal logic, profile memory, leaderboard render, start redirect.
- js/app.js: world builders, hazard object builders, interaction, scoring, cards,
  audio, round flow, quick-check quiz, review, list mode, VR, engine guard and
  diagnostics.
- css/style.css: all styling, brand tokens, reduced-motion support.
- vendor/aframe.min.js: A-Frame 1.6.0, 1,405,369 bytes, SRI
  sha384-tVEbl7TUEnd3P8HoHIOqysRs2s8XW0iEfseiRgKkR9qRUtITLdOX+llejEgkop5S, loaded
  with a version query. img/: tex_floor.jpg, tex_wall.jpg (generated textures).

## 3. The bay

Room 36 by 24 by 8 m, origin at centre, x east positive, z south positive, eye
height 1.6 m. Textured floor and walls, ceiling with four light panels and nine
high-bay fixtures. Three rack bays on the west wall. Two dock doors on the north
wall with the trailer at dock 6. Yellow walkway lines at x 10.4 and 12.2 with a
post-and-rail barrier at 12.6. Fire exit door on the east wall, wall extinguisher,
charging point, mezzanine on four columns without rails in the south-west, three
scattered pallet stacks. Movement is clamped to bounds (x -17 to 17, z -10.5 to 11)
against 14 circular colliders every 33 ms.

## 4. Content: nine hazards, one distractor

Positions, radii, aim heights, categories and all wording are data in js/hazards.js.
H1 blocked fire exit (16.2, 2). H2 pedestrian in the vehicle lane (13.8, -2).
H3 forklift at the blind corner (-13.5, -8.5), sound clue. H4 chemical spill (9, -7.5).
H5 charging lead across the walkway (11.3, -4). H6 damaged rack upright (-15.4, 3.3).
H7 blocked extinguisher (16.8, -2.5), partially obscured. H8 worker at the unguarded
mezzanine edge (-8.6, 9.2), aim height 3.9. H9 worker on the pallet stack (2, 4),
aim height 2.6. D1 worker on the correct route (11, 6), distractor, good practice.
Categories: Fire and Emergency, Vehicle and Pedestrian, Housekeeping, Stacking and
Racking, Working at Height, Good practice.

## 5. Modes, difficulties, scoring

- Training: no clock. Hints on (see below). Ends when all nine are found.
- Time Attack: countdown per difficulty, red under 10 s. Ends at zero or all-found.
- Simple: hints after 15 s, 120 s, penalty 5. Standard: hints after 20 s, 90 s,
  penalty 5. Expert: no hints, 60 s, penalty 8.
- Plus 10 per hazard, once each. Plus 5 per correct quiz answer (section 8). Streak rises per consecutive find; any penalty
  resets it; best streak is tracked. Score floor 0. Guards: a wrong click within
  60 ms of a find, or within 80 ms of another wrong click, is ignored, so one
  gesture is charged at most once.
- Hints (Training only): after the delay, each unfound hazard's marker becomes a
  faint yellow wireframe (opacity 0.16). Found markers are green (0.35).
- Audio (synthesised, no files): find blip 880 Hz, distractor 330 Hz, wrong
  220 Hz; H3 beeps a two-tone 1250 Hz pair every 6 s until found, stereo-panned by
  head direction; mute button, persisted.

## 6. Interaction

- Hover: meshes shimmer (emissive overlay), pointer becomes a hand. Found-marker
  meshes are excluded so the green box never resets.
- Click: A-Frame cursor with rayOrigin mouse on the camera; hazard and distractor
  groups carry generous invisible hit boxes; clicks on room or props are wrong
  clicks.
- E flag: forward ray from the camera with per-hazard aim heights; angular
  threshold from the hazard radius plus 2 degrees; nearest candidate wins; if none,
  it counts as a wrong click - unless the dot is resting on a hazard already
  flagged, which costs nothing, as clicking one already does. Disabled while
  paused, round over, list open or the VR card is open.
- Feedback card: category icon and colour bar, title with score delta, one-line
  what; chevron expands why and control; click dismisses; auto-dismiss 8 s. The
  card is an aria-live region and rises above the list overlay when list mode is
  open.

## 7. Round flow

Portal Start Game redirects with name, avatar, mode, diff as URL parameters
(validated, name sanitised, defaults Training and Standard). Esc or the pause
button pauses: overlay with Resume, Restart round, Main menu; the wall-clock timer
freezes via pausedTotal accounting; beeps and timer callbacks skip while paused;
a hidden tab auto-pauses (visibilitychange). Round end (all-found or time-up):
beeps stop, intervals clear, the elapsed time is frozen, and the quick-check quiz
opens (section 8). When the quiz finishes, the review overlay opens with five stat
tiles (score, found, best streak, quiz, time), the SVG minimap and reaction chips,
and the round is saved to the leaderboard. The quiz runs before the save because
its points are part of the final score; quiz time never counts as round time. Replay reloads with the same parameters; Main menu
returns to the portal. While paused or over, all scoring paths are inert.

## 8. Quick-check quiz

Sits between the end of the round and the review, on both end paths (all-found and
time-up). CONFIG.quizCount questions (default 3) are drawn at random from the
10-question QUIZ pool in js/hazards.js, and each question's options are shuffled.
Every question names the hazard it teaches, so the quiz and the bay stay in step
when either is edited. The correct option is always written first in the data and
captured before the shuffle, so the answer cannot drift out of step with the order
shown.

One answer per question, guarded: the first click locks the question, so a second
click can neither add points nor change the marking. A correct answer adds
CONFIG.quizPerCorrect (default 5) to the score and blips at 880 Hz; a wrong answer
adds nothing and blips at 220 Hz. Either way both the chosen option and the correct
option are marked, and the explanation sentence is shown, so a wrong answer still
teaches. The Next question button appears only after an answer, and reads "See your
results" on the last question.

Accessibility: focus lands on the first option, moves to Next after answering, and
Tab is trapped inside the panel. The feedback area is an aria-live region. Escape
is inert here, because the round is already over and there is nothing to pause. The
whole quiz is completable with keyboard alone. Setting CONFIG.quizCount to 0 skips
the quiz and goes straight to the review, and the Quiz stat tile disappears with it.

## 9. Review screen

- Stat tiles: score, found out of nine, best streak, quiz score, elapsed time. The
  quiz tile is omitted when the quiz is switched off.
- Minimap: top-down SVG drawn from live data. Room outline, dock doors, fire exit,
  mezzanine, walkway lines, collider blobs, spawn point, north arrow. Hazards as
  labelled discs: green with a tick when found, red with a cross when missed.
  Distractor as a yellow ring. Carries a text alternative for screen readers.
- Chips: every found hazard in find order with reaction seconds from round start
  (one decimal); missed hazards after, labelled Missed.

## 10. List mode (accessibility route)

HUD button opens a dialog listing all ten items in a per-round shuffled order.
Each entry: position line and perception line from LISTINGS, never the hazard
name, so the call stays a judgement. The list navigates, it does not score:
Take me there closes the list, walks the camera to a standoff of the item
radius plus CONFIG.locate.standoffM off the spot (bounds and colliders applied
to the standing point), turns it to face the aim point over CONFIG.locate.glideMs
(instant under prefers-reduced-motion), lights a blue locator box on the spot
and announces the place in an aria-live banner, both for CONFIG.locate.holdSec.
Scoring then happens in the bay only, by click or E, so there is one scoring
path for every player. A settled row keeps its button and gains a status line:
Flagged or Called safe, with the name. Esc closes; Tab focus is trapped; a
complete round is playable with keyboard only and works with a screen reader.

## 11. VR

A-Frame's built-in VR button is disabled; the HUD VR button checks
navigator.xr.isSessionSupported for immersive-vr. Supported: scene.enterVR().
Unsupported or absent: a card explains exactly what is needed (WebXR browser,
headset) and states the desktop routes. Escape closes the card; the E flag is
inert while it is open.

## 12. Persistence, privacy, security

localStorage only, keys ss360_profile, ss360_scores (capped 50 rows, sorted, top
five displayed; each row carries name, avatar, score, found, mode, difficulty,
round seconds and the quiz result), ss360_mute. No cookies, analytics or network calls at runtime.
CSP on both pages: default-src self; game.html additionally allows unsafe-eval in
script-src because the A-Frame engine compiles small code strings at startup
(root cause of the 11 Sep incident, recorded in CHANGELOG); style-src allows
unsafe-inline. The vendored script tag carries a version query. (Amended 23 Sep 2026, ADR-004: the SRI attribute was removed from the tag because Chromium browsers refuse it on pages opened from disk; the engine guard still checks size and SHA-384 on failure.)

## 13. Engine guard and diagnostics

boot.js collects load and runtime errors before anything else. On DOM ready, if
AFRAME is absent the loader re-injects the engine with a cache-busting query and
the SRI hash. If that fails, the banner diagnoses in order: no WebGL; truncated
file (byte count); altered file (SHA-384 via WebCrypto); CSP or EvalError block
(named in one sentence); engine crash; script-tag interception; and gives the
exact remedy for each, with a Try again button.

## 14. Debug tools

game.html?debug=1 (no slash before the question mark): yellow rings for colliders,
green rings for hazard pick areas, bounds edges, and two console tables (colliders,
item positions). Used by the playtest pack.

## 15. Known limitations (by design)

Desktop-first: phones have no keyboard, list mode is the mobile and accessible
route - it walks the camera to any listed place, and the flag is a tap or E on
the spot it faces. Embedded frames use drag-look, full tabs use pointer lock. Leaderboards do
not cross browsers, origins or file/server modes. No multiplayer, no accounts, no
server: all per ADR-002 and the brief. Difficulty numbers are design defaults;
playtest tuning is an open item until the four-member session runs.

## 16. Version

1.0.0 freeze candidate, 13 Sep 2026, commits fc7da88 to 93acf50 plus the Phase 7
documentation commits. Supersedes: the deleted photo-panorama prototype (never
shipped) and the two deleted earlier A-Frame attempts (v0.11.0, v1.0.0-old).
