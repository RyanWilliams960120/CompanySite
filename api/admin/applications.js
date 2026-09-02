const { json, fail, isUuid } = require('../../lib/http');
const { requireAdmin } = require('../../lib/auth');
const { getServiceClient } = require('../../lib/supabase');
const { POSITION_TITLES, STATUSES } = require('../../lib/positions');
const { oneLine, escapeIlike } = require('../../lib/validate');

const LIST_COLUMNS = 'id, position, name, email, experience_years, status, created_at, updated_at';
const DETAIL_COLUMNS = [
  'id',
  'position',
  'name',
  'email',
  'phone',
  'location',
  'linkedin',
  'github',
  'portfolio',
  'experience_years',
  'employment_type',
  'compensation',
  'availability',
  'cover_letter',
  'resume_filename',
  'resume_content_type',
  'resume_size',
  'status',
  'created_at',
  'updated_at'
].join(', ');

function queryValue(req, key) {
  try {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get(key) || '';
  } catch (err) {
    return '';
  }
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    req.on('data', function (chunk) { chunks.push(chunk); });
    req.on('end', function () {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function listApplications(req, res, supabase) {
  const q = oneLine(queryValue(req, 'q'), 120).replace(/[,()]/g, ' ').trim();
  const position = oneLine(queryValue(req, 'position'), 120);
  const status = oneLine(queryValue(req, 'status'), 40).toLowerCase();
  const sort = oneLine(queryValue(req, 'sort'), 16).toLowerCase() === 'oldest' ? 'oldest' : 'newest';

  if (status && STATUSES.indexOf(status) === -1) {
    fail(res, 'Invalid status filter.');
    return;
  }
  if (position && POSITION_TITLES.indexOf(position) === -1) {
    fail(res, 'Invalid position filter.');
    return;
  }

  let query = supabase.from('applications').select(LIST_COLUMNS);
  if (status) query = query.eq('status', status);
  if (position) query = query.eq('position', position);
  if (q) {
    const term = '%' + escapeIlike(q) + '%';
    query = query.or('name.ilike.' + term + ',email.ilike.' + term + ',phone.ilike.' + term);
  }
  query = query.order('created_at', { ascending: sort === 'oldest' }).limit(200);

  const { data, error } = await query;
  if (error) {
    console.error('[admin-applications] list-failed');
    fail(res, 'Unable to load applications.', 500);
    return;
  }

  json(res, 200, {
    ok: true,
    applications: data || [],
    positions: POSITION_TITLES,
    statuses: STATUSES
  });
}

async function getApplication(req, res, supabase, id) {
  const { data, error } = await supabase
    .from('applications')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin-applications] detail-failed');
    fail(res, 'Unable to load application.', 500);
    return;
  }
  if (!data) {
    fail(res, 'Application not found.', 404);
    return;
  }
  json(res, 200, { ok: true, application: data, statuses: STATUSES });
}

async function updateStatus(req, res, supabase) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    fail(res, 'Invalid request.');
    return;
  }

  const id = oneLine(body.id, 80);
  const status = oneLine(body.status, 40).toLowerCase();
  if (!isUuid(id) || STATUSES.indexOf(status) === -1) {
    fail(res, 'Invalid application or status.');
    return;
  }

  const { data, error } = await supabase
    .from('applications')
    .update({ status: status })
    .eq('id', id)
    .select(DETAIL_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('[admin-applications] status-failed');
    fail(res, 'Unable to update status.', 500);
    return;
  }
  if (!data) {
    fail(res, 'Application not found.', 404);
    return;
  }
  json(res, 200, { ok: true, application: data });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireAdmin(req, res)) return;

  const supabase = getServiceClient();
  if (!supabase) {
    fail(res, 'Application storage is not configured.', 503);
    return;
  }

  if (req.method === 'GET') {
    const id = queryValue(req, 'id');
    if (id) {
      if (!isUuid(id)) {
        fail(res, 'Application not found.', 404);
        return;
      }
      await getApplication(req, res, supabase, id);
      return;
    }
    await listApplications(req, res, supabase);
    return;
  }

  if (req.method === 'PATCH') {
    await updateStatus(req, res, supabase);
    return;
  }

  fail(res, 'Method not allowed.', 405);
};
