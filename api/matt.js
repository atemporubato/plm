/* Size charts from the shop, so any product that has ever had one – also archived and draft products – can be used
   as a measurement reference in PLM. Two sources: size_chart metaobjects, and for older products the table in the description.
   GET /api/matt   (Authorization: Bearer <Supabase session token>)
   Answers { tabeller: [{ handle, namn, typ, kolumner: [..], rader: [[size, v1, v2 …], …] }] }, sorted by name. */

const API = "2025-07";
const env = (k) => { const v = process.env[k]; if (!v) throw new Error("Missing environment variable " + k); return v; };

async function verifyUser(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(env("SUPABASE_URL") + "/auth/v1/user", { headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), Authorization: "Bearer " + token } });
  if (!res.ok) return null;
  const u = await res.json();
  return u && /@atemporubato\.com$/i.test(u.email || "") ? u : null;
}
let tokenCache = null;
async function shopifyToken() {
  if (tokenCache && tokenCache.exp > Date.now()) return tokenCache.token;
  const res = await fetch(`https://${env("SHOPIFY_STORE")}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "client_credentials", client_id: env("SHOPIFY_CLIENT_ID"), client_secret: env("SHOPIFY_CLIENT_SECRET") }) });
  const body = await res.json();
  if (!body.access_token) throw new Error("Shopify sign-in failed");
  tokenCache = { token: body.access_token, exp: Date.now() + 20 * 60 * 1000 };
  return body.access_token;
}
const list = (v) => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a.map(String) : []; } catch (e) { return []; } };
function toChart(node) {
  const f = Object.fromEntries((node.fields || []).map((x) => [x.key, x.value]));
  const rader = list(f.rows).map((r) => r.split(",").map((x) => x.trim())).filter((r) => r.length > 1);
  if (!rader.length) return null;
  return { handle: node.handle, namn: f.page_name || node.handle, typ: f.product_type || "", kolumner: list(f.column_headers), rader };
}
// Older products carry their measurements as an HTML table in the description, in one of two layouts:
// sizes down the side ("Sizing | Length | Shoulder …") or sizes across the top ("Size | XS | S | M …").
const cell = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().replace(/\s*cm$/i, "");
const isSize = (s) => /^(xxs|xs|s|m|l|xl|xxl|xxxl|one size|\d{2}(\.5)?|\d{1,2}\s?1\/2)$/i.test(String(s).trim());
function tableFromHtml(html) {
  const m = /<table[\s\S]*?<\/table>/i.exec(String(html || "")); if (!m) return null;
  let rows = (m[0].match(/<tr[\s\S]*?<\/tr>/gi) || []).map((r) => (r.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(cell));
  rows = rows.filter((r) => r.slice(1).some(Boolean));
  if (rows.length < 2) return null;
  const width = Math.max(...rows.map((r) => r.length));
  const keep = []; for (let i = 0; i < width; i++) if (rows.some((r) => r[i])) keep.push(i);
  rows = rows.map((r) => keep.map((i) => r[i] || ""));
  let head = rows[0], body = rows.slice(1);
  if (head.slice(1).filter(Boolean).every(isSize) && !body.every((r) => isSize(r[0]))) {
    // sizes across the top: turn the table so that each row is a size
    const sizes = head.slice(1);
    const measures = body.map((r) => r[0]);
    body = sizes.map((sz, i) => [sz].concat(rows.slice(1).map((r) => r[i + 1] || "")));
    head = [head[0]].concat(measures);
  }
  body = body.filter((r) => r[0] && r.slice(1).some(Boolean));
  return body.length ? { kolumner: head.slice(1), rader: body } : null;
}
const baseTitle = (title) => String(title || "").split(/\s+in\s+/i)[0].trim();

let cache = null;
async function charts() {
  if (cache && cache.exp > Date.now()) return cache.data;
  const token = await shopifyToken();
  const out = []; let after = null;
  for (let page = 0; page < 10; page++) {
    const res = await fetch(`https://${env("SHOPIFY_STORE")}/admin/api/${API}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: "query($a:String){ metaobjects(type:\"size_chart\", first:100, after:$a){ nodes{ handle fields{ key value } } pageInfo{ hasNextPage endCursor } } }", variables: { a: after } }) });
    const body = await res.json();
    if (body.errors) throw new Error("Shopify: " + JSON.stringify(body.errors).slice(0, 200));
    const m = body.data.metaobjects;
    for (const n of m.nodes) { const c = toChart(n); if (c) out.push(c); }
    if (!m.pageInfo.hasNextPage) break;
    after = m.pageInfo.endCursor;
  }
  // Products without a size-chart object: read the table in the description. One entry per product name (colours share it).
  const have = new Set(out.map((x) => x.namn.toLowerCase()));
  after = null;
  for (let page = 0; page < 12; page++) {
    const res = await fetch(`https://${env("SHOPIFY_STORE")}/admin/api/${API}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: "query($a:String){ products(first:100, after:$a){ nodes{ title handle productType descriptionHtml } pageInfo{ hasNextPage endCursor } } }", variables: { a: after } }) });
    const body = await res.json();
    if (body.errors) throw new Error("Shopify: " + JSON.stringify(body.errors).slice(0, 200));
    const pr = body.data.products;
    for (const n of pr.nodes) {
      const namn = baseTitle(n.title); if (!namn || have.has(namn.toLowerCase())) continue;
      const tb = tableFromHtml(n.descriptionHtml); if (!tb) continue;
      have.add(namn.toLowerCase());
      out.push({ handle: n.handle, namn, typ: n.productType || "", kolumner: tb.kolumner, rader: tb.rader, kalla: "beskrivning" });
    }
    if (!pr.pageInfo.hasNextPage) break;
    after = pr.pageInfo.endCursor;
  }
  out.sort((a, b) => a.namn.localeCompare(b.namn));
  cache = { data: out, exp: Date.now() + 10 * 60 * 1000 };
  return out;
}

module.exports = async (req, res) => {
  try {
    if (!(await verifyUser(req))) return res.status(401).json({ error: "Not signed in" });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ tabeller: await charts() });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e).slice(0, 200) });
  }
};
module.exports.toChart = toChart;
module.exports.tableFromHtml = tableFromHtml;
