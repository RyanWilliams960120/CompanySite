(function () {
  'use strict';

  var form = document.getElementById('careersApplyForm');
  if (!form) return;

  var jobs = window.CAREERS_JOBS || [];
  var findJob = window.findCareersJob;
  var positionInput = document.getElementById('position');
  var positionSelect = document.getElementById('positionSelect');
  var positionSelectGroup = document.getElementById('positionSelectGroup');
  var roleTitle = document.getElementById('applyRoleTitle');
  var roleMeta = document.getElementById('applyRoleMeta');
  var heroLead = document.getElementById('applyHeroLead');
  var started = document.getElementById('formStarted');
  var statusEl = document.getElementById('formStatus');
  var submitBtn = document.getElementById('applySubmit');
  var successEl = document.getElementById('applySuccess');
  var submitting = false;

  var MAX_RESUME_BYTES = 2 * 1024 * 1024;
  var ALLOWED_RESUME = {
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true
  };

  if (started) started.value = String(Date.now());

  function params() {
    try {
      return new URLSearchParams(window.location.search);
    } catch (err) {
      return { get: function () { return ''; } };
    }
  }

  function selectedJob() {
    var key = (positionInput && positionInput.value) || params().get('position') || '';
    return findJob ? findJob(key) : null;
  }

  function setRole(job) {
    if (!job) {
      if (roleTitle) roleTitle.textContent = 'Select a position';
      if (roleMeta) roleMeta.textContent = '';
      if (positionInput) positionInput.value = '';
      if (positionSelectGroup) positionSelectGroup.hidden = false;
      return;
    }
    if (positionInput) positionInput.value = job.slug;
    if (roleTitle) roleTitle.textContent = job.title;
    if (roleMeta) roleMeta.textContent = job.department + ' · ' + job.location;
    if (heroLead) heroLead.textContent = 'Applying for: ' + job.title;
    if (positionSelect) positionSelect.value = job.slug;
    if (positionSelectGroup) positionSelectGroup.hidden = true;
    document.title = 'Apply — ' + job.title + ' | DracoinLabs';
  }

  function populateSelect() {
    if (!positionSelect) return;
    jobs.forEach(function (job) {
      var opt = document.createElement('option');
      opt.value = job.slug;
      opt.textContent = job.title;
      positionSelect.appendChild(opt);
    });
    positionSelect.addEventListener('change', function () {
      var job = findJob(positionSelect.value);
      setRole(job);
      if (job && history.replaceState) {
        try {
          var next = (location.protocol === 'file:' || /index\.html$/i.test(location.pathname || ''))
            ? 'index.html?position=' + encodeURIComponent(job.slug)
            : '/careers/apply?position=' + encodeURIComponent(job.slug);
          history.replaceState(null, '', next);
        } catch (err) { /* ignore */ }
      }
    });
  }

  function clearErrors() {
    form.querySelectorAll('.field-error').forEach(function (el) {
      el.textContent = '';
    });
    form.querySelectorAll('.is-invalid').forEach(function (el) {
      el.classList.remove('is-invalid');
    });
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'form-status';
    }
  }

  function setError(name, message) {
    var field = document.getElementById(name);
    if (field && field.classList) field.classList.add('is-invalid');
    var err = form.querySelector('[data-error-for="' + name + '"]');
    if (err) err.textContent = message;
  }

  function val(name) {
    var el = document.getElementById(name);
    return el ? String(el.value || '').trim() : '';
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

  function resumeOk(file) {
    if (!file) return 'Please attach your resume or CV.';
    if (file.size > MAX_RESUME_BYTES) return 'Resume must be 2 MB or smaller.';
    var name = (file.name || '').toLowerCase();
    var extOk = /\.(pdf|doc|docx)$/.test(name);
    var typeOk = !file.type || ALLOWED_RESUME[file.type];
    if (!extOk || !typeOk) return 'Resume must be a PDF, DOC, or DOCX file.';
    return '';
  }

  function validate() {
    clearErrors();
    var ok = true;
    var job = selectedJob();
    if (!job) {
      setError('position', 'Please select a position.');
      ok = false;
    }
    if (!val('name')) { setError('name', 'Full name is required.'); ok = false; }
    if (!val('email')) {
      setError('email', 'Email address is required.');
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email'))) {
      setError('email', 'Enter a valid email address.');
      ok = false;
    }
    if (!val('linkedin')) {
      setError('linkedin', 'LinkedIn URL is required.');
      ok = false;
    } else if (!validUrl(val('linkedin'))) {
      setError('linkedin', 'Enter a valid LinkedIn URL.');
      ok = false;
    }
    if (val('github') && !validUrl(val('github'))) {
      setError('github', 'Enter a valid GitHub URL.');
      ok = false;
    }
    if (val('portfolio') && !validUrl(val('portfolio'))) {
      setError('portfolio', 'Enter a valid portfolio URL.');
      ok = false;
    }
    var exp = val('experience');
    if (exp === '') {
      setError('experience', 'Years of experience is required.');
      ok = false;
    } else if (!/^\d+$/.test(exp) || Number(exp) > 50) {
      setError('experience', 'Enter a number between 0 and 50.');
      ok = false;
    }
    if (val('cover').length > 8000) {
      setError('cover', 'Cover letter must be 8,000 characters or fewer.');
      ok = false;
    }
    var resumeInput = document.getElementById('resume');
    var resumeErr = resumeOk(resumeInput && resumeInput.files && resumeInput.files[0]);
    if (resumeErr) {
      setError('resume', resumeErr);
      ok = false;
    }
    return ok;
  }

  populateSelect();
  setRole(findJob(params().get('position')));

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) {
      if (statusEl) {
        statusEl.textContent = 'Please correct the highlighted fields.';
        statusEl.className = 'form-status error';
      }
      return;
    }

    submitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      submitBtn.classList.add('loading');
    }
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'form-status';
    }

    var data = new FormData(form);
    var job = selectedJob();
    if (job) data.set('position', job.slug);

    fetch('/api/apply', {
      method: 'POST',
      body: data,
      credentials: 'same-origin'
    }).then(function (res) {
      return res.json().then(function (body) {
        return {
          ok: res.ok && body && body.ok,
          status: res.status,
          error: body && body.error
        };
      }).catch(function () {
        return { ok: false, status: res.status };
      });
    }).then(function (result) {
      if (!result.ok) {
        var message = result.error || 'Unable to submit your application right now. Please try again.';
        if (result.status === 429) {
          message = result.error || 'Too many applications from this network. Please try again later.';
        }
        throw new Error(message);
      }
      form.reset();
      if (started) started.value = String(Date.now());
      form.hidden = true;
      if (successEl) {
        successEl.hidden = false;
        successEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }).catch(function (err) {
      if (statusEl) {
        statusEl.textContent = err.message || 'Unable to submit your application right now. Please try again.';
        statusEl.className = 'form-status error';
      }
      submitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
        submitBtn.classList.remove('loading');
      }
    });
  });
})();
