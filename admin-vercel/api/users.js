// GET /api/users — Admin Users list (auth required).
// Returns id, username, role, created_at. Password hashes are NEVER returned.
'use strict';

const { kv, hashToObject } = require('../lib/kv');
const { requireAuth } = require('../lib/auth');
const { send, handleError } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    requireAuth(req);
    if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });
    const stored = hashToObject(await kv('HGETALL', 'dtz:admin:users'));
    const users = Object.values(stored)
      .map((raw) => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map((u) => ({ id: u.id, username: u.username, role: u.role, created_at: u.created_at }))
      .sort((a, b) => (a.id || 0) - (b.id || 0));
    return send(res, 200, { ok: true, users });
  } catch (err) {
    return handleError(res, err);
  }
};
