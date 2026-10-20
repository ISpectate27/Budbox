'use strict';
/* Shared helpers for the Vercel serverless functions (no npm dependencies). */
const crypto = require('crypto');

const PRODUCTS = ['Granddaddy Purp', 'Pink Runtz', 'White Widow', 'Gelato Mix'];
const SIZES = {
  '⅛ (8 stems)': 20, '¼ (16 stems)': 40, '⅜ (24 stems)': 50, '½ (32 stems)': 60,
  '⅝ (40 stems)': 70, '¾ (48 stems)': 80, '⅞ (56 stems)': 90, '1 (64 stems)': 100
};
const CITIES = ['Ajax', 'Brock', 'Clarington', 'Oshawa', 'Pickering', 'Scugog', 'Uxbridge', 'Whitby'];
const STATUSES = ['new', 'confirmed', 'paid', 'delivered', 'cancelled'];
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'beats4vertt@gmail.com').trim().toLowerCase();
const SESSION_MS = 12 * 3600e3;
const HASH = 'bb:orders';

/* ---------- Upstash Redis over REST (works with Vercel's Upstash/KV integration) ---------- */
async function redis(cmd) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Database is not connected yet (see README step 2).');
  const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error('Database error');
  return d.result;
}
async function limited(key, max, windowSec) {
  const n = await redis(['INCR', key]);
  if (n === 1) await redis(['EXPIRE', key, windowSec]);
  return n > max;
}
async function listOrders() {
  const flat = (await redis(['HGETALL', HASH])) || [];
  const out = [];
  for (let i = 1; i < flat.length; i += 2) { try { out.push(JSON.parse(flat[i])); } catch (_) {} }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
const getOrder = async id => { const v = await redis(['HGET', HASH, id]); return v ? JSON.parse(v) : null; };
const putOrder = o => redis(['HSET', HASH, o.id, JSON.stringify(o)]);
const delOrder = id => redis(['HDEL', HASH, id]);

/* ---------- small utils ---------- */
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const ip = req => String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}

/* ---------- stateless signed session (serverless has no memory between requests) ---------- */
const sigKey = () => sha('bb-session|' + (process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || ''));
const sign = p => crypto.createHmac('sha256', sigKey()).update(p).digest('base64url');
function makeToken() { const p = String(Date.now() + SESSION_MS); return p + '.' + sign(p); }
function authed(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const t = cookies(req).bb_sess; if (!t) return false;
  const [p, s] = t.split('.'); if (!p || !s) return false;
  return safeEqual(s, sign(p)) && Number(p) > Date.now();
}
const sessionCookie = (token, maxAge) => `bb_sess=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

/* ---------- order validation (prices come from here, never from the browser) ---------- */
function buildOrder(b) {
  b = b || {};
  const name = clean(b.name, 80), phone = clean(b.phone, 30), address = clean(b.address, 150);
  const city = clean(b.city, 30), when = clean(b.when, 80), notes = clean(b.notes, 400);
  if (!name || !phone || !address || !CITIES.includes(city)) return { error: 'Missing or invalid delivery details (Durham Region only).' };
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 20) return { error: 'Your bag is empty.' };
  const items = []; let total = 0;
  for (const it of b.items) {
    const qty = Number(it && it.qty);
    if (!it || !PRODUCTS.includes(it.name) || !Object.prototype.hasOwnProperty.call(SIZES, it.size) || !Number.isInteger(qty) || qty < 1 || qty > 20) return { error: 'Invalid item in order.' };
    const price = SIZES[it.size];
    items.push({ name: it.name, size: it.size, qty, price });
    total += price * qty;
  }
  return { order: { id: crypto.randomBytes(4).toString('hex'), createdAt: new Date().toISOString(), status: 'new', name, phone, address, city, when, notes, items, total } };
}

/* ---------- handler wrapper: method check, JSON-only for writes, safe errors ---------- */
function route(methods, fn, opts) {
  opts = opts || {};
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); return res.status(405).json({ error: 'Method not allowed' }); }
    if (req.method !== 'GET' && !String(req.headers['content-type'] || '').includes('application/json')) return res.status(415).json({ error: 'JSON only' });
    if (opts.admin) {
      if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD is not set in Vercel yet.' });
      if (!authed(req)) return res.status(401).json({ error: 'Not signed in' });
    }
    try { await fn(req, res); }
    catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: /Database/.test(e.message) ? e.message : 'Server error' }); }
  };
}

module.exports = { STATUSES, ADMIN_EMAIL, SESSION_MS, redis, limited, listOrders, getOrder, putOrder, delOrder, safeEqual, clean, ip, makeToken, sessionCookie, buildOrder, route };
