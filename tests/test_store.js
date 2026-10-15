/* Node harness for js/store.js - runs the real shipped file against
   Map-backed storage stubs and Node's WebCrypto (same subtle.digest the
   browser uses). Covers test rows C1-C5, C10-C12 logic. */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

/* ---- storage stubs ---- */
class MemStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
globalThis.localStorage = new MemStorage();
globalThis.sessionStorage = new MemStorage();

/* ---- load the real store ---- */
const code = fs.readFileSync(path.join(__dirname, "..", "spotsafe360", "js", "store.js"), "utf8");
new Function(code)();
const S = globalThis.SSStore;
assert(S, "SSStore attached to globalThis");

let passed = 0;
function ok(cond, msg) { assert(cond, msg); passed++; console.log("  PASS " + msg); }

(async function run() {
  console.log("== users / accounts (Phase 9.9) ==");
  const r1 = await S.users.add("  <b>Bi'shal</b>  ", "Bishal.T", "Bishal@ISMT.edu.np", 2, "safe123");
  ok(r1.ok && r1.user.id.startsWith("u-"), "add account ok, id issued");
  ok(!/[<>&"']/.test(r1.user.name) && r1.user.name.length <= 16, "name sanitised and capped: " + JSON.stringify(r1.user.name));
  ok(r1.user.username === "bishal.t", "username stored lower-cased");
  ok(r1.user.email === "bishal@ismt.edu.np", "email stored lower-cased");
  ok(r1.user.passHash.startsWith("sha256:"), "password hashed with SHA-256 (Node WebCrypto present)");
  ok(r1.user.pinSalt.length === 8, "per-account salt generated");
  ok(!JSON.stringify(r1.user).includes("safe123"), "raw password not stored anywhere on the user object");

  const r2 = await S.users.add("Pawan", "pawan", "pawan@ismt.edu.np", 0, "safe123");
  ok(r2.ok && r2.user.pinSalt !== r1.user.pinSalt, "same password, different salt");
  ok(r2.user.passHash !== r1.user.passHash, "equal passwords do not share a hash");

  ok((await S.users.add("X", "bishal.t", "other@x.com", 0, "safe123")).why === "username-taken", "duplicate username refused");
  ok((await S.users.add("X", "other", "bishal@ismt.edu.np", 0, "safe123")).why === "email-taken", "duplicate email refused");
  ok(!(await S.users.add("", "okname", "a@b.co", 0, "safe123")).ok, "empty name refused");
  ok(!(await S.users.add("X", "ab", "a@b.co", 0, "safe123")).ok, "2-char username refused");
  ok(!(await S.users.add("X", "bad name!", "a@b.co", 0, "safe123")).ok, "username with space refused");
  ok(!(await S.users.add("X", "okname", "not-an-email", 0, "safe123")).ok, "bad email refused");
  ok(!(await S.users.add("X", "okname2", "a@b.co", 0, "12345")).ok, "5-char password refused");

  ok((await S.users.verify("bishal.t", "safe123")).ok, "sign-in by username + password");
  const wrong = await S.users.verify("bishal.t", "wrong99");
  ok(!wrong.ok && wrong.why === "login", "wrong password refused with why=login");
  ok(!(await S.users.verify("ghost", "safe123")).ok, "unknown username refused");
  const uid = r1.user.id;
  ok(S.users.get(uid) && S.users.get(uid).name === r1.user.name, "get by uid");
  ok(S.users.byUsername("BISHAL.T").id === uid, "byUsername is case-insensitive");
  ok(S.users.list().length === 2, "list returns both accounts");

  console.log("== v1 PIN migration ==");
  const nodeCrypto = require("crypto");
  const legacyHash = "sha256:" + nodeCrypto.createHash("sha256")
    .update("abcd1234:1234").digest("base64");
  const v1 = { id: "u-legacy", name: "Krishna", avatar: 1, pinHash: legacyHash, pinSalt: "abcd1234", createdAt: 1, lastLoginAt: 1 };
  globalThis.localStorage.setItem("ss360_users", JSON.stringify([v1]));
  const mig = S.users.byUsername("krishna");
  ok(mig && mig.v1pin === true, "legacy profile gets username slug + v1pin flag");
  ok((await S.users.verify("krishna", "1234")).ok, "legacy profile signs in with old PIN as password");
  ok(!(await S.users.verify("krishna", "9999")).ok, "wrong legacy PIN refused");
  const r3 = await S.users.add("Fresh", "fresh", "fresh@x.com", 0, "safe123");
  ok(r3.ok, "new account alongside migrated legacy profile");
  globalThis.localStorage.setItem("ss360_users", JSON.stringify([r1.user, r2.user]));

  console.log("== session ==");
  ok(S.session.get() === null, "session starts empty");
  S.session.set(uid);
  ok(S.session.get() === uid, "session set/get");
  S.session.clear();
  ok(S.session.get() === null, "session clear");

  console.log("== records ==");
  const rec = (i, over) => Object.assign({
    v: 1, id: "r-test-" + i, date: 1760000000000 + i * 1000,
    mode: "training", diff: "standard", score: 50 + i, found: 7, total: 9,
    endReason: "found", secs: 80, bestStreak: 4, wrongClicks: 1, goodClicks: 0,
    perHazard: [{ h: "H1", found: true, rt: 12.4 }, { h: "H7", found: false, rt: null }],
    quiz: [{ h: "H3", right: true }]
  }, over || {});
  ok(S.records.add(uid, rec(1)), "valid record accepted");
  ok(!S.records.add(uid, { v: 1, date: "x" }), "malformed record refused");
  ok(S.records.list(uid).length === 1, "list returns the record");

  for (let i = 2; i <= 205; i++) { S.records.add(uid, rec(i)); }
  const list = S.records.list(uid);
  ok(list.length === S.RECORDS_CAP, "capped at " + S.RECORDS_CAP + " (got " + list.length + ")");
  ok(list[0].id === "r-test-6", "oldest dropped first (first kept: " + list[0].id + ")");
  ok(list[list.length - 1].id === "r-test-205", "newest kept");

  console.log("== export / import ==");
  const dump = S.records.exportJSON(uid);
  const doc = JSON.parse(dump);
  ok(doc.app === "spotsafe360" && doc.v === 1 && doc.records.length === 200, "export shape");
  S.records.remove ? null : null;
  const before = S.records.list(uid).length;
  const re = S.records.importJSON(uid, dump);
  ok(re.added === 0 && re.skipped === 200, "re-import adds nothing (id merge)");
  const fresh = "u-fresh";
  const imp = S.records.importJSON(fresh, dump);
  ok(imp.added === 200 && S.records.list(fresh).length === 200, "import into fresh profile restores all");
  ok(S.records.importJSON(fresh, "{oops").error === "shape", "garbage import refused");
  ok(S.records.importJSON(fresh, JSON.stringify({ v: 2, app: "x", records: [] })).error === "shape", "wrong app/version refused");

  console.log("== leaderboard ==");
  for (let i = 0; i < 60; i++) {
    S.scores.add({ name: "P" + i, avatar: 0, score: i, found: 9, mode: "training", diff: "simple", secs: 60, quiz: 3, quizOf: 3, date: Date.now(), uid: uid });
  }
  const rows = S.scores.list();
  ok(rows.length === S.SCORES_CAP, "leaderboard capped at " + S.SCORES_CAP);
  ok(rows[0].score === 59, "sorted descending, top score first");
  ok(rows[0].uid === uid, "uid carried on the row");

  console.log("== blocked storage degrade (C12) ==");
  const real = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = function () { throw new Error("blocked"); };
  const blocked = await S.users.add("Blocked", "blocked", "blocked@x.com", 1, "safe123");
  ok(blocked.ok, "profile creation survives blocked storage (memory fallback)");
  ok(S.records.add(blocked.user.id, rec(900)), "record write survives blocked storage");
  globalThis.localStorage.setItem = real;

  console.log("\nALL STORE TESTS PASSED (" + passed + " assertions)");
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
