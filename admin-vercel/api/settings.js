// /api/settings — Site Settings (auth required).
//   GET -> { ok, settings: { toolkit_name, channel_link } }
//   PUT { toolkit_name, channel_link } -> saves them
// Data lives in KV hash "dtz:admin:settings".
'use strict';

const { kv, hashToObject } = require('../lib/kv');
const { requireAuth } = require('../lib/auth');
const { send, getBody, handleError } = require('../lib/http');

const SETTINGS_KEY = 'dtz:admin:settings';
const DEFAULTS = {
  toolkit_name: 'Dark Zone Toolkit',
  channel_link: 'https://whatsapp.com/channel/0029VbCgB63LCoX5aiV5qp1t',
};

module.exports = async (req, res) => {
  try {
    requireAuth(req);

    if (req.method === 'GET') {
      const stored = hashToObject(await kv('HGETALL', SETTINGS_KEY));
      return send(res, 200, { ok: true, settings: { ...DEFAULTS, ...stored } });
    }

    if (req.method === 'PUT') {
      const body = await getBody(req);
      const toolkitName = String(body.toolkit_name || '').trim();
      const channelLink = String(body.channel_link || '').trim();
      if (!toolkitName || !channelLink) {
        return send(res, 400, { ok: false, error: 'Toolkit name and channel link are required.' });
      }
      await kv('HSET', SETTINGS_KEY, 'toolkit_name', toolkitName, 'channel_link', channelLink);
      return send(res, 200, { ok: true, settings: { toolkit_name: toolkitName, channel_link: channelLink } });
    }

    return send(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return handleError(res, err);
  }
};
