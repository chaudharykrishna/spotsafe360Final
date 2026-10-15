/* SpotSafe 360 - review.js (module split, Phase 9.8).
   Post-round review: the top-down map, find chips, list mode with
   walk-to locate, VR card and focus trapping. */
"use strict";
function showReview() {
  $("endTitle").textContent =
    state.endReason === "found" ? STRINGS.endFoundTitle : STRINGS.endTimeTitle;
  var foundN = Object.keys(state.found).length;
  var q = state.quiz;
  $("endStats").innerHTML =
    '<div class="end-stat"><b>' + state.score + "</b><span>Score</span></div>" +
    '<div class="end-stat"><b>' + foundN + " / " + HAZARDS.length + "</b><span>Found</span></div>" +
    '<div class="end-stat"><b>' + state.bestStreak + "</b><span>Best streak</span></div>" +
    (q.paper.length
      ? '<div class="end-stat"><b>' + q.right + " / " + q.paper.length +
        "</b><span>" + STRINGS.quizStatLabel + "</span></div>"
      : "") +
    '<div class="end-stat"><b>' + fmtTime(state.roundMs) + "</b><span>Time</span></div>";
  /* Phase 13: the final score counts up instead of appearing dead - the
     one number the learner cares most about should arrive with weight. */
  var scoreB = $("endStats").querySelector(".end-stat b");
  if (scoreB && typeof countUp === "function") { countUp(scoreB, state.score, 800); }
  saveScore();
  $("endMap").innerHTML = miniMap();
  renderChips();
  wireReviewFlyTo();
  /* Phase 16: duel verdict line, when this round was one side of a 1v1. */
  renderDuelResult();
  /* Phase 8 (CR-2): the way through to the dashboard, shown only to a
     logged-in learner, because a guest has no record to view. */
  $("btnEndDash").classList.toggle("hidden", !state.uid);
  $("roundEnd").classList.remove("hidden");
  $("btnAgain").focus();
  $("phaseTag").textContent = state.uid ? STRINGS.savedLogged : STRINGS.savedGuest;
}

