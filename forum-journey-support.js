/* Forum Journey — support pop-up
   Hosted because OP's Custom HTML sanitizer rejects inline fetch/appendChild.
   Pairs with the .fj-sup block on the Forum Journey page. */
(function(){
  if (window.__lmFjSupInit) return;
  window.__lmFjSupInit = true;

  /* n8n relay that writes to Ontraport. Never call the OP API from the browser. */
  var WEBHOOK_URL = 'https://landmarkworldwide.awesomate.io/webhook/forum-journey-support';

  var $ = function(id){ return document.getElementById(id); };

  function clean(v){
    v = (v || '').trim();
    if (!v || v.indexOf('[') > -1 || v.indexOf('##') > -1) return '';
    return v;
  }
  function mf(id){ var el = $(id); return el ? clean(el.textContent) : ''; }
  function qp(k){
    try { return clean(new URLSearchParams(location.search).get(k) || ''); }
    catch(e){ return ''; }
  }
  function ss(k){
    try { return clean(sessionStorage.getItem(k) || ''); } catch(e){ return ''; }
  }
  function pick(){
    for (var i=0;i<arguments.length;i++){ if (arguments[i]) return arguments[i]; }
    return '';
  }

  var identity = {};

  function hydrate(){
    identity.cuid  = pick(qp('cuid'), ss('cuid'), mf('fjMfCuid'));
    identity.email = pick(qp('cemail'), ss('cemail'), mf('fjMfEmail'));
    identity.first = pick(qp('cfirstname'), ss('cfirstname'), mf('fjMfFirst'));
    identity.last  = pick(ss('clastname'), mf('fjMfLast'));
    identity.phone = pick(ss('cphone'), mf('fjMfPhone'));

    try {
      if (identity.cuid)  sessionStorage.setItem('cuid', identity.cuid);
      if (identity.email) sessionStorage.setItem('cemail', identity.email);
      if (identity.first) sessionStorage.setItem('cfirstname', identity.first);
    } catch(e){}

    var n = $('fjSupName'), e = $('fjSupEmail'), p = $('fjSupPhone');
    if (n && !n.value) n.value = [identity.first, identity.last].filter(Boolean).join(' ');
    if (e && !e.value) e.value = identity.email;
    if (p && !p.value) p.value = identity.phone;
  }

  function open(){
    hydrate();
    var s = $('fjSupScrim'), m = $('fjSupModal');
    if (!s || !m) return;
    s.classList.add('is-open');
    m.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var n = $('fjSupName');
    if (n) setTimeout(function(){ n.focus(); }, 60);
  }

  function shut(){
    var s = $('fjSupScrim'), m = $('fjSupModal');
    if (s) s.classList.remove('is-open');
    if (m) m.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function setErr(fieldId, on){
    var f = $(fieldId);
    if (f) f.classList.toggle('has-error', !!on);
  }

  function validate(){
    var ok = true;
    var name  = $('fjSupName').value.trim();
    var email = $('fjSupEmail').value.trim();
    var phone = $('fjSupPhone').value.trim();
    var msg   = $('fjSupMsg').value.trim();
    var wantCall = $('fjSupWayCall').checked;

    setErr('fjSupNameField', !name);
    if (!name) ok = false;

    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setErr('fjSupEmailField', !emailOk);
    if (!emailOk) ok = false;

    var phoneNeeded = wantCall && !phone;
    setErr('fjSupPhoneField', phoneNeeded);
    if (phoneNeeded) ok = false;

    setErr('fjSupMsgField', !msg);
    if (!msg) ok = false;

    return ok;
  }

  function submit(ev){
    ev.preventDefault();
    if ($('fjSupHp').value) return;              /* honeypot */
    $('fjSupFail').classList.remove('is-on');
    if (!validate()) return;

    var btn = $('fjSupSubmit');
    btn.disabled = true;
    btn.textContent = 'Sending\u2026';

    var full = $('fjSupName').value.trim();
    var sp = full.indexOf(' ');

    var payload = {
      source: 'forum-journey-support',
      contactId: identity.cuid || '',
      firstName: sp > -1 ? full.slice(0, sp) : full,
      lastName:  sp > -1 ? full.slice(sp + 1) : '',
      email: $('fjSupEmail').value.trim(),
      phone: $('fjSupPhone').value.trim(),
      message: $('fjSupMsg').value.trim(),
      preferEmail: $('fjSupWayEmail').checked,
      preferCall: $('fjSupWayCall').checked,
      pageUrl: location.href
    };

    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function(){
      $('fjSupForm').style.display = 'none';
      $('fjSupDone').classList.add('is-on');
    })
    .catch(function(){
      $('fjSupFail').classList.add('is-on');
      btn.disabled = false;
      btn.textContent = 'Send Message';
    });
  }

  /* OP renders each custom-HTML block in multiple responsive copies.
     Keep one of each, move it to body, drop the rest. */
  function dedupe(sel){
    var all = document.querySelectorAll(sel);
    if (!all.length) return null;
    var keep = all[0];
    for (var i = 1; i < all.length; i++){
      if (all[i].parentNode) all[i].parentNode.removeChild(all[i]);
    }
    if (keep.parentNode !== document.body) document.body.appendChild(keep);
    return keep;
  }

  function bind(){
    var m = dedupe('#fjSupModal');
    var s = dedupe('#fjSupScrim');
    if (!m || !s || m.dataset.fjBound) return;
    m.dataset.fjBound = '1';

    var c = $('fjSupClose');
    if (c) c.addEventListener('click', shut);
    s.addEventListener('click', shut);

    var f = $('fjSupForm');
    if (f) f.addEventListener('submit', submit);
  }

  document.addEventListener('click', function(e){
    var t = (e.target && e.target.closest) ? e.target.closest('[data-fj-support]') : null;
    if (!t) return;
    e.preventDefault();
    bind();
    open();
  }, true);

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') shut();
  });

  ['DOMContentLoaded','load'].forEach(function(ev){ addEventListener(ev, bind); });
  [200,600,1200,2500].forEach(function(ms){ setTimeout(bind, ms); });
  bind();
})();
