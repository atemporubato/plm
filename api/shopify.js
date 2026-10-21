/* Shopify-push: skapar eller uppdaterar en produkt (en per färg) i Shopify från en style i PLM.
   Körs som serverless-funktion på Vercel så att Shopify-nyckeln aldrig når webbläsaren.
   POST /api/shopify  { action: "preview" | "create", style_id, farg }
   Authorization: Bearer <Supabase access token>  (bara atemporubato.com-konton släpps in) */

const API = "2025-07";
const env = (k) => { const v = process.env[k]; if (!v) throw new Error("Saknar miljövariabel " + k); return v; };

/* ---------- Supabase (service key, efter att användaren verifierats) ---------- */
async function sb(path, opts = {}) {
  const { headers: extra, ...rest } = opts;
  const res = await fetch(env("SUPABASE_URL") + "/rest/v1/" + path, Object.assign({ headers: Object.assign({ apikey: env("SUPABASE_SECRET_KEY"), Authorization: "Bearer " + env("SUPABASE_SECRET_KEY"), "Content-Type": "application/json", Prefer: "return=representation" }, extra || {}) }, rest));
  const text = await res.text();
  if (!res.ok) throw new Error("Supabase " + res.status + ": " + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}
async function verifyUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(env("SUPABASE_URL") + "/auth/v1/user", { headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), Authorization: "Bearer " + token } });
  if (!res.ok) return null;
  const u = await res.json();
  if (!u || !/@atemporubato\.com$/i.test(u.email || "")) return null;
  return u;
}

