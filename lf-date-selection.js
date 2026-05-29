(function () {

  // ============================================================
  // LANDMARK - Choose Your Forum confirm popup (no iframe)
  // Reveals each card's own in-block confirm panel over a
  // shared dimmed backdrop. No page loads, no iframe.
  // ============================================================

  // The exact headline text inside each confirm panel.
  // The script uses this to locate the panel within each card.
  var PANEL_MARKER = 'Confirm Your Dates';

  // How many levels to climb from the headline to reach the
  // panel container. Adjust this if the tagged-panel count is wrong.
  var CLIMB_LEVELS = 4;

  function lock(on) {
    document.body.classList.toggle('lm-locked', !!on);
  }

  function closeAll() {
    var open = document.querySelectorAll('.lm-confirm-panel.lm-open');
    for (var i = 0; i < open.length; i++) {
      open[i].classList.remove('lm-open');
    }
    var bd = document.getElementById('lm-backdrop');
    if (bd) bd.classList.remove('lm-open');
    lock(false);
  }

  // ============================================================
  // Tag each panel by finding its headline and climbing up to
  // the container that wraps the whole panel.
  // ============================================================
  function tagPanels() {
    var nodes = document.querySelectorAll('h1,h2,h3,h4,div,span,p');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if ((el.textContent || '').trim() === PANEL_MARKER) {
        var box = el;
        for (var up = 0; up < CLIMB_LEVELS && box.parentElement; up++) {
          box = box.parentElement;
        }
        if (box && !box.classList.contains('lm-confirm-panel')) {
          box.classList.add('lm-confirm-panel');
        }
      }
    }
  }

  // ============================================================
  // Open the panel that belongs to the clicked Select Date button
  // (the nearest ancestor that contains a tagged panel).
  // ============================================================
  function openForButton(btn) {
    var node = btn, panel = null;
    while (node && node !== document.body) {
      if (node.querySelector) {
        var p = node.querySelector('.lm-confirm-panel');
        if (p) { panel = p; break; }
      }
      node = node.parentElement;
    }
    if (!panel) {
      console.warn('LM: no confirm panel found for this Select Date button.');
      return;
    }
    closeAll();
    var bd = document.getElementById('lm-backdrop');
    if (bd) bd.classList.add('lm-open');
    panel.classList.add('lm-open');
    lock(true);
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    tagPanels();

    var bd = document.getElementById('lm-backdrop');
    if (bd) bd.addEventListener('click', closeAll);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });

    document.addEventListener('click', function (e) {

      // Close (X) or anything marked to close
      var closeEl = e.target.closest('.lm-close, [data-lm-close]');
      if (closeEl) { e.preventDefault(); closeAll(); return; }

      var clickable = e.target.closest('.opt-button, .opt-element.opt-button, a, button, span');
      if (!clickable) return;
      var txt = (clickable.textContent || '').trim();

      // Go Back inside an open panel closes the popup
      if (txt.indexOf('Go Back') !== -1 && e.target.closest('.lm-confirm-panel')) {
        e.preventDefault();
        closeAll();
        return;
      }

      // Select Date opens this card's panel
      if (txt.indexOf('Select Date') !== -1) {
        e.preventDefault();
        e.stopPropagation();
        openForButton(clickable);
      }

    }, true);

    console.log('LM: confirm popup ready. Panels tagged:',
      document.querySelectorAll('.lm-confirm-panel').length);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
