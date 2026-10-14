/* Datalager för Rubato PLM.
   Exponerar samma lilla API som appen skrevs mot i artefakt-versionen (db.collection().doc().update(),
   onSnapshot(), db.doc("ean/pool") osv) men pratar med Supabase. Så kan Elliots vyer och formulär
   leva vidare oförändrade medan datan ligger i Postgres. */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/* Kolumnnamn i databasen är snake_case, appen använder camelCase. Här är avvikelserna per tabell;
   allt som inte står här heter likadant. */
const MAP = {
  samples: { styleId: "style_id", tygId: "tyg_id", prisBelopp: "pris_belopp", prisValuta: "pris_valuta", p1Skickad: "p1_skickad", p2Skickad: "p2_skickad", platsTyp: "plats_typ", platsNotering: "plats_notering" },
  styles: { klartSenast: "klart_senast", fotoSenast: "foto_senast" },
  tyger: { aterDatum: "ater_datum" },
  tyglager: { tygId: "tyg_id", tygNamn: "tyg_namn", inkoptMeter: "inkopt_meter", prisPerMeter: "pris_per_meter", prisValuta: "pris_valuta", reserveradFor: "reserverad_for", bredd: "bredd_cm" },
  leverantorer: { sampleLedtid: "sample_ledtid" },
  po: {},
};
const TABLES = Object.keys(MAP);
const SKIP = new Set(["id", "_id", "andrad", "skapad", "logg", "ean", "rader", "farg_rader"]);
const toRow = (coll, obj) => {
  const m = MAP[coll] || {}, out = {};
  for (const [k, v] of Object.entries(obj)) { if (SKIP.has(k)) continue; out[m[k] || k] = v === "" ? null : v; }  // tom sträng blir null, så att check-villkor och datumkolumner håller
  return out;
};
const toDoc = (coll, row) => {
  const inv = Object.fromEntries(Object.entries(MAP[coll] || {}).map(([a, b]) => [b, a]));
  const out = {};
  for (const [k, v] of Object.entries(row)) { if (k === "skapad") continue; out[inv[k] || k] = v; }
  return out;
};

/* Cache: senast lästa rader per tabell, som appens dokument. */
const cache = { samples: new Map(), styles: new Map(), tyger: new Map(), tyglager: new Map(), leverantorer: new Map(), po: new Map() };
let pool = null, settings = null, eanLogg = [];
const listeners = [];  // { key, fn }
const fail = (e) => { const err = new Error(e.message || "db"); err.code = e.code === "42501" ? "invalid_argument" : e.code; throw err; };

