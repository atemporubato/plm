// Migrerar exporten ur Elliots Samples-artefakt (tools/data/elliot-export-2026-10-14.json) till Supabase.
// Kör: node tools/import-elliot.js (läser .env via tools/db.mjs-logiken nedan)
const { createClient } = require("@supabase/supabase-js");
try { for (const line of require("fs").readFileSync(require("path").join(__dirname, "..", ".env"), "utf8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); } } catch {}
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const d = require(process.argv[2] || "./data/elliot-export-2026-10-14.json");
const MAP = {
  samples: { styleId: "style_id", tygId: "tyg_id", prisBelopp: "pris_belopp", prisValuta: "pris_valuta", p1Skickad: "p1_skickad", p2Skickad: "p2_skickad", platsTyp: "plats_typ", platsNotering: "plats_notering" },
  styles: { klartSenast: "klart_senast", fotoSenast: "foto_senast" },
  tyger: { aterDatum: "ater_datum" },
  tyglager: { tygId: "tyg_id", tygNamn: "tyg_namn", inkoptMeter: "inkopt_meter", prisPerMeter: "pris_per_meter", prisValuta: "pris_valuta", reserveradFor: "reserverad_for", bredd: "bredd_cm" },
  leverantorer: { sampleLedtid: "sample_ledtid" },
};
const SKIP = new Set(["andrad", "logg", "ean", "runda", "id"]);
const toRow = (t, o) => { const m = MAP[t] || {}, r = {}; for (const [k, v] of Object.entries(o)) { if (SKIP.has(k)) continue; r[m[k] || k] = v === "" ? null : v; } return r; };
const docs = (t) => d[t].docs.map((x) => x.data);
(async () => {
  const loggs = [];
  const addLogg = (t, id, o) => { for (const l of o.logg || []) loggs.push({ tabell: t, post_id: id, t: l.t, av: null, text: l.text }); loggs.push({ tabell: t, post_id: id, t: new Date().toISOString(), av: null, text: "Migrerad från Samples-artefakten 14 okt 2026" }); };
  // leverantörer: Elliots data vinner, utom produktionstid där min import har värde och hans saknar
  for (const o of docs("leverantorer")) {
    const row = toRow("leverantorer", o); row.id = o.namn.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
    const { data: ex } = await s.from("leverantorer").select("id,produktionstid,kod").ilike("namn", o.namn).maybeSingle();
    if (ex) { if (row.produktionstid == null) row.produktionstid = ex.produktionstid; if (!row.kod) row.kod = ex.kod; const { error } = await s.from("leverantorer").update(row).eq("id", ex.id); if (error) console.log("lev", o.namn, error.message); }
    else { const { error } = await s.from("leverantorer").insert(row); if (error) console.log("lev", o.namn, error.message); }
  }
  for (const t of ["tyger", "styles", "tyglager", "samples"]) {
    const rows = docs(t).map((o) => Object.assign({ id: o.id }, toRow(t, o)));
    const { error } = await s.from(t).upsert(rows);
    if (error) console.log(t, error.message); else console.log(t, rows.length, "rader");
    for (const o of docs(t)) addLogg(t, o.id, o);
  }
  const { error: le } = await s.from("logg").insert(loggs);
  console.log("logg", loggs.length, le ? le.message : "ok");
  const { data: cnt } = await s.from("leverantorer").select("namn,kod,produktionstid,sample_ledtid");
  console.log(cnt);
})();
