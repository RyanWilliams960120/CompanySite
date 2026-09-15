const { json, fail, clientIp, isAllowedOrigin } = require('../lib/http');
const { oneLine, multiline, isEmail } = require('../lib/validate');
const { notifyContact } = require('../lib/email');
const { getSql } = require('../lib/db');
const { ensureSchema } = require('../lib/schema');
const crypto = require('crypto');

const GENERIC_ERROR = 'Unable to send your message right now. Please try again.';
const SERVICE_LABELS = {
  solana: 'Solana Development',
  'smart-contracts': 'Smart Contracts',
  web3: 'Web3 Applications',
  staking: 'Staking & Rewards',
  governance: 'DAO Governance',
  defi: 'DeFi Infrastructure',
  other: 'Other'
};

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || [];
  const recent = rec.filter(function (t) { return now - t < 60 * 60 * 1000; });
  if (recent.length >= 8) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function allowedOrigin(origin) {
  return isAllowedOrigin(origin);
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

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

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
    fail(res, 'Too many messages from this network. Please try again later.', 429);
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    fail(res, GENERIC_ERROR);
    return;
  }

  if (oneLine(body.dl_hp, 200) || oneLine(body.website, 200)) {
    json(res, 200, { ok: true });
    return;
  }

  const name = oneLine(body.name, 120);
  const email = oneLine(body.email, 160);
  const company = oneLine(body.company, 160);
  const serviceKey = oneLine(body.service, 40);
  const message = multiline(body.message, 5000);
  const service = SERVICE_LABELS[serviceKey] || (serviceKey ? serviceKey : '');

  if (!name || !isEmail(email) || !message) {
    fail(res, 'Please fill in your name, a valid email, and a message.');
    return;
  }

  let saved = false;
  const sql = getSql();
  if (sql) {
    try {
      await ensureSchema(sql);
      await sql`
        INSERT INTO contact_messages (id, name, email, company, service, message)
        VALUES (
          ${crypto.randomUUID()},
          ${name},
          ${email},
          ${company || ''},
          ${service || ''},
          ${message}
        )
      `;
      saved = true;
    } catch (err) {
      console.error('[contact] save-failed', err && err.message ? err.message : err);
    }
  }

  try {
    await notifyContact({
      name: name,
      email: email,
      company: company,
      service: service,
      message: message
    });
  } catch (err) {
    console.error('[contact] email-failed', err && err.message ? err.message : err);
    if (saved) {
      json(res, 200, { ok: true });
      return;
    }
    const detail = err && err.message ? String(err.message) : '';
    if (detail === 'email-not-configured') {
      fail(res, 'Contact email is not configured on the server. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, and CONTACT_EMAIL in Vercel.', 500);
      return;
    }
    fail(res, GENERIC_ERROR, 500);
    return;
  }

  json(res, 200, { ok: true });
};
