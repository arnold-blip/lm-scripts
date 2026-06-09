(function () {
  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function isDiscountValid() {
    var params = getParams();
    var eRaw = params.get('e');
    if (!eRaw) return false;
    var deadline = parseInt(eRaw, 10);
    if (isNaN(deadline)) return false;
    return Date.now() <= deadline;
  }

  function applyPriceDisplay() {
    var discount = document.getElementById('lm-price-discount');
    var full     = document.getElementById('lm-price-full');
    if (isDiscountValid()) {
      if (discount) discount.style.display = 'block';
      if (full)     full.style.display     = 'none';
    } else {
      if (discount) discount.style.display = 'none';
      if (full)     full.style.display     = 'block';
    }
  }

  var couponDone = false;
  function applyCoupon() {
    if (couponDone) return;
    if (!isDiscountValid()) return;

    var params = getParams();
    var code = params.get('coupon');
    if (!code) return;

    var input = document.querySelector('input[name="couponCode"]');
    var btn   = document.querySelector('.coupon-code-submit-btn');
    if (!input || !btn) return;

    input.value = code;
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    btn.click();
    couponDone = true;
  }

  function run() {
    applyPriceDisplay();
    applyCoupon();
  }

  run();
  [150, 400, 800, 1500, 2500, 4000, 6000].forEach(function (t) {
    setTimeout(run, t);
  });

  var observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(function () { observer.disconnect(); }, 9000);
})();
