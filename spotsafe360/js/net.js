/* SpotSafe 360 - net.js (Phase 10). The cloud adapter.
   Talks to the same-origin /api backend (server/server.js). Every call is
   a plain fetch, so the strict CSP connect-src 'self' is honoured. The app
   probes health() and falls back to the local store when no server answers
   - one product, offline-first, cloud when present. */
(function (root) {
  "use strict";
  var TOKEN_KEY = "ss360_token";
  var token = null;
  try { token = root.localStorage.getItem(TOKEN_KEY); } catch (e) { /* blocked */ }

  function setToken(t) {
    token = t || null;
    try {
      if (token) { root.localStorage.setItem(TOKEN_KEY, token); }
      else { root.localStorage.removeItem(TOKEN_KEY); }
    } catch (e) { /* memory only */ }
  }

  function haveFetch() { return typeof root.fetch === "function"; }

  /* 12.1: a server that accepts the connection but never answers must not
     freeze the UI forever - every call aborts after ms and rejects with
     why:"timeout", which callers already handle like any other failure. */
  function fetchWithTimeout(url, opts, ms) {
    var o = Object.assign({}, opts);
    var timer = null;
    if (typeof root.AbortController === "function") {
      var ctl = new root.AbortController();
      o.signal = ctl.signal;
      timer = root.setTimeout(function () { ctl.abort(); }, ms);
    }
    return root.fetch(url, o).then(function (r) {
      if (timer) { root.clearTimeout(timer); }
      return r;
    }, function (err) {
      if (timer) { root.clearTimeout(timer); }
      if (err && err.name === "AbortError") {
        var e = new Error("timeout");
        e.why = "timeout";
        throw e;
      }
      throw err;
    });
  }

  function req(method, pathName, body) {
    if (!haveFetch()) {
      return Promise.reject(Object.assign(new Error("no fetch"), { why: "net" }));
    }
    var h = { "Content-Type": "application/json" };
    if (token) { h.Authorization = "Bearer " + token; }
    return fetchWithTimeout(pathName, {
      method: method, headers: h,
      body: body === undefined ? undefined : JSON.stringify(body)
    }, 8000).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error(j.why || ("http" + r.status));
          e.why = j.why || "http";
          throw e;
        }
        return j;
      });
    });
  }

  root.SSNet = {
    token: function () { return token; },
    setToken: setToken,
    /* Resolves true when a SpotSafe backend answers on this origin. */
    health: function () {
      if (!haveFetch()) { return Promise.resolve(false); }
      return fetchWithTimeout("/api/health", { cache: "no-store" }, 5000)
        .then(function (r) { return r.ok; })
        .catch(function () { return false; });
    },
    signup: function (b) { return req("POST", "/api/auth/signup", b); },
    login: function (username, password) {
      return req("POST", "/api/auth/login", { username: username, password: password });
    },
    me: function () { return req("GET", "/api/me"); },
    records: function () { return req("GET", "/api/records"); },
    addRecord: function (r) { return req("POST", "/api/records", r); },
    scores: function () { return req("GET", "/api/scores"); },
    addScore: function (s) { return req("POST", "/api/scores", s); },
    /* Phase 12: company supervision */
    company: function () { return req("GET", "/api/company"); },
    learners: function () { return req("GET", "/api/company/learners"); },
    learnerRecords: function (uid) {
      return req("GET", "/api/company/records?uid=" + encodeURIComponent(uid));
    },
    companyBoard: function () { return req("GET", "/api/company/leaderboard"); },
    /* 17.0: company analytics charts */
    analytics: function () { return req("GET", "/api/company/analytics"); },
    /* Phase 16: 1v1 duels by challenge code */
    duels: {
      create: function (diff) { return req("POST", "/api/duels", { diff: diff }); },
      get: function (code) { return req("GET", "/api/duels?code=" + encodeURIComponent(code)); },
      enter: function (code, entry) { return req("POST", "/api/duels/enter", { code: code, entry: entry }); },
      mine: function () { return req("GET", "/api/duels"); }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
