/* SpotSafe 360 - app.js (module split, Phase 9.8).
   Orchestrator: engine guard (Phase 1 self-diagnosing loader) and
   engineOnline(), which wires the HUD/buttons/keys and starts the round.
   Everything it calls lives in the sibling modules loaded before it.
   ARCHITECTURE: classic script modules, no bundler - the product runs
   offline from a static folder under a strict CSP; game.html documents
   the load order (core, world, player, audio, game, quiz, review, app). */
"use strict";
var DEBUG = /[?&]debug=1/.test(window.location.search);
var SRI = "sha384-tVEbl7TUEnd3P8HoHIOqysRs2s8XW0iEfseiRgKkR9qRUtITLdOX+llejEgkop5S";
var LIB_BYTES = 1405369;
/* 17.0: lift the branded splash - on success it fades to the bay, on
   failure it must get out of the way of the diagnosis banner. Top-level
   so both engineOnline() and diagnose() can reach it. */
function hideSplash() {
  var s = document.getElementById("splash");
  if (!s) { return; }
  s.classList.add("gone");
  setTimeout(function () { if (s.parentNode) { s.parentNode.removeChild(s); } }, 600);
}
/* ================= engine online ================= */
function engineOnline() {
  var scene = $("scene");
  function enter() {
    readParams();
    buildRoom(); buildProps(); buildHazardObjects(); wireMouseFlagging();
    if (DEBUG) { buildDebug(); }
    buildPlayer();
    if (typeof buildDust === "function") { buildDust(); }
    setInterval(clampMovement, 33);
    requestAnimationFrame(tpStep);
    document.addEventListener("keydown", function (e) { tpKey(e, true); });
    document.addEventListener("keyup", function (e) { tpKey(e, false); });
    document.addEventListener("keydown", function (e) {
      if ((e.key === "v" || e.key === "V") && !state.roundOver) { toggleView(); }
    });
    /* Phase 10.2: no per-entity wrong-click listeners here. Every canvas
       click resolves through flagMouse() in game.js, which gives hazard
       hotspots priority over world geometry (the old #room/#props onWrong
       punished clicks on hazards that a rack beam happened to screen). */
    $("icoScore").innerHTML = svg("score");
    $("icoStreak").innerHTML = svg("streak");
    $("icoFound").innerHTML = svg("tick");
    $("icoTime").innerHTML = svg("clock");
    $("btnPause").innerHTML = svg("pause");
    $("btnList").innerHTML = svg("list");
    $("btnVR").innerHTML = svg("vr");
    try { state.muted = localStorage.getItem("ss360_mute") === "1"; } catch (e) { /* ignore */ }
    $("btnMute").innerHTML = svg(state.muted ? "mute" : "sound");
    $("btnMute").addEventListener("click", function () {
      state.muted = !state.muted;
      try { localStorage.setItem("ss360_mute", state.muted ? "1" : "0"); } catch (e) { /* ignore */ }
      if (typeof audioSetMuted === "function") { audioSetMuted(); }
      $("btnMute").innerHTML = svg(state.muted ? "mute" : "sound");
      $("btnMute").title = state.muted ? "Muted" : "Sound";
    });
    $("card").addEventListener("click", function (e) {
      if (e.target.closest("#btnExpand")) { return; }
      hideCard();
    });
    $("btnExpand").addEventListener("click", function () {
      $("card").classList.toggle("open");
      $("cardMore").classList.toggle("hidden");
      /* Heuristic evaluation fix: a learner who expands the card is reading it,
         so the 8-second auto-dismiss is cancelled until they close it. */
      if (state.cardTimer) { clearTimeout(state.cardTimer); state.cardTimer = null; }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (state.listOpen) { setList(false); return; }
        if (state.reviewFly) { closeReviewFly(); return; }
        if (vrCardOpen()) { $("vrCard").classList.add("hidden"); return; }
        if (state.roundOver) { return; }
        if (state.paused) {
          /* Browsers that DO deliver this Esc after using it to free the
             mouse must not have it read as "resume" in the same instant. */
          if (Date.now() - _lockLostAt < 400) { return; }
          resumeWithLock();
        } else {
          setPaused(true);
        }
        return;
      }
      if ((e.key === "e" || e.key === "E") && !state.listOpen && !state.paused &&
          !state.roundOver && !vrCardOpen()) {
        flagCenter();
      }
      if (e.key === "Tab") { trapFocus(e); }
    });
    document.addEventListener("mousedown", unlockAudioOnce);

    /* Phase 4: pause and end panels */
    $("pauseTitle").textContent = STRINGS.pauseTitle;
    $("btnResume").textContent = STRINGS.resumeBtn;
    $("btnRestart").textContent = STRINGS.restartBtn;
    $("btnMenu").textContent = STRINGS.menuBtn;
    $("pauseFine").textContent = STRINGS.pauseFine;
    $("btnAgain").textContent = STRINGS.againBtn;
    $("btnEndMenu").textContent = STRINGS.menuBtn;
    $("pauseInfo").textContent = state.name + " - " +
      (state.mode === "attack" ? STRINGS.modeAttackTitle : STRINGS.modeTrainingTitle) +
      " - " + diff().label;
    $("btnPause").addEventListener("click", function () {
      if (state.paused) { resumeWithLock(); } else { setPaused(true); }
    });
    $("btnResume").addEventListener("click", resumeWithLock);
    $("btnRestart").addEventListener("click", function () { window.location.reload(); });
    $("btnMenu").addEventListener("click", function () { window.location.href = "index.html"; });
    $("btnAgain").addEventListener("click", function () { window.location.reload(); });
    $("btnEndMenu").addEventListener("click", function () { window.location.href = "index.html"; });
    $("btnEndDash").textContent = STRINGS.endDashBtn;
    $("btnEndDash").addEventListener("click", function () { window.location.href = "dashboard.html"; });
    /* Phase 14: the review panel wires its own fly-to controls in
       wireReviewFlyTo() (review.js) so they never depend on engine setup. */

    /* Phase 5: list mode, VR, review text */
    $("btnList").title = STRINGS.listBtnTitle;
    $("btnVR").title = STRINGS.vrBtnTitle;
    $("listTitle").textContent = STRINGS.listTitle;
    $("listFine").textContent = STRINGS.listFine;
    $("vrTitle").textContent = STRINGS.vrTitle;
    $("vrBody").textContent = STRINGS.vrBody;
    $("btnVrClose").textContent = STRINGS.vrClose;
    $("endMapTitle").textContent = STRINGS.reviewMapTitle;
    $("endChipsTitle").textContent = STRINGS.reviewChipsTitle;
    $("btnList").addEventListener("click", function () { setList(true); });
    $("btnListClose").addEventListener("click", function () { setList(false); });
    $("btnVR").addEventListener("click", onVrClick);
    $("btnVrClose").addEventListener("click", function () { $("vrCard").classList.add("hidden"); });

    /* Quick-check quiz */
    $("btnQuizNext").addEventListener("click", nextQuestion);

    /* 16.6 look-mode. A full tab captures the mouse so looking around needs
       no clicking at all; clicks only ever flag what the centre dot is on.
       Embedded frames (live preview, LMS embeds) can never be granted the
       capture, so they keep drag-to-look, where the drag-distance guard in
       game.js decides what counts as a flag. */
    var embedded = false;
    try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
    if (embedded) {
      $("cam").setAttribute("look-controls", "pointerLockEnabled", false);
    } else {
      state.lockWanted = true;
      /* 17.4 root-cause fix: A-Frame 1.6's look-controls defaults
         pointerLockEnabled to FALSE. With it false the component never
         tracks the real pointer-lock state, so its mousemove handler fell
         back to frozen screen coordinates while the mouse WAS captured -
         moving the mouse did nothing at all. Set it here as well as in
         game.html so the controls work with any mix of old and new files. */
      try { $("cam").setAttribute("look-controls", "pointerLockEnabled", true); } catch (e) { /* engine not up yet */ }
    }
    function sceneCanvas() {
      var s = document.querySelector("a-scene");
      return s && s.canvas;
    }
    /* 17.4: extra look sensitivity while the mouse is captured. A-Frame's
       built-in rate (.002 rad per pixel) needs about 1600 px of mouse
       travel for a full turn - too slow to put the centre dot on a
       hazard. This adds 80% on top, only while captured, mirroring the
       engine's own signs and pitch clamp so the two never fight. */
    var LOOK_EXTRA = 0.0016;
    window.addEventListener("mousemove", function (e) {
      var c = sceneCanvas();
      if (!c || document.pointerLockElement !== c) { return; }
      if (state.paused || state.roundOver) { return; }
      var camEl = $("cam");
      var lc = camEl && camEl.components && camEl.components["look-controls"];
      if (!lc || !lc.yawObject) { return; }
      var mx = e.movementX || 0, my = e.movementY || 0;
      if (!mx && !my) { return; }
      lc.yawObject.rotation.y -= LOOK_EXTRA * mx;
      var lim = Math.PI / 2 - 0.05;
      lc.pitchObject.rotation.x = Math.max(-lim, Math.min(lim,
        lc.pitchObject.rotation.x - LOOK_EXTRA * my));
    });
    var _lockWatch = 0;
    function requestLock() {
      var c = sceneCanvas();
      if (!state.lockWanted || !c || !c.requestPointerLock) { return; }
      try {
        var r = c.requestPointerLock();
        if (r && typeof r.catch === "function") { r.catch(dropLockIdea); }
      } catch (e) { dropLockIdea(); }
      /* 16.8 watchdog: some browsers neither grant the capture nor report
         an error. If it has not taken hold 2 s after the request, fall
         back to drag-look + click-to-flag - clicks must never be dead. */
      if (_lockWatch) { clearTimeout(_lockWatch); }
      _lockWatch = setTimeout(function () {
        if (state.lockWanted && document.pointerLockElement !== sceneCanvas()) { dropLockIdea(); }
      }, 2000);
    }
    function dropLockIdea() {
      /* The browser refuses the capture here (frame rules, policy, older
         engine): fall back to drag-to-look + click-to-flag instead of
         stranding the learner on a dead control scheme. */
      if (_lockWatch) { clearTimeout(_lockWatch); _lockWatch = 0; }
      state.lockWanted = false;
      try { $("cam").setAttribute("look-controls", "pointerLockEnabled", false); } catch (e) { /* engine not up yet */ }
    }
    /* game.js calls this from the click handler when a second click finds
       the capture still absent (see _deadClicks there). */
    window.__ss360DropLock = dropLockIdea;
    /* 17.3: clicking the screen captures the mouse again. The look-controls
       flag has to come back on first - the drag-look fallback switches it
       off, and without it a re-captured mouse would not turn the view. */
    window.__ss360Relock = function () {
      if (state.paused || state.roundOver) { return; }
      state.lockWanted = true;
      try { $("cam").setAttribute("look-controls", "pointerLockEnabled", true); } catch (e) { /* engine not up */ }
      requestLock();
    };
    document.addEventListener("pointerlockerror", dropLockIdea);
    var _lockLostAt = 0;
    /* 17.3: the "Click to look around" pill, shown only when the round is
       running and the mouse is free (and capture is what we want). */
    var _hintShown = false;
    window.__ss360LookHint = function () {
      var el = $("lookHint");
      if (!el) { return; }
      var want = !!(state.started && !state.roundOver && !state.paused &&
                    state.lockWanted && document.pointerLockElement !== sceneCanvas());
      if (want === _hintShown) { return; }
      _hintShown = want;
      el.classList[want ? "remove" : "add"]("hidden");
    };
    document.addEventListener("pointerlockchange", function () {
      var c = sceneCanvas();
      var locked = !!(c && document.pointerLockElement === c);
      /* 16.8: the capture took hold - stand the watchdog down, or an Esc
         within 2 s of a resume would still flip the game to drag-look. */
      if (locked && _lockWatch) { clearTimeout(_lockWatch); _lockWatch = 0; }
      if (!locked) { _lockLostAt = Date.now(); }
      if (typeof window.__ss360LookHint === "function") { window.__ss360LookHint(); }
      if (!locked && state.lockWanted && state.started && !state.roundOver && !state.paused) {
        /* Esc (or the browser) freed the mouse mid-round: pause so every
           button is reachable, and say how to get back in. */
        setPaused(true);
        var pf = $("pauseFine");
        if (pf) { pf.textContent = STRINGS.pauseFineReleased || "Mouse released. Click Resume to capture it again."; }
      }
    });
    /* 17.3 "click the screen to continue": the pause overlay's backdrop is
       clickable; the buttons keep working as before. */
    var pauseEl = $("pause");
    if (pauseEl) {
      pauseEl.addEventListener("click", function (e) {
        if (e.target === pauseEl) { resumeWithLock(); }
      });
    }
    function resumeWithLock() {
      setPaused(false);
      var pf = $("pauseFine");
      if (pf) { pf.textContent = STRINGS.pauseFine || "Press Esc to resume."; }
      requestLock();
    }
    /* Auto-pause when the tab goes to the background: the round clock is
       wall-clock based, so an abandoned tab must not drain the round. */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && !state.roundOver && !state.paused) { setPaused(true); }
    });

    /* Phase 16: a duel round resolves its challenge BEFORE the clock starts
       - difficulty, mode and the opponent's name all come from the server.
       A dead backend or a bad code quietly degrades to a normal round
       rather than stranding the learner on the loading tag. */
    function beginRoundFlow() {
      if (state.duelCode) { setupDuel(beginPlay); } else { beginPlay(); }
    }

    function beginPlay() {
      startRound();
      hud();
      $("hud").classList.remove("hidden");
      $("reticle").classList.remove("hidden");
      /* 17.3: footsteps, hum, music and the forklift engine come up with
         the round; stopSoundscape() in endRound() takes them down. */
      try { if (typeof startSoundscape === "function") { startSoundscape(); } }
      catch (e) { /* a blocked audio system must never stop the round */ }
      if (typeof window.__ss360LookHint === "function") { window.__ss360LookHint(); }
      /* The tag is on screen during a client demonstration, so it names the
         round, not the build phase it was added in. */
      $("phaseTag").textContent =
        (state.mode === "attack" ? STRINGS.modeAttackTitle : STRINGS.modeTrainingTitle) + ", " +
        diff().label + ". Find all nine hazards. " +
        (STRINGS.tipAim || "Move the mouse to aim the dot - click or press E when the dot is on a hazard. " +
          "Esc releases the mouse; V switches view.");
    }

    /* 16.6: the round starts from an explicit gate. Capturing the mouse
       requires a real user gesture, so the round cannot silently grab the
       pointer on load - and the learner gets told how to get it back.
       16.7: the gate is OPTIONAL. A folder updated half-way (new js/,
       older game.html without the gate markup) must fall back to the
       classic auto-start instead of dying on the engine-fail banner -
       the 12.1 stale-build rule applies to every node new code touches. */
    var gate = $("startGate"), gateBtn = $("btnGateGo");
    function startNow() {
      state.started = true;
      requestLock();
      startBeeps();
      beginRoundFlow();
    }
    if (gate && gateBtn) {
      if ($("gateTitle")) { $("gateTitle").textContent = STRINGS.gateTitle || "Ready to walk the bay?"; }
      if ($("gateBody")) { $("gateBody").textContent = STRINGS.gateBody || ""; }
      gateBtn.textContent = STRINGS.gateBtn || "Start the round";
      gate.classList.remove("hidden");
      gateBtn.focus();
      gateBtn.addEventListener("click", function () {
        gate.classList.add("hidden");
        startNow();
      });
    } else {
      /* older game.html: no gate to show - run the round the old way */
      startBeeps();
      state.started = true;
      beginRoundFlow();
    }
  }

  /* Phase 11.1: a throw inside enter() used to leave the page silently
     stuck on "Loading the bay..." - no HUD, no Esc, no way back. The
     common real-world cause is a mixed-version js/ folder (one stale or
     half-copied file missing a function the others call), so the failure
     now names itself on screen instead of hanging. */
  function bootFail(msg) {
    hideSplash();
    var extra = (window.__ssErrors || []).join(" | ");
    $("failWhy").textContent = msg + (extra ? " Collected boot errors: " + extra : "");
    $("engineFail").classList.remove("hidden");
    $("btnRetry").addEventListener("click", function () { window.location.reload(); });
  }
  function safeEnter() {
    var need = ["readParams", "buildRoom", "buildProps", "buildHazardObjects",
      "wireMouseFlagging", "buildPlayer", "startBeeps", "startRound", "hud",
      "flagCenter", "perkAmt", "attackLimit", "quizAward", "beepEveryMs",
      "headStartPick", "applyHeadStart", "showPerkChip", "pulseAlarm",
      "scorePop", "markerPop", "streakFlare", "streakSound", "streakBreak",
      "shakeScene", "countUp", "buildDust",
      "reviewFlyTo", "closeReviewFly", "wireReviewFlyTo",
      "seededShuffle", "renderDuelResult", "paintDuelResult", "setupDuel"];
    var missing = need.filter(function (n) { return typeof window[n] !== "function"; });
    if (missing.length) {
      return bootFail("This page's files are out of sync - these functions never loaded: " +
        missing.join(", ") + ". Re-copy every file from the current build (all of js/, " +
        "the html pages and css/) and reload with the cache bypassed: Ctrl+Shift+R.");
    }
    try { enter(); hideSplash(); }
    catch (e) {
      bootFail("The round failed to start: " + (e && e.message ? e.message : e) +
        ". This is usually one stale or half-copied file in js/ - re-copy the whole " +
        "folder from the current build, then hard-reload (Ctrl+Shift+R).");
    }
  }
  if (scene.hasLoaded) { safeEnter(); }
  else { scene.addEventListener("loaded", safeEnter); }
}

