/*!
 * lm-countdown.js — Landmark guest discount countdown
 * ---------------------------------------------------------------------------
 * Ontraport's Custom HTML filter rejects inline scripts containing setInterval
 * or addEventListener ("Some of the custom html seems suspicious and cannot be
 * saved"). It accepts an external <script src> without complaint, which is how
 * lm-price-window.js already loads. So everything lives here and the page only
 * needs one empty div.
 *
 * PASTE INTO THE PAGE (Custom HTML element, inside the discount block):
 *     <div id="lm-countdown"></div>
 *
 * LOAD IN THE FOOTER, after lm-price-window.js:
 *     <script src="https://arnold-blip.github.io/lm-scripts/lm-countdown.js?v=1"></script>
 *
 * Takes its deadline from lm-price-window.js when present, so the clock and the
 * price can never disagree. If the engine says full price, this never shows.
 * Falls back to the merge feed, then ?e=. Hides itself completely if there is
 * no valid future date — it can never show a dead or negative clock.
 *
 * Styles are injected from here too, so nothing else needs pasting.
 */
(function (global) {
  'use strict';

  var CONFIG = {
    mountId:        'lm-countdown',
    label:          'Your discount ends in',
    urgentHours:    24,      // switch to the urgent palette inside this many hours
    waitForEngineMs: 4000,   // how long to wait for lm-price-window.js before going it alone
    feedId:         'lm-cd-feed',
    urlParam:       'e'
  };

  var CSS =
    '#lm-countdown{display:none;font-family:"objektiv-mk1",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0 0 22px}' +
    '#lm-countdown.lm-cd-on{display:block}' +
    '.lm-cd-card{border:1px solid #d9e6dc;border-left:4px solid #2dae0e;border-radius:8px;background:#f4faf3;padding:14px 16px;text-align:center}' +
    '.lm-cd-label{display:block;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#217a00;margin-bottom:10px}' +
    '.lm-cd-tiles{display:flex;justify-content:center;gap:8px}' +
    '.lm-cd-tile{min-width:58px;background:#0d2d31;border-radius:6px;padding:8px 6px 6px}' +
    '.lm-cd-num{display:block;font-size:24px;font-weight:700;line-height:1.05;color:#fff;font-variant-numeric:tabular-nums}' +
    '.lm-cd-unit{display:block;font-size:9.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#9fc0c2;margin-top:3px}' +
    '.lm-cd-ends{display:block;margin-top:9px;font-size:12px;color:#5b6f71}' +
    '#lm-countdown.lm-cd-urgent .lm-cd-card{border-left-color:#f06449;background:#fef5f3;border-color:#f6d9d2}' +
    '#lm-countdown.lm-cd-urgent .lm-cd-label{color:#c2412a}' +
    '#lm-countdown.lm-cd-urgent .lm-cd-tile{background:#f06449}' +
    '#lm-countdown.lm-cd-urgent .lm-cd-unit{color:#ffe2db}' +
    '@media (max-width:420px){.lm-cd-tile{min-width:48px}.lm-cd-num{font-size:20px}}';

  var mount = null, timer = null, started = false;

  function injectCss() {
    if (document.getElementById('lm-cd-css')) return;
    var s = document.createElement('style');
    s.id = 'lm-cd-css';
    s.appendChild(document.createTextNode(CSS));
    (document.head || document.documentElement).appendChild(s);
  }

  // Same normalisation rules as lm-price-window.js: strip Ontraport's comma
  // formatting, reject unresolved merge tokens, accept seconds or milliseconds.
  function normalise(raw) {
    if (raw === null || raw === undefined) return null;
    var s = String(raw).trim();
    if (!s || s.indexOf('[') !== -1 || s.indexOf('##') !== -1) return null;
    var d = s.replace(/[^0-9]/g, '');
    if (!d) return null;
    var n = Number(d);
    if (!isFinite(n) || n <= 0) return null;
    if (d.length === 13) return n;
    if (d.length === 10) return n * 1000;
    return null;
  }

  function qs(name) {
    try { return new URLSearchParams(global.location.search).get(name); }
    catch (e) { return null; }
  }

  function fromEngine() {
    var w = global.LMPriceWindow;
    if (!w || !w.state || !w.state.ready) return undefined;   // not settled yet
    if (!w.state.inWindow) return null;                        // full price — stay hidden
    return w.state.expiry || null;
  }

  function fromPage() {
    var feed = document.getElementById(CONFIG.feedId);
    if (feed) {
      var el = feed.querySelector('[data-lm-expiry]') || feed;
      var ms = normalise(el.textContent);
      if (ms) return ms;
    }
    return normalise(qs(CONFIG.urlParam));
  }

  function two(n) { return n < 10 ? '0' + n : String(n); }

  function endsLabel(ms) {
    try {
      return new Date(ms).toLocaleString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
    } catch (e) { return ''; }
  }

  function hide() {
    if (timer) { clearInterval(timer); timer = null; }
    if (mount) { mount.className = ''; mount.innerHTML = ''; }
  }

  function paint(deadline) {
    var left = deadline - Date.now();

    if (left <= 0) {                 // expired while they sat here
      hide();
      var w = global.LMPriceWindow;
      if (w && w.refresh) w.refresh();   // let the engine swap to full price
      return;
    }

    var secs = Math.floor(left / 1000);
    var d = Math.floor(secs / 86400);
    var h = Math.floor((secs % 86400) / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;

    var tiles = '';
    if (d > 0) tiles += tile(d, d === 1 ? 'Day' : 'Days');
    tiles += tile(two(h), 'Hrs') + tile(two(m), 'Min') + tile(two(s), 'Sec');

    mount.innerHTML =
      '<div class="lm-cd-card">' +
        '<span class="lm-cd-label">' + CONFIG.label + '</span>' +
        '<div class="lm-cd-tiles">' + tiles + '</div>' +
        '<span class="lm-cd-ends">Ends ' + endsLabel(deadline) + '</span>' +
      '</div>';

    mount.className = 'lm-cd-on' +
      (left <= CONFIG.urgentHours * 3600000 ? ' lm-cd-urgent' : '');
  }

  function tile(v, unit) {
    return '<span class="lm-cd-tile"><span class="lm-cd-num">' + v +
           '</span><span class="lm-cd-unit">' + unit + '</span></span>';
  }

  function start(deadline) {
    if (timer) clearInterval(timer);
    paint(deadline);
    timer = setInterval(function () { paint(deadline); }, 1000);
    started = true;
  }

  function boot() {
    mount = document.getElementById(CONFIG.mountId);
    if (!mount) return;
    injectCss();

    var waited = 0;
    var poll = setInterval(function () {
      var e = fromEngine();

      if (e === undefined) {           // engine present but not settled
        waited += 200;
        if (waited >= CONFIG.waitForEngineMs) {
          clearInterval(poll);
          var fb = fromPage();
          if (fb && fb > Date.now()) start(fb); else hide();
        }
        return;
      }

      clearInterval(poll);
      if (e && e > Date.now()) start(e); else hide();
    }, 200);

    // Returning from a backgrounded tab: correct straight away rather than
    // waiting up to a second for the next tick.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && started && timer) {
        var w = global.LMPriceWindow;
        var e = (w && w.state && w.state.expiry) || null;
        if (e) paint(e);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
