/* SpotSafe 360 - portal logic (Phase 9.5). Pure DOM, no 3D engine on this page.
   The game portal: avatar picker, mode tiles, difficulty segment, how-to
   overlay, local leaderboard, and round start via game.html URL parameters.
   Authentication moved to login.html (Phase 9.5): this page is only reachable
   with a session (profile or guest) - js/gate.js redirects otherwise. A
   profile session locks the setup to the learner; a guest session types a
   name as before. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  /* ---------- icons ---------- */
  var PATHS = {
    walk: '<circle cx="13" cy="4" r="2"/><path d="M11 21l1.5-6-2.5-3 1-5 3 2 3 1M11 21l-2-6M10 7L7 9"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
    mouse: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v3"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
    sound: '<path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    warning: '<path d="M12 3l9.5 17h-19z"/><path d="M12 9v5M12 17h.01"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.8 2.8 0 1 1 3.7 2.7c-.7.3-1 .9-1 1.7v.4"/><path d="M12 17.2h.01"/>',
    training: '<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a6 6 0 0 0-2 2z"/><path d="M8 7h7M8 11h7"/>',
    attack: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'
  };
  function svg(name, size) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (size ? ' width="' + size + '" height="' + size + '"' : "") + ">" + (PATHS[name] || "") + "</svg>";
  }

  /* ---------- avatars: six helmet-and-vest workers ----------
     The role is a label only. The game still receives the index, so the
     order here must not change once scores are saved against it. */
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

  /* ---------- profile memory ---------- */
  function loadProfile() {
    try { return JSON.parse(localStorage.getItem("ss360_profile")) || {}; }
    catch (e) { return {}; }
  }
  function saveProfile() {
    try {
      /* A logged-in learner's name and avatar belong to the profile, not to
         the guest memory, so only mode and difficulty are remembered. */
      var p = { mode: state.mode, diff: state.diff };
      if (!SSStore.session.isGuest()) { p.name = state.name; p.avatar = state.avatar; }
      localStorage.setItem("ss360_profile", JSON.stringify(p));
    } catch (e) { /* private mode or blocked storage: not fatal */ }
  }

  /* ---------- state ---------- */
  /* Used when a round starts with the name field left empty, and when an old
     score has no name on it. It is never a value of the input itself. */
  var FALLBACK_NAME = "Player";
  var saved = loadProfile();
  var state = {
    /* Profiles saved before this was fixed can hold the fallback. Treat it as
       blank so the placeholder shows instead of a name nobody typed. */
    name: typeof saved.name === "string" && saved.name !== FALLBACK_NAME
      ? saved.name.slice(0, 16) : "",
    avatar: AVATARS[saved.avatar] ? saved.avatar : 0,
    mode: saved.mode === "attack" ? "attack" : "training",
    diff: CONFIG.difficulties[saved.diff] ? saved.diff : "simple"
  };

  /* ---------- static text from STRINGS ---------- */
  $("tagline").textContent = STRINGS.portalTagline;
  $("nameLabel").textContent = STRINGS.nameLabel;
  $("nameInput").placeholder = STRINGS.namePlaceholder;
  $("avatarLabel").textContent = STRINGS.avatarLabel;
  $("modeTitle").textContent = STRINGS.modeTitle;
  $("diffTitle").textContent = STRINGS.diffTitle;
  $("btnStart").textContent = STRINGS.startBtn;
  $("btnHowTo").textContent = STRINGS.howToBtn;
  $("btnHowClose").textContent = STRINGS.howToClose;
  $("howToTitle").textContent = STRINGS.howToTitle;
  $("leaderTitle").textContent = STRINGS.leaderTitle;
  $("privacyLine").textContent = STRINGS.privacyLine;
  $("btnDash").textContent = STRINGS.dashBtn;
  /* 12.1 hardening: btnAdmin only exists in index.html builds from Phase 12
     on. A learner running a stale page with the new script must still get a
     working portal - one missing button may never kill the wiring below
     (this exact failure left the Sign-out button dead on a mixed build). */
  var btnAdmin = $("btnAdmin");
  if (btnAdmin) { btnAdmin.textContent = STRINGS.adminBtn; }
  $("btnLogout").textContent = STRINGS.signoutBtn;

  /* ---------- name ---------- */
  var nameInput = $("nameInput");
  nameInput.value = state.name;
  nameInput.addEventListener("input", function () { state.name = nameInput.value; });

  /* ---------- avatar picker ---------- */
  var avatarRow = $("avatarRow");
  /* Phase 11: each avatar carries one role perk (ROLE_PERKS). Showing it
     here turns the picker into a small tactical choice. */
  function renderPerk() {
    var line = $("perkLine");
    if (!line) { return; }
    var p = (typeof ROLE_PERKS !== "undefined" && ROLE_PERKS[state.avatar]) || null;
    if (!p) { line.textContent = ""; line.classList.add("hidden"); return; }
    line.innerHTML = '<b>' + p.name + "</b> &middot; " + p.line;
    line.classList.remove("hidden");
  }
  AVATARS.forEach(function (a, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "avatar-btn";
    b.innerHTML = avatarSvg(a, 46) + '<span class="avatar-name">' + a.role + "</span>";
    b.setAttribute("aria-label", a.role);
    b.setAttribute("aria-pressed", i === state.avatar ? "true" : "false");
    b.addEventListener("click", function () {
      state.avatar = i;
      Array.prototype.forEach.call(avatarRow.children, function (c, j) {
        c.setAttribute("aria-pressed", j === i ? "true" : "false");
      });
      renderHint(); renderPerk();
    });
    avatarRow.appendChild(b);
  });
  renderPerk();

  /* ---------- mode tiles ---------- */
  var modeRow = $("modeRow");
  [[ "training", STRINGS.modeTrainingTitle, STRINGS.modeTrainingLine, "training" ],
   [ "attack", STRINGS.modeAttackTitle, STRINGS.modeAttackLine, "attack" ]].forEach(function (m) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mode-tile";
    b.dataset.mode = m[0];
    b.setAttribute("aria-pressed", state.mode === m[0] ? "true" : "false");
    b.innerHTML = '<span class="mode-ico">' + svg(m[3]) + "</span>" +
      '<span class="mode-name">' + m[1] + "</span>" +
      '<span class="mode-line">' + m[2] + "</span>";
    b.addEventListener("click", function () {
      state.mode = m[0];
      Array.prototype.forEach.call(modeRow.children, function (c) {
        c.setAttribute("aria-pressed", c.dataset.mode === m[0] ? "true" : "false");
      });
      renderDiffFacts();
      renderHint();
    });
    modeRow.appendChild(b);
  });

  /* ---------- difficulty segment ---------- */
  function hintText(d) {
    return d.hintAfterSec > 0 ? STRINGS.hintTraining + d.hintAfterSec + " s" : STRINGS.hintNone;
  }
  function clockText(d) {
    return state.mode === "attack" ? d.attackSec + " s on the clock" : "No clock";
  }
  function renderDiffFacts() {
    Array.prototype.forEach.call(diffRow.children, function (c) {
      var d = CONFIG.difficulties[c.dataset.diff];
      c.querySelector(".diff-fact").textContent = state.mode === "attack"
        ? d.attackSec + " s · " + hintText(d).toLowerCase()
        : hintText(d);
    });
  }
  /* live one-liner under the start button: what this round will actually be */
  function renderHint() {
    var d = CONFIG.difficulties[state.diff];
    var mode = state.mode === "attack" ? STRINGS.modeAttackTitle : STRINGS.modeTrainingTitle;
    $("startHint").textContent = [
      AVATARS[state.avatar].role, mode, d.label, clockText(d),
      STRINGS.missCost + d.penalty
    ].join(" · ");
  }

  var diffRow = $("diffRow");
  Object.keys(CONFIG.difficulties).forEach(function (key) {
    var d = CONFIG.difficulties[key];
    var b = document.createElement("button");
    b.type = "button";
    b.className = "diff-btn";
    b.dataset.diff = key;
    b.setAttribute("aria-pressed", state.diff === key ? "true" : "false");
    b.title = hintText(d) + " · " + STRINGS.roundLen + d.attackSec + " s · " +
      STRINGS.missCost + d.penalty;
    b.innerHTML = '<span class="diff-name">' + d.label + "</span>" +
      '<span class="diff-fact"></span>';
    b.addEventListener("click", function () {
      state.diff = key;
      Array.prototype.forEach.call(diffRow.children, function (c) {
        c.setAttribute("aria-pressed", c.dataset.diff === key ? "true" : "false");
      });
      renderHint();
    });
    diffRow.appendChild(b);
  });
  renderDiffFacts();
  renderHint();

  /* ---------- how to play ---------- */
  var list = $("howToList");
  STRINGS.howTo.forEach(function (h) {
    var li = document.createElement("li");
    li.innerHTML = '<span class="howto-ico">' + svg(h.icon) + "</span><span>" + h.text + "</span>";
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

  /* ---------- session-aware setup (Phase 9.5) ----------
     gate.js already guarantees SOME session. A profile session locks name and
     avatar to the learner and unlocks the dashboard; a guest session keeps
     the classic type-a-name setup. */
  function applySessionUI() {
    var uid = null;
    try { uid = SSStore.session.get(); } catch (e) { uid = null; }
    var u = uid ? SSStore.users.get(uid) : null;
    if (u) {
      /* The account already chose its name and avatar at signup: no pickers,
         just a single line stating who is training. */
      state.name = u.name;
      state.avatar = u.avatar;
      nameInput.value = u.name;
      $("avatarField").classList.add("hidden");
      $("nameField").classList.add("hidden");
      var ta = $("trainingAs");
      var pk = (typeof ROLE_PERKS !== "undefined" && ROLE_PERKS[u.avatar]) || null;
      ta.textContent = STRINGS.trainingAs + " " + u.name + " · " +
        (AVATARS[u.avatar] || AVATARS[0]).role +
        (pk ? " — " + pk.name + ": " + pk.line : "");
      ta.classList.remove("hidden");
      $("btnDash").classList.remove("hidden");
      /* Phase 12: company admins get the supervision panel. The button is
         cosmetic - admin.html and the API re-check the role themselves. */
      if (btnAdmin) { btnAdmin.classList.toggle("hidden", u.role !== "admin"); }
    } else {
      $("avatarField").classList.remove("hidden");
      $("nameField").classList.remove("hidden");
      $("trainingAs").classList.add("hidden");
      nameInput.readOnly = false;
      nameInput.classList.remove("locked");
      Array.prototype.forEach.call(avatarRow.children, function (c, j) {
        c.disabled = false;
        c.setAttribute("aria-pressed", j === state.avatar ? "true" : "false");
      });
      $("btnDash").classList.add("hidden");
      if (btnAdmin) { btnAdmin.classList.add("hidden"); }
    }
    /* Any session (profile or guest) can sign out back to the auth portal. */
    $("btnLogout").classList.toggle("hidden", !uid);
    renderHint();
  }

  /* Phase 9.5 fix: the dashboard button actually navigates (playtest bug). */
  $("btnDash").addEventListener("click", function () {
    document.documentElement.setAttribute("data-redirect", "dashboard.html");
    window.location.href = "dashboard.html";
  });
  if (btnAdmin) {
    btnAdmin.addEventListener("click", function () {
      document.documentElement.setAttribute("data-redirect", "admin.html");
      window.location.href = "admin.html";
    });
  }
  $("btnLogout").addEventListener("click", function () {
    /* Phase 10.2: logging out must also drop the cloud token - leaving it
       behind would silently attach the next learner's rounds on this
       device to the previous account on the server. */
    if (typeof SSNet !== "undefined" && SSNet.setToken) { SSNet.setToken(null); }
    SSStore.session.clear();
    document.documentElement.setAttribute("data-redirect", "login.html");
    window.location.href = "login.html";
  });

  applySessionUI();

  /* ---------- leaderboard (Phase 10.2: local + server, deduped) ---------- */
  function renderBoardRows(rows) {
    var box = $("boardBox");
    if (!rows.length) {
      box.innerHTML = '<p class="board-empty">' + STRINGS.leaderEmpty + "</p>";
      return;
    }
    var top = rows.slice(0, 5);
    var html = '<table class="board"><thead><tr><th>#</th><th></th><th>Name</th><th>Score</th><th>Mode</th></tr></thead><tbody>';
    top.forEach(function (r, i) {
      var av = AVATARS[r.avatar] || AVATARS[0];
      var name = String(r.name || FALLBACK_NAME).replace(/[<>&]/g, "").slice(0, 16);
      var mode = r.mode === "attack" ? STRINGS.modeAttackTitle : STRINGS.modeTrainingTitle;
      html += "<tr><td>" + (i + 1) + "</td><td>" + avatarSvg(av, 22) + "</td><td>" + name +
        "</td><td><b>" + (r.score | 0) + "</b></td><td>" + mode + "</td></tr>";
    });
    box.innerHTML = html + "</tbody></table>";
  }
  function mergeScores(a, b) {
    /* Rounds played online exist in both stores - key them by
       name+score+date so the board never shows the same round twice. */
    var seen = {}, out = [];
    a.concat(b).forEach(function (r) {
      var k = (r.name || "") + "|" + (r.score | 0) + "|" + (r.date | 0);
      if (!r || seen[k]) { return; }
      seen[k] = true; out.push(r);
    });
    out.sort(function (x, y) { return y.score - x.score; });
    return out;
  }
  function renderBoard() {
    var local = [];
    try { local = SSStore.scores.list(); } catch (e) { local = []; }
    renderBoardRows(local);
    if (typeof SSNet !== "undefined" && SSNet.scores) {
      SSNet.scores().then(function (j) {
        renderBoardRows(mergeScores(local, (j && j.scores) || []));
      }).catch(function () { /* offline: the local board stands */ });
    }
  }
  renderBoard();

  /* ---------- start ---------- */
  $("btnStart").addEventListener("click", function () {
    /* Store what was actually typed, empty included. The fallback belongs to
       the round, not to the profile: writing it back would pre-fill the field
       with "Player" on the next visit and hide the placeholder. */
    state.name = nameInput.value.trim().slice(0, 16);
    saveProfile();
    var q = new URLSearchParams({
      name: state.name || FALLBACK_NAME, avatar: state.avatar,
      mode: state.mode, diff: state.diff
    });
    /* A logged-in learner's round is recorded against the profile. */
    var uid = null;
    try { uid = SSStore.session.get(); } catch (e) { uid = null; }
    if (uid && SSStore.users.get(uid)) { q.set("uid", uid); }
    window.location.href = "game.html?" + q.toString();
  });

  /* ---------- 16.4: join a 1v1 challenge from the portal ----------
     A teammate sends a code; the second player does not have to find the
     dashboard to use it. The button sits next to Start Game, and the row
     it opens posts the learner straight into that challenge's round. */
  $("btnJoinDuel").textContent = STRINGS.joinDuelBtn;
  $("btnJoinGo").textContent = STRINGS.joinGoBtn;
  $("btnJoinDuel").addEventListener("click", function () {
    var row = $("joinRow");
    row.classList.toggle("hidden");
    if (!row.classList.contains("hidden")) {
      $("joinMsg").textContent = "";
      $("joinCodeIn").focus();
    }
  });
  function joinGo() {
    var code = $("joinCodeIn").value.trim().toUpperCase();
    var msg = $("joinMsg");
    msg.textContent = "";
    if (!code) {
      msg.textContent = STRINGS.joinEnterCode;
      $("joinCodeIn").focus();
      return;
    }
    var uid = null;
    try { uid = SSStore.session.get(); } catch (e) { uid = null; }
    var signedIn = uid && SSStore.users.get(uid);
    if (!signedIn || typeof SSNet === "undefined" || !SSNet.token || !SSNet.token()) {
      msg.textContent = STRINGS.joinNeedLogin;
      return;
    }
    state.name = nameInput.value.trim().slice(0, 16);
    saveProfile();
    var q = new URLSearchParams({
      name: state.name || FALLBACK_NAME, avatar: state.avatar, duel: code, uid: uid
    });
    /* The challenge decides the difficulty and the clock; game.html reads
       the rest from the server before the round starts. */
    window.location.href = "game.html?" + q.toString();
  }
  $("btnJoinGo").addEventListener("click", joinGo);
  $("joinCodeIn").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { joinGo(); }
  });
})();
