/* SpotSafe 360 - audio.js (module split, Phase 9.8).
   Synthesised WebAudio: unlock gate, blips, and the stereo-panned forklift
   beep clue. Zero asset files by design. */
"use strict";
/* ================= audio: synthesised, zero assets ================= */
var audio = {
  ctx: null, master: null,
  /* 17.3 soundscape (footsteps, building hum, generative music, engine) */
  musicBus: null, ambBus: null, music: null, ambience: null, engine: null,
  _noise: null
};
function audioReady() {
  if (!audio.ctx) {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { return false; }
    try { audio.ctx = new Ctx(); }
    catch (e) { return false; }   /* 17.4: never let audio break the game */
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
  }
  if (audio.ctx.state === "suspended") { audio.ctx.resume(); }
  return true;
}
function unlockAudioOnce() {
  if (state.audioUnlocked) { return; }
  state.audioUnlocked = true;
  audioReady();
}
function blip(freq) {
  if (!audio.ctx || state.muted) { return; }
  var t = audio.ctx.currentTime;
  var osc = audio.ctx.createOscillator();
  var gain = audio.ctx.createGain();
  osc.type = "sine"; osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
  gain.gain.linearRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(gain); gain.connect(audio.master);
  osc.start(t); osc.stop(t + 0.18);
}
function beepOnce(pan) {
  if (!audio.ctx || state.muted) { return; }
  var t = audio.ctx.currentTime;
  var panner = audio.ctx.createStereoPanner ? audio.ctx.createStereoPanner() : null;
  if (panner) { panner.pan.value = clamp(pan, -1, 1); panner.connect(audio.master); }
  var dest = panner || audio.master;
  [0, 0.3].forEach(function (off) {
    var osc = audio.ctx.createOscillator();
    var gain = audio.ctx.createGain();
    osc.type = "square"; osc.frequency.value = 1250;
    gain.gain.setValueAtTime(0.0001, t + off);
    gain.gain.linearRampToValueAtTime(0.25, t + off + 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, t + off + 0.14);
    osc.connect(gain); gain.connect(dest);
    osc.start(t + off); osc.stop(t + off + 0.16);
  });
}
function beepPan() {
  var cam = $("cam");
  var h = HAZARDS.filter(function (x) { return x.soundClue; })[0];
  if (!cam || !h) { return 0; }
  var yaw = cam.object3D.rotation.y;
  var fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  var dx = h.pos.x - cam.object3D.position.x, dz = h.pos.z - cam.object3D.position.z;
  var len = Math.hypot(dx, dz) || 1;
  var tx = dx / len, tz = dz / len;
  var rel = Math.atan2(tx * fz + tz * (-fx), tx * fx + tz * fz);
  return -Math.sin(rel) * 0.9;
}
function stopBeeps() { if (state.beepId) { clearInterval(state.beepId); state.beepId = null; } }
/* Phase 11 (Forklift Driver perk): the reversing alarm keeps that driver's
   own tempo - every 4 s instead of every 6. */
function beepEveryMs() {
  var v = typeof perkAmt === "function" ? perkAmt("beepInterval") : 0;
  return (v || CONFIG.beepEverySec) * 1000;
}
function startBeeps() {
  stopBeeps();
  var sounders = HAZARDS.filter(function (h) { return h.soundClue; });
  if (!sounders.length) { return; }
  state.beepId = setInterval(function () {
    if (state.roundOver) { stopBeeps(); return; }
    if (state.paused) { return; }
    if (sounders.every(function (h) { return state.found[h.id]; })) { stopBeeps(); return; }
    if (audioReady()) { beepOnce(beepPan()); }
    /* 12.2: flash the HUD perk chip on every beep so the tempo is visible. */
    if (typeof pulseAlarm === "function") { pulseAlarm(); }
  }, beepEveryMs());
}

/* =====================================================================
   Phase 17.3 soundscape - parity with the reference build's audio:
   footsteps on the walk cycle, a low building hum, a generative music bed,
   and the parked forklift's engine fading in with distance. All synthesised
   (no asset files), all guarded so pages keep working in any browser state
   and in jsdom (no AudioContext) alike. Everything respects state.muted.
   ===================================================================== */
