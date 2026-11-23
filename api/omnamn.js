/* Direct mail when someone is @-tagged in a comment in PLM.
   POST /api/omnamn  { coll, id, t }   (Authorization: Bearer <Supabase session token>)
   The app has already saved the comment as a log line (logg) on the sample, style, PO or fabric lot. This reads
   that line, works out who is tagged from its text (@Alex, @Jakob …) and mails them through Microsoft Graph.
   Only the person who wrote the comment can trigger it, nobody is mailed about their own comment, and a marker
   (dokument, collection "_notiser", id "omn-<coll>-<id>-<t>") makes sure a comment is mailed at most once and that
   the 10:00 digest does not repeat it. The document itself is never written from here.
   Without the Microsoft keys nothing is sent and the 10:00 digest picks the tag up instead. */

const { renderMail, personKey, NAMN, mentions } = require("./_lib/notiser");

const BASE = process.env.PLM_URL || "https://plm.atemporubato.com";
const COLLS = ["samples", "styles", "po", "tyglager", "refplagg", "handelser", "drops", "tyger", "leverantorer"];
const env = (k) => { const v = process.env[k]; if (!v) throw new Error("Missing environment variable " + k); return v; };

async function sb(path, opts = {}) {
  const { headers: extra, ...rest } = opts;
  const res = await fetch(env("SUPABASE_URL") + "/rest/v1/" + path, Object.assign({ headers: Object.assign({ apikey: env("SUPABASE_SECRET_KEY"), Authorization: "Bearer " + env("SUPABASE_SECRET_KEY"), "Content-Type": "application/json", Prefer: "return=representation" }, extra || {}) }, rest));
  const text = await res.text();
  if (!res.ok) throw new Error("Supabase " + res.status + ": " + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}
async function verifyUser(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(env("SUPABASE_URL") + "/auth/v1/user", { headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), Authorization: "Bearer " + token } });
  if (!res.ok) return null;
  const u = await res.json();
  return u && /@atemporubato\.com$/i.test(u.email || "") ? u : null;
}
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
const short = (s, n = 400) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const one = async (coll, id) => { if (!id) return null; const r = await sb("dokument?select=data&collection=eq." + coll + "&id=eq." + encodeURIComponent(id)); return r && r[0] ? r[0].data : null; };

/* What the comment is on, in words, and where the link goes. */
async function describe(coll, id, d) {
  if (coll === "samples") { const st = await one("styles", d.styleId); return { ref: id + (st && st.namn ? " " + st.namn : "") + (d.farg ? " · " + d.farg : ""), link: "#" + id }; }
  if (coll === "styles") return { ref: d.namn || id, link: "#" + id };
  if (coll === "po") return { ref: "PO " + (d.nr || id) + (d.leverantor ? " · " + d.leverantor : ""), link: "#po:" + id };
  if (coll === "refplagg") return { ref: "reference garment " + (d.plagg || id), link: "#" + id };
  if (coll === "handelser") return { ref: d.titel || id, link: "#" + id };
  if (coll === "drops") return { ref: [d.sasong, d.namn].filter(Boolean).join(" ") || id, link: "#kollektion" };
  if (coll === "tyger") return { ref: "fabric " + (d.namn || id), link: "#" + id };
  if (coll === "leverantorer") return { ref: "supplier " + (d.namn || id), link: "#leverantorer" };
  const tyg = d.tygNamn ? null : await one("tyger", d.tygId);
  return { ref: id + " " + (d.tygNamn || (tyg && tyg.namn) || "fabric lot"), link: "#" + id };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const u = await verifyUser(req);
    if (!u) return res.status(401).json({ error: "Not signed in" });
    const b = req.body || {};
    const coll = String(b.coll || ""), id = String(b.id || ""), t = String(b.t || "");
    if (!COLLS.includes(coll)) return res.status(400).json({ error: "Bad collection" });
    if (!/^[A-Za-z0-9_.:-]{1,60}$/.test(id)) return res.status(400).json({ error: "Bad id" });
    if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(t)) return res.status(400).json({ error: "Bad time" });

    const d = await one(coll, id);
    if (!d) return res.status(404).json({ error: "Not found" });
    const line = (Array.isArray(d.logg) ? d.logg : []).find((x) => x && x.t === t && x.av === u.id);
    if (!line) return res.status(404).json({ error: "Comment not found (only the person who wrote it can send it)" });

    const users = await sb("anvandare?select=id,email,namn");
    const people = users.map((x) => ({ id: x.id, email: x.email, key: personKey(x) })).filter((p) => p.key && p.email);
    const author = people.find((p) => p.id === u.id);
    const till = Object.keys(mentions(line.text)).filter((k) => !author || k !== author.key);
    if (!till.length) return res.status(200).json({ ok: true, skickat: 0, info: "nobody tagged" });

    const mark = "omn-" + coll + "-" + id + "-" + t;
    const done = await sb("dokument?select=id&collection=eq._notiser&id=eq." + encodeURIComponent(mark));
    if (done && done.length) return res.status(200).json({ ok: true, skickat: 0, info: "already mailed" });
    if (!mailReady()) return res.status(200).json({ ok: true, skickat: 0, info: "mail not configured – goes out with the 10:00 digest" });

    const me = users.find((x) => x.id === u.id) || {};
    const from = (me.namn || "").split(/\s+/)[0] || (author ? NAMN[author.key] : "") || "Someone";
    const { ref, link } = await describe(coll, id, d);
    const item = { key: "M:" + mark, block: "gora", tag: "@", text: from + " tagged you on " + ref, sub: "“" + short(line.text) + "”", link, linkText: "Open" };
    const token = await graphToken();
    const test = process.env.NOTISER_TEST_TILL || "";
    const sent = [], failed = [], missing = [];
    for (const k of till) {
      const p = people.find((x) => x.key === k); if (!p) { missing.push(NAMN[k] || k); continue; }
      const { html } = renderMail({ name: NAMN[k] || k, items: [item], base: BASE, intro: from + " tagged you in a comment in PLM just now.", heading: "Tagged", reason: "Sent because someone tagged you in a comment." });
      const subject = (test ? "[TEST → " + (NAMN[k] || k) + "] " : "") + "PLM: " + from + " tagged you on " + short(ref, 80);
      try { await sendMail(token, test || p.email, subject, html); sent.push(k); } catch (e) { failed.push(k + ": " + e.message); }
    }
    if (sent.length) await sb("dokument", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ collection: "_notiser", id: mark, data: { t: new Date().toISOString(), till: sent } }) });
    // info is shown to the person who wrote the comment, so a mail that did not go out says why.
    const info = [missing.length ? "no PLM user found for " + missing.join(", ") : "", failed.length ? "mail failed: " + failed.join("; ").slice(0, 200) : "", sent.length && test ? "test mode – sent to " + test : ""].filter(Boolean).join(" · ");
    return res.status(200).json({ ok: true, skickat: sent.length, till: sent, fel: failed, info: info || undefined });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};
