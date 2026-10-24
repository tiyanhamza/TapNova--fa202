const crypto = require('crypto');
const slugify = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
function whatsapp(n) {
  let d = String(n || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2);
  else if (/^0[567]\d{8}$/.test(d)) d = '212' + d.slice(1);
  else if (/^[567]\d{8}$/.test(d)) d = '212' + d;
  if (d.startsWith('2120')) d = '212' + d.slice(4);
  return /^\d{8,15}$/.test(d) ? d : '';
}
function safeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) { if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; u = 'https://' + u; }
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.includes('.') ? x.href : ''; } catch { return ''; }
}
const cl = v => String(v || '').startsWith('https://res.cloudinary.com/') ? String(v).slice(0, 500) : '';
const social = (v, base) => { v = String(v || '').trim(); return v[0] === '@' ? (/^@[\w.]{1,40}$/.test(v) ? base + v.slice(1) : '') : safeUrl(v); };
function cleanProfile(b) {
  const t = (v, m) => String(v || '').trim().slice(0, m), bad = [];
  const U = (k, label, fn) => { const v = fn ? fn(b[k]) : safeUrl(b[k]); if (String(b[k] || '').trim() && !v) bad.push(label); return v; };
  const name = t(b.name, 80);
  if (!name) return { error: 'Le nom commercial est obligatoire.' };
  const w = String(b.whatsapp || ''), m = w.match(/wa\.me\/(\d+)/);
  const wa = whatsapp(m ? m[1] : w);
  if (w.trim() && !wa) bad.push('WhatsApp');
  const links = (Array.isArray(b.links) ? b.links.map(l => (l.title || '') + '|' + (l.url || '')) : String(b.links || '').split('\n'))
    .map(l => { const [a, ...r] = l.split('|'); const url = safeUrl(r.join('|')); return a.trim() && url ? { title: a.trim().slice(0, 40), url } : null; }).filter(Boolean).slice(0, 10);
  const em = t(b.email, 120);
  if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) bad.push('E-mail');
  const data = {
    name, description: t(b.description, 600), phone: t(b.phone, 30), whatsapp: wa,
    instagram: U('instagram', 'Instagram', v => social(v, 'https://instagram.com/')),
    facebook: U('facebook', 'Facebook'), tiktok: U('tiktok', 'TikTok', v => social(v, 'https://www.tiktok.com/@')),
    address: t(b.address, 200), maps_url: U('maps_url', 'Google Maps'), website: U('website', 'Site Internet'),
    hours: t(b.hours, 300), links, category: t(b.category, 80), email: bad.includes('E-mail') ? '' : em,
    color: /^#[0-9a-fA-F]{6}$/.test(String(b.color || '')) ? b.color : '#1F5FFF', cover_url: cl(b.cover_url),
    logo_url: cl(b.logo_url)
  };
  return bad.length ? { error: 'Lien invalide : ' + bad.join(', ') + '.' } : { data };
}
const b64 = s => Buffer.from(s).toString('base64url');
const sign = (p, k) => crypto.createHmac('sha256', k).update(p).digest('base64url');
const makeSession = (key, ttl = 8 * 3600e3) => { const p = b64(JSON.stringify({ exp: Date.now() + ttl })); return p + '.' + sign(p, key); };
function checkSession(tok, key) {
  if (!tok || !key) return false;
  const [p, s] = String(tok).split('.'); if (!p || !s) return false;
  const e = sign(p, key); if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url')).exp > Date.now(); } catch { return false; }
}
const h = x => crypto.createHash('sha256').update(String(x)).digest();
const safeEq = (a, b) => crypto.timingSafeEqual(h(a), h(b));
module.exports = { slugify, whatsapp, safeUrl, cleanProfile, makeSession, checkSession, safeEq };
