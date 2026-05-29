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

    // postMessage fallback
    window.addEventListener('message', function (e) {
      if (e.data === 'lf-close-modal') {
        console.log('LF: Received lf-close-modal postMessage.');
        closeModal();
      }
    });
  }

  // ============================================================
  // STEP 3: OPEN MODAL WITH CORRECT EVENT URL
  // ============================================================
  function openModal(eventId) {
    var contactId = getContactId();
    var url = BASE_URL + eventId + '?uid=' + contactId + '&id=' + eventId;

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

    // Start polling for No Go Back button inside iframe
    startPollingForNoGoBack(iframe);
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
    var iframe = document.getElementById('lf-modal-iframe');
    iframe.src = '';
    document.getElementById('lf-modal-loading').style.display = 'block';

    // Stop polling
    stopPolling();
  }

  // ============================================================
  // POLLING: find No Go Back button inside iframe after it loads
  // Ontraport Dynamic Templates render late so we poll
  // ============================================================
  var pollInterval = null;
  var pollCount = 0;

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    pollCount = 0;
  }

  function startPollingForNoGoBack(iframe) {
    stopPolling(); // clear any existing poll

    pollInterval = setInterval(function () {
      pollCount++;

      // Give up after 20 seconds (40 attempts x 500ms)
      if (pollCount > 40) {
        console.warn('LF: Gave up polling for No Go Back button.');
        stopPolling();
        return;
      }

      try {
        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

        // Search in main iframe doc
        var found = wireNoGoBack(iframeDoc);

        // Also search inside any nested iframes (Ontraport sometimes nests them)
        if (!found) {
          var nestedIframes = iframeDoc.querySelectorAll('iframe');
          nestedIframes.forEach(function (nested) {
            try {
              var nestedDoc = nested.contentDocument || nested.contentWindow.document;
              if (wireNoGoBack(nestedDoc)) found = true;
            } catch (e) { /* cross-origin nested iframe, skip */ }
          });
        }

        if (found) {
          console.log('LF: No Go Back button wired. Stopping poll.');
          stopPolling();
        }
      } catch (err) {
        // iframe not ready yet, keep polling
      }
    }, 500);
  }

  function wireNoGoBack(doc) {
    var found = false;
    var btns = doc.querySelectorAll('.opt-button, a, button');
    btns.forEach(function (btn) {
      if (
        (btn.textContent || '').trim().indexOf('No, Go Back') !== -1 &&
        !btn.getAttribute('data-lf-wired')
      ) {
        btn.setAttribute('data-lf-wired', '1');
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopImmediatePropagation();
          console.log('LF: No Go Back clicked. Closing modal.');
          closeModal();
        }, true);
        found = true;
        console.log('LF: Wired No Go Back button:', btn);
      }
    });
    return found;
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
