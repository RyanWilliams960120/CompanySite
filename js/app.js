(function () {
  'use strict';

  var header = document.getElementById('header');
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  var contactForm = document.getElementById('contactForm');
  var applyForm = document.getElementById('applyForm');
  var formStatus = document.getElementById('formStatus');

  if (header) {
    var hero = document.querySelector('.hero');
    var hasHero = !!hero;

    if (hasHero) {
      header.classList.add('header--dark');
    } else {
      header.classList.add('header--solid');
    }

    function onScroll() {
      if (!hasHero) return;
      if (window.scrollY > 48) {
        header.classList.remove('header--dark');
        header.classList.add('header--solid');
      } else {
        header.classList.add('header--dark');
        header.classList.remove('header--solid');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.classList.toggle('open', open);
    });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('open');
        navToggle.classList.remove('open');
      });
    });
  }

  var revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -32px 0px' });
    revealEls.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i * 0.05, 0.3) + 's';
      obs.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  function bindForm(form, validate, msg) {
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!formStatus) return;
      formStatus.textContent = '';
      formStatus.className = 'form-status';
      var err = validate();
      if (err) { formStatus.textContent = err; formStatus.classList.add('error'); return; }
      var btn = form.querySelector('[type="submit"]');
      if (btn) btn.classList.add('loading');
      setTimeout(function () {
        formStatus.textContent = msg;
        formStatus.classList.add('success');
        form.reset();
        if (btn) btn.classList.remove('loading');
      }, 700);
    });
  }

  if (contactForm) {
    var contactSubmit = document.getElementById('contactSubmit') || contactForm.querySelector('[type="submit"]');
    var contactSending = false;
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (contactSending) return;
      if (!formStatus) return;
      formStatus.textContent = '';
      formStatus.className = 'form-status';
      var n = contactForm.name.value.trim();
      var em = contactForm.email.value.trim();
      var m = contactForm.message.value.trim();
      if (!n || !em || !m) {
        formStatus.textContent = 'Please fill in all required fields.';
        formStatus.classList.add('error');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        formStatus.textContent = 'Please enter a valid email address.';
        formStatus.classList.add('error');
        return;
      }
      contactSending = true;
      if (contactSubmit) {
        contactSubmit.disabled = true;
        contactSubmit.textContent = 'Sending...';
        contactSubmit.classList.add('loading');
      }
      fetch('/api/contact', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: n,
          email: em,
          company: contactForm.company ? contactForm.company.value.trim() : '',
          service: contactForm.service ? contactForm.service.value : '',
          message: m,
          website: contactForm.website ? contactForm.website.value : ''
        })
      }).then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok && body && body.ok, error: body && body.error };
        }).catch(function () {
          return { ok: false };
        });
      }).then(function (result) {
        if (!result.ok) {
          throw new Error(result.error || 'Unable to send your message right now. Please try again.');
        }
        formStatus.textContent = 'Thank you. We\'ll respond within one business day.';
        formStatus.classList.add('success');
        contactForm.reset();
      }).catch(function (err) {
        formStatus.textContent = err.message || 'Unable to send your message right now. Please try again.';
        formStatus.classList.add('error');
      }).finally(function () {
        contactSending = false;
        if (contactSubmit) {
          contactSubmit.disabled = false;
          contactSubmit.textContent = 'Send message';
          contactSubmit.classList.remove('loading');
        }
      });
    });
  }

  function fieldValue(form, name) {
    var el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  }

  function isRequired(form, name) {
    var el = form.elements[name];
    return !!(el && el.required);
  }

  function validUrl(value) {
    if (!value) return true;
    try {
      var parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  bindForm(applyForm, function () {
    var n = fieldValue(applyForm, 'name');
    var e = fieldValue(applyForm, 'email');
    var g = fieldValue(applyForm, 'github');
    var eng = fieldValue(applyForm, 'engagement');
    var exp = fieldValue(applyForm, 'experience');
    var resume = fieldValue(applyForm, 'resume');
    var position = fieldValue(applyForm, 'position');
    var linkedin = fieldValue(applyForm, 'linkedin');
    var portfolio = fieldValue(applyForm, 'portfolio');

    if (!n || !e) return 'Please fill in all required fields.';
    if (isRequired(applyForm, 'position') && !position) return 'Please select a position.';
    if (isRequired(applyForm, 'github') && !g) return 'Please fill in all required fields.';
    if (isRequired(applyForm, 'engagement') && !eng) return 'Please fill in all required fields.';
    if (isRequired(applyForm, 'experience') && !exp) return 'Please fill in all required fields.';
    if (isRequired(applyForm, 'resume') && !resume) return 'Please provide a link to your CV or resume.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Please enter a valid email address.';
    if (!validUrl(g) || !validUrl(resume) || !validUrl(linkedin) || !validUrl(portfolio)) {
      return 'Please enter valid http(s) URLs for profile and resume links.';
    }
    return null;
  }, 'Thank you. Your application has been received.');
})();
