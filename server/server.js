#!/usr/bin/env node
/* SpotSafe 360 - backend (Phase 10). Zero-dependency Node HTTP server:
   static app + JSON API + token auth, so `node server/server.js` works on
   any machine with Node alone (no npm install). Storage is a JSON file
   (SPOTSAFE_DB, default server/db.json) - the documented upgrade path to a
   real SaaS deployment is Postgres behind this same API shape (ADR-007).

   API:
     GET  /api/health
     POST /api/auth/signup  {name,username,email,avatar,password} -> {token,user}
     POST /api/auth/login   {username,password}                   -> {token,user}
     GET  /api/me                                                 -> {user}
     GET  /api/records                                            -> {records}
     POST /api/records      {record}                              -> {ok}
     GET  /api/scores                                             -> {scores}
     POST /api/scores       {row}                                 -> {ok}
     POST /api/duels          {diff}                              -> {duel}
     GET  /api/duels[?code=X]                                     -> {duel}|{duels}
     POST /api/duels/enter    {code, entry}                       -> {duel}

   Passwords: scrypt with a per-user salt, compared in constant time.
   Tokens: 192-bit random, 7-day expiry, stored server-side. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8080);
const ROOT = path.join(__dirname, "..", "spotsafe360");
const DB_PATH = path.resolve(process.env.SPOTSAFE_DB || path.join(__dirname, "db.json"));
const TOKEN_MS = 7 * 24 * 3600 * 1000;
const RECORDS_CAP = 200, SCORES_CAP = 50;

/* 17.0: the nine bay hazards, named. Records store only the hazard id in
   perHazard, so the server needs the labels to draw the analytics charts;
   the demo seeder uses the same list to write plausible rounds. */
const HAZARD_NAMES = [
  { id: "H1", name: "Blocked fire exit", cat: "Fire and Emergency" },
  { id: "H2", name: "Pedestrian in the vehicle lane", cat: "Vehicle and Pedestrian" },
  { id: "H3", name: "Forklift at the blind corner", cat: "Vehicle and Pedestrian" },
  { id: "H4", name: "Chemical spill on the floor", cat: "Housekeeping" },
  { id: "H5", name: "Charging lead across the walkway", cat: "Housekeeping" },
  { id: "H6", name: "Forklift-damaged rack upright", cat: "Stacking and Racking" },
  { id: "H7", name: "Blocked fire extinguisher", cat: "Fire and Emergency" },
  { id: "H8", name: "Worker at the unguarded edge", cat: "Working at Height" },
  { id: "H9", name: "Worker standing on pallets", cat: "Working at Height" }
];

/* ---------- db ---------- */
let db = { users: [], records: {}, scores: [], tokens: {}, companies: {} };
try {
  db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
} catch (e) {
  /* 12.1 hardening: never start an empty database on top of a file that
     merely failed to parse - that would silently "lose" every account.
     Quarantine the unreadable file so it can be recovered by hand. */
  try {
    if (fs.existsSync(DB_PATH)) {
      const bad = DB_PATH + ".corrupt-" + Date.now();
      fs.renameSync(DB_PATH, bad);
      console.warn("SpotSafe: " + DB_PATH + " could not be read (" + e.message +
        "). It was moved to " + bad + " - recover it manually if needed. Starting fresh.");
    }
  } catch (e2) { /* read-only disk: start fresh anyway */ }
}
if (!db.companies) { db.companies = {}; }
if (!db.duels) { db.duels = []; }
function save() {
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_PATH);
}

/* 17.1: the demo-learner feature is retired. Databases seeded by the old
   17.0 build clean themselves on boot: every demo:true user, their records
   and their leaderboard rows are dropped, real accounts untouched. */
(function purgeDemoLearners() {
  const doomed = {};
  let n = 0;
  db.users = db.users.filter(function (u) {
    if (u && u.demo) { doomed[u.id] = true; n++; return false; }
    return true;
  });
  if (n) {
    Object.keys(doomed).forEach(function (id) { delete db.records[id]; });
    db.scores = db.scores.filter(function (s) { return !doomed[s.uid]; });
    save();
    console.log("Purged " + n + " demo learner(s) left over from an older build.");
  }
})();