function miniMap() {
  var s = '<svg viewBox="-19.5 -14.5 39 27.5" class="minimap" role="img" aria-label="' + STRINGS.mapAria + '">';
  s += '<rect x="-18" y="-12" width="36" height="24" fill="#101F31" stroke="#3A5068" stroke-width="0.35"/>';
  /* schematic landmarks: dock doors north, fire exit east, mezzanine south-west, walkway lanes */
  s += '<rect x="4.4" y="-12.35" width="3.2" height="0.7" fill="#3A5068"/>';
  s += '<rect x="10.4" y="-12.35" width="3.2" height="0.7" fill="#3A5068"/>';
  s += '<rect x="17.65" y="0.8" width="0.7" height="2.4" fill="#C0392B"/>';
  s += '<rect x="-9.2" y="8.8" width="6.4" height="3.1" fill="#22374F"/>';
  s += '<line x1="10.4" y1="-7" x2="10.4" y2="9" stroke="#FFD100" stroke-width="0.18" opacity="0.8"/>';
  s += '<line x1="12.2" y1="-7" x2="12.2" y2="9" stroke="#FFD100" stroke-width="0.18" opacity="0.8"/>';
  CONFIG.colliders.forEach(function (c) {
    s += '<circle cx="' + c.x + '" cy="' + c.z + '" r="' + c.r + '" fill="#1B2E44"/>';
  });
  s += '<circle cx="0" cy="9" r="0.55" fill="#4DA3FF"/>';
  s += '<text x="0" y="11.4" text-anchor="middle" font-size="1.3" fill="#9FB3C8">' + STRINGS.wordSpawn + "</text>";
  s += '<path d="M16.6 -13.6 L17.2 -12.3 L16 -12.3 Z" fill="#9FB3C8"/>';
  s += '<text x="14.4" y="-12.6" font-size="1.3" fill="#9FB3C8">' + STRINGS.wordNorth + "</text>";
  HAZARDS.forEach(function (h) {
    var got = !!state.found[h.id];
    /* Phase 14: an oversized transparent hit circle under each dot - a
       0.85-unit target on a small SVG is too fiddly to click. */
    s += '<circle class="map-hit" data-id="' + h.id + '" cx="' + h.pos.x + '" cy="' + h.pos.z + '" r="1.7" fill="transparent"/>';
    s += '<circle cx="' + h.pos.x + '" cy="' + h.pos.z + '" r="0.85" fill="' + (got ? "#3DDC6A" : "#FF5A4E") + '" pointer-events="none"/>';
    if (got) {
      s += '<path d="M' + (h.pos.x - 0.4) + " " + h.pos.z + " l0.3 0.35 l0.55 -0.7" +
           '" stroke="#08131F" stroke-width="0.22" fill="none"/>';
    } else {
      s += '<path d="M' + (h.pos.x - 0.3) + " " + (h.pos.z - 0.3) + " l0.6 0.6 M" +
           (h.pos.x + 0.3) + " " + (h.pos.z - 0.3) + " l-0.6 0.6" +
           '" stroke="#08131F" stroke-width="0.22" fill="none"/>';
    }
    s += '<text x="' + h.pos.x + '" y="' + (h.pos.z + 2.1) + '" text-anchor="middle" font-size="1.15" fill="#9FB3C8">' + h.id + "</text>";
  });
  DISTRACTORS.forEach(function (d) {
    s += '<circle class="map-hit" data-id="' + d.id + '" cx="' + d.pos.x + '" cy="' + d.pos.z + '" r="1.7" fill="transparent"/>';
    s += '<circle cx="' + d.pos.x + '" cy="' + d.pos.z + '" r="0.7" fill="none" stroke="#FFD100" stroke-width="0.28" pointer-events="none"/>';
    s += '<text x="' + d.pos.x + '" y="' + (d.pos.z + 2.1) + '" text-anchor="middle" font-size="1.15" fill="#9FB3C8">' + d.id + "</text>";
  });
  s += "</svg>";
  return s;
}
function renderChips() {
  /* Phase 13: chips tick in one after another (CSS stagger via delay).
     Phase 14: they are buttons now - each one flies the camera to its spot. */
  var html = "", n = 0;
  function delay() { return ' style="animation-delay:' + (n++ * 60) + 'ms"'; }
  var foundList = HAZARDS.filter(function (h) { return state.reaction[h.id] !== undefined; });
  foundList.sort(function (a, b) { return state.reaction[a.id] - state.reaction[b.id]; });
  foundList.forEach(function (h) {
    html += '<button type="button" class="chip chip-found chip-in" data-id="' + h.id + '"' + delay() + ">" +
      h.name + " <b>" + state.reaction[h.id].toFixed(1) + " s</b></button>";
  });
  HAZARDS.forEach(function (h) {
    if (state.found[h.id]) { return; }
    html += '<button type="button" class="chip chip-missed chip-in" data-id="' + h.id + '"' + delay() + ">" +
      h.name + " <b>" + STRINGS.wordMissed + "</b></button>";
  });
  $("endChips").innerHTML = html;
}
function itemById(id) {
  return HAZARDS.concat(DISTRACTORS).filter(function (x) { return x.id === id; })[0] || null;
}

/* ================= Phase 14: review fly-to =================
   The review is not just a record. Every chip and every map dot flies the
   camera to that spot with the blue locator box, so a learner who missed
   H6 can stand where H6 was and see what they walked past. The round stays
   over - flagMouse and the keys already ignore input once roundOver is set,
   so nothing can be scored from here. Esc or the back button returns. */
