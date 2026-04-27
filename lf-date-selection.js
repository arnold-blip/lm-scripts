(function () {

  // ============================================================
  // CONFIG
  // ============================================================
  var FORM_UID = 'p2c270197f4';
  var SNIPPET_URL = 'https://forms.ontraport.com/v2.4/include/formEditor/genbootstrap.php?method=script&uid=' + FORM_UID + '&version=1';

  var FORMAT_MAP = {
    'in person': '162',
    'online':    '161',
    'hybrid':    '160'
  };

  var selectedEvent = {};

  // ============================================================
  // STEP 1: INJECT HIDDEN FORM CONTAINER + MODAL INTO BODY
  // ============================================================
  function injectShell() {
    // Hidden wrapper for the Ontraport snippet to render into
    var formWrapper = document.createElement('div');
    formWrapper.id = 'lf-form-wrapper';
    formWrapper.style.cssText = 'display:none !important; position:absolute; left:-9999px; top:-9999px;';
    document.body.appendChild(formWrapper);

    // Modal HTML
    var modal = document.createElement('div');
    modal.id = 'lf-confirm-modal';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.55); z-index:99999; align-items:center; justify-content:center;';
    modal.innerHTML = [
      '<div style="background:#fff; border-radius:8px; max-width:520px; width:90%; padding:40px 36px; box-shadow:0 8px 40px rgba(0,0,0,0.18); position:relative; font-family:inherit;">',
        '<button onclick="lfCloseModal()" style="position:absolute; top:16px; right:20px; background:none; border:none; font-size:22px; cursor:pointer; color:#666; line-height:1;" aria-label="Close">&times;</button>',
        '<h2 style="margin:0 0 6px 0; font-size:22px; color:#1a1a1a;">Confirm Your Forum Dates</h2>',
        '<p style="margin:0 0 24px 0; color:#555; font-size:15px;">Please review your selection before confirming.</p>',
        '<div style="background:#f7f7f7; border-radius:6px; padding:20px 22px; margin-bottom:28px;">',
          '<div style="margin-bottom:10px;"><span style="font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:#888;">Course</span><div id="lf-modal-course" style="font-size:16px; font-weight:600; color:#1a1a1a; margin-top:2px;"></div></div>',
          '<div style="margin-bottom:10px;"><span style="font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:#888;">Dates</span><div id="lf-modal-dates" style="font-size:16px; font-weight:600; color:#1a1a1a; margin-top:2px;"></div></div>',
          '<div style="margin-bottom:10px;"><span style="font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:#888;">Format</span><div id="lf-modal-format" style="font-size:16px; font-weight:600; color:#1a1a1a; margin-top:2px;"></div></div>',
          '<div style="margin-bottom:10px;"><span style="font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:#888;">Time Zone</span><div id="lf-modal-timezone" style="font-size:16px; font-weight:600; color:#1a1a1a; margin-top:2px;"></div></div>',
          '<div><span style="font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:#888;">Language</span><div id="lf-modal-language" style="font-size:16px; font-weight:600; color:#1a1a1a; margin-top:2px;"></div></div>',
        '</div>',
        '<div style="display:flex; gap:12px; justify-content:flex-end;">',
          '<button onclick="lfCloseModal()" style="padding:12px 24px; border:2px solid #ccc; background:#fff; border-radius:6px; font-size:15px; cursor:pointer; color:#444;">Go Back</button>',
          '<button id="lf-confirm-btn" onclick="lfConfirmSelection()" style="padding:12px 28px; background:#2e6b3e; border:none; border-radius:6px; font-size:15px; font-weight:600; cursor:pointer; color:#fff;">Confirm &amp; Reserve</button>',
        '</div>',
        '<div id="lf-submitting" style="display:none; text-align:center; margin-top:16px; color:#555; font-size:14px;">Reserving your spot...</div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', function (e) {
      if (e.target === modal) lfCloseModal();
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') lfCloseModal();
    });
  }

  // ============================================================
  // STEP 2: LOAD THE ONTRAPORT SNIPPET INTO THE HIDDEN WRAPPER
  // ============================================================
  function loadSnippet() {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = SNIPPET_URL;
    script.onload = function () {
      // Snippet injects its own script tag. Watch for the form to render.
      waitForForm();
    };
    document.getElementById('lf-form-wrapper').appendChild(script);
  }

  // ============================================================
  // STEP 3: WAIT FOR FORM TO RENDER INSIDE THE WRAPPER
  // ============================================================
  function waitForForm() {
    var wrapper = document.getElementById('lf-form-wrapper');
    var observer = new MutationObserver(function (mutations, obs) {
      var form = wrapper.querySelector('form');
      if (form) {
        obs.disconnect();
        console.log('LF: Form rendered successfully.');
        readContactIdFromUrl();
        wireButtons();
      }
    });
    observer.observe(wrapper, { childList: true, subtree: true });

    // Fallback timeout in case observer misses it
    setTimeout(function () {
      var form = wrapper.querySelector('form');
      if (form) {
        console.log('LF: Form found via timeout fallback.');
        readContactIdFromUrl();
        wireButtons();
      } else {
        console.warn('LF: Form did not render after 5 seconds.');
      }
    }, 5000);
  }

  // ============================================================
  // STEP 4: READ CONTACT ID FROM URL AND WRITE TO FORM
  // ============================================================
  function readContactIdFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var contactId = params.get('uid') || params.get('contact_id') || '';
    if (contactId) {
      var field = document.querySelector('#lf-form-wrapper input[name="contact_id"]');
      if (field) {
        field.value = contactId;
        console.log('LF: Contact ID set to', contactId);
      }
    }
  }

  // ============================================================
  // STEP 5: WIRE SELECT DATE BUTTONS
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

      var card = btn.closest('[data-template-id], [opt-id]') ||
                 btn.parentElement.parentElement.parentElement.parentElement.parentElement;

      handleCardClick(card);
    }, true);

    console.log('LF: Button intercept active.');
  }

  // ============================================================
  // STEP 6: HANDLE CARD CLICK - READ DATA AND OPEN MODAL
  // ============================================================
  function getTextFrom(parent, selectors) {
    var list = selectors.split(',');
    for (var i = 0; i < list.length; i++) {
      var el = parent.querySelector(list[i].trim());
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }

  function handleCardClick(card) {
    selectedEvent = {
      eventId:   card.getAttribute('data-event-id')  || '',
      course:    card.getAttribute('data-course')     || getTextFrom(card, 'strong, b, h2, h3, h4, [class*="course"], [class*="title"]'),
      format:    card.getAttribute('data-format')     || getTextFrom(card, '[class*="format"], [class*="tag"], [class*="badge"]'),
      dates:     card.getAttribute('data-dates')      || getTextFrom(card, '[class*="date"], p'),
      timezone:  card.getAttribute('data-timezone')   || getTextFrom(card, '[class*="timezone"], [class*="time-zone"]'),
      language:  card.getAttribute('data-language')   || getTextFrom(card, '[class*="language"]'),
      location:  card.getAttribute('data-location')   || '',
      startDate: card.getAttribute('data-start-date') || ''
    };

    console.log('LF card data:', selectedEvent);

    document.getElementById('lf-modal-course').textContent   = selectedEvent.course   || 'The Landmark Forum';
    document.getElementById('lf-modal-dates').textContent    = selectedEvent.dates    || '(dates not found)';
    document.getElementById('lf-modal-format').textContent   = selectedEvent.format   || '(format not found)';
    document.getElementById('lf-modal-timezone').textContent = selectedEvent.timezone || '(timezone not found)';
    document.getElementById('lf-modal-language').textContent = selectedEvent.language || '(language not found)';

    var modal = document.getElementById('lf-confirm-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  // ============================================================
  // MODAL CONTROLS
  // ============================================================
  window.lfCloseModal = function () {
    document.getElementById('lf-confirm-modal').style.display = 'none';
    document.body.style.overflow = '';
    selectedEvent = {};
    var btn = document.getElementById('lf-confirm-btn');
    btn.disabled = false;
    btn.textContent = 'Confirm & Reserve';
    document.getElementById('lf-submitting').style.display = 'none';
  };

  window.lfConfirmSelection = function () {
    var wrapper = document.getElementById('lf-form-wrapper');
    var form = wrapper.querySelector('form');

    if (!form) {
      alert('Form is not ready yet. Please try again in a moment.');
      return;
    }

    var btn = document.getElementById('lf-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Please wait...';
    document.getElementById('lf-submitting').style.display = 'block';

    // Write event data into form fields
    function setField(name, value) {
      var el = form.querySelector('[name="' + name + '"]');
      if (el) el.value = value || '';
    }

    setField('f2478', selectedEvent.eventId);
    setField('f2479', selectedEvent.course);
    setField('f2481', selectedEvent.dates);
    setField('f2482', selectedEvent.timezone);
    setField('f2483', selectedEvent.language);
    setField('f2484', selectedEvent.location);
    setField('f2454', selectedEvent.startDate);

    // Handle format dropdown
    var formatSelect = form.querySelector('[name="f2480"]');
    if (formatSelect) {
      var formatText = (selectedEvent.format || '').toLowerCase().trim();
      formatSelect.value = FORMAT_MAP[formatText] || selectedEvent.format || '';
    }

    // Submit
    console.log('LF: Submitting form.');
    form.submit();
  };

  // ============================================================
  // INIT
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectShell();
      loadSnippet();
    });
  } else {
    injectShell();
    loadSnippet();
  }

})();
