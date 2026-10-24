const { buildVcard } = require('../../lib/util');
const response = (statusCode, body, headers = {}) => ({ statusCode, headers, body });
exports.handler = async event => {
  if (event.httpMethod !== 'GET') {
    return response(405, 'Méthode non autorisée.', { Allow: 'GET' });
  }
  const slug = String((event.queryStringParameters || {}).slug || '');
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return response(404, 'Profil introuvable.');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return response(503, 'Service non configuré.');
  try {
    const result = await fetch(`${url}/rest/v1/profiles?slug=eq.${slug}&published=eq.true&active=eq.true&select=name,phone,whatsapp,website,description`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!result.ok) return response(502, 'Erreur temporaire.');
    const profile = (await result.json())[0];
    if (!profile) return response(404, 'Profil introuvable.');
    return response(200, buildVcard(profile), {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.vcf"`,
      'Cache-Control': 'no-store'
    });
  } catch {
    return response(502, 'Erreur temporaire.');
  }
};