function reviewFlyTo(item) {
  if (!state.roundOver || !item) { return; }
  state.reviewFly = item.id;
  $("roundEnd").classList.add("hidden");
  $("btnBackReview").classList.remove("hidden");
  /* The glide needs a live WebGL camera; a headless context (tests, a GPU
     that never came up) still gets the banner and the locator. */
  try {
    if (typeof glideTo === "function") { glideTo(standPoint(item), item); }
  } catch (e) { /* cosmetics never break the review */ }
  litMarker(item);
  showReviewBanner(item);
  $("btnBackReview").focus();
}
function showReviewBanner(item) {
  var tip;
  if (state.found[item.id]) {
    var rt = state.reaction[item.id];
    tip = STRINGS.reviewFlyFound + (rt != null ? " " + rt.toFixed(1) + " s." : ".");
  } else if (DISTRACTORS.indexOf(item) >= 0) {
    tip = STRINGS.reviewFlySafe;
  } else {
    tip = STRINGS.reviewFlyMissed;
  }
  $("locateWhere").textContent = item.name;
  $("locateTip").textContent = tip;
  $("locate").classList.remove("hidden");
  if (state.locate.bannerTimer) { clearTimeout(state.locate.bannerTimer); }
  state.locate.bannerTimer = setTimeout(hideBanner, CONFIG.locate.holdSec * 1000);
}
function closeReviewFly() {
  if (!state.reviewFly) { return; }
  var item = itemById(state.reviewFly);
  state.reviewFly = null;
  $("btnBackReview").classList.add("hidden");
  hideBanner();
  if (state.locate.markTimer) { clearTimeout(state.locate.markTimer); state.locate.markTimer = null; }
  if (item) { restMarker(item); }
  $("roundEnd").classList.remove("hidden");
  $("btnAgain").focus();
}
function wireReviewFlyTo() {
  var chips = $("endChips"), map = $("endMap");
  chips.onclick = function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-id]") : null;
    if (t) { reviewFlyTo(itemById(t.getAttribute("data-id"))); }
  };
  map.onclick = function (e) {
    var id = e.target && e.target.getAttribute ? e.target.getAttribute("data-id") : null;
    if (id) { reviewFlyTo(itemById(id)); }
  };
  /* The review owns all of its own wiring (labels, back button, Esc) rather
     than depending on the engine setup: a learner dropped into a spot must
     always be able to get back. Everything here is idempotent, so re-running
     showReview() rebinds safely. */
  var hint = $("reviewHint");
  if (hint) { hint.textContent = STRINGS.reviewChipsHint; }
  var back = $("btnBackReview");
  back.textContent = STRINGS.reviewBackBtn;
  back.onclick = closeReviewFly;
  if (!wireReviewFlyTo.escBound) {
    wireReviewFlyTo.escBound = true;
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.reviewFly) { closeReviewFly(); }
    });
  }
}
function orderedItems() {
  if (!state.listOrder) {
    state.listOrder = shuffle(HAZARDS.concat(DISTRACTORS));
  }
  return state.listOrder;
}
/* ---- list mode navigation ----
   The list is a way of getting about the bay, not a way of scoring from a
   menu: choosing a place closes the list, walks the camera to a standoff a
   few metres off that spot and turns it to face it. The judgement - hazard
   or safe - is then made in the bay, with a click or the E key, exactly as
   it is for a player who found the spot by walking. */
function markerRest(item) {
  if (state.found[item.id]) { return "color:#3DDC6A; wireframe:true; opacity:0.35; transparent:true"; }
  if (state.hintShown[item.id]) { return "color:#FFD100; wireframe:true; opacity:0.16; transparent:true"; }
  return "color:#FFD100; wireframe:true; opacity:0; transparent:true";
}
function restMarker(item) {
  var g = groupOf(item.id);
  if (g && g.marker) { g.marker.setAttribute("material", markerRest(item)); }
}
/* Blue, not hazard yellow: this box says you are here, not this is unsafe.
   It frames the place the list described; the call is still the player's. */