var CHORD_LOOP = [
  [220.00, 261.63, 329.63],   /* A minor  - the "home" chord      */
  [174.61, 220.00, 261.63],   /* F major                          */
  [196.00, 246.94, 293.66],   /* G major                          */
  [164.81, 207.65, 246.94]    /* E major  - leans back to A minor */
];
var CHORD_SEC = 8;
function audioSetMuted() {
  if (!audio.ctx || !audio.master) { return; }
  var t = audio.ctx.currentTime;
  audio.master.gain.cancelScheduledValues(t);
  audio.master.gain.setTargetAtTime(state.muted ? 0 : 0.5, t, 0.08);
}
/* one shared half-second of white noise, reused by every noise sound */
function noiseBuffer() {
  if (audio._noise || !audio.ctx) { return audio._noise; }
  var n = Math.floor(audio.ctx.sampleRate * 0.5);
  var buf = audio.ctx.createBuffer(1, n, audio.ctx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < n; i++) { d[i] = Math.random() * 2 - 1; }
  audio._noise = buf;
  return buf;
}
/* A short filtered noise burst - a boot on concrete. Run = louder and
   brighter, crouch = quieter and duller. */
function footstep(running, crouching) {
  if (!audio.ctx || state.muted || state.paused || state.roundOver) { return; }
  var t = audio.ctx.currentTime;
  var src = audio.ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  var lp = audio.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = crouching ? 900 : running ? 1600 : 1300;
  lp.Q.value = 1.1;
  var g = audio.ctx.createGain();
  var peak = (crouching ? 0.028 : running ? 0.075 : 0.05) * (0.85 + Math.random() * 0.3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
  src.connect(lp); lp.connect(g); g.connect(audio.master);
  src.start(t); src.stop(t + 0.1);
}
/* Building hum: two low sines a few Hz apart (the classic big-room beat)
   plus a faint hiss, faded in over two seconds. */
function startAmbience() {
  if (!audioReady() || audio.ambience || state.muted) { return; }
  var ctx = audio.ctx, t = ctx.currentTime;
  var bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.linearRampToValueAtTime(0.05, t + 2.2);
  bus.connect(audio.master);
  var nodes = [bus];
  [[47, 0], [50.5, 0], [94, -0.35]].forEach(function (p) {
    var o = ctx.createOscillator();
    o.type = "sine"; o.frequency.value = p[0];
    var g = ctx.createGain(); g.gain.value = p[1] === 0 ? 0.55 : 0.1;
    o.connect(g); g.connect(bus); o.start(t);
    nodes.push(o, g);
  });
  var hiss = ctx.createBufferSource(); hiss.buffer = noiseBuffer(); hiss.loop = true;
  var hp = ctx.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = 420; hp.Q.value = 0.5;
  var hg = ctx.createGain(); hg.gain.value = 0.05;
  hiss.connect(hp); hp.connect(hg); hg.connect(bus); hiss.start(t);
  nodes.push(hiss, hp, hg);
  audio.ambience = { nodes: nodes, bus: bus };
  audio.ambBus = bus;
}
function stopAmbience() {
  if (!audio.ctx || !audio.ambience) { return; }
  var t = audio.ctx.currentTime, a = audio.ambience;
  a.bus.gain.cancelScheduledValues(t);
  a.bus.gain.setTargetAtTime(0.0001, t, 0.25);
  setTimeout(function () {
    a.nodes.forEach(function (n) { try { if (n.stop) { n.stop(); } n.disconnect(); } catch (e) {} });
  }, 900);
  audio.ambience = null; audio.ambBus = null;
}
/* Generative music bed: the four-chord loop, triangle waves with a slight
   detune per note, slow attack and release - calm, and never in the way of
   the play. */
function startMusic() {
  if (!audioReady() || audio.music || state.muted) { return; }
  var ctx = audio.ctx, t0 = ctx.currentTime;
  var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.4;
  var bus = ctx.createGain(); bus.gain.value = 0.4;
  lp.connect(bus); bus.connect(audio.master);
  var state_ = { step: 0, timer: null, lp: lp, bus: bus };
  function chord() {
    if (audio.music !== state_ || !audio.ctx) { return; }
    var t = ctx.currentTime + 0.05;
    var notes = CHORD_LOOP[state_.step % CHORD_LOOP.length];
    for (var i = 0; i < notes.length; i++) {
      [-6, 5].forEach(function (cents) {
        var o = ctx.createOscillator();
        o.type = "triangle"; o.frequency.value = notes[i]; o.detune.value = cents;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 2.4);
        g.gain.setValueAtTime(0.05, t + CHORD_SEC - 2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + CHORD_SEC + 1.5);
        o.connect(g); g.connect(lp);
        o.start(t); o.stop(t + CHORD_SEC + 1.7);
      });
    }
    state_.step += 1;
    state_.timer = setTimeout(chord, CHORD_SEC * 1000);
  }
  chord();
  audio.music = state_; audio.musicBus = bus;
}
function stopMusic() {
  if (!audio.ctx || !audio.music) { return; }
  var m = audio.music;
  audio.music = null; audio.musicBus = null;
  if (m.timer) { clearTimeout(m.timer); m.timer = null; }
  var t = audio.ctx.currentTime;
  m.bus.gain.cancelScheduledValues(t);
  m.bus.gain.setTargetAtTime(0.0001, t, 0.3);
  setTimeout(function () { try { m.bus.disconnect(); m.lp.disconnect(); } catch (e) {} }, 1200);
}
/* The parked forklift: a 62 Hz diesel-ish saw through a lowpass, gain by
   distance so the corner gets louder as you walk towards it. */
