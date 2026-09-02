/* ==========================================================================
   RayBen Diagnostics
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------------
     Header shadow + back-to-top
     ---------------------------------------------------------------------- */
  var header = doc.getElementById('siteHeader');
  var toTop = doc.getElementById('toTop');
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset || doc.documentElement.scrollTop;
    if (header) header.classList.toggle('is-stuck', y > 12);
    if (toTop) toTop.classList.toggle('is-visible', y > 700);
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ----------------------------------------------------------------------
     Current section highlight
     ---------------------------------------------------------------------- */
  var navLinks = Array.prototype.slice.call(doc.querySelectorAll('.navbar-nav .nav-link[href^="#"]'));
  var sections = navLinks
    .map(function (link) { return doc.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (section) { navObserver.observe(section); });
  }

  /* ----------------------------------------------------------------------
     Close the mobile menu after a choice
     ---------------------------------------------------------------------- */
  var navCollapse = doc.getElementById('primaryNav');
  if (navCollapse) {
    navCollapse.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (!navCollapse.classList.contains('show')) return;
        if (window.bootstrap && window.bootstrap.Collapse) {
          window.bootstrap.Collapse.getOrCreateInstance(navCollapse).hide();
        }
      });
    });
  }

  /* ----------------------------------------------------------------------
     "What would you like to check?" → booking form
     Any element with data-book="…" loads that value into the booking
     form's test dropdown, scrolls the form into view and highlights it.
     ---------------------------------------------------------------------- */
  var bookCard = doc.getElementById('book');
  var testSelect = doc.getElementById('bkTest');

  function selectTest(value) {
    if (!testSelect) return;
    var matched = false;
    Array.prototype.forEach.call(testSelect.options, function (option) {
      if (option.text.trim().toLowerCase() === value.trim().toLowerCase()) {
        testSelect.value = option.value || option.text;
        matched = true;
      }
    });
    if (!matched) {
      var extra = doc.createElement('option');
      extra.text = value;
      testSelect.add(extra);
      testSelect.value = extra.value || extra.text;
    }
    testSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function focusFirstEmpty(form) {
    var fields = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].value) { fields[i].focus({ preventScroll: true }); return; }
    }
  }

  doc.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-book]');
    if (!trigger) return;

    event.preventDefault();
    selectTest(trigger.getAttribute('data-book'));

    if (!bookCard) return;
    bookCard.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });

    bookCard.classList.remove('is-flash');
    void bookCard.offsetWidth;
    bookCard.classList.add('is-flash');

    window.setTimeout(function () {
      var form = doc.getElementById('bookingForm');
      if (form) focusFirstEmpty(form);
    }, reduceMotion ? 0 : 550);
  });

  /* ----------------------------------------------------------------------
     Missing images should never show raw alt text over a card
     ---------------------------------------------------------------------- */
  doc.querySelectorAll('.test > img, .branch img, .story__visual img, .framed img').forEach(function (img) {
    img.addEventListener('error', function () { img.classList.add('is-broken'); });
    if (img.complete && img.naturalWidth === 0) img.classList.add('is-broken');
  });

  /* ----------------------------------------------------------------------
     One scroll reveal
     ---------------------------------------------------------------------- */
  var revealTargets = doc.querySelectorAll(
    '.concern, .testlist li, .pack, .why__cell, .test, .branch, .steps__item, ' +
    '.story__visual, .story__stats, .quote, .panel, .insurers li, .accred__marks, .homevisit'
  );

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('reveal'); });
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var delay = Math.min(i, 5) * 60;
        window.setTimeout(function () { entry.target.classList.add('is-in'); }, delay);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ----------------------------------------------------------------------
     Lead forms
     Posts to data-endpoint when one is set; otherwise hands the enquiry
     to WhatsApp so no lead is lost while the backend is being wired up.
     ---------------------------------------------------------------------- */
  var LABELS = {
    name: 'Name', phone: 'Phone', email: 'Email',
    test: 'Test', location: 'Where', subject: 'Subject', message: 'Message'
  };

  function serialise(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      data[key] = typeof value === 'string' ? value.trim() : value;
    });
    return data;
  }

  function toWhatsAppText(data, heading) {
    var lines = [heading, ''];
    Object.keys(data).forEach(function (key) {
      if (!data[key]) return;
      lines.push((LABELS[key] || key) + ': ' + data[key]);
    });
    return encodeURIComponent(lines.join('\n'));
  }

  function setStatus(node, message, ok) {
    if (!node) return;
    node.textContent = message;
    node.classList.add('is-visible');
    node.classList.toggle('is-ok', !!ok);
    node.classList.toggle('is-error', !ok);
  }

  function handleForm(formId, statusId, heading, successText) {
    var form = doc.getElementById(formId);
    if (!form) return;
    var status = doc.getElementById(statusId);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        var firstInvalid = form.querySelector(':invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      var button = form.querySelector('button[type="submit"]');
      var data = serialise(form);
      var endpoint = form.getAttribute('data-endpoint');
      var whatsapp = form.getAttribute('data-whatsapp');

      data.page = window.location.href;
      data.submitted_at = new Date().toISOString();

      if (button) button.classList.add('is-loading');

      function finish(ok, message) {
        if (button) button.classList.remove('is-loading');
        setStatus(status, message, ok);
        if (ok) { form.reset(); form.classList.remove('was-validated'); }
      }

      if (endpoint) {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
          .then(function (response) {
            if (!response.ok) throw new Error('Request failed');
            finish(true, successText);
          })
          .catch(function () {
            finish(false, 'That did not send. Call 0540 121 563 or message us on WhatsApp and we will take the details directly.');
          });
        return;
      }

      if (whatsapp) {
        window.open('https://wa.me/' + whatsapp + '?text=' + toWhatsAppText(data, heading), '_blank', 'noopener');
        finish(true, successText);
        return;
      }

      finish(false, 'No delivery method is configured for this form yet.');
    });
  }

  handleForm(
    'bookingForm', 'bookingStatus',
    'New test booking from raybendiagnostics.com',
    'Booking received. An officer will call you shortly to confirm the time and the price.'
  );

  handleForm(
    'contactForm', 'contactStatus',
    'New message from raybendiagnostics.com',
    'Message sent. We reply the same working day, Monday to Saturday.'
  );

  /* ----------------------------------------------------------------------
     Footer year
     ---------------------------------------------------------------------- */
  var year = doc.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
