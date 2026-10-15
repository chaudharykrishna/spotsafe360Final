# SpotSafe 360 - Phase 6 test and playtest pack

Version 1.0, 11 Sep 2026. Chair: M1 (Pawan Pandey). Participants: M1, M2, M3, M4.
Purpose: prove the prototype survives every environment we know of, then survive
four real players. Everything your team runs in Phase 6 is in this document.
Results feed the fix list and the difficulty tuning before Phase 7 freezes the build.

## 1. Setup for every tester

You need the project folder (spotsafe360) on your own machine. Two ways to run it:

- Easy way: open the folder in VS Code, install the Live Server extension once,
  right-click index.html, choose Open with Live Server. The site opens at
  http://127.0.0.1:5500.
- No-extension way: open a terminal in the folder and run
  python3 -m http.server 8000
  then browse to http://127.0.0.1:8000.

Useful habits:
- Hard reload after any file change: hold Ctrl and Shift and press R (Mac: Cmd Shift R).
- Debug view: add ?debug=1 directly after game.html, for example
  http://127.0.0.1:5500/game.html?debug=1 (no extra slash before the question mark).
- To reset saved scores between tests: F12, Application tab, Local Storage,
  delete every key starting with ss360.

## 2. Test matrix A: environments

One row per environment. The tester named runs it and writes PASS or FAIL plus
one line of detail for any FAIL. Severity rules are in section 5.

| Row | Environment | How to open | What must happen | Tester |
|---|---|---|---|---|
| A1 | Chrome, full tab, local server | 127.0.0.1, index.html | Portal works. Start a round. Clicking the 3D view grabs the mouse (pointer lock), Esc frees it. Full round playable. | M1 |
| A2 | Chrome, embedded preview frame | the Arena live preview tab | Same, but looking around works by dragging the mouse. No pointer lock. This is by design, not a bug. | M1 |
| A3 | Edge, full tab, local server | 127.0.0.1, index.html | Same as A1. | M2 |
| A4 | Firefox, full tab, local server | 127.0.0.1, index.html | Same as A1. | M2 |
| A5 | File double-click, no server | double-click index.html in the folder | Portal renders and Start works. Game page starts the engine and a round is playable. If the engine fails, the banner must name a reason: copy its exact sentence into the results. | M3 |
| A6 | Phone or tablet (optional) | same address on the local network, or file | Portal renders, list mode walks the camera to each place and the spot it faces can be tapped. Walking with WASD is desktop-only by design. | M4 |

Note for A5: some browsers isolate local storage per file when running without a
server, so leaderboard entries from file mode may not appear in server mode. That
is expected, not a bug. Judge A5 on: does it start, and can you play.

## 3. Test matrix B: feature smoke test

Run in Chrome full tab (A1 environment). One person drives, one watches and ticks.
Each row is PASS or FAIL with detail.

| Row | Feature | Check |
|---|---|---|
| B1 | Portal pickers | Name, six avatars, two modes, three difficulties all selectable by mouse and by Tab and Enter. |
| B2 | Start redirect | Start Game lands in the bay with the chosen mode and difficulty shown in the bottom tag. |
| B3 | Training hints, Simple | Stand still 15 seconds: faint yellow wireframes appear on unfound hazards. |
| B4 | Training hints, Expert | Stand still 30 seconds: no wireframes ever appear. |
| B5 | Time Attack timer | Standard shows 1:30, counts down, turns red under 10 seconds, round ends at zero. |
| B6 | Pause | Esc or pause button: panel opens, timer frozen, beeps silent. Resume continues from the same second. |
| B7 | Auto-pause | During Time Attack, switch to another tab, wait 10 seconds, come back: the round is paused and no time was lost. |
| B8 | Scoring | Hazard flag: plus 10, streak rises, green marker, card, blip. |
| B9 | Distractor | Clicking the full hi-vis worker in the walkway: penalty, streak resets, green good-practice card. |
| B10 | Wrong click | Clicking floor or wall: penalty, at most one per click, no double charges on fast clicking. |
| B11 | Sound clue | The beep every 6 seconds pans left and right as you turn. It stops for good once the forklift is flagged. |
| B12 | Cards | One line visible, chevron expands to why and control, click dismisses, auto-dismiss after 8 seconds. |
| B13 | E flag | Reticle plus E works on every hazard, including the mezzanine worker H8 and the pallet-stack worker H9. Carried item from Phase 3, must be confirmed. |
| B14 | List mode full round | Keyboard only: open list, Tab and Enter on an entry, confirm the camera arrives facing that place and the banner names it, press E to flag. Repeat for all nine, leave the safe one alone, round ends. Screen reader optional pass with Narrator or NVDA. |
| B15 | Review | Five stat tiles (score, found, best streak, quiz, time) and all correct; map shows green ticks on found and red crosses on missed; chips show names and sensible seconds in found order. |
| B16 | Leaderboard | After a round, portal shows the entry with avatar and name, best score on top, five rows maximum. |
| B17 | Mute memory | Mute, finish or restart, reload page: still muted. |
| B18 | VR button | On a desktop with no headset: the explanation card opens and closes with Esc or its button. |
| B19 | Debug view | ?debug=1 shows yellow collider rings, green hazard rings, bounds lines, and two console tables. |
| B20 | Engine armour | Temporarily rename vendor/aframe.min.js, load game.html: the banner must appear and name the damaged or missing file. Rename back afterwards. Portal must still work during the rename. |
| B21 | Quiz, both end paths | Finish a round by finding all nine, and finish another by letting the Time Attack clock run out. The quick check must open on both, three questions, and the review must follow it. |
| B22 | Quiz marking and score | Answer one right and one wrong on purpose. Right: green mark, "Correct. +5", score rises by 5. Wrong: the chosen option red, the correct one still green, explanation shown, score unchanged. Clicking a second option after answering must change nothing. Keyboard only: Tab and Enter through all three questions. |