function startEngine() {
  if (!audioReady() || audio.engine || state.muted) { return; }
  var ctx = audio.ctx, t = ctx.currentTime;
  var bus = ctx.createGain(); bus.gain.value = 0.0001;
  bus.connect(audio.master);
  var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220;
  lp.connect(bus);
  var oscs = [];
  [[62, "sawtooth"], [93, "sawtooth"], [124, "triangle"]].forEach(function (p, i) {
    var o = ctx.createOscillator(); o.type = p[1]; o.frequency.value = p[0];
    var g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : i === 1 ? 0.22 : 0.12;
    o.connect(g); g.connect(lp); o.start(t);
    oscs.push(o, g);
  });
  audio.engine = { bus: bus, oscs: oscs };
  audioEngineTick(999);
}
function stopEngine() {
  if (!audio.ctx || !audio.engine) { return; }
  var e = audio.engine; audio.engine = null;
  var t = audio.ctx.currentTime;
  e.bus.gain.cancelScheduledValues(t);
  e.bus.gain.setTargetAtTime(0.0001, t, 0.2);
  setTimeout(function () {
    e.oscs.forEach(function (n) { try { if (n.stop) { n.stop(); } n.disconnect(); } catch (er) {} });
  }, 700);
}
function audioEngineTick(dist) {
  if (!audio.ctx || !audio.engine) { return; }
  var k = Math.max(0, 1 - (dist || 0) / 18);
  var want = state.muted || state.paused ? 0.0001 : Math.max(0.0001, k * k * 0.16);
  audio.engine.bus.gain.setTargetAtTime(want, audio.ctx.currentTime, 0.15);
}
/* Round start / end / pause wiring for the whole bed. */
function startSoundscape() { startAmbience(); startMusic(); startEngine(); }
function stopSoundscape() { stopAmbience(); stopMusic(); stopEngine(); }
function audioPause(on) {
  if (!audio.ctx) { return; }
  var t = audio.ctx.currentTime;
  if (audio.ambBus) { audio.ambBus.gain.setTargetAtTime(on || state.muted ? 0.0001 : 0.05, t, 0.2); }
  if (audio.musicBus) { audio.musicBus.gain.setTargetAtTime(on || state.muted ? 0.0001 : 0.4, t, 0.2); }
  /* the engine re-gains itself from the next distance tick */
  if (audio.engine) { audio.engine.bus.gain.setTargetAtTime(on || state.muted ? 0.0001 : 0.0001, t, 0.15); }
}
