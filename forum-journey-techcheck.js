/* Forum Journey — tech check pop-up
   Hosted because OP's sanitizer rejects inline getUserMedia/AudioContext. */
(function(){
  if (window.__lmFjTechInit) return;
  window.__lmFjTechInit = true;

  var $ = function(id){ return document.getElementById(id); };
  var stream = null, audioCtx = null, analyser = null, rafId = null, step = 1;
  var STEPS = 3;

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

  function showStep(n){
    step = n;
    for (var i = 1; i <= STEPS; i++){
      var p = $('fjTechStep' + i);
      if (p) p.classList.toggle('is-on', i === n);
      var d = $('fjTechDot' + i);
      if (d) d.classList.toggle('is-on', i === n);
    }
    var back = $('fjTechBack'), next = $('fjTechNext');
    if (back) back.style.visibility = (n === 1) ? 'hidden' : 'visible';
    if (next) next.textContent = (n === STEPS) ? 'Done' : 'Next \u2192';
    syncNext();
    var body = $('fjTechBody');
    if (body) body.scrollTop = 0;
  }

  function syncNext(){
    var next = $('fjTechNext');
    if (!next) return;
    var confirmed = $('fjTechConfirm') && $('fjTechConfirm').checked;
    next.disabled = (step === 1 && !confirmed);
  }

  function stopMedia(){
    if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
    if (stream){
      stream.getTracks().forEach(function(t){ try { t.stop(); } catch(e){} });
      stream = null;
    }
    if (audioCtx){
      try { audioCtx.close(); } catch(e){}
      audioCtx = null;
    }
    analyser = null;
    var v = $('fjTechVideo');
    if (v) v.srcObject = null;
    var note = $('fjTechCamNote');
    if (note) note.style.display = '';
    var lvl = $('fjTechLevel');
    if (lvl) lvl.style.width = '0';
    var btn = $('fjTechStart');
    if (btn){ btn.disabled = false; btn.textContent = 'Start camera & mic test'; }
  }

  function meter(){
    if (!analyser) return;
    var data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    var peak = 0;
    for (var i = 0; i < data.length; i++){
      var d = Math.abs(data[i] - 128);
      if (d > peak) peak = d;
    }
    var pct = Math.min(100, Math.round((peak / 60) * 100));
    var lvl = $('fjTechLevel');
    if (lvl) lvl.style.width = pct + '%';
    rafId = requestAnimationFrame(meter);
  }

  function start(){
    var status = $('fjTechStatus'), btn = $('fjTechStart');
    if (status) status.textContent = '';

    if (!window.isSecureContext){
      if (status) status.textContent = 'This test needs a secure (https) connection. Please open this page over https and try again.';
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      if (status) status.textContent = 'Your browser can\u2019t run this test. You can still test your setup in Zoom before Day One.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Starting\u2026';

    navigator.mediaDevices.getUserMedia({video:true, audio:true})
      .then(function(s){
        stream = s;
        var v = $('fjTechVideo');
        if (v){ v.srcObject = s; v.play().catch(function(){}); }
        var note = $('fjTechCamNote');
        if (note) note.style.display = 'none';
        btn.textContent = 'Test running\u2026';

        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC){
          audioCtx = new AC();
          var src = audioCtx.createMediaStreamSource(s);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 1024;
          src.connect(analyser);
          meter();
        }
      })
      .catch(function(err){
        btn.disabled = false;
        btn.textContent = 'Start camera & mic test';
        var msg = 'We couldn\u2019t reach your camera or microphone.';
        if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')){
          msg = 'Your browser blocked access. Click the camera icon in the address bar, allow camera and microphone, then try again.';
        } else if (err && err.name === 'NotFoundError'){
          msg = 'No camera or microphone was found on this device. Try joining from a computer or tablet.';
        }
        if (status) status.textContent = msg;
      });
  }

  function testSound(){
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
    setTimeout(function(){ try { ctx.close(); } catch(e){} }, 1600);
  }

  function open(){
    $('fjTechScrim').classList.add('is-open');
    $('fjTechModal').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    showStep(1);
  }

  function shut(){
    var s = $('fjTechScrim'), m = $('fjTechModal');
    if (s) s.classList.remove('is-open');
    if (m) m.classList.remove('is-open');
    document.body.style.overflow = '';
    stopMedia();
    var c = $('fjTechConfirm');
    if (c) c.checked = false;
    showStep(1);
  }

  function bind(){
    var m = dedupe('#fjTechModal');
    var s = dedupe('#fjTechScrim');
    if (!m || !s || m.dataset.fjBound) return;
    m.dataset.fjBound = '1';

    var c = $('fjTechClose');   if (c) c.addEventListener('click', shut);
    s.addEventListener('click', shut);

    var st = $('fjTechStart');  if (st) st.addEventListener('click', start);
    var ts = $('fjTechSound');  if (ts) ts.addEventListener('click', testSound);
    var cb = $('fjTechConfirm');if (cb) cb.addEventListener('change', syncNext);

    var back = $('fjTechBack');
    if (back) back.addEventListener('click', function(){ if (step > 1) showStep(step - 1); });

    var next = $('fjTechNext');
    if (next) next.addEventListener('click', function(){
      if (step >= STEPS) { shut(); return; }
      showStep(step + 1);
    });

    showStep(1);
  }

  document.addEventListener('click', function(e){
    var t = (e.target && e.target.closest) ? e.target.closest('[data-fj-tech], .fj-tech-trigger') : null;
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
