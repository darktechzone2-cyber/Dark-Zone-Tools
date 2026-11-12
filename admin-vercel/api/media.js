// /api/media — Uploaded Media index (auth required).
//   GET    -> { ok, media: [{ name, size, mtime }] }  (newest first)
//   DELETE ?name=example.png -> removes the entry from the KV index ONLY.
// The actual media files still live on the old InfinityFree PHP host
// (M/uploads/media). Deleting here does NOT delete the file there — see README.
'use strict';

const { kvGetJson, kvSetJson } = require('../lib/kv');
const { requireAuth } = require('../lib/auth');
const { send, getQuery, handleError } = require('../lib/http');

const MEDIA_KEY = 'dtz:admin:media';

module.exports = async (req, res) => {
  try {
    requireAuth(req);

    if (req.method === 'GET') {
      const media = await kvGetJson(MEDIA_KEY, []);
      const sorted = [...media].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      return send(res, 200, { ok: true, media: sorted });
    }

    if (req.method === 'DELETE') {
      const name = String(getQuery(req).get('name') || '').trim();
      if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
        return send(res, 400, { ok: false, error: 'Valid file name required.' });
      }
      const media = await kvGetJson(MEDIA_KEY, []);
      const next = media.filter((m) => m.name !== name);
      if (next.length === media.length) {
        return send(res, 404, { ok: false, error: 'File not found in the media index.' });
      }
      await kvSetJson(MEDIA_KEY, next);
      return send(res, 200, { ok: true, deleted: name });
    }

    return send(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
};
