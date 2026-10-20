'use strict';
const c = require('../../lib/common');

module.exports = c.route(['POST'], async (req, res) => {
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD is not set in Vercel yet.' });
  if (await c.limited('bb:rl:login:' + c.ip(req), 8, 900)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const b = req.body || {};
  const okEmail = c.safeEqual(c.clean(b.email, 200).toLowerCase(), c.ADMIN_EMAIL);
  const okPass = c.safeEqual(String(b.password || ''), process.env.ADMIN_PASSWORD);
  if (!(okEmail && okPass)) return res.status(401).json({ error: 'Wrong email or password.' });
  res.setHeader('Set-Cookie', c.sessionCookie(c.makeToken(), c.SESSION_MS / 1000));
  res.status(200).json({ ok: true });
});
