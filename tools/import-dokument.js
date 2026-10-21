// Importerar en export ur artefakten (tools/data/elliot-export-<datum>.json) till dokument-tabellen.
//   node tools/import-dokument.js tools/data/elliot-export-2026-10-21.json
// Alla collections skrivs som de är (upsert på collection + id). ean/pool rörs inte (den hostade
// poolen är källan), installningar/app uppdateras. Leverantörernas MID-fält (tools/data/lev-mid.json)
// läggs in i leverantörsdokumenten om de saknas.
const { createClient } = require("@supabase/supabase-js");
try { for (const line of require("fs").readFileSync(require("path").join(__dirname, "..", ".env"), "utf8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); } } catch {}
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const file = process.argv[2] || __dirname + "/data/elliot-export-2026-10-21.json";
const d = require(require("path").resolve(file));
let mid = []; try { mid = require(__dirname + "/data/lev-mid.json"); } catch {}
(async () => {
  const rows = [];
  for (const [coll, v] of Object.entries(d)) {
    if (!v.docs) continue;
    for (const doc of v.docs) {
      const data = Object.assign({}, doc.data);
      if (coll === "leverantorer") { const m = mid.find((x) => String(x.namn).toLowerCase() === String(data.namn).toLowerCase()); if (m) { for (const k of ["land", "mid_code", "mid_name", "mid_address"]) if (data[k] == null && m[k]) data[k] = m[k]; } }
      rows.push({ collection: coll, id: doc.id, data });
    }
  }
  for (let i = 0; i < rows.length; i += 200) { const { error } = await s.from("dokument").upsert(rows.slice(i, i + 200)); if (error) { console.error(error.message); process.exit(1); } }
  const app = d["installningar/app"] && d["installningar/app"].data;
  if (app) { const { andrad, ...varde } = app; await s.from("installningar").upsert({ nyckel: "app", varde }); }
  const counts = {}; for (const r of rows) counts[r.collection] = (counts[r.collection] || 0) + 1;
  console.log("importerat:", counts);
})();
