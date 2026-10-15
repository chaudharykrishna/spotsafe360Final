/* SpotSafe 360 - auth.js (Phase 9.9). The sign-in / sign-up portal page.
   Real account model: sign in with username + password; create an account
   with name, username, email, avatar and password (username and email are
   unique). A guest route remains for zero-commitment play. Every success
   path sets a session and hands over to the game portal; an existing
   session bounces straight there. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  function go(page) {
    document.documentElement.setAttribute("data-redirect", page);
    try { window.location.replace(page); } catch (e) { /* jsdom no-op */ }
  }

  /* Already signed in (profile or guest)? Nothing to do here. */
  var existing = null;
  try { existing = SSStore.session.get(); } catch (e) { existing = null; }
  if (existing) { go("index.html"); return; }

  /* ---------- avatars (same six workers as the portal) ---------- */
  var AVATARS = [
    { role: "Warehouse Op",   helmet: "#FFD100", vest: "#F28C28", skin: "#D9B38C" },
    { role: "Shift Manager",  helmet: "#FFD100", vest: "#2E6FDB", skin: "#8D5524" },
    { role: "Safety Officer", helmet: "#EAF2FB", vest: "#1D6B3A", skin: "#F1C27D" },
    { role: "Maintenance",    helmet: "#F28C28", vest: "#FFD100", skin: "#5C3A21" },
    { role: "New Starter",    helmet: "#2E6FDB", vest: "#C0392B", skin: "#D9B38C" },
    { role: "Forklift Driver", helmet: "#1D6B3A", vest: "#FFD100", skin: "#F1C27D" }
  ];
  function avatarSvg(a, size) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="' + size + '" height="' + size + '">' +
      '<circle cx="12" cy="10" r="5.4" fill="' + a.skin + '"/>' +
      '<path d="M6.2 9.4a5.8 5.8 0 0 1 11.6 0z" fill="' + a.helmet + '"/>' +
      '<rect x="5.4" y="9" width="13.2" height="1.6" rx="0.8" fill="' + a.helmet + '"/>' +
      '<path d="M4.5 21c1-4 4-5.6 7.5-5.6s6.5 1.6 7.5 5.6z" fill="' + a.vest + '"/>' +
      "</svg>";
  }

  /* ---------- static text ---------- */
  $("authTagline").textContent = STRINGS.authTagline;
  $("tabSignin").textContent = STRINGS.tabSignin;
  $("tabSignup").textContent = STRINGS.tabSignup;
  $("siUserLabel").textContent = STRINGS.siUserLabel;
  $("siPassLabel").textContent = STRINGS.siPassLabel;
  $("siUnlock").textContent = STRINGS.signInBtn;
  $("suNameLabel").textContent = STRINGS.npNameLabel;
  $("suName").placeholder = STRINGS.npNamePlaceholder;
  $("suUserLabel").textContent = STRINGS.suUserLabel;
  $("suEmailLabel").textContent = STRINGS.suEmailLabel;
  $("suCompanyCodeLabel").textContent = STRINGS.suCompanyCodeLabel;
  $("suCompanyNameLabel").textContent = STRINGS.suCompanyNameLabel;
  $("suCompanyFine").textContent = STRINGS.suCompanyFine;
  $("suAvatarLabel").textContent = STRINGS.npAvatarLabel;
  $("suPin1Label").textContent = STRINGS.suPass1Label;
  $("suPin2Label").textContent = STRINGS.suPass2Label;
  $("suCreate").textContent = STRINGS.npCreate;
  $("suFine").textContent = STRINGS.npFine;
  $("btnGuest").textContent = STRINGS.guestBtn;
  $("guestFine").textContent = STRINGS.guestFine;
  $("howToTitle").textContent = STRINGS.howToTitle;
  $("btnHowClose").textContent = STRINGS.howToClose;

  /* ---------- how to play ---------- */
  var list = $("howToList");
  STRINGS.howTo.forEach(function (h) {
    var li = document.createElement("li");
    li.innerHTML = "<span>" + h.text + "</span>";
    list.appendChild(li);
  });
  function setHowTo(open) {
    $("howto").classList.toggle("hidden", !open);
    if (open) { $("btnHowClose").focus(); } else { $("btnHowTo").focus(); }
  }
  $("btnHowTo").addEventListener("click", function () { setHowTo(true); });
  $("btnHowClose").addEventListener("click", function () { setHowTo(false); });
  $("howto").addEventListener("click", function (e) { if (e.target === $("howto")) { setHowTo(false); } });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("howto").classList.contains("hidden")) { setHowTo(false); }
  });

  /* ---------- tabs ---------- */
  function setTab(which) {
    var signin = which === "signin";
    $("tabSignin").setAttribute("aria-selected", signin ? "true" : "false");
    $("tabSignup").setAttribute("aria-selected", signin ? "false" : "true");
    $("paneSignin").classList.toggle("hidden", !signin);
    $("paneSignup").classList.toggle("hidden", signin);
  }
  $("tabSignin").addEventListener("click", function () { setTab("signin"); });
  $("tabSignup").addEventListener("click", function () { setTab("signup"); });
  /* First visit: no accounts exist yet, so start on the create tab. */
  var hasUsers = false;
  try { hasUsers = SSStore.users.list().length > 0; } catch (e) { hasUsers = false; }
  setTab(hasUsers ? "signin" : "signup");

  function fail(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }

  /* Phase 10.1: the cloud adapter is optional at runtime. If net.js is
     missing (half-copied build) or fetch is unavailable, everything below
     still works against local storage instead of throwing - a silent dead
     button is the worst failure mode a login page has. */
  function netHealth() {
    return (typeof SSNet !== "undefined" && SSNet && SSNet.health)
      ? SSNet.health() : Promise.resolve(false);
  }

  /* ---------- session handover ---------- */
  function finishLogin(user, token) {
    if (token) {
      /* Cloud login: keep the token, cache the account (no secrets) so the
         rest of the app treats cloud and local learners identically. */
      SSNet.setToken(token);
      SSStore.users.cacheRemote(user);
    }
    SSStore.session.set(user.id);
    try { SSStore.users.touch(user.id); } catch (e) { /* not fatal */ }
    go("index.html");
  }

  /* ---------- sign in: username + password (cloud first, local fallback) ---------- */
  function doUnlock() {
    var err = $("siError");
    err.classList.add("hidden");
    var u = $("siUser").value, p = $("siPass").value;
    function bad(m) {
      fail(err, m || STRINGS.errLogin);
      $("siPass").value = "";
      $("siPass").focus();
    }
    netHealth().then(function (online) {
      if (online) {
        return SSNet.login(u, p).then(function (res) {
          finishLogin(res.user, res.token);
        }).catch(function (e) {
          if (e.why === "algo") { return fail(err, STRINGS.pinAlgo); }
          /* 12.1: a server-side lockout is the final word for this attempt -
             do NOT fall through to the local store, or the throttle could be
             bypassed by guessing against an old local account instead. */
          if (e.why === "locked") { return bad(STRINGS.errLocked); }
          /* Unknown to the server - it may still be a local-only account. */
          return localVerify();
        });
      }
      return localVerify();
    });
    function localVerify() {
      return SSStore.users.verify(u, p).then(function (res) {
        if (res.ok) { return finishLogin(res.user, null); }
        if (res.why === "algo") { return fail(err, STRINGS.pinAlgo); }
        bad();
      });
    }
  }
  $("siUnlock").addEventListener("click", doUnlock);
  [$("siUser"), $("siPass")].forEach(function (inp) {
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { doUnlock(); } });
  });

  /* ---------- sign up: name + username + email + avatar + password ---------- */
  var suAvatar = 0;
  var suRow = $("suAvatars");
  AVATARS.forEach(function (a, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "avatar-btn";
    b.innerHTML = avatarSvg(a, 40) + '<span class="avatar-name">' + a.role + "</span>";
    b.setAttribute("aria-label", a.role);
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    b.addEventListener("click", function () {
      suAvatar = i;
      Array.prototype.forEach.call(suRow.children, function (c, j) {
        c.setAttribute("aria-pressed", j === i ? "true" : "false");
      });
    });
    suRow.appendChild(b);
  });
  function createProfile() {
    var err = $("suError");
    err.classList.add("hidden");
    if (!SSStore.sanitiseName($("suName").value)) { return fail(err, STRINGS.errName); }
    if (!SSStore.validUsername($("suUser").value.trim().toLowerCase())) { return fail(err, STRINGS.errUsername); }
    if (!SSStore.validEmail($("suEmail").value.trim())) { return fail(err, STRINGS.errEmail); }
    if (!SSStore.validPass($("suPin1").value)) { return fail(err, STRINGS.errPassLen); }
    if ($("suPin1").value !== $("suPin2").value) { return fail(err, STRINGS.errPinMatch); }
    var msg = {
      name: STRINGS.errName, username: STRINGS.errUsername,
      email: STRINGS.errEmail, pass: STRINGS.errPassLen,
      "username-taken": STRINGS.errUsernameTaken, "email-taken": STRINGS.errEmailTaken,
      company: STRINGS.errCompany
    };
    /* Phase 12: company fields are server-only. A code joins a company; a
       company name registers one (and makes this learner its admin). */
    var cCode = $("suCompanyCode").value.trim().toUpperCase();
    var cName = $("suCompanyName").value.trim();
    /* 12.1: a code and a new company name contradict each other - joining
       someone else's company while claiming to found a new one. Refuse
       before any network round trip instead of silently picking one. */
    if (cCode && cName) { return fail(err, STRINGS.errCompanyBoth); }
    netHealth().then(function (online) {
      if (online) {
        return SSNet.signup({
          name: $("suName").value, username: $("suUser").value,
          email: $("suEmail").value, avatar: suAvatar, password: $("suPin1").value,
          companyCode: cCode || undefined, companyName: cName || undefined
        }).then(function (res) {
          finishLogin(res.user, res.token);
        }).catch(function (e) {
          /* Validation errors come from the server (source of truth when
             online); a hard network failure drops through to local. */
          if (msg[e.why]) { return fail(err, msg[e.why]); }
          return localCreate();
        });
      }
      return localCreate();
    });
    function localCreate() {
      SSStore.users.add($("suName").value, $("suUser").value, $("suEmail").value,
        suAvatar, $("suPin1").value).then(function (res) {
        if (!res.ok) { return fail(err, msg[res.why] || STRINGS.errName); }
        finishLogin(res.user, null);
      });
    }
  }
  $("suCreate").addEventListener("click", createProfile);
  [$("suName"), $("suUser"), $("suEmail"), $("suCompanyCode"), $("suCompanyName"), $("suPin1"), $("suPin2")].forEach(function (inp) {
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { createProfile(); } });
  });

  /* ---------- guest ---------- */
  $("btnGuest").addEventListener("click", function () {
    SSStore.session.setGuest();
    go("index.html");
  });
})();
