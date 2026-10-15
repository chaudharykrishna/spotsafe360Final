/* SpotSafe 360 - world.js (module split, Phase 9.8).
   The goods-in bay: worker/forklift/rack/pallet builders, buildRoom and
   buildProps, plus the collider entries for everything that is solid. */
"use strict";
function worker(parent, x, z, vest, pants, hiVis) {
  var g = el("a-entity", { position: x + " 0 " + z }, parent);
  /* Phase 9: same silhouette, better detail - boots, gloves, silver
     bands on the hi-vis. Recognition in the bay must not change. */
  box(g, 0.17, 0.74, 0.17, pants, -0.11, 0.42, 0);
  box(g, 0.17, 0.74, 0.17, pants, 0.11, 0.42, 0);
  box(g, 0.2, 0.1, 0.28, "#1B1F24", -0.11, 0.05, 0.04);   /* boots */
  box(g, 0.2, 0.1, 0.28, "#1B1F24", 0.11, 0.05, 0.04);
  box(g, 0.46, 0.62, 0.26, vest, 0, 1.11, 0);
  if (hiVis) {
    box(g, 0.5, 0.06, 0.3, "#FFD100", 0, 0.96, 0);
    box(g, 0.5, 0.05, 0.3, "#E8F0F8", 0, 1.05, 0);        /* silver band */
    box(g, 0.5, 0.06, 0.3, "#FFD100", 0, 1.16, 0);
    box(g, 0.5, 0.05, 0.3, "#E8F0F8", 0, 1.26, 0);
  }
  box(g, 0.12, 0.55, 0.12, vest, -0.31, 1.12, 0, 8);
  box(g, 0.12, 0.55, 0.12, vest, 0.31, 1.12, 0, -8);
  el("a-sphere", { radius: 0.075, position: "-0.33 0.83 0.02", material: "color:#3A424C; roughness:0.9" }, g);
  el("a-sphere", { radius: 0.075, position: "0.33 0.83 0.02", material: "color:#3A424C; roughness:0.9" }, g);
  el("a-sphere", { radius: 0.16, position: "0 1.58 0", material: "color:#D9B38C; roughness:0.8" }, g);
  if (hiVis) {
    el("a-sphere", { radius: 0.18, position: "0 1.66 0", scale: "1 0.6 1", material: "color:#FFD100" }, g);
  } else {
    el("a-sphere", { radius: 0.17, position: "0 1.66 0", scale: "1 0.6 1", material: "color:#2B2B2B" }, g);
  }
  return g;
}
function palletStack(parent, x, z, layers) {
  var g = el("a-entity", { position: x + " 0 " + z }, parent);
  for (var i = 0; i < layers; i++) {
    var y = i * 0.62;
    var yaw = (i % 2 ? 3 : -2) + (i * 1.7);           /* stacked by hand, not by machine */
    texMat(box(g, 1.2, 0.14, 1.2, "#FFFFFF", 0, 0.07 + y, 0, yaw), "wood", { roughness: 0.95 });
    var c = box(g, 1.0, 0.46, 1.0, "#FFFFFF", 0, 0.37 + y, 0, yaw);
    texMat(c, "cardboard", { roughness: 0.9 });
    if (i === layers - 1 && layers > 1) {              /* shrink wrap on the top box */
      el("a-box", { width: 1.04, height: 0.5, depth: 1.04, position: "0 " + (0.37 + y) + " 0",
        rotation: "0 " + yaw + " 0",
        material: "color:#DCE8F0; transparent:true; opacity:0.3; roughness:0.2" }, g);
    }
  }
  return g;
}
function rackBay(parent, x, z) {
  var g = el("a-entity", { position: x + " 0 " + z }, parent);
  /* Phase 9: uprights with diagonal bracing and foot plates, teal load
     beams, and loads that look loaded - pallets under every carton. */
  [-2.5, 2.5].forEach(function (dz) {
    [-0.55, 0.55].forEach(function (dx) {
      box(g, 0.11, 3.4, 0.11, "#E87722", dx, 1.7, dz);
      box(g, 0.3, 0.04, 0.3, "#8A8F94", dx, 0.02, dz);            /* foot plate */
    });
    /* diagonal bracing in the end frames */
    box(g, 0.05, 1.9, 0.05, "#C05F10", -0.55, 1.15, dz, 32);
    box(g, 0.05, 1.9, 0.05, "#C05F10", 0.55, 2.35, dz, -32);
  });
  [1.1, 2.3].forEach(function (y) {
    [-0.58, 0.58].forEach(function (dx) {
      box(g, 0.09, 0.14, 5.1, "#2E8FA8", dx, y, 0);                /* teal beams */
      box(g, 0.1, 0.06, 0.1, "#FFD100", dx, y + 0.1, -2.45);      /* beam lock */
      box(g, 0.1, 0.06, 0.1, "#FFD100", dx, y + 0.1, 2.45);
    });
    [-1.65, 0, 1.65].forEach(function (dz, i) {
      texMat(box(g, 1.0, 0.13, 1.0, "#FFFFFF", 0, y + 0.14, dz), "wood", { roughness: 0.95 });
      var h = (i === 1 && y > 2) ? 0.95 : 0.7;                     /* mixed load heights */
      var c = box(g, 0.88, h, 0.88, "#FFFFFF", (i - 1) * 0.04, y + 0.21 + h / 2, dz, (i - 1) * 4);
      texMat(c, "cardboard", { roughness: 0.9 });
      if (i === 2) {                                               /* shrink-wrapped load */
        el("a-box", { width: 0.94, height: h + 0.06, depth: 0.94,
          position: "0.08 " + (y + 0.21 + h / 2) + " " + dz,
          material: "color:#DCE8F0; transparent:true; opacity:0.28; roughness:0.2" }, g);
      }
    });
  });
  return g;
}
function forklift(parent, x, z, ry) {
  var g = el("a-entity", { position: x + " 0 " + z, rotation: "0 " + (ry || 0) + " 0" }, parent);
  /* Phase 9: body, counterweight, overhead guard, mast with forks, and a
     flashing amber beacon. The beacon animates material.color, not
     emissive, so the hover glow's emissive writes never switch it off. */
  box(g, 1.0, 0.8, 1.7, "#F28C28", 0, 0.75, 0);
  box(g, 0.94, 0.55, 0.5, "#D97A1E", 0, 0.72, -1.02);             /* counterweight */
  box(g, 0.9, 0.5, 0.6, "#3A3A3A", 0, 1.35, -0.4);                /* cab back */
  box(g, 0.5, 0.08, 0.45, "#22262E", 0, 1.02, -0.15);             /* seat */
  [[-0.45, 0.55], [0.45, 0.55], [-0.45, -0.75], [0.45, -0.75]].forEach(function (p) {
    box(g, 0.07, 1.35, 0.07, "#2B2B2B", p[0], 2.1, p[1]);         /* guard posts */
  });
  box(g, 1.1, 0.06, 1.6, "#2B2B2B", 0, 2.8, -0.1);                /* guard roof */
  [0.35, -0.35].forEach(function (dx) {
    box(g, 0.08, 2.3, 0.08, "#3A3A3A", dx, 1.3, 0.95);            /* mast rails */
    box(g, 0.1, 0.05, 1.4, "#3A3A3A", dx, 0.12, 1.55);            /* forks */
    box(g, 0.02, 1.9, 0.02, "#5A5F66", dx + 0.06, 1.4, 1.0);      /* chain hint */
  });
  box(g, 0.7, 0.06, 0.1, "#3A3A3A", 0, 2.2, 0.98);                /* mast crossbar */
  [[-0.5, 0.6], [0.5, 0.6], [-0.5, -0.6], [0.5, -0.6]].forEach(function (w) {
    cyl(g, 0.28, 0.2, "#222222", w[0], 0.28, w[1], 0, 90);
  });
  var beacon = el("a-sphere", { radius: 0.09, position: "0 2.92 -0.1" }, g);
  beacon.setAttribute("material", {
    color: "#FF8A00", emissive: "#FF6A00", emissiveIntensity: 0.9, roughness: 0.35
  });
  beacon.setAttribute("animation__flash", {
    property: "material.color", from: "#5A2200", to: "#FFA030",
    dur: 480, dir: "alternate", loop: true, easing: "linear"
  });
  return g;
}

