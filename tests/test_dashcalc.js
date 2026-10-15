/* Node harness for js/dashcalc.js - loads the REAL hazards.js content and
   the REAL dashcalc.js, feeds synthetic records, and checks every figure
   the dashboard shows (TDD 7.3 definitions). */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const load = f => fs.readFileSync(path.join(__dirname, "..", "spotsafe360", "js", f), "utf8");
const content = new Function(load("hazards.js") + "; return { HAZARDS, CONFIG, QUIZ, DISTRACTORS };")();
new Function(load("dashcalc.js"))();
const D = globalThis.SSDash;
assert(D, "SSDash attached");

let passed = 0;
function ok(cond, msg) { assert(cond, msg); passed++; console.log("  PASS " + msg); }

ok(content.HAZARDS.length === 9, "real content: 9 hazards");
const cats = {};
content.HAZARDS.forEach(h => { cats[h.id] = D.catKeyOf(h.category); });
ok(cats.H1 === "fire" && cats.H7 === "fire", "H1/H7 -> fire");
ok(cats.H2 === "vehicle" && cats.H3 === "vehicle", "H2/H3 -> vehicle");
ok(cats.H4 === "house" && cats.H5 === "house", "H4/H5 -> housekeeping");
ok(cats.H6 === "stack", "H6 -> stacking");
ok(cats.H8 === "height" && cats.H9 === "height", "H8/H9 -> height");

const empty = D.calc([], content.HAZARDS);
ok(empty.rounds === 0 && empty.quizPct === null && empty.best === 0, "empty history -> safe zeros");

/* two synthetic rounds with hand-computable numbers */
const ph = (foundMap, rtMap) => content.HAZARDS.map(h => ({
  h: h.id, found: !!foundMap[h.id], rt: foundMap[h.id] ? (rtMap[h.id] || 10) : null
}));
const recs = [
  { v: 1, id: "r1", date: 1000, mode: "training", diff: "simple", score: 80, found: 8, total: 9,
    endReason: "time", secs: 100, bestStreak: 5, wrongClicks: 2, goodClicks: 1,
    perHazard: ph({ H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,H7:1,H8:1 }, { H6: 20 }),
    quiz: [{ h: "H3", right: true }, { h: "H8", right: false }] },
  { v: 1, id: "r2", date: 2000, mode: "attack", diff: "standard", score: 100, found: 9, total: 9,
    endReason: "found", secs: 60, bestStreak: 7, wrongClicks: 0, goodClicks: 0,
    perHazard: ph({ H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,H7:1,H8:1,H9:1 }, { H6: 10 }),
    quiz: [{ h: "H3", right: true }, { h: "H8", right: true }, { h: "H1", right: false }] }
];
const s = D.calc(recs, content.HAZARDS);

ok(s.rounds === 2, "rounds counted");
ok(s.best === 100, "personal best = 100");
ok(s.avgScore === 90, "average score = 90");
ok(s.avgSecs === 80, "average time = 80s");
ok(s.quizRight === 3 && s.quizTotal === 5 && s.quizPct === 60, "quiz accuracy 3/5 = 60%");
ok(s.bestStreak === 7, "best streak across rounds");
ok(s.wrongClicks === 2 && s.safeFlags === 1, "wrong clicks and safe flags summed");
ok(s.bestByDiff.simple === 80 && s.bestByDiff.standard === 100 && s.bestByDiff.expert === null, "best by difficulty");

/* categories: fire encounters 4 (2 rounds x H1,H7), found 4 -> 100% */
ok(s.byCategory.fire.encounters === 4 && s.byCategory.fire.found === 4 && s.byCategory.fire.pct === 100, "fire 4/4 = 100%");
/* height: H8 found twice, H9 once -> 3/4 = 75% */
ok(s.byCategory.height.encounters === 4 && s.byCategory.height.found === 3 && s.byCategory.height.pct === 75, "height 3/4 = 75%");

const h6 = s.perHazard.find(p => p.id === "H6");
ok(h6.found === 2 && h6.missed === 0 && h6.avgRt === 15, "H6 avg reaction (20+10)/2 = 15s");
const h9 = s.perHazard.find(p => p.id === "H9");
ok(h9.found === 1 && h9.missed === 1 && h9.avgRt === 10, "H9 found 1 missed 1");
ok(s.slowest[0].id === "H6" && s.slowest[0].avgRt === 15, "slowest = H6 at 15s");

const q3 = s.quizByTopic.find(q => q.h === "H3");
ok(q3.right === 2 && q3.total === 2 && q3.pct === 100, "quiz topic H3 2/2");
const q8 = s.quizByTopic.find(q => q.h === "H8");
ok(q8.right === 1 && q8.total === 2 && q8.pct === 50, "quiz topic H8 1/2");
ok(s.quizByTopic[0].h === "H1", "worst topic first (H1 0/1)");

ok(s.trend.length === 2 && s.trend[1].score === 100, "trend chronological");
ok(s.recent[0].id === "r2", "recent newest first");

ok(D.fmtSecs(98) === "1:38" && D.fmtSecs(0) === "0:00", "fmtSecs m:ss");
ok(D.relDay(Date.now()) === "today", "relDay today");

console.log("\nALL DASHCALC TESTS PASSED (" + passed + " assertions)");
