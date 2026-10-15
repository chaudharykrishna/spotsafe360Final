/* SpotSafe 360 - textures.js (Phase 9, visual pass). Procedural canvas
   textures: the bay gets concrete, corrugated steel, roller doors, wood,
   cardboard, tread plate, hazard stripes and safety signage without a
   single image file or network call. Everything is drawn once, cached as a
   data URL, and applied through setAttribute("material", {...}) object
   form - never as a material string, because the semicolons inside a data
   URL would break A-Frame's string parser. CSP-safe: img-src allows data:. */
(function (root) {
  "use strict";

  var cache = {};

  function canvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  function speckle(ctx, w, h, n, colors, size) {
    for (var i = 0; i < n; i++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      var s = size || 1 + Math.random() * 2;
      ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
  }
  function url(c) { return c.toDataURL("image/png"); }

  /* ---------- concrete floor: worn slab, tileable-ish ----------
     Dark on purpose (playtest 11 Oct: a mid-grey slab reflects the whole
     rig back and washes the bay out; real warehouse concrete is stained
     and much darker than a fresh pour). */
  function concrete() {
    var S = 512, c = canvas(S, S), x = c.getContext("2d");
    x.fillStyle = "#5C6268"; x.fillRect(0, 0, S, S);
    for (var i = 0; i < 26; i++) { /* soft wear blotches, mostly dark */
      var r = 30 + Math.random() * 90;
      var g = x.createRadialGradient(Math.random() * S, Math.random() * S, 0,
        Math.random() * S, Math.random() * S, r);
      var dark = Math.random() > 0.25;
      g.addColorStop(0, dark ? "rgba(36,40,44,0.22)" : "rgba(150,156,162,0.06)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    }
    x.strokeStyle = "rgba(38,42,46,0.30)"; x.lineWidth = 1; /* hairline cracks */
    for (i = 0; i < 5; i++) {
      x.beginPath();
      var px = Math.random() * S, py = Math.random() * S;
      x.moveTo(px, py);
      for (var k = 0; k < 6; k++) {
        px += (Math.random() - 0.5) * 70; py += (Math.random() - 0.5) * 70;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    /* tyre scuffs: wide, faint, dark strokes */
    x.strokeStyle = "rgba(28,31,35,0.16)"; x.lineWidth = 14;
    for (i = 0; i < 3; i++) {
      x.beginPath();
      var sx = Math.random() * S, sy = Math.random() * S;
      x.moveTo(sx, sy);
      x.bezierCurveTo(sx + 120, sy + 40, sx + 200, sy - 60, sx + 340, sy + 20);
      x.stroke();
    }
    speckle(x, S, S, 2200, ["rgba(26,30,34,0.24)", "rgba(150,156,162,0.06)"]);
    /* expansion joints: faint darker grid, matches the repeat tiling */
    x.strokeStyle = "rgba(32,36,40,0.40)"; x.lineWidth = 2;
    x.strokeRect(1, 1, S - 2, S - 2);
    return url(c);
  }

  /* ---------- corrugated wall cladding ---------- */
  function corrugated() {
    var S = 256, c = canvas(S, S), x = c.getContext("2d");
    for (var px = 0; px < S; px += 16) { /* vertical ribs */
      var g = x.createLinearGradient(px, 0, px + 16, 0);
      g.addColorStop(0, "#5C6B7C"); g.addColorStop(0.45, "#7C8CA0");
      g.addColorStop(0.55, "#6E7E92"); g.addColorStop(1, "#4E5C6C");
      x.fillStyle = g; x.fillRect(px, 0, 16, S);
    }
    x.fillStyle = "rgba(30,38,48,0.55)"; /* horizontal seams */
    [64, 192].forEach(function (y) { x.fillRect(0, y, S, 5); });
    x.fillStyle = "rgba(210,220,230,0.25)"; /* rivets */
    [64, 192].forEach(function (y) {
      for (var rx = 8; rx < S; rx += 32) { x.fillRect(rx, y + 1, 3, 3); }
    });
    /* grime towards the bottom of each tile */
    var gg = x.createLinearGradient(0, S - 60, 0, S);
    gg.addColorStop(0, "rgba(28,32,38,0)"); gg.addColorStop(1, "rgba(28,32,38,0.35)");
    x.fillStyle = gg; x.fillRect(0, S - 60, S, 60);
    speckle(x, S, S, 700, ["rgba(30,34,40,0.18)", "rgba(200,210,220,0.10)"]);
    return url(c);
  }

  /* ---------- roller shutter door ---------- */
  function roller() {
    var S = 256, c = canvas(S, S), x = c.getContext("2d");
    x.fillStyle = "#3A4859"; x.fillRect(0, 0, S, S);
    for (var y = 0; y < S; y += 14) {
      var g = x.createLinearGradient(0, y, 0, y + 14);
      g.addColorStop(0, "#54677D"); g.addColorStop(0.5, "#3F4F63");
      g.addColorStop(1, "#2C3A4A");
      x.fillStyle = g; x.fillRect(0, y, S, 13);
    }
    x.fillStyle = "rgba(20,26,34,0.6)"; x.fillRect(0, S - 10, S, 10);
    speckle(x, S, S, 500, ["rgba(20,24,30,0.25)", "rgba(190,200,214,0.08)"]);
    return url(c);
  }

  /* ---------- pallet wood ---------- */
  function wood() {
    var S = 128, c = canvas(S, S), x = c.getContext("2d");
    x.fillStyle = "#B08A5A"; x.fillRect(0, 0, S, S);
    for (var y = 0; y < S; y += 32) { /* planks */
      x.fillStyle = Math.random() > 0.5 ? "#A8814F" : "#B8905F";
      x.fillRect(0, y, S, 30);
      x.strokeStyle = "rgba(70,48,26,0.5)"; x.lineWidth = 1;
      x.strokeRect(0.5, y + 0.5, S - 1, 29);
      x.strokeStyle = "rgba(90,62,34,0.35)"; /* grain */
      for (var k = 0; k < 4; k++) {
        x.beginPath();
        var gy = y + 4 + Math.random() * 22;
        x.moveTo(0, gy);
        x.bezierCurveTo(S * 0.3, gy + 2, S * 0.6, gy - 2, S, gy + 1);
        x.stroke();
      }
    }
    speckle(x, S, S, 400, ["rgba(60,40,20,0.18)"]);
    return url(c);
  }

  /* ---------- cardboard box ---------- */
  function cardboard() {
    var S = 128, c = canvas(S, S), x = c.getContext("2d");
    x.fillStyle = "#C49A63"; x.fillRect(0, 0, S, S);
    speckle(x, S, S, 600, ["rgba(120,84,44,0.15)", "rgba(226,200,160,0.12)"]);
    x.fillStyle = "rgba(214,190,150,0.6)"; x.fillRect(0, S / 2 - 7, S, 14); /* tape */
    x.strokeStyle = "rgba(96,66,32,0.55)"; x.lineWidth = 2; /* flap seams */
    x.beginPath(); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke();
    x.strokeRect(1, 1, S - 2, S - 2);
    return url(c);
  }

  /* ---------- diamond tread plate ---------- */
  function tread() {
    var S = 128, c = canvas(S, S), x = c.getContext("2d");
    x.fillStyle = "#4A525C"; x.fillRect(0, 0, S, S);
    x.fillStyle = "#67717D";
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 8; col++) {
        var cx = col * 16 + 8 + (row % 2 ? 8 : 0), cy = row * 16 + 8;
        x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4);
        x.fillRect(-5, -2.5, 10, 5);
        x.restore();
      }
    }
    speckle(x, S, S, 400, ["rgba(20,24,28,0.3)", "rgba(180,190,200,0.10)"]);
    return url(c);
  }

  /* ---------- yellow/black hazard stripes ---------- */
  function stripes() {
    var S = 128, c = canvas(S, S), x = c.getContext("2d");
    x.fillStyle = "#FFD100"; x.fillRect(0, 0, S, S);
    x.fillStyle = "#1B1B1B";
    x.save(); x.translate(S / 2, S / 2); x.rotate(Math.PI / 4);
    for (var i = -S; i < S; i += 48) { x.fillRect(i, -S, 24, S * 2); }
    x.restore();
    return url(c);
  }

  /* ---------- safety signage ---------- */
  function signBase(w, h, bg) {
    var c = canvas(w, h), x = c.getContext("2d");
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.strokeStyle = "rgba(255,255,255,0.85)"; x.lineWidth = 6;
    x.strokeRect(5, 5, w - 10, h - 10);
    return { c: c, x: x };
  }
  function signPPE() {
    var s = signBase(256, 256, "#0B57A4"), x = s.x;
    x.fillStyle = "#FFFFFF";
    x.beginPath(); x.arc(128, 92, 34, Math.PI, 0); x.fill();          /* helmet dome */
    x.fillRect(84, 90, 88, 12);                                       /* brim */
    x.beginPath(); x.arc(128, 168, 30, 0, Math.PI * 2); x.fill();     /* head */
    x.fillRect(88, 196, 80, 26);                                      /* shoulders */
    x.font = "bold 22px sans-serif"; x.textAlign = "center";
    x.fillText("PPE MUST BE WORN", 128, 244);
    return url(s.c);
  }
  function signSpeed() {
    var s = signBase(256, 256, "#FFFFFF"), x = s.x;
    x.strokeStyle = "#C0392B"; x.lineWidth = 22;
    x.beginPath(); x.arc(128, 118, 74, 0, Math.PI * 2); x.stroke();
    x.fillStyle = "#17232F"; x.font = "bold 84px sans-serif"; x.textAlign = "center";
    x.fillText("5", 128, 146);
    x.font = "bold 26px sans-serif"; x.fillText("MPH MAX", 128, 232);
    return url(s.c);
  }
  function signExit() {
    var s = signBase(256, 160, "#0E7A3C"), x = s.x;
    x.fillStyle = "#FFFFFF";
    /* running man, simplified */
    x.beginPath(); x.arc(96, 48, 13, 0, Math.PI * 2); x.fill();
    x.save(); x.translate(92, 84); x.rotate(0.25);
    x.fillRect(-8, -22, 16, 40); x.restore();
    x.fillRect(70, 96, 12, 34); x.fillRect(96, 92, 12, 30);
    x.fillRect(116, 58, 30, 10);
    /* door + arrow */
    x.fillRect(168, 34, 10, 76);
    x.beginPath(); x.moveTo(196, 72); x.lineTo(224, 72); x.lineTo(224, 60);
    x.lineTo(244, 78); x.lineTo(224, 96); x.lineTo(224, 84); x.lineTo(196, 84);
    x.closePath(); x.fill();
    x.font = "bold 24px sans-serif"; x.textAlign = "center";
    x.fillText("FIRE EXIT", 128, 146);
    return url(s.c);
  }
  function signRoute() {
    var s = signBase(320, 160, "#0B57A4"), x = s.x;
    x.fillStyle = "#FFFFFF";
    x.beginPath(); x.arc(52, 44, 12, 0, Math.PI * 2); x.fill();
    x.save(); x.translate(50, 78); x.fillRect(-7, -20, 14, 36); x.restore();
    x.fillRect(32, 92, 11, 32); x.fillRect(54, 90, 11, 30);
    x.beginPath(); x.moveTo(96, 72); x.lineTo(150, 72); x.lineTo(150, 58);
    x.lineTo(180, 80); x.lineTo(150, 102); x.lineTo(150, 88); x.lineTo(96, 88);
    x.closePath(); x.fill();
    x.font = "bold 26px sans-serif"; x.textAlign = "center";
    x.fillText("PEDESTRIAN ROUTE", 160, 142);
    return url(s.c);
  }
  function signDock(n) {
    var s = signBase(192, 96, "#10243E"), x = s.x;
    x.fillStyle = "#FFFFFF"; x.font = "bold 44px sans-serif"; x.textAlign = "center";
    x.fillText("DOCK " + n, 96, 62);
    return url(s.c);
  }
  function keepClear() {
    var S = 256, c = canvas(S, S), x = c.getContext("2d");
    x.fillStyle = "#FFD100"; x.fillRect(0, 0, S, S);
    x.strokeStyle = "#1B1B1B"; x.lineWidth = 10; x.strokeRect(6, 6, S - 12, S - 12);
    x.fillStyle = "#1B1B1B"; x.font = "bold 44px sans-serif"; x.textAlign = "center";
    x.fillText("KEEP", 128, 118); x.fillText("CLEAR", 128, 170);
    return url(c);
  }

  var builders = {
    concrete: concrete, corrugated: corrugated, roller: roller, wood: wood,
    cardboard: cardboard, tread: tread, stripes: stripes,
    signPPE: signPPE, signSpeed: signSpeed, signExit: signExit,
    signRoute: signRoute, keepClear: keepClear
  };

  root.SSTex = {
    /* get("concrete") / get("dock:6") - drawn once, cached forever */
    get: function (name) {
      if (cache[name]) { return cache[name]; }
      var u;
      if (name.indexOf("dock:") === 0) { u = signDock(name.slice(5)); }
      else if (builders[name]) { u = builders[name](); }
      else { return ""; }
      cache[name] = u;
      return u;
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
