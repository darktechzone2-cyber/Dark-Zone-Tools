// Password hashing (Node scrypt) + HMAC session tokens for the admin panel.
// Secrets come ONLY from process.env. Nothing is hardcoded here.
'use strict';

const crypto = require('crypto');

// Stored format: "scrypt:<salt hex>:<derived key hex>" (scrypt N=16384, r=8, p=1, 64-byte key).
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), salt, 64);
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const actual = crypto.scryptSync(String(password), salt, 64);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Token: base64url(username) . expiry-ms . HMAC-SHA256(payload, ADMIN_SESSION_SECRET). Valid 12h.
function issueToken(username) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    const err = new Error('ADMIN_SESSION_SECRET is not set in the Vercel project env vars.');
    err.status = 500;
    throw err;
  }
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `${Buffer.from(String(username), 'utf8').toString('base64url')}.${exp}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

// Returns the username when the token is valid, otherwise null.
function verifyToken(token) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [userB64, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${userB64}.${exp}`)
    .digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    return Buffer.from(userB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

// Throws a 401 error unless the request carries a valid "Authorization: Bearer <token>".
function requireAuth(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const username = match ? verifyToken(match[1]) : null;
  if (!username) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return username;
}

module.exports = { hashPassword, verifyPassword, issueToken, verifyToken, requireAuth };
