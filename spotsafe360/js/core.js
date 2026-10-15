/* SpotSafe 360 - core.js (module split, Phase 9.8).
   Shared round state, URL params, time formatting, the icon set and the
   small DOM/A-Frame builder primitives (el/box/cyl/texMat/sign/lightCone).
   ARCHITECTURE: the game page uses classic script modules - no bundler,
   because the product must run offline from a static folder under a strict
   CSP. Each file is one responsibility; top-level declarations are the
   module's exports; game.html documents the load order. */
"use strict";
function $(id) { return document.getElementById(id); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
/* Fisher-Yates, in place. Used by list mode and by the quiz. */
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/* ================= icons: inline SVG line art ================= */
var PATHS = {
  score: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  streak: '<path d="M13 2 6 13h5l-1 9 8-12h-5z"/>',
  tick: '<path d="M5 13l4 4L19 7"/>',
  ring: '<circle cx="12" cy="12" r="6"/>',
  fire: '<path d="M12 3c1.5 3.5 5.5 5 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 9.5 9 8 10 5.5c0.8 1.6 2 2 2-2.5z"/>',
  vehicle: '<path d="M4 14V8h7v6M11 14l5-5M16 9v5"/><circle cx="6.8" cy="18" r="1.8"/><circle cx="13.8" cy="18" r="1.8"/>',
  height: '<circle cx="15" cy="4.5" r="2"/><path d="M14 8l-4 3 2 4-4 5M14 8l3 4 4 1"/>',
  house: '<path d="M12 4c3 4 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-6 6-10z"/>',
  stack: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>',
  good: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  penalty: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  /* 17.2: the near-miss nudge uses a crosshair icon - "aim again". */
  near: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  sound: '<path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  mute: '<path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  expand: '<path d="M6 9l6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  vr: '<path d="M3 10a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-4.2l-2.8-2.6-2.8 2.6H5a2 2 0 0 1-2-2z"/>'
};
function svg(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (PATHS[name] || "") + "</svg>";
}
function iconOf(cat) { return PATHS[cat] ? cat : "house"; }

/* ================= state ================= */
var state = {
  score: 0, streak: 0, bestStreak: 0, found: {}, goodClicks: 0, wrongClicks: 0,
  lastSpot: 0, lastWrong: 0, muted: false, stepCount: 0,
  difficulty: "standard", cardTimer: null, beepId: null, audioUnlocked: false,
  /* Phase 4: round flow */
  name: "Player", avatar: 0, mode: "training",
  uid: "",
  paused: false, roundOver: false,
  /* 16.6 look-mode: started = the learner passed the start gate;
     lockWanted = this tab may capture the mouse (false in embedded
     frames, or after the browser refused the capture). */
  started: false, lockWanted: false,
  roundStart: 0, pausedTotal: 0, pauseBegan: 0,
  timerId: null, hintId: null, hintShown: {},
  /* Phase 5: review and list mode */
  listOpen: false, listOrder: null, listSafe: {}, reaction: {},
  /* List mode navigation: the running walk, and the spot it lit up. */
  locate: { raf: 0, marked: null, markTimer: null, bannerTimer: null },
  /* Quick-check quiz (A7): the drawn paper, where we are in it, and how
     many were right. endReason is held here because the review title is
     written after the quiz, not at the moment the round stops. */
  endReason: "time", roundMs: 0,
  quiz: { paper: [], at: 0, right: 0, answered: false },
  view: "third",
  /* Phase 14: id of the spot the review is currently flying to, or null. */
  reviewFly: null,
  /* Phase 16: 1v1 duel. duelCode is the challenge code from the URL,
     duelOpponent the name shown in the HUD chip, duelSubmitted the pending
     server write of this player's side (so the review can read the result
     without racing its own submission). */
  duelCode: null, duelOpponent: null, duelSubmitted: null
};
function diff() { return CONFIG.difficulties[state.difficulty] || CONFIG.difficulties.standard; }
/* Phase 11: role perks. One perk per avatar (ROLE_PERKS in hazards.js);
   perkAmt returns the numeric value for a key (0 when the role has a
   different perk), hasPerk answers for boolean perks. */
function perk() {
  return (typeof ROLE_PERKS !== "undefined" && ROLE_PERKS[state.avatar]) || null;
}
function perkAmt(key) {
  /* Phase 16: duels are a level field - both sides play with no role perk,
     whatever avatar they wear. One switch here covers every perk at once. */
  if (state.duelCode) { return 0; }
  var p = perk();
  return p && p.key === key && typeof p.value === "number" ? p.value : 0;
}
function hasPerk(key) {
  if (state.duelCode) { return false; }
  var p = perk();
  return !!p && p.key === key;
}
/* Phase 16: deterministic shuffle for duel fairness. Both players' browsers
   must draw the SAME quiz from the SAME code, so the draw runs on a small
   hash-seeded generator (mulberry32) instead of Math.random. Not crypto -
   it only has to be identical on two machines, never unpredictable. */
function seededShuffle(arr, seed) {
  var h = 2166136261;
  var s = String(seed);
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  function rnd() {
    h += 0x6D2B79F5;
    var t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  var a = (arr || []).slice(0);
  for (var j = a.length - 1; j > 0; j--) {
    var k = Math.floor(rnd() * (j + 1));
    var tmp = a[j]; a[j] = a[k]; a[k] = tmp;
  }
  return a;
}
function readParams() {
  var q = new URLSearchParams(window.location.search);
  var name = (q.get("name") || "").replace(/[<>&"']/g, "").slice(0, 16);
  state.name = name || "Player";
  var av = parseInt(q.get("avatar"), 10);
  state.avatar = isNaN(av) ? 0 : clamp(av, 0, 5);
  state.mode = q.get("mode") === "attack" ? "attack" : "training";
  var d = q.get("diff");
  state.difficulty = CONFIG.difficulties[d] ? d : "standard";
  /* Phase 16: a 1v1 challenge arrives as ?duel=CODE. app.js resolves it
     against the server before the round starts (difficulty and mode come
     from the challenge, never the URL); until then the code is just held. */
  state.duelCode = (q.get("duel") || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 14) || null;
  /* Phase 8 (CR-1): the round counts towards a profile only when the URL
     uid matches a real profile AND this tab still holds that session. A
     stale bookmark or a logged-out tab falls back to guest quietly - the
     round must never break over bookkeeping. */
  state.uid = "";
  var uid = q.get("uid") || "";
  if (uid) {
    try {
      if (SSStore.users.get(uid) && SSStore.session.get() === uid) { state.uid = uid; }
    } catch (e) { state.uid = ""; }
  }
}
function elapsedMs() { return Date.now() - state.roundStart - state.pausedTotal; }
function fmtTime(ms) {
  var s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
}

/* ================= builder helpers ================= */
function el(tag, attrs, parent) {
  var e = document.createElement(tag);
  Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
  if (parent) { parent.appendChild(e); }
  return e;
}
function box(parent, w, h, d, color, x, y, z, rot) {
  var a = { width: w, height: h, depth: d, position: x + " " + y + " " + z,
            material: "color:" + color + "; roughness:0.9" };
  if (rot) { a.rotation = "0 0 " + rot; }
  return el("a-box", a, parent);
}
function cyl(parent, r, h, color, x, y, z, rx, rz) {
  return el("a-cylinder", { radius: r, height: h, position: x + " " + y + " " + z,
    rotation: (rx || 0) + " 0 " + (rz || 0), material: "color:" + color + "; roughness:0.85" }, parent);
}
/* Phase 9 helpers. Textures are applied in object form on purpose: a
   material *string* containing a data URL would be torn apart by
   A-Frame's semicolon parser. */
function texMat(e, tex, opts) {
  var m = { src: SSTex.get(tex), roughness: 0.92 };
  if (opts) { Object.keys(opts).forEach(function (k) { m[k] = opts[k]; }); }
  e.setAttribute("material", m);
  return e;
}
function sign(parent, tex, w, h, x, y, z, rotY, emissive) {
  var p = el("a-plane", { width: w, height: h,
    position: x + " " + y + " " + z, rotation: "0 " + (rotY || 0) + " 0" }, parent);
  texMat(p, tex, emissive
    ? { emissive: "#FFFFFF", emissiveIntensity: 0.55 }
    : { roughness: 0.85 });
  return p;
}
/* Fake volumetrics: an additive cone under a light. Costs one transparent
   mesh, sells the whole room. */
function lightCone(parent, x, y, z, h, r) {
  var c = el("a-cone", { "radius-bottom": r, "radius-top": r * 0.18, height: h,
    position: x + " " + y + " " + z }, parent);
  c.setAttribute("material", { color: "#FFE9C0", transparent: true, opacity: 0.02,
    blending: "additive", "depth-write": false, side: "double" });
  return c;
}
