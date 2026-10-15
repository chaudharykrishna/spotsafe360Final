/* SpotSafe 360 - dashboard.js (Phase 9.9 rewrite, CR-2). The learner
   dashboard, concise and to the point: four headline numbers, one
   "focus here" line (the weakest category), and the recent rounds table.
   Pure DOM like the portal - never loads the 3D engine, strict CSP, no
   network. All wording comes from STRINGS (NFR9). */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  var AVATARS = [
    { role: "Warehouse Op",   helmet: "#FFD100", vest: "#F28C28", skin: "#D9B38C" },
    { role: "Shift Manager",  helmet: "#FFD100", vest: "#2E6FDB", skin: "#8D5524" },
    { role: "Safety Officer", helmet: "#EAF2FB", vest: "#1D6B3A", skin: "#F1C27D" },
    { role: "Maintenance",    helmet: "#F28C28", vest: "#FFD100", skin: "#5C3A21" },
    { role: "New Starter",    helmet: "#2E6FDB", vest: "#C0392B", skin: "#D9B38C" },
    { role: "Forklift Driver",helmet: "#1D6B3A", vest: "#FFD100", skin: "#F1C27D" }
  ];
  function avatarSvg(a, size) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="' + size + '" height="' + size + '">' +
      '<circle cx="12" cy="10" r="5.4" fill="' + a.skin + '"/>' +
      '<path d="M6.2 9.4a5.8 5.8 0 0 1 11.6 0z" fill="' + a.helmet + '"/>' +
      '<rect x="5.4" y="9" width="13.2" height="1.6" rx="0.8" fill="' + a.helmet + '"/>' +
      '<path d="M4.5 21c1-4 4-5.6 7.5-5.6s6.5 1.6 7.5 5.6z" fill="' + a.vest + '"/>' +
      "</svg>";
  }
  var CAT_LABEL = {
    fire: STRINGS.catFire, vehicle: STRINGS.catVehicle, house: STRINGS.catHouse,
    stack: STRINGS.catStack, height: STRINGS.catHeight
  };
  function esc(s) {
    return String(s).replace(/[<>&\"']/g, "");
  }

  /* ---------- static text ---------- */
  $("btnPortal").textContent = STRINGS.dashBackPortal;
  $("btnPlay").textContent = STRINGS.dashPlay;
  $("btnExport").textContent = STRINGS.dashExport;
  $("btnImport").textContent = STRINGS.dashImport;
  $("btnOut").textContent = STRINGS.dashLogout;
  $("nlTitle").textContent = STRINGS.dashNeedLogin;
  $("nlFine").textContent = STRINGS.dashNeedLoginFine;
  $("nlBtn").textContent = STRINGS.dashBackPortal;
  /* Wired before the session gate on purpose: the topbar exists on every
     view of this page, including the "log in" panel, so the way back to
     the portal must never depend on being logged in. */
  $("btnPortal").addEventListener("click", function () {
    window.location.href = "index.html";
  });
  $("privacyLine").textContent = STRINGS.privacyLine;
  $("weakTitle").textContent = STRINGS.weakTitle;
  $("recentTitle").textContent = STRINGS.dashRecentTitle;
  $("deTitle").textContent = STRINGS.dashEmptyTitle;
  $("deFine").textContent = STRINGS.dashEmptyFine;
  $("deBtn").textContent = STRINGS.dashBackPortal;

  /* ---------- session gate ---------- */
  var uid = null;
  try { uid = SSStore.session.get(); } catch (e) { uid = null; }
  var user = uid ? SSStore.users.get(uid) : null;
  if (!user) {
    $("needLogin").classList.remove("hidden");
    return;
  }

  $("dashMain").classList.remove("hidden");
  $("dashAv").innerHTML = avatarSvg(AVATARS[user.avatar] || AVATARS[0], 56);
  $("dashName").textContent = user.name;
  $("dashSince").textContent = "@" + user.username +
    (user.email ? " · " + user.email : "") + " · " +
    (AVATARS[user.avatar] || AVATARS[0]).role +
    (user.companyName ? " · " + user.companyName : "");

  function boot(records) {
    var stats = SSDash.calc(records, HAZARDS);

    /* 16.2: the empty state is only for LOCAL accounts with no rounds. A
       signed-in account always gets the real dashboard - even on day one
       its company board may already hold teammates' scores, and the 1v1
       card is how it issues its first challenge. Hiding the body here used
       to lock brand-new teammates out of both features. */
    var liveAccount = user.remote && typeof SSNet !== "undefined" && SSNet.token && SSNet.token();
    if (!stats.rounds && !liveAccount) {
      $("dashEmpty").classList.remove("hidden");
      $("dashBody").classList.add("hidden");
      wireActions();
      return;
    }

    /* ---------- four headline numbers ---------- */
    function tile(value, label) {
      return '<div class="dash-tile"><b>' + esc(value) + "</b><span>" + esc(label) + "</span></div>";
    }
    $("tiles").innerHTML =
      tile(stats.rounds, STRINGS.tRounds) +
      tile(stats.best, STRINGS.tBest) +
      tile(stats.avgScore, STRINGS.tAvg) +
      tile(stats.quizPct === null ? "-" : stats.quizPct + "%", STRINGS.tQuiz);

    /* ---------- one focus line: the weakest category ---------- */
    (function () {
      var worst = null;
      SSDash.CAT_KEYS.forEach(function (k) {
        var b = stats.byCategory[k];
        if (!b || !b.encounters) { return; }
        if (!worst || b.pct < worst.pct) { worst = { key: k, pct: b.pct }; }
      });
      $("weakBox").textContent = worst
        ? CAT_LABEL[worst.key] + " - " + worst.pct + "% " + STRINGS.weakTail
        : STRINGS.weakNone;
    })();

    /* ---------- recent rounds (last eight, newest first) ---------- */
    function modeLabel(m) {
      return m === "attack" ? STRINGS.modeAttackTitle : STRINGS.modeTrainingTitle;
    }
    function diffLabel(d) {
      return CONFIG.difficulties[d] ? CONFIG.difficulties[d].label : d;
    }
    (function () {
      var html = '<table class="board recent"><thead><tr>' +
        "<th>" + esc(STRINGS.thDate) + "</th><th>" + esc(STRINGS.thMode) + "</th><th>" +
        esc(STRINGS.thDiff) + "</th><th>" + esc(STRINGS.thScore) + "</th><th>" +
        esc(STRINGS.thFound) + "</th><th>" + esc(STRINGS.thQuiz) + "</th></tr></thead><tbody>";
      stats.recent.slice(0, 8).forEach(function (r) {
        html += "<tr><td>" + esc(new Date(r.date).toLocaleDateString()) +
          "</td><td>" + esc(modeLabel(r.mode)) +
          "</td><td>" + esc(diffLabel(r.diff)) +
          '</td><td><b>' + esc(r.score) + "</b></td><td>" +
          esc(r.found + " / " + (r.total || HAZARDS.length)) + "</td><td>" +
          esc((r.quiz && r.quiz.length)
            ? r.quiz.filter(function (q) { return q.right; }).length + "/" + r.quiz.length
            : "-") +
          "</td></tr>";
      });
      $("recentBox").innerHTML = html + "</tbody></table>";
    })();

    /* ---------- Phase 15: high-score board ----------
       Local rows render instantly; a company account then folds in the
       server's company board. The catch is deliberately quiet: the local
       board is already on screen, and a dead backend must never blank it. */
    (function leaderboard() {
      var local = [];
      try { local = SSStore.scores.list(); } catch (e) { /* blocked storage */ }

      function paint(rows, cloud) {
        var board = SSDash.bestByPlayer(rows);
        $("lbTitle").textContent = STRINGS.dashLbTitle;
        $("lbFine").textContent = cloud ? STRINGS.dashLbFineCloud : STRINGS.dashLbFineLocal;
        if (!board.length) {
          $("lbBox").innerHTML = '<p class="fine">' + esc(STRINGS.dashLbNone) + "</p>";
          $("lbYou").textContent = STRINGS.dashLbNotYet;
          return;
        }
        function isMe(r) {
          return (user.id && r.uid === user.id) ||
            String(r.name || "").toLowerCase() === String(user.name || "").toLowerCase();
        }
        var html = '<table class="board"><thead><tr>' +
          "<th>" + esc(STRINGS.dashLbThRank) + "</th><th>" + esc(STRINGS.dashLbThPlayer) +
          "</th><th>" + esc(STRINGS.thDiff) + "</th><th>" + esc(STRINGS.thScore) +
          "</th><th>" + esc(STRINGS.thFound) + "</th></tr></thead><tbody>";
        board.slice(0, 25).forEach(function (r, i) {
          var av = AVATARS[r.avatar] || AVATARS[0];
          html += '<tr' + (isMe(r) ? ' class="lb-me"' : "") + "><td>" + (i + 1) +
            '</td><td><span class="lb-av">' + avatarSvg(av, 22) + "</span> " +
            esc(r.name || "?") + (isMe(r) ? ' <span class="lb-you">' + esc(STRINGS.dashLbYou) + "</span>" : "") +
            "</td><td>" + esc(diffLabel(r.diff)) +
            '</td><td><b>' + esc(r.score) + "</b></td><td>" +
            esc((r.found !== undefined ? r.found : "-") + " / " + HAZARDS.length) +
            "</td></tr>";
        });
        $("lbBox").innerHTML = html + "</tbody></table>";
        var rank = -1;
        board.forEach(function (r, i) { if (rank < 0 && isMe(r)) { rank = i; } });
        $("lbYou").textContent = rank >= 0
          ? STRINGS.dashLbBestLine
              .replace("{score}", board[rank].score)
              .replace("{rank}", rank + 1)
              .replace("{n}", board.length)
          : STRINGS.dashLbNotYet;
      }

      paint(local, false);
      if (user.remote && typeof SSNet !== "undefined" && SSNet.token && SSNet.token()) {
        SSNet.companyBoard().then(function (j) {
          paint((j && j.scores ? j.scores : []).concat(local), true);
        }).catch(function () { /* local board stands */ });
      }
    })();

    /* ---------- Phase 16: 1v1 challenge ----------
       A duel lives on the server, so the card only comes alive for a
       signed-in account. Create a challenge (pick a difficulty), get a
       code, play your side; or paste a teammate's code and play theirs. */
    (function duels() {
      $("duelTitle").textContent = STRINGS.duelCardTitle;
      var live = user.remote && typeof SSNet !== "undefined" && SSNet.token && SSNet.token();
      if (!live) {
        $("duelFine").textContent = STRINGS.duelNeedLogin;
        return;
      }
      $("duelFine").textContent = STRINGS.duelCardFine;
      $("duelBody").classList.remove("hidden");

      Object.keys(CONFIG.difficulties).forEach(function (k) {
        var o = document.createElement("option");
        o.value = k;
        o.textContent = CONFIG.difficulties[k].label;
        $("duelDiff").appendChild(o);
      });
      $("duelDiff").value = "standard";
      $("duelStartTitle").textContent = STRINGS.duelStartTitle;
      $("duelJoinTitle").textContent = STRINGS.duelJoinTitle;
      $("duelCreate").textContent = STRINGS.duelCreateBtn;
      $("duelJoin").textContent = STRINGS.duelJoinBtn;
      $("duelCodeLabel").textContent = STRINGS.duelYourCode;
      $("duelCopy").textContent = STRINGS.duelCopy;
      $("duelPlayMine").textContent = STRINGS.duelPlayMine;
      $("duelMineTitle").textContent = STRINGS.duelMineTitle;

      function say(text) {
        $("duelMsg").textContent = text || "";
        $("duelMsg").classList.toggle("hidden", !text);
      }
      function showCode(code) {
        $("duelCodeOut").value = code;
        $("duelCodeRow").classList.remove("hidden");
        $("duelPlayMine").href = "game.html?duel=" + encodeURIComponent(code) +
          "&name=" + encodeURIComponent(user.name) +
          "&avatar=" + encodeURIComponent(user.avatar || 0) +
          (user.id ? "&uid=" + encodeURIComponent(user.id) : "");
        $("duelPlayRow").classList.remove("hidden");
      }
      /* click the code field: the whole code selects, so Ctrl+C always
         works regardless of clipboard permissions (16.3) */
      $("duelCodeOut").addEventListener("click", function () { $("duelCodeOut").select(); });
      $("duelCreate").addEventListener("click", function () {
        say("");
        SSNet.duels.create($("duelDiff").value).then(function (j) {
          if (j && j.duel) { showCode(j.duel.code); }
          listMine();
        }).catch(function () { say(STRINGS.duelGone); });
      });
      $("duelJoin").addEventListener("click", function () {
        var code = $("duelCodeIn").value.trim().toUpperCase();
        if (!code) { return; }
        say("");
        SSNet.duels.get(code).then(function (j) {
          if (j && j.duel) { showCode(j.duel.code); }
          else { say(STRINGS.duelBadCode); }
        }).catch(function (e) {
          say(e && e.why === "none" ? STRINGS.duelBadCode : STRINGS.duelGone);
        });
      });
      $("duelCopy").addEventListener("click", function () {
        var input = $("duelCodeOut");
        function flash(ok) {
          $("duelCopy").textContent = ok ? STRINGS.duelCopied : STRINGS.duelCopyFail;
          setTimeout(function () { $("duelCopy").textContent = STRINGS.duelCopy; }, 2600);
        }
        function selectIt() { input.focus(); input.select(); }
        /* 16.5: legacy fallback for browsers/contexts without the async
           Clipboard API — select + execCommand("copy"). Same rule as the
           admin invite code: never claim success without a real write. */
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

      function listMine() {
        SSNet.duels.mine().then(function (j) {
          var rows = (j && j.duels) || [];
          if (!rows.length) { $("duelListBox").innerHTML = ""; return; }
          var html = '<table class="board"><thead><tr><th>' + esc(STRINGS.duelThCode) +
            "</th><th>" + esc(STRINGS.duelThAgainst) + "</th><th>" +
            esc(STRINGS.duelThResult) + "</th></tr></thead><tbody>";
          rows.forEach(function (d) {
            var me = null, them = null;
            (d.entries || []).forEach(function (e) {
              if (String(e.uid) === String(user.id)) { me = e; } else { them = e; }
            });
            var result;
            if (!me) { result = esc(STRINGS.duelWaitingOpp); }
            else if (!them) { result = esc(STRINGS.duelWaiting); }
            else if (me.score > them.score) { result = "<b>" + esc(STRINGS.duelWon) + "</b> " + esc(me.score + " - " + them.score); }
            else if (me.score < them.score) { result = esc(STRINGS.duelLost) + " " + esc(me.score + " - " + them.score); }
            else { result = esc(STRINGS.duelDrew) + " " + esc(me.score + " - " + them.score); }
            html += "<tr><td>" + esc(d.code) + "</td><td>" +
              esc(them ? them.name : STRINGS.duelWaitingOpp) + "</td><td>" + result + "</td></tr>";
          });
          $("duelListBox").innerHTML = html + "</tbody></table>";
        }).catch(function () { /* the list is a nicety, not the feature */ });
      }
      listMine();
    })();

    /* ---------- export / import / logout ---------- */
    function wireActions() {
      $("btnOut").addEventListener("click", function () {
        /* 16.4: match the portal's sign-out - the cloud token must die with
           the session, or the next learner's rounds on this device get
           attached to the previous account on the server. */
        if (typeof SSNet !== "undefined" && SSNet.setToken) { SSNet.setToken(null); }
        SSStore.session.clear();
        window.location.href = "login.html";
      });
      $("btnExport").addEventListener("click", function () {
        var text = SSStore.records.exportJSON(uid);
        var blob = new Blob([text], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "spotsafe360_" + user.username +
          "_" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
      });
      var fileIn = $("importFile");
      $("btnImport").addEventListener("click", function () { fileIn.click(); });
      fileIn.addEventListener("change", function () {
        var f = fileIn.files && fileIn.files[0];
        if (!f) { return; }
        var reader = new FileReader();
        reader.onload = function () {
          var res = SSStore.records.importJSON(uid, String(reader.result));
          if (res.error) { alert(STRINGS.dashImportBad); return; }
          alert(STRINGS.dashImportDone + res.added + STRINGS.dashImportAdded +
            " · " + res.skipped + STRINGS.dashImportSkipped);
          window.location.reload();
        };
        reader.readAsText(f);
        fileIn.value = "";
      });
    }
    /* 16.4: the wired dashboard's actions used to be attached ONLY on the
       empty-state path, so Logout/Export/Import were dead buttons on every
       dashboard that actually had something on it. */
    wireActions();
  }

  /* Phase 10: a cloud account's history lives on the server - fetch it,
     and fall back to this device's copy when the backend is unreachable. */
  if (user.remote && typeof SSNet !== "undefined" && SSNet.token()) {
    SSNet.records().then(function (j) {
      boot(j && j.records ? j.records : SSStore.records.list(uid));
    }).catch(function (e) {
      /* Phase 10.2: a dead/expired token is dropped so the next visit asks
         for a fresh sign-in instead of quietly showing an empty dashboard. */
      if (e && e.why === "login" && SSNet.setToken) { SSNet.setToken(null); }
      boot(SSStore.records.list(uid));
    });
  } else {
    boot(SSStore.records.list(uid));
  }
})();
