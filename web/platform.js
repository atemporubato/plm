/* Datalager för Rubato PLM (v1, generiskt).
   Exponerar samma API som artefakten skrevs mot (db.collection().doc().update(), onSnapshot(),
   db.doc("ean/pool"), assets.upload(), downloads.save(), user.*) men lagrar i Supabase:
   - varje collection är rader i tabellen dokument (collection, id, data jsonb)
   - ean/pool ligger i ean_pool och delas ut med tilldela_ean (radlås, hoppar över Shopify-nummer)
   - installningar/app ligger i installningar
   - bilder och bilagor ligger i Storage-bucketen bilder, med artefaktens asset-id som objektnamn
   Så kan nya versioner av Elliots artefakt hostas utan schemaändringar. */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
export const BILDER_URL = SUPABASE_URL + "/storage/v1/object/public/bilder/";

const cache = {};          // collection -> Map(id -> data)
let pool = null, settings = null, extra = {};   // extra: hosted-only tabeller som appen får som tillägg
const listeners = [];
const fail = (e) => { const err = new Error(e.message || "db"); err.code = e.code === "42501" ? "invalid_argument" : e.code; throw err; };

async function fetchAll() {
  const [docs, p, s, sh, sf] = await Promise.all([
    supabase.from("dokument").select("collection,id,data").order("id"),
    supabase.from("ean_pool").select("*").eq("id", "gs1").maybeSingle(),
    supabase.from("installningar").select("nyckel,varde"),
    supabase.from("shopify_styles").select("*"),
    supabase.from("style_farger").select("*").order("fargindex"),
  ]);
  if (docs.error) fail(docs.error);
  const next = {};
  for (const row of docs.data) (next[row.collection] ||= new Map()).set(row.id, row.data);
  for (const k of Object.keys(cache)) if (!next[k]) next[k] = new Map();
  Object.assign(cache, next);
  pool = p.data ? { prefix: p.data.prefix, nasta: p.data.nasta, slut: p.data.slut, kommentar: p.data.kommentar, shopifyHogsta: p.data.shopify_hogsta, andrad: p.data.andrad } : null;
  settings = null;
  if (s.data) { const app = s.data.find((x) => x.nyckel === "app"); settings = Object.assign({}, app ? app.varde : {}); for (const x of s.data) if (x.nyckel !== "app") settings[x.nyckel] = x.varde; }
  extra = { shopify: Object.fromEntries((sh.data || []).map((r) => [r.style_id, r])), farger: {} };
  for (const f of sf.data || []) (extra.farger[f.style_id] ||= []).push(f);
}
export const hosted = () => extra;
function snapshotFor(key) {
  if (key === "ean/pool") return { exists: !!pool, data: () => pool };
  if (key === "installningar/app") return { exists: !!settings, data: () => settings };
  const m = cache[key] || new Map();
  let entries = [...m.entries()];
  if (key === "eanLogg") entries = entries.sort((a, b) => String(b[1].t || "").localeCompare(String(a[1].t || ""))).slice(0, 50);
  return { docs: entries.map(([id, d]) => ({ id, data: () => d })) };
}
let timer = null;
function notify() { for (const l of listeners) { try { l.fn(snapshotFor(l.key)); } catch (e) { console.error(e); } } }
export async function refresh() { try { await fetchAll(); notify(); } catch (e) { console.error(e); for (const l of listeners) l.err && l.err(e); } }
export const scheduleRefresh = () => { clearTimeout(timer); timer = setTimeout(refresh, 250); };

