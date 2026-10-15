/* SpotSafe 360 - game.js (module split, Phase 9.8).
   The round itself: hazard hotspots built from data, scoring, streaks,
   the feedback card, E-key flagging, pause/end flow and score saving. */
"use strict";
/* ================= hazards: built from data ================= */
function groupOf(id) { return document.querySelector('.hotspot[data-id="' + id + '"]'); }
var ITEM_BY_ID = null;
function itemById(id) {
  if (!id) { return null; }
  if (!ITEM_BY_ID) {
    ITEM_BY_ID = {};
    HAZARDS.concat(DISTRACTORS).forEach(function (i) { ITEM_BY_ID[i.id] = i; });
  }
  return ITEM_BY_ID[id] || null;
}
function buildHazardObjects() {
  /* Phase 9.7: people and drums are solid too. */
  HAZARDS.forEach(function (h) {
    if (h.id === "H2") { CONFIG.colliders.push({ what: "worker on walkway", x: h.pos.x, z: h.pos.z, r: 0.4 }); }
    if (h.id === "H4") { CONFIG.colliders.push({ what: "spill drum", x: h.pos.x + 0.7, z: h.pos.z + 0.5, r: 0.4 }); }
  });
  var host = $("hotspots");
  HAZARDS.forEach(function (h) {
    var g = el("a-entity", { position: h.pos.x + " 0 " + h.pos.z, class: "hotspot" }, host);
    g.dataset.id = h.id;
    if (h.id === "H1") {
      box(g, 1.3, 0.9, 1.1, "#7C8794", 0, 0.45, 0);
      box(g, 1.1, 0.8, 0.9, "#8B96A3", 0.15, 1.25, 0.1, 8);
      box(g, 1.2, 0.14, 1.2, "#B08A5A", -0.2, 0.07, 0.5, 20);
    } else if (h.id === "H2") {
      worker(g, 0, 0, "#2B3440", "#22262E", false);
    } else if (h.id === "H3") {
      forklift(g, 0, 0, 40);
    } else if (h.id === "H4") {
      el("a-cylinder", { radius: 1.5, height: 0.03, position: "-0.3 0.02 0",
        material: "color:#22302A; roughness:0.1; metalness:0.35; opacity:0.92; transparent:true" }, g);
      cyl(g, 0.42, 0.9, "#3B6E4F", 0.7, 0.42, 0.5, 0, 90);
      box(g, 0.34, 0.05, 0.34, "#22302A", 0.05, 0.03, 0.35);
    } else if (h.id === "H5") {
      /* 2.0 long, not 2.6: the walkway runs from x 10.4 to 12.2 and the
         barrier posts stand at 12.6, so the longer lead drove its plug
         straight through the post it is meant to lie beside. */
      cyl(g, 0.05, 2.0, "#1B2430", 0, 0.05, 0, 0, 90);
      box(g, 0.3, 0.14, 0.22, "#48586E", -1.05, 0.07, 0);
      box(g, 0.22, 0.1, 0.16, "#FFD100", 1.0, 0.05, 0);
    } else if (h.id === "H6") {
      box(g, 0.12, 3.2, 0.12, "#E87722", 0, 1.5, 0, 9);
      box(g, 0.16, 0.5, 0.16, "#2B2B2B", 0.12, 0.3, 0, 9);
      box(g, 0.1, 0.12, 2.6, "#E87722", 0.55, 1.0, 0.4, 6);
      box(g, 1.0, 0.14, 1.0, "#B08A5A", 1.2, 0.07, 0.2, 12);
    } else if (h.id === "H7") {
      box(g, 1.1, 1.1, 0.8, "#9A7B4F", -0.45, 0.55, 0.1, 4);
      box(g, 0.7, 0.6, 0.6, "#8B7355", -0.5, 1.4, -0.05, -6);
      cyl(g, 0.11, 0.5, "#C0392B", 0.62, 0.95, 0);
      box(g, 0.05, 0.34, 0.26, "#7C8794", 0.78, 1.3, 0);
    } else if (h.id === "H8") {
      worker(g, 0, 0, "#3C4656", "#22262E", false).setAttribute("position", "0 3.09 0");
      box(g, 1.2, 0.14, 1.0, "#B08A5A", 0.9, 3.16, -0.25, 8);
    } else if (h.id === "H9") {
      palletStack(g, 0, 0, 3);
      worker(g, 0, 0, "#3C4656", "#22262E", true).setAttribute("position", "0 1.86 0");
    }
    g.marker = el("a-box", { width: h.radius * 2, height: 2.6, depth: h.radius * 2,
      position: "0 1.3 0", material: "color:#FFD100; wireframe:true; opacity:0; transparent:true",
      class: "found-marker" }, g);
    if (DEBUG) {
      el("a-ring", { rotation: "-90 0 0", "radius-inner": h.radius - 0.1, "radius-outer": h.radius,
        position: "0 0.03 0", material: "color:#3DDC6A; opacity:0.5; transparent:true" }, g);
    }
  });
  DISTRACTORS.forEach(function (d) {
    /* Phase 9.8: the standing worker is a person - solid, like the rest. */
    CONFIG.colliders.push({ what: "hi-vis worker", x: d.pos.x, z: d.pos.z, r: 0.4 });
    var g = el("a-entity", { position: d.pos.x + " 0 " + d.pos.z, class: "hotspot" }, host);
    g.dataset.id = d.id;
    worker(g, 0, 0, "#FFD100", "#22262E", true);
    g.marker = el("a-box", { width: d.radius * 2, height: 2.4, depth: d.radius * 2,
      position: "0 1.2 0", material: "color:#FFD100; wireframe:true; opacity:0; transparent:true",
      class: "found-marker" }, g);
    if (DEBUG) {
      el("a-ring", { rotation: "-90 0 0", "radius-inner": d.radius - 0.1, "radius-outer": d.radius,
        position: "0 0.03 0", material: "color:#FFD100; opacity:0.5; transparent:true" }, g);
    }
  });
}

