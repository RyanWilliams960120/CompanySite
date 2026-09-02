const crypto = require('crypto');
const { json, parseCookies } = require('./http');

const COOKIE_NAME = 'dl_admin_session';
const MAX_AGE_SEC = 12 * 60 * 60;

function envValue() {
  for (let i = 0; i < arguments.length; i += 1) {
    const raw = String(process.env[arguments[i]] || '')
      .trim()
      .replace(/^['"]+|['"]+$/g, '');
    if (raw) return raw;
  }
  return '';
}

function expectedUser() {
  return envValue('ADMIN_USERNAME', 'ADMIN_USER');
}

function expectedPass() {
  return envValue('ADMIN_PASSWORD', 'ADMIN_PASS');
}

function secret() {
  const explicit = envValue('ADMIN_SESSION_SECRET');
  if (explicit) return explicit;
  const user = expectedUser();
  const pass = expectedPass();
  if (!user || !pass) return '';
  return crypto
    .createHmac('sha256', 'dracoinlabs-admin-session')
    .update(user)
    .update('\0')
    .update(pass)
    .digest('hex');
}

function missingAuthEnv() {
  const missing = [];
  if (!expectedUser()) missing.push('ADMIN_USERNAME');
  if (!expectedPass()) missing.push('ADMIN_PASSWORD');
  return missing;
}

function authConfigured() {
  return Boolean(expectedUser() && expectedPass() && secret());
}

function normalizeUser(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePass(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '');
}

function timingEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + sig;
}

function verify(token) {
  if (!token || !secret()) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const body = parts[0];
  const sig = parts[1];
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (!timingEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || payload.v !== 1 || !payload.exp || payload.exp < Date.now()) return null;
    if (payload.u !== expectedUser()) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function isSecureRequest(req) {
  if (process.env.VERCEL_ENV === 'production') return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https';
}

function cookieHeader(value, req, maxAge) {
  const parts = [
    COOKIE_NAME + '=' + encodeURIComponent(value),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + String(maxAge)
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  return parts.join('; ');
}

function createSessionCookie(req) {
  const token = sign({
    v: 1,
    u: expectedUser(),
    exp: Date.now() + MAX_AGE_SEC * 1000
  });
  return cookieHeader(token, req, MAX_AGE_SEC);
}

function clearSessionCookie(req) {
  return cookieHeader('', req, 0);
}

function readSession(req) {
  if (!authConfigured()) return null;
  const cookies = parseCookies(req);
  return verify(cookies[COOKIE_NAME]);
}

function requireAdmin(req, res) {
  if (!authConfigured()) {
    const missing = missingAuthEnv();
    console.error('[admin-auth] not-configured', missing.join(','));
    json(res, 503, {
      ok: false,
      error: missing.length
        ? 'Recruiter access is not configured. Missing Vercel env: ' + missing.join(', ') + '.'
        : 'Recruiter access is not configured.'
    });
    return null;
  }
  const session = readSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'Unauthorized.' });
    return null;
  }
  return session;
}

function credentialsMatch(username, password) {
  if (!authConfigured()) return false;
  const userOk = timingEqual(normalizeUser(username), normalizeUser(expectedUser()));
  const passOk = timingEqual(normalizePass(password), normalizePass(expectedPass()));
  if (!userOk || !passOk) {
    console.error(
      '[admin-login] mismatch',
      'userOk=' + userOk,
      'envUserLen=' + expectedUser().length,
      'inputUserLen=' + String(username || '').trim().length,
      'envPassLen=' + expectedPass().length,
      'inputPassLen=' + String(password || '').length
    );
  }
  return userOk && passOk;
}

module.exports = {
  COOKIE_NAME: COOKIE_NAME,
  authConfigured: authConfigured,
  missingAuthEnv: missingAuthEnv,
  credentialsMatch: credentialsMatch,
  createSessionCookie: createSessionCookie,
  clearSessionCookie: clearSessionCookie,
  readSession: readSession,
  requireAdmin: requireAdmin
};
