/* Forum Journey — 15-minute conversation pop-up */
(function(){
  if (window.__lmFjConvoInit) return;
  window.__lmFjConvoInit = true;

  var WEBHOOK_URL = 'https://landmarkworldwide.awesomate.io/webhook/forum-journey-conversation';

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
  function ss(k){ try { return clean(sessionStorage.getItem(k) || ''); } catch(e){ return ''; } }
  function pick(){
    for (var i=0;i<arguments.length;i++){ if (arguments[i]) return arguments[i]; }
    return '';
  }

  var identity = {};

  function hydrate(){
    identity.cuid  = pick(mf('fjCvMfCuid'),  qp('cuid'),  ss('cuid'));
    identity.email = pick(mf('fjCvMfEmail'), qp('cemail'), ss('cemail'));
    identity.first = pick(mf('fjCvMfFirst'), qp('cfirstname'), ss('cfirstname'));
    identity.last  = pick(mf('fjCvMfLast'),  ss('clastname'));
    identity.phone = pick(mf('fjCvMfPhone'), ss('cphone'));

    try {
      if (identity.cuid)  sessionStorage.setItem('cuid', identity.cuid);
      if (identity.email) sessionStorage.setItem('cemail', identity.email);
      if (identity.first) sessionStorage.setItem('cfirstname', identity.first);
    } catch(e){}

    var n = $('fjCvName'), e = $('fjCvEmail'), p = $('fjCvPhone');
    if (n && !n.value) n.value = [identity.first, identity.last].filter(Boolean).join(' ');
    if (e && !e.value) e.value = identity.email;
    if (p && !p.value) p.value = identity.phone;
  }

  function open(){
    hydrate();
    var s = $('fjCvScrim'), m = $('fjCvModal');
    if (!s || !m) return;
    s.classList.add('is-open');
    m.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var n = $('fjCvName');
    if (n) setTimeout(function(){ n.focus(); }, 60);
  }

  function shut(){
    var s = $('fjCvScrim'), m = $('fjCvModal');
    if (s) s.classList.remove('is-open');
    if (m) m.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function setErr(id, on){
    var f = $(id);
    if (f) f.classList.toggle('has-error', !!on);
  }

  function validate(){
    var ok = true;
    var name  = $('fjCvName').value.trim();
    var email = $('fjCvEmail').value.trim();
    var phone = $('fjCvPhone').value.trim();
    var time  = $('fjCvTime').value.trim();

    setErr('fjCvNameField', !name); if (!name) ok = false;

    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setErr('fjCvEmailField', !emailOk); if (!emailOk) ok = false;

    setErr('fjCvPhoneField', !phone); if (!phone) ok = false;
    setErr('fjCvTimeField', !time);   if (!time) ok = false;

    return ok;
  }

  function submit(ev){
    ev.preventDefault();
    if ($('fjCvHp').value) return;
    $('fjCvFail').classList.remove('is-on');
    if (!validate()) return;

    var btn = $('fjCvSubmit');
    btn.disabled = true;
    btn.textContent = 'Sending\u2026';

    var full = $('fjCvName').value.trim();
    var sp = full.indexOf(' ');

    var payload = {
      source: 'forum-journey-conversation',
      contactId: identity.cuid || '',
      firstName: sp > -1 ? full.slice(0, sp) : full,
      lastName:  sp > -1 ? full.slice(sp + 1) : '',
      email: $('fjCvEmail').value.trim(),
      phone: $('fjCvPhone').value.trim(),
      bestTime: $('fjCvTime').value.trim(),
      message: $('fjCvMsg').value.trim(),
      pageUrl: location.href
    };

    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function(){
      $('fjCvForm').style.display = 'none';
      $('fjCvDone').classList.add('is-on');
    })
    .catch(function(){
      $('fjCvFail').classList.add('is-on');
      btn.disabled = false;
      btn.textContent = 'Request a conversation';
    });
  }

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
    var m = dedupe('#fjCvModal');
    var s = dedupe('#fjCvScrim');
    if (!m || !s || m.dataset.fjBound) return;
    m.dataset.fjBound = '1';

    var c = $('fjCvClose'); if (c) c.addEventListener('click', shut);
    s.addEventListener('click', shut);
    var f = $('fjCvForm');  if (f) f.addEventListener('submit', submit);
  }

  document.addEventListener('click', function(e){
    var t = (e.target && e.target.closest) ? e.target.closest('[data-fj-convo], .fj-convo-trigger') : null;
    if (!t) return;
    e.preventDefault();
    bind();
    open();
  }, true);

  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') shut(); });

  ['DOMContentLoaded','load'].forEach(function(ev){ addEventListener(ev, bind); });
  [200,600,1200,2500].forEach(function(ms){ setTimeout(bind, ms); });
  bind();
})();
