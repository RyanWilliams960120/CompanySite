(function () {
  'use strict';

  var jobs = window.CAREERS_JOBS || [];
  var list = document.getElementById('jobList');
  if (!list || !jobs.length) return;

  var filterDept = document.getElementById('filterDept');
  var filterType = document.getElementById('filterType');
  var filterTech = document.getElementById('filterTech');
  var resultCount = document.getElementById('jobResultCount');
  var emptyState = document.getElementById('jobEmpty');
  var drawer = document.getElementById('jobDrawer');
  var drawerBody = document.getElementById('jobDrawerBody');
  var drawerTitle = document.getElementById('jobDrawerTitle');
  var positionSelect = document.getElementById('position');

  function applyUrl(job) {
    var slug = encodeURIComponent(job.slug || job.id);
    var path = (location.pathname || '').replace(/\\/g, '/');
    if (location.protocol === 'file:') {
      if (/\/careers\/index\.html$/i.test(path)) return 'apply/index.html?position=' + slug;
      return 'careers/apply/index.html?position=' + slug;
    }
    return '/careers/apply?position=' + slug;
  }

  function setHash(hash) {
    if (!history.replaceState) return;
    try {
      history.replaceState(null, '', location.pathname + (hash ? '#' + hash : ''));
    } catch (err) { /* local file protocol */ }
  }

  var currentJobId = null;
  var lastFocus = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function listItems(items) {
    return items.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');
  }

  function tags(items, className) {
    return items.map(function (item) {
      return '<span class="' + className + '">' + escapeHtml(item) + '</span>';
    }).join('');
  }

  function assessmentCopy(job) {
    if (job.assessment === 'pm') {
      return 'Shortlisted candidates complete a 60-minute practical assessment focused on project planning, dependencies, risks and delivery management for the Dracoin Cross-Chain Staking Platform.';
    }
    return 'Shortlisted candidates complete a 60-minute practical assessment based on the Dracoin Cross-Chain Staking Platform. Evaluation focuses on a working demonstration — technical problem solving, architecture, security awareness, testing and communication — rather than theoretical questions.';
  }

  function employmentLabel(job) {
    return job.employmentTypes.join(' · ');
  }

  function renderCard(job) {
    var article = document.createElement('article');
    article.className = 'card job-card';
    article.setAttribute('data-job', job.id);
    article.setAttribute('data-dept', job.department);
    article.setAttribute('data-reveal', '');

    article.innerHTML =
      '<div class="job-card-header">' +
        '<h3>' + escapeHtml(job.title) + '</h3>' +
        '<span class="job-badge">' + escapeHtml(job.location) + '</span>' +
      '</div>' +
      '<p>' + escapeHtml(job.description) + '</p>' +
      '<div class="job-meta">' +
        '<span>' + escapeHtml(employmentLabel(job)) + '</span>' +
        '<span>' + escapeHtml(job.department) + '</span>' +
      '</div>' +
      '<div class="job-comp-row">' +
        '<div><span class="comp-label">Full-time</span><strong>' + escapeHtml(job.salary) + '</strong></div>' +
        '<div><span class="comp-label">Contract / consulting</span><strong>' + escapeHtml(job.hourly) + '</strong></div>' +
      '</div>' +
      '<div class="card-tech">' + tags(job.techDisplay.slice(0, 6), 'tech-tag') + '</div>' +
      '<div class="job-card-actions">' +
        '<button type="button" class="btn btn-outline-ink" data-view="' + escapeHtml(job.id) + '">View Position</button>' +
        '<a class="btn btn-primary" href="' + applyUrl(job) + '">Apply Now</a>' +
      '</div>';

    return article;
  }

  function renderAll() {
    list.innerHTML = '';
    jobs.forEach(function (job) {
      list.appendChild(renderCard(job));
    });
    bindCardActions();
    applyFilters();
  }

  function bindCardActions() {
    list.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openJob(btn.getAttribute('data-view'));
      });
    });
  }

  function matchesFilters(job) {
    var dept = filterDept ? filterDept.value : '';
    var type = filterType ? filterType.value : '';
    var tech = filterTech ? filterTech.value : '';

    if (dept && job.department !== dept) return false;
    if (type && job.employmentTypes.indexOf(type) === -1) return false;
    if (tech && job.technologies.indexOf(tech) === -1) return false;
    return true;
  }

  function applyFilters() {
    var visible = 0;
    list.querySelectorAll('.job-card').forEach(function (card) {
      var job = jobs.find(function (j) { return j.id === card.getAttribute('data-job'); });
      var show = job && matchesFilters(job);
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (resultCount) {
      resultCount.textContent = visible === 1
        ? '1 open position'
        : visible + ' open positions';
    }
    if (emptyState) emptyState.hidden = visible !== 0;
  }

  function populatePositionSelect() {
    if (!positionSelect) return;
    var current = positionSelect.value;
    positionSelect.innerHTML = '<option value="">Select a position</option>';
    jobs.forEach(function (job) {
      var opt = document.createElement('option');
      opt.value = job.id;
      opt.textContent = job.title;
      positionSelect.appendChild(opt);
    });
    if (current) positionSelect.value = current;
  }

  function goApply(jobId) {
    var job = jobs.find(function (j) { return j.id === jobId || j.slug === jobId; });
    if (!job) return;
    window.location.href = applyUrl(job);
  }

  function drawerMarkup(job) {
    var preferred = job.preferred && job.preferred.length
      ? '<div class="skills-block"><h3>Preferred qualifications</h3><div class="skill-tags">' +
        tags(job.preferred, '') + '</div></div>'
      : '';

    return (
      '<p class="job-drawer-overview">' + escapeHtml(job.description) + '</p>' +
      '<div class="job-tags job-tags--light">' +
        '<span class="job-tag">' + escapeHtml(job.location) + '</span>' +
        '<span class="job-tag">' + escapeHtml(job.department) + '</span>' +
        '<span class="job-tag">' + escapeHtml(employmentLabel(job)) + '</span>' +
      '</div>' +
      '<div class="compensation-cards">' +
        '<div class="card comp-card"><span class="comp-label">Full-time employment</span><span class="comp-value">' +
          escapeHtml(job.salary) + '</span><span class="comp-note">Annual salary</span></div>' +
        '<div class="card comp-card"><span class="comp-label">Contract / consulting</span><span class="comp-value">' +
          escapeHtml(job.hourly) + '</span><span class="comp-note">Hourly rate</span></div>' +
      '</div>' +
      '<section class="job-section">' +
        '<h2>Job overview</h2>' +
        '<p>This role is part of the multidisciplinary team upgrading the Dracoin Cross-Chain Staking Platform into a scalable, secure and production-ready Web3 staking system across Ethereum and Solana.</p>' +
      '</section>' +
      '<section class="job-section">' +
        '<h2>Responsibilities</h2>' +
        '<ul class="job-list-items">' + listItems(job.responsibilities) + '</ul>' +
      '</section>' +
      '<section class="job-section">' +
        '<h2>Required qualifications</h2>' +
        '<div class="skill-tags">' + tags(job.required, '') + '</div>' +
      '</section>' +
      (preferred ? '<section class="job-section">' + preferred + '</section>' : '') +
      '<section class="job-section">' +
        '<h2>Technologies</h2>' +
        '<div class="skill-tags">' + tags(job.techDisplay, '') + '</div>' +
      '</section>' +
      '<section class="job-section">' +
        '<h2>Practical assessment</h2>' +
        '<p>' + escapeHtml(assessmentCopy(job)) + '</p>' +
      '</section>' +
      '<div class="job-drawer-cta">' +
        '<a class="btn btn-primary btn-full" href="' + applyUrl(job) + '">Apply Now</a>' +
      '</div>'
    );
  }

  function openJob(jobId, skipHash) {
    var job = jobs.find(function (j) { return j.id === jobId; });
    if (!job || !drawer || !drawerBody) return;
    currentJobId = jobId;
    if (drawerTitle) drawerTitle.textContent = job.title;
    drawerBody.innerHTML = drawerMarkup(job);
    lastFocus = document.activeElement;
    drawer.classList.add('open');
    drawer.removeAttribute('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (!skipHash) {
      setHash(job.id);
    }
    var closeBtn = drawer.querySelector('.job-drawer-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer(keepHash) {
    if (!drawer || !drawer.classList.contains('open')) return;
    drawer.classList.remove('open');
    drawer.setAttribute('hidden', '');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentJobId = null;
    if (!keepHash && lastFocus && lastFocus.focus) {
      lastFocus.focus();
    }
    lastFocus = null;
    var keepHashes = ['apply', 'positions', 'hire', 'team', 'why', 'platform'];
    var currentHash = (location.hash || '').replace('#', '');
    if (!keepHash && currentHash && keepHashes.indexOf(currentHash) === -1) {
      setHash('');
    }
  }

  function injectJobPostingSchema() {
    var graph = jobs.map(function (job) {
      return {
        '@type': 'JobPosting',
        title: job.title,
        description: job.description,
        datePosted: '2026-08-26',
        validThrough: '2026-12-31',
        employmentType: ['FULL_TIME', 'CONTRACTOR'],
        hiringOrganization: {
          '@type': 'Organization',
          name: 'Dracoin Labs',
          sameAs: 'https://www.dracoinlabs.org',
          logo: 'https://www.dracoinlabs.org/assets/logo-mark.png'
        },
        jobLocationType: 'TELECOMMUTE',
        applicantLocationRequirements: { '@type': 'Country', name: 'Worldwide' },
        identifier: {
          '@type': 'PropertyValue',
          name: 'Dracoin Labs',
          value: job.id
        },
        url: 'https://www.dracoinlabs.org/careers#' + job.id,
        industry: 'Blockchain / Web3 / DeFi',
        occupationalCategory: job.department,
        skills: job.techDisplay.join(', '),
        baseSalary: {
          '@type': 'MonetaryAmount',
          currency: 'USD',
          value: {
            '@type': 'QuantitativeValue',
            minValue: job.salaryMin,
            maxValue: job.salaryMax,
            unitText: 'YEAR'
          }
        }
      };
    });

    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph
    });
    document.head.appendChild(script);
  }

  function handleHash() {
    var hash = (location.hash || '').replace('#', '');
    var pageSections = ['positions', 'apply', 'hire', 'team', 'why', 'platform'];
    if (!hash || pageSections.indexOf(hash) !== -1) return;
    if (jobs.some(function (j) { return j.id === hash; })) {
      openJob(hash, true);
    }
  }

  [filterDept, filterType, filterTech].forEach(function (el) {
    if (el) el.addEventListener('change', applyFilters);
  });

  if (drawer) {
    var closeBtn = drawer.querySelector('.job-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { closeDrawer(); });
    drawer.addEventListener('click', function (e) {
      if (e.target === drawer) closeDrawer();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) {
      closeDrawer();
    }
  });

  document.querySelectorAll('a.org-node').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = (link.getAttribute('href') || '').replace('#', '');
      if (!jobs.some(function (j) { return j.id === id; })) return;
      e.preventDefault();
      openJob(id);
    });
  });

  populatePositionSelect();
  renderAll();
  injectJobPostingSchema();
  handleHash();
  window.addEventListener('hashchange', handleHash);
})();
