/* SpotSafe 360 - store.js (Phase 8). The one storage layer.
   Every localStorage and sessionStorage decision in the product lives here,
   so portal, game and dashboard never grow their own copies. Implements
   CR-1/CR-2 (client feedback, 9 Sep 2026) under ADR-005: local-first learner
   profiles, salted PIN hashes and per-round records. No function in this
   file touches the network - a code review can verify the runtime-offline
   promise by reading it (B4, test row C13).
   Every read is try/catch-guarded and every write degrades silently to an
   in-memory copy, so blocked storage never breaks a round (NFR13). */
(function (root) {
  "use strict";

  var USERS_KEY = "ss360_users";
  var SCORES_KEY = "ss360_scores";
  var SESSION_KEY = "ss360_session";
  var RECORDS_CAP = 200;   // per profile, oldest dropped (TDD 3.5)
  var SCORES_CAP = 50;     // unchanged leaderboard cap

  /* ---------- storage with memory fallback ---------- */
  var mem = {};
  var sessionMem = null;
  function lsGet(k) {
    try {
      var v = root.localStorage.getItem(k);
      if (v !== null) { return v; }
    } catch (e) { /* blocked */ }
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
  }
  function lsSet(k, v) {
    mem[k] = v;
    try { root.localStorage.setItem(k, v); } catch (e) { /* memory copy stands */ }
  }
  function readJSON(k, def) {
    var v = lsGet(k);
    if (v === null) { return def; }
    try {
      var parsed = JSON.parse(v);
      return parsed === null ? def : parsed;
    } catch (e) { return def; }
  }
  function writeJSON(k, val) { lsSet(k, JSON.stringify(val)); }

  function recordsKey(uid) { return "ss360_records_" + uid; }

  /* ---------- ids ---------- */
  function newId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" +
      Math.floor(Math.random() * 46656).toString(36);
  }

  /* ---------- PIN hashing (TDD 3.4) ----------
     The PIN is access control for a shared device, not cryptographic
     security; the B4 report says so plainly. Hashing still means the PIN is
     never stored or shown in plain text, and per-profile salts mean equal
     PINs do not share a hash. SHA-256 via WebCrypto where available, an
     honest djb2 fallback where it is not, with the algorithm named in the
     hash itself. */
  function djb2(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return "djb2:" + h.toString(36);
  }
  function subtle() {
    return (root.crypto && root.crypto.subtle && root.crypto.subtle.digest)
      ? root.crypto.subtle : null;
  }
  function sha256(str) {
    var s = subtle();
    if (!s || typeof root.TextEncoder !== "function" || typeof root.btoa !== "function") {
      return Promise.resolve(null);
    }
    var bytes = new root.TextEncoder().encode(str);
    return s.digest("SHA-256", bytes).then(function (buf) {
      var b = new Uint8Array(buf), out = "";
      for (var i = 0; i < b.length; i++) { out += String.fromCharCode(b[i]); }
      return "sha256:" + root.btoa(out);
    }).catch(function () { return null; });
  }
  function hashPin(salt, pin) {
    return sha256(salt + ":" + pin).then(function (h) {
      return h || djb2(salt + ":" + pin);
    });
  }
  function randomSalt() {
    var chars = "abcdefghijkmnopqrstuvwxyz23456789", out = "";
    for (var i = 0; i < 8; i++) { out += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return out;
  }
  /* Constant-time-ish compare: local UX level, but the habit costs nothing. */
  function sameHash(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) { return false; }
    var diff = 0;
    for (var i = 0; i < a.length; i++) { diff |= a.charCodeAt(i) ^ b.charCodeAt(i); }
    return diff === 0;
  }

  /* ---------- validation ---------- */
  function sanitiseName(name) {
    return String(name == null ? "" : name).replace(/[<>&"']/g, "").trim().slice(0, 16);
  }
  function validPin(pin) {
    return typeof pin === "string" && /^[0-9]{4,6}$/.test(pin);
  }
  /* Phase 9.9: SaaS-ready account rules. Username is the login id; email is
     the recovery/contact id; both are stored lower-cased and must be unique. */
  function validUsername(u) {
    return typeof u === "string" && /^[a-z0-9._]{3,16}$/.test(u);
  }
  function validEmail(e) {
    return typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  }
  function validPass(p) {
    return typeof p === "string" && p.length >= 6;
  }
  function clampAvatar(a) {
    var n = parseInt(a, 10);
    return isNaN(n) ? 0 : Math.max(0, Math.min(5, n));
  }
  /* A record must carry the fields the dashboard reads, or it is refused at
     the door (import) rather than breaking a chart later. */
  function isRecord(r) {
    return !!r && typeof r === "object" && r.v === 1 &&
      typeof r.date === "number" && typeof r.score === "number" &&
      (r.mode === "training" || r.mode === "attack") &&
      (r.diff === "simple" || r.diff === "standard" || r.diff === "expert") &&
      typeof r.found === "number" &&
      Object.prototype.toString.call(r.perHazard) === "[object Array]" &&
      Object.prototype.toString.call(r.quiz) === "[object Array]";
  }

  /* ---------- users (Phase 9.9: SaaS-ready accounts) ----------
     An account is { id, name, username, email, avatar, passHash, pinSalt }.
     username and email are unique (email blank only for migrated v1 rows).
     v1 PIN profiles are migrated on first read: they receive a username
     slug and keep signing in with their old PIN as password, so nobody's
     records are locked out while the product moves to real accounts. */
  function slugify(name, taken) {
    var base = String(name).toLowerCase().replace(/[^a-z0-9._]+/g, "").slice(0, 12) || "learner";
    var out = base, n = 2;
    while (taken[out]) { out = base + n; n += 1; }
    taken[out] = true;
    return out;
  }
  function migrateUsers(list) {
    var changed = false, taken = {};
    list.forEach(function (u) { if (u && u.username) { taken[u.username] = true; } });
    list.forEach(function (u) {
      if (!u || typeof u !== "object" || u.username) { return; }
      u.username = slugify(u.name, taken);
      u.email = u.email || "";
      if (u.pinHash && !u.passHash) { u.passHash = u.pinHash; u.v1pin = true; }
      changed = true;
    });
    return changed;
  }
  function userList() {
    var list = readJSON(USERS_KEY, []);
    if (Object.prototype.toString.call(list) !== "[object Array]") { return []; }
    if (migrateUsers(list)) { writeJSON(USERS_KEY, list); }
    return list;
  }
  var users = {
    list: function () { return userList().slice(0); },
    get: function (uid) {
      var found = null;
      userList().forEach(function (u) { if (u && u.id === uid) { found = u; } });
      return found;
    },
    byUsername: function (uname) {
      var want = String(uname || "").trim().toLowerCase(), found = null;
      userList().forEach(function (u) { if (u && u.username === want) { found = u; } });
      return found;
    },
    byEmail: function (mail) {
      var want = String(mail || "").trim().toLowerCase(), found = null;
      userList().forEach(function (u) { if (u && u.email && u.email === want) { found = u; } });
      return found;
    },
    /* Resolves { ok:true, user } or { ok:false, why:
       "name"|"username"|"email"|"pass"|"username-taken"|"email-taken" }. */
    add: function (name, username, email, avatar, password) {
      var clean = sanitiseName(name);
      if (!clean) { return Promise.resolve({ ok: false, why: "name" }); }
      var uname = String(username || "").trim().toLowerCase();
      if (!validUsername(uname)) { return Promise.resolve({ ok: false, why: "username" }); }
      var mail = String(email || "").trim().toLowerCase();
      if (!validEmail(mail)) { return Promise.resolve({ ok: false, why: "email" }); }
      if (!validPass(password)) { return Promise.resolve({ ok: false, why: "pass" }); }
      var list = userList();
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].username === uname) {
          return Promise.resolve({ ok: false, why: "username-taken" });
        }
        if (list[i] && list[i].email && list[i].email === mail) {
          return Promise.resolve({ ok: false, why: "email-taken" });
        }
      }
      var salt = randomSalt();
      return hashPin(salt, password).then(function (hash) {
        var user = {
          id: newId("u"), name: clean, username: uname, email: mail,
          avatar: clampAvatar(avatar), passHash: hash, pinSalt: salt,
          createdAt: Date.now(), lastLoginAt: Date.now()
        };
        list.push(user);
        writeJSON(USERS_KEY, list);
        return { ok: true, user: user };
      });
    },
    /* Sign-in by username or email + password (Phase 10.1 - nobody should
       be locked out by remembering the wrong identifier). Legacy migrated
       profiles accept their old PIN as password (v1pin flag) so no records
       are orphaned. */
    verify: function (username, password) {
      var u = users.byUsername(username) || users.byEmail(username);
      if (!u || typeof password !== "string" || !password) {
        return Promise.resolve({ ok: false, why: "login" });
      }
      if (u.v1pin && !validPass(password) && !validPin(password)) {
        return Promise.resolve({ ok: false, why: "login" });
      }
      var stored = String(u.passHash || "");
      if (stored.indexOf("sha256:") === 0 && !subtle()) {
        return Promise.resolve({ ok: false, why: "algo" });
      }
      return hashPin(u.pinSalt || "", password).then(function (hash) {
        return sameHash(hash, stored)
          ? { ok: true, user: u } : { ok: false, why: "login" };
      });
    },
    touch: function (uid) {
      var list = userList(), changed = false;
      list.forEach(function (u) {
        if (u && u.id === uid) { u.lastLoginAt = Date.now(); changed = true; }
      });
      if (changed) { writeJSON(USERS_KEY, list); }
    },
    /* Phase 10: cache a server account locally (no secrets) so the portal,
       gate and dashboard work the same for cloud and local learners. */
    cacheRemote: function (u) {
      var list = userList(), found = null;
      list.forEach(function (x) { if (x && x.id === u.id) { found = x; } });
      if (found) {
        found.name = u.name; found.username = u.username;
        found.email = u.email || ""; found.avatar = u.avatar | 0;
        found.remote = true; found.lastLoginAt = Date.now();
        /* Phase 12: carry the company role so the portal can offer the
           admin panel. The server still re-checks on every request - this
           is display only, never an authorisation source. */
        found.role = u.role || "learner";
        found.companyId = u.companyId || null;
        found.companyName = u.companyName || null;
      } else {
        list.push({
          id: u.id, name: u.name, username: u.username, email: u.email || "",
          avatar: u.avatar | 0, remote: true,
          createdAt: u.createdAt || Date.now(), lastLoginAt: Date.now(),
          role: u.role || "learner",
          companyId: u.companyId || null,
          companyName: u.companyName || null
        });
      }
      writeJSON(USERS_KEY, list);
    },
    remove: function (uid) {
      writeJSON(USERS_KEY, userList().filter(function (u) { return !u || u.id !== uid; }));
      try { root.localStorage.removeItem(recordsKey(uid)); } catch (e) { /* ignore */ }
      delete mem[recordsKey(uid)];
    }
  };

  /* ---------- session (per tab, dies with the tab) ----------
     Phase 9.5: a session is either a real profile uid or the guest token.
     The gate (js/gate.js) only lets the game portal and the round start when
     SOME session exists; the dashboard additionally demands a real profile. */
  var GUEST_TOKEN = "guest";
  var session = {
    get: function () {
      try {
        var v = root.sessionStorage.getItem(SESSION_KEY);
        if (v !== null) { return v || null; }
      } catch (e) { /* blocked */ }
      return sessionMem;
    },
    set: function (uid) {
      sessionMem = uid;
      try { root.sessionStorage.setItem(SESSION_KEY, uid); } catch (e) { /* memory stands */ }
    },
    setGuest: function () { session.set(GUEST_TOKEN); },
    isGuest: function () { return session.get() === GUEST_TOKEN; },
    clear: function () {
      sessionMem = null;
      try { root.sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    }
  };

  /* ---------- records ---------- */
  var records = {
    list: function (uid) {
      var list = readJSON(recordsKey(uid), []);
      if (Object.prototype.toString.call(list) !== "[object Array]") { return []; }
      return list.filter(isRecord);
    },
    add: function (uid, rec) {
      if (!uid || !isRecord(rec)) { return false; }
      var list = records.list(uid);
      list.push(rec);
      while (list.length > RECORDS_CAP) { list.shift(); }
      writeJSON(recordsKey(uid), list);
      return true;
    },
    exportJSON: function (uid) {
      var u = users.get(uid);
      return JSON.stringify({
        app: "spotsafe360", v: 1, exportedAt: Date.now(),
        profile: u ? { id: u.id, name: u.name, avatar: u.avatar, createdAt: u.createdAt } : null,
        records: records.list(uid)
      }, null, 2);
    },
    /* Merge by record id; duplicates and malformed rows are skipped, never
       fatal. Returns { added, skipped } or { error:"shape" }. */
    importJSON: function (uid, text) {
      var doc;
      try { doc = JSON.parse(text); } catch (e) { return { error: "shape" }; }
      if (!doc || doc.v !== 1 || doc.app !== "spotsafe360" ||
          Object.prototype.toString.call(doc.records) !== "[object Array]") {
        return { error: "shape" };
      }
      var list = records.list(uid);
      var known = {};
      list.forEach(function (r) { known[r.id] = true; });
      var added = 0, skipped = 0;
      doc.records.forEach(function (r) {
        if (isRecord(r) && r.id && !known[r.id]) {
          known[r.id] = true; list.push(r); added += 1;
        } else { skipped += 1; }
      });
      list.sort(function (a, b) { return a.date - b.date; });
      while (list.length > RECORDS_CAP) { list.shift(); }
      writeJSON(recordsKey(uid), list);
      return { added: added, skipped: skipped };
    }
  };

  /* ---------- leaderboard (logic moved here verbatim from app.js) ---------- */
  var scores = {
    list: function () {
      var rows = readJSON(SCORES_KEY, []);
      return Object.prototype.toString.call(rows) === "[object Array]" ? rows : [];
    },
    add: function (row) {
      var rows = scores.list();
      rows.push(row);
      rows.sort(function (a, b) { return b.score - a.score; });
      if (rows.length > SCORES_CAP) { rows = rows.slice(0, SCORES_CAP); }
      writeJSON(SCORES_KEY, rows);
    }
  };

  root.SSStore = {
    users: users, session: session, records: records, scores: scores,
    newId: newId, validPin: validPin, sanitiseName: sanitiseName,
    validUsername: validUsername, validEmail: validEmail, validPass: validPass,
    RECORDS_CAP: RECORDS_CAP, SCORES_CAP: SCORES_CAP
  };
})(typeof window !== "undefined" ? window : globalThis);
