'use strict';
const c = require('../lib/common');

/* Customer places an order */
module.exports = c.route(['POST'], async (req, res) => {
  if (await c.limited('bb:rl:order:' + c.ip(req), 10, 3600)) return res.status(429).json({ error: 'Too many orders, please text us instead.' });
  const r = c.buildOrder(req.body);
  if (r.error) return res.status(400).json({ error: r.error });
  await c.putOrder(r.order);
  res.status(201).json({ ok: true, id: r.order.id });
});
