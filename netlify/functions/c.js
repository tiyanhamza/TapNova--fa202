const { checkSession } = require('../../lib/util');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  tel: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  mail: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  pin: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  time: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  web: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z'
};
const page = (s, title, body, cache, color) => ({ statusCode: s, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache || 'no-store' },
  body: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${color || '#1F5FFF'}"><title>${esc(title)}</title><link rel="stylesheet" href="/style.css"></head><body class="pub" style="--c:${color || '#1F5FFF'}">${body}</body></html>` });
exports.handler = async e => {
  const slug = decodeURIComponent((e.path || '').split('/').filter(Boolean).pop() || '');
  const nf = () => page(404, 'Profil introuvable · TapNova', '<main class="card"><h1>Profil introuvable</h1><p>Ce lien n’est pas actif.</p><a class="btn" href="/">Aller à TapNova</a></main>');
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return nf();
  const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_KEY, q = e.queryStringParameters || {};
  if (!U || !K) return page(503, 'Service indisponible', '<main class="card"><h1>Service non configuré</h1><p>Réessayez plus tard.</p></main>');
  const tok = ((e.headers.cookie || '').match(/tn_s=([^;]+)/) || [])[1];
  const prev = !!q.preview && checkSession(tok, (process.env.ADMIN_KEY || '') + ':tapnova-session');
  let p;
  try {
    const r = await fetch(`${U}/rest/v1/profiles?slug=eq.${slug}&select=*${prev ? '' : '&published=eq.true&active=eq.true'}`, { headers: { apikey: K, Authorization: 'Bearer ' + K } });
    if (!r.ok) throw 0; p = (await r.json())[0];
  } catch { return page(502, 'Erreur', '<main class="card"><h1>Erreur temporaire</h1><p>Réessayez dans un instant.</p></main>'); }
  if (!p) return nf();
  if (q.vcard) {
    const v = s => String(s || '').replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n');
    const card = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + v(p.name), 'ORG:' + v(p.name), p.category && 'TITLE:' + v(p.category), p.phone && 'TEL;TYPE=WORK,VOICE:' + v(p.phone),
      p.email && 'EMAIL:' + v(p.email), p.website && 'URL:' + p.website, p.address && 'ADR;TYPE=WORK:;;' + v(p.address) + ';;;;', 'END:VCARD'].filter(Boolean).join('\r\n');
    return { statusCode: 200, headers: { 'Content-Type': 'text/vcard; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug}.vcf"`, 'Cache-Control': 'no-store' }, body: card };
  }
  const color = /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : '#1F5FFF';
  const soc = [['WhatsApp', p.whatsapp && 'https://wa.me/' + p.whatsapp, 'n-wa', 'W'], ['Instagram', p.instagram, 'n-ig', 'IG'], ['Facebook', p.facebook, 'n-fb', 'f'], ['TikTok', p.tiktok, 'n-tt', 'T']].filter(x => x[1]);
  const rows = [['Téléphone', p.phone, p.phone && 'tel:' + p.phone.replace(/[^\d+]/g, ''), 'tel'], ['E-mail', p.email, p.email && 'mailto:' + p.email, 'mail'],
    ['Adresse', p.address || (p.maps_url ? 'Ouvrir l’itinéraire' : ''), p.maps_url, 'pin'], ['Horaires', p.hours, '', 'time'],
    ['Site Internet', p.website && p.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), p.website, 'web'], ...(p.links || []).map(l => ['Lien', l.title, l.url, 'web'])].filter(r => r[1]);
  const row = ([l, v, h, i]) => { const inner = `<span class="ic"><svg viewBox="0 0 24 24"><path d="${I[i]}"/></svg></span><div><small>${l}</small><b${i === 'time' ? ' style="white-space:pre-line"' : ''}>${esc(v)}</b></div>${h ? '<span class="go">↗</span>' : ''}`;
    return h ? `<a class="row" href="${esc(h)}" ${h.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${inner}</a>` : `<div class="row">${inner}</div>`; };
  const body = `${prev && !p.published ? '<p class="warn pv">Aperçu : ce profil n’est pas encore publié.</p>' : ''}
<div class="cover">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="">` : ''}</div>
<main class="pf"><div class="av${p.logo_url ? '' : ' ph'}">${p.logo_url ? `<img src="${esc(p.logo_url)}" alt="${esc(p.name)}">` : esc(p.name.charAt(0).toUpperCase())}</div>
<h1>${esc(p.name)}</h1>${p.category ? `<div class="pill">${esc(p.category)}</div>` : ''}${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
<a class="btn main" href="/c/${slug}?vcard=1">Ajouter aux contacts</a>
${soc.length ? `<div class="grid">${soc.map(([l, h, c, b]) => `<a class="btn ${c}" href="${esc(h)}" target="_blank" rel="noopener"><span class="b">${b}</span>${l}</a>`).join('')}</div>` : ''}
${rows.length ? `<section class="info"><h2>Informations</h2>${rows.map(row).join('')}</section>` : ''}
<p class="muted small" style="margin-top:24px">Profil créé avec TapNova</p></main>`;
  return page(200, p.name + ' · TapNova', body, prev ? 'no-store' : 'public, max-age=60', color);
};
