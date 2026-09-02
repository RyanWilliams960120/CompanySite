const Busboy = require('busboy');
const crypto = require('crypto');
const { json, fail, clientIp } = require('../lib/http');
const { officialTitle, EMPLOYMENT_TYPES } = require('../lib/positions');
const { oneLine, multiline, isHttpUrl, isEmail } = require('../lib/validate');
const { getSql } = require('../lib/db');
const { ensureSchema } = require('../lib/schema');
const { MAX_RESUME_BYTES, detectResume, safeResumeName } = require('../lib/resume');
const { notifyRecruiters } = require('../lib/email');

const MAX_COVER = 8000;
const MIN_FILL_MS = 2000;
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const GENERIC_ERROR = 'Unable to submit your application right now. Please try again.';

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const rec = hits.get(ip) || [];
  const recent = rec.filter(function (t) { return now - t < windowMs; });
  if (recent.length >= 8) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function allowedOrigin(origin) {
  if (!origin) return true;
  const extra = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : [];
  const list = [
    'https://www.dracoinlabs.com',
    'https://dracoinlabs.com'
  ].concat(extra.map(function (item) { return item.trim(); }).filter(Boolean));
  if (process.env.VERCEL_ENV !== 'production') {
    list.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  const base = String(process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (base) list.push(base);
  return list.indexOf(origin) !== -1;
}

function parseMultipart(req) {
  return new Promise(function (resolve, reject) {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_RESUME_BYTES, files: 1, fields: 20, fieldSize: 16000 }
    });
    const fields = {};
    let file = null;
    let tooLarge = false;

    bb.on('file', function (name, stream, info) {
      const chunks = [];
      stream.on('data', function (d) { chunks.push(d); });
      stream.on('limit', function () { tooLarge = true; });
      stream.on('end', function () {
        if (name !== 'resume') return;
        file = {
          filename: info.filename,
          mime: info.mimeType,
          buffer: Buffer.concat(chunks)
        };
      });
    });
    bb.on('field', function (name, value) {
      fields[name] = value;
    });
    bb.on('error', reject);
    bb.on('close', function () {
      resolve({ fields: fields, file: file, tooLarge: tooLarge });
    });
    req.pipe(bb);
  });
}

function logApply(event, detail) {
  const extra = detail ? ' ' + detail : '';
  console.error('[careers-apply] ' + event + extra);
}

