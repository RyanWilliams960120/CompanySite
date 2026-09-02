const { json, fail, clientIp } = require('../../lib/http');
const { authConfigured, missingAuthEnv, credentialsMatch, createSessionCookie } = require('../../lib/auth');

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || [];
  const recent = rec.filter(function (t) { return now - t < 15 * 60 * 1000; });
  if (recent.length >= 10) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
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
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    fail(res, 'Method not allowed.', 405);
    return;
  }
  if (!authConfigured()) {
    const missing = missingAuthEnv();
    console.error('[admin-login] not-configured', missing.join(','));
    fail(
      res,
      missing.length
        ? 'Recruiter access is not configured. Missing Vercel env: ' + missing.join(', ') + '.'
        : 'Recruiter access is not configured.',
      503
    );
    return;
  }
  if (rateLimited(clientIp(req))) {
    fail(res, 'Too many sign-in attempts. Please try again later.', 429);
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    fail(res, 'Invalid request.');
    return;
  }

  const username = String(body.username || '');
  const password = String(body.password || '');
  if (!credentialsMatch(username, password)) {
    fail(res, 'Invalid username or password.', 401);
    return;
  }

  json(res, 200, { ok: true }, {
    'Set-Cookie': createSessionCookie(req)
  });
};
