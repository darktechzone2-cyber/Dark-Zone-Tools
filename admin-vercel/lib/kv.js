// Minimal Upstash (Vercel KV) REST client — zero dependencies.
// Reads credentials ONLY from process.env. Nothing is hardcoded here.
'use strict';

function getConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const err = new Error(
      'KV not configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in the Vercel project env vars.'
    );
    err.status = 500;
    throw err;
  }
  return { url: url.replace(/\/$/, ''), token };
}

// Raw Redis command over the Upstash REST API, e.g. kv('GET', key), kv('HSET', key, field, value).
async function kv(...args) {
  const { url, token } = getConfig();
  const path = args.map((a) => encodeURIComponent(String(a))).join('/');
  const res = await fetch(`${url}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new Error(`KV request failed (HTTP ${res.status})`);
    err.status = 502;
    throw err;
  }
  const data = await res.json();
  if (data.error) {
    const err = new Error(`KV error: ${data.error}`);
    err.status = 502;
    throw err;
  }
  return data.result;
}

// Read a key that holds a JSON document; returns `fallback` when missing/corrupt.
async function kvGetJson(key, fallback) {
  const raw = await kv('GET', key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function kvSetJson(key, value) {
  return kv('SET', key, JSON.stringify(value));
}

// HGETALL over REST can come back as an object or a flat [field, value, ...] array.
function hashToObject(result) {
  if (!result) return {};
  if (!Array.isArray(result)) return result;
  const obj = {};
  for (let i = 0; i + 1 < result.length; i += 2) obj[result[i]] = result[i + 1];
  return obj;
}

module.exports = { kv, kvGetJson, kvSetJson, hashToObject };
