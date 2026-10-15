/* SpotSafe 360 - gate.js (Phase 9.5). The single session gate.
   Loaded on every page except login.html, right after store.js:

     <script src="js/gate.js"></script>                 any session (user or guest)
     <script src="js/gate.js" data-requires="user"></script>   real profile only

   With no (good) session the page redirects to login.html. The target is also
   stamped on <html data-redirect="..."> BEFORE the navigation so the jsdom
   suite can assert the gate fired (jsdom itself never navigates). */
(function () {
  "use strict";
  var requiresUser = false;
  try {
    requiresUser = document.currentScript &&
      document.currentScript.getAttribute("data-requires") === "user";
  } catch (e) { /* ancient browser: fall through to "any" */ }

  var token = null;
  try { token = SSStore.session.get(); } catch (e) { token = null; }

  var allowed = false;
  if (token) {
    if (requiresUser) {
      try { allowed = !!SSStore.users.get(token); } catch (e) { allowed = false; }
    } else {
      allowed = true;
    }
  }

  if (!allowed) {
    document.documentElement.setAttribute("data-redirect", "login.html");
    try { window.location.replace("login.html"); } catch (e) { /* jsdom no-op */ }
  }
})();
