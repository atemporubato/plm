/* Dagligt PLM-mejl kl. 10 (svensk tid).
   GET  /api/notiser                       – Vercel cron (Authorization: Bearer CRON_SECRET)
   GET  /api/notiser?preview=jakob         – admin: visa Jakobs mejl som HTML, sparar inget
   GET  /api/notiser?preview=alla          – admin: lista vad alla skulle få, sparar inget
   Tillstånd sparas i dokument (collection "_notiser", id "state") – appen rör det inte.
   Saknas Microsoft-nycklarna räknas allt men inget skickas och tillståndet flyttas inte fram. */

const { compute, renderMail, personKey, NAMN } = require("./_lib/notiser");

const BASE = process.env.PLM_URL || "https://plm.atemporubato.com";
const COLLS = ["samples", "styles", "po", "drops", "leverantorer", "handelser", "flaggor"];
const env = (k) => { const v = process.env[k]; if (!v) throw new Error("Missing environment variable " + k); return v; };

async function sb(path, opts = {}) {
  const { headers: extra, ...rest } = opts;
  const res = await fetch(env("SUPABASE_URL") + "/rest/v1/" + path, Object.assign({ headers: Object.assign({ apikey: env("SUPABASE_SECRET_KEY"), Authorization: "Bearer " + env("SUPABASE_SECRET_KEY"), "Content-Type": "application/json", Prefer: "return=representation" }, extra || {}) }, rest));
  const text = await res.text();
  if (!res.ok) throw new Error("Supabase " + res.status + ": " + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}
async function verifyAdmin(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "") || String((req.query || {}).token || "");
  if (!token) return null;
  const res = await fetch(env("SUPABASE_URL") + "/auth/v1/user", { headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), Authorization: "Bearer " + token } });
  if (!res.ok) return null;
  const u = await res.json();
  if (!u || !/@atemporubato\.com$/i.test(u.email || "")) return null;
  const rows = await sb("anvandare?select=roll&id=eq." + encodeURIComponent(u.id));
  return rows && rows[0] && rows[0].roll === "admin" ? u : null;
}

async function load() {
  const rows = await sb("dokument?select=collection,id,data&collection=in.(" + COLLS.concat(["_notiser"]).join(",") + ")");
  const docs = Object.fromEntries(COLLS.map((c) => [c, []]));
  let state = null;
  for (const r of rows) {
    if (r.collection === "_notiser") { if (r.id === "state") state = r.data; continue; }
    docs[r.collection].push(Object.assign({}, r.data, { _id: r.id }));
  }
  const inst = await sb("installningar?select=nyckel,varde");
  const app = (inst.find((x) => x.nyckel === "app") || {}).varde || {};
  const settings = Object.assign({}, app); for (const x of inst) if (x.nyckel !== "app") settings[x.nyckel] = x.varde;
  const users = await sb("anvandare?select=id,email,namn,roll");
  const persons = users.map((u) => ({ id: u.id, email: u.email, key: personKey(u) })).filter((p) => p.key && p.email);
  return { docs, state, settings, persons };
}
const saveState = (state) => sb("dokument", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ collection: "_notiser", id: "state", data: state }) });

/* ---------- Microsoft Graph ---------- */
const mailReady = () => ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "MAIL_FROM"].every((k) => !!process.env[k]);
async function graphToken() {
  const body = new URLSearchParams({ client_id: env("MS_CLIENT_ID"), client_secret: env("MS_CLIENT_SECRET"), scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" });
  const res = await fetch("https://login.microsoftonline.com/" + env("MS_TENANT_ID") + "/oauth2/v2.0/token", { method: "POST", body });
  const j = await res.json();
  if (!j.access_token) throw new Error("Microsoft sign-in failed: " + (j.error_description || j.error || "unknown").slice(0, 200));
  return j.access_token;
}
async function sendMail(token, to, subject, html) {
  const res = await fetch("https://graph.microsoft.com/v1.0/users/" + encodeURIComponent(env("MAIL_FROM")) + "/sendMail", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: false }),
  });
  if (!res.ok) throw new Error("Graph " + res.status + ": " + (await res.text()).slice(0, 300));
}

const stockholm = (d) => { const p = Object.fromEntries(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value])); return { date: p.year + "-" + p.month + "-" + p.day, hour: Number(p.hour) }; };

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const now = new Date();

    /* --- förhandsvisning för admin --- */
    if (q.preview) {
      if (!(await verifyAdmin(req))) return res.status(401).json({ error: "Admin only" });
      const { docs, state, settings, persons } = await load();
      const out = compute({ state, docs, settings, persons, now });
      const key = String(q.preview).toLowerCase();
      if (key === "alla") return res.status(200).json({ baslinje: !state, mottagare: Object.fromEntries(Object.entries(out.perPerson).map(([k, v]) => [k, v.map((x) => x.text)])) });
      const items = out.perPerson[key] || [];
      const { html } = renderMail({ name: NAMN[key] || key, items, base: BASE });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(items.length ? html : "<p style='font-family:sans-serif'>No notices for " + key + " right now.</p>");
    }

    /* --- cron --- */
    if ((req.headers.authorization || "") !== "Bearer " + env("CRON_SECRET")) return res.status(401).json({ error: "Unauthorized" });
    const sthlm = stockholm(now);
    const { docs, state, settings, persons } = await load();
    if (!q.force) {
      if (sthlm.hour < 10) return res.status(200).json({ ok: true, skip: "before 10:00" });
      if (state && state.lastSent === sthlm.date) return res.status(200).json({ ok: true, skip: "already sent today" });
    }
    const out = compute({ state, docs, settings, persons, now });
    // första gången: bara baslinje, inget skickas; tidsbaserade påminnelser kommer nästa dag
    if (!state) { await saveState(Object.assign(out.state, { sent: {}, lastSent: sthlm.date })); return res.status(200).json({ ok: true, baslinje: true }); }
    if (!mailReady()) return res.status(200).json({ ok: true, skickat: 0, info: "Microsoft keys missing – nothing sent, nothing saved", skulle: Object.fromEntries(Object.entries(out.perPerson).map(([k, v]) => [k, v.length])) });

    const token = await graphToken();
    const test = process.env.NOTISER_TEST_TILL || "";
    const sent = [], failed = [];
    for (const [key, items] of Object.entries(out.perPerson)) {
      if (!items.length) continue;
      const person = persons.find((p) => p.key === key);
      if (!person) continue;
      const { subject, html } = renderMail({ name: NAMN[key], items, base: BASE });
      try { await sendMail(token, test || person.email, test ? "[TEST → " + NAMN[key] + "] " + subject : subject, html); sent.push(key); }
      catch (e) { failed.push(key + ": " + e.message); }
    }
    if (failed.length && !sent.length) throw new Error(failed.join(" | "));
    await saveState(Object.assign(out.state, { lastSent: sthlm.date }));
    return res.status(200).json({ ok: true, skickat: sent, fel: failed, test: !!test });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};
