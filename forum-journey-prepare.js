/* Forum Journey — Prepare section: FIF link builder + info-form state.
   Hosted because OP's Custom HTML sanitizer rejects inline scripts. */
(function(){
  if (window.__lmFjPrepInit) return;
  window.__lmFjPrepInit = true;

  var FIF = 'https://lm.landmarkworldwide.com/registration-confirmed';

  function clean(v){
    v = (v || '').trim();
    if (!v || v.indexOf('[') > -1 || v.indexOf('##') > -1) return '';
    return v;
  }
  function qp(k){
    try { return clean(new URLSearchParams(location.search).get(k) || ''); }
    catch(e){ return ''; }
  }
  function ss(k){ try { return clean(sessionStorage.getItem(k) || ''); } catch(e){ return ''; } }
  function pick(){
    for (var i=0;i<arguments.length;i++){ if (arguments[i]) return arguments[i]; }
    return '';
  }
  function isDone(v){
    v = (v || '').trim().toLowerCase();
    return v === 'yes' || v === 'y' || v === '1' || v === 'true' || v === 'complete' || v === 'completed';
  }

  function run(){
    var roots = document.querySelectorAll('[data-lm-fj-prepare]');
    for (var r = 0; r < roots.length; r++){
      var root = roots[r];
      if (root.dataset.lmFjReady) continue;

      var feed = {};
      root.querySelectorAll('.lm-fj-mf').forEach(function(el){
        feed[el.getAttribute('data-mf')] = clean(el.textContent);
      });

      var card = root.querySelector('[data-lm-fj-info-card]');
      if (!card) continue;

      var cuid   = pick(feed.cuid,   qp('cuid'),   ss('cuid'));
      var cemail = pick(feed.cemail, qp('cemail'), ss('cemail'));
      var cfirst = pick(feed.cfirst, qp('cfirstname'), ss('cfirstname'));
      var regid  = pick(feed.regid,  qp('regid'),  ss('regid'));

      try {
        if (cuid)   sessionStorage.setItem('cuid', cuid);
        if (cemail) sessionStorage.setItem('cemail', cemail);
        if (cfirst) sessionStorage.setItem('cfirstname', cfirst);
        if (regid)  sessionStorage.setItem('regid', regid);
      } catch(e){}

      var q = [];
      if (cuid)   q.push('cuid='       + encodeURIComponent(cuid));
      if (cemail) q.push('cemail='     + encodeURIComponent(cemail));
      if (cfirst) q.push('cfirstname=' + encodeURIComponent(cfirst));
      if (regid)  q.push('regid='      + encodeURIComponent(regid));

      card.setAttribute('href', q.length ? (FIF + '?' + q.join('&')) : FIF);

      if (isDone(feed.infodone)){
        var badge = root.querySelector('[data-lm-fj-info-badge]');
        var desc  = root.querySelector('[data-lm-fj-info-description]');
        var act   = root.querySelector('[data-lm-fj-info-action]');
        if (badge) badge.style.display = 'none';
        if (desc)  desc.textContent = 'Thanks \u2014 we have everything we need from you.';
        if (act)   act.style.display = 'none';
        card.classList.add('is-complete');
        card.removeAttribute('href');
      }

      root.dataset.lmFjReady = '1';
    }
  }

  ['DOMContentLoaded','load'].forEach(function(e){ addEventListener(e, run); });
  [200,600,1200,2500,4000].forEach(function(ms){ setTimeout(run, ms); });
  if (window.MutationObserver){
    new MutationObserver(run).observe(document.body, {childList:true, subtree:true});
  }
  run();
})();
