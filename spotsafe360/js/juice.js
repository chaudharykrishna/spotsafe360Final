/* SpotSafe 360 - juice.js (Phase 13). The game-feel layer.
   Score pops, streak flares, marker pops, a wrong-click micro-shake, the
   review count-up and a faint dust layer. Rules this module lives by:
   - small DOM / A-Frame attribute animations only: no libraries, so the
     strict CSP and the offline story are untouched;
   - every motion path checks prefers-reduced-motion and stands still;
   - every function tolerates missing elements or modules (typeof guards
     on the caller side too), so juice can never break a round - and a
     mixed build gets caught loudly by the boot guard in app.js. */
"use strict";

function juiceReduced() {
  return !!(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/* ---------- score pop: "+12" floats up from the flag point ---------- */
function scorePop(x, z, text) {
  if (juiceReduced()) { return; }
  var scene = document.querySelector("a-scene");
  if (!scene) { return; }
  var t = document.createElement("a-text");
  t.setAttribute("value", String(text));
  t.setAttribute("color", "#FFD100");
  t.setAttribute("align", "center");
  t.setAttribute("width", "2.6");
  var y0 = 1.7;
  t.setAttribute("position", x + " " + y0 + " " + z);
  scene.appendChild(t);
  var t0 = performance.now();
  (function step() {
    var k = (performance.now() - t0) / 900;
    if (k >= 1 || !t.parentNode) {
      if (t.parentNode) { t.parentNode.removeChild(t); }
      return;
    }
    t.setAttribute("position", x + " " + (y0 + k * 0.9).toFixed(2) + " " + z);
    t.setAttribute("opacity", String(Math.max(0, 1 - k * k)));
    faceCam(t);
    requestAnimationFrame(step);
  })();
}
/* Billboard without A-Frame's look-at component: that component reads the
   scene's active camera during init and throws where no WebGL camera ever
   comes up. three.js Object3D.lookAt does the same job with no lifecycle,
   and the guards make it a no-op anywhere object3D is absent. */
function faceCam(t) {
  try {
    var cam = document.querySelector("[camera]");
    if (cam && cam.object3D && t.object3D) { t.object3D.lookAt(cam.object3D.position); }
  } catch (e) { /* never let cosmetics break a round */ }
}

/* ---------- marker pop: the green found-box overshoots, then settles -- */
function markerPop(m) {
  if (!m || !m.setAttribute || juiceReduced()) { return; }
  var t0 = performance.now();
  (function step() {
    var k = Math.min(1, (performance.now() - t0) / 320);
    var s = k < 0.45 ? 0.55 + (k / 0.45) * 0.7 : 1.25 - ((k - 0.45) / 0.55) * 0.25;
    m.setAttribute("scale", s.toFixed(3) + " " + s.toFixed(3) + " " + s.toFixed(3));
    if (k < 1) { requestAnimationFrame(step); }
    else { m.setAttribute("scale", "1 1 1"); }
  })();
}

/* ---------- streak feedback: HUD flare + rising pitch ---------- */
function streakFlare(streak) {
  var b = document.getElementById("hudStreak");
  if (!b || !b.parentElement) { return; }
  var box = b.parentElement;
  box.classList.remove("flare3", "flare5");
  if (streak < 3 || juiceReduced()) { return; }
  void box.offsetWidth;                       /* restart the animation */
  box.classList.add(streak >= 5 ? "flare5" : "flare3");
}
function streakSound(streak) {
  if (typeof blip !== "function") { return; }
  if (streak === 3) { blip(990); }
  else if (streak >= 5 && streak % 5 === 0) { blip(1180); }
}
function streakBreak(prev) {
  var b = document.getElementById("hudStreak");
  if (b && b.parentElement) { b.parentElement.classList.remove("flare3", "flare5"); }
  if (prev >= 3 && typeof blip === "function") { blip(150); }
}

/* ---------- wrong-click micro-shake: 160 ms on the scene element ------ */
function shakeScene() {
  if (juiceReduced()) { return; }
  var sc = document.querySelector("a-scene");
  if (!sc || !sc.classList) { return; }
  sc.classList.remove("shake");
  void sc.offsetWidth;
  sc.classList.add("shake");
  setTimeout(function () { sc.classList.remove("shake"); }, 220);
}

/* ---------- review count-up: the score lands instead of appearing ----- */
function countUp(el, target, ms) {
  if (!el) { return; }
  if (juiceReduced() || !ms) { el.textContent = String(target); return; }
  var t0 = performance.now();
  (function step() {
    var k = Math.min(1, (performance.now() - t0) / ms);
    el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
    if (k < 1) { requestAnimationFrame(step); }
    else { el.textContent = String(target); }
  })();
}

/* ---------- ambient dust: twelve faint motes drifting up the bay ------ */
var dustTimer = null;
function buildDust() {
  if (juiceReduced() || dustTimer) { return; }
  var scene = document.querySelector("a-scene");
  if (!scene) { return; }
  var motes = [];
  for (var i = 0; i < 12; i++) {
    var m = document.createElement("a-plane");
    var x = (Math.random() * 24 - 12).toFixed(1);
    var z = (Math.random() * 18 - 9).toFixed(1);
    var y = 0.4 + Math.random() * 3;
    m.setAttribute("width", "0.035");
    m.setAttribute("height", "0.035");
    m.setAttribute("material", "color:#DCE8F5; opacity:" +
      (0.05 + Math.random() * 0.09).toFixed(2) + "; transparent:true; side:double");
    m.setAttribute("position", x + " " + y.toFixed(2) + " " + z);
    scene.appendChild(m);
    motes.push({ el: m, x: x, z: z, y: y, v: 0.02 + Math.random() * 0.03 });
  }
  /* ~8 updates a second is plenty for dust and costs almost nothing */
  dustTimer = setInterval(function () {
    motes.forEach(function (d) {
      d.y += d.v;
      if (d.y > 3.9) { d.y = 0.3; }
      d.el.setAttribute("position", d.x + " " + d.y.toFixed(2) + " " + d.z);
    });
  }, 120);
}