/* ================= the bay ================= */
function buildRoom() {
  var room = $("room");
  /* Floor: worn concrete, procedural. The painted walkway lines keep
     their exact positions - x 10.4 and 12.2 - because list mode and the
     briefing wording reference the walkway where it actually is. */
  var floor = el("a-plane", { rotation: "-90 0 0", width: 36, height: 24,
    position: "0 0 0" }, room);
  texMat(floor, "concrete", { repeat: "14 9", roughness: 0.96 });

  /* Ceiling: dark deck, roof trusses, cable tray and a sprinkler run. */
  el("a-plane", { rotation: "-90 0 0", width: 36, height: 24, position: "0 8 0",
    material: "color:#131C27; side:back; roughness:1" }, room);
  [-15, -9, -3, 3, 9, 15].forEach(function (x) {
    box(room, 0.22, 0.5, 24, "#202B38", x, 7.72, 0);
    box(room, 0.1, 0.1, 24, "#2A3746", x - 0.4, 7.5, 0);
  });
  box(room, 36, 0.14, 0.3, "#2A3746", 0, 7.4, -5);          /* cable tray */
  box(room, 36, 0.14, 0.3, "#2A3746", 0, 7.4, 5);
  [-8, 0, 8].forEach(function (z) {                          /* sprinkler main */
    cyl(room, 0.05, 36, "#7C2A2A", 0, 7.55, z, 0, 90);
    [-12, -4, 4, 12].forEach(function (x) {
      cyl(room, 0.03, 0.18, "#9A3535", x, 7.42, z);
    });
  });

  /* Walls: corrugated cladding with a dark dado. North carries the docks,
     so the signs hang there and on the west wall. */
  var wN = el("a-plane", { width: 36, height: 8, position: "0 4 -12" }, room);
  texMat(wN, "corrugated", { repeat: "12 3", roughness: 0.9 });
  var wS = el("a-plane", { width: 36, height: 8, position: "0 4 12", rotation: "0 180 0" }, room);
  texMat(wS, "corrugated", { repeat: "12 3", roughness: 0.9 });
  var wW = el("a-plane", { width: 24, height: 8, position: "-18 4 0", rotation: "0 90 0" }, room);
  texMat(wW, "corrugated", { repeat: "8 3", roughness: 0.9 });
  var wE = el("a-plane", { width: 24, height: 8, position: "18 4 0", rotation: "0 -90 0" }, room);
  texMat(wE, "corrugated", { repeat: "8 3", roughness: 0.9 });
  box(room, 36, 1.1, 0.08, "#39434F", 0, 0.55, -11.94);     /* dados */
  box(room, 36, 1.1, 0.08, "#39434F", 0, 0.55, 11.94);
  box(room, 0.08, 1.1, 24, "#39434F", -17.94, 0.55, 0);
  box(room, 0.08, 1.1, 24, "#39434F", 17.94, 0.55, 0);

  /* Signage */
  sign(room, "signPPE", 1.5, 1.5, 2.2, 3.4, -11.9, 0);
  sign(room, "signSpeed", 1.3, 1.3, -12, 3.4, -11.9, 0);
  sign(room, "signRoute", 2.2, 1.1, -17.9, 3.2, 3, 90);
  sign(room, "signRoute", 2.2, 1.1, 13, 3.4, 11.9, 180);

  /* Light panels with fake volumetric cones; the third one flickers -
     one dying tube is the cheapest atmosphere in a warehouse. Kept dim
     on purpose: these read as lights in a dark bay, not as floodlights
     (playtest 11 Oct: 0.85 washed the whole scene out). */
  [-9, -3, 3, 9].forEach(function (x, i) {
    var panel = el("a-plane", { rotation: "-90 0 0", width: 4, height: 1.2,
      position: x + " 7.95 0",
      material: "color:#FFFDF4; emissive:#FFF8E6; emissiveIntensity:0.42; side:double" }, room);
    box(room, 4.2, 0.12, 1.4, "#33404F", x, 7.99, 0);
    lightCone(room, x, 5.2, 0, 5.4, 2.0);
    if (i === 2) {
      panel.setAttribute("animation__flicker", {
        property: "material.emissiveIntensity", from: 0.42, to: 0.24,
        dur: 90, dir: "alternate", loop: true, easing: "linear"
      });
    }
  });
  [-10, 0, 10].forEach(function (x) {
    [-6, 2, 9].forEach(function (z) {
      box(room, 0.95, 0.14, 0.55, "#2A3440", x, 6.45, z);
      el("a-plane", { rotation: "-90 0 0", width: 0.85, height: 0.45,
        position: x + " 6.37 " + z,
        material: "color:#FFFBE8; emissive:#FFF6D8; emissiveIntensity:0.35; side:double" }, room);
      lightCone(room, x, 4.6, z, 3.4, 1.1);
    });
  });

  /* Floor markings: the walkway keeps its exact lines, edged in white,
     with KEEP CLEAR at the fire exit and stack-footprint squares. */
  [10.4, 12.2].forEach(function (x) {
    el("a-plane", { rotation: "-90 0 0", width: 0.18, height: 16,
      position: x + " 0.02 1", material: "color:#FFD100; roughness:0.8" }, room);
    el("a-plane", { rotation: "-90 0 0", width: 0.05, height: 16,
      position: (x < 11 ? x - 0.16 : x + 0.16) + " 0.021 1",
      material: "color:#D8DEE4; roughness:0.8" }, room);
  });
  var kc = el("a-plane", { rotation: "-90 0 0", width: 1.7, height: 1.7,
    position: "16.9 0.022 2" }, room);
  texMat(kc, "keepClear", { roughness: 0.85 });
  [[-6, 2], [-8, -3], [8, 8]].forEach(function (s) {
    box(room, 1.7, 0.015, 0.06, "#FFD100", s[0], 0.015, s[1] - 0.85);
    box(room, 1.7, 0.015, 0.06, "#FFD100", s[0], 0.015, s[1] + 0.85);
    box(room, 0.06, 0.015, 1.7, "#FFD100", s[0] - 0.85, 0.015, s[1]);
    box(room, 0.06, 0.015, 1.7, "#FFD100", s[0] + 0.85, 0.015, s[1]);
  });
  /* Drain grate beside the spill zone */
  box(room, 0.9, 0.03, 0.9, "#1E252C", 10.6, 0.015, -9);
  for (var gz = -9.3; gz <= -8.7; gz += 0.15) {
    box(room, 0.8, 0.02, 0.04, "#3A434C", 10.6, 0.03, gz);
  }
}
function buildProps() {
  var p = $("props");
  rackBay(p, -16, -6); rackBay(p, -16, 1); rackBay(p, -16, 8);

  /* Dock doors: roller shutters in frames, dock plates above, bumpers and
     a control box beside each. Positions unchanged (colliders). */
  [6, 12].forEach(function (x, i) {
    box(p, 3.3, 3.7, 0.22, "#2E3B4E", x, 1.8, -11.86);
    var door = el("a-plane", { width: 3.0, height: 3.4, position: x + " 1.7 -11.73" }, p);
    texMat(door, "roller", { repeat: "1 1", roughness: 0.7, metalness: 0.35 });
    box(p, 3.3, 0.16, 0.3, "#222C39", x, 3.56, -11.7);      /* header */
    [-1.7, 1.7].forEach(function (dx) {
      box(p, 0.22, 3.6, 0.26, "#3A4859", x + dx, 1.8, -11.72);
    });
    [-1.35, 1.35].forEach(function (dx) {
      box(p, 0.3, 0.7, 0.24, "#171B20", x + dx, 0.35, -11.55); /* bumpers */
    });
    box(p, 0.3, 0.4, 0.12, "#5B6773", x + 2.05, 1.4, -11.7);  /* control box */
    var led = box(p, 0.06, 0.06, 0.03, "#3DDC6A", x + 2.05, 1.55, -11.63);
    led.setAttribute("material", "color:#3DDC6A; emissive:#3DDC6A; emissiveIntensity:0.9");
    sign(p, "dock:" + (i ? 7 : 6), 0.95, 0.48, x, 3.95, -11.72, 0);
  });
  /* Dock 6 leveller: tread plate out to the trailer */
  var lev = el("a-plane", { rotation: "-90 0 0", width: 2.6, height: 2.2,
    position: "6 0.04 -10.1" }, p);
  texMat(lev, "tread", { repeat: "2 2", roughness: 0.6, metalness: 0.5 });

  /* Trailer at dock 6: ribbed sides, rear doors, wheels, landing gear. */
  var t = el("a-entity", { position: "6 0 -8.4" }, p);
  box(t, 2.5, 2.6, 6, "#24406B", 0, 1.5, 0);
  var tSide1 = el("a-plane", { width: 6, height: 2.4, position: "1.26 1.5 0", rotation: "0 90 0" }, t);
  texMat(tSide1, "corrugated", { repeat: "4 2", roughness: 0.85 });
  var tSide2 = el("a-plane", { width: 6, height: 2.4, position: "-1.26 1.5 0", rotation: "0 -90 0" }, t);
  texMat(tSide2, "corrugated", { repeat: "4 2", roughness: 0.85 });
  box(t, 2.4, 2.3, 0.08, "#1B3050", 0, 1.5, -3.02);          /* rear doors */
  box(t, 0.06, 2.3, 0.05, "#9AA4B0", -0.03, 1.5, -3.07);
  box(t, 2.6, 0.16, 6.1, "#1A2430", 0, 0.14, 0);             /* chassis */
  box(t, 2.2, 0.12, 0.3, "#3A3A3A", 0, 0.5, -3.1);           /* rear bumper */
  [[-0.9, -1.6], [0.9, -1.6], [-0.9, 1.6], [0.9, 1.6]].forEach(function (w) {
    cyl(t, 0.42, 0.24, "#14171B", w[0], 0.42, w[1], 0, 90);
  });
  box(t, 0.2, 0.9, 0.2, "#3A424C", -0.8, 0.55, 2.2);         /* landing gear */
  box(t, 0.2, 0.9, 0.2, "#3A424C", 0.8, 0.55, 2.2);

  /* Fire exit: red door, push bar, and a lit running-man sign above. */
  box(p, 0.1, 2.1, 1.2, "#C0392B", 17.9, 1.05, 2);
  box(p, 0.06, 0.08, 0.5, "#C8D2DC", 17.83, 1.05, 2.35);     /* push bar */
  sign(p, "signExit", 0.9, 0.56, 17.88, 2.5, 2, -90, true);
  cyl(p, 0.09, 0.55, "#C0392B", 17.75, 1.1, 0.6);            /* extinguisher */
  box(p, 0.3, 0.4, 0.1, "#C0392B", 17.85, 1.55, 0.6);        /* its wall bracket */

  /* Walkway barrier: posts with reflective bands, two rails. */
  for (var z = -6; z <= 8; z += 2) {
    cyl(p, 0.06, 1.1, "#FFD100", 12.6, 0.55, z);
    cyl(p, 0.065, 0.1, "#1B1B1B", 12.6, 0.75, z);
    cyl(p, 0.065, 0.1, "#1B1B1B", 12.6, 0.4, z);
  }
  box(p, 0.06, 0.06, 14.4, "#FFD100", 12.6, 0.95, 1);
  box(p, 0.06, 0.06, 14.4, "#FFD100", 12.6, 0.5, 1);

  /* Charging point: unit, LED, coiled lead on a hook. */
  box(p, 0.7, 1.3, 0.45, "#5B6773", -4, 0.65, 11.6);
  var cLed = box(p, 0.1, 0.1, 0.04, "#3DDC6A", -4, 1.1, 11.36);
  cLed.setAttribute("material", "color:#3DDC6A; emissive:#3DDC6A; emissiveIntensity:0.8");
  el("a-torus", { radius: 0.22, "radius-tubular": 0.025, position: "-3.4 0.9 11.5",
    rotation: "90 0 0", material: "color:#1B2430; roughness:0.9" }, p);

  /* Mezzanine: slab on columns, hazard-striped fascia on the open edge,
     railing stubs where the rail should be, and a stair. The missing rail
     is the hazard; the stubs and stripes make that legible. */
  box(p, 6, 0.18, 3, "#39465A", -6, 3, 10.4);
  var fascia = el("a-plane", { width: 6, height: 0.34, position: "-6 2.86 8.92",
    rotation: "0 180 0" }, p);
  texMat(fascia, "stripes", { repeat: "6 1", roughness: 0.8 });
  [[-8.6, 8.95], [-3.4, 8.95]].forEach(function (s) {
    box(p, 0.08, 0.5, 0.08, "#8A8F94", s[0], 3.33, s[1]);     /* rail stubs */
  });
  [[-8.8, 9], [-3.2, 9], [-8.8, 11.6], [-3.2, 11.6]].forEach(function (c) {
    box(p, 0.14, 3, 0.14, "#39465A", c[0], 1.5, c[1]);
    box(p, 0.3, 0.5, 0.3, "#22262E", c[0], 0.25, c[1]);      /* column guards */
  });
  for (var st = 0; st < 5; st++) {                           /* stair, east side */
    box(p, 1.0, 0.1, 0.5, "#4A5563", -2.6, 0.6 * st + 0.3, 10.4 - 0.5 * st, 0);
  }
  box(p, 0.08, 1.0, 2.6, "#4A5563", -2.12, 2.1, 9.4, 40);    /* handrail, this one exists */

  /* Stock on the floor: the three stacks, a loose carton, a cone, a broom. */
  palletStack(p, -6, 2, 2); palletStack(p, -8, -3, 3); palletStack(p, 8, 8, 2);
  var loose = box(p, 0.7, 0.55, 0.6, "#FFFFFF", -13.5, 0.28, 4.5, 14);
  texMat(loose, "cardboard", { roughness: 0.9 });
  cyl(p, 0.28, 0.5, "#E87722", -2, 0.25, -9);
  cyl(p, 0.285, 0.07, "#F2F5F8", -2, 0.36, -9);
  cyl(p, 0.03, 1.3, "#B08A5A", 16.9, 0.65, 6.5, 12, 0);

  /* Phase 9.7: collision for everything the original list missed. Pushed at
     build time so the geometry above stays the single source of truth.
     The barrier gets a circle per metre - posts alone left gaps a body
     could slip through under the rails. */
  for (var cz = -6; cz <= 8; cz += 1) {
    CONFIG.colliders.push({ what: "walkway barrier", x: 12.6, z: cz, r: 0.22 });
  }
  CONFIG.colliders.push(
    { what: "loose carton",   x: -13.5, z: 4.5, r: 0.5 },
    { what: "drum",           x: -2,    z: -9,  r: 0.4 },
    { what: "extinguisher",   x: 17.75, z: 0.6, r: 0.3 },
    { what: "mezzanine stair", x: -2.6, z: 9.6, r: 0.9 },
    { what: "broom",          x: 16.9,  z: 6.5, r: 0.25 }
  );
}
function buildDebug() {
  var d = $("debugLayer");
  CONFIG.colliders.forEach(function (c) {
    el("a-ring", { rotation: "-90 0 0", "radius-inner": c.r - 0.1, "radius-outer": c.r,
      position: c.x + " 0.03 " + c.z, material: "color:#FFD100; opacity:0.5; transparent:true" }, d);
  });
  var b = CONFIG.bounds;
  box(d, b.maxX - b.minX, 0.02, 0.08, "#3DDC6A", 0, 0.03, b.minZ);
  box(d, b.maxX - b.minX, 0.02, 0.08, "#3DDC6A", 0, 0.03, b.maxZ);
  box(d, 0.08, 0.02, b.maxZ - b.minZ, "#3DDC6A", b.minX, 0.03, 0);
  box(d, 0.08, 0.02, b.maxZ - b.minZ, "#3DDC6A", b.maxX, 0.03, 0);
  console.table(CONFIG.colliders);
  console.table(HAZARDS.concat(DISTRACTORS).map(function (i) {
    return { id: i.id, x: i.pos.x, z: i.pos.z, radius: i.radius };
  }));
}

