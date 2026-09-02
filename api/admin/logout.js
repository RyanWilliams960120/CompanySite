const { json, fail } = require('../../lib/http');
const { clearSessionCookie } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    fail(res, 'Method not allowed.', 405);
    return;
  }
  json(res, 200, { ok: true }, {
    'Set-Cookie': clearSessionCookie(req)
  });
};
