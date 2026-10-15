/* SpotSafe 360 - admin.js (Phase 12, rebuilt 12.1). Company supervision.
   Pure DOM, no engine. Every byte of data here comes from the server, which
   re-derives the caller's company from the bearer token on each request -
   this page holds no cross-company data and cannot be tricked into showing
   any by editing the URL or the DOM. If the role check fails, the panel
   says so instead of rendering an empty table that looks like success.
   12.1: layout rebuilt on the dashboard's wide-card language; tables use
   .admin-table (sane column widths) instead of the leaderboard's .board. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[<>&"]/g, ""); }
  function go(page) {
    document.documentElement.setAttribute("data-redirect", page);
    try { window.location.replace(page); } catch (e) { /* jsdom no-op */ }
  }
  function failPanel(id, msg) {
    var el = $(id);
    if (!el) { return; }
    if (msg) { el.querySelector("h2").textContent = msg; }
    el.classList.remove("hidden");
  }

  /* ---------- static text ---------- */
  $("btnPortal").textContent = STRINGS.adminBack;
  $("btnOut").textContent = STRINGS.signoutBtn;
  $("learnersTitle").textContent = STRINGS.adminLearnersTitle;
  $("learnersHint").textContent = STRINGS.adminHistoryHint;
  $("boardTitle").textContent = STRINGS.adminBoardTitle;
  $("naBtn").textContent = STRINGS.adminBack;
  $("nsBtn").textContent = STRINGS.adminBack;
  $("inviteTitle").textContent = STRINGS.adminInviteTitle;
  $("inviteFine").textContent = STRINGS.adminInviteLabel;
  $("inviteCopyBtn").textContent = STRINGS.adminCopy;
  $("inviteCopied").textContent = "";

  /* ---------- gate ---------- */
  var uid = null;
  try { uid = SSStore.session.get(); } catch (e) { uid = null; }
  var user = uid && uid !== "guest" ? SSStore.users.get(uid) : null;
  if (!user) { go("login.html"); return; }

  $("btnPortal").addEventListener("click", function () {
    document.documentElement.setAttribute("data-redirect", "index.html");
    window.location.href = "index.html";
  });
  $("btnOut").addEventListener("click", function () {
    if (typeof SSNet !== "undefined" && SSNet.setToken) { SSNet.setToken(null); }
    SSStore.session.clear();
    go("login.html");
  });

  /* Cached role decides what we ask for; the server decides what we get. */
  if (user.role !== "admin") { failPanel("notAdmin", STRINGS.adminNotAdmin); return; }
  if (typeof SSNet === "undefined" || !SSNet.token()) {
    failPanel("needServer", STRINGS.adminNeedServer);
    return;
  }

  /* ---------- rendering ---------- */
  function rolePill(r) {
    var adm = r === "admin";
    return '<span class="role-pill' + (adm ? " adm" : "") + '">' +
      esc(adm ? STRINGS.adminRoleAdmin : STRINGS.adminRoleLearner) + "</span>";
  }
  function when(ms) {
    if (!ms) { return STRINGS.adminNever; }
    var d = new Date(ms);
    return d.toLocaleDateString() + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function modeName(m) { return m === "attack" ? STRINGS.modeAttackTitle : STRINGS.modeTrainingTitle; }

  var learnerCount = 0;
  function renderCompany(j) {
    var c = j.company || {};
    var name = c.name || "";
    $("companyName").textContent = name;
    /* avatar tile shows the company initial, like a slack-style workspace */
    $("companyAv").textContent = (name.replace(/[^A-Za-z0-9]/g, "").charAt(0) || "S").toUpperCase();
    $("inviteCode").value = c.code || "";
    learnerCount = (j.learners || []).length;
    paintSince();
  }
  function paintSince() {
    $("companySince").textContent = learnerCount + " " + STRINGS.adminMembers +
      " · " + STRINGS.adminTagline;
  }

  /* invite code: shown in a plain readonly input (16.3) - clicking it
     selects the whole code, so Ctrl+C works even if every clipboard API
     on earth fails. The button tries the real clipboard first and always
     tells the truth about what happened. */
  $("inviteCode").addEventListener("click", function () {
    $("inviteCode").select();
  });
  $("inviteCopyBtn").addEventListener("click", function () {
    var input = $("inviteCode");
    function flash(ok) {
      var c = $("inviteCopied");
      c.textContent = ok ? STRINGS.adminCopied : STRINGS.adminCopyFail;
      c.classList.remove("hidden");
      setTimeout(function () { c.classList.add("hidden"); }, 2600);
    }
    function selectIt() { input.focus(); input.select(); }
    /* 16.5: legacy fallback — select the code, then document.execCommand("copy").
       This works even where the async Clipboard API is unavailable or blocked
       (file:// pages, LAN-IP addresses, strict permission prompts), so the
       button puts the code itself on the clipboard in every browser that has
       ever shipped a copy command. It still never claims success without a
       real write. */
    function legacyCopy() {
      selectIt();
      var okFlag = false;
      try { okFlag = !!(document.execCommand && document.execCommand("copy")); } catch (e) { okFlag = false; }
      flash(okFlag);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.value)
        .then(function () { flash(true); }, legacyCopy);
    } else {
      legacyCopy();
    }
  });

  function renderLearners(j) {
    var list = (j.learners || []).slice();
    learnerCount = list.length;
    paintSince();
    var box = $("learnersBox");
    if (!list.length) {
      box.innerHTML = '<p class="fine">' + esc(STRINGS.adminEmpty) + "</p>";
      return;
    }
    list.sort(function (a, b) { return (b.best || 0) - (a.best || 0); });
    var html = '<table class="admin-table"><thead><tr>' +
      "<th>" + esc(STRINGS.adminThName) + "</th>" +
      "<th>" + esc(STRINGS.adminThRole) + "</th>" +
      "<th>" + esc(STRINGS.adminThRounds) + "</th>" +
      "<th>" + esc(STRINGS.adminThBest) + "</th>" +
      "<th>" + esc(STRINGS.adminThAvg) + "</th>" +
      "<th>" + esc(STRINGS.adminThLast) + "</th>" +
      "</tr></thead><tbody>";
    list.forEach(function (x) {
      html += '<tr class="pick" data-uid="' + esc(x.id) + '" tabindex="0">' +
        '<td class="who"><b>' + esc(x.name) + "</b><small>@" + esc(x.username) + "</small></td>" +
        "<td>" + rolePill(x.role) + "</td>" +
        "<td>" + (x.rounds | 0) + "</td>" +
        "<td><b>" + (x.best | 0) + "</b></td>" +
        "<td>" + (x.avg | 0) + "</td>" +
        "<td>" + esc(when(x.lastPlayed)) + "</td>" +
        "</tr>";
    });
    box.innerHTML = html + "</tbody></table>";

    Array.prototype.forEach.call(box.querySelectorAll("tr.pick"), function (row) {
      function open() {
        Array.prototype.forEach.call(box.querySelectorAll("tr.pick"), function (r) {
          r.removeAttribute("aria-current");
        });
        row.setAttribute("aria-current", "true");
        loadHistory(row.getAttribute("data-uid"));
      }
      row.addEventListener("click", open);
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
  }

  function renderBoard(rows) {
    var box = $("boardBox");
    if (!rows || !rows.length) {
      box.innerHTML = '<p class="fine">' + esc(STRINGS.leaderEmpty) + "</p>";
      return;
    }
    var html = '<table class="admin-table"><thead><tr><th>#</th><th>' +
      esc(STRINGS.adminThName) + "</th><th>" + esc(STRINGS.adminThBest) +
      "</tr></thead><tbody>";
    rows.slice(0, 10).forEach(function (r, i) {
      html += "<tr><td>" + (i + 1) + '</td><td class="who">' + esc(r.name) +
        "</td><td><b>" + (r.score | 0) + "</b></td></tr>";
    });
    box.innerHTML = html + "</tbody></table>";
  }

  function renderHistory(j) {
    var recs = ((j && j.records) || []).slice().sort(function (a, b) { return b.date - a.date; });
    var box = $("historyBox");
    $("historyPanel").classList.remove("hidden");
    $("historyTitle").textContent = STRINGS.adminHistoryTitle +
      (j && j.user ? " - " + j.user.name : "");
    if (!recs.length) {
      box.innerHTML = '<p class="fine">' + esc(STRINGS.adminNoHistory) + "</p>";
      return;
    }
    var html = '<table class="admin-table"><thead><tr><th>Date</th><th>Mode</th>' +
      "<th>" + esc(STRINGS.adminThBest) + "</th><th>Diff</th><th>Found</th><th>Quiz</th>" +
      "</tr></thead><tbody>";
    recs.forEach(function (r) {
      var quizRight = (r.quiz || []).filter(function (q) { return q && q.right; }).length;
      html += "<tr><td>" + esc(when(r.date)) + "</td><td>" + esc(modeName(r.mode)) +
        "</td><td><b>" + (r.score | 0) + "</b></td><td>" + esc(r.diff || "") +
        "</td><td>" + (r.found | 0) + "/" + (r.total | 0) +
        "</td><td>" + quizRight + "/" + (r.quiz || []).length + "</td></tr>";
    });
    box.innerHTML = html + "</tbody></table>";
  }

  function loadHistory(learnerId) {
    if (!learnerId) { return; }
    SSNet.learnerRecords(learnerId).then(renderHistory).catch(function (e) {
      if (e && e.why === "forbidden") { failPanel("notAdmin", STRINGS.adminNotAdmin); }
    });
  }

  /* ================= 17.0/17.1: performance charts =================
     Pure HTML/CSS/SVG - no chart library, no network beyond our own API,
     so the panel works offline-first like the rest of the app. */
  function S(k, d) { return (typeof STRINGS !== "undefined" && STRINGS[k]) || d; }
  var CAT_COLORS = {
    "Fire and Emergency": "var(--fire)",
    "Vehicle and Pedestrian": "var(--vehicle)",
    "Working at Height": "var(--height)",
    "Housekeeping": "var(--house)",
    "Stacking and Racking": "var(--stack)"
  };

  function renderAnalytics(j) {
    j = j || {};
    var has = (j.totalRounds | 0) > 0;
    $("chartGrid").classList.toggle("hidden", !has);
    $("analyticsEmpty").classList.toggle("hidden", has);
    var tiles = $("statTiles");
    if (tiles) { tiles.classList.toggle("hidden", !has); }
    if (!has) { return; }
    $("analyticsHint").textContent = S("analyticsHint", "");

    /* headline numbers */
    if (tiles) {
      function tile(v, label) {
        return '<div class="stat-tile"><b>' + (v | 0) + "</b><span>" + esc(label) + "</span></div>";
      }
      tiles.innerHTML =
        tile(j.teamAvg, S("chartTeamAvg", "Team average")) +
        tile(j.totalRounds, S("statRounds", "Rounds played")) +
        tile(j.activeLearners, S("statActive", "Active learners"));
    }

    /* average score by learner - ranked, leader in gold */
    var rows = (j.learners || []).filter(function (x) { return x.rounds > 0; }).slice(0, 8);
    var html = "";
    rows.forEach(function (x, i) {
      html += '<div class="cbar-row' + (i === 0 ? " top" : "") + '">' +
        '<span class="cbar-rank">' + (i + 1) + "</span>" +
        '<span class="cbar-name">' + esc(x.name) + "</span>" +
        '<span class="cbar-track"><span class="cbar-fill" style="width:' +
        Math.max(2, Math.min(100, x.avg | 0)) + '%"></span></span>' +
        '<span class="cbar-val">' + (x.avg | 0) + "</span></div>";
    });
    $("chartAvg").innerHTML = html;

    /* rounds per day - gridlines, rounded bars, peak day in hi-vis */
    var daily = j.daily || [], maxR = 1, peak = -1;
    daily.forEach(function (d, i) { if (d.rounds > maxR) { maxR = d.rounds; } });
    daily.forEach(function (d, i) { if (d.rounds === maxR && maxR > 0 && peak < 0) { peak = i; } });
    var chartH = 76, padT = 6, axisY = padT + chartH;
    var svg = '<svg viewBox="0 0 294 104" class="act-svg" role="img">';
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      var y = (padT + chartH * (1 - f)).toFixed(1);
      svg += '<line class="act-grid" x1="0" y1="' + y + '" x2="294" y2="' + y + '"/>';
    });
    daily.forEach(function (d, i) {
      var h = Math.max(2, Math.round(d.rounds / maxR * chartH));
      svg += '<rect class="act-bar' + (i === peak && d.rounds > 0 ? " peak" : "") +
        '" x="' + (3 + i * 21) + '" y="' + (axisY - h) +
        '" width="15" height="' + h + '" rx="3"><title>' +
        esc(d.day + ": " + d.rounds + " rounds") + "</title></rect>";
    });
    svg += '<line class="act-axis" x1="0" y1="' + (axisY + 1) + '" x2="294" y2="' + (axisY + 1) + '"/>';
    [0, 4, 9, 13].forEach(function (i) {
      var d = daily[i];
      if (!d) { return; }
      svg += '<text class="act-lab" x="' + (3 + i * 21) + '" y="98">' + esc(d.day.slice(5)) + "</text>";
    });
    svg += "</svg>";
    $("chartActivity").innerHTML = svg;

    /* most-missed hazards - found vs missed stacked, category colour */
    var hz = (j.hazards || []).slice(0, 5);
    var hhtml = "";
    hz.forEach(function (h) {
      var tot = (h.found | 0) + (h.missed | 0);
      var pctF = tot ? Math.round(h.found / tot * 100) : 0;
      var pctM = tot ? 100 - pctF : 0;
      hhtml += '<div class="hbar-row">' +
        '<span class="hbar-name" style="border-left:3px solid ' +
        (CAT_COLORS[h.cat] || "var(--height)") + '">' + esc(h.name) + "</span>" +
        '<span class="hbar-track">' +
        '<span class="hbar-found" style="width:' + pctF + '%"></span>' +
        '<span class="hbar-missed" style="width:' + pctM + '%"></span>' +
        "</span>" +
        '<span class="hbar-val">' + (h.missed | 0) + "/" + tot + "</span></div>";
    });
    hhtml += '<p class="hbar-legend">' +
      '<i class="sw found"></i>' + esc(S("legendFound", "Spotted")) +
      '<i class="sw missed"></i>' + esc(S("legendMissed", "Missed")) +
      "  ·  " + esc(S("legendOf", "missed / attempts")) + "</p>";
    $("chartHazards").innerHTML = hhtml;
  }

  /* static labels */
  $("analyticsTitle").textContent = S("analyticsTitle", "Company performance");
  $("analyticsHint").textContent = S("analyticsHint", "");
  $("analyticsEmpty").textContent = S("analyticsEmpty", "");
  $("chartAvgTitle").textContent = S("chartAvgTitle", "Average score by learner");
  $("chartActivityTitle").textContent = S("chartActivityTitle", "Rounds per day - last 14 days");
  $("chartHazardsTitle").textContent = S("chartHazardsTitle", "Most-missed hazards");

  /* ---------- load ---------- */
  function loadAll() {
    return SSNet.learners().then(function (j) {
      $("adminMain").classList.remove("hidden");
      renderCompany(j);
      renderLearners(j);
      return SSNet.companyBoard();
    }).then(function (j) {
      renderBoard(j && j.scores);
      /* 17.0: charts are an enhancement - an older backend without the
         analytics endpoint must never knock the admin panel offline. */
      return SSNet.analytics().then(renderAnalytics).catch(function () { /* charts stay empty */ });
    }).catch(function (e) {
      if (e && e.why === "forbidden") { return failPanel("notAdmin", STRINGS.adminNotAdmin); }
      failPanel("needServer", STRINGS.adminNeedServer);
    });
  }
  loadAll();
})();
