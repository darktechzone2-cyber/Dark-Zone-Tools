'use strict';
// POST /api/delete — delete a Blob file by its public URL.
// Body: JSON { "url": "https://....vercel-storage.com/media/...." }
// Only URLs from the project's own Blob store are accepted.

const { del } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body.' });
  }
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url || !/^https:\/\//.test(url)) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid file URL.' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'Blob store not configured. Create a Vercel Blob store in the Vercel dashboard and set BLOB_READ_WRITE_TOKEN.',
    });
  }
  try {
    await del(url);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Delete failed: ' + (err && err.message ? err.message : 'unknown error'),
    });
  }
};
