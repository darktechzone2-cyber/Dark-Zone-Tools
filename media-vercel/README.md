# DTZ Media Cloud — Vercel-native file hosting

Free media cloud hosting by **Dark Tech Zone**: upload MP4 videos, MP3 audios,
images and APK files and get a permanent direct link. No signup, no account.

This is the Vercel rebuild of the old PHP `M/` media host. The PHP version
cannot run on GitHub Pages (no PHP/MySQL) — this version is pure
**Node.js serverless + Vercel Blob** storage.

## What is inside

| File | What it does |
|---|---|
| `public/index.html` | Upload UI (Dark Zone Toolkit design): drag-and-drop + file picker, upload progress bar, direct link + copy button, video/audio/image preview, Recent Uploads list (localStorage) |
| `api/upload.js` | `POST /api/upload` — multipart upload, hand-written parser, zero extra dependencies. Validates type (MP4/WebM/MP3/WAV/PNG/JPG/WEBP/GIF/APK) and size (max 100 MB), stores the file in Vercel Blob as `media/<8-char-id>.<ext>`, returns `{ ok, id, url, filename, size, contentType }` |
| `api/delete.js` | `POST /api/delete` with JSON `{ "url" }` — deletes a Blob file |
| `vercel.json` | Function timeouts (upload 60s, delete 30s) |
| `package.json` | Only dependency: `@vercel/blob` |
| `.env.example` | Env var template (empty — never a real value) |

## How the upload flow works

1. User picks/drops a file in the browser (max 100 MB, allowed types only).
2. The page POSTs it as `multipart/form-data` (`mediaFile` field) to `/api/upload`
   with `XMLHttpRequest`, so the progress bar is live.
3. The function parses the multipart body, checks type/size, and calls
   `put('media/<id>.<ext>', buffer, { access: 'public' })` on Vercel Blob.
4. The browser shows the direct Blob URL, a Copy button and a preview
   (video/audio/image player, or a download link for APK), and saves the entry
   in `localStorage` under `dtzMediaRecent` (max 20, this browser only).

Old PHP links (`/M/?id=...`) are **not** compatible — files now live on Vercel
Blob and the direct link is the Blob URL (e.g.
`https://<store>.public.blob.vercel-storage.com/media/<id>.mp4`).

## Deploy (Vercel dashboard — a human step)

1. Push this folder to GitHub (new repo, or a folder in the Dark-Zone-Tools repo).
2. Vercel → **Add New → Project** → Import the repo.
3. Vercel → **Storage → Create → Blob** → attach the store to this project.
   Vercel sets `BLOB_READ_WRITE_TOKEN` automatically. (If you set it by hand,
   copy it from the store's settings — never paste it in chat.)
4. **Deploy.**
5. Optional custom domain: Vercel → Project → Settings → Domains →
   add `media.darktechzon.site` (DNS: CNAME → `cname.vercel-dns.com`).

No database to migrate: the old MySQL `media_files` table is not used. Old
files stay on the InfinityFree host until they are re-uploaded here.

## Honest limits

- **Vercel serverless request-body limit:** on the Hobby plan a serverless
  function accepts roughly **4.5 MB** request bodies, even though this app
  allows up to 100 MB. Files above the platform limit will fail with a 413
  from Vercel before reaching the function. A Pro plan raises the limit; for
  truly large files the upgrade path is client-side direct upload
  (`@vercel/blob/client` + a token endpoint) instead of proxying through
  the function.
- **Vercel Blob free tier has storage/bandwidth caps** — check current Vercel
  Blob pricing before promising "unlimited".
- **Files are public by URL** — anyone with the link can open/download them.
  There is no login system in v1 and no per-user isolation.
- **Delete only works from the browser that uploaded** (the URL is stored in
  that browser's localStorage). There is no admin list of all files in v1.
- **No brute-force/rate-limit protection** on the upload endpoint in v1 — add
  a KV counter or CAPTCHA before announcing it widely if abuse appears.
- Uploads go through one function invocation, so very slow connections can
  hit the 60s function timeout on large files.

## Local test (no deploy needed)

```bash
npm install
node --check api/upload.js
node --check api/delete.js
```

With no `BLOB_READ_WRITE_TOKEN` set, `POST /api/upload` returns a clear JSON
error saying the Blob store must be created first — that path is the smoke
test for the parser + validation without touching any cloud service.
