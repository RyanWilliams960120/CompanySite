(function () {
  'use strict';

  var form = document.getElementById('adminLoginForm');
  if (!form) return;

  var submitBtn = document.getElementById('loginSubmit');
  var statusEl = document.getElementById('loginStatus');
  var sending = false;

  fetch('/api/admin/session', { credentials: 'same-origin' })
    .then(function (res) { return res.json(); })
    .then(function (body) {
      if (body && body.ok) location.replace('/admin/applications');
    })
    .catch(function () { /* stay on login */ });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    sending = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
    }
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'form-status';
    }

    fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
      })
    }).then(function (res) {
      return res.json().then(function (body) {
        return { ok: res.ok && body && body.ok, error: body && body.error };
      }).catch(function () {
        return { ok: false };
      });
    }).then(function (result) {
      if (!result.ok) {
        throw new Error(result.error || 'Invalid username or password.');
      }
      location.replace('/admin/applications');
    }).catch(function (err) {
      sending = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
      }
      if (statusEl) {
        statusEl.textContent = err.message || 'Unable to sign in.';
        statusEl.className = 'form-status error';
      }
    });
  });
})();