/* Phase 16: fetch the challenge named by ?duel=CODE and apply it.
   Always calls done() - a timeout, a dead server, a full challenge or a
   player who already used their side all fall back to a plain round. */
function setupDuel(done) {
  var settled = false;
  function finish() { if (!settled) { settled = true; done(); } }
  if (typeof SSNet === "undefined" || !SSNet.token || !SSNet.token() || !SSNet.duels) {
    state.duelCode = null;
    return finish();
  }
  var bail = setTimeout(function () { state.duelCode = null; finish(); }, 8000);
  SSNet.duels.get(state.duelCode).then(function (j) {
    clearTimeout(bail);
    var d = j && j.duel;
    var mine = false;
    if (d && d.entries) {
      d.entries.forEach(function (e) { if (String(e.uid) === String(state.uid)) { mine = true; } });
    }
    if (!d || (d.entries && d.entries.length >= 2) || mine) {
      /* unknown, full, or already played: a normal round instead */
      state.duelCode = null;
      return finish();
    }
    state.difficulty = CONFIG.difficulties[d.diff] ? d.diff : "standard";
    state.mode = "attack";
    var opp = null;
    (d.entries || []).forEach(function (e) { if (String(e.uid) !== String(state.uid)) { opp = e; } });
    state.duelOpponent = (opp && opp.name) || d.createdName || "teammate";
    var chip = $("duelChip");
    if (chip) {
      chip.textContent = "\u2694 " + STRINGS.duelChipPrefix + " " + state.duelOpponent;
      chip.classList.remove("hidden");
    }
    finish();
  }).catch(function () {
    clearTimeout(bail);
    state.duelCode = null;
    finish();
  });
}
/* ================= engine guard (phase 1) ================= */
function diagnose() {
  hideSplash();
  var bootErrors = window.__ssErrors || [];
  var webgl = (function () {
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch (e) { return false; }
  })();
  var why = $("failWhy");
  if (!webgl) {
    why.textContent = "This viewer reports no usable WebGL graphics context, so no 3D page can run here regardless of code. Try Chrome or Edge, and enable hardware acceleration.";
  } else {
    why.textContent = "The 3D library did not load, even after a cache-bypassing retry. Checking your copy of vendor/aframe.min.js now...";
    fetch("vendor/aframe.min.js").then(function (res) {
      if (!res.ok) { var e = new Error("http"); e.status = res.status; throw e; }
      return res.arrayBuffer();
    }).then(function (buf) {
      if (buf.byteLength !== LIB_BYTES) {
        why.textContent = "vendor/aframe.min.js arrived truncated: " + buf.byteLength + " bytes instead of " + LIB_BYTES + ". Your copy is damaged. Restore it from the official download at aframe.io releases 1.6.0.";
        return;
      }
      if (window.crypto && window.crypto.subtle) {
        return window.crypto.subtle.digest("SHA-384", buf).then(function (h) {
          var b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(h)));
          if (b64 !== SRI.slice(7)) {
            why.textContent = "vendor/aframe.min.js arrived altered: its fingerprint does not match the pinned one. Restore it from the official download at aframe.io releases 1.6.0.";
          } else if (bootErrors.some(function (m) { return m.indexOf("Content Security Policy") >= 0 || m.indexOf("EvalError") >= 0; })) {
            why.textContent = "The page's own Content Security Policy blocked the 3D library: the engine needs 'unsafe-eval' in the script-src directive. This is a one-line fix in game.html, and this build should already contain it. Reported error: " +
              bootErrors.filter(function (m) { return m.indexOf("Content Security Policy") >= 0 || m.indexOf("EvalError") >= 0; })[0];
          } else if (bootErrors.some(function (m) { return m.indexOf("script-error") === 0 && m.indexOf("aframe") >= 0; })) {
            why.textContent = "The library file is intact but crashed while starting in this browser: " +
              bootErrors.filter(function (m) { return m.indexOf("aframe") >= 0; })[0] +
              ". This usually means an outdated browser. Update Chrome or Edge to the latest version and reload.";
          } else if (bootErrors.some(function (m) { return m.indexOf("load-failed") === 0 && m.indexOf("aframe") >= 0; })) {
            why.textContent = "The file is intact on the server, but your browser blocked the script tag itself: " +
              bootErrors.filter(function (m) { return m.indexOf("aframe") >= 0; })[0] +
              ". That is an extension or security product intercepting scripts. Retry in a private window with extensions disabled; if it works there, allow-list this site in the extension.";
          } else {
            why.textContent = "vendor/aframe.min.js is present and intact, but the browser refused to run it and reported no reason. Ask your tutor or IT service to check browser policy; then try a different browser entirely.";
          }
        });
      }
      why.textContent = "vendor/aframe.min.js is present with the correct size, but the browser refused to run it. Retry in a private window with extensions disabled, and read the first console line with F12.";
    }).catch(function (err) {
      if (location.protocol === "file:") {
        why.textContent = "This browser does not let a page opened directly from disk check its own files, so the exact cause cannot be read here. Open the live link, or serve the folder (python -m http.server 8000, then http://127.0.0.1:8000) and reload; if the engine still fails, this banner will then name the cause.";
        return;
      }
      why.textContent = "vendor/aframe.min.js could not be fetched from your copy (" + (err && err.status ? "server said " + err.status : "network error") + "). The file is missing from your project folder. Restore it from the official download at aframe.io releases 1.6.0.";
    });
  }
  $("engineFail").classList.remove("hidden");
  $("btnRetry").addEventListener("click", function () { window.location.reload(); });
}

document.addEventListener("DOMContentLoaded", function () {
  if (window.AFRAME) { engineOnline(); return; }
  /* Second chance: re-inject the library with a cache-busting query. */
  $("engineFail").classList.remove("hidden");
  $("failWhy").textContent = "The 3D engine did not load on the first attempt. Retrying with a cache-bypassing load...";
  var s = document.createElement("script");
  s.src = "vendor/aframe.min.js?retry=" + Date.now();
  if (location.protocol !== "file:") { s.integrity = SRI; }
  s.onload = function () {
    if (window.AFRAME) { $("engineFail").classList.add("hidden"); engineOnline(); }
    else { diagnose(); }
  };
  s.onerror = function () { diagnose(); };
  document.head.appendChild(s);
});
