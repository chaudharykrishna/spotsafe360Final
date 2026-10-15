/* Loaded before everything else on the game page. Collects the reason the
   engine script fails, if it fails: a blocked or failed load, or a crash while
   running. The banner logic in app.js reads this and names the exact cause. */
window.__ssErrors = [];
window.addEventListener("error", function (e) {
  var t = e && e.target;
  if (t && t !== window && (t.src || t.href)) {
    window.__ssErrors.push("load-failed: " + (t.src || t.href));
  } else if (e && e.filename) {
    window.__ssErrors.push("script-error: " + (e.message || "unknown") + " in " + e.filename + " line " + (e.lineno || 0));
  }
}, true);
