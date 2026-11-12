// POST /api/ai  { prompt } -> { ok, reply }
// Proxies the prompt to the DTZ AI chat endpoint and flattens its SSE stream
// into one reply, exactly like the PHP panel did.
// The X-API-Key used here is the PUBLIC demo key the DTZ web page itself
// uses ("DarkTech") — it is not a secret. Auth (admin token) is still required.
'use strict';

const { requireAuth } = require('../lib/auth');
const { send, getBody, handleError } = require('../lib/http');

const DTZ_AI_URL = 'https://warm-ai-nine.vercel.app/api/chat';
const DTZ_API_KEY = 'DarkTech';

module.exports = async (req, res) => {
  try {
    requireAuth(req);
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
    const body = await getBody(req);
    const prompt = String(body.prompt || body.ai_prompt || '').trim();
    if (!prompt) return send(res, 400, { ok: false, error: 'Prompt required.' });

    const upstream = await fetch(DTZ_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': DTZ_API_KEY },
      body: JSON.stringify({ q: prompt }),
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) {
      return send(res, 502, { ok: false, error: `AI Gateway Failed (HTTP ${upstream.status})` });
    }
    const text = await upstream.text();
    let reply = '';
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const chunk = JSON.parse(line.slice(6));
          if (chunk.chunk) reply += chunk.chunk;
        } catch {
          // Ignore non-JSON SSE lines (e.g. data: [DONE]).
        }
      }
    }
    if (!reply.trim()) reply = text.trim();
    return send(res, 200, { ok: true, reply: reply.trim() });
  } catch (err) {
    return handleError(res, err);
  }
};
