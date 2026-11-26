/* Fetches a Shopify product image for the signed-in user, so the browser's cross-origin rules cannot stop the import.
   POST /api/bild  { url }   (Authorization: Bearer <Supabase session token>)
   POST /api/bild  { sok, farger }  looks up the product image in Shopify by style name (NOOS and re-stock styles).
                                    Also answers { liknande } with the closest product of the same model when nothing matches for certain.
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
// Tolerant comparison: plural endings, and a few spellings that differ between PLM and the shop (Selvage/Selvedge, pkt/Pocket).
const ALIAS = { selvage: "selvedge", pkt: "pocket", pkts: "pocket" };
const canon = (w) => { w = ALIAS[w] || w; return w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w; };
const cwords = (s) => words(s).map(canon);
// Picks a product only when the match is unambiguous: the title before " in <colour>" equals the style name,
// or every product that contains the name shares one and the same base title. Otherwise nothing is returned.
function pickProduct(name, colours, products) {
  const want = cwords(name); if (!want.length) return null;
  const cands = products.filter((p) => p.image && want.every((w) => cwords(p.title).includes(w)));
  if (!cands.length) return null;
  const key = (p) => cwords(baseTitle(p.title)).join(" ");
  const exact = cands.filter((p) => key(p) === want.join(" "));
  let pool = exact;
  if (!pool.length) { const bases = [...new Set(cands.map(key))]; if (bases.length !== 1) return null; pool = cands; }
  const cols = (colours || []).map((c) => cwords(c).join(" ")).filter(Boolean);
  const score = (p) => (p.status === "ACTIVE" ? 2 : 0) + (cols.some((c) => cwords(p.title).join(" ").endsWith(c)) ? 1 : 0);
  return Object.assign({}, pool.slice().sort((a, b) => score(b) - score(a))[0], { exact: exact.length > 0 });
}
// One product per colour: the title must contain the style name and the colour. If several products fit, the one with the
// fewest other words wins; a tie between different products is ambiguous and that colour is left out.
const FILL = new Set(["in", "nr", "no", "the"]);
function pickPerColour(name, colours, products) {
  const want = cwords(name); if (!want.length) return [];
  const base = products.filter((p) => p.image && want.every((w) => cwords(p.title).includes(w)));
  const out = [];
  for (const c of colours || []) {
    const cw = cwords(c); if (!cw.length) continue;
    const scored = base.filter((p) => cw.every((w) => cwords(p.title).includes(w))).map((p) => ({ p, extra: cwords(p.title).filter((w) => !want.includes(w) && !cw.includes(w) && !FILL.has(w)).sort().join(" ") }));
    if (!scored.length) continue;
    const min = Math.min(...scored.map((x) => x.extra ? x.extra.split(" ").length : 0));
    const best = scored.filter((x) => (x.extra ? x.extra.split(" ").length : 0) === min);
    if (new Set(best.map((x) => x.extra)).size !== 1) continue;
    const hit = best.sort((a, b) => (b.p.status === "ACTIVE") - (a.p.status === "ACTIVE"))[0].p;
    if (!out.some((o) => o.url === hit.image)) out.push({ farg: c, url: hit.image, titel: hit.title, handle: hit.handle, grupp: hit.group || "", exakt: best[0].extra === "" });
  }
  // A colour that is called something else in the shop (Indigo here, "Dark Blue Rinse" there): if exactly one colour is
  // left without a match and exactly one active product in the same style group is unused, they belong together.
  const left = (colours || []).filter((c) => cwords(c).length && !out.some((o) => o.farg === c));
  const groups = [...new Set(out.map((o) => o.grupp).filter(Boolean))];
  if (left.length === 1 && groups.length === 1 && out.length) {
    const spare = products.filter((p) => p.group === groups[0] && p.status === "ACTIVE" && p.image && !out.some((o) => o.url === p.image));
    if (spare.length === 1) out.push({ farg: left[0], url: spare[0].image, titel: spare[0].title, handle: spare[0].handle, grupp: groups[0], exakt: false });
  }
  // Same order as the colours on the style, so the first colour becomes the main image.
  return out.sort((a, b) => (colours || []).indexOf(a.farg) - (colours || []).indexOf(b.farg));
}
// No certain match: the closest product of the same model, to be shown as "similar product" (never copied in as the style's own image).
// 1. every word of the style name is in the title, but several products fit (Sailing Trouser / RYC Sailing Trousers White, Navy)
// 2. the shop's model name is contained in the style name (Pilot Chino in "Pilot Chino Chambray")
// 3. the names start with the same two words or more (French Pocket ...): the model with the fewest other words
function pickSimilar(name, colours, products) {
  const want = cwords(name); if (want.length < 2) return null;
  const withImg = products.filter((p) => p.image);
  const model = (p) => cwords(baseTitle(p.title));
  const cols = (colours || []).map((c) => cwords(c).join(" ")).filter(Boolean);
  const rank = (p) => (p.status === "ACTIVE" ? 2 : 0) + (cols.some((c) => cwords(p.title).join(" ").endsWith(c)) ? 1 : 0);
  const best = (pool) => pool.slice().sort((x, y) => rank(y) - rank(x))[0] || null;
  const a = withImg.filter((p) => want.every((w) => cwords(p.title).includes(w)));
  if (a.length) return best(a);
  const b = withImg.filter((p) => { const m = model(p); return m.length >= 2 && m.every((w) => want.includes(w)); });
  if (b.length) { const len = Math.max(...b.map((p) => model(p).length)); return best(b.filter((p) => model(p).length === len)); }
  const lead = (p) => { const m = model(p); let i = 0; while (i < m.length && i < want.length && m[i] === want[i]) i++; return i; };
  const c = withImg.filter((p) => lead(p) >= 2);
  if (!c.length) return null;
  const top = Math.max(...c.map(lead)); const c2 = c.filter((p) => lead(p) === top);
  const extra = Math.min(...c2.map((p) => model(p).length - top));
  return best(c2.filter((p) => model(p).length - top === extra));
}
// The shop is searched with the first letters of each word, so that plural and spelling variants are found; the exact comparison is done here.
const queryOf = (ws) => ws.filter((w) => w.length > 1).map((w) => "title:" + (w.length > 4 ? w.slice(0, 4) : w) + "*").join(" ");
async function fetchProducts(q) {
  if (!q) return [];
  const token = await shopifyToken();
  const res = await fetch(`https://${env("SHOPIFY_STORE")}/admin/api/${API}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: "query($q:String!){ products(first:100, query:$q){ nodes{ title handle status featuredMedia{ preview{ image{ url } } } grupp: metafield(namespace:\"custom\", key:\"style_group\"){ value } } } }", variables: { q } }) });
  const body = await res.json();
  if (body.errors) throw new Error("Shopify: " + JSON.stringify(body.errors).slice(0, 200));
  return ((body.data && body.data.products && body.data.products.nodes) || []).map((n) => ({ title: n.title, handle: n.handle, status: n.status, group: n.grupp ? n.grupp.value : "", image: n.featuredMedia && n.featuredMedia.preview && n.featuredMedia.preview.image ? n.featuredMedia.preview.image.url : null }));
}
async function searchProduct(name, colours) {
  const ws = words(name).map((w) => ALIAS[w] || w);
  const products = await fetchProducts(queryOf(ws));
  const hit = pickProduct(name, colours, products);
  const perFarg = pickPerColour(name, colours, products);
  let liknande = null;
  if (!(hit && hit.exact) && !perFarg.some((x) => x.exakt)) {
    let pool = products;
    if (ws.length > 2) { const more = await fetchProducts(queryOf(ws.slice(0, 2))); pool = products.concat(more.filter((p) => !products.some((x) => x.handle === p.handle))); }
    const sim = pickSimilar(name, colours, pool);
    if (sim) liknande = { url: sim.image, titel: sim.title, handle: sim.handle };
  }
  return { hit: hit ? { url: hit.image, titel: hit.title, handle: hit.handle, exakt: !!hit.exact } : null, perFarg, liknande };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    if (!(await verifyUser(req))) return res.status(401).json({ error: "Not signed in" });
    // { sok, farger }: finds the product image for a style by name. Answers { hit: null } when nothing matches for certain.
    if (req.body && req.body.sok) { const found = await searchProduct(String(req.body.sok).slice(0, 120), Array.isArray(req.body.farger) ? req.body.farger.slice(0, 20) : []); return res.status(200).json(found); }
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
module.exports.pickPerColour = pickPerColour;
module.exports.pickSimilar = pickSimilar;
module.exports.queryOf = queryOf;
