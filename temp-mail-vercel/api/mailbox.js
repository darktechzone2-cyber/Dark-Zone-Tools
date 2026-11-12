// POST /api/mailbox -> create a new mailbox (returns {email, token})
// DELETE /api/mailbox?token=... -> delete the mailbox on the upstream API
var UPSTREAM = 'https://temp-mail-ten-self.vercel.app';

module.exports = async function (req, res) {
  try {
    if (req.method === 'POST') {
      var r = await fetch(UPSTREAM + '/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (!r.ok) return res.status(502).json({ error: 'Upstream mailbox creation failed.' });
      var d = await r.json();
      if (!d.email || !d.token) return res.status(502).json({ error: 'Upstream returned an invalid mailbox.' });
      return res.status(200).json({ email: d.email, token: d.token });
    }
    if (req.method === 'DELETE') {
      var token = req.query && req.query.token;
      if (!token) return res.status(400).json({ error: 'Missing token.' });
      await fetch(UPSTREAM + '/mailbox?token=' + encodeURIComponent(token), { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) {
    return res.status(502).json({ error: 'Upstream unavailable.' });
  }
};
