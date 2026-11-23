/* Notisregler för PLM-mejlet kl. 10 (spec: claude/notiser-spec-v9.2.md i projektet RUBATO PLM).
   Rena funktioner utan IO så att de går att testa lokalt:
     compute({ state, docs, settings, persons, now }) -> { perPerson: { key: [item] }, state }
   Händelser hittas genom att jämföra dagens data med en kompakt ögonblicksbild från förra körningen.
   Tidsbaserade notiser (försenad, 2 dagar utan beslut, 14 dagar till lansering …) skickas en gång per sak. */

const DAY = 86400000;
const PERSONER = ["elliot", "jakob", "carl", "alex", "oliver"];
const ALIAS = { alexander: "alex", alexandre: "alex", calle: "carl", karl: "carl" };
const PO_STATUS = ["Placeholder", "Inskickad", "PO bekräftad", "I produktion", "Skickad", "Inlevererad", "Problem", "Avbruten"];
const PO_DRAFT = ["Placeholder", "Avbruten"];
const ST_IDE = "Idé ej redo för design", ST_DESIGN = "Idé redo att designa", ST_KANBEST = "Sample kan beställas";
const IDEA_STATUS = [ST_IDE, ST_DESIGN, ST_KANBEST];
const STATUS_GAMLA = { "Skippad": "Kastad", "Produktidé": ST_IDE, "Idé under utveckling": ST_KANBEST };
const KANDA = PERSONER.concat(["conor"]); // Conor (extern designer) får notiser men räknas inte in i "alla"
const ECOM_CHECKS = ["ecomShopify", "ecomBeskrivning", "ecomPrisSatt", "ecomStorleksguide", "ecomNewsletter", "ecomSeo"];
const SHOT = ["Fotade", "Retuscherade", "Publicerade"];
const FX_DEFAULT = { EUR: 11.32, GBP: 13.08, JPY: 0.0657, USD: 10.6, SEK: 1 };
const MAN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/* Stored values stay Swedish in the database; this is how they read in the mail. */
const EN_VAL = { "Godkänd": "Approved", "Ny runda": "New round", "Pausad": "Paused", "Kastad": "Dropped", "Beställd": "Ordered", "Skickad": "Shipped", "Mottagen": "Received", "Returnerad": "Returned", "Fotosample": "Photo sample", "Produktionssample": "Production sample", "Storleksset": "Size set", "Förskott": "Deposit", "Slutbetalning": "Final payment" };
const en = (v) => (v && EN_VAL[v]) || v || "";

