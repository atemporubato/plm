/* Fetches a Shopify product image for the signed-in user, so the browser's cross-origin rules cannot stop the import.
   POST /api/bild  { url }   (Authorization: Bearer <Supabase session token>)
   POST /api/bild  { sok, farger }  looks up the product image in Shopify by style name (NOOS and re-stock styles).
   Only Rubato's own Shopify addresses are allowed. If the address is a product page, its main image (og:image) is used.
   Answers with the image bytes, or JSON { error } when it cannot be fetched. */

const env = (k) => { const v = process.env[k]; if (!v) throw new Error("Missing environment variable " + k); return v; };
const MAX = 15 * 1024 * 1024;
// http-adresser lyfts till https innan kontrollen (gamla länkar till butiken är ofta sparade som http).
const https = (u) => { if (u.protocol === "http:") { u.protocol = "https:"; u.port = ""; } return u; };
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
    https(u);
    if (!allowed(u)) throw Object.assign(new Error("Address not allowed: " + u.protocol + "//" + u.hostname), { status: 400 });
    const r = await fetch(u, { redirect: "manual", headers: { "User-Agent": "RubatoPLM/1.0", Accept: "image/avif,image/webp,image/*,text/html;q=0.8" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { u = new URL(r.headers.get("location"), u); continue; }
    return { r, u };
  }
  throw Object.assign(new Error("Too many redirects"), { status: 502 });
}

/* ---------- Shopify Admin: look up a product image by style name (for NOOS and re-stock styles) ---------- */
const API = "2025-07";
let tokenCache = null;
async function shopifyToken() {
  if (tokenCache && tokenCache.exp > Date.now()) return tokenCache.token;
  const res = await fetch(`https://${env("SHOPIFY_STORE")}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "client_credentials", client_id: env("SHOPIFY_CLIENT_ID"), client_secret: env("SHOPIFY_CLIENT_SECRET") }) });
  const body = await res.json();
  if (!body.access_token) throw new Error("Shopify sign-in failed");
  tokenCache = { token: body.access_token, exp: Date.now() + 20 * 60 * 1000 };
  return body.access_token;
}
const words = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
const baseTitle = (title) => String(title || "").split(/\s+in\s+/i)[0];
// Picks a product only when the match is unambiguous: the title before " in <colour>" equals the style name,
// or every product that contains the name shares one and the same base title. Otherwise nothing is returned.
function pickProduct(name, colours, products) {
  const want = words(name); if (!want.length) return null;
  const cands = products.filter((p) => p.image && want.every((w) => words(p.title).includes(w)));
  if (!cands.length) return null;
  const key = (p) => words(baseTitle(p.title)).join(" ");
  const exact = cands.filter((p) => key(p) === want.join(" "));
  let pool = exact;
  if (!pool.length) { const bases = [...new Set(cands.map(key))]; if (bases.length !== 1) return null; pool = cands; }
  const cols = (colours || []).map((c) => words(c).join(" ")).filter(Boolean);
  const score = (p) => (p.status === "ACTIVE" ? 2 : 0) + (cols.some((c) => words(p.title).join(" ").endsWith(c)) ? 1 : 0);
  return pool.slice().sort((a, b) => score(b) - score(a))[0];
}
async function searchProduct(name, colours) {
  const token = await shopifyToken();
  const q = words(name).map((w) => "title:" + w + "*").join(" ");
  const res = await fetch(`https://${env("SHOPIFY_STORE")}/admin/api/${API}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: "query($q:String!){ products(first:50, query:$q){ nodes{ title handle status featuredMedia{ preview{ image{ url } } } } } }", variables: { q } }) });
  const body = await res.json();
  if (body.errors) throw new Error("Shopify: " + JSON.stringify(body.errors).slice(0, 200));
  const products = ((body.data && body.data.products && body.data.products.nodes) || []).map((n) => ({ title: n.title, handle: n.handle, status: n.status, image: n.featuredMedia && n.featuredMedia.preview && n.featuredMedia.preview.image ? n.featuredMedia.preview.image.url : null }));
  const hit = pickProduct(name, colours, products);
  return hit ? { url: hit.image, titel: hit.title, handle: hit.handle } : null;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    if (!(await verifyUser(req))) return res.status(401).json({ error: "Not signed in" });
    // { sok, farger }: finds the product image for a style by name. Answers { hit: null } when nothing matches for certain.
    if (req.body && req.body.sok) { const hit = await searchProduct(String(req.body.sok).slice(0, 120), Array.isArray(req.body.farger) ? req.body.farger.slice(0, 20) : []); return res.status(200).json({ hit }); }
    let raw = String((req.body && req.body.url) || "").trim();
    if (raw.startsWith("//")) raw = "https:" + raw;
    let first;
    try { first = https(new URL(raw)); } catch (e) { return res.status(400).json({ error: "Not a valid address" }); }
    if (!allowed(first)) return res.status(400).json({ error: "Address not allowed: " + first.protocol + "//" + first.hostname });
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
module.exports.pickProduct = pickProduct;