async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    fail(res, GENERIC_ERROR, 405);
    return;
  }
  if (origin && !allowedOrigin(origin)) {
    fail(res, GENERIC_ERROR);
    return;
  }
  if (rateLimited(clientIp(req))) {
    fail(res, 'Too many applications from this network. Please try again later.', 429);
    return;
  }

  const sql = getSql();
  if (!sql) {
    logApply('missing-database-env');
    fail(res, GENERIC_ERROR, 503);
    return;
  }

  let parsed;
  try {
    parsed = await parseMultipart(req);
  } catch (err) {
    logApply('multipart-parse-failed');
    fail(res, GENERIC_ERROR, 500);
    return;
  }

  const f = parsed.fields || {};
  if (oneLine(f.website, 200)) {
    json(res, 200, { ok: true });
    return;
  }

  const started = Number(f.formStarted);
  if (started && Date.now() - started < MIN_FILL_MS) {
    fail(res, GENERIC_ERROR);
    return;
  }

  const title = officialTitle(f.position);
  if (!title) {
    fail(res, 'Please select a valid open position.');
    return;
  }

  const name = oneLine(f.name, 120);
  const email = oneLine(f.email, 160).toLowerCase();
  const linkedin = oneLine(f.linkedin, 300);
  const experience = oneLine(f.experience, 8);
  const phone = oneLine(f.phone, 40);
  const location = oneLine(f.location, 120);
  const github = oneLine(f.github, 300);
  const portfolio = oneLine(f.portfolio, 300);
  const engagement = oneLine(f.engagement, 40);
  const compensation = oneLine(f.compensation, 80);
  const availability = oneLine(f.availability, 80);
  const cover = multiline(f.cover, MAX_COVER);

  if (!name) {
    fail(res, 'Full name is required.');
    return;
  }
  if (!isEmail(email)) {
    fail(res, 'Enter a valid email address.');
    return;
  }
  if (!linkedin || !isHttpUrl(linkedin)) {
    fail(res, 'Enter a valid LinkedIn URL.');
    return;
  }
  if (!/^\d{1,2}$/.test(experience) || Number(experience) > 50) {
    fail(res, 'Years of experience must be a number between 0 and 50.');
    return;
  }
  if (github && !isHttpUrl(github)) {
    fail(res, 'Enter a valid GitHub URL.');
    return;
  }
  if (portfolio && !isHttpUrl(portfolio)) {
    fail(res, 'Enter a valid portfolio URL.');
    return;
  }
  if (engagement && EMPLOYMENT_TYPES.indexOf(engagement) === -1) {
    fail(res, 'Select a valid employment type.');
    return;
  }
  if (cover.length > MAX_COVER) {
    fail(res, 'Cover letter must be 8,000 characters or fewer.');
    return;
  }
  if (parsed.tooLarge) {
    fail(res, 'Resume must be a PDF, DOC, or DOCX file of 2 MB or less.');
    return;
  }
  if (!parsed.file || !parsed.file.buffer || !parsed.file.buffer.length) {
    fail(res, 'Please attach your resume or CV.');
    return;
  }

  const resumeMeta = detectResume(parsed.file.buffer, parsed.file.filename, parsed.file.mime);
  if (!resumeMeta) {
    fail(res, 'Resume must be a PDF, DOC, or DOCX file of 2 MB or less.');
    return;
  }

  try {
    await ensureSchema(sql);
  } catch (err) {
    logApply('schema-failed', err && err.message ? err.message : err);
    fail(res, GENERIC_ERROR, 500);
    return;
  }

  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  let existing;
  try {
    existing = await sql`
      SELECT id
      FROM applications
      WHERE lower(email) = ${email}
        AND position = ${title}
        AND created_at >= ${since}::timestamptz
      LIMIT 1
    `;
  } catch (err) {
    logApply('duplicate-check-failed', err && err.message ? err.message : err);
    fail(res, GENERIC_ERROR, 500);
    return;
  }
  if (existing && existing.length) {
    fail(res, 'You have already submitted an application for this position recently.', 409);
    return;
  }

  const id = crypto.randomUUID();
  const filename = safeResumeName(parsed.file.filename, resumeMeta.extension);
  const storagePath = id + '/' + filename;
  const resumeBytes = new Uint8Array(parsed.file.buffer);

  let inserted;
  try {
    const rows = await sql`
      INSERT INTO applications (
        id, position, name, email, phone, location, linkedin, github, portfolio,
        experience_years, employment_type, compensation, availability, cover_letter,
        resume_filename, resume_content_type, resume_size, resume_storage_path, resume_bytes, status
      ) VALUES (
        ${id}, ${title}, ${name}, ${email}, ${phone || null}, ${location || null},
        ${linkedin}, ${github || null}, ${portfolio || null}, ${Number(experience)},
        ${engagement || null}, ${compensation || null}, ${availability || null}, ${cover || null},
        ${filename}, ${resumeMeta.contentType}, ${parsed.file.buffer.length}, ${storagePath},
        ${resumeBytes}, ${'new'}
      )
      RETURNING id, created_at
    `;
    inserted = rows && rows[0];
  } catch (err) {
    logApply('database-insert-failed', err && err.message ? err.message : err);
    fail(res, GENERIC_ERROR, 500);
    return;
  }

  if (!inserted || !inserted.id) {
    logApply('database-insert-failed', 'empty-result');
    fail(res, GENERIC_ERROR, 500);
    return;
  }

  try {
    await notifyRecruiters({
      id: inserted.id,
      created_at: inserted.created_at,
      position: title,
      name: name,
      email: email,
      phone: phone,
      location: location,
      linkedin: linkedin,
      github: github,
      portfolio: portfolio,
      experience_years: Number(experience),
      employment_type: engagement,
      compensation: compensation,
      availability: availability,
      cover_letter: cover,
      resume_filename: filename
    });
  } catch (err) {
    logApply('email-failed', inserted.id);
  }

  json(res, 200, { ok: true });
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false
  }
};