function docRef(coll, id) {
  const key = coll + "/" + id;
  return {
    async get() {
      if (key === "ean/pool") return { exists: !!pool, data: () => pool };
      if (key === "installningar/app") return { exists: !!settings, data: () => settings };
      const m = cache[coll]; if (m) return { exists: m.has(id), data: () => m.get(id) };
      const { data } = await supabase.from("dokument").select("id").eq("collection", coll).eq("id", id).maybeSingle();
      return { exists: !!data, data: () => data };
    },
    async set(body) {
      if (key === "installningar/app") { const { andrad, ...varde } = body; const { error } = await supabase.from("installningar").upsert({ nyckel: "app", varde }); if (error) fail(error); scheduleRefresh(); return; }
      const { error } = await supabase.from("dokument").upsert({ collection: coll, id, data: body });
      if (error) fail(error);
      (cache[coll] ||= new Map()).set(id, body);
      scheduleRefresh();
    },
    async update(patch) {
      if (key === "ean/pool") { const row = {}; if ("nasta" in patch) row.nasta = patch.nasta; if ("kommentar" in patch) row.kommentar = patch.kommentar; const { error } = await supabase.from("ean_pool").update(row).eq("id", "gs1"); if (error) fail(error); scheduleRefresh(); return; }
      if (key === "installningar/app") { const cur = settings || {}; const { andrad, ...varde } = Object.assign({}, cur, patch); const { error } = await supabase.from("installningar").upsert({ nyckel: "app", varde }); if (error) fail(error); scheduleRefresh(); return; }
      const { data, error } = await supabase.rpc("dok_update", { p_collection: coll, p_id: id, p_patch: patch });
      if (error) fail(error);
      if (data) (cache[coll] ||= new Map()).set(id, data);
      scheduleRefresh();
    },
    async delete() { const { error } = await supabase.from("dokument").delete().eq("collection", coll).eq("id", id); if (error) fail(error); if (cache[coll]) cache[coll].delete(id); scheduleRefresh(); },
    async acquire() { return { acquired: true }; },
    onSnapshot(fn, err) { listeners.push({ key, fn, err }); fn(snapshotFor(key)); return () => {}; },
  };
}
function collection(coll) {
  const c = { doc: (id) => docRef(coll, id), orderBy: () => c, limit: () => c, async get() { if (!cache[coll]) await refresh(); return snapshotFor(coll); }, onSnapshot(fn, err) { listeners.push({ key: coll, fn, err }); fn(snapshotFor(coll)); return () => {}; } };
  return c;
}
export const db = { collection, doc: (path) => { const [c, i] = path.split("/"); return docRef(c, i); } };

/* EAN tilldelas i databasen. */
export async function allocateEan(n) {
  const { data, error } = await supabase.rpc("tilldela_ean", { p_antal: n });
  if (error) { const e = new Error(error.message); e.code = /räcker inte/.test(error.message) ? "empty" : /inte inställd/.test(error.message) ? "nopool" : error.code; throw e; }
  return data;
}

/* Bilder och bilagor */
const newId = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); };
export const assets = {
  async upload(blob, opts) {
    const id = newId();
    const type = (opts && opts.type) || blob.type || "application/octet-stream";
    const { error } = await supabase.storage.from("bilder").upload(id, blob, { contentType: type, upsert: false });
    if (error) { const e = new Error(error.message); e.code = error.statusCode; throw e; }
    return { id };
  },
  async delete(id) { const { error } = await supabase.storage.from("bilder").remove([id]); if (error) throw new Error(error.message); },
  url: (id) => BILDER_URL + id,
};

/* Användare */
let me = null, myRow = null;
export const user = {
  async id() { return me ? me.id : null; },
  async can() { return true; },
  async canEdit() { return !!myRow && myRow.roll === "admin"; },
  async isOwner() { return !!myRow && myRow.roll === "admin"; },
  async profiles(ids) { const { data } = await supabase.from("anvandare").select("id, namn, email").in("id", ids); return Object.fromEntries((data || []).map((u) => [u.id, { name: u.namn || u.email, email: u.email, guest: false }])); },
  email: () => (me ? me.email : ""),
};

export const downloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },
};

export async function signIn() { await supabase.auth.signInWithOAuth({ provider: "azure", options: { scopes: "email openid profile", redirectTo: location.origin + location.pathname } }); }
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
