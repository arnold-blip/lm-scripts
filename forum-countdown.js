/* Forum Journey countdown
   Counts down to the Forum start: Fri, Aug 14, 2026, 9:00 AM Pacific.
   Handles OP quirks: multiple duplicated responsive copies of the card,
   and late/async block rendering. Init-once guarded. */
(function () {
  // Aug 14, 2026, 9:00 AM Pacific (PDT = UTC-7) = 16:00 UTC.
  // Month is zero-based, so 7 = August.
  var eventStart = Date.UTC(2026, 7, 14, 16, 0, 0);

  function setAll(id, value) {
    // Attribute selector catches every duplicated copy OP renders,
    // even though duplicate IDs are technically invalid.
    var nodes = document.querySelectorAll('[id="' + id + '"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = value;
    }
  }

  function tick() {
    var diff = eventStart - Date.now();
    if (diff < 0) diff = 0;
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    setAll('cd-d', days);
    setAll('cd-h', hours);
    setAll('cd-m', mins);
  }

  function hasTargets() {
    return document.querySelector('[id="cd-d"]') !== null;
  }

  function start() {
    if (window.__fjCountdownStarted) return;
    if (!hasTargets()) return;
    window.__fjCountdownStarted = true;
    tick();
    setInterval(tick, 1000);
  }

  // Try on DOM ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Retry for a few seconds in case the OP block renders late.
  var tries = 0;
  var retry = setInterval(function () {
    tries++;
    start();
    if (window.__fjCountdownStarted || tries > 40) clearInterval(retry);
  }, 250);

  // Watch for async block insertion, then stop once started.
  if (window.MutationObserver) {
    var mo = new MutationObserver(function () {
      if (!window.__fjCountdownStarted) start();
      else mo.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
