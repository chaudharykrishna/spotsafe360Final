/* jsdom end-to-end harness: loads the REAL index.html / dashboard.html with
   their REAL scripts from the local server, and drives the learner journey:
   create profile -> login -> locked setup -> logout -> PIN errors -> relogin
   -> dashboard renders every section from seeded records.
   Phase 10: pages load WITHOUT fetch (jsdom ships none), so they exercise the
   offline/local fallback path; a final network-mode section stubs window.fetch
   to a locally-spawned server/server.js on 8198 and drives the cloud path.
   Requires: python3 -m http.server 8123 running in spotsafe360/. */
"use strict";
const path = require("path");
const assert = require("assert");
const { spawn } = require("child_process");
const fs = require("fs");
const { JSDOM, VirtualConsole } = require("jsdom");

const BASE = "http://127.0.0.1:8123/";
const API_BASE = "http://127.0.0.1:8198";
const API_DB = path.join("/tmp", "ss360_ui_db_" + process.pid + ".json");
let passed = 0;
function ok(cond, msg) { assert(cond, msg); passed++; console.log("  PASS " + msg); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function makeVC(errors) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push("jsdomError: " + (e.message || e)));
  vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));
  return vc;
}

async function loadPage(file, seed) {
  const errors = [];
  const dom = await JSDOM.fromFile(path.join(__dirname, "..", "spotsafe360", file), {
    runScripts: "dangerously",
    resources: "usable",
    url: BASE + file,
    pretendToBeVisual: true,
    virtualConsole: makeVC(errors),
    beforeParse(window) {
      /* Real browsers on localhost/https have crypto.subtle, jsdom does not.
         Inject Node's webcrypto so the page's hashing takes the SAME sha256
         path a learner's browser takes - the djb2 fallback only exists for
         ancient browsers and must not be what the tests silently prove. */
      Object.defineProperty(window, "crypto", {
        value: require("crypto").webcrypto, configurable: true
      });
      if (seed) {
        for (const [k, v] of Object.entries(seed.ls || {})) window.localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(seed.ss || {})) window.sessionStorage.setItem(k, v);
        /* network mode: route the page's relative /api calls to the real
           backend spawned by this harness (same-origin semantics preserved
           because only the URL origin is swapped). */
        if (seed.api) {
          window.fetch = (url, opts) => fetch(new URL(url, API_BASE), opts);
        }
      }
    }
  });
  await new Promise(r => dom.window.addEventListener("load", r));
  await sleep(250); // let async PIN hashing settle
  return { dom, window: dom.window, errors };
}

function click(win, sel) {
  const el = typeof sel === "string" ? win.document.querySelector(sel) : sel;
  assert(el, "element exists: " + sel);
  el.click();
  return el;
}
function setVal(win, sel, v) { win.document.querySelector(sel).value = v; }

