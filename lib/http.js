function json(res, status, body, extraHeaders) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function (key) {
      res.setHeader(key, extraHeaders[key]);
    });
  }
  res.end(JSON.stringify(body));
}

function fail(res, message, status) {
  json(res, status || 400, {
    ok: false,
    error: message || 'Unable to submit your application right now. Please try again.'
  });
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function parseCookies(req) {
  const header = String(req.headers.cookie || '');
  const out = {};
  if (!header) return out;
  header.split(';').forEach(function (part) {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch (err) {
      out[key] = value;
    }
  });
  return out;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function appBaseUrl() {
  const explicit = String(process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return 'https://' + String(process.env.VERCEL_PROJECT_PRODUCTION_URL).replace(/^https?:\/\//, '');
  }
  if (process.env.VERCEL_URL) {
    return 'https://' + String(process.env.VERCEL_URL).replace(/^https?:\/\//, '');
  }
  return '';
}

module.exports = {
  json: json,
  fail: fail,
  clientIp: clientIp,
  parseCookies: parseCookies,
  isUuid: isUuid,
  appBaseUrl: appBaseUrl
};
