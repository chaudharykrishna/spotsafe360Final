/* SpotSafe 360 - player.js (module split, Phase 9.8).
   Movement and camera: the collision clamp, the third-person walker with
   view toggle, and the camera helpers (aim/stand/setCam/glide). */
"use strict";
/* ================= movement clamp ================= */
/* Kept apart from the camera so list mode can test a standing spot before
   it walks the player there. Mutates and returns the point given. */
function clampPoint(p) {
  /* Walls, then the things standing against them, twice over: a single pass
     lets a collider beside a wall push the standing point out through the
     wall, which is how you end up outside the bay at the fire exit.
     Phase 9.7: every collider grows by BODY_R - the walker is a person
     half a metre wide, not the point the eye-height camera used to be. */
  for (var pass = 0; pass < 3; pass++) {
    p.x = clamp(p.x, CONFIG.bounds.minX, CONFIG.bounds.maxX);
    p.z = clamp(p.z, CONFIG.bounds.minZ, CONFIG.bounds.maxZ);
    CONFIG.colliders.forEach(function (c) {
      var dx = p.x - c.x, dz = p.z - c.z;
      var d = Math.hypot(dx, dz);
      /* 12.3: dead centre has no push direction (d = 0), and the old
         `d > 0.0001` guard simply skipped it - stand exactly on a collider
         centre and you stayed inside it, free to walk out the far side.
         Resolve the degenerate case deterministically instead. */
      if (d < 0.0001) { p.x = c.x + (c.r + BODY_R); return; }
      if (d < c.r + BODY_R) { p.x = c.x + dx / d * (c.r + BODY_R); p.z = c.z + dz / d * (c.r + BODY_R); }
    });
  }
  p.x = clamp(p.x, CONFIG.bounds.minX, CONFIG.bounds.maxX);
  p.z = clamp(p.z, CONFIG.bounds.minZ, CONFIG.bounds.maxZ);
  return p;
}
function clampMovement() {
  clampPoint(walker);
}

/* ================= third-person walker (Phase 9.6) =================
   The learner now sees their own worker walking: WASD/arrows move a walker
   point, the avatar turns with the look-controls yaw, and the camera
   orbits 3.3 m behind at 2.45 m. look-controls keeps owning the rotation -
   this loop only ever writes positions, so mouse-look and the orbit never
   fight. In a VR presentation the headset owns the camera and we stay out
   of its way. */
var AV = [
  { helmet: "#FFD100", vest: "#F28C28", skin: "#D9B38C" },
  { helmet: "#FFD100", vest: "#2E6FDB", skin: "#8D5524" },
  { helmet: "#EAF2FB", vest: "#1D6B3A", skin: "#F1C27D" },
  { helmet: "#F28C28", vest: "#FFD100", skin: "#5C3A21" },
  { helmet: "#2E6FDB", vest: "#C0392B", skin: "#D9B38C" },
  { helmet: "#1D6B3A", vest: "#FFD100", skin: "#F1C27D" }
];
var walker = { x: 0, z: 8.4, phase: 0 };
var moveAmt = 0;
var keys = {};
var playerRig = null;
var BODY_R = 0.3;   /* the walker is a body, not a point (Phase 9.7) */
var CAM_BACK = 3.3, CAM_UP = 2.45, WALK_SPEED = 3.4;
/* 17.3 movement set (parity with the reference build's controls):
   hold Shift to run, C (or Ctrl) to crouch, smooth acceleration like a
   modern third-person game, a subtle head bob, and footstep triggers on
   the walk cycle. */
var RUN_MULT = 1.75, CROUCH_MULT = 0.55;
var CROUCH_CAM_UP = 1.62, CROUCH_EYE = 1.05;
var _tpVel = { x: 0, z: 0 };          /* smoothed horizontal velocity */
var _crouchK = 0;                      /* 0 standing .. 1 crouched */
var _bobT = 0, _bobAmt = 0;            /* head-bob phase and amplitude */
var _stepPhase = 0;                    /* walk-cycle step counter */
var _faceYaw = null;                   /* avatar facing (lags the movement) */

/* Phase 9.7: V swaps third-person (see your worker walk) and first-person
   (the old eye view). The avatar hides in first-person so you never see
   the inside of your own helmet. */
function setView(v) {
  state.view = v;
  if (playerRig) {
    playerRig.root.setAttribute("visible", v === "third" ? "true" : "false");
  }
}
function toggleView() {
  setView(state.view === "third" ? "first" : "third");
}