/* ---------- små hjälpare ---------- */
const num = (v) => { if (v == null || v === "") return null; const n = Number(String(v).replace(",", ".").replace(/\s/g, "")); return isNaN(n) ? null : n; };
const isISO = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d);
const iso = (d) => (isISO(d) ? d.slice(0, 10) : null);
const addDays = (d, n) => { const x = new Date(iso(d) + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(iso(b) + "T12:00:00Z") - new Date(iso(a) + "T12:00:00Z")) / DAY);
const fmtDate = (d) => { if (!isISO(d)) return ""; const [, m, dd] = d.slice(0, 10).split("-"); return Number(dd) + " " + MAN[Number(m) - 1]; };
const norm = (s) => String(s || "").trim().toLowerCase();
const poStatusNorm = (x) => (x === "Utkast" ? "Placeholder" : PO_STATUS.includes(x) ? x : x ? "Inskickad" : "Placeholder");
const styleStatusNorm = (s) => STATUS_GAMLA[s] || s || "Sampling";
const beslutNorm = (b) => (b === "Underkänd" ? "Kastad" : b || "");
const fotoPoNorm = (v) => { const x = String(v || "").trim(); if (!x) return ""; if (/^inne$|finns|inne|mottag/i.test(x)) return "Inne"; if (/ej aktuell|saknas|nej/i.test(x)) return "Ej aktuell"; return "Beställd"; };
const dropKey = (sasong, namn) => norm(sasong) + "|" + norm(namn);
const poEta = (po) => iso(po.etaLager) || iso(po.bekraftadEx) || iso(po.planeradEx) || null;
const expected = (s) => iso(s.forvantad) || (iso(s.bestalld) && num(s.ledtid) > 0 ? addDays(s.bestalld, num(s.ledtid)) : null);
const kort = (s, n = 110) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const fargText = (f) => { const raw = String(f || "").trim(); const w = raw.replace(/^(?:col(?:ou?r)?\.?\s*)?[#0-9][0-9a-z]*[\s.:\-–]+/i, "").split(/[\s,]+/).filter(Boolean); const k = w.filter((x) => !/\d/.test(x) && !/^col(?:ou?r)?\.?$/i.test(x)); const o = (k.length ? k : w).join(" "); return o ? o[0].toUpperCase() + o.slice(1) : raw; };
const fmtTkr = (n) => (n == null ? "–" : Math.round(n / 1000).toLocaleString("sv-SE") + " k SEK");
const fmtCur = (n, cur) => (cur === "JPY" ? Math.round(n).toLocaleString("sv-SE") : Math.round(n).toLocaleString("sv-SE")) + " " + cur;
const hash = (s) => { let h = 0; const t = String(s || ""); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return t ? h : 0; };

/* Vem är vem: förnamn ur namn eller e-post, med alias (Alexander -> alex). */
function personKey(u) {
  const first = norm((u.namn || "").split(/\s+/)[0]) || norm(String(u.email || "").split("@")[0].split(/[._-]/)[0]);
  const k = ALIAS[first] || first;
  return KANDA.includes(k) ? k : null;
}
const NAMN = { elliot: "Elliot", jakob: "Jakob", carl: "Carl", alex: "Alex", oliver: "Oliver", conor: "Conor" };

/* Den som gjorde senaste ändringen: sista loggraden efter förra körningen. */
function actorOf(d, since) {
  const lg = Array.isArray(d.logg) ? d.logg : [];
  const last = lg[lg.length - 1];
  if (!last || !last.av) return null;
  if (since && last.t && last.t < since) return null;
  return last.av;
}

/* @-omnämnanden per förnamn i en text, räknade. */
function mentions(text) {
  const out = {};
  for (const m of String(text || "").matchAll(/@([A-Za-zÅÄÖåäö]+)/g)) { const k = ALIAS[norm(m[1])] || norm(m[1]); if (KANDA.includes(k)) out[k] = (out[k] || 0) + 1; }
  return out;
}
const mentionSnippet = (text, k) => { const t = String(text || ""); const re = new RegExp("@" + "(" + Object.keys(ALIAS).filter((a) => ALIAS[a] === k).concat([k]).join("|") + ")", "i"); const m = re.exec(t); if (!m) return kort(t); const a = Math.max(0, m.index - 40); return (a ? "…" : "") + kort(t.slice(a), 120); };
const TEXT_FIELDS = ["kommentar", "andringar", "beskrivning", "problem", "notering"];

/* ---------- betalningar (samma logik som appens paymentPlan) ---------- */
function makeMoney(docs, settings) {
  const levs = docs.leverantorer || [];
  const levByName = (n) => levs.find((l) => norm(l.namn) === norm(n)) || null;
  const fx = (cur) => (!cur || cur === "SEK" ? 1 : num((settings.kurser || {})[cur]) ?? FX_DEFAULT[cur] ?? null);
  const styles = new Map((docs.styles || []).map((s) => [s._id, s]));
  const lineUnit = (r) => { const p = num(r.styckpris); if (p != null) return p; const st = r.styleId ? styles.get(r.styleId) : null; if (st && num(st.inkopspris) && fx(st.inkopsValuta || "SEK")) return num(st.inkopspris) * fx(st.inkopsValuta || "SEK"); return null; };
  const lineCost = (r) => { const a = num(r.antal), u = lineUnit(r), t = num(r.tygkostnad) || 0; return a == null || u == null ? num(r.kostnad) ?? null : a * (u + t); };
  const poTotal = (po) => (po.rader || []).reduce((a, r) => a + (lineCost(r) || 0), 0);
  const levNum = (n, f) => { const l = levByName(n); return l ? num(l[f]) : null; };
  const fraktFor = (n) => { const v = levNum(n, "frakt"); return v == null ? num(settings.standardFrakt) ?? 7 : v; };
  function milestones(po) {
    const prod = num(po.produktionstid) ?? levNum(po.leverantor, "produktionstid");
    const ord = iso(po.orderDatum);
    const frakt = fraktFor(po.leverantor);
    const ex = iso(po.bekraftadEx) || iso(po.planeradEx) || (ord && prod != null ? addDays(ord, prod) : iso(po.leveransOnskad) ? addDays(po.leveransOnskad, -frakt) : null);
    const lev = iso(po.etaLager) || (ex ? addDays(ex, frakt) : iso(po.leveransOnskad));
    const start = ord || (ex && prod != null ? addDays(ex, -prod) : null);
    return { order: start, produktion: start, exfactory: ex, faktura: ex, leverans: lev };
  }
  function plan(po) {
    const st = poStatusNorm(po.status);
    if (PO_DRAFT.includes(st)) return [];
    const lev = levByName(po.leverantor);
    const cur = (lev && lev.valuta) || po.valuta || "SEK";
    const rate = fx(cur) || 1;
    const manual = [];
    if (num(po.forskottBelopp)) manual.push({ typ: "Förskott", belopp: num(po.forskottBelopp), datum: iso(po.forskottDatum), betald: !!po.forskottBetald, idx: "f" });
    if (num(po.slutBelopp)) manual.push({ typ: "Slutbetalning", belopp: num(po.slutBelopp), datum: iso(po.slutDatum), betald: !!po.slutBetald, idx: "s" });
    if (manual.length) return manual.map((x) => Object.assign(x, { valuta: cur, beloppValuta: x.belopp / rate }));
    const total = poTotal(po); if (!total) return [];
    const terms = lev && Array.isArray(lev.villkor) && lev.villkor.length ? lev.villkor : [{ andel: 100, vid: "leverans", dagar: 0 }];
    const ms = milestones(po); const paid = po.betalningar || {};
    return terms.map((t, i) => {
      const base = ms[t.vid] || null; const datum = base ? addDays(base, num(t.dagar) || 0) : null;
      const belopp = total * (num(t.andel) || 0) / 100; const rec = paid[i] || null;
      return { typ: (num(t.andel) ?? 0) + " %", belopp, valuta: cur, beloppValuta: belopp / rate, datum, betald: rec ? !!rec.betald : false, idx: i };
    });
  }
  return { plan };
}

/* ---------- drop-register (samma regler som appen) ----------
   Lanseringen ägs av Jakobs drop-rad i COO (händelse med matris "drop"); finns ingen rad gäller droppens eget datum.
   "I lager senast" = lansering minus marginalen (5 dagar) om droppen inte har ett eget datum.
   En PO hör till de drops som stylarna på raderna har (samma säsong); annars det som står på PO:n. */
function register(docs, settings = {}) {
  const marginal = num(settings.lagerMarginal) ?? 5;
  const tbd = (x) => /^TBD\s/i.test(x.titel || "");
  const rows = new Map();
  for (const e of docs.handelser || []) {
    if (e.matris !== "drop" || e.hor_till || e.status === "Inställd" || !String(e.sasong || "").trim() || !String(e.drop || "").trim()) continue;
    const k = dropKey(e.sasong, e.drop); const cur = rows.get(k);
    if (!cur || (tbd(cur) && !tbd(e)) || (tbd(cur) === tbd(e) && String(e.datum || "9") < String(cur.datum || "9"))) rows.set(k, e);
  }
  const eff = (doc, ev) => { const l = (ev && iso(ev.datum)) || iso(doc.lansering) || null; const eget = iso(doc.klartSenast) || null; return { key: dropKey(doc.sasong, doc.namn), _id: doc._id, sasong: String(doc.sasong || "").trim(), namn: String(doc.namn || "").trim(), lansering: l, klart: eget || (l ? addDays(l, -marginal) : null), eget: !!eget, ev: ev || null, doc }; };
  const seen = new Set(); const drops = [];
  for (const d of docs.drops || []) { const k = dropKey(d.sasong, d.namn); seen.add(k); drops.push(eff(d, rows.get(k))); }
  for (const [k, e] of rows) if (!seen.has(k)) drops.push(eff({ sasong: e.sasong, namn: e.drop }, e));
  const styles = new Map((docs.styles || []).map((s) => [s._id, s]));
  const poDrops = (p) => { const out = []; for (const r of p.rader || []) { const st = r.styleId ? styles.get(r.styleId) : null; const dn = st ? String(st.drop || "").trim() : ""; if (dn && norm(st.sasong) === norm(p.sasong) && !out.some((x) => norm(x) === norm(dn))) out.push(dn); } if (!out.length && String(p.drop || "").trim()) out.push(String(p.drop).trim()); return out.sort((a, b) => a.localeCompare(b, "sv")); };
  return { drops, poDrops, marginal };
}

/* ---------- kompakt ögonblicksbild ---------- */
function snapshot(docs, settings) {
  const snap = { samples: {}, styles: {}, po: {}, drops: {}, text: {}, flags: {} };
  for (const f of docs.flaggor || []) snap.flags[f._id] = f.status === "Löst" ? 1 : 0;
  const textOf = (coll, d) => { const t = TEXT_FIELDS.map((f) => d[f] || "").join("\n"); const m = mentions(t); if (Object.keys(m).length) snap.text[coll + ":" + d._id] = m; };
  for (const s of docs.samples || []) { snap.samples[s._id] = { s: s.status || "", b: beslutNorm(s.beslut), m: s.mattGodkanda == null || s.mattGodkanda === "" ? 0 : 1, k: hash(s.kommentar) }; textOf("samples", s); }
  for (const s of docs.styles || []) { snap.styles[s._id] = { s: styleStatusNorm(s.status), o: (s.overlamnad && s.overlamnad.t) || "", e: s.ecomBilder || "", d: (s.design && s.design.klar) || "" }; textOf("styles", s); }
  for (const p of docs.po || []) { snap.po[p._id] = { s: poStatusNorm(p.status), eta: poEta(p) || "", bex: iso(p.bekraftadEx) || "", f: fotoPoNorm(p.fotosample), q: (p.rader || []).reduce((a, r) => a + (num(r.antal) || 0), 0) }; textOf("po", p); }
  for (const d of register(docs, settings).drops) snap.drops[d.key] = { l: d.lansering || "" };
  for (const d of docs.drops || []) textOf("drops", d);
  return snap;
}

/* ---------- reglerna ---------- */
function compute({ state, docs, settings = {}, persons = [], now = new Date() }) {
  const today = new Date(now.getTime() + 3600000).toISOString().slice(0, 10); // svensk dag (räcker för datumjämförelser)
  const prev = state && state.snap ? state.snap : null;
  const since = state && state.lastRun ? state.lastRun : null;
  const lastDay = since ? since.slice(0, 10) : today;
  const sent = Object.assign({}, (state && state.sent) || {});
  const seen = Object.assign({}, (state && state.seen) || {});
  const byId = new Map(persons.map((p) => [p.id, p]));
  const actorKey = (id) => (id && byId.get(id) ? byId.get(id).key : null);
  const actorName = (id) => (actorKey(id) ? NAMN[actorKey(id)] : null);
  const perPerson = {};
  const add = (to, item, actor) => {
    const a = actorKey(actor);
    for (const k of to === "alla" ? PERSONER : to) {
      if (a && a === k) continue; // inga notiser om sina egna ändringar
      const list = (perPerson[k] ||= []);
      if (!list.some((x) => x.key === item.key)) list.push(item);
    }
  };
  const once = (key) => { if (sent[key]) return false; sent[key] = today; return true; };

  const reg = register(docs, settings);
  const styles = new Map((docs.styles || []).map((s) => [s._id, s]));
  const styleName = (id) => (styles.get(id) ? styles.get(id).namn : id || "");
  const sampleLabel = (s) => s._id + " " + styleName(s.styleId) + (s.farg ? " · " + fargText(s.farg) : "");
  const poProducts = (p) => { const names = [...new Set((p.rader || []).map((r) => r.produkt || styleName(r.styleId)).filter(Boolean))]; return names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? " and more" : "") : ""; };
  const poLabel = (p) => (p.nr || p._id) + (poProducts(p) ? " · " + poProducts(p) : "");
  const poSub = (p) => [p.leverantor, [p.sasong, reg.poDrops(p).join(" + ")].filter(Boolean).join(" "), (p.rader || []).reduce((a, r) => a + (num(r.antal) || 0), 0) ? (p.rader || []).reduce((a, r) => a + (num(r.antal) || 0), 0) + " pcs" : "", poEta(p) ? "ETA warehouse " + fmtDate(poEta(p)) : ""].filter(Boolean).join(" · ");
  const L = { sample: (s) => "#" + s._id, style: (s) => "#" + s._id, po: (p) => "#po:" + p._id, ecom: "#ecom", coo: "#coo", lev: "#leverantorer", foto: "#foto" };
  const item = (key, block, tag, text, sub, link, linkText) => ({ key, block, tag, text, sub: sub || "", link, linkText });

  if (prev) {
    /* --- styles --- */
    for (const st of docs.styles || []) {
      const p = prev.styles[st._id]; const s = styleStatusNorm(st.status); const actor = actorOf(st, since);
      const ot = (st.overlamnad && st.overlamnad.t) || "";
      if (ot && (!p || p.o !== ot)) {
        const sub = [st.sasong, st.drop, st.tyg || st.tygNamn, (st.bilder || []).length ? (st.bilder || []).length + " images" : ""].filter(Boolean).join(" · ");
        if (norm(st.overlamnad.till) === "conor") add(["conor"], item("A:" + st._id + ":" + ot, "gora", "Design", "New idea to design: " + st.namn + (actorName(st.overlamnad.av) ? " – from " + actorName(st.overlamnad.av) : ""), sub, L.style(st), "Open brief"), st.overlamnad.av);
        else add(["alex"], item("A:" + st._id + ":" + ot, "gora", "Sample", "Sample can be ordered: " + st.namn + (st.overlamnad.fran === "design" ? " – design done" : actorName(st.overlamnad.av) ? " – from " + actorName(st.overlamnad.av) : ""), sub, L.style(st), "Order sample"), st.overlamnad.av);
      }
      const dk = (st.design && st.design.klar) || "";
      if (dk && p && p.d !== dk) add(["carl"], item("DK:" + st._id + ":" + dk, "veta", "Design", "Design done: " + st.namn + " – sent to sampling", kort((st.design || {}).kommentar), L.style(st), "Open style"), (st.design || {}).av);
      if (!p) continue;
      if (s !== p.s && s === "Godkänd") add(["elliot"], item("6:" + st._id, "gora", "Approved", st.namn + " approved – set quantities and colours", [st.sasong, st.drop, st.leverantor].filter(Boolean).join(" · "), L.style(st), "Open style"), actor);
      if (s !== p.s && ["Pausad", "Kastad"].includes(s)) add(["alex", "elliot"], item("18s:" + st._id + ":" + s, "veta", "Decision", st.namn + ": " + en(s).toLowerCase(), kort(st.kommentar), L.style(st), "Open style"), actor);
      if ((st.ecomBilder || "") !== p.e && st.ecomBilder === "Retuscherade") add(["jakob", "oliver"], item("12:" + st._id, "veta", "Images", "E-com images ready for " + st.namn, "Retouched" + (actorName(actor) ? " by " + actorName(actor) : ""), L.ecom, "Open E-com"), actor);
    }
    /* --- samples --- */
    for (const sm of docs.samples || []) {
      const p = prev.samples[sm._id]; const actor = actorOf(sm, since);
      if (!p) { add(["carl"], item("16:" + sm._id, "veta", "Sample", sampleLabel(sm) + " ordered" + (sm.leverantor ? " from " + sm.leverantor : ""), [en(sm.version), expected(sm) ? "expected " + fmtDate(expected(sm)) : ""].filter(Boolean).join(" · "), L.sample(sm), "Open sample"), actor); continue; }
      if (sm.status !== p.s && sm.status === "Problem") add(["carl"], item("C:" + sm._id + ":" + today, "gora", "Problem", sampleLabel(sm) + ": problem", kort(sm.kommentar) || "No problem described yet", L.sample(sm), "Open sample"), actor);
      if (p.s === "Problem" && (sm.status !== "Problem" || hash(sm.kommentar) !== p.k)) add(["alex"], item("B:" + sm._id + ":" + today, "veta", "Reply", (actorName(actor) || "Someone") + " replied to the problem on " + sm._id + " " + styleName(sm.styleId), kort(sm.kommentar) + (sm.status !== "Problem" ? " · new status: " + en(sm.status) : ""), L.sample(sm), "Open sample"), actor);
      if (sm.status !== p.s && sm.status === "Skickad") add(["alex", "carl"], item("17:" + sm._id, "veta", "Sample", sampleLabel(sm) + " shipped from " + (sm.leverantor || "the supplier"), expected(sm) ? "expected " + fmtDate(expected(sm)) : "", L.sample(sm), "Open sample"), actor);
      const mNow = sm.mattGodkanda == null || sm.mattGodkanda === "" ? 0 : 1;
      if (mNow && !p.m && sm.status === "Mottagen") { const it = (b) => item("9:" + sm._id, b, "Sample", sampleLabel(sm) + " received and measured" + (b === "gora" ? " – decision?" : ""), [en(sm.version), sm.leverantor].filter(Boolean).join(" · "), L.sample(sm), "Open sample"); add(["carl"], it("gora"), actor); add(["jakob"], it("veta"), actor); }
      const b = beslutNorm(sm.beslut);
      if (b !== p.b && ["Ny runda", "Pausad", "Kastad"].includes(b)) add(["alex", "elliot"], item("18:" + sm._id + ":" + b, "veta", "Decision", styleName(sm.styleId) + ": " + en(b).toLowerCase(), kort(sm.kommentar) || sm._id, L.sample(sm), "Open sample"), actor);
      if (sm.status !== p.s && /fotosample/i.test(sm.version || "") && sm.status === "Mottagen") add(["oliver"], item("11s:" + sm._id, "gora", "Photo", "Photo sample " + styleName(sm.styleId) + (sm.farg ? " · " + fargText(sm.farg) : "") + " received", sm.hangare ? "Hanger " + sm.hangare : "", L.foto, "Open Photo"), actor);
    }
    /* --- po --- */
    for (const po of docs.po || []) {
      const p = prev.po[po._id]; const actor = actorOf(po, since); const s = poStatusNorm(po.status);
      if (!p) { if ((po.rader || []).some((r) => num(r.antal))) add(["alex", "jakob", "oliver"], item("19:" + po._id, "veta", "PO", (po.nr || po._id) + " draft: " + new Set((po.rader || []).map((r) => fargText(r.farg)).filter(Boolean)).size + " colours, " + (po.rader || []).reduce((a, r) => a + (num(r.antal) || 0), 0) + " pcs", poProducts(po) + (po.leverantor ? " · " + po.leverantor : ""), L.po(po), "Open PO"), actor); }
      else {
        if (s !== p.s) {
          if (s === "Inskickad") add(["jakob"], item("1:" + po._id, "veta", "PO", (po.nr || po._id) + " submitted", poSub(po), L.po(po), "Open PO"), actor);
          if (s === "PO bekräftad") add(["jakob", "alex"], item("2:" + po._id, "veta", "PO", (po.nr || po._id) + " confirmed" + (po.leverantor ? " by " + po.leverantor : ""), [poProducts(po), poSub(po)].filter(Boolean).join(" · "), L.po(po), "Open PO"), actor);
          if (s === "Problem") add(["jakob", "carl", "alex"], item("4:" + po._id + ":" + today, "gora", "PO", (po.nr || po._id) + ": problem", kort(po.kommentar) || poProducts(po), L.po(po), "Open PO"), actor);
          if (s === "Inlevererad") add("alla", item("5:" + po._id, "veta", "Delivery", (poProducts(po) || po.nr || po._id) + " delivered", [(po.nr || po._id), po.leverantor, (po.rader || []).reduce((a, r) => a + (num(r.antal) || 0), 0) + " pcs"].filter(Boolean).join(" · "), L.po(po), "Open PO"), actor);
        }
        const eta = poEta(po) || "";
        if (eta && p.eta && eta !== p.eta) {
          const diff = daysBetween(p.eta, eta);
          const it = item("eta:" + po._id + ":" + eta, "veta", "ETA", poLabel(po) + ": ETA warehouse " + fmtDate(p.eta) + " → " + fmtDate(eta) + " (" + (diff > 0 ? "+" : "") + diff + " d)", [po.leverantor, [po.sasong, reg.poDrops(po).join(" + ")].filter(Boolean).join(" ")].filter(Boolean).join(" · "), L.po(po), "Open PO");
          add(["jakob"], it, actor);
          if (Math.abs(diff) > 7) add(["carl", "alex"], it, actor);
        }
        const bex = iso(po.bekraftadEx) || "";
        if (bex && bex !== p.bex) add(["jakob", "alex", "elliot"], item("20:" + po._id + ":" + bex, "veta", "Ex-factory", (po.nr || po._id) + " ex-factory confirmed " + fmtDate(bex), [poProducts(po), po.leverantor].filter(Boolean).join(" · "), L.po(po), "Open PO"), actor);
        if (fotoPoNorm(po.fotosample) === "Inne" && p.f !== "Inne") add(["oliver"], item("11:" + po._id, "gora", "Photo", "Photo sample received: " + (poProducts(po) || po.nr || po._id), (po.nr || po._id) + (po.leverantor ? " · " + po.leverantor : ""), L.foto, "Open Photo"), actor);
        const q = (po.rader || []).reduce((a, r) => a + (num(r.antal) || 0), 0);
        if (q && !p.q && s === "Placeholder") add(["alex", "jakob", "oliver"], item("19:" + po._id, "veta", "PO", (po.nr || po._id) + " draft: " + new Set((po.rader || []).map((r) => fargText(r.farg)).filter(Boolean)).size + " colours, " + q + " pcs", poProducts(po) + (po.leverantor ? " · " + po.leverantor : ""), L.po(po), "Open PO"), actor);
      }
    }
    /* --- drops: lanseringen flyttad (i COO) och vad det gör med leveranserna --- */
    for (const d of reg.drops) {
      const p = prev.drops[d.key]; const l = d.lansering || "";
      if (!(p && p.l && l && l !== p.l)) continue;
      const name = [d.sasong, d.namn].filter(Boolean).join(" ");
      const diff = daysBetween(p.l, l);
      const pos = (docs.po || []).filter((po) => !["Avbruten", "Inlevererad"].includes(poStatusNorm(po.status)) && norm(po.sasong) === norm(d.sasong) && reg.poDrops(po).some((n) => norm(n) === norm(d.namn)));
      const rows = pos.map((po) => ({ po, eta: poEta(po) || iso(po.leveransOnskad) || null }));
      const sena = d.klart ? rows.filter((x) => x.eta && x.eta > d.klart) : [];
      const utanEta = rows.filter((x) => !x.eta).length;
      const sub = ["In stock by " + (d.eget ? "stays at " + fmtDate(d.klart) + " (the drop has its own date)" : "now " + fmtDate(d.klart)),
        sena.length ? sena.length + " PO will be late: " + sena.map((x) => (x.po.nr || x.po._id) + " (ETA " + fmtDate(x.eta) + ", " + daysBetween(d.klart, x.eta) + " d late)").join(", ") : pos.length ? "all " + pos.length + " PO are on time" : "no open PO in the drop",
        utanEta ? utanEta + " PO have no ETA" : ""].filter(Boolean).join(" · ");
      const it = item("14:" + d.key + ":" + l, sena.length ? "gora" : "veta", "Launch", name + ": launch moved " + fmtDate(p.l) + " → " + fmtDate(l) + " (" + (diff > 0 ? "+" : "") + diff + " d)", sub, L.coo, "Open Launches");
      add(["jakob", "oliver", "carl"].concat(sena.length ? ["elliot", "alex"] : []), it, actorOf(d.ev || d.doc, since));
    }
    /* --- @-omnämnanden (25) --- */
    for (const [coll, list] of [["samples", docs.samples], ["styles", docs.styles], ["po", docs.po], ["drops", docs.drops]]) {
      for (const d of list || []) {
        const text = TEXT_FIELDS.map((f) => d[f] || "").join("\n"); const now_ = mentions(text); const was = prev.text[coll + ":" + d._id] || {};
        for (const [k, n] of Object.entries(now_)) if (n > (was[k] || 0)) {
          const actor = actorOf(d, since);
          const ref = coll === "samples" ? d._id + " " + styleName(d.styleId) : coll === "styles" ? d.namn : coll === "po" ? d.nr || d._id : [d.sasong, d.namn].join(" ");
          const link = coll === "samples" ? L.sample(d) : coll === "styles" ? L.style(d) : coll === "po" ? L.po(d) : L.coo;
          add([k], item("25:" + coll + ":" + d._id + ":" + n, "veta", "@", (actorName(actor) || "Someone") + " mentioned you on " + ref, "”" + mentionSnippet(text, k) + "”", link, "Open"), actor);
        }
      }
    }
  }

  /* --- flaggor: nya som inte redan gått som direktmejl, och lösta tillbaka till den som flaggade --- */
  if (prev) {
    const pf = prev.flags || {};
    const fLink = (f) => (f.typ === "sample" ? "#" + f.ref : f.typ === "po" ? "#po:" + f.ref : f.typ === "style" ? "#" + f.ref : f.typ === "handelse" ? "#" + f.ref : "#" + (f.tab || "samples"));
    for (const f of docs.flaggor || []) {
      const known = f._id in pf;
      if (f.status !== "Löst" && !known && !f.mejlad) add((f.till || []).filter((k) => KANDA.includes(k)), item("F:" + f._id, "gora", "Flag", (f.avNamn || actorName(f.av) || "Someone") + " flagged " + (f.titel || f.ref), "“" + kort(f.text, 200) + "”", fLink(f), "Open"), f.av);
      if (f.status === "Löst" && known && !pf[f._id] && actorKey(f.av)) add([actorKey(f.av)], item("FL:" + f._id, "veta", "Flag", "Resolved: " + (f.titel || f.ref) + (f.lostNamn ? " – " + f.lostNamn : ""), kort(f.lostText) || kort(f.text), fLink(f), "Open"), f.lostAv);
    }
  }

  /* --- försenad leverans: ETA lager efter droppens "I lager senast" -> alla, en gång per PO och datumpar --- */
  for (const po of docs.po || []) {
    if (["Avbruten", "Inlevererad"].includes(poStatusNorm(po.status))) continue;
    const eta = poEta(po); if (!eta) continue;
    const d = reg.drops.filter((x) => norm(x.sasong) === norm(po.sasong) && x.klart && reg.poDrops(po).some((n) => norm(n) === norm(x.namn))).sort((a, b) => a.klart.localeCompare(b.klart))[0];
    if (!d || eta <= d.klart) continue;
    const key = "sen:" + po._id + ":" + eta + ":" + d.klart;
    if (once(key)) add("alla", item(key, "gora", "Late PO", (po.nr || po._id) + " is late: ETA warehouse " + fmtDate(eta) + ", " + daysBetween(d.klart, eta) + " days after in-stock deadline " + fmtDate(d.klart), [po.leverantor, [d.sasong, d.namn].filter(Boolean).join(" "), poProducts(po)].filter(Boolean).join(" · "), L.po(po), "Open PO"));
  }

  /* --- tidsbaserade (körs även första gången) --- */
  const committed = new Set(); for (const po of docs.po || []) if (!PO_DRAFT.includes(poStatusNorm(po.status))) for (const r of po.rader || []) if (r.styleId) committed.add(r.styleId);
  for (const st of docs.styles || []) {
    const s = styleStatusNorm(st.status);
    if (s === "Godkänd") { const k = "godk:" + st._id; seen[k] = seen[k] || today; if (!committed.has(st._id) && daysBetween(seen[k], today) >= 7 && once("7:" + st._id)) add(["elliot", "carl", "jakob", "alex"], item("7:" + st._id, "gora", "No PO", st.namn + " approved " + fmtDate(seen[k]) + " – no PO yet", [st.sasong, st.drop, st.leverantor].filter(Boolean).join(" · "), L.style(st), "Open style")); }
    else delete seen["godk:" + st._id];
  }
  for (const sm of docs.samples || []) {
    const e = expected(sm);
    if (["Beställd", "Skickad"].includes(sm.status) && e && e < today && once("8:" + sm._id + ":" + e)) add(["alex", "jakob", "carl"], item("8:" + sm._id + ":" + e, "gora", "Late sample", sampleLabel(sm) + " – was expected " + fmtDate(e), [sm.leverantor, en(sm.version), iso(sm.bestalld) ? "ordered " + fmtDate(sm.bestalld) : ""].filter(Boolean).join(" · "), L.sample(sm), "Open sample"));
    const pk = "prob:" + sm._id;
    if (sm.status === "Problem") { seen[pk] = seen[pk] || today; if (daysBetween(seen[pk], today) >= 2 && once("10:" + sm._id + ":" + seen[pk])) add(["carl", "alex", "jakob"], item("10:" + sm._id, "gora", "Decision", sampleLabel(sm) + " has been waiting for a decision for " + daysBetween(seen[pk], today) + " days", "Problem: " + (kort(sm.kommentar) || "–"), L.sample(sm), "Open sample")); }
    else delete seen[pk];
  }
  const live = (st) => !st.grund && !IDEA_STATUS.includes(styleStatusNorm(st.status)) && !["Kastad", "Pausad"].includes(styleStatusNorm(st.status));
  const done = (st) => ECOM_CHECKS.every((k) => !!st[k]) && SHOT.includes(st.ecomBilder || "");
  for (const d of reg.drops) {
    const l = d.lansering; const members = (docs.styles || []).filter((st) => live(st) && dropKey(st.sasong, st.drop) === d.key);
    const name = [d.sasong, d.namn].filter(Boolean).join(" ");
    if (!l || !members.length) continue;
    const left = daysBetween(today, l);
    if (left >= 0 && left <= 14) {
      const notDone = members.filter((st) => !done(st));
      if (notDone.length && once("13:" + d.key + ":" + l)) {
        const noImg = notDone.filter((st) => !SHOT.includes(st.ecomBilder || "")).length, noText = notDone.filter((st) => !st.ecomBeskrivning).length, noShop = notDone.filter((st) => !st.ecomShopify).length;
        add(["jakob", "oliver", "carl"], item("13:" + d.key, "gora", "Launch", name + " in " + left + " days – the checklist is not done", [noImg ? noImg + " without e-com images" : "", noText ? noText + " without product text" : "", noShop ? noShop + " not in Shopify" : "", "launch " + fmtDate(l)].filter(Boolean).join(" · "), L.ecom, "Open E-com"));
      }
    }
    if (left > 14 && left <= 42) {
      const noKamp = members.filter((st) => (st.typ || "Nyhet") === "Nyhet" && !iso(st.kampanjDatum));
      if (noKamp.length && once("22:" + d.key + ":" + l)) add(["oliver", "jakob"], item("22:" + d.key, "gora", "Photo", "Campaign shoot for " + name + " is not booked", "Launch " + fmtDate(l) + " – " + Math.round(left / 7) + " weeks left · " + noKamp.length + " new styles without a campaign date", L.foto, "Open Photo"));
    }
    const allDone = members.every(done); const dk = "klar:" + d.key;
    if (allDone && !seen[dk]) { seen[dk] = today; if (prev) add(["jakob", "oliver"], item("23:" + d.key, "veta", "Drop", name + ": " + members.length + " of " + members.length + " ready for launch", "Launch " + fmtDate(l), L.ecom, "Open E-com")); }
    if (!allDone) delete seen[dk];
    if (prev && l > lastDay && l <= today && once("24:" + d.key + ":" + l)) add("alla", item("24:" + d.key, "veta", "Launch", name + " live today – " + members.length + " products", "", L.coo, "Open Launches"));
  }
  const money = makeMoney(docs, settings);
  for (const po of docs.po || []) for (const pay of money.plan(po)) {
    if (pay.betald || !pay.datum) continue;
    const left = daysBetween(today, pay.datum);
    if (left >= 0 && left <= 7 && once("15:" + po._id + ":" + pay.idx + ":" + pay.datum)) add(["elliot"], item("15:" + po._id + ":" + pay.idx, "gora", "Payment", (po.leverantor || "Supplier") + ": " + (pay.valuta !== "SEK" ? fmtCur(pay.beloppValuta, pay.valuta) + " (≈ " + fmtTkr(pay.belopp) + ")" : fmtTkr(pay.belopp)) + " due " + fmtDate(pay.datum), [(po.nr || po._id), en(pay.typ)].filter(Boolean).join(" · "), L.lev, "Open Suppliers"));
  }

  // städa gamla engångsnycklar (äldre än 120 dagar)
  for (const [k, d] of Object.entries(sent)) if (daysBetween(d, today) > 120) delete sent[k];
  // många försenade samples på en gång blir en rad i stället för en vägg
  for (const k of Object.keys(perPerson)) {
    const late = perPerson[k].filter((x) => x.tag === "Late sample");
    if (late.length > 3) {
      const names = late.map((x) => x.text.split(" – ")[0]);
      const grp = item("8g:" + today, "gora", "Late sample", late.length + " samples are late", names.slice(0, 8).join(" · ") + (names.length > 8 ? " and more" : ""), "#samples", "Open Samples");
      perPerson[k] = perPerson[k].filter((x) => x.tag !== "Late sample").concat([grp]);
    }
  }
  for (const k of Object.keys(perPerson)) perPerson[k].sort((a, b) => (a.block === b.block ? 0 : a.block === "gora" ? -1 : 1));
  return { perPerson, state: { lastRun: now.toISOString(), snap: snapshot(docs, settings), sent, seen } };
}

/* ---------- mejlet ---------- */
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function renderMail({ name, items, base, intro }) {
  const INK = "#212121", PAPER = "#F8F7F0", LINE = "#E0E0DB", MUTED = "#6b6b68";
  const LBL = "'Mars Extended','Helvetica Neue',Helvetica,Arial,sans-serif", TXT = "'Bembo Book MT Pro',Georgia,'Times New Roman',serif", DISP = "'Vogue','Bembo Book MT Pro',Georgia,serif";
  const gora = items.filter((x) => x.block === "gora"), veta = items.filter((x) => x.block !== "gora");
  const row = (x) => `<tr><td style="padding:12px 0;border-top:1px solid ${LINE};vertical-align:top;width:96px"><span style="display:inline-block;font:400 9.5px ${LBL};letter-spacing:.08em;text-transform:uppercase;border:1px solid ${INK};padding:3px 7px;color:${INK}">${esc(x.tag)}</span></td>
<td style="padding:12px;border-top:1px solid ${LINE};font:16px/1.4 ${TXT};color:${INK}">${esc(x.text)}${x.sub ? `<div style="font:14px/1.4 ${TXT};color:${MUTED};margin-top:2px">${esc(x.sub)}</div>` : ""}</td>
<td style="padding:13px 0;border-top:1px solid ${LINE};text-align:right;vertical-align:top;white-space:nowrap"><a href="${esc(base + "/" + x.link)}" style="font:400 10px ${LBL};letter-spacing:.1em;text-transform:uppercase;color:${INK};text-decoration:underline">${esc(x.linkText)} →</a></td></tr>`;
  const section = (title, list) => (list.length ? `<tr><td colspan="3" style="padding:26px 0 6px;font:400 10px ${LBL};letter-spacing:.14em;text-transform:uppercase;color:${INK}">${title}</td></tr>` + list.map(row).join("") : "");
  const subject = "PLM: " + [gora.length ? gora.length + " to do" : "", veta.length ? veta.length + " to know" : ""].filter(Boolean).join(", ");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@font-face{font-family:"Vogue";src:url("${base}/mail/vogue.woff2") format("woff2")}@font-face{font-family:"Bembo Book MT Pro";src:url("${base}/mail/bembo-book.woff2") format("woff2")}@font-face{font-family:"Mars Extended";src:url("${base}/mail/mars-extended.woff2") format("woff2")}</style></head>
<body style="margin:0;background:#eceae3"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eceae3"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background:${PAPER};max-width:640px;width:100%;border:1px solid ${LINE}">
<tr><td style="padding:26px 34px 18px;border-bottom:1px solid ${INK}"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding-right:14px"><img src="${base}/mail/logo.png" width="30" height="30" alt="Rubato" style="display:block"></td><td style="font:400 16px ${LBL};letter-spacing:.32em;text-transform:uppercase;color:${INK}">Rubato</td></tr></table>
<div style="font:400 30px/1.1 ${DISP};color:${INK};margin-top:18px">Samples <span style="color:${MUTED}">&amp; production</span></div></td></tr>
<tr><td style="padding:24px 34px 4px"><div style="font:400 24px/1.2 ${DISP};color:${INK}">${intro ? "Hi" : "Good morning"} ${esc(name)}</div>
<div style="font:16px/1.5 ${TXT};color:${MUTED};margin-top:6px">${esc(intro || "This is what has happened in PLM since yesterday that concerns you.")}</div></td></tr>
<tr><td style="padding:0 34px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${section(intro ? "Flagged" : "To do", gora)}${section("To know", veta)}</table></td></tr>
<tr><td style="padding:20px 34px 30px"><a href="${esc(base)}" style="display:inline-block;background:${INK};color:${PAPER};font:400 11px ${LBL};letter-spacing:.14em;text-transform:uppercase;padding:13px 20px;text-decoration:none">Open PLM</a>
<div style="font:13px/1.5 ${TXT};color:${MUTED};margin-top:18px">${intro ? "Sent because someone flagged this for you." : "A summary of what has happened since 10:00 yesterday."} Decisions and comments are written in PLM – do not reply to this email.</div></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

module.exports = { compute, renderMail, personKey, NAMN, PERSONER, snapshot, register };
