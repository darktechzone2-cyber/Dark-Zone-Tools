// GET /api/messages?token=... -> {messages: [...]}
var UPSTREAM = 'https://temp-mail-ten-self.vercel.app';

module.exports = async function (req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    var token = req.query && req.query.token;
    if (!token) return res.status(400).json({ error: 'Missing token.' });
    var r = await fetch(UPSTREAM + '/messages?token=' + encodeURIComponent(token), {
      headers: { Accept: 'application/json' }
    });
    if (!r.ok) return res.status(502).json({ error: 'Failed to retrieve messages.' });
    var d = await r.json();
    return res.status(200).json({ messages: d.messages || [] });
  } catch (e) {
    return res.status(502).json({ error: 'Upstream unavailable.' });
  }
};