function buildPlayer() {
  var a = AV[state.avatar] || AV[0];
  var scene = document.querySelector("a-scene");
  var g = el("a-entity", { id: "player", position: walker.x + " 0 " + walker.z }, scene);
  /* Limbs hang from pivot entities at hip/shoulder height so a rotation.x
     on the pivot swings them like a pendulum. */
  function limb(x, y, w, h, d, color) {
    var piv = el("a-entity", { position: x + " " + y + " 0" }, g);
    box(piv, w, h, d, color, 0, -h / 2, 0);
    return piv;
  }
  var rig = { root: g };
  rig.lLeg = limb(-0.11, 0.79, 0.17, 0.74, 0.17, "#27303C");
  rig.rLeg = limb(0.11, 0.79, 0.17, 0.74, 0.17, "#27303C");
  box(rig.lLeg, 0.2, 0.1, 0.28, "#1B1F24", 0, -0.72, 0.04);  /* boots */
  box(rig.rLeg, 0.2, 0.1, 0.28, "#1B1F24", 0, -0.72, 0.04);
  box(g, 0.46, 0.62, 0.26, a.vest, 0, 1.11, 0);
  box(g, 0.5, 0.06, 0.3, "#FFD100", 0, 0.96, 0);             /* hi-vis */
  box(g, 0.5, 0.05, 0.3, "#E8F0F8", 0, 1.05, 0);
  box(g, 0.5, 0.06, 0.3, "#FFD100", 0, 1.16, 0);
  box(g, 0.5, 0.05, 0.3, "#E8F0F8", 0, 1.26, 0);
  rig.lArm = limb(-0.31, 1.38, 0.12, 0.55, 0.12, a.vest);
  rig.rArm = limb(0.31, 1.38, 0.12, 0.55, 0.12, a.vest);
  /* 17.2 fix: the glove spheres are parented to the arm PIVOTS (which sit
     at shoulder height), so their offsets must be local to the pivot. The
     old ground-relative y (0.83) put them 2.2 m in the air - two black
     dots floating beside the learner's own head, drifting around the aim
     dot as the view turned. Local -0.55 puts each glove exactly at the
     end of its own arm, matching the static workers in world.js. */
  el("a-sphere", { radius: 0.075, position: "-0.03 -0.55 0.02", material: "color:#3A424C; roughness:0.9" }, rig.lArm);
  el("a-sphere", { radius: 0.075, position: "0.03 -0.55 0.02", material: "color:#3A424C; roughness:0.9" }, rig.rArm);
  el("a-sphere", { radius: 0.16, position: "0 1.58 0", material: "color:" + a.skin + "; roughness:0.8" }, g);
  el("a-sphere", { radius: 0.18, position: "0 1.66 0", scale: "1 0.6 1", material: "color:" + a.helmet }, g);
  playerRig = rig;
}

function tpKey(e, down) {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
       "ShiftLeft", "ShiftRight", "KeyC", "ControlLeft"]
      .indexOf(e.code) >= 0) { keys[e.code] = down; }
}

var lastT = 0;
var _dtAcc = 0;                        /* 17.3: lag accumulator (see below) */
function tpStep(t) {
  /* 17.3: integrate in fixed 50 ms steps and catch up torn frames from the
     accumulator. The old single clamp froze fast movement on slow machines
     (a 4 fps machine moved at a fifth of walk speed); the fixed step keeps
     the speed honest at any frame rate while never moving the walker more
     than 50 ms worth of ground in one collision check. */
  var raw = ((t - lastT) || 16) / 1000; lastT = t;
  if (!(raw > 0)) { raw = 0.016; }
  _dtAcc = Math.min(0.35, _dtAcc + raw);
  while (_dtAcc > 0.0005) {
    var dt = Math.min(0.05, _dtAcc);
    _dtAcc -= dt;
    stepOnce(dt);
  }
  if (typeof window.__ss360LookHint === "function") { window.__ss360LookHint(); }
  if (typeof reticleTell === "function") { reticleTell(); }
  requestAnimationFrame(tpStep);
}

