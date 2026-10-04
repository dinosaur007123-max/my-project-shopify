/* Mira Fragrance: small, dependency-free. Motion is skipped for reduced-motion users. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile menu
  var toggle = document.querySelector('[data-menu-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) toggle.click();
    });
  }

  // Fade and rise
  var items = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  // Light hero parallax
  var img = document.querySelector('[data-parallax]');
  var wrap = document.querySelector('[data-parallax-wrap]');
  if (img && wrap && !reduce) {
    var ticking = false;
    var update = function () {
      ticking = false;
      var rect = wrap.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      img.style.transform = 'translate3d(0,' + (-rect.top * 0.12).toFixed(1) + 'px,0)';
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // Show the chosen variant's price
  var select = document.querySelector('[data-variant-select]');
  var price = document.querySelector('[data-price]');
  if (select && price) {
    select.addEventListener('change', function () {
      var opt = select.options[select.selectedIndex];
      if (opt && opt.dataset.price) price.textContent = opt.dataset.price;
    });
  }
})();