/* ---------- Shopify Admin (client credentials, samma som rubato-horizon) ---------- */
let tokenCache = null;
async function shopifyToken() {
  if (tokenCache && tokenCache.exp > Date.now()) return tokenCache.token;
  const res = await fetch(`https://${env("SHOPIFY_STORE")}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "client_credentials", client_id: env("SHOPIFY_CLIENT_ID"), client_secret: env("SHOPIFY_CLIENT_SECRET") }) });
  const body = await res.json();
  if (!body.access_token) throw new Error("Shopify-inloggningen misslyckades: " + JSON.stringify(body).slice(0, 200));
  tokenCache = { token: body.access_token, exp: Date.now() + 20 * 60 * 1000 };
  return body.access_token;
}
async function admin(query, variables = {}) {
  const token = await shopifyToken();
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://${env("SHOPIFY_STORE")}/admin/api/${API}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query, variables }) });
    const body = await res.json();
    if (body.errors && body.errors.some((e) => e.extensions && e.extensions.code === "THROTTLED") && attempt < 4) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
    if (body.errors) throw new Error("Shopify: " + JSON.stringify(body.errors).slice(0, 400));
    return body.data;
  }
}
const gidNum = (gid) => Number(String(gid).split("/").pop());

/* ---------- hjälpare ---------- */
const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const LAND = { IT: "Italy", JP: "Japan", GB: "Scotland", ES: "Spain", PT: "Portugal", US: "USA", SE: "Sweden", FR: "France", DE: "Germany" };
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const firstSentence = (s) => { const m = /^(.*?[.!?])(\s|$)/.exec(String(s || "").trim()); return m ? m[1] : String(s || "").trim(); };

async function metaobjectId(type, handle) {
  if (!handle) return null;
  const d = await admin(`query($t:String!,$h:String!){ metaobjectByHandle(handle:{type:$t, handle:$h}){ id } }`, { t: type, h: handle });
  return d.metaobjectByHandle ? d.metaobjectByHandle.id : null;
}

/* Bygger produktpayloaden och listan med fel och varningar. */
async function build(style_id, farg) {
  const [docs, shRows, fargRader, settings] = await Promise.all([
    sb(`dokument?collection=eq.styles&id=eq.${encodeURIComponent(style_id)}&select=data`),
    sb(`shopify_styles?style_id=eq.${encodeURIComponent(style_id)}&select=*`),
    sb(`style_farger?style_id=eq.${encodeURIComponent(style_id)}&select=*&order=fargindex,id`),
    sb(`installningar?nyckel=in.(storlekskoder,shopify,stylekod_nasta)&select=nyckel,varde`),
  ]);
  const doc = docs[0] && docs[0].data;
  if (!doc) throw new Error("Hittar inte stylen " + style_id);
  // st = artefaktens styledokument plus de hostade Shopify-fälten
  const st = Object.assign({ id: style_id }, doc, shRows[0] || {});
  const cfg = Object.fromEntries(settings.map((s) => [s.nyckel, s.varde]));
  const levDocs = st.leverantor ? await sb(`dokument?collection=eq.leverantorer&select=id,data`) : [];
  const levRow = levDocs.find((l) => String(l.data.namn || "").toLowerCase() === String(st.leverantor).toLowerCase());
  const lev = levRow ? Object.assign({ id: levRow.id }, levRow.data) : null;
  const fr = fargRader.find((r) => r.farg.toLowerCase() === String(farg).toLowerCase()) || { farg, fargindex: null };
  const vars = (st.ean || []).filter((v) => String(v.farg).toLowerCase() === String(farg).toLowerCase());
  const errors = [], warnings = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  const warn = (cond, msg) => { if (!cond) warnings.push(msg); };

  need(st.namn, "Stylen saknar namn.");
  need((st.farger || []).includes(fr.farg), `Färgen "${farg}" finns inte på stylen.`);
  need((st.storlekar || []).length, "Stylen saknar storlekar.");
  need(vars.length === (st.storlekar || []).length && vars.every((v) => v.ean), "Alla varianter i färgen behöver ett EAN (tilldela EAN på stylen först).");
  need(st.produkttyp && cfg.shopify && cfg.shopify.produkttyper[st.produkttyp], "Produkttyp saknas.");
  need(st.rrp_sek > 0, "Pris (RRP i SEK) saknas.");
  need(st.hs_kod, "HS-kod saknas.");
  need(lev, "Leverantören finns inte i leverantörsregistret.");
  need(lev && lev.land, "Leverantören saknar land (ISO-kod), det styr ursprungsland.");
  need(st.description_en, "Beskrivning (engelska) saknas.");
  need(st.sammansattning, "Material (sammansättning) saknas.");
  need(st.tvattrad, "Skötselråd saknas.");
  const sys = st.storlekssystem && cfg.storlekskoder ? cfg.storlekskoder[st.storlekssystem] : null;
  need(sys, "Storlekssystem för SKU saknas.");
  if (sys) for (const s of st.storlekar || []) need(sys[s] != null, `Storleken "${s}" finns inte i storlekssystemet ${st.storlekssystem}.`);
  warn(st.size_chart, "Ingen storlekstabell vald (custom.size_chart).");
  warn(fr.swatch, "Ingen swatch-färg (hex) för färgen.");
  warn(fr.colour_family, "Ingen färgfamilj vald, färgfiltret på sajten missar produkten.");
  warn(st.fit_note, "Ingen fit note.");
  warn(st.cut, "Ingen cut angiven.");
  warn(lev && lev.mid_code, "Leverantören saknar MID (tullkod för USA).");
  warn(st.vikt_gram, "Ingen vikt angiven, standardvikt för produkttypen används.");
  warn(st.material_family, "Ingen material family (materialfiltret på sajten).");

  const typ = cfg.shopify && st.produkttyp ? cfg.shopify.produkttyper[st.produkttyp] : null;
  const stylekod = st.stylekod || String(cfg.stylekod_nasta || 1079);
  const existingIdx = fargRader.filter((r) => r.fargindex).map((r) => r.fargindex);
  const fargindex = fr.fargindex || (existingIdx.length ? Math.max(...existingIdx) + 1 : 1);
  const title = fr.titel || `${st.namn} in ${fr.farg}`;
  const madeIn = lev && lev.land ? (LAND[lev.land] || lev.land) : "";
  const weightKg = st.vikt_gram ? st.vikt_gram / 1000 : (cfg.shopify && cfg.shopify.standardvikt_kg[st.produkttyp]) || 0.5;
  const seoDesc = `${title}. ${firstSentence(st.description_en)}${madeIn ? " Made in " + madeIn + "." : ""}`;
  const tags = new Set();
  if (st.sasong) tags.add(st.sasong);
  if (st.sasong && st.drop) tags.add(st.sasong + st.drop.replace(/\s+/g, "").toUpperCase());
  tags.add("latest");
  if (st.typ === "NOOS") tags.add("NOOS");
  for (const t of (typ && typ.taggar) || []) tags.add(t);
  if (st.material_family) tags.add(st.material_family);

  const [sizeChartId, colourFamilyId] = await Promise.all([metaobjectId("size_chart", st.size_chart), metaobjectId("colour_family", fr.colour_family)]);
  if (st.size_chart && !sizeChartId) errors.push(`Storlekstabellen "${st.size_chart}" finns inte i Shopify.`);
  if (fr.colour_family && !colourFamilyId) errors.push(`Färgfamiljen "${fr.colour_family}" finns inte i Shopify.`);

  const mf = [];
  const add = (ns, key, type, value) => { if (value != null && value !== "") mf.push({ namespace: ns, key, type, value: String(value) }); };
  add("custom", "material", "single_line_text_field", st.sammansattning);
  add("custom", "color", "single_line_text_field", fr.farg);
  add("custom", "made_in", "single_line_text_field", madeIn);
  add("custom", "cut", "single_line_text_field", st.cut);
  add("custom", "care", "single_line_text_field", st.tvattrad);
  add("custom", "features", "single_line_text_field", st.features);
  add("custom", "fit_note", "single_line_text_field", st.fit_note);
  add("custom", "model_note", "single_line_text_field", st.model_note);
  add("custom", "fabric_mill", "single_line_text_field", st.fabric_mill);
  add("custom", "fabric_weight", "single_line_text_field", st.fabric_weight);
  add("custom", "fabric_origin", "single_line_text_field", st.fabric_origin);
  add("custom", "construction", "single_line_text_field", st.construction);
  add("custom", "material_family", "single_line_text_field", st.material_family);
  add("custom", "style_group", "single_line_text_field", slug(st.namn));
  add("custom", "swatch", "color", fr.swatch);
  if (colourFamilyId) { add("custom", "colour_family_ref", "metaobject_reference", colourFamilyId); add("custom", "colour_family_name", "single_line_text_field", fr.colour_family.charAt(0).toUpperCase() + fr.colour_family.slice(1)); add("custom", "colour_family", "single_line_text_field", fr.colour_family.charAt(0).toUpperCase() + fr.colour_family.slice(1)); }
  if (sizeChartId) add("custom", "size_chart", "metaobject_reference", sizeChartId);
  if (lev && lev.mid_code) { add("custom", "mid_code", "list.single_line_text_field", JSON.stringify([lev.mid_code])); add("custom", "mid_name", "list.single_line_text_field", JSON.stringify([lev.mid_name])); add("custom", "mid_address", "list.single_line_text_field", JSON.stringify([lev.mid_address])); }
  add("global", "title_tag", "single_line_text_field", `${title} | Rubato`);
  add("global", "description_tag", "single_line_text_field", seoDesc);

  const variants = (st.storlekar || []).map((size) => {
    const v = vars.find((x) => x.storlek === size) || {};
    return { optionValues: [{ optionName: "Size", name: size }], sku: `${stylekod}-${String(fargindex).padStart(3, "0")}-${sys ? sys[size] : "??"}`, barcode: v.ean || null, price: st.rrp_sek, taxable: true,
      inventoryItem: { tracked: true, requiresShipping: true, harmonizedSystemCode: st.hs_kod, countryCodeOfOrigin: lev ? lev.land : null, measurement: { weight: { value: weightKg, unit: "KILOGRAMS" } } } };
  });

  const input = {
    title, descriptionHtml: `<p>${esc(st.description_en)}</p>`, vendor: (cfg.shopify && cfg.shopify.vendor) || "Rubato", productType: st.produkttyp || null, status: "DRAFT",
    tags: [...tags], category: typ ? typ.kategori : null, seo: { title: `${title} | Rubato`, description: seoDesc },
    productOptions: [{ name: "Size", values: (st.storlekar || []).map((s) => ({ name: s })) }], variants, metafields: mf,
  };
  if (fr.shopify_product_id) input.id = "gid://shopify/Product/" + fr.shopify_product_id;
  return { st, fr, lev, cfg, stylekod, fargindex, input, errors, warnings, vars };
}

async function create(ctx, user) {
  const { st, fr, input, stylekod, fargindex } = ctx;
  const d = await admin(`mutation($input: ProductSetInput!) { productSet(synchronous: true, input: $input) { product { id handle status variants(first: 50) { edges { node { id sku } } } } userErrors { field message } } }`, { input });
  const r = d.productSet;
  if (r.userErrors && r.userErrors.length) throw new Error("Shopify avvisade produkten: " + r.userErrors.map((e) => (e.field ? e.field.join(".") + ": " : "") + e.message).join(" | "));
  const p = r.product;
  const pid = gidNum(p.id);
  // Spara kopplingarna
  if (!st.stylekod) { await sb(`shopify_styles?on_conflict=style_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ style_id: st.id, stylekod }) }); await sb(`installningar?on_conflict=nyckel`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ nyckel: "stylekod_nasta", varde: Number(stylekod) + 1 }) }); }
  const varianter = {};
  for (const e of p.variants.edges) { const v = input.variants.find((x) => x.sku === e.node.sku); if (v) varianter[v.optionValues[0].name] = { sku: e.node.sku, variant_id: gidNum(e.node.id), ean: v.barcode }; }
  const row = { style_id: st.id, farg: fr.farg, fargindex, swatch: fr.swatch || null, colour_family: fr.colour_family || null, titel: fr.titel || null, shopify_product_id: pid, shopify_handle: p.handle, shopify_status: p.status, pushad: new Date().toISOString(), pushad_av: user.id, varianter };
  await sb(`style_farger?on_conflict=style_id,farg`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(row) });
  // Händelse på stylen och e-com-checken "I Shopify" i artefaktens dokument
  const cur = (await sb(`dokument?collection=eq.styles&id=eq.${encodeURIComponent(st.id)}&select=data`))[0].data;
  const logg = (cur.logg || []).concat([{ t: new Date().toISOString(), av: user.id, text: `${input.id ? "Uppdaterad" : "Skapad"} i Shopify som utkast: ${input.title} (${p.handle})` }]);
  await sb(`dokument?collection=eq.styles&id=eq.${encodeURIComponent(st.id)}`, { method: "PATCH", body: JSON.stringify({ data: Object.assign({}, cur, { logg, ecomShopify: true, andrad: new Date().toISOString() }) }) });
  // Färgsyskon: alla produkter i stylen pekar på varandra
  const siblings = await sb(`style_farger?style_id=eq.${encodeURIComponent(st.id)}&shopify_product_id=not.is.null&select=shopify_product_id,titel,farg&order=titel,farg`);
  if (siblings.length > 1) {
    const ids = siblings.map((s) => "gid://shopify/Product/" + s.shopify_product_id);
    for (const s of siblings) {
      const others = ids.filter((g) => g !== "gid://shopify/Product/" + s.shopify_product_id);
      await admin(`mutation($mf: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $mf) { userErrors { message } } }`, { mf: [
        { ownerId: "gid://shopify/Product/" + s.shopify_product_id, namespace: "custom", key: "colour_siblings", type: "list.product_reference", value: JSON.stringify(others) },
        { ownerId: "gid://shopify/Product/" + s.shopify_product_id, namespace: "custom", key: "other_colors", type: "list.product_reference", value: JSON.stringify(others) },
      ] });
    }
  }
  return { product_id: pid, handle: p.handle, status: p.status, admin_url: `https://admin.shopify.com/store/${env("SHOPIFY_STORE").replace(".myshopify.com", "")}/products/${pid}` };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST" });
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: "Du måste vara inloggad med ett Rubato-konto." });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { action, style_id, farg } = body;
    if (!style_id || !farg) return res.status(400).json({ error: "style_id och farg krävs." });
    const ctx = await build(style_id, farg);
    const preview = { title: ctx.input.title, sku: ctx.input.variants.map((v) => v.sku), tags: ctx.input.tags, variants: ctx.input.variants.map((v) => ({ size: v.optionValues[0].name, sku: v.sku, ean: v.barcode, price: v.price })), metafields: ctx.input.metafields.map((m) => m.key + ": " + (m.value.length > 60 ? m.value.slice(0, 60) + "…" : m.value)), update: !!ctx.input.id, errors: ctx.errors, warnings: ctx.warnings };
    if (action === "preview") return res.status(200).json(preview);
    if (action === "create") {
      if (ctx.errors.length) return res.status(422).json(Object.assign({ error: "Rätta felen först." }, preview));
      const result = await create(ctx, user);
      return res.status(200).json(Object.assign(preview, result));
    }
    return res.status(400).json({ error: "Okänd action." });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
