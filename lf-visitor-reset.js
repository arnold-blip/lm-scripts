/* lf-visitor-reset.js
 * Couple / same-browser checkout fix (EXPERIMENTAL — test a real payment first).
 *
 * Clears ONLY the Ontraport visitor->contact identity cookie (_vcid) so a second
 * buyer on the same browser is treated as a fresh, anonymous visitor and the
 * checkout matches by their TYPED email instead of merging into the previous
 * buyer's contact.
 *
 * IMPORTANT: it deliberately does NOT touch the mopsbbk / mopbelg session tokens,
 * because Ontraport form POSTs need those — clearing them can silently break the
 * charge. If a test payment ever fails after adding this, remove it immediately.
 *
 * Placement: HEADER of the CHECKOUT / launch page (Step 01), as HIGH as possible
 * (ideally above Ontraport's own tracking snippet). NOT the success/Step-03 page.
 */
(function () {
  // Only the identity cookie(s). Do NOT add mops*/mopbelg/mopsbbk here.
  var IDENTITY = /^_vcid$/i;

  function clearIdentity() {
    var host = location.hostname;
    var root = host.split('.').slice(-2).join('.');
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (!name || !IDENTITY.test(name)) return;
      ['', '; domain=' + host, '; domain=.' + root].forEach(function (scope) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + scope;
      });
    });
  }

  // Clear immediately, then a few more times early in case Ontraport's tracking
  // snippet re-sets it during page load.
  clearIdentity();
  [50, 150, 400, 800, 1500].forEach(function (t) { setTimeout(clearIdentity, t); });
})();
