/* SpotSafe 360 - dashcalc.js (Phase 8). Dashboard statistics, pure.
   No DOM, no storage, no network: records in, numbers out. Kept apart from
   dashboard.js so every figure on the dashboard can be unit-tested without
   a browser, and so the chart renderers can never disagree with the maths.
   Category keys match catOf() in app.js exactly. */
(function (root) {
  "use strict";

  var CAT_KEYS = ["fire", "vehicle", "house", "stack", "height"];

  function catKeyOf(category) {
    var c = String(category || "");
    if (c.indexOf("Fire") === 0) { return "fire"; }
    if (c.indexOf("Vehicle") === 0) { return "vehicle"; }
    if (c.indexOf("Working") === 0) { return "height"; }
    if (c.indexOf("Stacking") === 0) { return "stack"; }
    return "house";
  }

  function round1(n) { return Math.round(n * 10) / 10; }

  /* records: chronological array from SSStore.records.list(uid)
     hazards: the HAZARDS array (id, name, category) for labels and buckets.
     Returns the full stats object the dashboard renders. Definitions live
     in the TDD section 7.3 so every number can be audited. */
  function calc(records, hazards) {
    var recs = (records || []).slice(0).sort(function (a, b) { return a.date - b.date; });
    var byId = {};
    (hazards || []).forEach(function (h) { byId[h.id] = h; });

    var out = {
      rounds: recs.length,
      best: 0, avgScore: 0, avgSecs: 0,
      quizRight: 0, quizTotal: 0, quizPct: null,
      bestStreak: 0, wrongClicks: 0, safeFlags: 0,
      trend: [],               // last 15: { date, score, mode, diff }
      byCategory: {},          // key -> { found, encounters, pct }
      perHazard: [],           // { id, name, cat, found, missed, avgRt }
      slowest: [],             // perHazard with avgRt, descending
      quizByTopic: [],         // { h, name, right, total, pct }
      bestByDiff: { simple: null, standard: null, expert: null },
      recent: []               // last 10, newest first
    };
    CAT_KEYS.forEach(function (k) { out.byCategory[k] = { found: 0, encounters: 0, pct: null }; });

    if (!recs.length) { return out; }

    var sumScore = 0, sumSecs = 0, secsRounds = 0;
    var hazAgg = {};   // id -> { found, missed, rtSum, rtN }
    var quizAgg = {};  // hazard ref -> { right, total }

    recs.forEach(function (r) {
      sumScore += r.score;
      if (typeof r.secs === "number" && r.secs >= 0) { sumSecs += r.secs; secsRounds += 1; }
      if (r.score > out.best) { out.best = r.score; }
      if (typeof r.bestStreak === "number" && r.bestStreak > out.bestStreak) { out.bestStreak = r.bestStreak; }
      if (typeof r.wrongClicks === "number") { out.wrongClicks += r.wrongClicks; }
      if (typeof r.goodClicks === "number") { out.safeFlags += r.goodClicks; }
      if (out.bestByDiff[r.diff] === null || r.score > out.bestByDiff[r.diff]) {
        out.bestByDiff[r.diff] = r.score;
      }
      (r.perHazard || []).forEach(function (ph) {
        if (!ph || typeof ph.h !== "string") { return; }
        if (!hazAgg[ph.h]) { hazAgg[ph.h] = { found: 0, missed: 0, rtSum: 0, rtN: 0 }; }
        var a = hazAgg[ph.h];
        if (ph.found) {
          a.found += 1;
          if (typeof ph.rt === "number") { a.rtSum += ph.rt; a.rtN += 1; }
        } else { a.missed += 1; }
        var hz = byId[ph.h];
        var key = catKeyOf(hz ? hz.category : "");
        var bucket = out.byCategory[key];
        bucket.encounters += 1;
        if (ph.found) { bucket.found += 1; }
      });
      (r.quiz || []).forEach(function (qz) {
        if (!qz || typeof qz.right !== "boolean") { return; }
        out.quizTotal += 1;
        if (qz.right) { out.quizRight += 1; }
        if (typeof qz.h === "string" && qz.h) {
          if (!quizAgg[qz.h]) { quizAgg[qz.h] = { right: 0, total: 0 }; }
          quizAgg[qz.h].total += 1;
          if (qz.right) { quizAgg[qz.h].right += 1; }
        }
      });
    });

    out.avgScore = Math.round(sumScore / recs.length);
    out.avgSecs = secsRounds ? Math.round(sumSecs / secsRounds) : 0;
    out.quizPct = out.quizTotal ? Math.round((out.quizRight / out.quizTotal) * 100) : null;

    CAT_KEYS.forEach(function (k) {
      var b = out.byCategory[k];
      b.pct = b.encounters ? Math.round((b.found / b.encounters) * 100) : null;
    });

    (hazards || []).forEach(function (h) {
      var a = hazAgg[h.id] || { found: 0, missed: 0, rtSum: 0, rtN: 0 };
      out.perHazard.push({
        id: h.id, name: h.name, cat: catKeyOf(h.category),
        found: a.found, missed: a.missed,
        avgRt: a.rtN ? round1(a.rtSum / a.rtN) : null
      });
    });
    out.slowest = out.perHazard
      .filter(function (p) { return p.avgRt !== null; })
      .sort(function (a, b) { return b.avgRt - a.avgRt; });

    Object.keys(quizAgg).forEach(function (ref) {
      var a = quizAgg[ref];
      out.quizByTopic.push({
        h: ref, name: byId[ref] ? byId[ref].name : ref,
        right: a.right, total: a.total,
        pct: a.total ? Math.round((a.right / a.total) * 100) : null
      });
    });
    out.quizByTopic.sort(function (a, b) { return (a.pct || 0) - (b.pct || 0); });

    out.trend = recs.slice(-15).map(function (r) {
      return { date: r.date, score: r.score, mode: r.mode, diff: r.diff };
    });
    out.recent = recs.slice(-10).reverse();
    return out;
  }

  /* "m:38" for tile and table time cells. */
  function fmtSecs(secs) {
    var s = Math.max(0, Math.round(secs || 0));
    return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
  }
  /* "today", "yesterday", else the locale date - for the profile rail. */
  function relDay(ms) {
    if (!ms) { return null; }
    var d = new Date(ms), now = new Date();
    var day = 86400000;
    var dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var nMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var diff = Math.round((nMid - dMid) / day);
    if (diff <= 0) { return "today"; }
    if (diff === 1) { return "yesterday"; }
    if (diff < 7) { return diff + " days ago"; }
    return d.toLocaleDateString();
  }

  /* ---------- Phase 15: high-score board ----------
     Fold raw score rows into one best row per player, best first.
     Keyed by uid when present (cloud rows), else the display name
     (local/guest rows). Ties break to whoever reached the score first.
     Pure and shared so the dashboard and its tests use one definition. */
  function bestByPlayer(rows) {
    var best = {};
    (rows || []).forEach(function (r) {
      if (!r || typeof r.score !== "number") { return; }
      var k = r.uid ? "u:" + r.uid : "n:" + String(r.name || "?").toLowerCase();
      var cur = best[k];
      if (!cur || r.score > cur.score ||
          (r.score === cur.score && (r.date || 0) < (cur.date || 0))) {
        best[k] = r;
      }
    });
    return Object.keys(best).map(function (k) { return best[k]; })
      .sort(function (a, b) {
        return b.score - a.score || (a.date || 0) - (b.date || 0);
      });
  }

  root.SSDash = {
    calc: calc, catKeyOf: catKeyOf, CAT_KEYS: CAT_KEYS,
    fmtSecs: fmtSecs, relDay: relDay, bestByPlayer: bestByPlayer
  };
})(typeof window !== "undefined" ? window : globalThis);
