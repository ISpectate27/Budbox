'use strict';
const c = require('../../lib/common');

/* Dashboard: list all orders (login required) */
module.exports = c.route(['GET'], async (req, res) => {
  res.status(200).json({ orders: await c.listOrders() });
}, { admin: true });
