(function () {

  // ============================================================
  // CONFIG - update BASE_URL if the confirmation page URL changes
  // ============================================================
  var BASE_URL = 'https://landmark-worldwide.mytemporarydomain.com/confirm-your-forum/';

  // ============================================================
  // STEP 1: GET CONTACT ID FROM URL
  // ============================================================
  function getContactId() {
    var params = new URLSearchParams(window.location.search);
    return params.get('uid') || params.get('contact_id') || '';
  }

  // ============================================================
  // STEP 2: INJECT MODAL INTO BODY
  // ============================================================
  function injectModal() {
    if (document.getElementById('lf-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'lf-modal';
    modal.style.cssText = [
      'display:none',
      'position:fixed',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'background:rgba(0,0,0,0.65)',
      'z-index:99999',
      'align-items:center',
      'justify-content:center'
    ].join(';');

    modal.innerHTML = [
      '<div style="background:#fff;border-radius:8px;width:92%;max-width:700px;height:85vh;position:relative;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.25);">',
        '<button id="lf-modal-close" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:26px;cursor:pointer;color:#555;z-index:10;line-height:1;" aria-label="Close">&times;</button>',
        '<div id="lf-modal-loading" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#555;font-size:15px;font-family:inherit;">Loading your forum details...</div>',
        '<iframe id="lf-modal-iframe" src="" style="width:100%;height:100%;border:none;display:block;" allowtransparency="true"></iframe>',
      '</div>'
    ].join('');

    document.body.appendChild(modal);

    // Close on X button
    document.getElementById('lf-modal-close').addEventListener('click', closeModal);

    // Close on overlay click
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    // Hide loading message once iframe loads
    document.getElementById('lf-modal-iframe').addEventListener('load', function () {
      document.getElementById('lf-modal-loading').style.display = 'none';
    });
  }

  // ============================================================
  // STEP 3: OPEN MODAL WITH CORRECT EVENT URL
  // ============================================================
  function openModal(eventId) {
    var contactId = getContactId();
    var url = BASE_URL + eventId + '?uid=' + contactId + '&eid=' + eventId;

    console.log('LF: Opening iframe with URL:', url);

    var iframe = document.getElementById('lf-modal-iframe');
    var loading = document.getElementById('lf-modal-loading');

    // Reset iframe and show loading
    iframe.src = '';
    loading.style.display = 'block';

    // Set iframe src
    iframe.src = url;

    // Show modal
    var modal = document.getElementById('lf-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  // ============================================================
  // STEP 4: CLOSE MODAL
  // ============================================================
  function closeModal() {
    var modal = document.getElementById('lf-modal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';

    // Clear iframe to stop any ongoing loading
    document.getElementById('lf-modal-iframe').src = '';
    document.getElementById('lf-modal-loading').style.display = 'block';
  }

  // ============================================================
  // STEP 5: INTERCEPT SELECT DATE BUTTON CLICKS
  // ============================================================
  function wireButtons() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.opt-button, .opt-element.opt-button');
      if (!btn) return;

      var text = (btn.textContent || '').trim();
      if (text.indexOf('Select Date') === -1) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Walk up to find the card container
      var card = btn.closest('[data-template-id], [opt-id]') ||
                 btn.parentElement.parentElement.parentElement.parentElement.parentElement;

      // Get event ID from the card's link href or data attribute
      // The Block button previously had href like /confirm-your-forum/3LCB7PS
      // We extract the event ID from the card context
      var eventId = getEventIdFromCard(card, btn);

      if (!eventId) {
        console.warn('LF: Could not find event ID for this card.');
        return;
      }

      console.log('LF: Event ID found:', eventId);
      openModal(eventId);

    }, true);

    console.log('LF: Button intercept active.');
  }

  // ============================================================
  // STEP 6: EXTRACT EVENT ID FROM CARD
  // Tries multiple methods to find the Event ID
  // ============================================================
  function getEventIdFromCard(card, btn) {
    // Method 1: data attribute on card (most reliable if set)
    if (card.getAttribute('data-event-id')) {
      return card.getAttribute('data-event-id');
    }

    // Method 2: read from URL params on page (single event page)
    var params = new URLSearchParams(window.location.search);
    if (params.get('eid')) return params.get('eid');

    // Method 3: extract from any link inside the card that
    // contains /confirm-your-forum/ in the href
    var links = card.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      var match = href.match(/confirm-your-forum\/([A-Z0-9]+)/i);
      if (match) return match[1];
    }

    // Method 4: try the button's own original href before it was cleared
    var btnHref = btn.getAttribute('data-original-href') || btn.getAttribute('href') || '';
    var btnMatch = btnHref.match(/confirm-your-forum\/([A-Z0-9]+)/i);
    if (btnMatch) return btnMatch[1];

    return '';
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    injectModal();
    wireButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
