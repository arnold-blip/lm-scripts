/*!
 * lm-price-window.js — Landmark discount-window price display (coupon-free)
 * ---------------------------------------------------------------------------
 * Replaces coupon codes on the Guest Forum and Advanced Course checkouts.
 *
 * Decides ONE thing: is this contact still inside their discount window?
 *   inside  -> show the discount price block + arm the [Guest Discount] order form
 *   outside -> show the full price block   + arm the [Guest Full]     order form
 *
 * The value it decides on comes from, in priority order:
 *   1. an Ontraport merge feed  (#lm-window-feed [data-lm-expiry])   <- server truth
 *   2. the URL param ?e=<unix>                                       <- legacy email links
 *   3. nothing                                                       <- treated as EXPIRED
 *
 * FAIL-SAFE RULE: anything unexpected resolves to FULL PRICE. A bug must never
 * hand out a discount; the worst case is a guest seeing full price and emailing
 * support, which is recoverable. The reverse is not.
 *
 * Exposes window.LMPriceWindow  -> .state, .refresh(), .init(cfg)
 * Debug overlay: add ?lmdebug=1 to any URL.
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  var DEFAULTS = {
    // --- element hooks (paste these ids/attrs into the OP page) ---
    discountPriceId: 'lm-price-discount',
    fullPriceId:     'lm-price-full',
    feedId:          'lm-window-feed',

    // Order-form blocks are found by a marker placed INSIDE the block:
    //   <div data-lm-form="discount"></div>   /   <div data-lm-form="full"></div>
    // or by a CSS class on the block row: .lm-block-discount / .lm-block-full
    formMarkerAttr:  'data-lm-form',
    discountBlockClass: 'lm-block-discount',
    fullBlockClass:     'lm-block-full',

    // --- behaviour ---
    urlParam:  'e',      // legacy ?e=<unix ms>
    graceMs:   0,        // extra slack after expiry, if Tobin ever wants a buffer
    endOfDay:  false,    // true = compare against end of the expiry's calendar day
    timeZone:  'America/Los_Angeles', // only used when endOfDay is true
    allowUrlFallback: true,   // set false once every contact has the field populated
    hardRemoveInactiveForm: false, // true = rip the inactive form out of the DOM

    // --- render resilience (Ontraport paints the order form asynchronously) ---
    retries: [0, 150, 400, 800, 1500, 2500, 4000, 6000],
    observeMs: 9000
  };

  var cfg = null;
  var state = {
    version: VERSION,
    ready: false,
    inWindow: false,
    expiry: null,        // normalised unix ms, or null
    source: 'none',      // 'feed' | 'url' | 'none'
    raw: null,
    reason: '',
    formsFound: { discount: false, full: false },
    blocksFound: { discount: false, full: false }
  };

  /* ---------------------------------------------------------------- utils */

  function qs(name) {
    try {
      return new URLSearchParams(global.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  // Ontraport leaks unresolved merge tokens literally, e.g. "[Contact//LF Guest
  // Discount End (ms)]" or "...##jsonescape". Numeric fields also arrive comma
  // formatted, and parseInt("1,786,374,780,000") returns 1 — which would read as
  // 1970 and silently expire everyone. Strip to digits and validate length.
  function normaliseExpiry(rawValue) {
    if (rawValue === null || rawValue === undefined) return null;
    var raw = String(rawValue).trim();
    if (!raw) return null;
    if (raw.indexOf('[') !== -1 || raw.indexOf('##') !== -1) return null; // unresolved token

    var digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return null;

    var n = Number(digits);
    if (!isFinite(n) || n <= 0) return null;

    // 13 digits = milliseconds, 10 digits = seconds. Anything else is not a date.
    if (digits.length === 13) return n;
    if (digits.length === 10) return n * 1000;
    return null;
  }

  // Optional calendar-day semantics: "on or before the expiry DATE" rather than
  // "before the expiry INSTANT". Off by default — see the note in the handover.
  function endOfDayMs(ms) {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: cfg.timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date(ms));
      var get = function (t) {
        for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value;
        return null;
      };
      var dayStart = new Date(get('year') + '-' + get('month') + '-' + get('day') + 'T00:00:00Z').getTime();
      // Recover the zone offset at that moment, then push to 23:59:59.999 local.
      var offset = ms - dayStart;
      var wholeDay = 24 * 60 * 60 * 1000;
      return ms - offset + wholeDay - 1;
    } catch (e) {
      return ms;
    }
  }

  /* ------------------------------------------------------------ resolving */

  function readFeed() {
    var feed = document.getElementById(cfg.feedId);
    if (!feed) return null;
    var el = feed.querySelector('[data-lm-expiry]');
    if (!el) return null;
    // The merge value is the element's TEXT — Ontraport resolves merge fields in
    // text content, never inside attributes.
    var raw = el.textContent;
    var ms = normaliseExpiry(raw);
    return { raw: raw, ms: ms };
  }

  function resolveExpiry() {
    var feed = readFeed();
    if (feed && feed.ms) {
      state.source = 'feed';
      state.raw = feed.raw;
      return feed.ms;
    }
    // A feed that exists but did not resolve is a REAL condition, not a missing
    // one — record it so the overlay can tell the two apart.
    if (feed && !feed.ms) {
      state.raw = feed.raw;
      state.reason = 'merge feed present but unresolved/empty';
    }

    if (cfg.allowUrlFallback) {
      var urlRaw = qs(cfg.urlParam);
      var urlMs = normaliseExpiry(urlRaw);
      if (urlMs) {
        state.source = 'url';
        state.raw = urlRaw;
        return urlMs;
      }
    }

    state.source = 'none';
    if (!state.reason) state.reason = 'no expiry value available';
    return null;
  }

  function decide() {
    var expiry = resolveExpiry();
    state.expiry = expiry;

    if (!expiry) {
      state.inWindow = false;
      return false;
    }

    var deadline = cfg.endOfDay ? endOfDayMs(expiry) : expiry;
    deadline += cfg.graceMs;

    var now = Date.now();
    state.inWindow = now <= deadline;
    state.reason = state.inWindow
      ? 'inside window (' + Math.round((deadline - now) / 3600000) + 'h remaining)'
      : 'window closed (' + Math.round((now - deadline) / 3600000) + 'h ago)';
    return state.inWindow;
  }

  /* --------------------------------------------------------------- blocks */

  function findFormBlock(kind) {
    // 1) marker element inside the block
    var marker = document.querySelector('[' + cfg.formMarkerAttr + '="' + kind + '"]');
    if (marker) {
      var form = marker.closest('form[opt-type="block-v3"]') || marker.closest('form') ||
                 marker.closest('.opt-row');
      if (form) return form;
    }
    // 2) CSS class applied to the block row in the OP builder
    var cls = kind === 'discount' ? cfg.discountBlockClass : cfg.fullBlockClass;
    var byClass = document.querySelector('form.' + cls) || document.querySelector('.' + cls);
    if (byClass) {
      return byClass.matches('form') ? byClass : (byClass.closest('form') || byClass);
    }
    return null;
  }

  function setControlsDisabled(root, disabled) {
    var controls = root.querySelectorAll('input, select, textarea, button');
    for (var i = 0; i < controls.length; i++) {
      var el = controls[i];

      // Leave Ontraport's Stripe payment element alone. Disabling controls inside
      // it can break OP's own initialisation, and a hidden + submit-blocked form
      // is already unsubmittable.
      if (el.closest('[opt-type="stripe-payment-element"]')) continue;

      if (disabled) {
        if (!el.hasAttribute('data-lm-prev-disabled')) {
          el.setAttribute('data-lm-prev-disabled', el.disabled ? '1' : '0');
        }
        el.disabled = true;
      } else if (el.hasAttribute('data-lm-prev-disabled')) {
        el.disabled = el.getAttribute('data-lm-prev-disabled') === '1';
        el.removeAttribute('data-lm-prev-disabled');
      }
    }
  }

  function armForm(form, active) {
    if (!form) return;

    if (!active && cfg.hardRemoveInactiveForm) {
      if (form.parentNode) form.parentNode.removeChild(form);
      return;
    }

    form.style.display = active ? '' : 'none';
    form.setAttribute('aria-hidden', active ? 'false' : 'true');
    form.setAttribute('data-lm-armed', active ? '1' : '0');
    setControlsDisabled(form, !active);

    // Belt and braces: a disabled control cannot submit, but an inactive form
    // must not submit even if something re-enables it.
    if (!form.hasAttribute('data-lm-guarded')) {
      form.setAttribute('data-lm-guarded', '1');
      form.addEventListener('submit', function (ev) {
        if (form.getAttribute('data-lm-armed') === '0') {
          ev.preventDefault();
          ev.stopPropagation();
          return false;
        }
      }, true);
    }
  }

  function show(el, visible) {
    if (!el) return;
    el.style.display = visible ? '' : 'none';
  }

  /* --------------------------------------------------------------- render */

  function apply() {
    var inWindow = decide();

    var discountPrice = document.getElementById(cfg.discountPriceId);
    var fullPrice     = document.getElementById(cfg.fullPriceId);
    state.blocksFound.discount = !!discountPrice;
    state.blocksFound.full     = !!fullPrice;

    // Fail-safe: if the full-price block is missing we cannot fall back to it, so
    // hide the discount rather than show an unpriced page.
    show(discountPrice, inWindow);
    show(fullPrice, !inWindow);

    var discountForm = findFormBlock('discount');
    var fullForm     = findFormBlock('full');
    state.formsFound.discount = !!discountForm;
    state.formsFound.full     = !!fullForm;

    // Only arm forms when BOTH exist. On a single-form page (today's live setup)
    // we must not disable the only checkout on the page.
    if (discountForm && fullForm) {
      armForm(discountForm, inWindow);
      armForm(fullForm, !inWindow);
    }

    state.ready = true;
    renderDebug();
    return state;
  }

  /* ---------------------------------------------------------------- debug */

  function renderDebug() {
    if (qs('lmdebug') !== '1') return;
    var box = document.getElementById('lm-price-window-debug');
    if (!box) {
      box = document.createElement('div');
      box.id = 'lm-price-window-debug';
      box.style.cssText = 'position:fixed;z-index:99999;left:12px;bottom:12px;max-width:360px;' +
        'font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;background:#0d2d31;color:#fff;' +
        'padding:12px 14px;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.35);white-space:pre-wrap;';
      document.body.appendChild(box);
    }
    box.textContent =
      'lm-price-window v' + VERSION + '\n' +
      'decision : ' + (state.inWindow ? 'DISCOUNT' : 'FULL PRICE') + '\n' +
      'reason   : ' + state.reason + '\n' +
      'source   : ' + state.source + '\n' +
      'raw      : ' + (state.raw === null ? '(none)' : JSON.stringify(state.raw)) + '\n' +
      'expiry   : ' + (state.expiry ? new Date(state.expiry).toISOString() : '(none)') + '\n' +
      'now      : ' + new Date().toISOString() + '\n' +
      'blocks   : discount=' + state.blocksFound.discount + ' full=' + state.blocksFound.full + '\n' +
      'forms    : discount=' + state.formsFound.discount + ' full=' + state.formsFound.full;
  }

  /* ----------------------------------------------------------------- boot */

  function init(userCfg) {
    cfg = {};
    for (var k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) cfg[k] = DEFAULTS[k];
    if (userCfg) for (var j in userCfg) if (userCfg.hasOwnProperty(j)) cfg[j] = userCfg[j];

    apply();

    // Ontraport injects the order form after first paint, so re-apply on a decay
    // schedule and while the DOM is still settling.
    cfg.retries.forEach(function (t) { if (t > 0) setTimeout(apply, t); });

    if (global.MutationObserver && document.body) {
      var observer = new MutationObserver(function () { apply(); });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { observer.disconnect(); }, cfg.observeMs);
    }

    return state;
  }

  global.LMPriceWindow = {
    version: VERSION,
    init: init,
    refresh: function () { return apply(); },
    get state() { return state; },
    // exposed for the siloed experiment / unit checks
    _normaliseExpiry: normaliseExpiry
  };

  // Auto-boot with defaults unless the page opted out before loading the script.
  if (!global.LM_PRICE_WINDOW_MANUAL_INIT) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { init(global.LM_PRICE_WINDOW_CONFIG); });
    } else {
      init(global.LM_PRICE_WINDOW_CONFIG);
    }
  }
})(window);