/* ================= HUD and feedback card ================= */
function hud() {
  $("hudScore").textContent = state.score;
  $("hudStreak").textContent = state.streak;
  $("hudFound").textContent = Object.keys(state.found).length + " / " + HAZARDS.length;
}
function catOf(h) {
  if (h.category.indexOf("Fire") === 0) { return "fire"; }
  if (h.category.indexOf("Vehicle") === 0) { return "vehicle"; }
  if (h.category.indexOf("Working") === 0) { return "height"; }
  if (h.category.indexOf("Stacking") === 0) { return "stack"; }
  if (h.category.indexOf("Good") === 0) { return "good"; }
  return "house";
}
function showCard(cat, title, briefLine, full) {
  var card = $("card");
  card.className = "cat-" + cat;
  $("cardIco").innerHTML = svg(iconOf(cat));
  $("cardTitle").textContent = title;
  $("cardWhat").textContent = briefLine;
  $("cardWhy").textContent = full ? full.why : "";
  $("cardControl").textContent = full ? full.control : "";
  $("cardMore").classList.add("hidden");
  $("btnExpand").innerHTML = svg("expand");
  $("btnExpand").style.display = full ? "" : "none";
  card.classList.remove("open", "hidden");
  if (state.cardTimer) { clearTimeout(state.cardTimer); state.cardTimer = null; }
  state.cardTimer = setTimeout(hideCard, CONFIG.cardDismissSec * 1000);
}
function hideCard() { $("card").classList.add("hidden"); }