## 4. Playtest session script (60 to 90 minutes, all four members)

Roles: M1 chairs and keeps time. M2 watches geometry and interaction feel.
M3 watches wording on cards, chips and list mode. M4 owns the accessibility pass
and the screen-reader attempt.

Rounds, in this order, every member plays each one on their own machine:
1. Training, Simple. Goal: find all nine. Think aloud: say what you are looking
   at and why. The chair notes every moment of confusion.
2. Time Attack, Standard. Goal: beat the clock. Note the pressure feel.
3. Time Attack, Expert. Goal: survive. Note fairness.
4. M4 only: one full round in list mode with the screen reader on.

Data to record per person per round (this is the tuning data):
- Which hazard ids were missed (from the review map).
- Reaction seconds per find (from the chips; copy or screenshot).
- Number of wrong clicks and distractor hits (watch the score dip).
- One comfort line: any motion sickness, eye strain, or frustration.
- One difficulty vote: too easy, right, too hard.

After the rounds, 15 minutes of open play and a group discussion chaired by M1:
- Top three confusions, top three delights.
- Difficulty tuning proposals: hint delays, round lengths, penalties. Write them
  down; the agent applies the agreed numbers, they live in one place (CONFIG in
  js/hazards.js), and retesting is one reload.

## 5. Severity definitions and the fix list

- Severity 1, blocker: the page or engine does not start, a round cannot be
  completed, scores are lost, the banner gives no or a wrong diagnosis.
- Severity 2, major: a promised feature does not work but the round is still
  playable (hints never appear, leaderboard does not save, beep does not pan).
- Severity 3, minor: cosmetic or awkward (overlap on small screens, unclear
  wording, chip order surprise).
- Severity 4, idea: polish and suggestions for the Week 12 backlog.

Fix list template (M1 keeps it, agent works from it):

| No | Severity | Where (row id) | What happened, exact words | Seen on | Status |
|---|---|---|---|---|---|
| 1 | | | | | |

Triage rules: every severity 1 and 2 is fixed and retested before Phase 7.
Severity 3 is fixed if the session has time. Severity 4 goes to the Week 12
backlog, never into this sprint.

## 6. Known limitations, do not report these as bugs

- No VR headset in the team: the VR button opening the explanation card on
  desktop is the intended behaviour. The headset path is exercised in Week 12.
- Embedded preview frames use drag-look instead of pointer lock. By design
  since Phase 6.
- Leaderboard data does not cross between file mode and server mode, or between
  different browsers. Local storage is per browser and per origin, by design
  and by the privacy promise.
- Phones have no keyboard: list mode is the mobile and accessible route. The
  brief targets a playable desktop 360 experience.
- Switching tabs auto-pauses the round. By design since Phase 6.

## 7. Phase 6 gate (from the plan)

Green when: M1's machine renders and plays (the historical blocker), all four
members complete a round, and no severity 1 defects are open. The chair declares
the gate and the agent records it in the status log.