(async function run() {
  /* spawn the real backend for the network-mode section */
  try { fs.unlinkSync(API_DB); } catch (e) { /* fresh */ }
  const api = spawn("node", [path.join(__dirname, "..", "server", "server.js")], {
    env: Object.assign({}, process.env, { PORT: "8198", SPOTSAFE_DB: API_DB }),
    stdio: "ignore"
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(API_BASE + "/api/health")).ok) { break; } } catch (e) { /* booting */ }
    await sleep(100);
  }

  /* ================= AUTH PORTAL (Phase 9.5) ================= */
  console.log("== auth: first visit, no profiles ==");
  const a = await loadPage("login.html");
  const aw = a.window, ad = aw.document;
  ok(a.errors.length === 0, "no script errors on load: " + JSON.stringify(a.errors));
  ok(!ad.documentElement.getAttribute("data-redirect"), "no redirect when logged out");
  ok(ad.querySelector("#tabSignup").getAttribute("aria-selected") === "true", "signup tab auto-selected with zero profiles");
  ok(ad.querySelector("#btnGuest").textContent === "Continue as guest", "guest button labelled from STRINGS");

  console.log("== auth: create account (C1) ==");
  setVal(aw, "#suName", "<script>Bishal");
  setVal(aw, "#suUser", "Bishal.T");
  setVal(aw, "#suEmail", "Bishal@ISMT.edu.np");
  setVal(aw, "#suPin1", "secret1");
  setVal(aw, "#suPin2", "nope123");
  click(aw, "#suCreate");
  await sleep(120);
  ok(!ad.querySelector("#suError").classList.contains("hidden"), "mismatched passwords refused in UI");
  setVal(aw, "#suPin2", "secret1");
  click(aw, "#suCreate");
  await sleep(250);
  const users = JSON.parse(aw.localStorage.getItem("ss360_users"));
  ok(users.length === 1 && users[0].name === "scriptBishal", "account stored, name sanitised: " + users[0].name);
  ok(users[0].username === "bishal.t" && users[0].email === "bishal@ismt.edu.np", "username + email stored lower-cased");
  ok(!aw.localStorage.getItem("ss360_users").includes("secret1"), "password not stored in plain text");
  ok(aw.sessionStorage.getItem("ss360_session") === users[0].id, "session set on create");
  ok(ad.documentElement.getAttribute("data-redirect") === "index.html", "create hands over to the game portal");

  console.log("== auth: existing session skips the page ==");
  const a2 = await loadPage("login.html", { ss: { ss360_session: users[0].id } });
  ok(a2.window.document.documentElement.getAttribute("data-redirect") === "index.html", "signed-in visit bounces to the portal");

  console.log("== auth: sign in with username + password (C2) ==");
  const a3 = await loadPage("login.html", { ls: { ss360_users: JSON.stringify(users) } });
  const a3w = a3.window, a3d = a3w.document;
  ok(a3d.querySelector("#tabSignin").getAttribute("aria-selected") === "true", "signin tab default when accounts exist");
  ok(!a3d.querySelector("#siRow") && !a3d.querySelector("#siPinBox"), "no profile-picker on the sign-in page");
  ok(a3d.querySelector("#siUser") && a3d.querySelector("#siPass"), "username + password fields present");
  setVal(a3w, "#siUser", "bishal.t");
  setVal(a3w, "#siPass", "wrong99");
  click(a3w, "#siUnlock");
  await sleep(200);
  ok(!a3d.querySelector("#siError").classList.contains("hidden"), "wrong password error shown");
  setVal(a3w, "#siPass", "secret1");
  click(a3w, "#siUnlock");
  await sleep(250);
  ok(a3w.sessionStorage.getItem("ss360_session") === users[0].id, "session restored via username + password");
  ok(a3d.documentElement.getAttribute("data-redirect") === "index.html", "sign-in hands over to the portal");

  console.log("== auth: local account while server is ONLINE (10.1 regression) ==");
  /* The learner's exact complaint: account created locally in the browser
     (sha256 hash, webcrypto injected above), server running, correct
     credentials - the server does not know the account (401) and the UI
     MUST fall through to the local store instead of failing. */
  const rg1 = await loadPage("login.html", { api: true, ls: { ss360_users: JSON.stringify(users) } });
  setVal(rg1.window, "#siUser", "bishal.t");
  setVal(rg1.window, "#siPass", "secret1");
  click(rg1.window, "#siUnlock");
  await sleep(700);
  ok(rg1.window.sessionStorage.getItem("ss360_session") === users[0].id, "local account signs in while server online");
  ok(rg1.window.document.documentElement.getAttribute("data-redirect") === "index.html", "local fallback still hands over to the portal");
  /* jsdom logs "Not implemented: navigation" when go() fires location.replace -
     that is the redirect WORKING, not a script error; filter it out. */
  const realErrors = rg1.errors.filter(e => !String(e).includes("Not implemented: navigation"));
  ok(realErrors.length === 0, "no script errors in the fallback path: " + JSON.stringify(realErrors));
  /* and by email too */
  const rg2 = await loadPage("login.html", { api: true, ls: { ss360_users: JSON.stringify(users) } });
  setVal(rg2.window, "#siUser", "bishal@ismt.edu.np");
  setVal(rg2.window, "#siPass", "secret1");
  click(rg2.window, "#siUnlock");
  await sleep(700);
  ok(rg2.window.sessionStorage.getItem("ss360_session") === users[0].id, "sign-in works with email as identifier");

  console.log("== auth: guest route ==");
  const a4 = await loadPage("login.html", { ls: { ss360_users: JSON.stringify(users) } });
  click(a4.window, "#btnGuest");
  ok(a4.window.sessionStorage.getItem("ss360_session") === "guest", "guest token stored");
  ok(a4.window.document.documentElement.getAttribute("data-redirect") === "index.html", "guest hands over to the portal");

  /* ================= GAME PORTAL (Phase 9.5) ================= */
  console.log("== portal: gate without session ==");
  const p0 = await loadPage("index.html");
  ok(p0.window.document.documentElement.getAttribute("data-redirect") === "login.html", "portal redirects to login without a session");

  console.log("== portal: guest session ==");
  const p = await loadPage("index.html", { ss: { ss360_session: "guest" } });
  const w = p.window, d = w.document;
  ok(p.errors.length === 0, "no script errors on load: " + JSON.stringify(p.errors));
  ok(!d.documentElement.getAttribute("data-redirect"), "guest session passes the gate");
  ok(!d.querySelector("#railTitle"), "profile rail removed from the portal");
  ok(!d.querySelector("#newProfile") && !d.querySelector("#pinDialog"), "auth dialogs removed from the portal");
  ok(d.querySelector("#btnDash").classList.contains("hidden"), "dashboard button hidden for guest");
  ok(!d.querySelector("#btnLogout").classList.contains("hidden"), "sign-out visible for guest");
  ok(!d.querySelector("#nameInput").readOnly, "setup unlocked for guest");
  ok(!d.querySelector("#avatarField").classList.contains("hidden"), "avatar picker visible for guest");

  console.log("== portal: profile session locks setup, dashboard wired ==");
  const p2 = await loadPage("index.html", {
    ls: { ss360_users: JSON.stringify(users), ss360_token: "f".repeat(48) },
    ss: { ss360_session: users[0].id } });
  const w2 = p2.window, d2 = w2.document;
  ok(!d2.documentElement.getAttribute("data-redirect"), "profile session passes the gate");
  ok(!d2.querySelector("#btnDash").classList.contains("hidden"), "dashboard button visible when logged in");
  ok(d2.querySelector("#avatarField").classList.contains("hidden"), "avatar picker hidden for a signed-in account");
  ok(d2.querySelector("#nameField").classList.contains("hidden"), "name field hidden for a signed-in account");
  ok(d2.querySelector("#trainingAs").textContent.includes("scriptBishal"), "training-as line names the account");
  click(w2, "#btnDash");
  ok(d2.documentElement.getAttribute("data-redirect") === "dashboard.html", "dashboard button navigates (playtest bug fixed)");
  click(w2, "#btnLogout");
  ok(w2.sessionStorage.getItem("ss360_session") === null, "sign-out clears the session");
  ok(w2.localStorage.getItem("ss360_token") === null, "sign-out also drops the cloud token (10.2)");
  ok(d2.documentElement.getAttribute("data-redirect") === "login.html", "sign-out returns to the auth portal");

  /* ================= DASHBOARD ================= */
  console.log("== dashboard: gate ==");
  const g = await loadPage("dashboard.html");
  ok(g.window.document.documentElement.getAttribute("data-redirect") === "login.html", "dashboard redirects to login without a session");
  const g2 = await loadPage("dashboard.html", { ss: { ss360_session: "guest" } });
  ok(g2.window.document.documentElement.getAttribute("data-redirect") === "login.html", "dashboard demands a real profile - guest redirected");

  console.log("== dashboard: renders from seeded records ==");
  /* seed: same profile + session + 3 valid records in the store's shape */
  const haz = ["H1","H2","H3","H4","H5","H6","H7","H8","H9"];
  const mkRec = (i, score, missId) => ({
    v: 1, id: "r-seed-" + i, date: 1760000000000 + i * 86400000,
    mode: i % 2 ? "training" : "attack", diff: "standard",
    score: score, found: missId ? 8 : 9, total: 9, endReason: missId ? "time" : "found",
    secs: 70 + i * 5, bestStreak: 4 + i, wrongClicks: i, goodClicks: i % 2,
    perHazard: haz.map(h => ({ h: h, found: h !== missId, rt: h !== missId ? 8 + i : null })),
    quiz: [{ h: "H3", right: true }, { h: missId || "H8", right: false }]
  });
  const recs = [mkRec(1, 85, "H6"), mkRec(2, 95, null), mkRec(3, 90, "H7")];
  const dash = await loadPage("dashboard.html", {
    ls: {
      ss360_users: JSON.stringify([users[0]]),
      ss360_records_scriptBishal: "x", // placeholder replaced below (key needs real uid)
    },
    ss: { ss360_session: users[0].id }
  });
  // re-run with the correct records key
  dash.window.close();
  const ls = {};
  ls["ss360_users"] = JSON.stringify([users[0]]);
  ls["ss360_records_" + users[0].id] = JSON.stringify(recs);
  const dd = await loadPage("dashboard.html", { ls: ls, ss: { ss360_session: users[0].id } });
  const dw = dd.window, ddoc = dw.document;
  ok(dd.errors.length === 0, "no script errors: " + JSON.stringify(dd.errors));
  ok(ddoc.querySelector("#dashMain") && !ddoc.querySelector("#dashMain").classList.contains("hidden"), "dashboard visible with session");
  ok(ddoc.querySelector("#dashName").textContent === "scriptBishal", "header shows profile name");
  ok(ddoc.querySelectorAll("#tiles .dash-tile").length === 4, "four concise stat tiles");
  ok(ddoc.querySelector("#tiles .dash-tile b").textContent === "3", "rounds tile = 3");
  ok(ddoc.querySelector("#tiles .dash-tile:nth-child(2) b").textContent === "95", "personal best tile = 95");
  ok(ddoc.querySelector("#dashSince").textContent.includes("@bishal.t"), "identity line shows the username");
  ok(ddoc.querySelector("#weakBox").textContent.length > 5, "focus line rendered");
  ok(ddoc.querySelectorAll("#recentBox tbody tr").length === 3, "recent rounds table: 3 rows");
  ok(!ddoc.querySelector("#trendBox") && !ddoc.querySelector("#masteryBox"), "old chart clutter removed");
  /* routing regression (playtest 11 Oct): the way back to the portal must
     exist as a real anchor AND the topbar button must be present */
  var play = ddoc.querySelector("#btnPlay");
  ok(play && play.getAttribute("href") === "index.html", "Play a round anchor -> index.html");
  ok(ddoc.querySelector("#btnPortal") && play.textContent === "Play a round", "topbar back button present with STRINGS text");
  /* export produces a valid doc (no click - direct store call in page context) */
  const dump = JSON.parse(dd.window.SSStore.records.exportJSON(users[0].id));
  ok(dump.records.length === 3 && dump.profile.name === "scriptBishal", "export contains records + profile");

  console.log("== dashboard: empty profile ==");
  const ls2 = {};
  ls2["ss360_users"] = JSON.stringify([users[0]]);
  const ee = await loadPage("dashboard.html", { ls: ls2, ss: { ss360_session: users[0].id } });
  ok(!ee.window.document.querySelector("#dashEmpty").classList.contains("hidden"), "empty state shown for new profile");
  ok(ee.window.document.querySelector("#dashBody").classList.contains("hidden"), "charts hidden until first round");

  console.log("== auth: network mode (cloud backend on 8198) ==");
  const c1 = await loadPage("login.html", { api: true });
  ok(c1.window.SSNet && typeof c1.window.SSNet.health === "function", "SSNet present with health probe");
  const cw = c1.window, cd = cw.document;
  setVal(cw, "#suName", "Nabin Karki");
  setVal(cw, "#suUser", "nabin.k");
  setVal(cw, "#suEmail", "nabin@ismt.edu.np");
  setVal(cw, "#suPin1", "secret1");
  setVal(cw, "#suPin2", "secret1");
  click(cw, "#suCreate");
  await sleep(700);
  ok(cd.documentElement.getAttribute("data-redirect") === "index.html", "cloud signup hands over to the portal");
  const tok = cw.localStorage.getItem("ss360_token");
  ok(tok && tok.length === 48, "cloud token stored locally");
  const cached = JSON.parse(cw.localStorage.getItem("ss360_users"));
  ok(cached.length === 1 && cached[0].username === "nabin.k" && cached[0].remote === true, "server account cached with remote flag");
  ok(!JSON.stringify(cached).includes("secret1") && !("hash" in cached[0]), "no secrets cached client-side");
  /* server-side uniqueness: same username via the API is refused in the UI */
  const c2 = await loadPage("login.html", { api: true });
  setVal(c2.window, "#suName", "Copy Cat");
  setVal(c2.window, "#suUser", "nabin.k");
  setVal(c2.window, "#suEmail", "copy@ismt.edu.np");
  setVal(c2.window, "#suPin1", "secret1");
  setVal(c2.window, "#suPin2", "secret1");
  click(c2.window, "#suCreate");
  await sleep(700);
  ok(!c2.window.document.querySelector("#suError").classList.contains("hidden") &&
     c2.window.document.querySelector("#suError").textContent.length > 5, "cloud username-taken shown in UI");
  /* cloud sign-in: wrong then right password */
  const c3ls = { ss360_users: JSON.stringify(cached) };
  const c3 = await loadPage("login.html", { api: true, ls: c3ls });
  setVal(c3.window, "#siUser", "nabin.k");
  setVal(c3.window, "#siPass", "wrong99");
  click(c3.window, "#siUnlock");
  await sleep(700);
  ok(!c3.window.document.querySelector("#siError").classList.contains("hidden"), "cloud wrong password shows error");
  setVal(c3.window, "#siPass", "secret1");
  click(c3.window, "#siUnlock");
  await sleep(700);
  ok(c3.window.sessionStorage.getItem("ss360_session") === cached[0].id, "cloud sign-in restores the session");
  ok(c3.window.localStorage.getItem("ss360_token") && c3.window.localStorage.getItem("ss360_token") !== tok, "fresh token issued per login");
  /* cloud sign-in with email as the identifier */
  const c3b = await loadPage("login.html", { api: true, ls: { ss360_users: JSON.stringify(cached) } });
  setVal(c3b.window, "#siUser", "nabin@ismt.edu.np");
  setVal(c3b.window, "#siPass", "secret1");
  click(c3b.window, "#siUnlock");
  await sleep(700);
  ok(c3b.window.sessionStorage.getItem("ss360_session") === cached[0].id, "cloud sign-in accepts email as identifier");
  /* cloud history reaches the dashboard: seed a round server-side, load the
     dashboard with ONLY the token + cached user locally (no local records) */
  const tok3 = c3.window.localStorage.getItem("ss360_token");
  await fetch(API_BASE + "/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok3 },
    body: JSON.stringify({
      v: 1, id: "r-cloud1", date: Date.now(), mode: "training", diff: "standard",
      score: 88, found: 9, total: 14, endReason: "cleared", secs: 140,
      bestStreak: 3, wrongClicks: 2, goodClicks: 9,
      perHazard: [{ h: "H1", found: true, rt: 3.1 }], quiz: []
    })
  });
  const c4 = await loadPage("dashboard.html", {
    api: true,
    ls: { ss360_users: JSON.stringify(cached), ss360_token: tok3 },
    ss: { ss360_session: cached[0].id }
  });
  ok(c4.window.document.querySelector("#tiles .dash-tile b").textContent === "1", "dashboard renders the cloud-stored round");
  ok(!c4.window.localStorage.getItem("ss360_records_" + cached[0].id), "round came from the server, not local storage");
  api.kill();
  try { fs.unlinkSync(API_DB); } catch (e) { /* ok */ }

  console.log("\nALL UI TESTS PASSED (" + passed + " assertions)");
  process.exit(0);
})().catch(e => { console.error("UI TEST FAIL:", e.message); process.exit(1); });