/* ================= scoring ================= */
function onSpot(h) {
  if (state.paused || state.roundOver) { return; }
  if (state.found[h.id]) { return; }
  state.found[h.id] = true;
  state.lastSpot = Date.now();
  var award = CONFIG.scorePerHazard + perkAmt("hazardBonus");
  state.score += award;
  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.reaction[h.id] = elapsedMs() / 1000;
  var g = groupOf(h.id);
  if (g && g.marker) {
    g.marker.setAttribute("material", "color:#3DDC6A; wireframe:true; opacity:0.35; transparent:true");
    if (typeof markerPop === "function") { markerPop(g.marker); }
  }
  /* Phase 13: the award is SEEN where it was earned, and a running streak
     gets louder and brighter as it grows. */
  if (typeof scorePop === "function") { scorePop(h.pos.x, h.pos.z, "+" + award); }
  if (typeof streakSound === "function") { streakSound(state.streak); }
  if (typeof streakFlare === "function") { streakFlare(state.streak); }
  unlockAudioOnce(); blip(880);
  reticlePulse("hit");
  showCard(catOf(h), h.name + "  +" + award, h.brief.what, h.brief);
  hud();
  if (HAZARDS.every(function (x) { return state.found[x.id]; })) { endRound("found"); }
}
function onGoodClick(d) {
  if (state.paused || state.roundOver) { return; }
  state.goodClicks += 1;
  state.listSafe[d.id] = true;
  state.score = Math.max(0, state.score - diff().penalty);
  if (typeof streakBreak === "function") { streakBreak(state.streak); }
  state.streak = 0;
  state.lastSpot = Date.now();
  unlockAudioOnce(); blip(330);
  reticlePulse("miss");
  showCard("good", STRINGS.cardGoodTitle + "  -" + diff().penalty, d.brief.what, d.brief);
  hud();
}
function onWrong() {
  if (state.paused || state.roundOver) { return; }
  if (Date.now() - (state.lastSpot || 0) < 60) { return; }
  if (Date.now() - (state.lastWrong || 0) < 80) { return; }
  state.lastWrong = Date.now();
  state.wrongClicks += 1;
  state.score = Math.max(0, state.score - diff().penalty);
  if (typeof streakBreak === "function") { streakBreak(state.streak); }
  state.streak = 0;
  if (typeof shakeScene === "function") { shakeScene(); }
  unlockAudioOnce(); blip(220);
  reticlePulse("miss");
  showCard("penalty", STRINGS.cardPenaltyTitle + "  -" + diff().penalty, STRINGS.cardPenaltyBrief,
    { why: STRINGS.cardPenaltyWhy, control: STRINGS.cardPenaltyControl });
  hud();
}

/* ================= flagging (Phase 10.2: unified ray resolution) ==========
   Playtest bug: clicking the worker on the pallet stack (H9) only counted
   from one direction. The cursor raycast fires on the NEAREST object, so
   from most angles a rack beam or platform slab (world props) intercepted
   the ray before the thin worker mesh and the click was punished as a
   miss. Flagging now resolves along the ray itself - world geometry can no
   longer steal a hazard click - and a miss only punishes when the ray
   genuinely passes nothing. E-key flagging shares the same selection. */
function selectAlong(ox, oy, oz, fx, fy, fz) {
  var best = null, bestAng = 999, onFound = false;
  var bestFoundAng = 999;
  var near = null, nearAng = 999;
  HAZARDS.concat(DISTRACTORS).forEach(function (i) {
    var dx = i.pos.x - ox, dy = aimY(i) - oy, dz = i.pos.z - oz;
    var dist = Math.hypot(dx, dy, dz) || 1;
    var dot = (dx * fx + dy * fy + dz * fz) / dist;
    var ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    /* 17.2 aim feel: the flag window around an object grew from 2 to 4
       degrees, and a wider no-penalty "near" band surrounds it. A click
       just beside the hazard used to be charged as a miss, which reads
       as "clicking does not work"; now it only gets a gentle nudge card,
       and the penalty is kept for clicks that genuinely pass nothing.
       17.4: hazards get 5.5 degrees (safe objects keep 4), so lining the
       dot up on a small far-away hazard is a glance, not a chore. */
    var isHazard = HAZARDS.indexOf(i) >= 0;
    var angR = Math.atan2(i.radius, dist) * 180 / Math.PI;
    var flagT = angR + (isHazard ? 5.5 : 4);
    var closeT = Math.max(12, Math.min(angR + 16, 30));
    if (ang < closeT && ang < nearAng) { nearAng = ang; near = i; }
    if (ang >= flagT) { return; }
    /* An already flagged hazard never wins - something behind it still
       can - but it is noted, so flagging costs nothing when the aim is
       resting on work already done. */
    if (state.found[i.id]) { onFound = true; if (ang < bestFoundAng) { bestFoundAng = ang; } return; }
    if (ang < bestAng) { bestAng = ang; best = i; }
  });
  /* 17.2: if the click sits on (or beside) work the learner ALREADY flagged,
     the neutral "already done" answer wins over charging for a safe object
     that merely shares the line - clicking your own finished work must
     never cost points. */
  if (best && bestFoundAng <= bestAng + 2) { best = null; onFound = true; }
  /* A "near" only counts when nothing was actually flagged. */
  if (best || onFound) { near = null; }
  return { best: best, onFound: onFound, near: near };
}
function dispatchFlag(item) {
  if (DISTRACTORS.indexOf(item) >= 0) { onGoodClick(item); } else { onSpot(item); }
}
/* 17.2: every flag attempt answers back at the aim dot itself - the point
   the eye is already on - so a click can never feel ignored: green pulse
   on a find, amber on a near miss, red on a genuine miss, a white tick
   when the object was already flagged. Colour + size only, so it reads
   the same with reduced-motion preferences. */
