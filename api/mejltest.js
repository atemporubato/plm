/* Test of PLM email: sends one test mail to the signed-in person and reports what works.
   GET /api/mejltest   (Authorization: Bearer <Supabase session token>)
   Reports which settings are present (names only, never values), whether Microsoft sign-in works and whether
   the mail went out. Sends to NOTISER_TEST_TILL if set, otherwise to the signed-in person's own address. */

const { renderMail } = require("./_lib/notiser");

const BASE = process.env.PLM_URL || "https://plm.atemporubato.com";
const KEYS = ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "MAIL_FROM", "CRON_SECRET", "NOTISER_TEST_TILL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"];

async function verifyUser(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL) return null;
  const res = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + token } });
  if (!res.ok) return null;
  const u = await res.json();
  return u && /@atemporubato\.com$/i.test(u.email || "") ? u : null;
}

module.exports = async (req, res) => {
  const out = { finns: {}, microsoft: null, mejl: null };
  try {
    const u = await verifyUser(req);
    if (!u) return res.status(401).json({ error: "Not signed in" });
    for (const k of KEYS) out.finns[k] = !!process.env[k];
    const ms = ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "MAIL_FROM"];
    if (!ms.every((k) => process.env[k])) { out.microsoft = "saknar " + ms.filter((k) => !process.env[k]).join(", "); return res.status(200).json(out); }

    const body = new URLSearchParams({ client_id: process.env.MS_CLIENT_ID, client_secret: process.env.MS_CLIENT_SECRET, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" });
    const tr = await fetch("https://login.microsoftonline.com/" + process.env.MS_TENANT_ID + "/oauth2/v2.0/token", { method: "POST", body });
    const tj = await tr.json();
    if (!tj.access_token) { out.microsoft = "inloggning misslyckades: " + String(tj.error_description || tj.error || "okänt").split("\r\n")[0].slice(0, 300); return res.status(200).json(out); }
    out.microsoft = "ok";

    const to = process.env.NOTISER_TEST_TILL || u.email;
    const item = { key: "T", block: "gora", tag: "Test", text: "Email from PLM works", sub: "Sent " + new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC from " + process.env.MAIL_FROM, link: "", linkText: "Open PLM" };
    const { html } = renderMail({ name: (u.email || "").split("@")[0].split(".")[0].replace(/^./, (c) => c.toUpperCase()), items: [item], base: BASE, intro: "This is a test. If you can read this, tags, flags and the 10:00 email can be sent.", heading: "Test", reason: "Sent because someone ran the email test." });
    const sr = await fetch("https://graph.microsoft.com/v1.0/users/" + encodeURIComponent(process.env.MAIL_FROM) + "/sendMail", {
      method: "POST", headers: { Authorization: "Bearer " + tj.access_token, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject: "PLM: testmejl", body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: false }),
    });
    out.mejl = sr.ok ? "skickat till " + to : "misslyckades (" + sr.status + "): " + (await sr.text()).slice(0, 300);
    return res.status(200).json(out);
  } catch (e) {
    out.fel = e.message;
    return res.status(500).json(out);
  }
};
