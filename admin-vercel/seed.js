// Seed the Vercel KV store for the DTZ admin panel.
// Run locally (never on Vercel):  npm run seed
// Required env vars (see .env.example):
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ADMIN_USERNAME, ADMIN_PASSWORD
// Optional: ADMIN_SESSION_SECRET — if empty, a random one is generated and
// printed ONCE below. Copy it into the Vercel project env vars and never
// commit it anywhere.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { hashPassword } = require('./lib/auth');

const URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USERNAME = (process.env.ADMIN_USERNAME || 'admin').trim();
const PASSWORD = process.env.ADMIN_PASSWORD || '';
let SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';

if (!URL || !TOKEN) {
  console.error('ERROR: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN first (see .env.example).');
  process.exit(1);
}
if (!USERNAME || !PASSWORD) {
  console.error('ERROR: set ADMIN_USERNAME and ADMIN_PASSWORD first.');
  process.exit(1);
}

let generatedSecret = false;
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  generatedSecret = true;
}

async function kv(...args) {
  const pathPart = args.map((a) => encodeURIComponent(String(a))).join('/');
  const res = await fetch(`${URL}/${pathPart}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`KV request failed: ${data.error || res.status}`);
  }
  return data.result;
}

async function main() {
  const tools = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools.json'), 'utf8'));
  const maxToolId = tools.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0);

  // Admin user (scrypt hash — the plain password is never stored).
  const user = {
    id: 1,
    username: USERNAME,
    role: 'admin',
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    password_hash: hashPassword(PASSWORD),
  };
  await kv('HSET', 'dtz:admin:users', USERNAME, JSON.stringify(user));

  // Tools list + id counter.
  await kv('SET', 'dtz:admin:tools', JSON.stringify(tools));
  await kv('SET', 'dtz:admin:seq:tool', String(maxToolId));

  // Settings defaults.
  await kv('HSET', 'dtz:admin:settings',
    'toolkit_name', 'Dark Zone Toolkit',
    'channel_link', 'https://whatsapp.com/channel/0029VbCgB63LCoX5aiV5qp1t');

  // Empty reports / media index / counters (only set if absent, so re-running
  // seed never wipes live data).
  if ((await kv('GET', 'dtz:admin:reports')) === null) await kv('SET', 'dtz:admin:reports', '[]');
  if ((await kv('GET', 'dtz:admin:media')) === null) await kv('SET', 'dtz:admin:media', '[]');
  if ((await kv('GET', 'dtz:admin:seq:report')) === null) await kv('SET', 'dtz:admin:seq:report', '0');

  console.log('Seed complete.');
  console.log(`  Admin user: ${USERNAME}`);
  console.log(`  Tools seeded: ${tools.length}`);
  if (generatedSecret) {
    console.log('');
    console.log('  >>> ADMIN_SESSION_SECRET (generated — copy into Vercel env vars, keep it private):');
    console.log(`  ${SESSION_SECRET}`);
  } else {
    console.log('  ADMIN_SESSION_SECRET was provided from env (unchanged).');
  }
  console.log('');
  console.log('Next: set these three env vars in the Vercel project, then deploy:');
  console.log('  UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ADMIN_SESSION_SECRET');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