var _pulseTimer = null;
function reticlePulse(kind) {
  var r = $("reticle");
  if (!r || !r.classList) { return; }
  r.classList.remove("p-hit", "p-close", "p-miss", "p-done");
  void r.offsetWidth;                       /* restart the transition */
  r.classList.add("p-" + kind);
  if (_pulseTimer) { clearTimeout(_pulseTimer); }
  _pulseTimer = setTimeout(function () {
    r.classList.remove("p-hit", "p-close", "p-miss", "p-done");
    _pulseTimer = null;
  }, 450);
}
function onClose(item) {
  if (state.paused || state.roundOver) { return; }
  if (Date.now() - (state.lastClose || 0) < 120) { return; }
  state.lastClose = Date.now();
  state.closeClicks = (state.closeClicks || 0) + 1;
  reticlePulse("close");
  blip(520);
  showCard("near", STRINGS.cardNearTitle,
    (STRINGS.cardNearBrief || "So close - put the dot right on the object, then click.")
      + (item && item.name ? " (" + item.name + " is right there.)" : ""),
    { why: STRINGS.cardNearWhy, control: STRINGS.cardNearControl });
  hud();
}
/* 17.4: the dot tells you BEFORE the click. While the aim is inside a
   hazard's flag window the reticle glows green - aiming becomes "put it
   on until it turns green", which is what players already read from every
   third-person game. Runs from the frame loop; cheap (a few dozen
   angle checks) and purely cosmetic. */
var _tellOn = false;
function reticleTell() {
  var r = $("reticle");
  if (!r || !r.classList) { return; }
  var on = false;
  if (state.started && !state.paused && !state.roundOver && !state.listOpen) {
    var cam = $("cam");
    if (cam && cam.object3D) {
      var p = cam.object3D.position;
      var yaw = cam.object3D.rotation.y, pitch = cam.object3D.rotation.x;
      var fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
      var sel = selectAlong(p.x, p.y, p.z, fx, fy, fz);
      on = !!sel.best;
    }
  }
  if (on !== _tellOn) {
    _tellOn = on;
    r.classList[on ? "add" : "remove"]("on-target");
  }
}
function flagCenter() {
  var cam = $("cam");
  var p = cam.object3D.position;
  var yaw = cam.object3D.rotation.y, pitch = cam.object3D.rotation.x;
  var fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
  var sel = selectAlong(p.x, p.y, p.z, fx, fy, fz);
  if (sel.best) { dispatchFlag(sel.best); }
  else if (sel.onFound) { reticlePulse("done"); }       /* already flagged: answer back */
  else if (sel.near) { onClose(sel.near); }
  else { onWrong(); }
}


