/* Choose Your Forum - confirm popup  (live inline script + contact-id fix)
 *
 * This is the script currently pasted INLINE on typ-post-purchase, with one
 * addition: it stamps the buyer's contact id onto the real form before it
 * clicks the real submit button.
 *
 * Why: the Registration form ships a hidden input `f2213//unique_id`
 * (Registration -> Contact) that Ontraport leaves EMPTY. When it is empty,
 * Ontraport falls back to the browser's visitor cookie to decide who the
 * registration belongs to - which is how two people registering on one laptop
 * end up merged onto a single contact.
 *
 * The contact id arrives as ?cid= on the checkout redirect. With no cid, the
 * field stays empty and behaviour is exactly as it is today - it cannot regress.
 *
 * ONLY the marked ADDED block and the two marked lines inside
 * triggerSourceConfirm() differ from what is live now.
 */
(function () {

  var PANEL_MARK = '.lm-close,[data-lm-close]';
  var PANEL_COL  = '.col__style';
  var bodyModal = null;
  var backdrop = null;
  var currentSource = null;

  // ===== ADDED: buyer identity, carried in the URL instead of the cookie =====

  var CONTACT_FIELD = 'f2213//unique_id'; // Registration -> Contact
  var EMAIL_FIELD   = 'f2674';            // Registration -> Email

  function lmParam(names) {
    var q = new URLSearchParams(window.location.search);
    for (var i = 0; i < names.length; i++) {
      var v = q.get(names[i]);
      if (v && v.trim()) return v.trim();
    }
    return '';
  }

  function lmRemember(k, v) {
    if (!v) return;
    try { sessionStorage.setItem(k, v); } catch (e) {}
    try { localStorage.setItem(k, v); } catch (e) {}
  }

  function lmRecall(k) {
    try {
      return (sessionStorage.getItem(k) || localStorage.getItem(k) || '').trim();
    } catch (e) { return ''; }
  }

  // Several spellings accepted so we are not at the mercy of how the redirect
  // ends up naming the parameter. Cached so the reminder-email return path works.
  var LM_CID = lmParam(['cid', 'contact_id', 'unique_id', 'uid']) || lmRecall('lf_cid');
  var LM_EM  = lmParam(['em', 'email']) || lmRecall('lf_em');

  lmRemember('lf_cid', LM_CID);
  lmRemember('lf_em', LM_EM);

  function stampBuyer(panel) {
    var form = panel.closest('form');
    if (!form) { console.error('[LM] source panel has no form'); return; }

    if (LM_CID) {
      var c = form.querySelector('input[name="' + CONTACT_FIELD + '"]');
      if (c) c.value = LM_CID;
      else console.warn('[LM] hidden field ' + CONTACT_FIELD + ' not found on the form');
    } else {
      console.warn('[LM] no contact id - Ontraport will fall back to the visitor cookie');
    }

    if (LM_EM) {
      var e = form.querySelector('input[name="' + EMAIL_FIELD + '"]');
      if (e && !e.value) e.value = LM_EM;
    }
  }

  // ===== END ADDED =====

  function positionModal() {
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var w = Math.min(Math.round(vw * 0.92), 640);
    bodyModal.style.width = w + 'px';
    bodyModal.style.left = Math.round((vw - w) / 2) + 'px';
    bodyModal.style.maxHeight = Math.round(vh * 0.88) + 'px';
    var h = bodyModal.offsetHeight;
    bodyModal.style.top = Math.max(20, Math.round((vh - h) / 2)) + 'px';
  }

  function closeModal() {
    if (bodyModal) bodyModal.style.display = 'none';
    if (backdrop) backdrop.classList.remove('lm-open');
  }

  function hideSourcePanels() {
    var marks = document.querySelectorAll(PANEL_MARK);
    var count = 0;
    for (var i = 0; i < marks.length; i++) {
      if (marks[i].closest('#lm-body-modal')) continue;
      var p = marks[i].closest(PANEL_COL);
      if (p && p.style.display !== 'none') { p.style.display = 'none'; count++; }
    }
    if (count > 0) console.log('[LM] hid ' + count + ' source panel(s)');
    return count;
  }

  function watchAndHide() {
    hideSourcePanels();
    [150, 400, 800, 1500, 2500, 4000].forEach(function (ms) {
      setTimeout(hideSourcePanels, ms);
    });
    if (window.MutationObserver) {
      var obs = new MutationObserver(function () { hideSourcePanels(); });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { obs.disconnect(); }, 8000);
    }
  }

  function setup() {
    backdrop = document.getElementById('lm-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'lm-backdrop';
      document.body.appendChild(backdrop);
    }

    bodyModal = document.createElement('div');
    bodyModal.id = 'lm-body-modal';
    bodyModal.style.cssText = [
      'display:none','position:fixed','overflow-y:auto','background:#fff',
      'box-shadow:0 10px 50px rgba(0,0,0,0.3)',
      'z-index:99999','padding:28px 24px','box-sizing:border-box'
    ].join(';');
    document.body.appendChild(bodyModal);

    window.addEventListener('resize', function () {
      if (bodyModal.style.display === 'block') positionModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function getPanelForButton(btn) {
    var a = btn.closest('a[opt-type="button-v3"],a[data-url_type]') || btn;
    var node = a;
    for (var i = 0; i < 12; i++) {
      if (!node.parentElement) break;
      node = node.parentElement;
      var mark = node.querySelector(PANEL_MARK);
      if (mark && !mark.closest('#lm-body-modal')) {
        console.log('[LM] panel matched at climb level ' + (i + 1));
        return mark.closest(PANEL_COL) || mark.parentElement;
      }
    }
    return null;
  }

  function triggerSourceConfirm() {
    if (!currentSource) return;
    stampBuyer(currentSource);                 // <-- ADDED: link the registration to the buyer
    var btn = currentSource.querySelector('.opt-button--submit, a[opt-type="submit-button-v3"]');
    if (btn) { btn.click(); return; }
    console.warn('[LM] source submit button not found');
  }

  function reflowDateRows(root) {
    var TIME_RE = /\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)/i;
    var rows = root.querySelectorAll('p,div,span');
    rows.forEach(function (row) {
      if (row.getAttribute('data-lm-split')) return;
      if (row.querySelector('p,div')) return;
      if (!TIME_RE.test(row.textContent || '')) return;

      var walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, null);
      var tn, target = null;
      while ((tn = walker.nextNode())) {
        if (TIME_RE.test(tn.nodeValue)) { target = tn; break; }
      }
      if (!target) return;

      var tm = target.nodeValue.match(TIME_RE);
      var idx = target.nodeValue.indexOf(tm[0]);
      target.nodeValue = target.nodeValue.slice(0, idx).replace(/[\s\-]+$/, '');

      row.setAttribute('data-lm-split', '1');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'baseline';
      row.style.flexWrap = 'wrap';
      row.style.gap = '16px';

      var left = document.createElement('span');
      while (row.firstChild) left.appendChild(row.firstChild);
      var right = document.createElement('span');
      right.textContent = tm[0];
      right.style.whiteSpace = 'nowrap';

      row.appendChild(left);
      row.appendChild(right);
    });
  }

  function openModal(panel) {
    currentSource = panel;
    bodyModal.innerHTML = panel.innerHTML;
    reflowDateRows(bodyModal);

    var x = bodyModal.querySelector('.lm-close,[data-lm-close]');
    if (!x) {
      x = document.createElement('span');
      x.className = 'lm-close';
      x.setAttribute('data-lm-close', '');
      x.textContent = '×';
    }
    bodyModal.appendChild(x);

    bodyModal.style.display = 'block';
    positionModal();
    backdrop.classList.add('lm-open');
  }

  function init() {
    setup();
    watchAndHide();

    document.addEventListener('click', function (e) {

      if (e.target.id === 'lm-backdrop') { e.preventDefault(); closeModal(); return; }

      if (bodyModal && bodyModal.style.display === 'block' && bodyModal.contains(e.target)) {
        if (e.target.closest('.lm-close,[data-lm-close]')) {
          e.preventDefault(); e.stopPropagation(); closeModal(); return;
        }
        var inBtn = e.target.closest('a,button,.opt-button,.opt-button__text-target');
        if (inBtn) {
          var t = (inBtn.textContent || '').trim().toLowerCase();
          if (t.indexOf('go back') !== -1) { e.preventDefault(); e.stopPropagation(); closeModal(); return; }
          if (t.indexOf('confirm') !== -1 && t.indexOf('reserve') !== -1) { e.preventDefault(); e.stopPropagation(); triggerSourceConfirm(); return; }
        }
        return;
      }

      var el = e.target.closest('a[opt-type="button-v3"],a[data-url_type],.opt-button,button');
      if (!el) return;
      var textEl = el.querySelector('.opt-button__text-target') || el;
      if ((textEl.textContent || '').trim().toLowerCase() === 'select date') {
        e.preventDefault();
        e.stopPropagation();
        var panel = getPanelForButton(el);
        if (panel) openModal(panel);
      }

    }, true);

    console.log('[LM] Confirm popup ready - contact id ' + (LM_CID ? 'present' : 'MISSING'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
