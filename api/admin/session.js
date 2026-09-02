const { json, fail } = require('../../lib/http');
const { readSession, authConfigured } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    fail(res, 'Method not allowed.', 405);
    return;
  }
  if (!authConfigured() || !readSession(req)) {
    json(res, 401, { ok: false });
    return;
  }
  json(res, 200, { ok: true });
};
