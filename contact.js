const { buildVcard } = require("../../lib/util");

const response = (statusCode, body, headers = {}) => ({
  statusCode,
  body,
  headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
});

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return response(405, "Méthode non autorisée.", { Allow: "GET" });
  }

  const query = event.queryStringParameters || {};
  const source = String(event.rawUrl || "") + " " + String(event.path || "");
  const match = source.match(/\/c\/([^/?#\s]+)\/contact/i);
  const fromQuery = query.slug && query.slug !== ":slug" ? query.slug : "";
  let slug = String(fromQuery || (match ? match[1] : "")).trim().toLowerCase();
  try { slug = decodeURIComponent(slug); } catch (e) {}
  slug = slug.replace(/\.vcf$/, "");
  console.log("Contact vCard request:", { slug, path: event.path, rawUrl: event.rawUrl, query });

  if (!/^[a-z0-9_-]{1,60}$/.test(slug)) return response(404, "Profil introuvable.");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return response(503, "Service non configuré.");

  try {
    const result = await fetch(
      `${url}/rest/v1/profiles?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
      { headers: { apikey: key, Authorization: "Bearer " + key } }
    );
    if (!result.ok) {
      console.error("Supabase contact profile lookup failed:", result.status);
      return response(502, "Erreur temporaire.");
    }
    const profiles = await result.json();
    const profile = profiles[0];
    console.log("Supabase contact profile lookup result:", {
      slug,
      status: result.status,
      rowCount: profiles.length,
      profileFound: Boolean(profile),
    });

    if (!profile) return response(404, "Profil introuvable.");
    return response(200, buildVcard(profile), {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.vcf"`,
      "Cache-Control": "no-store",
    });
  } catch (error) {
    console.error("Contact vCard lookup failed:", error);
    return response(502, "Erreur temporaire.");
  }
};
