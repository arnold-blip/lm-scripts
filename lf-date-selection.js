(function () {

  // ============================================================
  // LANDMARK - Choose Your Forum confirm popup
  // Finds the clicked card's panel, clones its rendered HTML into
  // a body-level modal, positions it with client dimensions.
  // No CSS transform centering, no transformed-ancestor problem.
  // ============================================================

  var PANEL_HEADLINE = 'Confirm Your Dates';

  var bodyModal = null;
  var backdrop = null;

  function lock(on) {
    document.body.classList.toggle('lm-locked', !!on);
  }

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
    lock(false);
  }

  function setup() {
    backdrop = document.getElementById('lm-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'lm-backdrop';
      document.body.appendChild(backdrop);
    }
    backdrop.addEventListener('click', closeModal);

    bodyModal = document.createElement('div');
    bodyModal.id = 'lm-body-modal';
    bodyModal.style.cssText = [
      'display:none',
      'position:fixed',
      'overflow-y:auto',
      'background:#fff',
      'border-radius:10px',
      'box-shadow:0 10px 50px rgba(0,0,0,0.3)',
      'z-index:99999',
      'padding:28px 24px',
      'box-sizing:border-box'
    ].join(';');
    document.body.appendChild(bodyModal);

    window.addEventListener('resize', function () {
      if (bodyModal.style.display === 'block') positionModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  // ============================================================
  // Find the nearest card's panel from the clicked Select Date.
  // Climbs one level at a time, stops at the first ancestor that
  // contains a Confirm Your Dates headline, returns its .col__style.
  // ============================================================
  function getPanelForButton(btn) {
    var a = btn.closest('a[opt-type="button-v3"],a[data-url_type]') || btn;
    var node = a;
    for (var i = 0; i < 12; i++) {
      if (!node.parentElement) break;
      node = node.parentElement;
      var heads = node.querySelectorAll('h1,h2,h3,h4,h5,h6');
      for (var k = 0; k < heads.length; k++) {
        if ((heads[k].textContent || '').trim() === PANEL_HEADLINE) {
          var panel = heads[k].closest('.col__style') || heads[k].parentElement;
          console.log('[LM] Panel found at climb level ' + i);
          return panel;
        }
      }
    }
    console.warn('[LM] no panel found for this Select Date button');
    return null;
  }

  function openModal(panel) {
    bodyModal.innerHTML = panel.innerHTML;
    bodyModal.style.display = 'block';
    positionModal();
    backdrop.classList.add('lm-open');
    lock(true);

    // Re-wire close (X) inside the cloned content
    var closeEls = bodyModal.querySelectorAll('.lm-close,[data-lm-close]');
    for (var i = 0; i < closeEls.length; i++) {
      (function (el) {
        el.addEventListener('click', function (e) { e.preventDefault(); closeModal(); });
      })(closeEls[i]);
    }

    // Re-wire Go Back inside the cloned content
    var btns = bodyModal.querySelectorAll('a,button,.opt-button,.opt-button__text-target');
    for (var j = 0; j < btns.length; j++) {
      if ((btns[j].textContent || '').trim().toLowerCase().indexOf('go back') !== -1) {
        (function (b) {
          b.addEventListener('click', function (e) { e.preventDefault(); closeModal(); });
        })(btns[j]);
      }
    }
  }

  function init() {
    setup();

    document.addEventListener('click', function (e) {

      // Close: backdrop or X
      if (e.target.closest('[data-lm-close]') ||
          e.target.closest('.lm-close') ||
          e.target.id === 'lm-backdrop') {
        e.preventDefault();
        closeModal();
        return;
      }

      // Open: Select Date
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

    console.log('[LM] Confirm popup ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
