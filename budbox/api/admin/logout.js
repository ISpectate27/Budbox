'use strict';
const c = require('../../lib/common');

module.exports = c.route(['POST'], async (req, res) => {
  res.setHeader('Set-Cookie', c.sessionCookie('', 0));
  res.status(200).json({ ok: true });
});
