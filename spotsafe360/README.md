# SpotSafe 360

Hazard perception training in a constructed 360° warehouse goods-in bay.
Built by **Multiply** (Team 4: Pawan Pandey, Bishal Thapa, Krishna Chaudhary,
Rijan Karki) for the CET257 Enterprise Project, University of Sunderland,
delivered at ISMT College.

**Spot the hazard. Learn the fix. Keep the bay safe.**

---

## Run it

1. **Live link (easiest):** https://chaudharykrishna.github.io/spotsafe360/
2. **From the folder:** double-click `index.html`. Tested by double-click in a
   Chromium browser (Chrome and Edge are Chromium-based); Firefox allows local
   files by default. No installer, no build step, no administrator rights.
3. **From a local server** (used for live demonstrations):

```
python -m http.server 8000
```

then open <http://127.0.0.1:8000>.

## Controls

| Action | How |
|---|---|
| Look around | Move the mouse, or drag if the pointer is free |
| Move | `W` `A` `S` `D` or the arrow keys |
| Flag a hazard | Click it, or aim the centre dot and press `E` |
| Expand a teaching card | The chevron on the right of the card |
| Pause | `Esc`, or the pause button |
| List mode (keyboard route) | The list button, top right |
| Walk to a listed place | The **Take me there** button in list mode |
| Mute | The speaker button, top right (remembered) |
| VR | The headset button, top right |

Add `?debug=1` to `game.html` for collider rings, hazard pick areas and two
console tables. That is a development view, not a demo view.

## What is in the bay

Nine hazards and one deliberate non-hazard:

| | Hazard | Category |
|---|---|---|
| H1 | Blocked fire exit | Fire and Emergency |
| H2 | Pedestrian in the vehicle lane | Vehicle and Pedestrian |
| H3 | Forklift at the blind corner (sound clue) | Vehicle and Pedestrian |
| H4 | Chemical spill on the floor | Housekeeping |
| H5 | Charging lead across the walkway | Housekeeping |
| H6 | Forklift-damaged rack upright | Stacking and Racking |
| H7 | Blocked fire extinguisher | Fire and Emergency |
| H8 | Worker at the unguarded mezzanine edge | Working at Height |
| H9 | Worker standing on pallets | Working at Height |
| **D1** | **Worker on the correct route** | **Good practice — flagging it costs points** |

D1 is the point of the product. A scene where everything clickable is a hazard
trains clicking; planting a worker who is doing everything right, and penalising
flagging them, forces a judgement instead of a sweep.

A round ends when all nine are found or the Time Attack clock reaches zero, then
a three-question quick-check quiz runs, then the review screen opens with a
top-down map of what was found and missed and a reaction time per hazard.

## Layout

```
index.html        portal — pure DOM, never loads the 3D engine
game.html         the scene
css/style.css     all styling, brand tokens, reduced-motion support
js/boot.js        error collector, loaded first
js/hazards.js     ALL CONTENT: CONFIG, HAZARDS, DISTRACTORS, QUIZ, LISTINGS, STRINGS
js/portal.js      profile, leaderboard, start redirect
js/app.js         world builder, interaction, scoring, quiz, review, engine guard
vendor/           A-Frame 1.6.0, pinned (size and SHA-384 checked by the engine guard)
img/              floor and wall textures
docs/             specification, decision records, phase plan, test pack
```

**Content is data, not code.** Every hazard, explanation, list-mode description,
quiz question and interface string lives in `js/hazards.js`. Changing what the
product teaches never means opening code. Set `CONFIG.quizCount` to `0` to skip
the quiz entirely.

## Design rules this codebase keeps

- **The portal never loads the 3D engine.** A blocked or broken engine degrades
  the product instead of destroying it, and the portal's CSP is stricter as a
  result.
- **Failure explains itself.** If the engine will not start, the guard checks the
  library's byte length and SHA-384 fingerprint and names which of six causes it
  was, with the remedy — rather than showing a blank screen.
- **The accessible route is the same route.** List mode navigates rather than
  scores: **Take me there** walks the camera to the place and turns it to face
  the spot, and the flag is then made in the bay with a click or `E`. Every
  player, keyboard or mouse, scores through the one code path, which is what
  stops the accessible route from quietly rotting.
- **A wrong answer teaches.** A wrong flag earns the same quality of card as a
  right one; a wrong quiz answer still reveals and explains the correct one.
- **Nothing leaves the device.** localStorage only (`ss360_*`). No accounts, no
  cookies, no network call at runtime.

## Documentation

| File | What it covers |
|---|---|
| `docs/GAME_SPEC.md` | Authoritative behaviour specification |
| `docs/ADR.md` | Architecture decision records |
| `docs/PHASE_PLAN.md` | Build plan and status log |
| `docs/PLAYTEST_PACK.md` | Test matrix and playtest session script |
