'use strict';
const c = require('../../../lib/common');

/* Dashboard: change status (PATCH) or delete (DELETE) one order (login required) */
module.exports = c.route(['PATCH', 'DELETE'], async (req, res) => {
  const id = String(req.query.id || '');
  if (!/^[a-f0-9]{8}$/.test(id)) return res.status(404).json({ error: 'Not found' });
  const o = await c.getOrder(id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  if (req.method === 'DELETE') { await c.delOrder(id); return res.status(200).json({ ok: true }); }
  const status = (req.body || {}).status;
  if (!c.STATUSES.includes(status)) return res.status(400).json({ error: 'Bad status' });
  o.status = status; o.updatedAt = new Date().toISOString();
  await c.putOrder(o);
  res.status(200).json({ ok: true, order: o });
}, { admin: true });
