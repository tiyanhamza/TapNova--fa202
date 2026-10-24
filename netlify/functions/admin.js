const crypto = require('crypto');
const { safeEq, makeSession, checkSession, cleanProfile, slugify, whatsapp } = require('../../lib/util');
const tries = new Map(); // limitation best-effort par instance serveur
const env = k => process.env[k] || '';
const J = (s, o, h = {}) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...h }, body: JSON.stringify(o) });
const sk = () => env('ADMIN_KEY') + ':tapnova-session';
const ck = 'HttpOnly; Secure; SameSite=Strict; Path=/';
async function db(path, opt = {}) {
  const k = env('SUPABASE_SERVICE_KEY');
  const r = await fetch(env('SUPABASE_URL') + '/rest/v1/' + path, { ...opt, headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=representation' } });
  const t = await r.text();
  if (!r.ok) { const e = new Error(t); e.status = r.status; throw e; }
  return t ? JSON.parse(t) : [];
}
exports.handler = async e => {
  if (e.httpMethod !== 'POST') return J(405, { error: 'Méthode non autorisée.' });
  let b; try { b = JSON.parse(e.body || '{}'); } catch { return J(400, { error: 'Requête invalide.' }); }
  const a = b.action;
  if (a === 'contact') return J(200, { whatsapp: whatsapp(env('CONTACT_WHATSAPP')) });
  if (env('ADMIN_KEY').length < 12) return J(503, { error: 'Serveur non configuré : définissez ADMIN_KEY (12 caractères minimum) dans Netlify.' });
  if (a === 'login') {
    const ip = String(e.headers['x-nf-client-connection-ip'] || e.headers['x-forwarded-for'] || '?').split(',')[0].trim();
    const t = tries.get(ip) || { n: 0, until: 0 };
    if (Date.now() < t.until) return J(429, { error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    if (!safeEq(b.key, env('ADMIN_KEY'))) { if (++t.n >= 5) { t.until = Date.now() + 15 * 60e3; t.n = 0; } tries.set(ip, t); return J(401, { error: 'Clé administrateur incorrecte.' }); }
    tries.delete(ip);
    return J(200, { ok: true }, { 'Set-Cookie': `tn_s=${makeSession(sk())}; ${ck}; Max-Age=28800` });
  }
  if (a === 'logout') return J(200, { ok: true }, { 'Set-Cookie': `tn_s=; ${ck}; Max-Age=0` });
  if (!checkSession((String(e.headers.cookie || '').match(/(?:^|;\s*)tn_s=([^;]+)/) || [])[1], sk())) return J(401, { error: 'Session expirée. Reconnectez-vous.' });
  if (a === 'me') return J(200, { ok: true });
  if (a === 'sign') {
    if (!env('CLOUDINARY_CLOUD_NAME') || !env('CLOUDINARY_API_KEY') || !env('CLOUDINARY_API_SECRET')) return J(503, { error: "Stockage d'images non configuré (Cloudinary)." });
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHash('sha1').update(`folder=tapnova&timestamp=${ts}${env('CLOUDINARY_API_SECRET')}`).digest('hex');
    return J(200, { cloud: env('CLOUDINARY_CLOUD_NAME'), key: env('CLOUDINARY_API_KEY'), ts, sig, folder: 'tapnova' });
  }
  if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_KEY')) return J(503, { error: 'Base de données non configurée (Supabase). Les données ne peuvent pas être enregistrées.' });
  const id = b.id || (b.profile && b.profile.id);
  if (id && !/^[0-9a-f-]{36}$/.test(id)) return J(400, { error: 'Identifiant invalide.' });
  try {
    if (a === 'list') return J(200, { items: await db('profiles?select=*&order=created_at.desc') });
    if (a === 'toggle' && ['published', 'active'].includes(b.field)) {
      const x = await db('profiles?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ [b.field]: !!b.value }) });
      return x.length ? J(200, { item: x[0] }) : J(404, { error: 'Profil introuvable.' });
    }
    if (a === 'delete') { await db('profiles?id=eq.' + id, { method: 'DELETE' }); return J(200, { ok: true }); }
    if (a === 'save') {
      const r = cleanProfile(b.profile || {}); if (r.error) return J(400, { error: r.error });
      if (id) { const x = await db('profiles?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(r.data) }); return x.length ? J(200, { item: x[0] }) : J(404, { error: 'Profil introuvable.' }); }
      const base = slugify(r.data.name) || 'client'; let slug = base;
      for (let i = 0; i < 5; i++) {
        try { const x = await db('profiles', { method: 'POST', body: JSON.stringify({ ...r.data, slug }) }); return J(200, { item: x[0] }); }
        catch (err) { if (err.status === 409) slug = base + '-' + crypto.randomBytes(2).toString('hex'); else throw err; }
      }
      return J(500, { error: 'Impossible de générer un lien unique.' });
    }
    return J(400, { error: 'Action inconnue.' });
  } catch { return J(502, { error: 'Erreur réseau ou base de données. Vérifiez la configuration Supabase.' }); }
};