async function fetchAll() {
  const [rows, logg, vars, p, s, rader, farger] = await Promise.all([
    Promise.all(TABLES.map((t) => supabase.from(t).select("*").order("id"))),
    supabase.from("logg").select("*").order("t"),
    supabase.from("varianter").select("*").order("id"),
    supabase.from("ean_pool").select("*").eq("id", "gs1").maybeSingle(),
    supabase.from("installningar").select("nyckel,varde"),
    supabase.from("po_rader").select("*").order("id"),
    supabase.from("style_farger").select("*").order("fargindex"),
  ]);
  const fargByStyle = {};
  for (const f of farger.data || []) (fargByStyle[f.style_id] ||= []).push(f);
  const raderByPo = {};
  for (const r of rader.data || []) { const { po_id, id, ...rest } = r; (raderByPo[po_id] ||= []).push(Object.assign({ _rid: id }, rest)); }
  rows.forEach((r) => { if (r.error) fail(r.error); });
  if (logg.error) fail(logg.error);
  const byPost = {};
  for (const l of logg.data) { const k = l.tabell + "/" + l.post_id; (byPost[k] ||= []).push({ t: l.t, av: l.av, text: l.text }); }
  const varsByStyle = {};
  for (const v of vars.data || []) (varsByStyle[v.style_id] ||= []).push({ farg: v.farg, storlek: v.storlek, ean: v.ean, t: v.tilldelad, av: v.av, sku: v.sku });
  TABLES.forEach((t, i) => {
    const m = new Map();
    for (const row of rows[i].data) {
      const d = toDoc(t, row);
      d.logg = byPost[t + "/" + row.id] || [];
      if (t === "styles") d.ean = varsByStyle[row.id] || [];
      if (t === "po") d.rader = raderByPo[row.id] || [];
      if (t === "styles") d.farg_rader = fargByStyle[row.id] || [];
      m.set(row.id, d);
    }
    cache[t] = m;
  });
  pool = p.data ? { prefix: p.data.prefix, nasta: p.data.nasta, slut: p.data.slut, kommentar: p.data.kommentar, shopifyHogsta: p.data.shopify_hogsta, andrad: p.data.andrad } : null;
  settings = null;
  if (s.data) { const app = s.data.find((x) => x.nyckel === "app"); settings = Object.assign({}, app ? app.varde : {}); for (const x of s.data) if (x.nyckel !== "app") settings[x.nyckel] = x.varde; }
  eanLogg = (logg.data || []).filter((l) => l.tabell === "ean").slice(-50).reverse().map((l) => ({ _id: String(l.id), t: l.t, av: l.av, text: l.text, styleId: l.post_id }));
}
function snapshotFor(key) {
  if (key === "ean/pool") return { exists: !!pool, data: () => pool };
  if (key === "installningar/app") return { exists: !!settings, data: () => settings };
  if (key === "eanLogg") return { docs: eanLogg.map((l) => ({ id: l._id, data: () => l })) };
  return { docs: [...cache[key].entries()].map(([id, d]) => ({ id, data: () => d })) };
}
let timer = null;
function notify(keys) { for (const l of listeners) if (!keys || keys.has(l.key)) { try { l.fn(snapshotFor(l.key)); } catch (e) { console.error(e); } } }
async function refresh() { try { await fetchAll(); notify(); } catch (e) { console.error(e); for (const l of listeners) l.err && l.err(e); } }
const scheduleRefresh = () => { clearTimeout(timer); timer = setTimeout(refresh, 250); };

/* Händelser som ska in i logg-tabellen: de poster i patch.logg som inte redan finns på dokumentet. */
async function writeLogg(coll, id, patchLogg) {
  if (!Array.isArray(patchLogg)) return;
  const have = (cache[coll].get(id) || {}).logg || [];
  const seen = new Set(have.map((l) => l.t + "|" + l.text));
  const nya = patchLogg.filter((l) => !seen.has(l.t + "|" + l.text));
  if (!nya.length) return;
  const { error } = await supabase.from("logg").insert(nya.map((l) => ({ tabell: coll, post_id: id, t: l.t, av: l.av || null, text: l.text })));
  if (error) fail(error);
}
async function writeRader(id, rader) {
  if (!Array.isArray(rader)) return;
  const { error: e1 } = await supabase.from("po_rader").delete().eq("po_id", id);
  if (e1) fail(e1);
  if (!rader.length) return;
  const { error } = await supabase.from("po_rader").insert(rader.map((r) => { const { _rid, _storlekar, ...rest } = r; return Object.assign({ po_id: id }, rest); }));
  if (error) fail(error);
}
async function writeVarianter(id, patchEan) {
  if (!Array.isArray(patchEan)) return;
  const have = new Set(((cache.styles.get(id) || {}).ean || []).map((e) => e.ean));
  const nya = patchEan.filter((e) => !have.has(e.ean));
  if (!nya.length) return;
  const { error } = await supabase.from("varianter").insert(nya.map((e) => ({ style_id: id, farg: e.farg, storlek: e.storlek, ean: e.ean, tilldelad: e.t, av: e.av || null })));
  if (error) fail(error);
}

