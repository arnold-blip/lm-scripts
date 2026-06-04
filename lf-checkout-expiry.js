(function () {
  function applyExpiredState() {
    var params = new URLSearchParams(window.location.search);
    var eRaw = params.get('e');
    if (!eRaw) return;

    var deadline = parseInt(eRaw, 10);
    if (isNaN(deadline)) return;

    if (Date.now() <= deadline) return;

    var discount = document.getElementById('lm-price-discount');
    var full     = document.getElementById('lm-price-full');
    if (discount) discount.style.display = 'none';
    if (full)     full.style.display     = 'block';
  }

  applyExpiredState();
  [150, 400, 800, 1500, 2500, 4000].forEach(function (t) {
    setTimeout(applyExpiredState, t);
  });

  var observer = new MutationObserver(applyExpiredState);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(function () { observer.disconnect(); }, 8000);
})();
