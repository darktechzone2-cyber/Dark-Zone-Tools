# DTZ Temp Mail — Vercel Project

Static UI + serverless proxy for the Temp Mail API (`https://temp-mail-ten-self.vercel.app`).
The upstream API sends no CORS headers, so the browser cannot call it directly —
these `/api/*` functions proxy it from the same origin.

## Structure

- `public/index.html` — full Temp Mail UI (generate mailbox, copy email, inbox
  with 10s auto-refresh, sandboxed message reader, delete mailbox). The mailbox
  token lives in the browser's `localStorage` (`dtz_temp_mail_token` /
  `dtz_temp_mail_email`), never in a server session.
- `api/mailbox.js` — POST creates a mailbox (`{email, token}`); DELETE removes it.
- `api/messages.js` — GET `?token=` lists inbox messages.
- `api/message.js` — GET `?token=&id=` reads one message.
- `vercel.json`, `package.json` — no dependencies, plain Node `fetch`.

## Deploy (Vercel)

1. Push this folder to a GitHub repo (or import the folder directly).
2. Vercel → **Add New → Project** → Import the repo. Framework preset: **Other**.
3. **No environment variables needed.** Deploy.
4. Add the custom domain `temp-mail` path later via the Dark Zone Tools hub
   (`darktechzon.site/temp-mail/`) or use the `*.vercel.app` URL.

## Notes

- The mailbox token is a throwaway credential stored only in the visitor's own
  browser — nothing is stored server-side.
- No secrets are in this repo. Do not add any.
