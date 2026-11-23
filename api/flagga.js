/* Direct mail when someone raises a flag in PLM.
   POST /api/flagga  { id }   (Authorization: Bearer <Supabase session token>)
   The app has already saved the flag (dokument, collection "flaggor"). This reads it, mails the people it is
   addressed to through Microsoft Graph, and marks the flag as mailed so the 10:00 digest does not repeat it.
   Without the Microsoft keys nothing is sent and the flag is picked up by the digest instead. */

const { renderMail, personKey, NAMN } = require("./_lib/notiser");

const BASE = process.env.PLM_URL || "https://plm.atemporubato.com";
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
const linkOf = (f) => (f.typ === "po" ? "#po:" + f.ref : ["sample", "style", "handelse"].includes(f.typ) ? "#" + f.ref : "#" + (f.tab || "samples"));

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const u = await verifyUser(req);
    if (!u) return res.status(401).json({ error: "Not signed in" });
    const id = String((req.body && req.body.id) || "");
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return res.status(400).json({ error: "Bad id" });
    const rows = await sb("dokument?select=data&collection=eq.flaggor&id=eq." + encodeURIComponent(id));
    const f = rows && rows[0] && rows[0].data;
    if (!f) return res.status(404).json({ error: "Flag not found" });
    if (f.av && f.av !== u.id) return res.status(403).json({ error: "Only the person who raised the flag can send it" });
    if (f.mejlad) return res.status(200).json({ ok: true, skickat: 0, info: "already mailed" });
    if (!mailReady()) return res.status(200).json({ ok: true, skickat: 0, info: "mail not configured – goes out with the 10:00 digest" });

    const users = await sb("anvandare?select=id,email,namn");
    const people = users.map((x) => ({ email: x.email, key: personKey(x) })).filter((p) => p.key && p.email);
    const from = f.avNamn || (users.find((x) => x.id === f.av) || {}).namn || "Someone";
    const item = { key: "F:" + id, block: "gora", tag: "Flag", text: from + " flagged " + (f.titel || f.ref), sub: "“" + short(f.text) + "”", link: linkOf(f), linkText: "Open" };
    const token = await graphToken();
    const test = process.env.NOTISER_TEST_TILL || "";
    const sent = [], failed = [];
    for (const k of f.till || []) {
      const p = people.find((x) => x.key === k); if (!p) continue;
      const { html } = renderMail({ name: NAMN[k] || k, items: [item], base: BASE, intro: "This was flagged in PLM just now and needs your attention." });
      const subject = (test ? "[TEST → " + (NAMN[k] || k) + "] " : "") + "PLM flag: " + short(f.titel || f.ref, 80);
      try { await sendMail(token, test || p.email, subject, html); sent.push(k); } catch (e) { failed.push(k + ": " + e.message); }
    }
    if (sent.length) await sb("dokument?collection=eq.flaggor&id=eq." + encodeURIComponent(id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: Object.assign({}, f, { mejlad: new Date().toISOString() }) }) });
    return res.status(200).json({ ok: true, skickat: sent.length, till: sent, fel: failed });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};
