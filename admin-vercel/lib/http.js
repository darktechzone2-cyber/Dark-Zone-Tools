// Shared HTTP helpers for the Vercel serverless functions.
'use strict';

function send(res, status, obj) {
  res.status(status).json(obj);
}

// Vercel may already parse a JSON body into req.body; otherwise read the stream.
function getBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return Promise.resolve(req.body);
    if (typeof req.body === 'string') {
      try {
        return Promise.resolve(req.body ? JSON.parse(req.body) : {});
      } catch {
        return Promise.reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    }
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) reject(Object.assign(new Error('Request body too large'), { status: 413 }));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function getQuery(req) {
  try {
    return new URL(req.url, 'http://localhost').searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function handleError(res, err) {
  const status = err && err.status ? err.status : 500;
  send(res, status, { ok: false, error: (err && err.message) || 'Server error' });
}

module.exports = { send, getBody, getQuery, handleError };
