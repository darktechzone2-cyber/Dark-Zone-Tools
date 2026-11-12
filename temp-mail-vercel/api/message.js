// GET /api/message?token=...&id=... -> {message: {...}}
var UPSTREAM = 'https://temp-mail-ten-self.vercel.app';

module.exports = async function (req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    var token = req.query && req.query.token;
    var id = req.query && req.query.id;
    if (!token || !id) return res.status(400).json({ error: 'Missing token or id.' });
    var r = await fetch(
      UPSTREAM + '/message?token=' + encodeURIComponent(token) + '&id=' + encodeURIComponent(id),
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) return res.status(502).json({ error: 'Message could not be rendered.' });
    var d = await r.json();
    return res.status(200).json({ message: d.message || {} });
  } catch (e) {
    return res.status(502).json({ error: 'Upstream unavailable.' });
  }
};
