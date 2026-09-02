const { json, fail, clientIp } = require('../lib/http');
const { oneLine, multiline, isEmail } = require('../lib/validate');
const { notifyContact } = require('../lib/email');

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

  if (oneLine(body.website, 200)) {
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
    fail(res, GENERIC_ERROR, 500);
    return;
  }

  json(res, 200, { ok: true });
};
