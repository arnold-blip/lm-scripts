/* ============================================================================
 * LM : LEGAL : RPN Consent Gate (script)  [PILOT]
 * Host at: https://arnold-blip.github.io/lm-scripts/rpn-consent-gate.js
 *
 * WHAT THIS DOES (the three stages from LISA, reproduced on Ontraport):
 *   1. Hides the native Ontraport consent checkbox; shows a red "review & agree" link.
 *   2. Link opens a modal containing the policy in a scroll box. The "I Agree"
 *      button stays DISABLED until the reader scrolls to the bottom.
 *   3. On "I Agree": modal closes, the native checkbox is revealed + checked
 *      (with the events Ontraport needs), the link is replaced by a green
 *      confirmation, and the box is locked so it can't be silently unchecked.
 *
 * WHY a native checkbox (and not our own record write):
 *   Ontraport only trusts form submissions carrying its session tokens
 *   (mopsbbk / mopbelg / _vcid). A separate POST is flagged untrusted and
 *   silently dropped. So consent MUST live on a real Ontraport field that
 *   submits with the form. This script never POSTs anything — it only drives
 *   the visibility + checked state of a field Ontraport already owns.
 *
 * WHY fail-closed on load error:
 *   If the policy text can't be fetched, we keep "I Agree" disabled. We never
 *   let someone agree to text they couldn't actually see.
 * ========================================================================== */
