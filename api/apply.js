const Busboy = require('busboy');
const nodemailer = require('nodemailer');

const MAX_RESUME_BYTES = 2 * 1024 * 1024;
const MAX_COVER = 8000;
const MIN_FILL_MS = 2000;

const POSITIONS = {
  'senior-blockchain-protocol-engineer': 'Senior Blockchain / Protocol Engineer',
  'senior-solidity-evm-engineer': 'Senior Solidity / EVM Engineer',
  'senior-solana-rust-engineer': 'Senior Solana / Rust Engineer',
  'defi-protocol-engineer': 'DeFi / Protocol Engineer',
  'blockchain-backend-engineer': 'Blockchain Backend Engineer',
  'web3-frontend-engineer': 'Web3 Frontend Engineer',
  'blockchain-security-engineer': 'Blockchain Security Engineer',
  'blockchain-qa-test-engineer': 'Blockchain QA / Test Engineer',
  'blockchain-devops-infrastructure-engineer': 'Blockchain DevOps / Infrastructure Engineer',
  'web3-project-manager': 'Web3 Project Manager',
  'protocol-engineer': 'Senior Blockchain / Protocol Engineer',
  'solidity-evm': 'Senior Solidity / EVM Engineer',
  'solana-rust': 'Senior Solana / Rust Engineer',
  'defi-protocol': 'DeFi / Protocol Engineer',
  'backend': 'Blockchain Backend Engineer',
  'frontend': 'Web3 Frontend Engineer',
  'security': 'Blockchain Security Engineer',
  'qa': 'Blockchain QA / Test Engineer',
  'devops': 'Blockchain DevOps / Infrastructure Engineer',
  'project-manager': 'Web3 Project Manager'
};

const hits = new Map();

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

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

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function fail(res) {
  json(res, 400, { ok: false, error: 'Unable to submit your application right now. Please try again.' });
}

function serverFail(res, err) {
  console.error('[careers-apply]', err && err.message ? err.message : err);
  json(res, 500, { ok: false, error: 'Unable to submit your application right now. Please try again.' });
}

function oneLine(value, max) {
  return String(value || '')
    .replace(/[\r\n\0]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 200);
}

function multiline(value, max) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\0/g, '')
    .slice(0, max || 500);
}

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function detectResume(buffer, filename, mime) {
  if (!buffer || !buffer.length) return null;
  const name = String(filename || '').toLowerCase();
  const pdf = buffer.length >= 4 && buffer.slice(0, 4).toString() === '%PDF';
  const ole = buffer.length >= 4 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
  const zip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
  if (pdf && (name.endsWith('.pdf') || mime === 'application/pdf')) {
    return { filename: 'resume.pdf', contentType: 'application/pdf' };
  }
  if (ole && (name.endsWith('.doc') || mime === 'application/msword')) {
    return { filename: 'resume.doc', contentType: 'application/msword' };
  }
  if (zip && (name.endsWith('.docx') || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
    return {
      filename: 'resume.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
  }
  return null;
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

function allowedOrigin(origin) {
  if (!origin) return true;
  const extra = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : [];
  const list = [
    'https://www.dracoinlabs.com',
    'https://dracoinlabs.com'
  ].concat(extra);
  if (process.env.VERCEL_ENV !== 'production') {
    list.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  return list.indexOf(origin) !== -1;
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
    json(res, 405, { ok: false, error: 'Unable to submit your application right now. Please try again.' });
    return;
  }
  if (origin && !allowedOrigin(origin)) {
    fail(res);
    return;
  }
  if (rateLimited(clientIp(req))) {
    json(res, 429, { ok: false, error: 'Unable to submit your application right now. Please try again.' });
    return;
  }

  let parsed;
  try {
    parsed = await parseMultipart(req);
  } catch (err) {
    serverFail(res, err);
    return;
  }

  const f = parsed.fields || {};
  if (oneLine(f.website, 200)) {
    json(res, 200, { ok: true });
    return;
  }

  const started = Number(f.formStarted);
  if (started && Date.now() - started < MIN_FILL_MS) {
    fail(res);
    return;
  }

  const positionKey = oneLine(f.position, 80).toLowerCase();
  const title = POSITIONS[positionKey];
  if (!title) {
    fail(res);
    return;
  }

  const name = oneLine(f.name, 120);
  const email = oneLine(f.email, 160);
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

  if (!name || !isEmail(email) || !linkedin || !isHttpUrl(linkedin)) {
    fail(res);
    return;
  }
  if (!/^\d{1,2}$/.test(experience) || Number(experience) > 50) {
    fail(res);
    return;
  }
  if (!isHttpUrl(github) || !isHttpUrl(portfolio)) {
    fail(res);
    return;
  }
  if (parsed.tooLarge) {
    fail(res);
    return;
  }
  const resumeMeta = parsed.file ? detectResume(parsed.file.buffer, parsed.file.filename, parsed.file.mime) : null;
  if (!resumeMeta) {
    fail(res);
    return;
  }

  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  const to = process.env.CAREERS_EMAIL;
  const from = process.env.EMAIL_FROM || user;
  const port = Number(process.env.EMAIL_PORT || 587);

  if (!host || !user || !pass || !to || !from) {
    console.error('[careers-apply] missing email environment variables');
    json(res, 503, { ok: false, error: 'Unable to submit your application right now. Please try again.' });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: { user: user, pass: pass },
    disableFileAccess: true,
    disableUrlAccess: true
  });

  const text = [
    'DRACOINLABS',
    'NEW JOB APPLICATION',
    '',
    'Position:',
    title,
    '',
    'Candidate:',
    name,
    '',
    'Email:',
    email,
    '',
    'Phone:',
    phone || 'Not provided',
    '',
    'LinkedIn:',
    linkedin,
    '',
    'GitHub:',
    github || 'Not provided',
    '',
    'Portfolio:',
    portfolio || 'Not provided',
    '',
    'Years of Experience:',
    experience,
    '',
    'Location:',
    location || 'Not provided',
    '',
    'Employment Type:',
    engagement || 'Not provided',
    '',
    'Compensation Expectations:',
    compensation || 'Not provided',
    '',
    'Availability:',
    availability || 'Not provided',
    '',
    'Cover Letter:',
    cover || 'Not provided',
    '',
    'Resume:',
    'Attached resume'
  ].join('\n');

  try {
    await transporter.sendMail({
      from: from,
      to: to,
      replyTo: email,
      subject: 'New DracoinLabs Job Application — ' + title + ' — ' + name,
      text: text,
      attachments: [
        {
          filename: resumeMeta.filename,
          content: parsed.file.buffer,
          contentType: resumeMeta.contentType
        }
      ]
    });
  } catch (err) {
    serverFail(res, err);
    return;
  }

  json(res, 200, { ok: true });
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false
  }
};
