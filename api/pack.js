/* Packaging: the orders PLM counts packaging against (one e-com bag per order, one box per tailoring/outerwear garment).
   PLM calls this when the Stock tab has loaded and from the button "Update packaging". This endpoint only reads from
   Shopify and never writes anywhere – PLM does the counting and updates the stock lots itself.
   GET /api/pack?since=<ISO time>   (Authorization: Bearer <Supabase session token>)
   Answers { till, ordrar: [{ order, tid, typer: { "<product type>": units } }] } – orders created after `since`,
   oldest first. Cancelled and test orders are left out, and so are lines that are not shipped (gift cards etc). */

const API = "2025-07";
const MAX_DAYS = 200;
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
async function admin(query, variables = {}) {
  const token = await shopifyToken();
  const res = await fetch(`https://${env("SHOPIFY_STORE")}/admin/api/${API}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query, variables }) });
  const body = await res.json();
  if (body.errors) throw new Error("Shopify: " + JSON.stringify(body.errors).slice(0, 300));
  return body.data;
}
const Q = `query($q: String!, $after: String) { orders(first: 50, after: $after, query: $q, sortKey: CREATED_AT) { nodes { name createdAt cancelledAt test
  lineItems(first: 30) { nodes { quantity requiresShipping product { productType } } } } pageInfo { hasNextPage endCursor } } }`;

// One order -> { order, tid, typer } or null when it does not use any packaging.
function toOrder(o) {
  if (!o || o.cancelledAt || o.test) return null;
  const typer = {};
  for (const li of ((o.lineItems || {}).nodes || [])) {
    if (li.requiresShipping === false || !(li.quantity > 0)) continue;
    const t = (li.product && li.product.productType) || "";
    typer[t] = (typer[t] || 0) + li.quantity;
  }
  return Object.keys(typer).length ? { order: o.name, tid: o.createdAt, typer } : null;
}
// `since` must be a real time; it is clamped so that a bad value can never make this read years of orders.
function sinceParam(v, now = Date.now()) {
  const t = Date.parse(String(v || ""));
  if (!t) return null;
  return new Date(Math.min(now, Math.max(t, now - MAX_DAYS * 864e5))).toISOString().replace(/\.\d{3}Z$/, "Z");
}

module.exports = async (req, res) => {
  try {
    if (!(await verifyUser(req))) return res.status(401).json({ error: "Not signed in" });
    const since = sinceParam(req.query && req.query.since);
    if (!since) return res.status(400).json({ error: "since is missing", ordrar: [] });
    const till = new Date().toISOString();
    const ordrar = []; let after = null;
    for (let page = 0; page < 60; page++) {
      const d = await admin(Q, { q: "created_at:>='" + since + "'", after });
      for (const o of d.orders.nodes) { const r = toOrder(o); if (r && Date.parse(r.tid) > Date.parse(since)) ordrar.push(r); }
      if (!d.orders.pageInfo.hasNextPage) break; after = d.orders.pageInfo.endCursor;
    }
    return res.status(200).json({ till, ordrar });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: e.message, ordrar: [] });
  }
};
module.exports.toOrder = toOrder;
module.exports.sinceParam = sinceParam;
