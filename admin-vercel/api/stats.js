// GET /api/stats — dashboard counters (auth required):
//   { ok, activeTools, totalClicks, reportsCount, mediaCount }
'use strict';

const { kvGetJson } = require('../lib/kv');
const { requireAuth } = require('../lib/auth');
const { send, handleError } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    requireAuth(req);
    if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });
    const [tools, reports, media] = await Promise.all([
      kvGetJson('dtz:admin:tools', []),
      kvGetJson('dtz:admin:reports', []),
      kvGetJson('dtz:admin:media', []),
    ]);
    const activeTools = tools.filter((t) => Number(t.status) === 1).length;
    const totalClicks = tools.reduce((sum, t) => sum + (Number(t.clicks) || 0), 0);
    return send(res, 200, {
      ok: true,
      activeTools,
      totalClicks,
      reportsCount: reports.length,
      mediaCount: media.length,
    });
  } catch (err) {
    return handleError(res, err);
  }
};