/* ---------- mouse clicks: hotspot-first raycast ---------- */
var _flagRay = null;
function mouseRay(ev) {
  var sceneEl = document.querySelector("a-scene");
  var canvas = sceneEl && sceneEl.canvas;
  var cam = $("cam") && $("cam").getObject3D ? $("cam").getObject3D("camera") : null;
  if (!canvas || !cam || typeof THREE === "undefined") { return null; }
  var rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) { return null; }
  var ndc = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1
  );
  if (!_flagRay) { _flagRay = new THREE.Raycaster(); }
  _flagRay.setFromCamera(ndc, cam);
  return _flagRay;
}
function hotspotIdOf(obj) {
  while (obj) {
    if (obj.el && obj.el.classList && obj.el.classList.contains("hotspot") &&
        obj.el.dataset && obj.el.dataset.id) { return obj.el.dataset.id; }
    obj = obj.parent;
  }
  return null;
}
/* 16.6: how far the mouse travelled between down and up. In drag-to-look
   contexts (embedded frames without pointer lock) a look-drag ends in a
   click event; that drag must never be read as a flag. */
var _dragDist = 0;
/* 16.8: consecutive clicks swallowed while capture is wanted-but-absent.
   The first stays free (it is the click that re-captures the mouse); the
   second means this browser is never going to capture, so the game drops
   to drag-look and counts the click normally. Clicks must never be
   silently dead. */
var _deadClicks = 0;
function flagMouse(ev) {
  if (state.paused || state.roundOver) { return; }
  var sceneEl = document.querySelector("a-scene");
  var canvas = sceneEl && sceneEl.canvas;
  /* Locked mode: the centre reticle is the aim. The browser freezes
     clientX/clientY while the pointer is captured, so raycasting the click
     coordinates would shoot from a stale screen point - flag exactly what
     the dot is on instead. */
  if (canvas && document.pointerLockElement === canvas) { _deadClicks = 0; flagCenter(); return; }
  /* Lock is wanted but not engaged (Esc released it, or the start click):
     free clicks belong to the UI, never to the hazard list - but only the
     FIRST one; see _deadClicks above. */
  if (state.lockWanted) {
    /* 17.3: click the screen and the mouse is captured again - the same
       "click to look around" the reference build uses. The click itself
       still belongs to the capture, never to the hazard list. */
    if (typeof window.__ss360Relock === "function") { window.__ss360Relock(); }
    _deadClicks++;
    if (_deadClicks < 2) { return; }
    _deadClicks = 0;
    if (typeof window.__ss360DropLock === "function") { window.__ss360DropLock(); }
    /* fall through: serve THIS click with the normal raycast */
  }
  /* Drag-to-look fallback: a moved click was a look, not a flag. */
  if (_dragDist > 8) { return; }
  var ray = mouseRay(ev);
  if (ray) {
    /* Layer 1 - precise: does the ray touch any hotspot mesh? Only hotspot
       geometry is considered; the bay itself is ignored on purpose. */
    var groups = document.querySelectorAll(".hotspot");
    var objs = [];
    Array.prototype.forEach.call(groups, function (g) { if (g.object3D) { objs.push(g.object3D); } });
    if (objs.length) {
      var hits = ray.intersectObjects(objs, true);
      for (var i = 0; i < hits.length; i++) {
        var item = itemById(hotspotIdOf(hits[i].object));
        if (item && !state.found[item.id]) { return dispatchFlag(item); }
      }
    }
    /* Layer 2 - forgiving: the same angular test the E key uses, along the
       mouse ray, so a thin or partly screened hazard still counts. */
    var o = ray.ray.origin, d = ray.ray.direction;
    var sel = selectAlong(o.x, o.y, o.z, d.x, d.y, d.z);
    if (sel.best) { return dispatchFlag(sel.best); }
    if (sel.onFound) { reticlePulse("done"); return; }
    if (sel.near) { return onClose(sel.near); }
  }
  onWrong();
}
function wireMouseFlagging() {
  var sceneEl = document.querySelector("a-scene");
  if (!sceneEl) { return; }
  function attach() {
    var c = sceneEl.canvas;
    /* 16.6: track how far a press travelled so a look-drag that ends in a
       click event is never charged as a wrong flag. */
    var x0 = 0, y0 = 0;
    c.addEventListener("pointerdown", function (e) { x0 = e.clientX; y0 = e.clientY; _dragDist = 0; });
    c.addEventListener("pointermove", function (e) {
      _dragDist = Math.max(_dragDist, Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0));
    });
    c.addEventListener("click", flagMouse);
  }
  if (sceneEl.canvas) { attach(); }
  else { sceneEl.addEventListener("renderstart", attach); }
}

