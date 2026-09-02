const { fail, isUuid } = require('../../lib/http');
const { requireAdmin } = require('../../lib/auth');
const { getServiceClient, storageBucket } = require('../../lib/supabase');
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

  const supabase = getServiceClient();
  if (!supabase) {
    fail(res, 'Application storage is not configured.', 503);
    return;
  }

  const { data, error } = await supabase
    .from('applications')
    .select('id, resume_filename, resume_content_type, resume_storage_path')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin-resume] lookup-failed');
    fail(res, 'Unable to download resume.', 500);
    return;
  }
  if (!data || !data.resume_storage_path) {
    fail(res, 'Application not found.', 404);
    return;
  }

  const { data: file, error: downloadErr } = await supabase.storage
    .from(storageBucket())
    .download(data.resume_storage_path);

  if (downloadErr || !file) {
    console.error('[admin-resume] download-failed');
    fail(res, 'Unable to download resume.', 500);
    return;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  res.statusCode = 200;
  res.setHeader('Content-Type', data.resume_content_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', contentDisposition(data.resume_filename || 'resume.pdf'));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(buffer);
};
