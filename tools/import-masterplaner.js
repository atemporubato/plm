// Kör: node tools/import-elliot.js (läser .env via tools/db.mjs-logiken nedan)
const { createClient } = require("@supabase/supabase-js");
try { for (const line of require("fs").readFileSync(require("path").join(__dirname, "..", ".env"), "utf8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); } } catch {}
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const slug = (x) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
(async () => {
  const d = require(__dirname + "/data/masterplaner_po.json");
  for (const l of d.lev) {
    const { data: ex } = await s.from("leverantorer").select("id").ilike("namn", l.namn).maybeSingle();
    if (ex) continue;
    const { error } = await s.from("leverantorer").insert({ id: slug(l.namn), namn: l.namn, kod: l.kod, produktionstid: l.ptid.length ? Math.max(...l.ptid) : null, kommentar: "Skapad vid import från Rubato_Masterplaner 2026-10-14" });
    if (error) console.log("lev", l.namn, error.message);
  }
  let n = 0, r = 0;
  for (const p of d.po) {
    const { rader, ...po } = p;
    const { error } = await s.from("po").upsert(po);
    if (error) { console.log(p.id, error.message); continue; }
    await s.from("po_rader").delete().eq("po_id", p.id);
    const { error: e2 } = await s.from("po_rader").insert(rader.map((x) => Object.assign({ po_id: p.id }, x)));
    if (e2) console.log(p.id, "rader", e2.message);
    await s.from("logg").insert({ tabell: "po", post_id: p.id, text: "Importerad från Rubato_Masterplaner (fliken " + (p.sasong === "SS27" ? "SS27" : "Produktion") + ")" });
    n++; r += rader.length;
  }
  console.log("po", n, "rader", r);
  console.log((await s.from("leverantorer").select("namn,kod,produktionstid")).data);
})();