function stepOnce(dt) {
  var cam = $("cam");
  var scene = document.querySelector("a-scene");
  var inVr = !!(scene && scene.is && scene.is("vr-mode"));
  if (cam && cam.object3D) {
    var lc = camLook();
    var yaw = lc ? lc.yawObject.rotation.y : cam.object3D.rotation.y;
    var inF = 0, inS = 0;
    var canMove = !state.paused && !state.roundOver && !state.listOpen && !inVr;
    if (canMove) {
      inF = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      inS = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    }
    var len = Math.hypot(inF, inS);
    /* 17.3: run and crouch, held like every other key. */
    var running = !!(keys.ShiftLeft || keys.ShiftRight) && !(keys.KeyC || keys.ControlLeft);
    var crouching = !!(keys.KeyC || keys.ControlLeft);
    var speedCap = WALK_SPEED * (crouching ? CROUCH_MULT : running ? RUN_MULT : 1);
    var dvx = 0, dvz = 0;
    if (len > 0) {
      var fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      var rx = Math.cos(yaw), rz = -Math.sin(yaw);
      dvx = (fx * inF + rx * inS) / len * speedCap;
      dvz = (fz * inF + rz * inS) / len * speedCap;
    }
    /* Smooth acceleration and stopping (exponential approach, the same
       shape the reference build uses): walking feels weighted instead of
       snapping on and off. */
    var h = len > 0 ? 9 : 12;
    var g = 1 - Math.exp(-h * dt);
    _tpVel.x += (dvx - _tpVel.x) * g;
    _tpVel.z += (dvz - _tpVel.z) * g;
    var spd = Math.hypot(_tpVel.x, _tpVel.z);
    if (spd > 0.02) {
      walker.x += _tpVel.x * dt;
      walker.z += _tpVel.z * dt;
      clampPoint(walker);
    }
    /* Walk-cycle: leg swing, footsteps and the bob all run off the same
       phase so the sound lands exactly with the foot hitting the floor. */
    var speedK = Math.min(1.6, spd / WALK_SPEED);
    walker.phase += dt * spd * 2.5;
    var stepped = Math.floor(walker.phase / Math.PI);
    if (stepped !== _stepPhase && spd > 0.6) {
      _stepPhase = stepped;
      state.stepCount = (state.stepCount || 0) + 1;
      if (typeof footstep === "function") { footstep(running, crouching); }
    }
    moveAmt += ((len > 0 ? 1 : 0) - moveAmt) * Math.min(1, dt * 10);
    /* Crouch blends in and out so the view never snaps. */
    _crouchK += ((crouching ? 1 : 0) - _crouchK) * Math.min(1, dt * 8);
    /* Head bob, subtle and speed-scaled, off for reduced-motion users. */
    if (!reduceMotion() && spd > 0.4) {
      _bobT += dt * spd * 1.9;
      var target = 0.022 * speedK;
      _bobAmt += (target - _bobAmt) * Math.min(1, dt * 6);
    } else {
      _bobAmt += (0 - _bobAmt) * Math.min(1, dt * 6);
    }
    var bobY = Math.sin(_bobT * 2) * _bobAmt;
    if (playerRig) {
      var s = Math.sin(walker.phase) * 0.55 * moveAmt;
      playerRig.root.object3D.position.set(walker.x,
        Math.abs(Math.sin(walker.phase)) * 0.04 * moveAmt, walker.z);
      /* 17.3: the model faces where it is GOING (a strafe turns the body),
         easing back to the view direction when standing still - the same
         read as a third-person game. */
      var want = yaw;
      if (len > 0.01 && spd > 0.4) { want = Math.atan2(-_tpVel.x, -_tpVel.z); }
      if (_faceYaw === null) { _faceYaw = want; }
      var dWrap = ((want - _faceYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      _faceYaw += dWrap * Math.min(1, dt * 9);
      /* The model's toes point +Z, the view forward is -Z at yaw 0. */
      playerRig.root.object3D.rotation.y = _faceYaw + Math.PI;
      /* Crouch squashes the body toward the floor (the rig sits on it). */
      playerRig.root.object3D.scale.set(1, 1 - 0.22 * _crouchK, 1);
      playerRig.lLeg.object3D.rotation.x = s;
      playerRig.rLeg.object3D.rotation.x = -s;
      playerRig.lArm.object3D.rotation.x = -s * 0.7;
      playerRig.rArm.object3D.rotation.x = s * 0.7;
    }
    /* The parked forklift keeps its engine audible: gain follows distance. */
    if (typeof audioEngineTick === "function" && !state.paused && !state.roundOver) {
      var ft = null;
      for (var hi = 0; hi < HAZARDS.length; hi++) {
        if (HAZARDS[hi].soundClue) { ft = HAZARDS[hi]; break; }
      }
      if (ft) { audioEngineTick(Math.hypot(walker.x - ft.pos.x, walker.z - ft.pos.z)); }
    }
    if (!inVr) {
      var camY = CAM_UP + (CROUCH_CAM_UP - CAM_UP) * _crouchK;
      if (state.view === "first") {
        /* The old eye view: camera at the walker's own eyes. */
        camY = CONFIG.eyeHeight + (CROUCH_EYE - CONFIG.eyeHeight) * _crouchK;
        cam.object3D.position.set(walker.x, camY + bobY, walker.z);
      } else {
        var bx = -Math.sin(yaw), bz = -Math.cos(yaw);
        var cx = clamp(walker.x - bx * CAM_BACK, CONFIG.bounds.minX, CONFIG.bounds.maxX);
        var cz = clamp(walker.z - bz * CAM_BACK, CONFIG.bounds.minZ, CONFIG.bounds.maxZ);
        cam.object3D.position.set(cx, camY + bobY * 0.6, cz);
      }
    }
  }
}

function reduceMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function aimY(item) { return item.aimY || 1.2; }
function standable(p) {
  if (p.x < CONFIG.bounds.minX || p.x > CONFIG.bounds.maxX ||
      p.z < CONFIG.bounds.minZ || p.z > CONFIG.bounds.maxZ) { return false; }
  return !CONFIG.colliders.some(function (c) {
    return Math.hypot(p.x - c.x, p.z - c.z) < c.r;
  });
}
/* Where to stand: back off along the line the player is already on, so the
   walk is short and the bay stays legible on the way. */
function standPoint(item) {
  var p = $("cam").object3D.position;
  var dx = p.x - item.pos.x, dz = p.z - item.pos.z;
  var d = Math.hypot(dx, dz);
  /* Standing on the spot, or directly under one up in the air, leaves no
     direction to keep: back off towards the middle of the bay instead. */
  if (d < 0.01) {
    dx = -item.pos.x; dz = -item.pos.z;
    d = Math.hypot(dx, dz) || 1;
  }
  var base = Math.atan2(dz / d, dx / d);
  var off = item.radius + CONFIG.locate.standoffM;
  var first = null;
  /* The player's own line first, then swing round the spot in both
     directions. Things against a wall, like the stillages at the fire exit,
     have only a few sides you can actually stand on. */
  for (var i = 0; i < 12; i++) {
    var turn = (i % 2 ? -1 : 1) * Math.ceil(i / 2) * (Math.PI / 6);
    var cand = { x: item.pos.x + Math.cos(base + turn) * off,
                 z: item.pos.z + Math.sin(base + turn) * off };
    if (!first) { first = { x: cand.x, z: cand.z }; }
    if (standable(cand)) { return cand; }
  }
  return clampPoint(first);
}
/* Yaw and pitch that put the spot on the centre dot, in the angle
   convention flagCenter reads back. */
function aimFrom(x, z, item) {
  var dx = item.pos.x - x, dy = aimY(item) - CONFIG.eyeHeight, dz = item.pos.z - z;
  var flat = Math.hypot(dx, dz) || 0.0001;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, flat) };
}
function camLook() {
  var cam = $("cam");
  var lc = cam.components && cam.components["look-controls"];
  return lc && lc.yawObject && lc.pitchObject ? lc : null;
}
function setCam(x, z, yaw, pitch) {
  var cam = $("cam");
  var lc = camLook();
  /* Phase 9.6: third-person - the walk target is the walker, and the camera
     follows it on the next frame of tpStep. Clamp every step of the walk,
     not just where it ends, so a glide never clips through a rack. */
  var at = clampPoint({ x: x, z: z });
  walker.x = at.x; walker.z = at.z;
  /* look-controls owns the camera rotation and rewrites it every frame, so
     the turn has to be written into its own yaw and pitch objects. */
  if (lc) { lc.yawObject.rotation.y = yaw; lc.pitchObject.rotation.x = pitch; }
  cam.object3D.rotation.y = yaw;
  cam.object3D.rotation.x = pitch;
}
function glideTo(to, item) {
  var cam = $("cam");
  var lc = camLook();
  var aim = aimFrom(to.x, to.z, item);
  var from = {
    x: cam.object3D.position.x, z: cam.object3D.position.z,
    yaw: lc ? lc.yawObject.rotation.y : cam.object3D.rotation.y,
    pitch: lc ? lc.pitchObject.rotation.x : cam.object3D.rotation.x
  };
  /* Turn the short way round: 170 degrees to minus 170 is a 20 degree turn,
     not a 340 degree spin. */
  var dyaw = aim.yaw - from.yaw;
  while (dyaw > Math.PI) { dyaw -= 2 * Math.PI; }
  while (dyaw < -Math.PI) { dyaw += 2 * Math.PI; }
  if (state.locate.raf) { cancelAnimationFrame(state.locate.raf); state.locate.raf = 0; }
  var ms = reduceMotion() ? 0 : CONFIG.locate.glideMs;
  if (ms <= 0) { setCam(to.x, to.z, aim.yaw, aim.pitch); return; }
  var t0 = Date.now();
  (function step() {
    var k = Math.min(1, (Date.now() - t0) / ms);
    var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    setCam(from.x + (to.x - from.x) * e, from.z + (to.z - from.z) * e,
           from.yaw + dyaw * e, from.pitch + (aim.pitch - from.pitch) * e);
    if (k < 1) { state.locate.raf = requestAnimationFrame(step); }
    else { state.locate.raf = 0; }
  })();
}
/* The resting look of a marker box: green once flagged, a faint yellow once
   a training hint has pointed at it, invisible otherwise. */
