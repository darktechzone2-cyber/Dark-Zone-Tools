// POST /api/login  { username, password } -> { ok, token, username }
// Verifies the password against the scrypt hash stored in KV (dtz:admin:users).
// NOTE: there is no brute-force protection yet — see README before exposing publicly.
'use strict';

const { kv } = require('../lib/kv');
const { verifyPassword, issueToken } = require('../lib/auth');
const { send, getBody, handleError } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  try {
    const body = await getBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) {
      return send(res, 400, { ok: false, error: 'Username and password required.' });
    }
    const raw = await kv('HGET', 'dtz:admin:users', username);
    if (!raw) return send(res, 401, { ok: false, error: 'Invalid credentials.' });
    let user;
    try {
      user = JSON.parse(raw);
    } catch {
      return send(res, 401, { ok: false, error: 'Invalid credentials.' });
    }
    if (!verifyPassword(password, user.password_hash)) {
      return send(res, 401, { ok: false, error: 'Invalid credentials.' });
    }
    const token = issueToken(username);
    return send(res, 200, { ok: true, token, username });
  } catch (err) {
    return handleError(res, err);
  }
};