function litMarker(item) {
  if (state.locate.markTimer) { clearTimeout(state.locate.markTimer); state.locate.markTimer = null; }
  if (state.locate.marked && state.locate.marked !== item) { restMarker(state.locate.marked); }
  state.locate.marked = item;
  var g = groupOf(item.id);
  if (g && g.marker) {
    g.marker.setAttribute("material", "color:#4DA3FF; wireframe:true; opacity:0.3; transparent:true");
  }
  state.locate.markTimer = setTimeout(function () {
    state.locate.markTimer = null;
    state.locate.marked = null;
    restMarker(item);
  }, CONFIG.locate.holdSec * 1000);
}
function hideBanner() { $("locate").classList.add("hidden"); }
function showBanner(item) {
  var tip = STRINGS.listLocateTip;
  if (state.found[item.id]) { tip = STRINGS.listLocateDone; }
  else if (state.listSafe[item.id]) { tip = STRINGS.listLocateSafe; }
  $("locateWhere").textContent = STRINGS.listLocate + LISTINGS[item.id].place;
  $("locateTip").textContent = tip;
  $("locate").classList.remove("hidden");
  if (state.locate.bannerTimer) { clearTimeout(state.locate.bannerTimer); }
  state.locate.bannerTimer = setTimeout(hideBanner, CONFIG.locate.holdSec * 1000);
}
function goTo(item) {
  if (state.paused || state.roundOver) { return; }
  setList(false);
  glideTo(standPoint(item), item);
  litMarker(item);
  showBanner(item);
  /* Hand the keyboard back to the bay: E flags whatever is on the centre
     dot, and the list button is one Enter away again. */
  $("btnList").focus();
}
function renderList() {
  var ul = $("listItems");
  ul.innerHTML = "";
  orderedItems().forEach(function (item) {
    var L = LISTINGS[item.id];
    var isDistractor = DISTRACTORS.indexOf(item) >= 0;
    var settled = !!state.found[item.id] || !!state.listSafe[item.id];
    var li = document.createElement("li");
    li.className = "list-item" + (settled ? " done" : "");
    var main = document.createElement("div");
    main.className = "list-main";
    var place = document.createElement("strong");
    place.textContent = L.place;
    var sense = document.createElement("span");
    sense.textContent = L.sense;
    main.appendChild(place);
    main.appendChild(sense);
    /* A settled place keeps its row and its button - going back to look at
       something already called is fair - but says what was called there.
       Only then is the item named, because the judgement is behind it. */
    if (settled) {
      var status = document.createElement("span");
      status.className = "list-status";
      status.textContent = (isDistractor ? STRINGS.listSafeCalled : STRINGS.listFlagged) +
        " - " + item.name;
      main.appendChild(status);
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-flag";
    btn.textContent = STRINGS.listGo;
    btn.addEventListener("click", function () { goTo(item); });
    li.appendChild(main);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}
function setList(open) {
  if (state.roundOver) { return; }
  state.listOpen = open;
  if (open) { renderList(); }
  $("listMode").classList.toggle("hidden", !open);
  document.body.classList.toggle("list-open", open);
  if (open) {
    var first = $("listItems").querySelector("button:not([disabled])");
    if (first) { first.focus(); }
  }
}
function vrCardOpen() {
  return !$("vrCard").classList.contains("hidden");
}
/* Focus trap: while an overlay is open, Tab cycles inside it only, so a
   keyboard or screen-reader user never lands on the HUD behind the panel. */
function openOverlay() {
  var ids = ["listMode", "vrCard", "quiz", "roundEnd", "pause"];
  for (var i = 0; i < ids.length; i++) {
    var el = $(ids[i]);
    if (el && !el.classList.contains("hidden")) { return el; }
  }
  return null;
}
function trapFocus(e) {
  var ov = openOverlay();
  if (!ov) { return; }
  var nodes = ov.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
  var items = Array.prototype.filter.call(nodes, function (n) { return !n.disabled; });
  if (!items.length) { return; }
  var first = items[0], last = items[items.length - 1];
  var active = document.activeElement;
  if (ov.contains && !ov.contains(active)) { first.focus(); e.preventDefault(); return; }
  if (e.shiftKey && active === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && active === last) { first.focus(); e.preventDefault(); }
}
function showVrCard() {
  $("vrCard").classList.remove("hidden");
  $("btnVrClose").focus();
}
function onVrClick() {
  var scene = $("scene");
  if (navigator.xr && navigator.xr.isSessionSupported && scene.enterVR) {
    navigator.xr.isSessionSupported("immersive-vr").then(function (ok) {
      if (ok) { scene.enterVR(); } else { showVrCard(); }
    }).catch(function () { showVrCard(); });
  } else { showVrCard(); }
}


/* ============ Phase 16 · 1v1 duel result ============
   After a duel round the review shows the head-to-head: both scores and
   the winner, or - when the other side has not played yet - the code to
   chase them with. Reads the finished write from saveScore when it can
   (state.duelSubmitted) instead of racing it with a fresh GET. */
function renderDuelResult() {
  var el = $("duelResult");
  if (!el) { return; }
  if (!state.duelCode || typeof SSNet === "undefined" || !SSNet.token || !SSNet.token()) {
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  el.textContent = STRINGS.duelChecking;
  var p = state.duelSubmitted || (SSNet.duels ? SSNet.duels.get(state.duelCode) : null);
  if (!p) { el.classList.add("hidden"); return; }
  p.then(function (j) { paintDuelResult(el, j && j.duel); })
    .catch(function () { el.textContent = STRINGS.duelGone; });
}
function paintDuelResult(el, d) {
  if (!d) { el.textContent = STRINGS.duelGone; return; }
  if (!d.entries || d.entries.length < 2) {
    el.textContent = STRINGS.duelResultWait + " " + STRINGS.duelYourCode + " " + d.code;
    return;
  }
  var a = d.entries[0], b = d.entries[1];
  var mine = String(a.uid) === String(state.uid) ? a : b;
  var theirs = mine === a ? b : a;
  var verdict = mine.score > theirs.score ? STRINGS.duelYouWin
    : mine.score < theirs.score ? STRINGS.duelYouLose
    : STRINGS.duelTie;
  el.textContent = STRINGS.duelScoreLine
    .replace("{me}", mine.score)
    .replace("{them}", theirs.score)
    .replace("{name}", theirs.name || "?") + " " + verdict;
}
