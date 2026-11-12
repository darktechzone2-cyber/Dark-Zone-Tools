// /api/reports — User Reports (auth required).
//   GET    -> { ok, reports: [...] }   (newest first)
//   DELETE ?id=123 -> clears a report
// Data lives in KV as one JSON document: key "dtz:admin:reports".
// (The static hub feedback form currently sends mail, so this list stays
//  empty until something writes reports into KV — see README.)
'use strict';

const { kvGetJson, kvSetJson } = require('../lib/kv');
const { requireAuth } = require('../lib/auth');
const { send, getQuery, handleError } = require('../lib/http');

const REPORTS_KEY = 'dtz:admin:reports';

module.exports = async (req, res) => {
  try {
    requireAuth(req);

    if (req.method === 'GET') {
      const reports = await kvGetJson(REPORTS_KEY, []);
      const sorted = [...reports].sort((a, b) => (b.id || 0) - (a.id || 0));
      return send(res, 200, { ok: true, reports: sorted });
    }

    if (req.method === 'DELETE') {
      const id = Number(getQuery(req).get('id'));
      if (!id) return send(res, 400, { ok: false, error: 'Report id required.' });
      const reports = await kvGetJson(REPORTS_KEY, []);
      const next = reports.filter((r) => Number(r.id) !== id);
      if (next.length === reports.length) {
        return send(res, 404, { ok: false, error: 'Report not found.' });
      }
      await kvSetJson(REPORTS_KEY, next);
      return send(res, 200, { ok: true, deleted: id });
    }

    return send(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
};
