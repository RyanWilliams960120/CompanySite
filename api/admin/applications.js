const { json, fail, isUuid } = require('../../lib/http');
const { requireAdmin } = require('../../lib/auth');
const { getSql, query } = require('../../lib/db');
const { ensureSchema } = require('../../lib/schema');
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

async function listApplications(req, res, sql) {
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

  const clauses = [];
  const values = [];
  let i = 1;
  if (status) {
    clauses.push('status = $' + i++);
    values.push(status);
  }
  if (position) {
    clauses.push('position = $' + i++);
    values.push(position);
  }
  if (q) {
    clauses.push('(name ILIKE $' + i + ' OR email ILIKE $' + i + ' OR COALESCE(phone, \'\') ILIKE $' + i + ')');
    values.push('%' + escapeIlike(q) + '%');
    i += 1;
  }

  const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
  const order = sort === 'oldest' ? 'ASC' : 'DESC';
  const text = 'SELECT ' + LIST_COLUMNS + ' FROM applications' + where +
    ' ORDER BY created_at ' + order + ' LIMIT 200';

  let rows;
  try {
    rows = await query(sql, text, values);
  } catch (err) {
    console.error('[admin-applications] list-failed');
    fail(res, 'Unable to load applications.', 500);
    return;
  }

  json(res, 200, {
    ok: true,
    applications: rows || [],
    positions: POSITION_TITLES,
    statuses: STATUSES
  });
}

async function getApplication(req, res, sql, id) {
  let rows;
  try {
    rows = await query(sql, 'SELECT ' + DETAIL_COLUMNS + ' FROM applications WHERE id = $1 LIMIT 1', [id]);
  } catch (err) {
    console.error('[admin-applications] detail-failed');
    fail(res, 'Unable to load application.', 500);
    return;
  }
  if (!rows || !rows.length) {
    fail(res, 'Application not found.', 404);
    return;
  }
  json(res, 200, { ok: true, application: rows[0], statuses: STATUSES });
}

async function updateStatus(req, res, sql) {
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

  let rows;
  try {
    rows = await query(
      sql,
      'UPDATE applications SET status = $1, updated_at = now() WHERE id = $2 RETURNING ' + DETAIL_COLUMNS,
      [status, id]
    );
  } catch (err) {
    console.error('[admin-applications] status-failed');
    fail(res, 'Unable to update status.', 500);
    return;
  }
  if (!rows || !rows.length) {
    fail(res, 'Application not found.', 404);
    return;
  }
  json(res, 200, { ok: true, application: rows[0] });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireAdmin(req, res)) return;

  const sql = getSql();
  if (!sql) {
    fail(res, 'Application storage is not configured.', 503);
    return;
  }

  try {
    await ensureSchema(sql);
  } catch (err) {
    fail(res, 'Unable to load applications.', 500);
    return;
  }

  if (req.method === 'GET') {
    const id = queryValue(req, 'id');
    if (id) {
      if (!isUuid(id)) {
        fail(res, 'Application not found.', 404);
        return;
      }
      await getApplication(req, res, sql, id);
      return;
    }
    await listApplications(req, res, sql);
    return;
  }

  if (req.method === 'PATCH') {
    await updateStatus(req, res, sql);
    return;
  }

  fail(res, 'Method not allowed.', 405);
};