function docRef(coll, id) {
  return {
    async get() {
      if (cache[coll]) return { exists: cache[coll].has(id), data: () => cache[coll].get(id) };
      const { data } = await supabase.from(coll).select("id").eq("id", id).maybeSingle();
      return { exists: !!data, data: () => data };
    },
    async set(body) {
      if (coll === "eanLogg") {
        const text = body.antal + " EAN till " + (body.styleNamn || body.styleId) + " (" + body.forsta + (body.antal > 1 ? "–" + body.sista : "") + ")" + (body.sparad === false ? ", ej sparade på stylen" : "");
        const { error } = await supabase.from("logg").insert({ tabell: "ean", post_id: body.styleId || "", t: body.t, av: body.av || null, text });
        if (error) fail(error); scheduleRefresh(); return;
      }
      if (coll === "installningar" && id === "app") {
        const { andrad, ...varde } = body;
        const { error } = await supabase.from("installningar").upsert({ nyckel: "app", varde });
        if (error) fail(error); scheduleRefresh(); return;
      }
      const row = Object.assign({ id }, toRow(coll, body));
      const { error } = await supabase.from(coll).upsert(row);
      if (error) fail(error);
      await writeLogg(coll, id, body.logg);
      if (coll === "styles") await writeVarianter(id, body.ean);
      if (coll === "po") await writeRader(id, body.rader);
      scheduleRefresh();
    },
    async update(patch) {
      if (coll === "ean" && id === "pool") {
        const row = {}; if ("nasta" in patch) row.nasta = patch.nasta; if ("kommentar" in patch) row.kommentar = patch.kommentar;
        const { error } = await supabase.from("ean_pool").update(row).eq("id", "gs1");
        if (error) fail(error); scheduleRefresh(); return;
      }
      await writeLogg(coll, id, patch.logg);
      if (coll === "styles") await writeVarianter(id, patch.ean);
      if (coll === "po") await writeRader(id, patch.rader);
      const row = toRow(coll, patch);
      if (Object.keys(row).length) { const { error } = await supabase.from(coll).update(row).eq("id", id); if (error) fail(error); }
      scheduleRefresh();
    },
    async delete() {
      const { error } = await supabase.from(coll).delete().eq("id", id);
      if (error) fail(error);
      await supabase.from("logg").delete().eq("tabell", coll).eq("post_id", id);
      scheduleRefresh();
    },
    async acquire() { return { acquired: true }; },
    onSnapshot(fn, err) { listeners.push({ key: coll + "/" + id, fn, err }); fn(snapshotFor(coll + "/" + id)); return () => {}; },
  };
}
function collection(coll) {
  const c = {
    doc: (id) => docRef(coll, id),
    orderBy: () => c, limit: () => c,
    onSnapshot(fn, err) { listeners.push({ key: coll, fn, err }); fn(snapshotFor(coll)); return () => {}; },
  };
  return c;
}
export const db = { collection, doc: (path) => { const [c, i] = path.split("/"); return docRef(c, i); } };

/* EAN tilldelas i databasen (radlås, hoppar över Shopify-nummer). */
export async function allocateEan(n) {
  const { data, error } = await supabase.rpc("tilldela_ean", { p_antal: n });
  if (error) { const e = new Error(error.message); e.code = /räcker inte/.test(error.message) ? "empty" : /inte inställd/.test(error.message) ? "nopool" : error.code; throw e; }
  return data;
}

/* Användare */
let me = null, myRow = null;
export const user = {
  async id() { return me ? me.id : null; },
  async can() { return true; },
  async canEdit() { return !!myRow && myRow.roll === "admin"; },
  async isOwner() { return !!myRow && myRow.roll === "admin"; },
  async profiles(ids) {
    const { data } = await supabase.from("anvandare").select("id, namn, email").in("id", ids);
    return Object.fromEntries((data || []).map((u) => [u.id, { name: u.namn || u.email }]));
  },
  email: () => (me ? me.email : ""),
};

/* Nedladdning: samma anrop som förr, men via en vanlig länk. */
export const downloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },
};

/* Inloggning med Microsoft (Entra ID). Löser med användaren när sessionen finns. */
export async function signIn() {
  await supabase.auth.signInWithOAuth({ provider: "azure", options: { scopes: "email openid profile", redirectTo: location.origin + location.pathname } });
}
export async function signOut() { await supabase.auth.signOut(); location.reload(); }

export async function start() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  me = session.user;
  const { data } = await supabase.from("anvandare").select("*").eq("id", me.id).maybeSingle();
  myRow = data;
  await fetchAll();
  supabase.channel("plm").on("postgres_changes", { event: "*", schema: "public" }, scheduleRefresh).subscribe();
  supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.reload(); });
  return me;
}