/* ================= round flow (Phase 4) ================= */
function setPaused(p) {
  if (state.roundOver) { return; }
  if (p === state.paused) { return; }
  state.paused = p;
  if (typeof audioPause === "function") { audioPause(p); }
  if (p) {
    state.pauseBegan = Date.now();
    $("pause").classList.remove("hidden");
    $("btnResume").focus();
  } else {
    state.pausedTotal += Date.now() - state.pauseBegan;
    $("pause").classList.add("hidden");
  }
}
function endRound(reason) {
  if (state.roundOver) { return; }
  state.roundOver = true;
  /* 16.6: hand the mouse back the moment the round ends, or the captured
     pointer would make the quiz and review buttons unreachable. */
  try { if (document.pointerLockElement) { document.exitPointerLock(); } } catch (e) { /* not locked */ }
  stopBeeps();
  if (typeof stopSoundscape === "function") { stopSoundscape(); }
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  if (state.hintId) { clearInterval(state.hintId); state.hintId = null; }
  if (state.cardTimer) { clearTimeout(state.cardTimer); state.cardTimer = null; }
  hideCard();
  hideBanner();
  $("pause").classList.add("hidden");
  state.listOpen = false;
  $("listMode").classList.add("hidden");
  document.body.classList.remove("list-open");
  state.endReason = reason;
  state.roundMs = elapsedMs();
  /* The quiz comes first: its points are part of the score the review shows
     and the leaderboard saves, so the review cannot be drawn until it ends. */
  startQuiz();
}
/* Drawn after the quiz, so the score tile and the saved row are final. */
function attackLimit() { return diff().attackSec + perkAmt("extraTime"); }
function hintDelaySec() { return Math.max(0, diff().hintAfterSec - perkAmt("hintLead")); }
/* 12.2 (Maintenance perk "Head start"): one random not-yet-shown hazard is
   revealed at the start of the round - the tech knows the building. The
   picker is pure (takes the candidate pool + a random fn) so the tests
   drive the real shipped logic with a seeded random. */
function headStartPick(pool, rnd) {
  if (!pool || !pool.length) { return null; }
  var r = typeof rnd === "function" ? rnd : Math.random;
  return pool[Math.floor(r() * pool.length)];
}
function applyHeadStart() {
  if (!hasPerk("headStart")) { return null; }
  var pool = HAZARDS.filter(function (h) {
    return !state.found[h.id] && !state.hintShown[h.id];
  });
  var pick = headStartPick(pool);
  if (!pick) { return null; }
  state.hintShown[pick.id] = true;   /* the hint pass must not re-reveal it */
  var g = groupOf(pick.id);
  if (g && g.marker) {
    /* cyan, not the hint yellow - "you knew this one from the start" */
    g.marker.setAttribute("material",
      "color:#4CC3FF; wireframe:true; opacity:0.22; transparent:true");
  }
  return pick.id;
}
/* 12.2: the perk chip in the HUD - the player always knows what their
   role is doing differently this round. */
function showPerkChip() {
  var el = $("perkChip");
  if (!el) { return; }
  /* Phase 16: in a duel the chip says so - the player must never wonder
     why their role perk is not firing. */
  if (state.duelCode) {
    el.textContent = "\u2694 " + STRINGS.duelPerkNote;
    el.classList.remove("hidden");
    return;
  }
  var p = perk();
  if (!p) { el.classList.add("hidden"); return; }
  el.textContent = "\u26A1 " + p.name + " \u00B7 " + p.short;
  el.classList.remove("hidden");
}
/* 12.2: every reversing-alarm beep also flashes the chip, so the 4 s vs
   6 s tempo is SEEN as well as heard (helps every role, defines the
   Forklift Driver's perk). */
