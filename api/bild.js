/* Fetches a Shopify product image for the signed-in user, so the browser's cross-origin rules cannot stop the import.
   POST /api/bild  { url }   (Authorization: Bearer <Supabase session token>)
   Only Rubato's own Shopify addresses are allowed. If the address is a product page, its main image (og:image) is used.
   Answers with the image bytes, or JSON { error } when it cannot be fetched. */

const env = (k) => { const v = process.env[k]; if (!v) throw new Error("Missing environment variable " + k); return v; };
const MAX = 15 * 1024 * 1024;
const allowed = (u) => u.protocol === "https:" && (u.hostname === "cdn.shopify.com" || /(^|\.)atemporubato\.com$/i.test(u.hostname) || /^[a-z0-9-]+\.myshopify\.com$/i.test(u.hostname));

async function verifyUser(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(env("SUPABASE_URL") + "/auth/v1/user", { headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), Authorization: "Bearer " + token } });
  if (!res.ok) return null;
  const u = await res.json();
  return u && /@atemporubato\.com$/i.test(u.email || "") ? u : null;
}
// Follows redirects by hand so that every hop stays on an allowed address.
async function get(url) {
  let u = new URL(url);
  for (let i = 0; i < 4; i++) {
    if (!allowed(u)) throw Object.assign(new Error("Address not allowed: " + u.hostname), { status: 400 });
    const r = await fetch(u, { redirect: "manual", headers: { "User-Agent": "RubatoPLM/1.0", Accept: "image/avif,image/webp,image/*,text/html;q=0.8" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { u = new URL(r.headers.get("location"), u); continue; }
    return { r, u };
  }
  throw Object.assign(new Error("Too many redirects"), { status: 502 });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    if (!(await verifyUser(req))) return res.status(401).json({ error: "Not signed in" });
    let raw = String((req.body && req.body.url) || "").trim();
    if (raw.startsWith("//")) raw = "https:" + raw;
    let first;
    try { first = new URL(raw); } catch (e) { return res.status(400).json({ error: "Not a valid address" }); }
    if (!allowed(first)) return res.status(400).json({ error: "Address not allowed: " + first.hostname });
    let { r, u } = await get(first.toString());
    if (!r.ok) return res.status(502).json({ error: "Shopify answered " + r.status });
    let type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (type === "text/html") {
      const html = (await r.text()).slice(0, 400000);
      const m = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i);
      if (!m) return res.status(422).json({ error: "The page has no product image" });
      let img = m[1].replace(/&amp;/g, "&"); if (img.startsWith("//")) img = "https:" + img;
      const next = new URL(img, u); next.searchParams.set("width", "1200");
      ({ r, u } = await get(next.toString()));
      if (!r.ok) return res.status(502).json({ error: "Shopify answered " + r.status });
      type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    }
    if (!/^image\//.test(type)) return res.status(422).json({ error: "Not an image (" + (type || "unknown type") + ")" });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX) return res.status(413).json({ error: "Image too large" });
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(e.status || 500).json({ error: String((e && e.message) || e).slice(0, 200) });
  }
};
