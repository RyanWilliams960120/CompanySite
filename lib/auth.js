const crypto = require('crypto');
const { json, parseCookies } = require('./http');

const COOKIE_NAME = 'dl_admin_session';
const MAX_AGE_SEC = 12 * 60 * 60;

function secret() {
  return String(process.env.ADMIN_SESSION_SECRET || '').trim();
}

function expectedUser() {
  return String(process.env.ADMIN_USERNAME || '').trim();
}

function expectedPass() {
  return String(process.env.ADMIN_PASSWORD || '').trim();
}

function authConfigured() {
  return Boolean(secret() && expectedUser() && expectedPass());
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
    json(res, 503, { ok: false, error: 'Recruiter access is not configured.' });
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
  return timingEqual(username, expectedUser()) && timingEqual(password, expectedPass());
}

module.exports = {
  COOKIE_NAME: COOKIE_NAME,
  authConfigured: authConfigured,
  credentialsMatch: credentialsMatch,
  createSessionCookie: createSessionCookie,
  clearSessionCookie: clearSessionCookie,
  readSession: readSession,
  requireAdmin: requireAdmin
};
