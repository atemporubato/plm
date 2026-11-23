/* Direct mail to Elliot when a style becomes ready to order (status Godkänd) in PLM.
   POST /api/redo  { id }   (Authorization: Bearer <Supabase session token>)
   The app has already saved the style. This reads it, checks that it really is approved, and mails Elliot through
   Microsoft Graph. A marker (dokument, collection "_notiser", id "redo-<style id>") makes sure a style is mailed at
   most once and that the 10:00 digest does not repeat it. The style itself is never written from here.
   Without the Microsoft keys nothing is sent and the 10:00 digest tells Elliot instead. */

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
const TILL = ["elliot"];

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const u = await verifyUser(req);
    if (!u) return res.status(401).json({ error: "Not signed in" });
    const id = String((req.body && req.body.id) || "");
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return res.status(400).json({ error: "Bad id" });
    const rows = await sb("dokument?select=data&collection=eq.styles&id=eq." + encodeURIComponent(id));
    const st = rows && rows[0] && rows[0].data;
    if (!st) return res.status(404).json({ error: "Style not found" });
    if (st.status !== "Godkänd") return res.status(200).json({ ok: true, skickat: 0, info: "style is not approved" });
    const mark = "redo-" + id;
    const done = await sb("dokument?select=id&collection=eq._notiser&id=eq." + encodeURIComponent(mark));
    if (done && done.length) return res.status(200).json({ ok: true, skickat: 0, info: "already mailed" });
    if (!mailReady()) return res.status(200).json({ ok: true, skickat: 0, info: "mail not configured – goes out with the 10:00 digest" });

    const users = await sb("anvandare?select=id,email,namn");
    const people = users.map((x) => ({ id: x.id, email: x.email, key: personKey(x) })).filter((p) => p.key && p.email);
    const me = users.find((x) => x.id === u.id) || {};
    const colours = (st.farger || []).filter(Boolean);
    const sub = [[st.sasong, st.drop].filter(Boolean).join(" "), st.leverantor, colours.length ? colours.join(", ") : "", me.namn ? "approved by " + me.namn : ""].filter(Boolean).join(" · ");
    const item = { key: "R:" + id, block: "gora", tag: "Approved", text: (st.namn || id) + " is approved – set quantities and colours and place the PO", sub, link: "#produktion", linkText: "Open Production" };
    const token = await graphToken();
    const test = process.env.NOTISER_TEST_TILL || "";
    const sent = [], failed = [];
    for (const k of TILL) {
      const p = people.find((x) => x.key === k); if (!p || p.id === u.id) continue; // no mail to the person who approved it
      const { html } = renderMail({ name: NAMN[k] || k, items: [item], base: BASE, intro: "A style was approved in PLM just now. It stays under Ready to order in Production until a PO is submitted.", heading: "Ready to order", reason: "Sent because a style was approved and has no placed PO." });
      const subject = (test ? "[TEST → " + (NAMN[k] || k) + "] " : "") + "PLM ready to order: " + String(st.namn || id).slice(0, 80);
      try { await sendMail(token, test || p.email, subject, html); sent.push(k); } catch (e) { failed.push(k + ": " + e.message); }
    }
    if (sent.length) await sb("dokument", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ collection: "_notiser", id: mark, data: { t: new Date().toISOString(), till: sent } }) });
    return res.status(200).json({ ok: true, skickat: sent.length, till: sent, fel: failed });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};
