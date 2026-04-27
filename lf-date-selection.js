(function(){

  var FORM_UID = 'p2c270197f4';
  var FORM_ACTION = 'https://forms.ontraport.com/v2.4/form_processor.php';

  // ============================================================
  // PAGE LOAD: inject form and modal into document.body
  // ============================================================

  function injectForm() {
    var wrapper = document.createElement('div');
    wrapper.id = 'lf-hidden-form-wrapper';
    wrapper.style.cssText = 'display:none!important;position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';

    var form = document.createElement('form');
    form.id = 'lf-date-selection-form';
    form.action = FORM_ACTION;
    form.method = 'post';
    form.acceptCharset = 'UTF-8';
    form.target = '_top';

    function addInput(name, type, id, value) {
      var el = document.createElement('input');
      el.name = name;
      el.type = type || 'hidden';
      if (id) el.id = id;
      el.value = value || '';
      form.appendChild(el);
    }

    function addSelect(name, id, options) {
      var el = document.createElement('select');
      el.name = name;
      el.id = id;
      options.forEach(function(o) {
        var opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        el.appendChild(opt);
      });
      form.appendChild(el);
    }

    // Form identification — this is what tells Ontraport which form this is
    addInput('uid', 'hidden', null, FORM_UID);

    // Contact identification
    addInput('contact_id', 'hidden', 'lf-field-contact-id');

    // Custom fields
    addInput('f2478', 'hidden', 'lf-field-event-id');
    addInput('f2479', 'hidden', 'lf-field-course');
    addSelect('f2480', 'lf-field-format', [
      { value: '', label: 'Select...' },
      { value: '162', label: 'In person' },
      { value: '161', label: 'Online' },
      { value: '160', label: 'Hybrid' }
    ]);
    addInput('f2481', 'hidden', 'lf-field-dates');
    addInput('f2482', 'hidden', 'lf-field-timezone');
    addInput('f2483', 'hidden', 'lf-field-language');
    addInput('f2484', 'hidden', 'lf-field-location');
    addInput('f2454', 'hidden', 'lf-field-start-date');

    wrapper.appendChild(form);
    document.body.appendChild(wrapper);
  }

  function injectModal() {
    var overlay = document.createElement('div');
    overlay.id = 'lf-confirm-modal';
    overlay.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:8px;max-width:520px;width:90%;padding:40px 36px;box-shadow:0 8px 40px rgba(0,0,0,0.18);position:relative;font-family:inherit;';

    var closeBtn = document.createElement('button');
    closeBtn.onclick = function(){ lfCloseModal(); };
    closeBtn.style.cssText = 'position:absolute;top:16px;right:20px;background:none;border:none;font-size:22px;cursor:pointer;color:#666;';
    closeBtn.textContent = '\u00d7';
    box.appendChild(closeBtn);

    var h2 = document.createElement('h2');
    h2.style.cssText = 'margin:0 0 6px;font-size:22px;color:#1a1a1a;';
    h2.textContent = 'Confirm Your Forum Dates';
    box.appendChild(h2);

    var sub = document.createElement('p');
    sub.style.cssText = 'margin:0 0 24px;color:#555;font-size:15px;';
    sub.textContent = 'Please review your selection before confirming.';
    box.appendChild(sub);

    var card = document.createElement('div');
    card.style.cssText = 'background:#f7f7f7;border-radius:6px;padding:20px 22px;margin-bottom:28px;';

    function addRow(label, id) {
      var row = document.createElement('div');
      row.style.marginBottom = '10px';
      var lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#888;display:block;';
      lbl.textContent = label;
      var val = document.createElement('div');
      val.id = id;
      val.style.cssText = 'font-size:16px;font-weight:600;color:#1a1a1a;margin-top:2px;';
      row.appendChild(lbl);
      row.appendChild(val);
      card.appendChild(row);
    }

    addRow('Course', 'lf-modal-course');
    addRow('Dates', 'lf-modal-dates');
    addRow('Format', 'lf-modal-format');
    addRow('Time Zone', 'lf-modal-timezone');
    addRow('Language', 'lf-modal-language');
    box.appendChild(card);

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';

    var goBack = document.createElement('button');
    goBack.onclick = function(){ lfCloseModal(); };
    goBack.style.cssText = 'padding:12px 24px;border:2px solid #ccc;background:#fff;border-radius:6px;font-size:15px;cursor:pointer;color:#444;';
    goBack.textContent = 'Go Back';
    actions.appendChild(goBack);

    var confirmBtn = document.createElement('button');
    confirmBtn.id = 'lf-confirm-btn';
    confirmBtn.onclick = function(){ lfConfirmSelection(); };
    confirmBtn.style.cssText = 'padding:12px 28px;background:#2e6b3e;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;color:#fff;';
    confirmBtn.textContent = 'Confirm & Reserve';
    actions.appendChild(confirmBtn);
    box.appendChild(actions);

    var submitting = document.createElement('div');
    submitting.id = 'lf-submitting';
    submitting.style.cssText = 'display:none;text-align:center;margin-top:16px;color:#555;font-size:14px;';
    submitting.textContent = 'Reserving your spot...';
    box.appendChild(submitting);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) lfCloseModal(); });
  }

  // ============================================================
  // CARD DATA EXTRACTION + MODAL HANDLERS
  // ============================================================

  var selectedEvent = {};
  var formatMap = { 'in person': '162', 'online': '161', 'hybrid': '160' };

  function parseCardText(card) {
    var result = { format: '', timezone: '', language: '' };
    var badge = card.querySelector('[class*="tag"], [class*="badge"], [class*="format"]');
    if (badge) {
      result.format = badge.textContent.trim();
    } else {
      var allText = card.textContent || '';
      var fmtMatch = allText.match(/\b(Online|In Person|Hybrid)\b/i);
      if (fmtMatch) result.format = fmtMatch[1];
    }
    var walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while (node = walker.nextNode()) {
      var t = node.nodeValue.trim();
      var tzLangMatch = t.match(/(.+?Timezone)\s*[\u00b7\u2022\-]\s*Language:\s*(.+)/i);
      if (tzLangMatch) {
        result.timezone = tzLangMatch[1].trim();
        result.language = tzLangMatch[2].trim();
        break;
      }
      var tzMatch = t.match(/(.+?Timezone)/i);
      if (tzMatch && !result.timezone) result.timezone = tzMatch[1].trim();
      var langMatch = t.match(/Language:\s*(.+)/i);
      if (langMatch && !result.language) result.language = langMatch[1].trim();
    }
    return result;
  }

  window.lfHandleCardClick = function(card) {
    var parsed = parseCardText(card);
    selectedEvent = {
      eventId:   card.getAttribute('opt-id') || card.getAttribute('data-event-id') || '',
      course:    card.getAttribute('data-course') || (function(){ var el = card.querySelector('strong, b, h2, h3, h4'); return el ? el.textContent.trim() : ''; })(),
      format:    card.getAttribute('data-format') || parsed.format,
      dates:     card.getAttribute('data-dates') || (function(){
                   var months = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;
                   var w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null, false);
                   var n;
                   while (n = w.nextNode()) { var t = n.nodeValue.trim(); if (months.test(t)) return t; }
                   return '';
                 })(),
      timezone:  card.getAttribute('data-timezone') || parsed.timezone,
      language:  card.getAttribute('data-language') || parsed.language,
      location:  card.getAttribute('data-location') || '',
      startDate: card.getAttribute('data-start-date') || ''
    };
    console.log('LF card data:', selectedEvent);
    document.getElementById('lf-modal-course').textContent   = selectedEvent.course   || 'The Landmark Forum';
    document.getElementById('lf-modal-dates').textContent    = selectedEvent.dates    || '(dates not found)';
    document.getElementById('lf-modal-format').textContent   = selectedEvent.format   || '(format not found)';
    document.getElementById('lf-modal-timezone').textContent = selectedEvent.timezone || '(timezone not found)';
    document.getElementById('lf-modal-language').textContent = selectedEvent.language || '(language not found)';
    document.getElementById('lf-confirm-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.lfCloseModal = function() {
    document.getElementById('lf-confirm-modal').style.display = 'none';
    document.body.style.overflow = '';
    selectedEvent = {};
    var btn = document.getElementById('lf-confirm-btn');
    btn.disabled = false;
    btn.textContent = 'Confirm & Reserve';
    document.getElementById('lf-submitting').style.display = 'none';
  };

  window.lfConfirmSelection = function() {
    var form = document.getElementById('lf-date-selection-form');
    if (!form) {
      console.error('LF: form not found at submit time.');
      alert('Sorry, something went wrong. Please refresh and try again.');
      return;
    }

    var btn = document.getElementById('lf-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Please wait...';
    document.getElementById('lf-submitting').style.display = 'block';

    function setVal(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val || '';
    }

    setVal('lf-field-event-id', selectedEvent.eventId);
    setVal('lf-field-course', selectedEvent.course);
    setVal('lf-field-dates', selectedEvent.dates);
    setVal('lf-field-timezone', selectedEvent.timezone);
    setVal('lf-field-language', selectedEvent.language);
    setVal('lf-field-location', selectedEvent.location);
    setVal('lf-field-start-date', selectedEvent.startDate);

    var formatSelect = document.getElementById('lf-field-format');
    if (formatSelect) {
      var formatText = (selectedEvent.format || '').toLowerCase().trim();
      formatSelect.value = formatMap[formatText] || selectedEvent.format || '';
    }

    console.log('LF: submitting form with values:');
    console.log('  uid:', form.querySelector('[name="uid"]').value);
    console.log('  contact_id:', form.querySelector('[name="contact_id"]').value);
    console.log('  f2478 (event id):', form.querySelector('[name="f2478"]').value);
    console.log('  f2479 (course):', form.querySelector('[name="f2479"]').value);

    form.submit();
  };

  // ============================================================
  // BUTTON CLICK INTERCEPT
  // ============================================================

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') lfCloseModal();
  });

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.opt-button, .opt-element.opt-button');
    if (!btn) return;
    if ((btn.textContent || '').indexOf('Select Date') === -1) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    var card = btn.closest('.opt-row');
    console.log('LF: button clicked', btn);
    console.log('LF: card found', card);
    if (!card) { console.error('LF: card not found'); return; }
    window.lfHandleCardClick(card);
  }, true);

  // ============================================================
  // BOOT
  // ============================================================

  function boot() {
    injectForm();
    injectModal();

    var urlParams = new URLSearchParams(window.location.search);
    var cid = urlParams.get('contact_id') || urlParams.get('uid') || urlParams.get('cid') || '';
    if (!cid && window.opvid) cid = window.opvid;
    var cidField = document.getElementById('lf-field-contact-id');
    if (cidField && cid) cidField.value = cid;
    console.log('LF: contact_id on load:', cid);
    console.log('LF: Form ready. Button intercept active.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
