# Dark Zone Toolkit — Admin Panel (Vercel edition)

The PHP + MySQL admin panel (`admin.php`) converted into a **Vercel-native Node.js project**: a static single-page admin UI (`public/index.html`) + serverless API functions (`api/*.js`) + **Vercel KV (Upstash Redis)** as the data store. No PHP, no MySQL, zero npm dependencies.

## What it keeps from the PHP panel (v2.0)

- Admin login (users stored in KV, passwords hashed with Node `scrypt`)
- Stats: Active Tools, Total Clicks, Reports, Media Files
- AI Remote Assistant (proxies the same DTZ AI chat endpoint, SSE flattened to one reply)
- Add Tool / Edit Tool / Manage Tools table (with clicks + status badges)
- Site Settings editor (`toolkit_name`, `channel_link`)
- Uploaded Media list, Admin Users list (password hashes never returned)
- SEO / AdSense checklist (live HEAD checks against `darktechzon.site`)
- Official DTZ logo in header + login card, same dark toolkit design, mobile-first

## Project layout

| Path | What it is |
|---|---|
| `public/index.html` | The whole admin UI (login + dashboard), talks to `/api/*` with a Bearer token |
| `api/login.js` | `POST /api/login` → session token (12h, HMAC-signed) |
| `api/tools.js` | `GET/POST/PUT/DELETE /api/tools` — tools list, add, edit, delete |
| `api/settings.js` | `GET/PUT /api/settings` |
| `api/reports.js` | `GET/DELETE /api/reports` |
| `api/stats.js` | `GET /api/stats` — dashboard counters |
| `api/users.js` | `GET /api/users` (no password hashes) |
| `api/media.js` | `GET/DELETE /api/media` — KV media index |
| `api/ai.js` | `POST /api/ai` — DTZ AI proxy |
| `lib/kv.js` | Minimal Upstash REST client (plain `fetch`, no dependency) |
| `lib/auth.js` | scrypt hashing + HMAC session tokens |
| `lib/http.js` | Shared response/body/query helpers |
| `tools.json` | The 17 current tools, seeded into KV |
| `seed.js` | One-time seed script (run locally) |
| `vercel.json` | Vercel config (`/admin` → `/index.html`) |
| `package.json` | No dependencies, Node >= 18 |

## KV data model (all keys prefixed `dtz:admin:`)

| Key | Type | Content |
|---|---|---|
| `dtz:admin:users` | Hash | `username → JSON {id, username, role, created_at, password_hash}` |
| `dtz:admin:tools` | String (JSON array) | Tool objects `{id, name, category, filename, icon, status, clicks}` |
| `dtz:admin:seq:tool` | String (counter) | Next tool id (`INCR`) |
| `dtz:admin:settings` | Hash | `toolkit_name`, `channel_link` |
| `dtz:admin:reports` | String (JSON array) | Report objects `{id, message, created_at}` |
| `dtz:admin:seq:report` | String (counter) | Next report id |
| `dtz:admin:media` | String (JSON array) | Media index `{name, size, mtime}` |

## Setup (do this once)

### 1. Create the KV database
In the Vercel dashboard: **Storage → Create Database → KV (Upstash Redis)** and attach it to this project. Vercel fills in `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically. (Or create one in the Upstash console and add the two values manually.)

### 2. Seed the data (local machine)
```bash
cp .env.example .env   # then fill in the real values — never commit .env
UPSTASH_REDIS_REST_URL="https://..." \
UPSTASH_REDIS_REST_TOKEN="..." \
ADMIN_USERNAME="admin" \
ADMIN_PASSWORD="choose-a-strong-password" \
npm run seed
```
`seed.js` writes the admin user (scrypt hash — the plain password is never stored), the 17 tools from `tools.json`, the settings defaults, and empty reports/media. If `ADMIN_SESSION_SECRET` is not set it generates a random one and prints it **once** — copy it into the Vercel project env vars. Re-running seed never wipes existing reports/media.

### 3. Set env vars in Vercel
Project → Settings → Environment Variables:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ADMIN_SESSION_SECRET` (the value seed printed)

### 4. Deploy
```bash
vercel --prod
```
or import this folder as a GitHub repo in the Vercel dashboard. Open the deployed URL, log in with the seeded admin user. `/admin` also serves the panel.

## Honest limits (read before going live)

1. **No brute-force protection on login yet.** The PHP panel had none either. Add a rate limit (e.g. 5 failed logins → 15-minute lockout, via a KV counter) before exposing the panel publicly.
2. **Media list is a KV index only.** The actual media files still live on the old InfinityFree PHP host (`M/uploads/media`). Deleting an entry here removes it from the index; it does **not** delete the file on the PHP host. To index the real files, run a one-off script on the PHP host (or add entries manually).
3. **Reports stay empty until something writes them.** The static hub feedback form sends mail, so no reports flow into KV yet. Any future feedback endpoint should `POST` into `dtz:admin:reports` (id from `INCR dtz:admin:seq:report`).
4. **Click counts start at 0.** The old MySQL click totals were not migrated (no DB export was available). The counter grows from here as tools are used.
5. **The AI proxy uses the public DTZ demo key** (`X-API-Key: DarkTech`) — the same public key the DTZ web page itself uses. It is not a secret.
6. **Sessions are 12-hour HMAC tokens** kept in `sessionStorage`. Logging out just clears the token; there is no server-side session list.

## Security notes

- No credential is stored anywhere in this repo. Secrets live only in Vercel env vars / the local `.env` (gitignored).
- The old InfinityFree DB password (plain text in the PHP sources) is **not** copied here and must still be rotated in the InfinityFree panel.
- `config.php` in the old PHP project also hardcodes an MCP auth token — rotate it the same way if it is used anywhere.
