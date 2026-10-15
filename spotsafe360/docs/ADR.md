# Architecture decision records, SpotSafe 360

This file is the repository's record of architecture decisions.

## ADR-001, Stack: A-Frame, no build. Status: REINSTATED and frozen, 11 Sep 2026
No-build HTML5, CSS3, vanilla ES6 plus A-Frame 1.6.0, pinned (integrity checked by the engine guard, ADR-004)
(sha384-tVEbl7TUEnd3P8HoHIOqysRs2s8XW0iEfseiRgKkR9qRUtITLdOX+llejEgkop5S,
1,405,369 bytes), vendored into the product. WebXR for VR.
Rationale: the client brief's only technology requirements are "must run on a
standard company laptop without specialist installation" and "show how it
converts to VR"; the three assignment descriptions mandate no stack at all.
A-Frame is Three.js underneath, includes WebXR nearly free, is learnable by
a four-person student team inside a seven-day sprint, and ships as a double-click folder.
History: briefly superseded on 11 Sep 2026 by a proposed move to Next.js plus
Three.js; after a documented four-stack comparison the team lead reinstated
ADR-001 the same day. Next.js is reserved for the B2 promotional website.

## ADR-002, No database. Status: accepted, closed
Client brief, out of scope, verbatim: "Full LMS, login, or GDPR-compliant data
storage - local high-score is enough." Persistence is localStorage only
(keys prefixed ss360_). No accounts, no network calls, nothing leaves the
device. Reopening requires a written client change request.

## ADR-003, Two-page portal architecture. Status: accepted
index.html is the portal (player identity, mode, difficulty, leaderboard,
how-to-play) built from pure DOM and never loading the 3D engine, so the menu
works on any machine even where the engine is blocked. game.html is the scene
page; Start Game redirects with mode and difficulty as URL parameters and the
round boots itself. Failure is contained to the game page, which self-diagnoses
the exact cause (missing, truncated, altered, extension-blocked, crashed) and
retries the engine load with a cache-busting query before reporting.

## ADR-004, Integrity check moves from the script tag to the guard. Status: accepted, 23 Sep 2026
Context: with an integrity attribute on the engine's script tag, Chrome and Edge
refused to start the engine when index.html was opened by double-click (file://),
which broke the "runs from a folder" requirement (NFR3).
Decision: remove the integrity attribute from game.html. The engine guard keeps the
pinned byte length and SHA-384 value and checks them whenever the engine fails to
start on a served page (live link or local server); on file:// it tells the user to
use the live link or a local server so the check can run.
Consequence: double-click works; tamper detection is diagnostic (on failure) rather
than preventive when the page is opened from disk.

## Delivery form
Static folder. Runs by double-click or any static server or any hosting link.
Submission as part of the A1 ZIP under the A7 sub-folder, and later inside the
Week 12 final deliverables. No build step exists anywhere in delivery.