function pulseAlarm() {
  var el = $("perkChip");
  if (!el || el.classList.contains("hidden")) { return; }
  el.classList.remove("pip");
  void el.offsetWidth;               /* restart the animation */
  el.classList.add("pip");
}
function startRound() {
  state.roundStart = Date.now();
  state.pausedTotal = 0;
  showPerkChip();
  applyHeadStart();
  if (state.mode === "attack") {
    $("timeStat").classList.remove("hidden");
    $("hudTime").textContent = fmtTime(attackLimit() * 1000);
    state.timerId = setInterval(function () {
      if (state.paused || state.roundOver) { return; }
      var left = attackLimit() * 1000 - elapsedMs();
      $("hudTime").textContent = fmtTime(left);
      $("hudTime").classList.toggle("low", left <= 10000);
      if (left <= 0) { endRound("time"); }
    }, 250);
  }
  if (state.mode === "training" && hintDelaySec() > 0) {
    state.hintId = setInterval(function () {
      if (state.paused || state.roundOver) { return; }
      if (elapsedMs() < hintDelaySec() * 1000) { return; }
      HAZARDS.forEach(function (h) {
        if (state.found[h.id] || state.hintShown[h.id]) { return; }
        state.hintShown[h.id] = true;
        var g = groupOf(h.id);
        if (g && g.marker) {
          g.marker.setAttribute("material",
            "color:#FFD100; wireframe:true; opacity:0.16; transparent:true");
        }
      });
    }, 1000);
  }
}

/* ================= Phase 5: review, list mode, VR ================= */
function saveScore() {
  /* Phase 8: both writes come from the same state snapshot, so the
     leaderboard and the profile record can never disagree. The store
     degrades silently when storage is blocked (NFR13). */
  var row = {
    name: state.name, avatar: state.avatar, score: state.score,
    found: Object.keys(state.found).length, mode: state.mode,
    diff: state.difficulty, secs: Math.round(state.roundMs / 1000),
    quiz: state.quiz.right, quizOf: state.quiz.paper.length,
    date: Date.now()
  };
  if (state.uid) { row.uid = state.uid; }
  try { SSStore.scores.add(row); } catch (e) { /* leaderboard stays empty */ }
  /* Phase 10: a cloud session mirrors the round to the backend so the
     account's history follows the learner, not the device. Fire-and-forget;
     the local copy already stands whatever the network does. */
  if (typeof SSNet !== "undefined" && SSNet.token()) {
    SSNet.addScore(row).catch(function () { /* offline mid-round */ });
  }
  /* Phase 16: a duel round also lands on the challenge itself. The promise
     is kept on state so the review panel reads the finished duel (with both
     sides) instead of racing this write with a fresh GET. The server enforces
     one side per player; a repeat attempt just 409s into the catch. */
  if (state.duelCode && typeof SSNet !== "undefined" && SSNet.token && SSNet.token()) {
    state.duelSubmitted = SSNet.duels.enter(state.duelCode, {
      score: state.score, found: Object.keys(state.found).length,
      secs: row.secs, quiz: state.quiz.right, quizOf: state.quiz.paper.length
    }).catch(function () { state.duelSubmitted = null; });
  }
  if (!state.uid) { return; }
  var rec = {
    v: 1, id: SSStore.newId("r"), date: row.date,
    mode: state.mode, diff: state.difficulty,
    score: state.score, found: row.found, total: HAZARDS.length,
    endReason: state.endReason, secs: row.secs,
    bestStreak: state.bestStreak,
    wrongClicks: state.wrongClicks, goodClicks: state.goodClicks,
    perHazard: HAZARDS.map(function (h) {
      return {
        h: h.id, found: !!state.found[h.id],
        rt: state.found[h.id] && state.reaction[h.id] !== undefined
          ? Math.round(state.reaction[h.id] * 10) / 10 : null
      };
    }),
    quiz: (state.quiz.detail || []).slice(0)
  };
  try { SSStore.records.add(state.uid, rec); } catch (e) { /* the review still shows; only the save is skipped */ }
  if (typeof SSNet !== "undefined" && SSNet.token()) {
    SSNet.addRecord(rec).catch(function () { /* offline mid-round */ });
  }
}
