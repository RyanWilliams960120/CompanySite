const { fail, isUuid } = require('../../lib/http');
const { requireAdmin } = require('../../lib/auth');
const { getSql, asBuffer } = require('../../lib/db');
const { ensureSchema } = require('../../lib/schema');
const { oneLine } = require('../../lib/validate');
const { contentDisposition } = require('../../lib/resume');

function queryValue(req, key) {
  try {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get(key) || '';
  } catch (err) {
    return '';
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    fail(res, 'Method not allowed.', 405);
    return;
  }
  if (!requireAdmin(req, res)) return;

  const id = oneLine(queryValue(req, 'id'), 80);
  if (!isUuid(id)) {
    fail(res, 'Application not found.', 404);
    return;
  }

  const sql = getSql();
  if (!sql) {
    fail(res, 'Application storage is not configured.', 503);
    return;
  }

  try {
    await ensureSchema(sql);
  } catch (err) {
    fail(res, 'Unable to download resume.', 500);
    return;
  }

  let rows;
  try {
    rows = await sql`
      SELECT resume_filename, resume_content_type, resume_bytes
      FROM applications
      WHERE id = ${id}
      LIMIT 1
    `;
  } catch (err) {
    console.error('[admin-resume] lookup-failed');
    fail(res, 'Unable to download resume.', 500);
    return;
  }

  const data = rows && rows[0];
  const buffer = data ? asBuffer(data.resume_bytes) : null;
  if (!data || !buffer || !buffer.length) {
    fail(res, 'Application not found.', 404);
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', data.resume_content_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', contentDisposition(data.resume_filename || 'resume.pdf'));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(buffer);
};
