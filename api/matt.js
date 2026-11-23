/* Size charts from the shop, so any product that has ever had one – also archived and draft products – can be used
   as a measurement reference in PLM.
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
