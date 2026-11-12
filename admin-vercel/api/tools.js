// /api/tools — Manage Tools (auth required on every method).
//   GET    -> { ok, tools: [...] }            (newest first)
//   POST   { name, category, filename, icon, status } -> creates a tool
//   PUT    { id, name, category, filename, icon, status } -> edits a tool
//   DELETE ?id=123 -> deletes a tool
// Data lives in KV as one JSON document: key "dtz:admin:tools".
'use strict';

const { kvGetJson, kvSetJson, kv } = require('../lib/kv');
const { requireAuth } = require('../lib/auth');
const { send, getBody, getQuery, handleError } = require('../lib/http');

const TOOLS_KEY = 'dtz:admin:tools';
const SEQ_KEY = 'dtz:admin:seq:tool';

function sortDesc(tools) {
  return [...tools].sort((a, b) => (b.id || 0) - (a.id || 0));
}

function cleanToolInput(body) {
  return {
    name: String(body.name || '').trim(),
    category: String(body.category || '').trim(),
    filename: String(body.filename || body.file_url || '').trim(),
    icon: String(body.icon || body.icon_url || 'fas fa-cube').trim() || 'fas fa-cube',
    status: Number(body.status) === 0 ? 0 : 1,
  };
}

module.exports = async (req, res) => {
  try {
    requireAuth(req);
    const method = req.method;

    if (method === 'GET') {
      const tools = await kvGetJson(TOOLS_KEY, []);
      return send(res, 200, { ok: true, tools: sortDesc(tools) });
    }

    if (method === 'POST') {
      const body = await getBody(req);
      const input = cleanToolInput(body);
      if (!input.name || !input.filename) {
        return send(res, 400, { ok: false, error: 'Name and File URL required.' });
      }
      const id = Number(await kv('INCR', SEQ_KEY));
      const tools = await kvGetJson(TOOLS_KEY, []);
      const tool = { id, ...input, clicks: 0 };
      tools.push(tool);
      await kvSetJson(TOOLS_KEY, tools);
      return send(res, 201, { ok: true, tool });
    }

    if (method === 'PUT') {
      const body = await getBody(req);
      const id = Number(body.id);
      const input = cleanToolInput(body);
      if (!id || !input.name || !input.filename) {
        return send(res, 400, { ok: false, error: 'Valid id, name and File URL required.' });
      }
      const tools = await kvGetJson(TOOLS_KEY, []);
      const idx = tools.findIndex((t) => Number(t.id) === id);
      if (idx === -1) return send(res, 404, { ok: false, error: 'Tool not found.' });
      tools[idx] = { ...tools[idx], ...input };
      await kvSetJson(TOOLS_KEY, tools);
      return send(res, 200, { ok: true, tool: tools[idx] });
    }

    if (method === 'DELETE') {
      const id = Number(getQuery(req).get('id'));
      if (!id) return send(res, 400, { ok: false, error: 'Tool id required.' });
      const tools = await kvGetJson(TOOLS_KEY, []);
      const next = tools.filter((t) => Number(t.id) !== id);
      if (next.length === tools.length) {
        return send(res, 404, { ok: false, error: 'Tool not found.' });
      }
      await kvSetJson(TOOLS_KEY, next);
      return send(res, 200, { ok: true, deleted: id });
    }

    return send(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
};