(function () {
  'use strict';

  // --- Config (override any of these via window.LM_RPN_CONFIG before this loads) ---
  var CFG = Object.assign({
    // The custom CSS class you add to the NATIVE Ontraport checkbox field
    // (Form builder > checkbox field > settings > "Add a class").
    checkboxClass: 'lm-rpn-checkbox-field',

    // Element IDs inside the Ontraport Custom Code block (see ontraport-block.html).
    linkId: 'lm-rpn-link',
    panelId: 'lm-rpn-panel',

    // Policy source. Prefer policyUrl -> single source of truth shared with the
    // PDF generator. Must be an IMMUTABLE, versioned file (never overwrite).
    // If policyUrl is empty, we fall back to inline HTML in #lm-rpn-policy-source.
    policyUrl: '',
    policySelector: '#lm-rpn-policy-source',
    policyVersion: '',           // e.g. 'rpn-2026-08-v1' (stamped into the form if a field is provided)

    // Optional: native hidden Ontraport fields to stamp metadata for the n8n / PDF pipeline.
    versionFieldClass: '',       // custom class on a hidden text field -> receives policyVersion
    clientTsFieldClass: '',      // custom class on a hidden text field -> receives client ISO timestamp
                                 // NOTE: authoritative timestamp is still server-side (n8n/Luxon).

    scrollThreshold: 24,         // px slack for "reached bottom" (sub-pixel rounding)
    lockAfterAgree: true,        // re-check if the user tries to uncheck after agreeing
    forceClick: false,           // fallback: drive the box via label.click() instead of .checked

    labels: {
      heading: 'Landmark Worldwide Registration Policies and Notices',
      agree: 'I Agree',
      scrollHint: 'Scroll to the bottom to enable agreement',
      loading: 'Loading\u2026',
      loadError: 'We couldn\u2019t load the policy. Please refresh the page and try again.',
      print: 'Print',
      download: 'Download'
    }
  }, window.LM_RPN_CONFIG || {});

  var STATE = { reachedBottom: false, agreed: false, loaded: false, modal: null, content: null, agreeBtn: null };

  // --------------------------------------------------------------------------
  // Boot
  // --------------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var link = document.getElementById(CFG.linkId);
    var field = document.querySelector('.' + CFG.checkboxClass);
    if (!link || !field) {
      // Nothing to do on this page (or the block / class isn't present yet).
      return;
    }
    injectStyles();

    // Stage 1: hide the native field until they've agreed.
    field.classList.add('lmrpn-hidden');

    link.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });
  }

  // --------------------------------------------------------------------------
  // Modal
  // --------------------------------------------------------------------------
  function openModal() {
    if (STATE.modal) {
      showModal();
      return;
    }
    buildModal();
    showModal();
    loadPolicy();
  }

  function buildModal() {
    var overlay = el('div', 'lmrpn-overlay', { role: 'presentation' });

    var dialog = el('div', 'lmrpn-dialog', {
      role: 'dialog', 'aria-modal': 'true', 'aria-label': CFG.labels.heading
    });

    // Top bar: Print / Download / Close
    var bar = el('div', 'lmrpn-bar');
    var spacer = el('div', 'lmrpn-spacer');
    var printBtn = el('button', 'lmrpn-textbtn', { type: 'button' });
    printBtn.textContent = CFG.labels.print;
    printBtn.addEventListener('click', printPolicy);
    var dlBtn = el('button', 'lmrpn-textbtn', { type: 'button' });
    dlBtn.textContent = CFG.labels.download;
    dlBtn.addEventListener('click', downloadPolicy);
    var closeBtn = el('button', 'lmrpn-close', { type: 'button', 'aria-label': 'Close' });
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', hideModal);
    bar.appendChild(spacer);
    bar.appendChild(printBtn);
    bar.appendChild(dlBtn);
    bar.appendChild(closeBtn);

    // Scrollable policy content
    var content = el('div', 'lmrpn-content', { tabindex: '0' });
    content.innerHTML = '<p class="lmrpn-loading">' + CFG.labels.loading + '</p>';
    content.addEventListener('scroll', onScroll);

    // Footer: hint + Agree
    var footer = el('div', 'lmrpn-footer');
    var hint = el('div', 'lmrpn-hint');
    hint.textContent = CFG.labels.scrollHint;
    var agree = el('button', 'lmrpn-agree', { type: 'button', disabled: 'disabled' });
    agree.textContent = CFG.labels.agree;
    agree.addEventListener('click', onAgree);
    footer.appendChild(hint);
    footer.appendChild(agree);

    dialog.appendChild(bar);
    dialog.appendChild(content);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Close affordances (X / Esc / backdrop) just dismiss — they do NOT agree.
    overlay.addEventListener('click', function (e) { if (e.target === overlay) hideModal(); });
    document.addEventListener('keydown', onKeydown);

    STATE.modal = overlay;
    STATE.content = content;
    STATE.agreeBtn = agree;
    STATE.hint = hint;
  }

  function showModal() {
    document.body.classList.add('lmrpn-noscroll');
    STATE.modal.classList.add('lmrpn-open');
    // Reset gate each open (unless already agreed).
    if (!STATE.agreed) {
      STATE.reachedBottom = false;
      disableAgree();
    }
    setTimeout(function () { if (STATE.content) STATE.content.focus(); }, 0);
  }

  function hideModal() {
    if (!STATE.modal) return;
    STATE.modal.classList.remove('lmrpn-open');
    document.body.classList.remove('lmrpn-noscroll');
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && STATE.modal && STATE.modal.classList.contains('lmrpn-open')) {
      hideModal();
    }
  }

  // --------------------------------------------------------------------------
  // Policy loading
  // --------------------------------------------------------------------------
  function loadPolicy() {
    if (STATE.loaded) return;

    var afterLoad = function (html) {
      STATE.content.innerHTML = html;
      STATE.loaded = true;
      // Re-bind scroll target in case fetched HTML changed layout.
      requestAnimationFrame(checkOverflow);
    };

    if (CFG.policyUrl) {
      fetch(CFG.policyUrl, { credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(afterLoad)
        .catch(function () { showLoadError(); });
    } else {
      var src = document.querySelector(CFG.policySelector);
      if (src) { afterLoad(src.innerHTML); }
      else { showLoadError(); }
    }
  }

  function showLoadError() {
    // Fail closed: surface the error, keep Agree disabled.
    if (STATE.content) STATE.content.innerHTML = '<p class="lmrpn-error">' + CFG.labels.loadError + '</p>';
    disableAgree();
  }

  // --------------------------------------------------------------------------
  // Scroll gate
  // --------------------------------------------------------------------------
  function checkOverflow() {
    var c = STATE.content;
    if (!c) return;
    // Edge case from prior builds: if the policy doesn't overflow, there's
    // nothing to scroll — enable immediately so we don't trap the user.
    if (c.scrollHeight <= c.clientHeight + CFG.scrollThreshold) {
      STATE.reachedBottom = true;
      enableAgree();
    }
  }

  function onScroll() {
    var c = STATE.content;
    if (!c || STATE.reachedBottom) return;
    if (c.scrollTop + c.clientHeight >= c.scrollHeight - CFG.scrollThreshold) {
      STATE.reachedBottom = true;
      enableAgree();
    }
  }

  function enableAgree() {
    if (!STATE.agreeBtn) return;
    STATE.agreeBtn.removeAttribute('disabled');
    if (STATE.hint) STATE.hint.classList.add('lmrpn-hint-done');
  }
  function disableAgree() {
    if (!STATE.agreeBtn) return;
    STATE.agreeBtn.setAttribute('disabled', 'disabled');
    if (STATE.hint) STATE.hint.classList.remove('lmrpn-hint-done');
  }

  // --------------------------------------------------------------------------
  // Agreement -> drive the native Ontraport checkbox
  // --------------------------------------------------------------------------
  function onAgree() {
    if (STATE.agreeBtn && STATE.agreeBtn.hasAttribute('disabled')) return; // guard
    STATE.agreed = true;

    var field = document.querySelector('.' + CFG.checkboxClass);
    var input = field ? field.querySelector('input[type="checkbox"]') : null;
    if (!field || !input) { hideModal(); return; }

    setChecked(input);

    // Reveal Stage 3: checkbox + green label.
    field.classList.remove('lmrpn-hidden');
    field.classList.add('lmrpn-agreed');

    // Hide the Stage-1 link / panel prompt.
    var link = document.getElementById(CFG.linkId);
    if (link) link.classList.add('lmrpn-hidden');
    var panel = document.getElementById(CFG.panelId);
    if (panel) panel.classList.add('lmrpn-agreed-panel');

    // Optional: lock so a stray click can't quietly revoke consent.
    if (CFG.lockAfterAgree) {
      input.addEventListener('click', function (e) {
        if (!input.checked) { e.preventDefault(); setChecked(input); }
      });
    }

    stampMeta();
    hideModal();
  }

  function setChecked(input) {
    if (CFG.forceClick) {
      // Fallback for styled checkboxes that ignore programmatic .checked:
      // click the label only if not already checked.
      if (!input.checked) {
        var lbl = input.id ? document.querySelector('label[for="' + input.id + '"]') : input.closest('label');
        if (lbl) { lbl.click(); return; }
        input.click();
        return;
      }
    }
    input.checked = true;
    // Fire the events Ontraport listens to so its internal validation updates.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function stampMeta() {
    // Write metadata into hidden NATIVE fields (so it submits with tokens).
    // Authoritative timestamp is still set server-side by n8n/Luxon.
    if (CFG.versionFieldClass && CFG.policyVersion) {
      setFieldValue(CFG.versionFieldClass, CFG.policyVersion);
    }
    if (CFG.clientTsFieldClass) {
      setFieldValue(CFG.clientTsFieldClass, new Date().toISOString());
    }
  }

  function setFieldValue(cls, val) {
    var f = document.querySelector('.' + cls + ' input, .' + cls + ' textarea, input.' + cls + ', textarea.' + cls);
    if (!f) return;
    f.value = val;
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // --------------------------------------------------------------------------
  // Print / Download (operate on the loaded policy text)
  // --------------------------------------------------------------------------
  function printPolicy() {
    var html = STATE.content ? STATE.content.innerHTML : '';
    var w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<html><head><title>' + escapeHtml(CFG.labels.heading) +
      '</title></head><body>' + html + '</body></html>');
    w.document.close();
    w.focus();
    w.print();
  }

  function downloadPolicy() {
    var html = STATE.content ? STATE.content.innerHTML : '';
    var doc = '<!doctype html><html><head><meta charset="utf-8"><title>' +
      escapeHtml(CFG.labels.heading) + '</title></head><body>' + html + '</body></html>';
    var blob = new Blob([doc], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (CFG.policyVersion || 'landmark-registration-policies') + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------
  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // --------------------------------------------------------------------------
  // Styles (scoped with lmrpn- prefix to avoid Ontraport editor collisions)
  // Brand: teal #0d2d31 / limestone #efede7 / green #1faa01 / coral #f06449 / border #a9bcbc
  // --------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('lmrpn-styles')) return;
    var css = '' +
      '.lmrpn-hidden{display:none !important;}' +
      '.lmrpn-noscroll{overflow:hidden !important;}' +
      '#' + CFG.linkId + '{color:#f06449;text-decoration:underline;cursor:pointer;font-weight:600;}' +
      '#' + CFG.linkId + ':hover{color:#d6513a;}' +

      '.lmrpn-overlay{position:fixed;inset:0;z-index:2147483000;display:none;' +
        'align-items:center;justify-content:center;padding:16px;' +
        'background:rgba(13,45,49,.55);}' +
      '.lmrpn-overlay.lmrpn-open{display:flex;}' +

      '.lmrpn-dialog{background:#fff;width:100%;max-width:760px;max-height:88vh;' +
        'display:flex;flex-direction:column;border-radius:8px;overflow:hidden;' +
        'box-shadow:0 18px 50px rgba(13,45,49,.35);font-family:inherit;color:#0d2d31;}' +

      '.lmrpn-bar{display:flex;align-items:center;gap:16px;padding:12px 16px;border-bottom:1px solid #a9bcbc;}' +
      '.lmrpn-spacer{flex:1;}' +
      '.lmrpn-textbtn{background:none;border:none;color:#0d2d31;font-size:14px;cursor:pointer;padding:4px 10px;border-radius:5px;transition:background .12s;}' +
      '.lmrpn-textbtn:hover,.lmrpn-textbtn:focus,.lmrpn-textbtn:active{background:#2dae0e;color:#fff;text-decoration:none;outline:none;}' +
      '.lmrpn-close{background:none;border:none;font-size:26px;line-height:1;color:#0d2d31;cursor:pointer;padding:0 8px;border-radius:5px;transition:background .12s;}' +
      '.lmrpn-close:hover,.lmrpn-close:focus,.lmrpn-close:active{background:#2dae0e;color:#fff;outline:none;}' +

      '.lmrpn-content{padding:20px 24px;overflow-y:auto;flex:1;line-height:1.55;font-size:15px;outline:none;}' +
      '.lmrpn-content h1,.lmrpn-content h2,.lmrpn-content h3{color:#0d2d31;}' +
      '.lmrpn-loading,.lmrpn-error{color:#0d2d31;}' +
      '.lmrpn-error{color:#f06449;font-weight:600;}' +

      '.lmrpn-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;' +
        'padding:14px 16px;border-top:1px solid #a9bcbc;background:#efede7;}' +
      '.lmrpn-hint{font-size:13px;color:#5b6b6b;}' +
      '.lmrpn-hint-done{color:#1faa01;}' +

      '.lmrpn-agree{background:#1faa01;color:#fff;border:none;border-radius:5px;' +
        'padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;}' +
      '.lmrpn-agree:hover{background:#2dae0e;}' +
      '.lmrpn-agree[disabled]{background:#a9bcbc;cursor:not-allowed;opacity:.8;}' +

      // Stage 3: turn the revealed native checkbox label green.
      '.' + CFG.checkboxClass + '.lmrpn-agreed label{color:#1faa01 !important;}' +
      '';
    var style = document.createElement('style');
    style.id = 'lmrpn-styles';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }
})();
