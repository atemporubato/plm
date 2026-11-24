/* Reference garments from Shopify: every order tagged "reference" (or "#reference") becomes reference garments in PLM,
   one per order line. PLM calls this from the button "Fetch from Shopify" in the Ref garments tab and creates the
   records itself – this endpoint only reads from Shopify and never writes anywhere.
   GET /api/ref   (Authorization: Bearer <Supabase session token>)
   Answers { rader: [{ key, order, datum, produkt, plagg, antal, till, skickad, fraktbolag, tracking, trackingUrl, varde, valuta, note }] } */

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
async function admin(query, variables = {}) {
  const token = await shopifyToken();
  const res = await fetch(`https://${env("SHOPIFY_STORE")}/admin/api/${API}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query, variables }) });
  const body = await res.json();
  if (body.errors) throw new Error("Shopify: " + JSON.stringify(body.errors).slice(0, 300));
  return body.data;
}
const Q = `query($q: String!, $after: String) { orders(first: 50, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) { nodes { id name createdAt note
  shippingAddress { name company city country }
  lineItems(first: 50) { nodes { id title variantTitle quantity originalUnitPriceSet { shopMoney { amount currencyCode } } } }
  fulfillments(first: 5) { createdAt trackingInfo(first: 3) { number company url } } } pageInfo { hasNextPage endCursor } } }`;

function toRows(o) {
  const a = o.shippingAddress || {};
  const till = [a.company, a.name].filter(Boolean).join(" – ") + ([a.city, a.country].filter(Boolean).length ? " (" + [a.city, a.country].filter(Boolean).join(", ") + ")" : "");
  const f = (o.fulfillments || []).find((x) => (x.trackingInfo || []).length) || (o.fulfillments || [])[0] || null;
  const t = f && (f.trackingInfo || [])[0] ? f.trackingInfo[0] : {};
  return ((o.lineItems || {}).nodes || []).map((li) => {
    const variant = li.variantTitle && li.variantTitle !== "Default Title" ? li.variantTitle : "";
    const m = (li.originalUnitPriceSet || {}).shopMoney || {};
    return { key: String(li.id).split("/").pop(), order: o.name, datum: String(o.createdAt || "").slice(0, 10), produkt: li.title || "",
      plagg: (li.title || "") + (variant ? ", " + variant : "") + (li.quantity > 1 ? " ×" + li.quantity : ""), antal: li.quantity || 1,
      till: till.trim(), skickad: f ? String(f.createdAt || "").slice(0, 10) : "", fraktbolag: t.company || "", tracking: t.number || "", trackingUrl: t.url || "",
      varde: m.amount != null ? Math.round(Number(m.amount) * (li.quantity || 1)) : null, valuta: m.currencyCode || "", note: String(o.note || "").slice(0, 500) };
  });
}

module.exports = async (req, res) => {
  try {
    if (!(await verifyUser(req))) return res.status(401).json({ error: "Not signed in" });
    const rader = []; let after = null;
    for (let page = 0; page < 6; page++) {
      const d = await admin(Q, { q: "tag:reference OR tag:'#reference'", after });
      for (const o of d.orders.nodes) rader.push(...toRows(o));
      if (!d.orders.pageInfo.hasNextPage) break; after = d.orders.pageInfo.endCursor;
    }
    return res.status(200).json({ rader });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: e.message, rader: [] });
  }
};
module.exports.toRows = toRows;
