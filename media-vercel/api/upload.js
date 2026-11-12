'use strict';
// POST /api/upload — multipart file upload -> Vercel Blob storage.
// Zero extra dependencies: the multipart parser below is hand-written.
// Env required: BLOB_READ_WRITE_TOKEN (set automatically when a Blob store
// is attached to the Vercel project, or set manually in the dashboard).

const crypto = require('crypto');
const { put } = require('@vercel/blob');

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB app-level cap (see README for the Vercel platform limit)

const ALLOWED_EXT = new Set([
  'mp4', 'webm', 'ogg',      // video
  'mp3', 'wav',              // audio
  'jpeg', 'jpg', 'png', 'gif', 'webp', // images
  'apk',                     // Android package
]);

const MIME_BY_EXT = {
  mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
  mp3: 'audio/mpeg', wav: 'audio/wav',
  jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp',
  apk: 'application/vnd.android.package-archive',
};

// Read the raw request body as a Buffer. Rejects early on oversize bodies.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BYTES + 1024 * 1024) {
        const err = new Error('FILE_TOO_LARGE');
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Minimal multipart/form-data parser. Returns an array of parts:
// { name, filename (or null), contentType (or null), data: Buffer }.
// Note: a file whose bytes happen to contain the boundary string would be
// split early — browsers generate a random boundary, so this is a
// negligible risk for this tool.
function parseMultipart(buf, boundary) {
  const sep = Buffer.from('--' + boundary);
  const parts = [];
  let start = buf.indexOf(sep);
  while (start !== -1) {
    const next = buf.indexOf(sep, start + sep.length);
    if (next === -1) break;
    let chunk = buf.subarray(start + sep.length, next);
    if (chunk.length >= 2 && chunk[0] === 13 && chunk[1] === 10) chunk = chunk.subarray(2); // leading CRLF
    if (chunk.length >= 2 && chunk[chunk.length - 2] === 13 && chunk[chunk.length - 1] === 10) chunk = chunk.subarray(0, chunk.length - 2); // trailing CRLF
    const hdrEnd = chunk.indexOf(Buffer.from('\r\n\r\n'));
    if (hdrEnd === -1) { start = next; continue; }
    const headers = chunk.subarray(0, hdrEnd).toString('utf8');
    const data = chunk.subarray(hdrEnd + 4);
    const disp = /name="([^"]*)"(?:;\s*filename="([^"]*)")?/.exec(headers);
    const ctype = /content-type:\s*([^\r\n]+)/i.exec(headers);
    parts.push({
      name: disp ? disp[1] : null,
      filename: disp && disp[2] ? disp[2] : null,
      contentType: ctype ? ctype[1].trim() : null,
      data,
    });
    start = next;
  }
  return parts;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }
  const ct = req.headers['content-type'] || '';
  const m = /multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(ct);
  if (!m) {
    return res.status(400).json({ ok: false, error: 'Expected a multipart/form-data upload.' });
  }
  const boundary = (m[1] || m[2]).trim();

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    if (e && e.message === 'FILE_TOO_LARGE') {
      return res.status(413).json({ ok: false, error: 'File too large. Max 100 MB.' });
    }
    return res.status(400).json({ ok: false, error: 'Could not read upload.' });
  }

  const parts = parseMultipart(body, boundary);
  const file = parts.find((p) => p.name === 'mediaFile' && p.filename);
  if (!file) {
    return res.status(400).json({ ok: false, error: 'No file received. Choose a file first.' });
  }
  if (file.data.length === 0) {
    return res.status(400).json({ ok: false, error: 'Empty file.' });
  }
  if (file.data.length > MAX_BYTES) {
    return res.status(413).json({ ok: false, error: 'File too large. Max 100 MB.' });
  }
  const ext = (file.filename.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return res.status(400).json({ ok: false, error: 'File type not allowed. Use MP4, WebM, MP3, WAV, PNG, JPG, WEBP, GIF or APK.' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'Blob store not configured. Create a Vercel Blob store in the Vercel dashboard (Storage -> Create -> Blob), attach it to this project, and redeploy so BLOB_READ_WRITE_TOKEN is set.',
    });
  }

  const id = crypto.randomBytes(4).toString('hex'); // 8 chars, same style as the original
  const pathname = 'media/' + id + '.' + ext;
  const contentType = file.contentType || MIME_BY_EXT[ext] || 'application/octet-stream';

  try {
    const blob = await put(pathname, file.data, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    });
    return res.status(200).json({
      ok: true,
      id,
      url: blob.url,
      filename: file.filename,
      size: file.data.length,
      contentType,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Blob upload failed: ' + (err && err.message ? err.message : 'unknown error'),
    });
  }
};

// Exported for local testing.
module.exports.parseMultipart = parseMultipart;
module.exports.MAX_BYTES = MAX_BYTES;
