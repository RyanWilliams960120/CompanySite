(function () {
  'use strict';

  function api(path, opts) {
    return fetch(path, Object.assign({
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }, opts)).then(function (res) {
      return res.json().then(function (body) {
        return { ok: res.ok && body && body.ok !== false, status: res.status, body: body || {} };
      }).catch(function () {
        return { ok: false, status: res.status, body: {} };
      });
    });
  }

  function requireSession() {
    return api('/api/admin/session').then(function (result) {
      if (!result.ok) {
        location.replace('/admin/login?next=' + encodeURIComponent(location.pathname + location.search));
        throw new Error('unauthorized');
      }
      document.body.classList.remove('ats-locked');
    });
  }

  function bindLogout() {
    document.querySelectorAll('[data-admin-logout]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
          .finally(function () {
            location.replace('/admin/login');
          });
      });
    });
  }

  function formatDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function statusLabel(status) {
    return String(status || 'new').replace(/^\w/, function (c) { return c.toUpperCase(); });
  }

  function dash(value) {
    return value ? String(value) : 'Not provided';
  }

  function fillSelect(select, values, placeholder) {
    if (!select) return;
    var current = select.value;
    select.innerHTML = '';
    if (placeholder) {
      var all = document.createElement('option');
      all.value = '';
      all.textContent = placeholder;
      select.appendChild(all);
    }
    (values || []).forEach(function (value) {
      var opt = document.createElement('option');
      opt.value = value;
      opt.textContent = statusLabel(value);
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  function setStatus(el, message, isError) {
    if (!el) return;
    el.textContent = message || '';
    el.className = 'form-status' + (isError ? ' error' : '');
  }

  function dlItem(term, value, isLink) {
    var wrap = document.createElement('div');
    var dt = document.createElement('dt');
    var dd = document.createElement('dd');
    dt.textContent = term;
    if (isLink && value) {
      var a = document.createElement('a');
      a.href = value;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = value;
      dd.appendChild(a);
    } else {
      dd.textContent = dash(value);
    }
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    return wrap;
  }

  function initList() {
    var filters = document.getElementById('atsFilters');
    var body = document.getElementById('atsBody');
    var empty = document.getElementById('atsEmpty');
    var statusEl = document.getElementById('atsStatus');
    var positionSelect = document.getElementById('position');
    var statusSelect = document.getElementById('status');
    if (!filters || !body) return;

    function load() {
      var params = new URLSearchParams();
      var q = document.getElementById('q').value.trim();
      var position = positionSelect.value;
      var status = statusSelect.value;
      var sort = document.getElementById('sort').value;
      if (q) params.set('q', q);
      if (position) params.set('position', position);
      if (status) params.set('status', status);
      if (sort) params.set('sort', sort);
      setStatus(statusEl, 'Loading applications...');

      api('/api/admin/applications?' + params.toString()).then(function (result) {
        if (result.status === 401) {
          location.replace('/admin/login?next=' + encodeURIComponent(location.pathname + location.search));
          return;
        }
        if (!result.ok) {
          throw new Error((result.body && result.body.error) || 'Unable to load applications.');
        }
        fillSelect(positionSelect, result.body.positions, 'All positions');
        fillSelect(statusSelect, result.body.statuses, 'All statuses');
        if (position) positionSelect.value = position;
        if (status) statusSelect.value = status;

        var rows = result.body.applications || [];
        body.innerHTML = '';
        empty.hidden = rows.length > 0;
        rows.forEach(function (app) {
          var tr = document.createElement('tr');
          tr.tabIndex = 0;
          tr.innerHTML =
            '<td><strong>' + escapeHtml(app.name) + '</strong><div class="ats-sub">' + escapeHtml(app.email) + '</div></td>' +
            '<td>' + escapeHtml(app.position) + '</td>' +
            '<td>' + escapeHtml(formatDate(app.created_at)) + '</td>' +
            '<td>' + escapeHtml(String(app.experience_years)) + ' yrs</td>' +
            '<td><span class="status-pill status-pill--' + escapeHtml(app.status) + '">' + escapeHtml(statusLabel(app.status)) + '</span></td>';
          function open() {
            location.href = '/admin/application?id=' + encodeURIComponent(app.id);
          }
          tr.addEventListener('click', open);
          tr.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open();
            }
          });
          body.appendChild(tr);
        });
        setStatus(statusEl, rows.length ? rows.length + ' application' + (rows.length === 1 ? '' : 's') : '');
      }).catch(function (err) {
        setStatus(statusEl, err.message || 'Unable to load applications.', true);
      });
    }

    filters.addEventListener('submit', function (e) {
      e.preventDefault();
      load();
    });
    ['input', 'change'].forEach(function (eventName) {
      filters.addEventListener(eventName, function () {
        window.clearTimeout(filters._timer);
        filters._timer = window.setTimeout(load, eventName === 'input' ? 250 : 0);
      });
    });

    load();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initDetail() {
    var article = document.getElementById('atsDetail');
    if (!article) return;
    var params = new URLSearchParams(location.search);
    var id = params.get('id') || '';
    var statusEl = document.getElementById('detailStatus');
    var statusSelect = document.getElementById('statusSelect');
    var statusForm = document.getElementById('statusForm');

    if (!id) {
      setStatus(statusEl, 'Application not found.', true);
      return;
    }

    function render(app, statuses) {
      article.hidden = false;
      document.title = app.name + ' | DracoinLabs Recruiting';
      document.getElementById('detailName').textContent = app.name;
      document.getElementById('detailPosition').textContent = app.position;
      var pill = document.getElementById('detailStatusPill');
      pill.className = 'status-pill status-pill--' + app.status;
      pill.textContent = statusLabel(app.status);

      var contact = document.getElementById('detailContact');
      contact.innerHTML = '';
      contact.appendChild(dlItem('Email', app.email));
      contact.appendChild(dlItem('Phone', app.phone));
      contact.appendChild(dlItem('Location', app.location));

      var links = document.getElementById('detailLinks');
      links.innerHTML = '';
      links.appendChild(dlItem('LinkedIn', app.linkedin, true));
      links.appendChild(dlItem('GitHub', app.github, true));
      links.appendChild(dlItem('Portfolio', app.portfolio, true));

      var work = document.getElementById('detailWork');
      work.innerHTML = '';
      work.appendChild(dlItem('Years of experience', String(app.experience_years)));
      work.appendChild(dlItem('Employment type', app.employment_type));
      work.appendChild(dlItem('Compensation', app.compensation));
      work.appendChild(dlItem('Availability', app.availability));

      document.getElementById('detailCover').textContent = app.cover_letter || 'Not provided';
      document.getElementById('detailResumeMeta').textContent =
        (app.resume_filename || 'resume') + (app.resume_size ? ' · ' + Math.round(app.resume_size / 1024) + ' KB' : '');
      document.getElementById('detailResume').href = '/api/admin/resume?id=' + encodeURIComponent(app.id);
      document.getElementById('detailDates').textContent =
        'Created ' + formatDate(app.created_at) +
        (app.updated_at ? ' · Updated ' + formatDate(app.updated_at) : '');

      fillSelect(statusSelect, statuses || []);
      statusSelect.value = app.status;
    }

    api('/api/admin/applications?id=' + encodeURIComponent(id)).then(function (result) {
      if (result.status === 401) {
        location.replace('/admin/login');
        return;
      }
      if (!result.ok || !result.body.application) {
        throw new Error((result.body && result.body.error) || 'Application not found.');
      }
      render(result.body.application, result.body.statuses);
    }).catch(function (err) {
      setStatus(statusEl, err.message, true);
    });

    if (statusForm) {
      statusForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var saveBtn = document.getElementById('statusSave');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';
        }
        api('/api/admin/applications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ id: id, status: statusSelect.value })
        }).then(function (result) {
          if (result.status === 401) {
            location.replace('/admin/login');
            return;
          }
          if (!result.ok || !result.body.application) {
            throw new Error((result.body && result.body.error) || 'Unable to update status.');
          }
          render(result.body.application, result.body.statuses || Array.from(statusSelect.options).map(function (o) { return o.value; }));
          setStatus(statusEl, 'Status updated.');
        }).catch(function (err) {
          setStatus(statusEl, err.message, true);
        }).finally(function () {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Update status';
          }
        });
      });
    }
  }

  bindLogout();
  if (document.getElementById('adminLoginForm')) return;
  requireSession().then(function () {
    initList();
    initDetail();
  }).catch(function () { /* redirected */ });
})();
