#!/usr/bin/env node
/* SpotSafe 360 - server API tests (Phase 10).
   Spawns server/server.js on a test port with an isolated JSON db and
   exercises the whole contract: signup validation + uniqueness, login,
   token auth, record isolation, leaderboard, static serving, traversal
   defence. Requires Node >= 18 (global fetch). No npm packages. */
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 8199;
const BASE = "http://127.0.0.1:" + PORT;
const DB = path.join("/tmp", "ss360_test_db_" + process.pid + ".json");

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log("  PASS " + label); }
  else { fail++; console.log("  FAIL " + label); }
}
function call(method, urlPath, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) { headers.Authorization = "Bearer " + token; }
  return fetch(BASE + urlPath, {
    method: method, headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  }).then(r => r.json().catch(() => ({})).then(j => ({ code: r.status, body: j })));
}
const GOOD_REC = {
  v: 1, id: "r-test1", date: Date.now(), mode: "training", diff: "standard",
  score: 120, found: 10, total: 14, endReason: "cleared", secs: 150,
  bestStreak: 4, wrongClicks: 1, goodClicks: 10,
  perHazard: [{ h: "H1", found: true, rt: 2.5 }], quiz: []
};

async function main() {
  try { fs.unlinkSync(DB); } catch (e) { /* fresh */ }
  const child = spawn("node", [path.join(__dirname, "..", "server", "server.js")], {
    env: Object.assign({}, process.env, { PORT: String(PORT), SPOTSAFE_DB: DB }),
    stdio: "ignore"
  });
  /* wait for health */
  for (let i = 0; i < 50; i++) {
    try {
      const r = await call("GET", "/api/health");
      if (r.code === 200) { break; }
    } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("server: health");
  let r = await call("GET", "/api/health");
  ok(r.code === 200 && r.body.ok === true, "health answers ok");

  console.log("server: signup validation");
  r = await call("POST", "/api/auth/signup", { name: "", username: "goodname", email: "a@b.co", password: "secret1" });
  ok(r.code === 400 && r.body.why === "name", "empty name rejected");
  r = await call("POST", "/api/auth/signup", { name: "X", username: "a!b", email: "a@b.co", password: "secret1" });
  ok(r.code === 400 && r.body.why === "username", "illegal-char username rejected");
  r = await call("POST", "/api/auth/signup", { name: "X", username: "UpperCase", email: "a@b.co", password: "secret1" });
  ok(r.code === 201 && r.body.user.username === "uppercase", "uppercase username normalised");
  r = await call("POST", "/api/auth/signup", { name: "X", username: "goodname", email: "nope", password: "secret1" });
  ok(r.code === 400 && r.body.why === "email", "bad email rejected");
  r = await call("POST", "/api/auth/signup", { name: "X", username: "goodname", email: "a@b.co", password: "123" });
  ok(r.code === 400 && r.body.why === "pass", "short password rejected");

  console.log("server: signup + uniqueness");
  r = await call("POST", "/api/auth/signup", { name: "Ana Sharma", username: "ana", email: "Ana@Example.COM", avatar: 2, password: "secret1" });
  ok(r.code === 201 && !!r.body.token && r.body.user.username === "ana", "signup returns token + user");
  ok(!("hash" in r.body.user) && !("salt" in r.body.user), "user payload leaks no secrets");
  const tokA = r.body.token;
  r = await call("POST", "/api/auth/signup", { name: "B", username: "ana", email: "other@x.co", password: "secret1" });
  ok(r.code === 409 && r.body.why === "username-taken", "duplicate username rejected");
  r = await call("POST", "/api/auth/signup", { name: "B", username: "bee", email: "ana@example.com", password: "secret1" });
  ok(r.code === 409 && r.body.why === "email-taken", "duplicate email rejected (case-insensitive)");

  console.log("server: login");
  r = await call("POST", "/api/auth/login", { username: "ana", password: "wrongpass" });
  ok(r.code === 401 && r.body.why === "login", "wrong password rejected");
  r = await call("POST", "/api/auth/login", { username: "nobody", password: "secret1" });
  ok(r.code === 401, "unknown user rejected");
  r = await call("POST", "/api/auth/login", { username: "ANA", password: "secret1" });
  ok(r.code === 200 && !!r.body.token, "login ok (username case-insensitive)");
  r = await call("POST", "/api/auth/login", { username: "ana@example.com", password: "secret1" });
  ok(r.code === 200 && !!r.body.token, "login ok with email as identifier");

  console.log("server: auth + me");
  r = await call("GET", "/api/me");
  ok(r.code === 401, "me without token rejected");
  r = await call("GET", "/api/me", undefined, tokA);
  ok(r.code === 200 && r.body.user.username === "ana", "me with token returns user");

  console.log("server: records");
  r = await call("POST", "/api/records", { v: 9 }, tokA);
  ok(r.code === 400 && r.body.why === "shape", "malformed record rejected");
  r = await call("POST", "/api/records", GOOD_REC, tokA);
  ok(r.code === 200 && r.body.ok === true, "record accepted");
  r = await call("POST", "/api/records", GOOD_REC, tokA);
  r = await call("GET", "/api/records", undefined, tokA);
  ok(r.code === 200 && r.body.records.length === 1, "duplicate record id not double-counted");
  r = await call("POST", "/api/records", Object.assign({}, GOOD_REC, { id: "r-test2" }), tokA);
  r = await call("GET", "/api/records", undefined, tokA);
  ok(r.body.records.length === 2, "second record appended");
  r = await call("GET", "/api/records");
  ok(r.code === 401, "records without token rejected");
  const r2 = await call("POST", "/api/auth/signup", { name: "Bo", username: "bee", email: "b@x.co", password: "secret2" });
  r = await call("GET", "/api/records", undefined, r2.body.token);
  ok(r.code === 200 && r.body.records.length === 0, "second user sees no records (isolation)");

  console.log("server: scores");
  r = await call("POST", "/api/scores", { name: "Ana", score: 120, date: Date.now() }, tokA);
  ok(r.code === 200, "score accepted");
  r = await call("POST", "/api/scores", { name: "Bo", score: 200, date: Date.now(), uid: "forged" });
  r = await call("GET", "/api/scores");
  ok(r.body.scores.length === 2 && r.body.scores[0].score === 200, "scores sorted high-first");
  const anaRow = r.body.scores.find(x => x.score === 120);
  const boRow = r.body.scores.find(x => x.score === 200);
  ok(anaRow && anaRow.uid && anaRow.uid !== "forged", "token stamps the real uid (10.2)");
  ok(boRow && !("uid" in boRow), "guest/forged uid stripped (10.2)");

  console.log("server: static + defence");
  r = await fetch(BASE + "/login.html");
  ok(r.status === 200 && r.headers.get("content-type").includes("text/html"), "static app served");
  r = await fetch(BASE + "/../server/server.js");
  ok(r.status === 404 || r.status === 403, "path traversal blocked");

  child.kill();
  try { fs.unlinkSync(DB); } catch (e) { /* ok */ }
  console.log("\n" + (fail ? "FAILURES: " + fail : "ALL PASS") + " (" + pass + " passed, " + fail + " failed)");
  process.exit(fail ? 1 : 0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