/* ---------- helpers ---------- */
const cleanName = s => String(s == null ? "" : s).replace(/[<>&"']/g, "").trim().slice(0, 16);
/* 12.1: company names get the same sanitising as person names (48 chars). */
const cleanCompany = s => String(s == null ? "" : s).replace(/[<>&"']/g, "").trim().slice(0, 48);
const okUsername = u => typeof u === "string" && /^[a-z0-9._]{3,16}$/.test(u);
const okEmail = e => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const okPass = p => typeof p === "string" && p.length >= 6;
function hash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}
function sameHash(a, b) {
  const ba = Buffer.from(String(a), "hex"), bb = Buffer.from(String(b), "hex");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
function companyOf(u) {
  return u && u.companyId ? (db.companies[u.companyId] || null) : null;
}
function publicUser(u) {
  const c = companyOf(u);
  return {
    id: u.id, name: u.name, username: u.username, email: u.email,
    avatar: u.avatar, createdAt: u.createdAt,
    role: u.role || "learner",
    companyId: u.companyId || null,
    companyName: c ? c.name : null
  };
}
/* Phase 12: human-friendly invite codes, e.g. HIMALAYA-4F2K. */
function makeInviteCode(name) {
  const base = String(name || "").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || "SPOT";
  for (let i = 0; i < 30; i++) {
    const code = base + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
    if (!Object.keys(db.companies).some(id => db.companies[id].code === code)) { return code; }
  }
  return base + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}
function findCompanyByCode(code) {
  const want = String(code || "").trim().toUpperCase();
  if (!want) { return null; }
  const id = Object.keys(db.companies).find(k => db.companies[k].code === want);
  return id ? db.companies[id] : null;
}
/* Phase 16: duel codes - short enough to read aloud across a warehouse. */
const DUELS_CAP = 100;
function makeDuelCode() {
  for (let i = 0; i < 30; i++) {
    const code = "DUEL-" + crypto.randomBytes(2).toString("hex").toUpperCase();
    if (!db.duels.some(d => d.code === code)) { return code; }
  }
  return "DUEL-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}
function newToken(uid) {
  const t = crypto.randomBytes(24).toString("hex");
  /* 12.1: prune expired tokens so db.tokens can't grow without bound. */
  const now = Date.now();
  for (const k of Object.keys(db.tokens)) {
    if (!db.tokens[k] || db.tokens[k].exp < now) { delete db.tokens[k]; }
  }
  db.tokens[t] = { uid: uid, exp: now + TOKEN_MS };
  save();
  return t;
}
/* 12.1: throttle failed logins. Keyed per existing-account+ip, in-memory (a
   restart clears it, which is acceptable - the goal is to blunt online
   password guessing, not to be a durable lockout store).
   Only accounts that actually exist get a key: throttling unknown usernames
   by bare IP would let one person guessing names lock out a whole office
   behind shared NAT, which is a self-inflicted denial of service. */
const LOGIN_WINDOW_MS = 15 * 60 * 1000, LOGIN_MAX = 5;
const loginFails = new Map();
function failKey(req, username) {
  return String(username).toLowerCase() + "|" + (req.socket.remoteAddress || "?");
}
function isLocked(key) {
  const e = loginFails.get(key);
  return !!(e && e.lockedUntil > Date.now());
}
function noteFail(key) {
  const now = Date.now();
  let e = loginFails.get(key);
  /* A fresh window counts misses; only crossing LOGIN_MAX actually locks.
     The counting window and the lock are separate clocks - conflating them
     would lock an account after a single typo. */
  if (!e || now > e.windowEnd) { e = { n: 0, windowEnd: now + LOGIN_WINDOW_MS, lockedUntil: 0 }; }
  e.n += 1;
  if (e.n >= LOGIN_MAX) { e.lockedUntil = now + LOGIN_WINDOW_MS; e.n = 0; }
  loginFails.set(key, e);
}
function clearFails(key) { loginFails.delete(key); }
function authUid(req) {
  const m = String(req.headers.authorization || "").match(/^Bearer ([a-f0-9]{48})$/);
  if (!m) { return null; }
  const e = db.tokens[m[1]];
  if (!e || e.exp < Date.now()) { return null; }
  return e.uid;
}
function isRecord(r) {
  return !!r && typeof r === "object" && r.v === 1 &&
    typeof r.date === "number" && typeof r.score === "number" &&
    (r.mode === "training" || r.mode === "attack") &&
    (r.diff === "simple" || r.diff === "standard" || r.diff === "expert") &&
    typeof r.found === "number" &&
    Object.prototype.toString.call(r.perHazard) === "[object Array]" &&
    Object.prototype.toString.call(r.quiz) === "[object Array]";
}

/* ---------- http plumbing ---------- */
/* 12.1 hardening:
   - The app is strictly same-origin (the pages' CSP already says
     connect-src 'self'), so the old Access-Control-Allow-Origin: * served
     no purpose and only invited other sites to call this API from a
     visitor's browser. CORS headers are gone.
   - Every response now carries the standard defensive headers. */
const SEC_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin"
};
function send(res, code, body) {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(code, Object.assign({
    "Content-Type": "application/json", "Content-Length": buf.length,
    "Cache-Control": "no-store"
  }, SEC_HEADERS));
  res.end(buf);
}
function readBody(req) {
  return new Promise(function (resolve, reject) {
    let n = 0; const chunks = [];
    req.on("data", function (c) {
      n += c.length;
      if (n > 1e6) { reject(new Error("big")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", function () {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".json": "application/json", ".ico": "image/x-icon"
};
function serveStatic(req, res, urlPath) {
  let p = path.normalize(urlPath);
  if (p === "/" || p === "\\" || p === ".") { p = "/index.html"; }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("not found"); return; }
    res.writeHead(200, Object.assign({
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    }, SEC_HEADERS));
    res.end(data);
  });
}

/* ---------- api ---------- */
function api(req, res, pathname, query) {
  /* 12.1: no CORS - a bare 204 keeps any stray preflight harmless. */
  if (req.method === "OPTIONS") { res.writeHead(204, SEC_HEADERS); res.end(); return; }

  if (pathname === "/api/health") { return send(res, 200, { ok: true, app: "spotsafe360", v: 1 }); }

  if (pathname === "/api/auth/signup" && req.method === "POST") {
    return readBody(req).then(function (b) {
      const name = cleanName(b.name);
      const username = String(b.username || "").trim().toLowerCase();
      const email = String(b.email || "").trim().toLowerCase();
      if (!name) { return send(res, 400, { why: "name" }); }
      if (!okUsername(username)) { return send(res, 400, { why: "username" }); }
      if (!okEmail(email)) { return send(res, 400, { why: "email" }); }
      if (!okPass(b.password)) { return send(res, 400, { why: "pass" }); }
      for (const u of db.users) {
        if (u.username === username) { return send(res, 409, { why: "username-taken" }); }
        if (u.email && u.email === email) { return send(res, 409, { why: "email-taken" }); }
      }
      /* Phase 12: optional company. Either join an existing one with its
         invite code, or register a new company - the registering learner
         becomes its admin. Company membership is what scopes every
         supervision endpoint below. */
      let companyId = null, role = "learner";
      const code = String(b.companyCode || "").trim();
      const newCompany = cleanCompany(b.companyName);
      if (code) {
        const c = findCompanyByCode(code);
        if (!c) { return send(res, 400, { why: "company" }); }
        companyId = c.id;
      } else if (newCompany) {
        const id = "c-" + Date.now().toString(36) + "-" + crypto.randomBytes(3).toString("hex");
        db.companies[id] = {
          id: id, name: newCompany, code: makeInviteCode(newCompany), createdAt: Date.now()
        };
        companyId = id;
        role = "admin";
      }
      const salt = crypto.randomBytes(16).toString("hex");
      const user = {
        id: "u-" + Date.now().toString(36) + "-" + crypto.randomBytes(3).toString("hex"),
        name: name, username: username, email: email,
        avatar: Math.max(0, Math.min(5, parseInt(b.avatar, 10) || 0)),
        hash: hash(String(b.password), salt), salt: salt, createdAt: Date.now(),
        companyId: companyId, role: role
      };
      db.users.push(user);
      send(res, 201, { token: newToken(user.id), user: publicUser(user) });
    }).catch(function () { send(res, 400, { why: "name" }); });
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    return readBody(req).then(function (b) {
      /* username OR email may be used as the identifier (Phase 10.1). */
      const id = String(b.username || "").trim().toLowerCase();
      const u = db.users.find(function (x) {
        return x.username === id || (x.email && x.email === id);
      });
      /* 12.1: a locked account/ip pair gets a fast 429 without touching
         scrypt, so guessing cannot continue at any rate. */
      const key = u ? failKey(req, u.username) : null;
      if (key && isLocked(key)) { return send(res, 429, { why: "locked" }); }
      if (!u || typeof b.password !== "string" || !b.password ||
          !sameHash(hash(b.password, u.salt), u.hash)) {
        if (key) { noteFail(key); }
        return send(res, 401, { why: "login" });
      }
      clearFails(key);
      send(res, 200, { token: newToken(u.id), user: publicUser(u) });
    }).catch(function () { send(res, 401, { why: "login" }); });
  }

  /* everything below needs a bearer token */
  const uid = authUid(req);
  if (pathname === "/api/me") {
    if (!uid) { return send(res, 401, { why: "login" }); }
    const u = db.users.find(function (x) { return x.id === uid; });
    return u ? send(res, 200, { user: publicUser(u) }) : send(res, 401, { why: "login" });
  }

  /* ---------- Phase 12: company supervision (admin only) ----------
     Every route here re-derives the caller's company from the token, so a
     crafted uid or body value can never reach another company's data. */
  function callerAdmin() {
    const u = uid ? db.users.find(function (x) { return x.id === uid; }) : null;
    return (u && u.role === "admin" && u.companyId) ? u : null;
  }
  function companyMembers(admin) {
    return db.users.filter(function (x) { return x.companyId === admin.companyId; });
  }

  if (pathname === "/api/company" && req.method === "GET") {
    if (!uid) { return send(res, 401, { why: "login" }); }
    const u = db.users.find(function (x) { return x.id === uid; });
    const c = companyOf(u);
    if (!c) { return send(res, 404, { why: "none" }); }
    return send(res, 200, { company: { id: c.id, name: c.name, code: c.code, createdAt: c.createdAt }, role: u.role || "learner" });
  }

  if (pathname === "/api/company/learners" && req.method === "GET") {
    const admin = callerAdmin();
    if (!admin) { return send(res, 403, { why: "forbidden" }); }
    const learners = companyMembers(admin).map(function (x) {
      const recs = db.records[x.id] || [];
      let best = 0, total = 0, last = 0;
      recs.forEach(function (r) {
        if (r.score > best) { best = r.score; }
        total += r.score;
        if (r.date > last) { last = r.date; }
      });
      return {
        id: x.id, name: x.name, username: x.username, email: x.email,
        avatar: x.avatar | 0, role: x.role || "learner",
        rounds: recs.length, best: best,
        avg: recs.length ? Math.round(total / recs.length) : 0,
        lastPlayed: last
      };
    });
    const c = db.companies[admin.companyId];
    return send(res, 200, {
      company: { id: c.id, name: c.name, code: c.code },
      learners: learners
    });
  }

  if (pathname === "/api/company/records" && req.method === "GET") {
    const admin = callerAdmin();
    if (!admin) { return send(res, 403, { why: "forbidden" }); }
    const targetId = String((query && query.get("uid")) || "");
    const target = db.users.find(function (x) { return x.id === targetId; });
    if (!target || target.companyId !== admin.companyId) {
      return send(res, 404, { why: "not-found" });
    }
    return send(res, 200, { records: db.records[targetId] || [], user: publicUser(target) });
  }

  /* ---------- 17.0: company analytics + demo data ---------- */
  if (pathname === "/api/company/analytics" && req.method === "GET") {
    const admin = callerAdmin();
    if (!admin) { return send(res, 403, { why: "forbidden" }); }
    const members = companyMembers(admin);
    const haz = {};
    HAZARD_NAMES.forEach(function (h) { haz[h.id] = { id: h.id, name: h.name, cat: h.cat, found: 0, missed: 0 }; });
    const days = {};
    let totalRounds = 0, scoreSum = 0, active = 0;
    const learners = members.map(function (x) {
      const recs = db.records[x.id] || [];
      let best = 0, sum = 0;
      recs.forEach(function (r) {
        totalRounds++; scoreSum += r.score; sum += r.score;
        if (r.score > best) { best = r.score; }
        (r.perHazard || []).forEach(function (ph) {
          const cell = haz[ph.h] || (haz[ph.h] = { id: ph.h, name: ph.h, found: 0, missed: 0 });
          if (ph.found) { cell.found++; } else { cell.missed++; }
        });
        const key = new Date(r.date).toISOString().slice(0, 10);
        const cell = days[key] || (days[key] = { day: key, rounds: 0, scoreSum: 0 });
        cell.rounds++; cell.scoreSum += r.score;
      });
      if (recs.length) { active++; }
      return {
        id: x.id, name: x.name, username: x.username,
        rounds: recs.length, best: best,
        avg: recs.length ? Math.round(sum / recs.length) : 0
      };
    });
    learners.sort(function (a, b) { return b.avg - a.avg; });
    const daily = [];
    for (let i = 13; i >= 0; i--) {
      const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const cell = days[key];
      daily.push({ day: key, rounds: cell ? cell.rounds : 0, avg: cell ? Math.round(cell.scoreSum / cell.rounds) : 0 });
    }
    const hazards = Object.keys(haz).map(function (k) { return haz[k]; })
      .sort(function (a, b) { return b.missed - a.missed; });
    return send(res, 200, {
      teamAvg: totalRounds ? Math.round(scoreSum / totalRounds) : 0,
      totalRounds: totalRounds, activeLearners: active,
      learners: learners, daily: daily, hazards: hazards
    });
  }

  if (pathname === "/api/company/leaderboard" && req.method === "GET") {
    /* Phase 15: the board belongs to the whole company, not just the admin -
       a high-score challenge needs everyone to see everyone's best. Still
       never crosses company borders, and still needs a company. */
    const member = uid ? db.users.find(function (x) { return x.id === uid; }) : null;
    if (!member || !member.companyId) { return send(res, 403, { why: "forbidden" }); }
    const memberIds = {};
    companyMembers(member).forEach(function (x) { memberIds[x.id] = x.name; });
    const rows = db.scores
      .filter(function (s) { return s.uid && memberIds[s.uid]; })
      .slice(0, SCORES_CAP);
    return send(res, 200, { scores: rows });
  }
  /* ---------- Phase 16: 1v1 duels by challenge code ----------
     A duel is { code, diff, mode, createdBy/Name/Avatar, entries: [<=2] }.
     Attribution always comes from the token: names and uids in entries are
     server-side facts, never client claims. One side per player, two sides
     per duel, enforced here rather than in the browser. */
  if (pathname === "/api/duels" && req.method === "POST") {
    return readBody(req).then(function (b) {
      const u = uid ? db.users.find(function (x) { return x.id === uid; }) : null;
      if (!u) { return send(res, 401, { why: "login" }); }
      const diff = ["simple", "standard", "expert"].indexOf(b && b.diff) >= 0 ? b.diff : "standard";
      const duel = {
        code: makeDuelCode(), diff: diff, mode: "attack",
        createdBy: u.id, createdName: u.name, createdAvatar: u.avatar || 0,
        createdAt: Date.now(), entries: []
      };
      db.duels.push(duel);
      while (db.duels.length > DUELS_CAP) { db.duels.shift(); }
      save();
      send(res, 201, { duel: duel });
    }).catch(function () { send(res, 400, { why: "shape" }); });
  }
  if (pathname === "/api/duels/enter" && req.method === "POST") {
    return readBody(req).then(function (b) {
      const u = uid ? db.users.find(function (x) { return x.id === uid; }) : null;
      if (!u) { return send(res, 401, { why: "login" }); }
      const code = String((b && b.code) || "").trim().toUpperCase();
      const duel = db.duels.find(function (d) { return d.code === code; });
      if (!duel) { return send(res, 404, { why: "none" }); }
      if (duel.entries.some(function (e) { return e.uid === u.id; })) {
        return send(res, 409, { why: "twice" });
      }
      if (duel.entries.length >= 2) { return send(res, 409, { why: "full" }); }
      const e = (b && b.entry) || {};
      if (typeof e.score !== "number" || !isFinite(e.score) || e.score < 0 || e.score > 100000) {
        return send(res, 400, { why: "entry" });
      }
      duel.entries.push({
        uid: u.id, name: u.name, avatar: u.avatar || 0,
        score: Math.round(e.score),
        found: Math.max(0, Math.min(9, Math.round(Number(e.found) || 0))),
        secs: Math.max(0, Math.round(Number(e.secs) || 0)),
        quiz: Math.max(0, Math.round(Number(e.quiz) || 0)),
        quizOf: Math.max(0, Math.round(Number(e.quizOf) || 0)),
        date: Date.now()
      });
      save();
      send(res, 200, { duel: duel });
    }).catch(function () { send(res, 400, { why: "shape" }); });
  }
  if (pathname === "/api/duels" && req.method === "GET") {
    if (!uid) { return send(res, 401, { why: "login" }); }
    const code = String(query.get("code") || "").trim().toUpperCase();
    if (code) {
      const duel = db.duels.find(function (d) { return d.code === code; });
      if (!duel) { return send(res, 404, { why: "none" }); }
      return send(res, 200, { duel: duel });
    }
    const mine = db.duels
      .filter(function (d) {
        return d.createdBy === uid ||
          d.entries.some(function (e) { return e.uid === uid; });
      })
      .sort(function (a, b) { return b.createdAt - a.createdAt; })
      .slice(0, 20);
    return send(res, 200, { duels: mine });
  }
  if (pathname === "/api/records" && req.method === "GET") {
    if (!uid) { return send(res, 401, { why: "login" }); }
    return send(res, 200, { records: db.records[uid] || [] });
  }
  if (pathname === "/api/records" && req.method === "POST") {
    if (!uid) { return send(res, 401, { why: "login" }); }
    return readBody(req).then(function (r) {
      if (!isRecord(r)) { return send(res, 400, { why: "shape" }); }
      const list = db.records[uid] || (db.records[uid] = []);
      if (!r.id) { r.id = "r-" + crypto.randomBytes(4).toString("hex"); }
      if (!list.some(function (x) { return x.id === r.id; })) {
        list.push(r);
        while (list.length > RECORDS_CAP) { list.shift(); }
        save();
      }
      send(res, 200, { ok: true });
    }).catch(function () { send(res, 400, { why: "shape" }); });
  }
  if (pathname === "/api/scores" && req.method === "GET") {
    /* Phase 12 isolation: rows belonging to a company member stay inside
       that company's board - the public leaderboard only ever shows guest
       and individual (no-company) rounds. */
    const companyUsers = {};
    db.users.forEach(function (u) { if (u.companyId) { companyUsers[u.id] = true; } });
    const publicRows = db.scores.filter(function (s) { return !(s.uid && companyUsers[s.uid]); });
    return send(res, 200, { scores: publicRows.slice(0, SCORES_CAP) });
  }
  if (pathname === "/api/scores" && req.method === "POST") {
    return readBody(req).then(function (s) {
      if (!s || typeof s.score !== "number" || typeof s.name !== "string") {
        return send(res, 400, { why: "shape" });
      }
      /* Phase 10.2: attribution comes from the token, never from the body -
         a signed-in learner's rows carry their real uid, guest rows none. */
      const tUid = authUid(req);
      if (tUid) { s.uid = tUid; } else { delete s.uid; }
      db.scores.push(s);
      db.scores.sort(function (a, b) { return b.score - a.score; });
      db.scores = db.scores.slice(0, SCORES_CAP);
      save();
      send(res, 200, { ok: true });
    }).catch(function () { send(res, 400, { why: "shape" }); });
  }
  return send(res, 404, { why: "not-found" });
}

http.createServer(function (req, res) {
  const parts = (req.url || "/").split("?");
  const pathname = parts[0];
  const query = new URLSearchParams(parts[1] || "");
  if (pathname.startsWith("/api/")) { return api(req, res, pathname, query); }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
  serveStatic(req, res, decodeURIComponent(pathname));
}).listen(PORT, "0.0.0.0", function () {
  console.log("SpotSafe 360 server on http://0.0.0.0:" + PORT + " (db: " + DB_PATH + ")");
});
