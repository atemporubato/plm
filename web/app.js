import * as P from "./platform.js";
(() => {
  "use strict";
  const APP_URL = location.origin + location.pathname;
  const LIB_PDF = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
  const LIB_QR = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
  const $ = (id) => document.getElementById(id);
  const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

  const SAMPLE_STATUS = ["Beställd", "Skickad", "Mottagen", "Problem", "Returnerad"];
  const WAITING = ["Beställd", "Skickad"];
  const ACTIVE = ["Beställd", "Skickad", "Problem"];
  const VERSIONS = ["Proto 1", "Proto 2", "Proto 3", "Proto 4", "Proto 5", "Fotosample", "Produktionssample", "Storleksset"];
  const PLATSER = ["Hängare", "På plåtning", "Testas", "Utlånad", "Gåva", "Såld", "Hos leverantör", "Arkiv"];
  const BESLUT = ["Godkänd", "Ny runda", "Underkänd"];
  const STYLE_STATUS = ["Sampling", "Godkänd", "PO lagd", "Levererad", "Skippad"];
  const STYLE_TYP = ["Nyhet", "Restock"];
  const TYG_STATUS = ["OK", "Delvis slut", "Slut", "Utgått"];
  const LAGER_STATUS = ["I lager", "Beställd", "Förbrukad"];
  const EGET_LAGER = "Rubato (eget lager)";
  const EAN_OK_STATUS = ["Godkänd", "PO lagd", "Levererad"];
  const SIZE_PRESETS = [["XS–XXL", "XS, S, M, L, XL, XXL"], ["S–XL", "S, M, L, XL"], ["44–56", "44, 46, 48, 50, 52, 54, 56"], ["46–56", "46, 48, 50, 52, 54, 56"], ["Midja 28–38", "28, 29, 30, 31, 32, 33, 34, 36, 38"], ["One size", "One size"]];
  const LAGE_TEXT = { gron: "I fas", gul: "Snävt", rod: "Hinner inte", okand: "Datum saknas", ingen: "Sätt datum", skip: "Skippad" };
  const LAGE_ORDER = { rod: 0, gul: 1, okand: 2, gron: 3, ingen: 4, klar: 5, skip: 6 };

  // ---------- DOM helpers ----------
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "dataset") Object.assign(e.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (typeof v !== "string" && k in e) e[k] = v;
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    for (const k of kids.flat(2)) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
    return e;
  }
  function inp(id, value, attrs) { const e = h("input", Object.assign({ id, type: "text" }, attrs || {})); e.value = value == null ? "" : String(value); return e; }
  function area(id, value, placeholder) { const e = h("textarea", { id, placeholder: placeholder || null }); e.value = value == null ? "" : String(value); return e; }
  function selectEl(id, options, value) {
    const e = h("select", { id });
    for (const o of options) { const [v, l] = Array.isArray(o) ? o : [o, o]; e.add(new Option(l, v)); }
    const val = value == null ? "" : String(value);
    const has = [...e.options].some((o) => o.value === val);
    if (!has && val !== "") e.add(new Option(val, val));
    e.value = has || val !== "" ? val : (e.options[0] ? e.options[0].value : "");
    return e;
  }
  function field(label, control, opts) {
    opts = opts || {};
    return h("div", { class: "field" + (opts.full ? " full" : "") }, h("label", { for: control.id, text: label }), control, opts.hint ? h("span", { class: "hint", text: opts.hint }) : null);
  }
  const td = (label, cls, ...kids) => h("td", { class: cls || null, "data-label": label || null }, ...kids);
  const tag = (id) => h("span", { class: "tag", text: id });
  const chip = (t, cls) => h("span", { class: "chip " + (cls || ""), text: t });
  const statusPill = (s) => h("span", { class: "pill s-" + (s || "x"), text: s || "–" });
  const lagePill = (p) => h("span", { class: "lage l-" + p.lage, text: p.lage === "klar" ? p.label : (LAGE_TEXT[p.lage] || p.label) });
  function table(cols) {
    const t = h("table", { class: "ledger" });
    t.append(h("thead", null, h("tr", null, cols.map(([l, c]) => h("th", { class: c || null, text: l })))));
    const tb = h("tbody"); t.append(tb);
    return { t, tb };
  }

  // ---------- small utils ----------
  const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
  const slug = (s) => norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "sv"));
  const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
  const parseList = (v) => { const seen = new Set(); return String(v || "").split(",").map((x) => x.trim()).filter((x) => { const k = x.toLowerCase(); if (!x || seen.has(k)) return false; seen.add(k); return true; }); };
  const vkey = (v) => (String(v.farg) + "|" + String(v.storlek)).toLowerCase();
  const variants = (farger, storlekar) => { const out = []; for (const f of farger) for (const s of storlekar) out.push({ farg: f, storlek: s }); return out; };
  function ean13(base12) { let sum = 0; for (let i = 0; i < 12; i++) sum += Number(base12[i]) * (i % 2 ? 3 : 1); return base12 + ((10 - (sum % 10)) % 10); }

  // ---------- dates ----------
  const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const isISO = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const toUTC = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const addDays = (iso, n) => new Date(toUTC(iso) + n * 864e5).toISOString().slice(0, 10);
  const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5);
  const diffDays = (iso) => daysBetween(todayISO(), iso);
  const fmtDate = (iso) => { if (!isISO(iso)) return ""; const [y, m, d] = iso.split("-").map(Number); return d + " " + MONTHS[m - 1] + (y !== new Date().getFullYear() ? " " + String(y).slice(2) : ""); };
  const fmtDays = (n) => (n < 0 ? (-n) + " d sen" : n === 0 ? "idag" : n + " d kvar");

  // ---------- state ----------
  const D = { samples: [], styles: [], tyger: [], lager: [], lev: [], pool: null, logg: [], settings: { utvarderingDagar: 7, standardFrakt: 7, marginalGul: 14 } };
  const loaded = new Set();
  let db = null, user = null, downloads = null, myId = null, canWrite = true, canAdmin = false;
  const UI = {
    tab: "samples",
    samples: { view: null, status: "aktiva", q: "", lev: "", season: "", plats: "", group: "style" },
    styles: { view: null, status: "aktiva", q: "", lev: "", season: "" },
    tyger: { q: "", status: "" },
    lager: { view: null, status: "I lager", q: "", plats: "", group: "plats" },
    ean: { q: "" }
  };
  const selected = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem("rubato-samples-v2") || "null");
    if (saved) {
      if (saved.tab) UI.tab = saved.tab;
      if (saved.samples) Object.assign(UI.samples, saved.samples, { view: null, q: "" });
      if (saved.styles) Object.assign(UI.styles, saved.styles, { view: null, q: "" });
      if (saved.lager) Object.assign(UI.lager, saved.lager, { view: null, q: "" });
    }
  } catch (e) {}
  function persist() {
    try { localStorage.setItem("rubato-samples-v2", JSON.stringify({ tab: UI.tab, samples: { status: UI.samples.status, group: UI.samples.group, lev: UI.samples.lev, season: UI.samples.season, plats: UI.samples.plats }, styles: { status: UI.styles.status, lev: UI.styles.lev, season: UI.styles.season }, lager: { status: UI.lager.status, plats: UI.lager.plats, group: UI.lager.group } })); } catch (e) {}
  }

  // ---------- lookups ----------
  const byId = (arr, id) => (id ? arr.find((x) => x._id === id) || null : null);
  const levByName = (name) => D.lev.find((l) => norm(l.namn) === norm(name)) || null;
  const levNum = (name, f) => { const l = levByName(name); return l ? num(l[f]) : null; };
  const fraktFor = (name) => { const v = levNum(name, "frakt"); return v == null ? (num(D.settings.standardFrakt) ?? 7) : v; };
  function actualLead(name) {
    const xs = D.samples.filter((s) => norm(s.leverantor) === norm(name) && isISO(s.bestalld) && isISO(s.mottagen)).map((s) => daysBetween(s.bestalld, s.mottagen)).filter((d) => d >= 0);
    return xs.length ? { avg: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), n: xs.length } : null;
  }
  const styleOf = (s) => (s ? byId(D.styles, s.styleId) : null);
  const styleName = (s) => { const st = styleOf(s); return st ? st.namn : (s.produkt || "Utan style"); };
  const tygOf = (s) => (s ? byId(D.tyger, s.tygId) : null);
  const tygName = (s) => { const t = tygOf(s); return t ? t.namn : (s.material || ""); };
  const seasonOf = (s) => { const st = styleOf(s); return (st && st.sasong) || s.sasong || ""; };
  const platsText = (s) => (!s.platsTyp ? "" : s.platsTyp === "Hängare" ? "Hängare " + (s.hangare || "?") : s.platsTyp);
  const versionRank = (v) => { const m = /^Proto (\d+)/.exec(v || ""); if (m) return Number(m[1]); return { Fotosample: 50, Produktionssample: 60, Storleksset: 70 }[v] ?? 99; };
  const nextVersion = (v) => { const m = /^Proto (\d+)/.exec(v || ""); return m ? "Proto " + (Number(m[1]) + 1) : (v || "Proto 1"); };
  function samplesOfStyle(id) {
    return D.samples.filter((s) => s.styleId === id).sort((a, b) => versionRank(a.version) - versionRank(b.version) || String(a.bestalld || "").localeCompare(String(b.bestalld || "")) || a._id.localeCompare(b._id));
  }
  const isActiveStyle = (st) => st.status === "Sampling" || st.status === "Godkänd";
  const fmtM = (n) => Number(n).toLocaleString("sv-SE", { maximumFractionDigits: 1 });
  const lotsOf = (tygId) => (tygId ? D.lager.filter((l) => l.tygId === tygId) : []);
  const lotName = (l) => { const t = tygOf(l); return t ? t.namn : (l.tygNamn || "Okänt tyg"); };
  const reservedName = (l) => { const st = l.reserveradFor ? byId(D.styles, l.reserveradFor) : null; return st ? st.namn : ""; };
  function stockSummary(tygId) {
    const lots = lotsOf(tygId).filter((l) => l.status === "I lager");
    const known = lots.filter((l) => num(l.meter) != null);
    return { lots, meter: known.reduce((a, l) => a + num(l.meter), 0), known: known.length, unknown: lots.length - known.length, platser: uniq(lots.map((l) => l.plats)), bestallda: lotsOf(tygId).filter((l) => l.status === "Beställd").length };
  }
  function stockText(tygId) {
    const s = stockSummary(tygId);
    if (!s.lots.length) return s.bestallda ? s.bestallda + (s.bestallda === 1 ? " parti beställt" : " partier beställda") : "";
    const parts = [];
    if (s.known) parts.push("ca " + fmtM(s.meter) + " m");
    if (s.unknown) parts.push(s.unknown + (s.unknown === 1 ? " parti utan meter" : " partier utan meter"));
    return parts.join(" + ") + (s.platser.length ? " · " + s.platser.join(", ") : "");
  }

  // ---------- sample logic ----------
  const expected = (s) => (isISO(s.forvantad) ? s.forvantad : isISO(s.bestalld) && num(s.ledtid) > 0 ? addDays(s.bestalld, num(s.ledtid)) : null);
  const isWaiting = (s) => WAITING.includes(s.status);
  const isLate = (s) => { const e = expected(s); return isWaiting(s) && !!e && diffDays(e) < 0; };
  const remindDue = (s) => { const e = expected(s); if (!isWaiting(s) || !e) return null; const d = diffDays(e); if (d <= 0 && !s.p2Skickad) return 2; if (d <= 7 && !s.p1Skickad) return 1; return null; };
  const toEvaluate = (s) => s.status === "Mottagen" && !s.utvarderad && !s.beslut;
  const needsPlace = (s) => s.status === "Mottagen" && !s.platsTyp;

  // ---------- style planning (backwards from "I lager senast") ----------
  function plan(st) {
    const r = { lage: "ingen", label: "", note: "", po: null, inne: null, best: null, ex: null, prod: null, frakt: null, buff: 0, utv: 7, sl: null, poDays: null };
    if (st.status === "Skippad") return Object.assign(r, { lage: "skip" });
    if (st.status === "PO lagd" || st.status === "Levererad") return Object.assign(r, { lage: "klar", label: st.status });
    r.utv = num(D.settings.utvarderingDagar) ?? 7;
    r.frakt = fraktFor(st.leverantor);
    r.prod = levNum(st.leverantor, "produktionstid");
    r.buff = levNum(st.leverantor, "buffert") || 0;
    r.sl = levNum(st.leverantor, "sampleLedtid");
    if (!isISO(st.klartSenast)) return Object.assign(r, { note: "Sätt \"I lager senast\" för att få en tidsplan." });
    if (r.prod == null) return Object.assign(r, { lage: "okand", note: "Produktionstid saknas för " + (st.leverantor || "leverantören") + "." });
    r.ex = addDays(st.klartSenast, -r.frakt);
    r.po = addDays(r.ex, -(r.prod + r.buff));
    r.inne = addDays(r.po, -r.utv);
    r.best = r.sl != null ? addDays(r.inne, -r.sl) : null;
    r.poDays = diffDays(r.po);
    const gul = num(D.settings.marginalGul) ?? 14;
    const grade = (m) => (m < 0 ? "rod" : m < gul ? "gul" : "gron");
    const needsSample = st.status === "Sampling" && st.typ !== "Restock";
    const xs = st._id ? samplesOfStyle(st._id).filter((x) => x.beslut !== "Underkänd" && x.beslut !== "Ny runda" && x.status !== "Returnerad") : [];
    let lage;
    if (!needsSample || xs.some((x) => x.beslut === "Godkänd")) {
      lage = grade(r.poDays);
      r.note = r.poDays < 0 ? "PO-datumet " + fmtDate(r.po) + " har passerat." : "Lägg PO senast " + fmtDate(r.po) + ".";
    } else if (!xs.length) {
      const ref = r.best || r.inne; const m = diffDays(ref);
      lage = grade(m);
      r.note = (r.best ? "Ingen sample ännu. Beställ senast " + fmtDate(r.best) : "Ingen sample ännu. Den behövs senast " + fmtDate(r.inne)) + ".";
    } else {
      let arrival = null;
      for (const x of xs) {
        const a = x.status === "Mottagen" ? todayISO() : expected(x);
        if (a && (!arrival || a < arrival)) arrival = a;
      }
      if (!arrival) { lage = "okand"; r.note = "Ingen sample har leveransdatum. Den behövs senast " + fmtDate(r.inne) + "."; }
      else {
        const m = daysBetween(arrival, r.inne);
        lage = grade(m);
        r.note = (arrival === todayISO() ? "Sample inne" : "Sample väntas " + fmtDate(arrival)) + ", behövs senast " + fmtDate(r.inne) + ".";
      }
      const pg = grade(r.poDays);
      const sev = { gron: 0, okand: 1, gul: 2, rod: 3 };
      if (sev[pg] > sev[lage]) lage = pg;
    }
    return Object.assign(r, { lage });
  }
  function eanMissing(st) {
    const vs = variants(st.farger || [], st.storlekar || []);
    if (!vs.length) return true;
    const have = new Set((st.ean || []).map(vkey));
    return vs.some((v) => !have.has(vkey(v)));
  }

  // ---------- feedback ----------
  let toastT;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200); }
  function banner(msg) { const b = $("banner"); b.textContent = msg; b.hidden = !msg; }

  // ---------- writes ----------
  const chains = new Map();
  function serial(key, fn) { const prev = chains.get(key) || Promise.resolve(); const next = prev.catch(() => {}).then(fn); chains.set(key, next); return next; }
  function writeError(e) {
    const code = e && e.code;
    if (code === "invalid_argument") { canWrite = false; applyWriteMode(); toast("Du har bara läsbehörighet här."); }
    else if (code === "quota_exceeded") toast("Databasen är full. Ta bort gamla poster och försök igen.");
    else toast("Kunde inte spara. Försök igen om en stund.");
  }
  async function write(coll, id, patch) {
    if (!db) { toast("Databasen är inte tillgänglig i den här vyn."); return false; }
    try { await serial(coll + "/" + id, () => db.collection(coll).doc(id).update(patch)); return true; } catch (e) { writeError(e); return false; }
  }
  async function create(coll, id, body) {
    if (!db) { toast("Databasen är inte tillgänglig i den här vyn."); return false; }
    try { await serial(coll + "/" + id, () => db.collection(coll).doc(id).set(body)); return true; } catch (e) { writeError(e); return false; }
  }
  async function remove(coll, id) {
    try { await serial(coll + "/" + id, () => db.collection(coll).doc(id).delete()); return true; } catch (e) { writeError(e); return false; }
  }
  async function freshId(coll, arr, prefix, width) {
    let n = arr.reduce((m, x) => { const k = parseInt(String(x._id).replace(/\D/g, ""), 10); return isNaN(k) ? m : Math.max(m, k); }, 0) + 1;
    for (let i = 0; i < 8; i++, n++) {
      const id = prefix + String(n).padStart(width, "0");
      try { const snap = await db.collection(coll).doc(id).get(); if (!snap.exists) return id; } catch (e) { return id; }
    }
    return prefix + String(n).padStart(width, "0");
  }
  const logEntry = (text) => ({ t: new Date().toISOString(), av: myId, text });
  function showVal(k, v) {
    if (v == null) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (k === "styleId" || k === "reserveradFor") { const st = byId(D.styles, v); return st ? st.namn : String(v); }
    if (k === "tygId") { const t = byId(D.tyger, v); return t ? t.namn : String(v); }
    if (isISO(v)) return fmtDate(v);
    return String(v);
  }
  function describeChanges(before, after, labels) {
    const out = [];
    for (const k of Object.keys(after)) {
      if (!(k in labels)) continue;
      const a = showVal(k, before[k]), b = showVal(k, after[k]);
      if (a === b) continue;
      if (k === "status") out.push("Status: " + (a || "–") + " → " + (b || "–"));
      else if (k === "kommentar" || k === "andringar") out.push(labels[k] + " ändrad");
      else if (k === "utvarderad") out.push(after[k] ? "Markerad utvärderad" : "Utvärdering borttagen");
      else out.push(labels[k] + ": " + (b || "tom"));
    }
    return out;
  }
  async function renderLogInto(ul, items) {
    const list = (items || []).slice().reverse();
    if (!list.length) { ul.replaceChildren(h("li", { class: "sub", text: "Inga händelser ännu." })); return; }
    const ids = [...new Set(list.map((i) => i.av).filter(Boolean))];
    let ps = {};
    try { if (user && ids.length) ps = await user.profiles(ids); } catch (e) {}
    ul.replaceChildren(...list.map((i) => {
      const d = new Date(i.t);
      const when = isNaN(d) ? "" : d.getDate() + " " + MONTHS[d.getMonth()] + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      const who = i.av ? ((ps[i.av] && ps[i.av].name) || "Någon i teamet") : "Import";
      return h("li", null, h("time", { text: when }), h("div", null, h("div", { text: i.text || "" }), h("div", { class: "who", text: who })));
    }));
  }

  // ---------- strip / seg / filter widgets ----------
  function makeStrip(defs, state, onChange) {
    const el = h("section", { class: "strip", "aria-label": "Lägesbild" });
    el.style.setProperty("--cols", String(defs.length));
    const parts = {};
    for (const d of defs) {
      const n = h("span", { class: "n mono", text: "–" });
      const b = h("button", { class: "tile " + (d.cls || ""), type: "button", onclick: () => { state.view = state.view === d.key ? null : d.key; onChange(); } }, n, h("span", { class: "l", text: d.label }));
      parts[d.key] = { n, b }; el.append(b);
    }
    return { el, set(counts) { for (const d of defs) { const v = counts[d.key] || 0; parts[d.key].n.textContent = String(v); parts[d.key].n.classList.toggle("zero", !v); parts[d.key].b.setAttribute("aria-pressed", String(state.view === d.key)); } } };
  }
  function makeSeg(options, state, key, onChange) {
    const el = h("div", { class: "seg", role: "group", "aria-label": "Status" });
    const btns = options.map(([v, l]) => h("button", { type: "button", text: l, onclick: () => { state[key] = v; state.view = null; sync(); onChange(); } }));
    btns.forEach((b, i) => (b.dataset.v = options[i][0]));
    function sync() { btns.forEach((b) => b.setAttribute("aria-pressed", String(!state.view && b.dataset.v === state[key]))); }
    el.append(...btns); sync();
    return { el, sync };
  }
  function filterSelect(id, first, state, key, onChange) {
    const s = h("select", { id, "aria-label": first, onchange: () => { state[key] = s.value; onChange(); } });
    s.add(new Option(first, ""));
    return { el: s, fill(items) {
      if (!items.length) return;
      const cur = state[key];
      s.replaceChildren(new Option(first, ""));
      items.forEach((v) => s.add(new Option(v, v)));
      if (items.includes(cur)) s.value = cur; else { s.value = ""; state[key] = ""; }
    } };
  }
  function searchBox(id, placeholder, state, onChange) {
    const q = h("input", { type: "search", id, placeholder, "aria-label": placeholder, oninput: () => { state.q = q.value; onChange(); } });
    q.value = state.q || "";
    return q;
  }

  // ---------- SAMPLES ----------
  const SamplesView = {
    mount(root) {
      const st = UI.samples;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "waiting", label: "Väntar på leverans" },
        { key: "late", label: "Försenade", cls: "t-late" },
        { key: "problem", label: "Problem", cls: "t-late" },
        { key: "remind", label: "Påminn nu", cls: "t-warn" },
        { key: "evaluate", label: "Att utvärdera" },
        { key: "place", label: "Saknar plats" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_samples", "Sök style, tyg, färg, ID, hängare …", st, () => this.update());
      this.fLev = filterSelect("f_s_lev", "Alla leverantörer", st, "lev", upd);
      this.fSeason = filterSelect("f_s_season", "Alla säsonger", st, "season", upd);
      this.fPlats = filterSelect("f_s_plats", "Alla platser", st, "plats", upd);
      this.seg = makeSeg([["aktiva", "Aktiva"], ["Beställd", "Beställd"], ["Skickad", "Skickad"], ["Problem", "Problem"], ["Mottagen", "Mottagen"], ["alla", "Alla"]], st, "status", upd);
      const grp = selectEl("f_s_group", [["style", "Gruppera per style"], ["lev", "Gruppera per leverantör"], ["none", "Ingen gruppering"]], st.group);
      grp.addEventListener("change", () => { st.group = grp.value; upd(); });
      this.count = h("span", { class: "count" });
      this.selCount = h("span");
      this.tray = h("div", { class: "tray", hidden: true }, this.selCount,
        h("button", { class: "btn small primary", type: "button", text: "Skriv ut etiketter", onclick: () => openLabels([...selected]) }),
        h("button", { class: "btn small", type: "button", text: "Rensa val", onclick: () => { selected.clear(); this.update(); } }));
      const { t, tb } = table([["", "c-check"], ["ID"], ["Style"], ["Leverantör"], ["Färg"], ["Plats"], ["Förväntad"], ["Status"], ["Kommentar"]]);
      this.tb = tb;
      this.allBox = h("input", { type: "checkbox", "aria-label": "Välj alla synliga", onchange: () => { (this.visible || []).forEach((s) => (this.allBox.checked ? selected.add(s._id) : selected.delete(s._id))); this.update(); } });
      t.querySelector("th.c-check").append(this.allBox);
      this.empty = h("div", { class: "empty", hidden: true });
      tb.addEventListener("click", (e) => { if (e.target.closest("input, button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openSample(tr.dataset.id); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter" || e.target.closest("input, button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openSample(tr.dataset.id); });
      root.append(this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fLev.el, this.fSeason.el, this.fPlats.el, this.seg.el, grp, this.count), this.tray, h("section", { class: "ledger-wrap" }, t, this.empty));
    },
    filtered() {
      const st = UI.samples, q = norm(st.q);
      return D.samples.filter((s) => {
        switch (st.view) {
          case "waiting": if (!isWaiting(s)) return false; break;
          case "late": if (!isLate(s)) return false; break;
          case "problem": if (s.status !== "Problem") return false; break;
          case "remind": if (!remindDue(s)) return false; break;
          case "evaluate": if (!toEvaluate(s)) return false; break;
          case "place": if (!needsPlace(s)) return false; break;
          default:
            if (st.status === "aktiva" && !ACTIVE.includes(s.status)) return false;
            if (st.status !== "aktiva" && st.status !== "alla" && s.status !== st.status) return false;
        }
        if (st.lev && s.leverantor !== st.lev) return false;
        if (st.season && seasonOf(s) !== st.season) return false;
        if (st.plats && s.platsTyp !== st.plats) return false;
        if (q && ![s._id, styleName(s), s.version, tygName(s), s.farg, s.leverantor, s.kommentar, platsText(s), s.tracking, s.storlek].join(" ").toLowerCase().includes(q)) return false;
        return true;
      });
    },
    update() {
      const st = UI.samples;
      this.strip.set({ waiting: D.samples.filter(isWaiting).length, late: D.samples.filter(isLate).length, problem: D.samples.filter((s) => s.status === "Problem").length, remind: D.samples.filter((s) => remindDue(s)).length, evaluate: D.samples.filter(toEvaluate).length, place: D.samples.filter(needsPlace).length });
      this.seg.sync();
      this.fLev.fill(uniq(D.samples.map((s) => s.leverantor)));
      this.fSeason.fill(uniq(D.samples.map(seasonOf)));
      this.fPlats.fill(PLATSER);
      const list = this.filtered();
      const keyOf = st.group === "style" ? (s) => styleName(s) + " · " + (s.leverantor || "") : st.group === "lev" ? (s) => s.leverantor || "Utan leverantör" : () => "";
      list.sort((a, b) => keyOf(a).localeCompare(keyOf(b), "sv") || versionRank(a.version) - versionRank(b.version) || (expected(a) || "9999").localeCompare(expected(b) || "9999") || a._id.localeCompare(b._id));
      this.visible = list;
      const rows = [];
      let last = null;
      for (const s of list) {
        const k = keyOf(s);
        if (st.group !== "none" && k !== last) {
          last = k;
          const n = list.filter((x) => keyOf(x) === k).length;
          const cell = h("td", { colSpan: 9, text: k + " · " + n });
          if (st.group === "style" && s.styleId && byId(D.styles, s.styleId)) { const sid = s.styleId; cell.append(h("button", { class: "linkish", type: "button", text: "Öppna style", onclick: () => openStyle(sid) })); }
          rows.push(h("tr", { class: "group" }, cell));
        }
        rows.push(sampleRow(s));
      }
      this.tb.replaceChildren(...rows);
      this.empty.hidden = list.length > 0;
      if (!list.length) {
        this.empty.replaceChildren(...(!loaded.has("samples")
          ? [h("strong", { text: db ? "Laddar samples …" : "Inga samples att visa" }), h("span", { text: db ? "Listan fylls i så fort databasen svarar." : "Öppna sidan via länken i Claude." })]
          : D.samples.length ? [h("strong", { text: "Inget matchar filtret" }), h("span", { text: "Byt status, leverantör eller rensa sökningen." })]
          : [h("strong", { text: "Inga samples ännu" }), h("span", { text: "Lägg till den första med \"+ Ny sample\"." })]));
      }
      this.count.textContent = list.length + " av " + D.samples.length + " samples";
      this.tray.hidden = selected.size === 0;
      this.selCount.textContent = selected.size + (selected.size === 1 ? " vald" : " valda");
      this.allBox.checked = list.length > 0 && list.every((s) => selected.has(s._id));
    }
  };
  function expCell(s) {
    const out = []; const e = expected(s);
    if (s.status === "Mottagen") {
      out.push(h("div", { class: "mono", text: s.mottagen ? "mott. " + fmtDate(s.mottagen) : e ? fmtDate(e) : "mottagen" }));
      if (toEvaluate(s)) out.push(h("span", { class: "flag eval", text: "Utvärdera" }));
    } else if (e) {
      out.push(h("div", { class: "mono", text: fmtDate(e) }));
      if (isWaiting(s)) { const d = diffDays(e); out.push(h("div", { class: "days " + (d < 0 ? "late" : d <= 7 ? "soon" : ""), text: d < 0 ? (-d) + " d sen" : d === 0 ? "idag" : "om " + d + " d" })); }
      const r = remindDue(s); if (r) out.push(h("span", { class: "flag", text: "Påminnelse " + r }));
    } else out.push(h("div", { class: "mono muted", text: "TBA" }));
    return out;
  }
  function sampleRow(s) {
    const tr = h("tr", { tabIndex: 0, dataset: { id: s._id } });
    const box = h("input", { type: "checkbox", "aria-label": "Välj " + s._id, checked: selected.has(s._id), onchange: () => { if (box.checked) selected.add(s._id); else selected.delete(s._id); SamplesView.update(); } });
    const t = tygOf(s);
    const sub = h("div", { class: "sub" }, s.version ? chip(s.version) : null, tygName(s) ? h("span", { class: t && t.status === "Slut" ? "late-text" : null, text: tygName(s) + (t && t.status === "Slut" ? " (slut)" : "") }) : null);
    const pl = platsText(s);
    const stc = td("Status", "c-status", statusPill(s.status));
    if (s.beslut) stc.append(h("div", null, chip(s.beslut, "b-" + slug(s.beslut))));
    tr.append(
      td("Välj", "c-check", box),
      td("ID", "c-id", tag(s._id)),
      td("Style", "c-main", h("div", { class: "prod", text: styleName(s) }), sub),
      td("Leverantör", null, s.leverantor || ""),
      td("Färg", null, s.farg || ""),
      td("Plats", null, pl ? h("span", { class: "place", text: pl }) : needsPlace(s) ? h("span", { class: "flag", text: "Ange plats" }) : null),
      td("Förväntad", "c-exp", expCell(s)),
      stc,
      td("Kommentar", "note", s.kommentar || "")
    );
    return tr;
  }

  // ---------- STYLES ----------
  const StylesView = {
    mount(root) {
      const st = UI.styles;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "rod", label: "Hinner inte", cls: "t-late" },
        { key: "gul", label: "Snävt", cls: "t-warn" },
        { key: "po30", label: "PO inom 30 dagar" },
        { key: "datum", label: "Saknar datum" },
        { key: "ean", label: "Godkända utan EAN" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_styles", "Sök style, leverantör, säsong …", st, () => this.update());
      this.fLev = filterSelect("f_st_lev", "Alla leverantörer", st, "lev", upd);
      this.fSeason = filterSelect("f_st_season", "Alla säsonger", st, "season", upd);
      this.seg = makeSeg([["aktiva", "Aktiva"], ["Sampling", "Sampling"], ["Godkänd", "Godkänd"], ["PO lagd", "PO lagd"], ["Levererad", "Levererad"], ["Skippad", "Skippad"], ["alla", "Alla"]], st, "status", upd);
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["Style"], ["Leverantör"], ["Säsong"], ["Senaste sample"], ["I lager senast"], ["PO senast"], ["Läge"], ["EAN"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { if (e.target.closest("button")) return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
      this.empty = h("div", { class: "empty", hidden: true });
      root.append(this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fLev.el, this.fSeason.el, this.seg.el, this.count), h("section", { class: "ledger-wrap" }, t, this.empty));
    },
    update() {
      const st = UI.styles, q = norm(st.q);
      const P = new Map(D.styles.map((s) => [s._id, plan(s)]));
      const active = D.styles.filter(isActiveStyle);
      this.strip.set({
        rod: active.filter((s) => P.get(s._id).lage === "rod").length,
        gul: active.filter((s) => P.get(s._id).lage === "gul").length,
        po30: active.filter((s) => { const p = P.get(s._id); return p.po && p.poDays >= 0 && p.poDays <= 30; }).length,
        datum: active.filter((s) => ["ingen", "okand"].includes(P.get(s._id).lage)).length,
        ean: D.styles.filter((s) => EAN_OK_STATUS.includes(s.status) && eanMissing(s)).length
      });
      this.seg.sync();
      this.fLev.fill(uniq(D.styles.map((s) => s.leverantor)));
      this.fSeason.fill(uniq(D.styles.map((s) => s.sasong)));
      const list = D.styles.filter((s) => {
        const p = P.get(s._id);
        switch (st.view) {
          case "rod": if (!isActiveStyle(s) || p.lage !== "rod") return false; break;
          case "gul": if (!isActiveStyle(s) || p.lage !== "gul") return false; break;
          case "po30": if (!isActiveStyle(s) || !(p.po && p.poDays >= 0 && p.poDays <= 30)) return false; break;
          case "datum": if (!isActiveStyle(s) || !["ingen", "okand"].includes(p.lage)) return false; break;
          case "ean": if (!(EAN_OK_STATUS.includes(s.status) && eanMissing(s))) return false; break;
          default:
            if (st.status === "aktiva" && !isActiveStyle(s)) return false;
            if (st.status !== "aktiva" && st.status !== "alla" && s.status !== st.status) return false;
        }
        if (st.lev && s.leverantor !== st.lev) return false;
        if (st.season && s.sasong !== st.season) return false;
        if (q && ![s._id, s.namn, s.leverantor, s.sasong, s.drop, s.kommentar].join(" ").toLowerCase().includes(q)) return false;
        return true;
      }).sort((a, b) => {
        const pa = P.get(a._id), pb = P.get(b._id);
        return LAGE_ORDER[pa.lage] - LAGE_ORDER[pb.lage] || (pa.po || "9999").localeCompare(pb.po || "9999") || (a.namn || "").localeCompare(b.namn || "", "sv");
      });
      this.tb.replaceChildren(...list.map((s) => styleRow(s, P.get(s._id))));
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(...(!loaded.has("styles") ? [h("strong", { text: "Laddar styles …" })] : D.styles.length ? [h("strong", { text: "Inget matchar filtret" }), h("span", { text: "Byt status eller rensa sökningen." })] : [h("strong", { text: "Inga styles ännu" }), h("span", { text: "Skapa en med \"+ Ny style\"." })]));
      this.count.textContent = list.length + " av " + D.styles.length + " styles";
    }
  };
  function styleRow(s, p) {
    const xs = samplesOfStyle(s._id);
    const last = xs[xs.length - 1];
    const vs = variants(s.farger || [], s.storlekar || []);
    const eanTxt = (s.ean || []).length ? (s.ean || []).length + (vs.length ? "/" + vs.length : "") : "–";
    return h("tr", { tabIndex: 0, dataset: { style: s._id } },
      td("", "c-main", h("div", { class: "prod", text: s.namn || "Namnlös" }), h("div", { class: "sub" }, s.typ === "Restock" ? chip("Restock") : null, s._id + " · " + xs.length + (xs.length === 1 ? " sample" : " samples") + (s.drop ? " · " + s.drop : ""))),
      td("Leverantör", null, s.leverantor || ""),
      td("Säsong", null, s.sasong || ""),
      td("Senaste", null, last ? h("span", { class: "chips" }, chip(last.version || "–"), statusPill(last.status), last.beslut ? chip(last.beslut, "b-" + slug(last.beslut)) : null) : h("span", { class: "muted", text: "Ingen sample" })),
      td("I lager senast", "mono", isISO(s.klartSenast) ? fmtDate(s.klartSenast) : ""),
      td("PO senast", null, p.po ? h("div", null, h("div", { class: "mono", text: fmtDate(p.po) }), h("div", { class: "days " + (p.poDays < 0 ? "late" : p.poDays < 14 ? "soon" : ""), text: fmtDays(p.poDays) })) : null),
      td("Läge", null, lagePill(p), p.note && p.lage !== "klar" && p.lage !== "skip" ? h("div", { class: "sub", text: p.note }) : null),
      td("EAN", "mono", eanTxt)
    );
  }

  // ---------- TYGER ----------
  const TygerView = {
    mount(root) {
      const st = UI.tyger;
      const q = searchBox("q_tyger", "Sök tyg eller leverantör …", st, () => this.update());
      const fs = selectEl("f_t_status", [["", "Alla statusar"]].concat(TYG_STATUS), st.status);
      fs.addEventListener("change", () => { st.status = fs.value; this.update(); });
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["Tyg"], ["Leverantör"], ["Status"], ["Används i"], ["Eget lager"], ["Senast beställd"], ["Kommentar"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openTyg(tr.dataset.id); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const tr = e.target.closest("tr[data-id]"); if (tr) openTyg(tr.dataset.id); });
      this.empty = h("div", { class: "empty", hidden: true });
      root.append(h("p", { class: "lede", text: "Alla tyger ni provat eller använder, skrivna som ni pratar om dem, t.ex. \"Japan Blue inhouse – Westpoint Canvas 223\". Nya tyg som skrivs in på en sample hamnar här automatiskt. Meter ni själva äger ligger under Tyglager." }), h("section", { class: "filters" }, q, fs, this.count), h("section", { class: "ledger-wrap" }, t, this.empty));
    },
    update() {
      const st = UI.tyger, q = norm(st.q);
      const list = D.tyger.filter((t) => (!st.status || t.status === st.status) && (!q || [t._id, t.namn, t.leverantor, t.kommentar].join(" ").toLowerCase().includes(q))).sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv"));
      this.tb.replaceChildren(...list.map((t) => {
        const used = D.samples.filter((s) => s.tygId === t._id);
        const nStyles = uniq(used.map((s) => s.styleId)).length;
        const lastOrder = used.map((s) => s.bestalld).filter(isISO).sort().pop();
        const statusCell = td("Status", null, t.status ? h("span", { class: "pill ts-" + slug(t.status), text: t.status }) : h("span", { class: "muted", text: "–" }));
        if (isISO(t.aterDatum)) statusCell.append(h("div", { class: "sub", text: "åter " + fmtDate(t.aterDatum) }));
        if (isISO(t.aterDatum) && /slut/i.test(t.status || "") && diffDays(t.aterDatum) <= 0) statusCell.append(h("span", { class: "flag", text: "Kolla tillgången" }));
        return h("tr", { tabIndex: 0, dataset: { id: t._id } },
          td("", "c-main", h("div", { class: "prod", text: t.namn || "Namnlöst tyg" }), h("div", { class: "sub", text: t._id })),
          td("Leverantör", null, t.leverantor || ""), statusCell,
          td("Används i", null, used.length ? used.length + (used.length === 1 ? " sample" : " samples") + " · " + nStyles + (nStyles === 1 ? " style" : " styles") : "–"),
          td("Eget lager", null, stockText(t._id) || h("span", { class: "muted", text: "–" })),
          td("Senast beställd", "mono", lastOrder ? fmtDate(lastOrder) : ""),
          td("Kommentar", "note", t.kommentar || ""));
      }));
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(h("strong", { text: loaded.has("tyger") ? (D.tyger.length ? "Inget matchar" : "Inga tyger ännu") : "Laddar tyger …" }));
      this.count.textContent = list.length + " av " + D.tyger.length + " tyger";
    }
  };

  // ---------- TYGLAGER ----------
  const LagerView = {
    mount(root) {
      const st = UI.lager;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "meter", label: "Meter kvar (ca)" },
        { key: "partier", label: "Partier i lager" },
        { key: "saknar", label: "Saknar meter", cls: "t-warn" },
        { key: "bestallda", label: "Beställda" },
        { key: "reserverade", label: "Reserverade" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_lager", "Sök tyg, färg, plats, style …", st, () => this.update());
      this.fPlats = filterSelect("f_l_plats", "Alla platser", st, "plats", upd);
      this.seg = makeSeg([["I lager", "I lager"], ["Beställd", "Beställd"], ["Förbrukad", "Förbrukad"], ["alla", "Alla"]], st, "status", upd);
      const grp = selectEl("f_l_group", [["plats", "Gruppera per plats"], ["tyg", "Gruppera per tyg"], ["none", "Ingen gruppering"]], st.group);
      grp.addEventListener("change", () => { st.group = grp.value; upd(); });
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["Tyg"], ["Plats"], ["Kvar (m)"], ["Reserverad för"], ["Uppdaterad"], ["Status"], ["Kommentar"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { if (e.target.closest("button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openLager(tr.dataset.id); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter" || e.target.closest("button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openLager(tr.dataset.id); });
      this.empty = h("div", { class: "empty", hidden: true });
      root.append(h("p", { class: "lede", text: "Tyg som Rubato äger: var det ligger och ungefär hur många meter som är kvar. Uppdatera metrarna när en order har sytts eller när leverantören har räknat." }), this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fPlats.el, this.seg.el, grp, this.count), h("section", { class: "ledger-wrap" }, t, this.empty));
    },
    update() {
      const st = UI.lager, q = norm(st.q);
      const inStock = D.lager.filter((l) => l.status === "I lager");
      this.strip.set({
        meter: Math.round(inStock.reduce((a, l) => a + (num(l.meter) || 0), 0)),
        partier: inStock.length,
        saknar: inStock.filter((l) => num(l.meter) == null).length,
        bestallda: D.lager.filter((l) => l.status === "Beställd").length,
        reserverade: inStock.filter((l) => l.reserveradFor).length
      });
      this.seg.sync();
      this.fPlats.fill(uniq(D.lager.map((l) => l.plats)));
      const list = D.lager.filter((l) => {
        switch (st.view) {
          case "meter": if (!(l.status === "I lager" && num(l.meter) != null)) return false; break;
          case "partier": if (l.status !== "I lager") return false; break;
          case "saknar": if (!(l.status === "I lager" && num(l.meter) == null)) return false; break;
          case "bestallda": if (l.status !== "Beställd") return false; break;
          case "reserverade": if (!(l.status === "I lager" && l.reserveradFor)) return false; break;
          default: if (st.status !== "alla" && l.status !== st.status) return false;
        }
        if (st.plats && l.plats !== st.plats) return false;
        if (q && ![l._id, lotName(l), l.farg, l.plats, l.kommentar, reservedName(l), l.status].join(" ").toLowerCase().includes(q)) return false;
        return true;
      });
      const keyOf = st.group === "plats" ? (l) => l.plats || "Utan plats" : st.group === "tyg" ? (l) => lotName(l) : () => "";
      list.sort((a, b) => keyOf(a).localeCompare(keyOf(b), "sv") || lotName(a).localeCompare(lotName(b), "sv") || (a.farg || "").localeCompare(b.farg || "", "sv") || a._id.localeCompare(b._id));
      const rows = [];
      let last = null;
      for (const l of list) {
        const k = keyOf(l);
        if (st.group !== "none" && k !== last) {
          last = k;
          const grpLots = list.filter((x) => keyOf(x) === k);
          const known = grpLots.filter((x) => x.status === "I lager" && num(x.meter) != null);
          const unknown = grpLots.filter((x) => x.status === "I lager" && num(x.meter) == null).length;
          const bits = [k, grpLots.length + (grpLots.length === 1 ? " parti" : " partier")];
          if (known.length) bits.push("ca " + fmtM(known.reduce((a, x) => a + num(x.meter), 0)) + " m");
          if (unknown) bits.push(unknown + " utan meter");
          rows.push(h("tr", { class: "group" }, h("td", { colSpan: 7, text: bits.join(" · ") })));
        }
        rows.push(lagerRow(l));
      }
      this.tb.replaceChildren(...rows);
      this.empty.hidden = list.length > 0;
      if (!list.length) {
        this.empty.replaceChildren(...(!loaded.has("lager")
          ? [h("strong", { text: db ? "Laddar tyglager …" : "Inget tyglager att visa" })]
          : D.lager.length ? [h("strong", { text: "Inget matchar filtret" }), h("span", { text: "Byt status, plats eller rensa sökningen." })]
          : [h("strong", { text: "Inga tygpartier ännu" }), h("span", { text: "Lägg till det första med \"+ Nytt parti\": tyg, var det ligger och ungefär hur många meter." })]));
      }
      this.count.textContent = list.length + " av " + D.lager.length + " partier";
    }
  };
  function lagerRow(l) {
    const tr = h("tr", { tabIndex: 0, dataset: { id: l._id } });
    const t = tygOf(l);
    const sub = [l._id, l.farg, num(l.bredd) != null ? l.bredd + " cm" : ""].filter(Boolean).join(" · ");
    const kvar = h("td", { "data-label": "Kvar (m)", class: "c-exp" });
    if (num(l.meter) != null) kvar.append(h("div", { class: "mono", text: "ca " + fmtM(l.meter) + " m" }));
    else if (l.status === "I lager") kvar.append(h("span", { class: "flag", text: "Ange meter" }));
    else kvar.append(h("span", { class: "muted", text: "–" }));
    if (num(l.inkoptMeter) != null) kvar.append(h("div", { class: "sub", text: "inköpt " + fmtM(l.inkoptMeter) + " m" }));
    const upd = l.raknad || (l.andrad ? String(l.andrad).slice(0, 10) : "");
    tr.append(
      td("", "c-main", h("div", { class: "prod" + (t && t.status === "Slut" ? " late-text" : ""), text: lotName(l) }), h("div", { class: "sub", text: sub })),
      td("Plats", null, h("span", { class: "place", text: l.plats || "" })),
      kvar,
      td("Reserverad för", null, reservedName(l) || ""),
      td("Uppdaterad", "mono", isISO(upd) ? fmtDate(upd) : ""),
      td("Status", "c-status", h("span", { class: "pill ls-" + slug(l.status || "x"), text: l.status || "–" })),
      td("Kommentar", "note", l.kommentar || "")
    );
    return tr;
  }

  // ---------- LEVERANTÖRER ----------
  const LevView = {
    mount(root) {
      const { t, tb } = table([["Leverantör"], ["Sample-ledtid"], ["Faktiskt snitt"], ["Produktion"], ["Frakt"], ["Buffert"], ["Öppna samples"], ["Försenade"], ["Valuta"], ["Kontakt"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openLev(tr.dataset.id); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const tr = e.target.closest("tr[data-id]"); if (tr) openLev(tr.dataset.id); });
      this.sUtv = inp("set_utv", "", { type: "number", min: "0", step: "1" });
      this.sFrakt = inp("set_frakt", "", { type: "number", min: "0", step: "1" });
      this.sGul = inp("set_gul", "", { type: "number", min: "0", step: "1" });
      const saveBtn = h("button", { class: "btn small", type: "button", text: "Spara regler", onclick: async () => {
        if (!db) return;
        try { await db.doc("installningar/app").set({ utvarderingDagar: num(this.sUtv.value) ?? 7, standardFrakt: num(this.sFrakt.value) ?? 7, marginalGul: num(this.sGul.value) ?? 14, andrad: new Date().toISOString() }); toast("Reglerna sparade"); } catch (e) { writeError(e); }
      } });
      this.settings = h("section", { class: "panel" }, h("h3", { class: "sec-title", text: "Planeringsregler" }),
        h("div", { class: "form three" }, field("Utvärdering (dagar)", this.sUtv, { hint: "Tid från sample inne till beslut" }), field("Standardfrakt (dagar)", this.sFrakt, { hint: "Används när leverantören saknar frakt" }), field("Gult läge under (dagar)", this.sGul, { hint: "Marginal innan en style blir röd" })),
        canWrite && db ? h("div", null, saveBtn) : null);
      if (!canWrite || !db) [this.sUtv, this.sFrakt, this.sGul].forEach((x) => (x.disabled = true));
      root.append(h("p", { class: "lede", text: "Ledtiderna styr förväntad leverans på nya samples och tidsplanen för styles. Faktiskt snitt räknas från samples som har både beställnings- och mottagningsdatum." }), h("section", { class: "ledger-wrap" }, t), this.settings);
    },
    update() {
      const std = num(D.settings.standardFrakt) ?? 7;
      const list = D.lev.slice().sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv"));
      this.tb.replaceChildren(...list.map((l) => {
        const a = actualLead(l.namn);
        const mine = D.samples.filter((s) => norm(s.leverantor) === norm(l.namn));
        const open = mine.filter((s) => ACTIVE.includes(s.status)).length;
        const late = mine.filter(isLate).length;
        const d = (v) => (num(v) == null ? "–" : num(v) + " d");
        return h("tr", { tabIndex: 0, dataset: { id: l._id } },
          td("", "c-main", h("div", { class: "prod", text: l.namn }), l.kod ? h("div", { class: "sub mono", text: l.kod }) : null),
          td("Sample-ledtid", "mono", d(l.sampleLedtid)),
          td("Faktiskt snitt", "mono", a ? a.avg + " d (" + a.n + ")" : "–"),
          td("Produktion", "mono", d(l.produktionstid)),
          td("Frakt", "mono", num(l.frakt) == null ? std + " d (std)" : d(l.frakt)),
          td("Buffert", "mono", d(l.buffert || 0)),
          td("Öppna samples", "mono", String(open)),
          td("Försenade", "mono" + (late ? " late-text" : ""), String(late)),
          td("Valuta", null, l.valuta || ""),
          td("Kontakt", null, l.kontakt || ""));
      }));
      const act = document.activeElement;
      if (![this.sUtv, this.sFrakt, this.sGul].includes(act)) {
        this.sUtv.value = D.settings.utvarderingDagar ?? 7; this.sFrakt.value = D.settings.standardFrakt ?? 7; this.sGul.value = D.settings.marginalGul ?? 14;
      }
    }
  };

  // ---------- EAN ----------
  const EanView = {
    mount(root) {
      this.panel = h("section", { class: "panel" });
      const q = searchBox("q_ean", "Sök EAN, style, färg, storlek …", UI.ean, () => this.update());
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["EAN"], ["Style"], ["Färg"], ["Storlek"], ["Tilldelad"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
      this.empty = h("div", { class: "empty", hidden: true });
      this.logList = h("ul", { class: "log" });
      this.adminOpen = false;
      root.append(this.panel, h("section", { class: "filters" }, q, this.count), h("section", { class: "ledger-wrap" }, t, this.empty), h("section", { class: "logsec" }, h("h3", { class: "sec-title", text: "Senaste tilldelningar" }), this.logList));
    },
    update() {
      const p = D.pool; const pn = this.panel;
      if (!this.adminOpen) {
        pn.replaceChildren();
        if (!p) pn.append(h("p", { class: "hint", text: loaded.has("pool") ? "EAN-serien är inte inställd." : "Laddar EAN-serien …" }));
        else {
          const pre = String(p.prefix || "");
          const next = ean13(pre + String(p.nasta).padStart(12 - pre.length, "0"));
          const left = Math.max(0, Number(p.slut) - Number(p.nasta) + 1);
          const assigned = D.styles.reduce((n, s) => n + (s.ean || []).length, 0);
          const kv = (k, v, cls) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v " + (cls || ""), text: v }));
          pn.append(h("div", { class: "kvs" }, kv("Nästa EAN", next, "mono big"), kv("Kvar i serien", left.toLocaleString("sv-SE"), "mono big"), kv("Tilldelade i appen", String(assigned), "mono big"), kv("GS1-prefix", pre, "mono"), kv("Högsta i Shopify vid start", p.shopifyHogsta || "–", "mono")));
          if (p.kommentar) pn.append(h("p", { class: "hint", text: p.kommentar }));
          pn.append(h("p", { class: "hint", text: "EAN delas ut från en godkänd style, ett nummer per färg och storlek. Låt appen vara det enda stället där nya nummer delas ut, så blir det aldrig dubbletter." }));
          if (canAdmin && canWrite) pn.append(h("div", { class: "admin-row" }, h("button", { class: "btn small", type: "button", text: "Ändra nästa löpnummer", onclick: () => this.openAdmin() })));
        }
      }
      const q = norm(UI.ean.q);
      const rows = [];
      for (const s of D.styles) for (const e of s.ean || []) rows.push({ s, e });
      rows.sort((a, b) => String(b.e.ean).localeCompare(String(a.e.ean)));
      const list = q ? rows.filter((r) => [r.e.ean, r.s.namn, r.e.farg, r.e.storlek, r.s._id].join(" ").toLowerCase().includes(q)) : rows;
      this.tb.replaceChildren(...list.map((r) => h("tr", { tabIndex: 0, dataset: { style: r.s._id } },
        td("EAN", "mono", r.e.ean),
        td("Style", "c-main", h("div", { class: "prod", text: r.s.namn }), h("div", { class: "sub", text: r.s._id + (r.s.leverantor ? " · " + r.s.leverantor : "") })),
        td("Färg", null, r.e.farg), td("Storlek", null, r.e.storlek),
        td("Tilldelad", "mono", r.e.t ? fmtDate(String(r.e.t).slice(0, 10)) : ""))));
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(h("strong", { text: rows.length ? "Inget matchar sökningen" : "Inga EAN tilldelade ännu" }), h("span", { text: rows.length ? "Rensa sökningen." : "Godkänn en style, fyll i färger och storlekar och tryck på \"Tilldela EAN\"." }));
      this.count.textContent = list.length + " EAN";
      renderLogInto(this.logList, D.logg.slice().reverse().map((l) => ({ t: l.t, av: l.av, text: l.text })));
    },
    openAdmin() {
      const p = D.pool; if (!p) return;
      this.adminOpen = true;
      const pn = this.panel;
      const i = inp("ean_next", p.nasta, { type: "number", min: "0", max: String(p.slut), step: "1" });
      const pre = String(p.prefix || "");
      const preview = h("span", { class: "mono" });
      const sync = () => { const n = num(i.value); preview.textContent = n == null ? "" : "→ " + ean13(pre + String(n).padStart(12 - pre.length, "0")); };
      i.addEventListener("input", sync); sync();
      const close = () => { this.adminOpen = false; this.update(); };
      const save = async () => {
        const n = num(i.value);
        if (n == null || n < 0 || n > Number(p.slut) || Math.floor(n) !== n) { toast("Ange ett heltal mellan 0 och " + p.slut + "."); return; }
        try {
          const ref = db.doc("ean/pool");
          const lease = await ref.acquire({ holder: myId || "admin", ttlMs: 5000 });
          if (!lease.acquired) { toast("Någon tilldelar EAN just nu. Försök igen om några sekunder."); return; }
          await ref.update({ nasta: n, andrad: new Date().toISOString() });
          toast("Nästa löpnummer är nu " + n); close();
        } catch (e) { writeError(e); }
      };
      pn.replaceChildren(h("h3", { class: "sec-title", text: "Ändra nästa löpnummer" }),
        h("p", { class: "hint", text: "Löpnumret är de fyra siffrorna efter prefixet. Sätt aldrig ett lägre nummer än något som redan används i Shopify eller hos leverantörer, då blir det dubbletter." }),
        h("div", { class: "admin-row" }, i, preview, h("span", { class: "spacer" }), h("button", { class: "btn small", type: "button", text: "Avbryt", onclick: close }), h("button", { class: "btn small primary", type: "button", text: "Spara", onclick: save })));
      i.focus();
    }
  };

  const allocateEan = (n) => P.allocateEan(n);

  // ---------- tabs ----------
  const VIEWS = { samples: SamplesView, styles: StylesView, tyger: TygerView, tyglager: LagerView, leverantorer: LevView, ean: EanView };
  function switchTab(t) {
    if (!VIEWS[t]) t = "samples";
    UI.tab = t;
    document.querySelectorAll("#tabs .tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    const root = $("view"); root.replaceChildren(); root.className = "view-" + t;
    root.style.display = "grid"; root.style.gap = "16px";
    VIEWS[t].mount(root); VIEWS[t].update(); renderActions(); persist();
  }
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) switchTab(b.dataset.tab); });
  function renderActions() {
    const a = $("actions"); a.replaceChildren();
    const add = (label, fn, primary) => a.append(h("button", { class: "btn" + (primary ? " primary" : ""), type: "button", text: label, onclick: fn }));
    const w = canWrite && !!db, t = UI.tab;
    if (t === "samples") { if (downloads) add("Exportera CSV", exportSamples); if (w) add("+ Ny sample", () => openSample(null), true); }
    if (t === "styles" && w) add("+ Ny style", () => openStyle(null), true);
    if (t === "tyger" && w) add("+ Nytt tyg", () => openTyg(null), true);
    if (t === "tyglager") { if (downloads) add("Exportera CSV", exportLager); if (w) add("+ Nytt parti", () => openLager(null), true); }
    if (t === "leverantorer" && w) add("+ Ny leverantör", () => openLev(null), true);
    if (t === "ean" && downloads) add("Exportera alla EAN", exportAllEan);
    a.append(h("button", { class: "btn", type: "button", text: "Logga ut", title: P.user.email(), onclick: P.signOut }));
  }
  function updateCounts() {
    const set = (id, v) => ($(id).textContent = v ? String(v) : "");
    set("c_samples", D.samples.filter((s) => ACTIVE.includes(s.status)).length);
    set("c_styles", D.styles.filter(isActiveStyle).length);
    set("c_tyger", D.tyger.length);
    set("c_tyglager", D.lager.filter((l) => l.status === "I lager").length);
    set("c_leverantorer", D.lev.length);
    set("c_ean", D.styles.reduce((n, s) => n + (s.ean || []).length, 0));
  }
  function refreshLists() {
    $("dlLev").replaceChildren(...uniq(D.lev.map((l) => l.namn).concat(D.samples.map((s) => s.leverantor), D.styles.map((s) => s.leverantor))).map((v) => new Option(v, v)));
    $("dlTyg").replaceChildren(...uniq(D.tyger.map((t) => t.namn)).map((v) => new Option(v, v)));
    $("dlPlats").replaceChildren(...uniq([EGET_LAGER].concat(D.lev.map((l) => l.namn), D.lager.map((l) => l.plats))).map((v) => new Option(v, v)));
    $("dlSeason").replaceChildren(...uniq(["AW26", "SS27", "AW27", "SS28"].concat(D.styles.map((s) => s.sasong))).map((v) => new Option(v, v)));
  }
  let refreshT = 0;
  function scheduleRefresh() { if (refreshT) return; refreshT = setTimeout(() => { refreshT = 0; refresh(); }, 40); }
  function refresh() { updateCounts(); refreshLists(); VIEWS[UI.tab].update(); if (sheetCtx && sheetCtx.refresh) sheetCtx.refresh(); }
  function applyWriteMode() {
    renderActions();
    if (db && !canWrite) banner("Du har läsbehörighet. Be Elliot om Contributor-behörighet för att uppdatera.");
  }

  // ---------- sheet ----------
  let sheetCtx = null;
  function openSheet(o) {
    $("sheetTag").textContent = o.tag || ""; $("sheetTag").hidden = !o.tag;
    $("sheetTitle").textContent = o.title || "";
    $("sheetSub").textContent = o.sub || ""; $("sheetSub").hidden = !o.sub;
    $("sheetBody").replaceChildren(...o.body.filter(Boolean));
    $("sheetFoot").replaceChildren(...(o.foot || []).filter(Boolean));
    sheetCtx = o.ctx || null;
    $("scrim").hidden = false; $("sheet").hidden = false;
    $("sheetBody").scrollTop = 0;
    setTimeout(() => { const f = (o.focus && $(o.focus)) || $("sheetClose"); if (f) f.focus(); }, 30);
  }
  function closeSheet() { $("scrim").hidden = true; $("sheet").hidden = true; sheetCtx = null; }
  $("sheetClose").addEventListener("click", closeSheet);
  $("scrim").addEventListener("click", closeSheet);
  document.addEventListener("keydown", (e) => { if (e.key !== "Escape") return; if (!$("lblDlg").hidden) closeLabels(); else if (!$("sheet").hidden) closeSheet(); });
  function footButtons(o) {
    const left = h("div");
    if (o.onDelete && canWrite && db) {
      const reset = () => left.replaceChildren(h("button", { class: "btn small danger", type: "button", text: "Ta bort", disabled: !o.canDelete, title: o.canDelete ? null : o.blockText || "Kan inte tas bort medan något är kopplat hit", onclick: () => ask() }));
      const ask = () => left.replaceChildren(h("span", { class: "confirm" }, h("span", { text: "Ta bort för alla?" }), h("button", { class: "btn small danger", type: "button", text: "Ja, ta bort", onclick: o.onDelete }), h("button", { class: "btn small", type: "button", text: "Behåll", onclick: reset })));
      reset();
    }
    const right = h("div", { class: "foot-right" }, h("button", { class: "btn", type: "button", text: "Avbryt", onclick: closeSheet }));
    if (o.onSave && canWrite && db) right.append(h("button", { class: "btn primary", type: "button", id: "btnSave", text: o.saveLabel || "Spara", onclick: o.onSave }));
    return [left, right];
  }
  const lock = (form) => form.querySelectorAll("input, select, textarea").forEach((x) => (x.disabled = true));

  // ---------- sample sheet ----------
  const S_LABELS = { styleId: "Style", version: "Version", leverantor: "Leverantör", farg: "Färg", tygId: "Tyg", storlek: "Storlek", prisBelopp: "Pris", prisValuta: "Valuta", status: "Status", bestalld: "Beställd", ledtid: "Ledtid", forvantad: "Förväntad leverans", mottagen: "Mottagen", tracking: "Tracking", p1Skickad: "Påminnelse 1", p2Skickad: "Påminnelse 2", platsTyp: "Plats", hangare: "Hängare", platsNotering: "Platsnotering", beslut: "Beslut", andringar: "Ändringar", kommentar: "Kommentar", utvarderad: "Utvärderad" };
  const S_INPUTS = { status: "f_status", mottagen: "f_mottagen", p1Skickad: "f_p1", p2Skickad: "f_p2", beslut: "f_beslut" };

  async function createStyleQuick(name, lev) {
    const id = await freshId("styles", D.styles, "ST-", 3);
    const body = { id, namn: name, leverantor: lev, sasong: "", drop: "", typ: "Nyhet", status: "Sampling", klartSenast: null, fotoSenast: null, farger: [], storlekar: [], ean: [], kommentar: "", logg: [logEntry("Style skapad från en sample")], andrad: new Date().toISOString() };
    if (!(await create("styles", id, body))) return null;
    if (!byId(D.styles, id)) D.styles.push(Object.assign({}, body, { _id: id }));
    return id;
  }
  async function resolveTyg(name, lev) {
    if (!name) return null;
    const hit = D.tyger.find((t) => norm(t.namn) === norm(name));
    if (hit) return hit._id;
    const id = await freshId("tyger", D.tyger, "T-", 3);
    const body = { id, namn: name, leverantor: lev || "", status: "", aterDatum: null, kommentar: "", andrad: new Date().toISOString() };
    if (!(await create("tyger", id, body))) return null;
    if (!byId(D.tyger, id)) D.tyger.push(Object.assign({}, body, { _id: id }));
    return id;
  }
  async function approveStyleFrom(sample) {
    const x = byId(D.styles, sample.styleId);
    if (x && x.status === "Sampling") {
      await write("styles", x._id, { status: "Godkänd", logg: (x.logg || []).concat(logEntry("Godkänd via " + sample._id + (sample.version ? " (" + sample.version + ")" : ""))), andrad: new Date().toISOString() });
      toast("Stylen " + x.namn + " är nu godkänd och kan få EAN");
    }
  }

  function openSample(id, preset) {
    const isNew = !id;
    let s;
    if (isNew) {
      s = Object.assign({ _id: null, status: "Beställd", bestalld: todayISO(), version: "Proto 1", logg: [] }, preset || {});
      if (s.leverantor && s.ledtid == null) { const sl = levNum(s.leverantor, "sampleLedtid"); if (sl != null) { s.ledtid = sl; s.forvantad = addDays(s.bestalld, sl); } }
    } else { s = byId(D.samples, id); if (!s) { toast("Hittar inte " + id + "."); return; } }
    const ro = !canWrite || !db;
    const styleOpts = [["", "– Ingen style –"]].concat(D.styles.slice().sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv")).map((x) => [x._id, x.namn + (x.leverantor ? " · " + x.leverantor : "")]));
    if (!ro) styleOpts.push(["__ny", "+ Ny style …"]);
    const fStyle = selectEl("f_style", styleOpts, s.styleId || "");
    const fNewStyle = inp("f_newstyle", "", { placeholder: "Namn på den nya stylen" });
    const newWrap = field("Ny style", fNewStyle, { full: true }); newWrap.hidden = true;
    const fVersion = selectEl("f_version", VERSIONS, s.version || "Proto 1");
    const fLev = inp("f_lev", s.leverantor, { list: "dlLev", autocomplete: "off" });
    const fFarg = inp("f_farg", s.farg);
    const fTyg = inp("f_tyg", tygName(s), { list: "dlTyg", autocomplete: "off", placeholder: "t.ex. Japan Blue inhouse – Westpoint Canvas 223" });
    const fStorlek = inp("f_storlek", s.storlek, { placeholder: "t.ex. M eller 50" });
    const fPris = inp("f_pris", s.prisBelopp, { type: "number", step: "0.01", min: "0", inputmode: "decimal" });
    const fValuta = selectEl("f_valuta", [["", "–"], "SEK", "EUR", "JPY", "GBP", "USD"], s.prisValuta || "");
    const fStatus = selectEl("f_status", SAMPLE_STATUS, s.status || "Beställd");
    const fBest = inp("f_bestalld", s.bestalld, { type: "date" });
    const fLed = inp("f_ledtid", s.ledtid, { type: "number", min: "0", step: "1" });
    const fForv = inp("f_forvantad", s.forvantad, { type: "date" });
    const fMott = inp("f_mottagen", s.mottagen, { type: "date" });
    const fTrack = inp("f_tracking", s.tracking, { placeholder: "Fraktbolag och spårningsnummer" });
    const fP1 = inp("f_p1", s.p1Skickad, { type: "date" });
    const fP2 = inp("f_p2", s.p2Skickad, { type: "date" });
    const fPlats = selectEl("f_plats", [["", "–"]].concat(PLATSER), s.platsTyp || "");
    const fHang = inp("f_hangare", s.hangare, { inputmode: "numeric", placeholder: "t.ex. 12" });
    const fPNot = inp("f_platsnot", s.platsNotering, { placeholder: "Vem eller var, t.ex. Carl testar" });
    const fBeslut = selectEl("f_beslut", [["", "–"]].concat(BESLUT), s.beslut || "");
    const fAndr = area("f_andringar", s.andringar, "Det som ska rättas till nästa runda");
    const fKom = area("f_kommentar", s.kommentar);
    const ledHint = h("span", { class: "hint" });
    const hangWrap = field("Hängare nr", fHang);
    const syncLedHint = () => { const n = fLev.value.trim(); const sl = levNum(n, "sampleLedtid"); const a = actualLead(n); ledHint.textContent = n ? "Standard " + (sl != null ? sl + " d" : "saknas") + (a ? " · faktiskt snitt " + a.avg + " d (" + a.n + ")" : "") : ""; };
    const fillLead = () => { const sl = levNum(fLev.value.trim(), "sampleLedtid"); if (sl != null && !fLed.value) fLed.value = sl; if (!fForv.value && fBest.value && Number(fLed.value) > 0) fForv.value = addDays(fBest.value, Number(fLed.value)); };
    const syncPlats = () => { const isH = fPlats.value === "Hängare"; fHang.disabled = ro || !isH; hangWrap.classList.toggle("dim", !isH); };
    fStyle.addEventListener("change", () => { newWrap.hidden = fStyle.value !== "__ny"; if (!newWrap.hidden) fNewStyle.focus(); const x = byId(D.styles, fStyle.value); if (x && !fLev.value.trim()) { fLev.value = x.leverantor || ""; syncLedHint(); if (isNew) fillLead(); } });
    fLev.addEventListener("change", () => { syncLedHint(); if (isNew) fillLead(); });
    fLed.addEventListener("change", () => { if (fBest.value && Number(fLed.value) > 0 && !fForv.value) fForv.value = addDays(fBest.value, Number(fLed.value)); });
    fStatus.addEventListener("change", () => { if (fStatus.value === "Mottagen" && !fMott.value) fMott.value = todayISO(); });
    fPlats.addEventListener("change", () => { syncPlats(); if (fPlats.value === "Hängare") fHang.focus(); });

    const form = h("form", { class: "form", id: "sampleForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("h3", { class: "sec-title full", text: "Produkt" }),
      field("Style", fStyle, { full: true }), newWrap,
      field("Version", fVersion), field("Leverantör", fLev),
      field("Färg", fFarg), field("Storlek", fStorlek),
      field("Tyg", fTyg, { full: true, hint: "Skriv fritt eller välj ett tyg som redan finns." }),
      field("Pris", fPris), field("Valuta", fValuta),
      h("h3", { class: "sec-title full", text: "Leverans" }),
      field("Status", fStatus), field("Beställd", fBest),
      h("div", { class: "field" }, h("label", { for: "f_ledtid", text: "Ledtid (dagar)" }), fLed, ledHint),
      field("Förväntad leverans", fForv, { hint: "Tomt = TBA" }),
      field("Mottagen", fMott), field("Tracking", fTrack),
      field("Påminnelse 1 skickad", fP1), field("Påminnelse 2 skickad", fP2),
      h("h3", { class: "sec-title full", text: "Var finns samplen?" }),
      field("Plats", fPlats), hangWrap,
      field("Notering", fPNot, { full: true }),
      h("h3", { class: "sec-title full", text: "Utvärdering" }),
      field("Beslut", fBeslut),
      field("Ändringar till nästa runda", fAndr, { full: true }),
      field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);
    syncLedHint(); syncPlats();

    const quick = h("div", { class: "quick" });
    const planBox = h("div", { class: "planline" });
    const logUl = h("ul", { class: "log" });
    const noteIn = inp("f_note", "", { placeholder: "Anteckning, t.ex. Mailat om knapparna" });
    noteIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } });
    const noteRow = h("div", { class: "add-note" }, noteIn, h("button", { class: "btn small", type: "button", text: "Lägg till", onclick: () => addNote() }));
    const current = () => (isNew ? null : byId(D.samples, s._id));

    function renderPlanLine() {
      const x = byId(D.styles, (current() || s).styleId);
      if (!x) { planBox.hidden = true; return; }
      planBox.hidden = false;
      const p = plan(x);
      planBox.replaceChildren(lagePill(p), h("span", { text: x.namn + (p.po ? " · PO senast " + fmtDate(p.po) + " (" + fmtDays(p.poDays) + ")" : p.note ? " · " + p.note : "") }), h("button", { class: "linkish", type: "button", text: "Öppna style", onclick: () => openStyle(x._id) }));
    }
    function renderQuick() {
      const cur = current();
      quick.replaceChildren();
      if (!cur || ro) { quick.hidden = true; return; }
      quick.hidden = false;
      const add = (label, fn, primary) => quick.append(h("button", { class: "btn small" + (primary ? " primary" : ""), type: "button", text: label, onclick: fn }));
      if (isWaiting(cur) || cur.status === "Problem") add("Mottagen idag", () => quickUpdate(cur, { status: "Mottagen", mottagen: todayISO() }, "Markerad mottagen. Ange hängare nedan."), true);
      if (cur.status === "Beställd") add("Skickad", () => quickUpdate(cur, { status: "Skickad" }, "Markerad skickad"));
      const r = remindDue(cur);
      if (r) add("Påminnelse " + r + " skickad", () => quickUpdate(cur, r === 1 ? { p1Skickad: todayISO() } : { p2Skickad: todayISO() }, "Påminnelse " + r + " noterad"));
      if (cur.status === "Mottagen" && cur.beslut !== "Godkänd") add("Godkänn", async () => { if (await quickUpdate(cur, { beslut: "Godkänd", utvarderad: true }, "Godkänd")) await approveStyleFrom(cur); }, true);
      if (cur.status === "Mottagen" || cur.beslut) add("Ny runda", () => newRound(cur));
      if (cur.status !== "Problem" && cur.status !== "Mottagen") add("Flagga problem", () => quickUpdate(cur, { status: "Problem" }, "Flaggad som problem"));
      add("Etikett", () => openLabels([cur._id]));
    }
    async function quickUpdate(cur, patch, msg) {
      const changes = describeChanges(cur, patch, S_LABELS);
      const body = Object.assign({}, patch, { andrad: new Date().toISOString(), logg: (cur.logg || []).concat(changes.map(logEntry)) });
      const ok = await write("samples", cur._id, body);
      if (ok) { toast(msg); for (const [k, v] of Object.entries(patch)) { const el = S_INPUTS[k] && $(S_INPUTS[k]); if (el) el.value = v == null ? "" : v; } }
      return ok;
    }
    async function newRound(cur) {
      const sl = levNum(cur.leverantor, "sampleLedtid");
      const today = todayISO();
      const nid = await freshId("samples", D.samples, "S", 3);
      const body = { id: nid, styleId: cur.styleId || null, produkt: styleName(cur), version: nextVersion(cur.version), leverantor: cur.leverantor || "", farg: cur.farg || "", tygId: cur.tygId || null, material: cur.material || "", storlek: cur.storlek || "", prisBelopp: null, prisValuta: cur.prisValuta || null, bestalld: today, ledtid: sl, forvantad: sl != null ? addDays(today, sl) : null, status: "Beställd", mottagen: null, tracking: "", p1Skickad: null, p2Skickad: null, kommentar: cur.andringar ? "Ändringar från " + cur._id + ": " + cur.andringar : "", andringar: "", beslut: "", utvarderad: false, platsTyp: "", hangare: "", platsNotering: "", logg: [logEntry("Ny runda efter " + cur._id + (cur.version ? " (" + cur.version + ")" : ""))], andrad: new Date().toISOString() };
      if (!(await create("samples", nid, body))) return;
      const patch = { logg: (cur.logg || []).concat(logEntry("Ny runda beställd: " + nid)), andrad: new Date().toISOString() };
      if (!cur.beslut) { patch.beslut = "Ny runda"; patch.utvarderad = true; }
      await write("samples", cur._id, patch);
      if (!byId(D.samples, nid)) D.samples.push(Object.assign({}, body, { _id: nid }));
      toast(nid + " skapad som " + body.version);
      openSample(nid);
    }
    async function addNote() {
      const t = noteIn.value.trim(); const cur = current(); if (!t || !cur) return;
      if (await write("samples", cur._id, { logg: (cur.logg || []).concat(logEntry(t)), andrad: new Date().toISOString() })) noteIn.value = "";
    }
    async function save() {
      const btn = $("btnSave"); if (btn) btn.disabled = true;
      try {
        const lev = fLev.value.trim();
        if (!lev) { toast("Fyll i leverantör."); fLev.focus(); return; }
        let styleId = fStyle.value;
        if (styleId === "__ny") {
          const nm = fNewStyle.value.trim();
          if (!nm) { toast("Skriv namnet på den nya stylen."); fNewStyle.focus(); return; }
          styleId = await createStyleQuick(nm, lev);
          if (!styleId) return;
        }
        const st = byId(D.styles, styleId);
        const tygId = await resolveTyg(fTyg.value.trim(), lev);
        const o = {
          styleId: styleId || null, produkt: st ? st.namn : (s.produkt || ""), version: fVersion.value, leverantor: lev, farg: fFarg.value.trim(), tygId, storlek: fStorlek.value.trim(),
          prisBelopp: num(fPris.value), prisValuta: fValuta.value || null, status: fStatus.value, bestalld: fBest.value || null, ledtid: num(fLed.value), forvantad: fForv.value || null,
          mottagen: fMott.value || null, tracking: fTrack.value.trim(), p1Skickad: fP1.value || null, p2Skickad: fP2.value || null,
          platsTyp: fPlats.value, hangare: fPlats.value === "Hängare" ? fHang.value.trim() : "", platsNotering: fPNot.value.trim(), beslut: fBeslut.value, andringar: fAndr.value.trim(), kommentar: fKom.value.trim()
        };
        if (!o.forvantad && o.bestalld && o.ledtid > 0) o.forvantad = addDays(o.bestalld, o.ledtid);
        if (o.beslut) o.utvarderad = true;
        const now = new Date().toISOString();
        if (isNew) {
          const nid = await freshId("samples", D.samples, "S", 3);
          const body = Object.assign({ id: nid, material: "", utvarderad: !!o.beslut, logg: [logEntry("Sample skapad (" + o.status + ")")], andrad: now }, o);
          if (await create("samples", nid, body)) { toast(nid + " sparad"); if (o.beslut === "Godkänd") await approveStyleFrom(Object.assign({ _id: nid }, o)); closeSheet(); }
        } else {
          const cur = current() || s;
          const changes = describeChanges(cur, o, S_LABELS);
          if (!changes.length) { closeSheet(); return; }
          const body = Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) });
          if (await write("samples", cur._id, body)) { toast("Sparat"); if (o.beslut === "Godkänd" && cur.beslut !== "Godkänd") await approveStyleFrom(Object.assign({}, cur, o)); closeSheet(); }
        }
      } finally { if (btn) btn.disabled = false; }
    }

    const body = [quick, planBox, form];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl, ro ? null : noteRow));
    openSheet({
      tag: isNew ? "Ny" : s._id,
      title: isNew ? "Ny sample" : styleName(s) + (s.version ? " · " + s.version : ""),
      sub: isNew ? "" : [s.farg, s.leverantor, platsText(s)].filter(Boolean).join(" · "),
      body,
      foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("samples", s._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: true, onSave: save }),
      ctx: { refresh: () => { if (!isNew && !current()) { closeSheet(); return; } renderQuick(); renderPlanLine(); if (!isNew) renderLogInto(logUl, (current() || s).logg); } },
      focus: isNew ? "f_style" : null
    });
    renderQuick(); renderPlanLine();
    if (!isNew) renderLogInto(logUl, s.logg);
  }

  // ---------- style sheet ----------
  const ST_LABELS = { namn: "Namn", leverantor: "Leverantör", sasong: "Säsong", drop: "Drop", typ: "Typ", status: "Status", klartSenast: "I lager senast", fotoSenast: "Fotosample senast", kommentar: "Kommentar", farger: "Färger", storlekar: "Storlekar" };
  function openStyle(id, preset) {
    const isNew = !id;
    const st = isNew ? Object.assign({ _id: null, status: "Sampling", typ: "Nyhet", farger: [], storlekar: [], ean: [], logg: [] }, preset || {}) : byId(D.styles, id);
    if (!st) { toast("Hittar inte " + id + "."); return; }
    const ro = !canWrite || !db;
    const current = () => (isNew ? st : byId(D.styles, st._id) || st);
    const fNamn = inp("f_snamn", st.namn);
    const fLev = inp("f_slev", st.leverantor, { list: "dlLev", autocomplete: "off" });
    const fSas = inp("f_ssasong", st.sasong, { list: "dlSeason", autocomplete: "off", placeholder: "t.ex. SS27" });
    const fDrop = inp("f_sdrop", st.drop, { placeholder: "t.ex. Drop 1" });
    const fTyp = selectEl("f_styp", STYLE_TYP, st.typ || "Nyhet");
    const fStatus = selectEl("f_sstatus", STYLE_STATUS, st.status || "Sampling");
    const fKlart = inp("f_sklart", st.klartSenast, { type: "date" });
    const fFoto = inp("f_sfoto", st.fotoSenast, { type: "date" });
    const fKom = area("f_skom", st.kommentar);
    const form = h("form", { class: "form", id: "styleForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      field("Namn", fNamn, { full: true }), field("Leverantör", fLev), field("Säsong", fSas), field("Drop", fDrop),
      field("Typ", fTyp, { hint: "Restock behöver ingen ny sample" }), field("Status", fStatus),
      field("I lager senast", fKlart, { hint: "När plaggen ska finnas på lager" }), field("Fotosample senast", fFoto, { hint: "Valfritt" }),
      field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);
    const formState = () => ({ _id: st._id, namn: fNamn.value.trim(), leverantor: fLev.value.trim(), sasong: fSas.value.trim(), drop: fDrop.value.trim(), typ: fTyp.value, status: fStatus.value, klartSenast: fKlart.value || null, fotoSenast: fFoto.value || null, kommentar: fKom.value.trim() });

    const planSec = h("section");
    function renderPlan() {
      const cur = formState(); const p = plan(cur);
      planSec.replaceChildren(h("h3", { class: "sec-title", text: "Tidsplan" }), h("div", { class: "plan-head" }, lagePill(p), h("span", { class: "plan-note", text: p.note || "" })));
      if (p.lage === "klar" || p.lage === "skip" || !p.po) return;
      const rows = [
        ["I lager senast", cur.klartSenast, false, true],
        ["Frakt " + p.frakt + " d → klart hos leverantör", p.ex, false, true],
        ["Produktion " + p.prod + " d" + (p.buff ? " + buffert " + p.buff + " d" : "") + " → PO senast", p.po, true, true],
        ["Utvärdering " + p.utv + " d → sample inne senast", p.inne, false, cur.typ !== "Restock"],
        [p.sl != null ? "Sample-ledtid " + p.sl + " d → sample beställd senast" : "Sample-ledtid saknas för leverantören", p.best, false, cur.typ !== "Restock"]
      ];
      const box = h("div", { class: "plan" });
      for (const [label, date, key, show] of rows) {
        if (!show) continue;
        const d = isISO(date) ? diffDays(date) : null;
        box.append(h("div", { class: "plan-row" + (key ? " key" : "") }, h("span", { text: label }), h("span", { class: "mono", text: isISO(date) ? fmtDate(date) : "–" }), h("span", { class: "plan-x mono " + (d == null ? "" : d < 0 ? "late" : d < 14 ? "soon" : ""), text: d == null ? "" : fmtDays(d) })));
      }
      planSec.append(box);
      if (isISO(cur.fotoSenast) && st._id) {
        const fotos = samplesOfStyle(st._id).filter((x) => x.version === "Fotosample");
        const ok = fotos.some((x) => x.status === "Mottagen" || (expected(x) && expected(x) <= cur.fotoSenast));
        planSec.append(h("p", { class: ok ? "okline" : "warnline", text: ok ? "Fotosample hinner till " + fmtDate(cur.fotoSenast) + "." : "Ingen fotosample hinner till " + fmtDate(cur.fotoSenast) + "." }));
      }
    }
    [fLev, fKlart, fStatus, fTyp, fFoto].forEach((x) => x.addEventListener("change", () => { renderPlan(); renderEanTable(); }));
    fKlart.addEventListener("input", renderPlan);

    const samplesSec = h("section");
    function renderSamples() {
      samplesSec.replaceChildren();
      if (isNew) return;
      const xs = samplesOfStyle(st._id);
      const ul = h("ul", { class: "mini" });
      for (const x of xs) {
        const e = x.status === "Mottagen" ? (x.mottagen ? "mott. " + fmtDate(x.mottagen) : "mottagen") : expected(x) ? "väntas " + fmtDate(expected(x)) : "TBA";
        ul.append(h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openSample(x._id) }, tag(x._id),
          h("span", { class: "mini-main" }, h("strong", { text: x.version || "–" }), h("span", { class: "sub", text: [x.farg, tygName(x), platsText(x)].filter(Boolean).join(" · ") })),
          h("span", { class: "mini-side" }, statusPill(x.status), x.beslut ? chip(x.beslut, "b-" + slug(x.beslut)) : null, h("span", { class: "sub mono", text: e })))));
      }
      if (!xs.length) ul.append(h("li", { class: "sub", text: "Inga samples ännu." }));
      samplesSec.append(h("h3", { class: "sec-title", text: "Samples (" + xs.length + ")" }), ul);
      if (!ro) { const last = xs[xs.length - 1]; samplesSec.append(h("button", { class: "btn small", type: "button", text: "+ Ny sample för stylen", onclick: () => openSample(null, { styleId: st._id, leverantor: current().leverantor || "", version: last ? nextVersion(last.version) : "Proto 1", tygId: last ? last.tygId : null }) })); }
      const tygIds = uniq(xs.map((x) => x.tygId));
      const tygChips = tygIds.map((id) => { const tt = byId(D.tyger, id); const s = stockText(id); return chip((tt ? tt.namn : id) + (s ? " · eget lager: " + s : "")); });
      const loose = uniq(xs.filter((x) => !x.tygId).map((x) => x.material)).map((m) => chip(m));
      if (tygChips.length || loose.length) samplesSec.append(h("div", { class: "chips" }, h("span", { class: "sub", text: "Tyger:" }), tygChips, loose));
    }

    const fFarger = inp("f_sfarger", (st.farger || []).join(", "), { placeholder: "t.ex. Navy, Green" });
    const fPreset = selectEl("f_spreset", [["", "Välj skala …"]].concat(SIZE_PRESETS.map(([l, v]) => [v, l])), "");
    const fStorl = inp("f_sstorlekar", (st.storlekar || []).join(", "), { placeholder: "t.ex. S, M, L, XL" });
    if (ro) [fFarger, fPreset, fStorl].forEach((x) => (x.disabled = true));
    fPreset.addEventListener("change", () => { if (fPreset.value) { fStorl.value = fPreset.value; fPreset.value = ""; renderEanTable(); } });
    fFarger.addEventListener("input", () => renderEanTable());
    fStorl.addEventListener("input", () => renderEanTable());
    const eanTable = h("div");
    const eanActions = h("div", { class: "ean-actions" });
    const eanSec = h("section");
    if (isNew) eanSec.append(h("h3", { class: "sec-title", text: "Varianter och EAN" }), h("p", { class: "hint", text: "Spara stylen först." }));
    else eanSec.append(h("h3", { class: "sec-title", text: "Varianter och EAN" }), h("div", { class: "form" }, field("Färger", fFarger, { full: true, hint: "Separera med komma, som de ska heta i Shopify" }), field("Storleksskala", fPreset), field("Storlekar", fStorl)), eanTable, eanActions);
    function renderEanTable() {
      if (isNew) return;
      const cur = current();
      const existing = cur.ean || [];
      const vs = variants(parseList(fFarger.value), parseList(fStorl.value));
      const have = new Map(existing.map((e) => [vkey(e), e]));
      const rows = vs.map((v) => ({ v, e: have.get(vkey(v)) || null }));
      for (const e of existing) if (!vs.some((v) => vkey(v) === vkey(e))) rows.push({ v: e, e, orphan: true });
      const missing = rows.filter((r) => !r.e).length;
      eanTable.replaceChildren();
      if (!rows.length) eanTable.append(h("p", { class: "hint", text: "Fyll i färger och storlekar så visas varianterna här." }));
      else {
        const tb = h("tbody", null, rows.map((r) => h("tr", { class: r.orphan ? "orphan" : null }, h("td", { text: r.v.farg }), h("td", { text: r.v.storlek }), h("td", { class: "mono" }, r.e ? r.e.ean : h("span", { class: "muted", text: "–" }), r.orphan ? h("span", { class: "sub", text: " (ej längre i listan)" }) : null))));
        eanTable.append(h("div", { class: "vscroll" }, h("table", { class: "vtable" }, h("thead", null, h("tr", null, h("th", { text: "Färg" }), h("th", { text: "Storlek" }), h("th", { text: "EAN" }))), tb)));
      }
      eanActions.replaceChildren();
      if (!ro && missing > 0) {
        if (!EAN_OK_STATUS.includes(fStatus.value)) eanActions.append(h("p", { class: "hint", text: "EAN tilldelas när stylen är Godkänd." }));
        else eanActions.append(h("button", { class: "btn small primary", type: "button", text: "Tilldela EAN till " + missing + (missing === 1 ? " variant" : " varianter"), onclick: () => confirmAssign(missing) }));
      }
      if (existing.length && downloads) eanActions.append(h("button", { class: "btn small", type: "button", text: "Exportera CSV", onclick: () => exportStyleEan(cur) }));
      if (existing.length) eanActions.append(h("span", { class: "sub", text: existing.length + " EAN tilldelade" }));
    }
    function confirmAssign(n) {
      const p = D.pool;
      if (!p) { toast("EAN-serien är inte inställd."); return; }
      const pre = String(p.prefix);
      const first = ean13(pre + String(p.nasta).padStart(12 - pre.length, "0"));
      eanActions.replaceChildren(h("span", { class: "confirm" }, h("span", { text: "Tilldela " + n + " EAN från " + first + "?" }), h("button", { class: "btn small primary", type: "button", text: "Ja, tilldela", onclick: doAssign }), h("button", { class: "btn small", type: "button", text: "Avbryt", onclick: renderEanTable })));
    }
    async function doAssign() {
      const cur = current();
      const farger = parseList(fFarger.value), storlekar = parseList(fStorl.value);
      const existing = cur.ean || [];
      const have = new Set(existing.map(vkey));
      const missing = variants(farger, storlekar).filter((v) => !have.has(vkey(v)));
      if (!missing.length) { renderEanTable(); return; }
      eanActions.replaceChildren(h("span", { class: "sub", text: "Tilldelar …" }));
      let codes;
      try { codes = await allocateEan(missing.length); }
      catch (e) {
        const c = e && e.code;
        toast(c === "busy" ? "Någon annan tilldelar EAN just nu. Försök igen om några sekunder." : c === "empty" ? "EAN-serien räcker inte till." : c === "nopool" ? "EAN-serien är inte inställd." : "Kunde inte reservera EAN. Försök igen.");
        renderEanTable(); return;
      }
      const t = new Date().toISOString();
      const added = missing.map((v, i) => ({ farg: v.farg, storlek: v.storlek, ean: codes[i], t, av: myId }));
      const range = codes[0] + (codes.length > 1 ? "–" + codes[codes.length - 1] : "");
      const patch = { farger, storlekar, ean: existing.concat(added), logg: (cur.logg || []).concat(logEntry(added.length + " EAN tilldelade (" + range + ")")), andrad: t };
      if (fStatus.value !== cur.status) patch.status = fStatus.value;
      const ok = await write("styles", cur._id, patch);
      try { await db.collection("eanLogg").doc("L" + Date.now() + Math.random().toString(36).slice(2, 6)).set({ t, av: myId, styleId: cur._id, styleNamn: cur.namn, antal: codes.length, forsta: codes[0], sista: codes[codes.length - 1], sparad: ok }); } catch (e) {}
      toast(ok ? added.length + " EAN tilldelade" : "EAN " + range + " reserverades men kunde inte sparas på stylen. Notera numren.");
      if (!ok) renderEanTable();
    }

    const logUl = h("ul", { class: "log" });
    const noteIn = inp("f_snote", "", { placeholder: "Anteckning om stylen" });
    const addNote = async () => { const t = noteIn.value.trim(); const cur = current(); if (!t || isNew) return; if (await write("styles", cur._id, { logg: (cur.logg || []).concat(logEntry(t)), andrad: new Date().toISOString() })) noteIn.value = ""; };
    noteIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } });

    async function save() {
      const o = formState(); delete o._id;
      o.farger = parseList(fFarger.value); o.storlekar = parseList(fStorl.value);
      if (!o.namn) { toast("Ge stylen ett namn."); fNamn.focus(); return; }
      const btn = $("btnSave"); if (btn) btn.disabled = true;
      try {
        const now = new Date().toISOString();
        if (isNew) {
          const nid = await freshId("styles", D.styles, "ST-", 3);
          const body = Object.assign({ id: nid, ean: [], logg: [logEntry("Style skapad")], andrad: now }, o);
          if (await create("styles", nid, body)) { if (!byId(D.styles, nid)) D.styles.push(Object.assign({}, body, { _id: nid })); toast(nid + " sparad"); openStyle(nid); }
        } else {
          const cur = current();
          const changes = describeChanges(cur, o, ST_LABELS);
          if (!changes.length) { closeSheet(); return; }
          if (await write("styles", cur._id, Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) }))) { toast("Sparat"); closeSheet(); }
        }
      } finally { if (btn) btn.disabled = false; }
    }

    const nSamples = isNew ? 0 : samplesOfStyle(st._id).length;
    const body = [form, planSec, samplesSec, eanSec];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl, ro ? null : h("div", { class: "add-note" }, noteIn, h("button", { class: "btn small", type: "button", text: "Lägg till", onclick: addNote }))));
    openSheet({
      tag: isNew ? "Ny" : st._id,
      title: isNew ? "Ny style" : st.namn,
      sub: isNew ? "" : [st.leverantor, st.sasong, st.drop].filter(Boolean).join(" · "),
      body,
      foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("styles", st._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: !nSamples && !(st.ean || []).length, blockText: "Stylen har samples eller EAN kopplade", onSave: save }),
      ctx: { refresh: () => { if (!isNew && !byId(D.styles, st._id)) { closeSheet(); return; } renderPlan(); renderSamples(); renderEanTable(); if (!isNew) renderLogInto(logUl, current().logg); } },
      focus: isNew ? "f_snamn" : null
    });
    renderPlan(); renderSamples(); renderEanTable();
    if (!isNew) renderLogInto(logUl, st.logg);
  }

  // ---------- fabric sheet ----------
  function openTyg(id) {
    const isNew = !id;
    const t = isNew ? { _id: null, status: "" } : byId(D.tyger, id);
    if (!t) { toast("Hittar inte " + id + "."); return; }
    const ro = !canWrite || !db;
    const fNamn = inp("f_tnamn", t.namn, { placeholder: "t.ex. Japan Blue inhouse – Westpoint Canvas 223" });
    const fLev = inp("f_tlev", t.leverantor, { list: "dlLev", autocomplete: "off" });
    const fStatus = selectEl("f_tstatus", [["", "–"]].concat(TYG_STATUS), t.status || "");
    const fAter = inp("f_tater", t.aterDatum, { type: "date" });
    const fKom = area("f_tkom", t.kommentar, "T.ex. vilka färger som är slut");
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() }, field("Namn", fNamn, { full: true }), field("Leverantör / väveri", fLev), field("Status", fStatus), field("Åter i lager", fAter, { hint: "Om tyget är slut" }), h("div"), field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);
    const used = h("section");
    const stock = h("section");
    const renderUsed = () => {
      const xs = isNew ? [] : D.samples.filter((s) => s.tygId === t._id).sort((a, b) => a._id.localeCompare(b._id));
      used.replaceChildren(h("h3", { class: "sec-title", text: "Använt i (" + xs.length + ")" }), xs.length ? h("ul", { class: "mini" }, xs.map((x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openSample(x._id) }, tag(x._id), h("span", { class: "mini-main" }, h("strong", { text: styleName(x) }), h("span", { class: "sub", text: [x.version, x.farg].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, statusPill(x.status)))))) : h("p", { class: "hint", text: "Inga samples använder tyget ännu." }));
      const lots = isNew ? [] : lotsOf(t._id).sort((a, b) => (a.status === "Förbrukad") - (b.status === "Förbrukad") || a._id.localeCompare(b._id));
      stock.replaceChildren(h("h3", { class: "sec-title", text: "Eget lager" + (lots.length ? " · " + (stockText(t._id) || "allt förbrukat") : "") }),
        lots.length ? h("ul", { class: "mini" }, lots.map((x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openLager(x._id) }, tag(x._id),
          h("span", { class: "mini-main" }, h("strong", { text: x.plats || "Utan plats" }), h("span", { class: "sub", text: [x.farg, reservedName(x) ? "reserverad: " + reservedName(x) : ""].filter(Boolean).join(" · ") })),
          h("span", { class: "mini-side" }, h("span", { class: "pill ls-" + slug(x.status || "x"), text: x.status || "–" }), h("span", { class: "sub mono", text: num(x.meter) != null ? "ca " + fmtM(x.meter) + " m" : "meter saknas" })))))) : h("p", { class: "hint", text: isNew ? "Spara tyget först." : "Inget eget lager registrerat för tyget." }),
        !isNew && !ro ? h("button", { class: "btn small", type: "button", text: "+ Nytt parti av tyget", onclick: () => openLager(null, { tygId: t._id, tygNamn: t.namn }) }) : null);
    };
    renderUsed();
    async function save() {
      const o = { namn: fNamn.value.trim(), leverantor: fLev.value.trim(), status: fStatus.value, aterDatum: fAter.value || null, kommentar: fKom.value.trim() };
      if (!o.namn) { toast("Ge tyget ett namn."); fNamn.focus(); return; }
      if (D.tyger.some((x) => x._id !== t._id && norm(x.namn) === norm(o.namn))) { toast("Det finns redan ett tyg med det namnet."); return; }
      const now = new Date().toISOString();
      if (isNew) { const nid = await freshId("tyger", D.tyger, "T-", 3); if (await create("tyger", nid, Object.assign({ id: nid, andrad: now }, o))) { toast(nid + " sparat"); closeSheet(); } }
      else if (await write("tyger", t._id, Object.assign({ andrad: now }, o))) { toast("Sparat"); closeSheet(); }
    }
    const inUse = !isNew && (D.samples.some((s) => s.tygId === t._id) || lotsOf(t._id).length > 0);
    openSheet({ tag: isNew ? "Nytt" : t._id, title: isNew ? "Nytt tyg" : t.namn, sub: isNew ? "" : t.leverantor || "", body: [form, stock, used], foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("tyger", t._id)) { toast("Borttaget"); closeSheet(); } }, canDelete: !inUse, blockText: "Tyget används av samples eller har lager", onSave: save }), ctx: { refresh: renderUsed }, focus: isNew ? "f_tnamn" : null });
  }

  // ---------- fabric lot sheet ----------
  const L_LABELS = { tygId: "Tyg", farg: "Färg", plats: "Plats", status: "Status", inkoptMeter: "Inköpt (m)", meter: "Kvar (m)", bredd: "Bredd (cm)", prisPerMeter: "Pris per meter", prisValuta: "Valuta", inkopt: "Inköpt", reserveradFor: "Reserverad för", kommentar: "Kommentar" };
  function openLager(id, preset) {
    const isNew = !id;
    const l = isNew ? Object.assign({ _id: null, status: "I lager", plats: "", logg: [] }, preset || {}) : byId(D.lager, id);
    if (!l) { toast("Hittar inte " + id + "."); return; }
    const ro = !canWrite || !db;
    const current = () => (isNew ? l : byId(D.lager, l._id) || l);
    const initTyg = tygOf(l) ? tygOf(l).namn : (l.tygNamn || "");
    const fTyg = inp("f_ltyg", initTyg, { list: "dlTyg", autocomplete: "off", placeholder: "t.ex. Olmetex – C993950" });
    const fFarg = inp("f_lfarg", l.farg, { placeholder: "t.ex. col 1780 (Navy)" });
    const fPlats = inp("f_lplats", l.plats, { list: "dlPlats", autocomplete: "off", placeholder: "Leverantör eller " + EGET_LAGER });
    const fStatus = selectEl("f_lstatus", LAGER_STATUS, l.status || "I lager");
    const fInk = inp("f_link", l.inkoptMeter, { type: "number", min: "0", step: "0.5", inputmode: "decimal" });
    const fKvar = inp("f_lkvar", l.meter, { type: "number", min: "0", step: "0.5", inputmode: "decimal", placeholder: "ungefär" });
    const fBredd = inp("f_lbredd", l.bredd, { type: "number", min: "0", step: "1", inputmode: "numeric" });
    const fPris = inp("f_lpris", l.prisPerMeter, { type: "number", min: "0", step: "0.01", inputmode: "decimal" });
    const fVal = selectEl("f_lval", [["", "–"], "SEK", "EUR", "JPY", "GBP", "USD"], l.prisValuta || "");
    const fInkDate = inp("f_linkopt", l.inkopt, { type: "date" });
    const styleOpts = [["", "– Ingen –"]].concat(D.styles.filter((s) => isActiveStyle(s) || s._id === l.reserveradFor).sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv")).map((s) => [s._id, s.namn + (s.sasong ? " · " + s.sasong : "")]));
    const fRes = selectEl("f_lres", styleOpts, l.reserveradFor || "");
    const fKom = area("f_lkom", l.kommentar, "T.ex. vad partiet är tänkt till, eller varifrån metertalet kommer");
    fInk.addEventListener("change", () => { if (isNew && !fKvar.value && fInk.value) fKvar.value = fInk.value; });
    const form = h("form", { class: "form", id: "lagerForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      field("Tyg", fTyg, { full: true, hint: "Skriv fritt eller välj ett tyg som redan finns." }),
      field("Färg / kulör", fFarg), field("Ligger hos", fPlats),
      field("Status", fStatus), field("Reserverad för", fRes),
      h("h3", { class: "sec-title full", text: "Meter" }),
      field("Inköpt (m)", fInk), field("Kvar (m, ca)", fKvar, { hint: "Tomt = vet inte ännu" }),
      field("Bredd (cm)", fBredd), field("Inköpt datum", fInkDate),
      field("Pris per meter", fPris), field("Valuta", fVal),
      field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);

    const quick = h("div", { class: "quick" });
    const logUl = h("ul", { class: "log" });
    const noteIn = inp("f_lnote", "", { placeholder: "Anteckning, t.ex. Roberto räknade 12 m" });
    noteIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } });
    async function addNote() {
      const t = noteIn.value.trim(); const cur = current(); if (!t || isNew) return;
      if (await write("tyglager", cur._id, { logg: (cur.logg || []).concat(logEntry(t)), andrad: new Date().toISOString() })) noteIn.value = "";
    }
    function renderQuick() {
      const cur = current();
      quick.replaceChildren();
      if (isNew || ro) { quick.hidden = true; return; }
      quick.hidden = false;
      const add = (label, fn, primary) => quick.append(h("button", { class: "btn small" + (primary ? " primary" : ""), type: "button", text: label, onclick: fn }));
      if (cur.status === "I lager") add("Justera meter", () => adjustMeters(cur), true);
      if (cur.status === "Beställd") add("Levererat", () => quickUpdate(cur, { status: "I lager" }, "Markerat som i lager"), true);
      if (cur.status !== "Förbrukad") add("Förbrukat", () => quickUpdate(cur, { status: "Förbrukad", meter: 0, raknad: todayISO() }, "Markerat som förbrukat"));
      if (cur.tygId && byId(D.tyger, cur.tygId)) add("Öppna tyg", () => openTyg(cur.tygId));
    }
    function adjustMeters(cur) {
      const i = inp("f_ladj", cur.meter, { type: "number", min: "0", step: "0.5", inputmode: "decimal", "aria-label": "Nya meter" });
      const row = h("div", { class: "admin-row" }, h("span", { text: "Kvar nu (m):" }), i,
        h("button", { class: "btn small primary", type: "button", text: "Spara", onclick: async () => {
          const n = num(i.value); if (n == null || n < 0) { toast("Ange ett metertal."); return; }
          const before = num(cur.meter);
          const patch = { meter: n, raknad: todayISO() };
          const body = Object.assign({}, patch, { andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry("Kvar: " + (before == null ? "okänt" : fmtM(before) + " m") + " → " + fmtM(n) + " m")) });
          if (await write("tyglager", cur._id, body)) { toast("Meter uppdaterade"); fKvar.value = n; renderQuick(); }
        } }),
        h("button", { class: "btn small", type: "button", text: "Avbryt", onclick: renderQuick }));
      quick.replaceChildren(row); i.focus(); i.select();
    }
    async function quickUpdate(cur, patch, msg) {
      const changes = describeChanges(cur, patch, L_LABELS);
      const body = Object.assign({}, patch, { andrad: new Date().toISOString(), logg: (cur.logg || []).concat(changes.map(logEntry)) });
      const ok = await write("tyglager", cur._id, body);
      if (ok) { toast(msg); if ("status" in patch) fStatus.value = patch.status; if ("meter" in patch) fKvar.value = patch.meter == null ? "" : patch.meter; }
      return ok;
    }
    async function save() {
      const btn = $("btnSave"); if (btn) btn.disabled = true;
      try {
        const name = fTyg.value.trim(), plats = fPlats.value.trim();
        if (!name) { toast("Skriv vilket tyg det gäller."); fTyg.focus(); return; }
        if (!plats) { toast("Skriv var tyget ligger."); fPlats.focus(); return; }
        const tygId = await resolveTyg(name, "");
        if (!tygId) return;
        const tt = byId(D.tyger, tygId);
        const o = { tygId, tygNamn: tt ? tt.namn : name, farg: fFarg.value.trim(), plats, status: fStatus.value, inkoptMeter: num(fInk.value), meter: num(fKvar.value), bredd: num(fBredd.value), prisPerMeter: num(fPris.value), prisValuta: fVal.value || null, inkopt: fInkDate.value || null, reserveradFor: fRes.value || null, kommentar: fKom.value.trim() };
        const now = new Date().toISOString();
        if (isNew) {
          const nid = await freshId("tyglager", D.lager, "TL-", 3);
          const body = Object.assign({ id: nid, raknad: o.meter != null ? todayISO() : null, logg: [logEntry("Parti skapat (" + o.status + (o.meter != null ? ", ca " + fmtM(o.meter) + " m" : "") + ")")], andrad: now }, o);
          if (await create("tyglager", nid, body)) { if (!byId(D.lager, nid)) D.lager.push(Object.assign({}, body, { _id: nid })); toast(nid + " sparat"); closeSheet(); }
        } else {
          const cur = current();
          const changes = describeChanges(cur, o, L_LABELS);
          if (!changes.length) { closeSheet(); return; }
          const body = Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) });
          if (num(cur.meter) !== o.meter) body.raknad = todayISO();
          if (await write("tyglager", cur._id, body)) { toast("Sparat"); closeSheet(); }
        }
      } finally { if (btn) btn.disabled = false; }
    }
    const body = [quick, form];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl, ro ? null : h("div", { class: "add-note" }, noteIn, h("button", { class: "btn small", type: "button", text: "Lägg till", onclick: addNote }))));
    openSheet({
      tag: isNew ? "Nytt" : l._id,
      title: isNew ? "Nytt tygparti" : lotName(l) + (l.farg ? " · " + l.farg : ""),
      sub: isNew ? "" : [l.plats, num(l.meter) != null ? "ca " + fmtM(l.meter) + " m kvar" : "meter saknas", l.status].filter(Boolean).join(" · "),
      body,
      foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("tyglager", l._id)) { toast("Borttaget"); closeSheet(); } }, canDelete: true, onSave: save }),
      ctx: { refresh: () => { if (!isNew && !byId(D.lager, l._id)) { closeSheet(); return; } renderQuick(); if (!isNew) renderLogInto(logUl, current().logg); } },
      focus: isNew ? (preset && preset.tygId ? "f_lplats" : "f_ltyg") : null
    });
    renderQuick();
    if (!isNew) renderLogInto(logUl, l.logg);
  }

  // ---------- supplier sheet ----------
  function openLev(id) {
    const isNew = !id;
    const l = isNew ? { _id: null } : byId(D.lev, id);
    if (!l) { toast("Hittar inte leverantören."); return; }
    const ro = !canWrite || !db;
    const fNamn = inp("f_lnamn", l.namn);
    if (!isNew) fNamn.disabled = true;
    const fKod = inp("f_lkod", l.kod, { placeholder: "t.ex. JPB" });
    const fSl = inp("f_lsample", l.sampleLedtid, { type: "number", min: "0", step: "1" });
    const fProd = inp("f_lprod", l.produktionstid, { type: "number", min: "0", step: "1" });
    const fFrakt = inp("f_lfrakt", l.frakt, { type: "number", min: "0", step: "1", placeholder: "standard" });
    const fBuff = inp("f_lbuff", l.buffert, { type: "number", min: "0", step: "1" });
    const fVal = selectEl("f_lvaluta", [["", "–"], "SEK", "EUR", "JPY", "GBP", "USD"], l.valuta || "");
    const fKontakt = inp("f_lkontakt", l.kontakt, { placeholder: "Namn och e-post" });
    const fKom = area("f_lkom", l.kommentar);
    const a = isNew ? null : actualLead(l.namn);
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      field("Namn", fNamn, { hint: isNew ? "Skriv som det står på samples" : "Namnet kopplar ihop samples och styles" }), field("Kod", fKod),
      field("Sample-ledtid (dagar)", fSl, { hint: a ? "Faktiskt snitt " + a.avg + " d (" + a.n + " samples)" : "Från beställning till mottagen sample" }),
      field("Produktionstid (dagar)", fProd, { hint: "Från PO till klart hos leverantör" }),
      field("Frakt (dagar)", fFrakt, { hint: "Tomt = standard " + (num(D.settings.standardFrakt) ?? 7) + " d" }),
      field("Buffert (dagar)", fBuff, { hint: "Extra marginal om leverantören brukar bli sen" }),
      field("Valuta", fVal), field("Kontakt", fKontakt), field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);
    async function save() {
      const o = { namn: fNamn.value.trim(), kod: fKod.value.trim(), sampleLedtid: num(fSl.value), produktionstid: num(fProd.value), frakt: num(fFrakt.value), buffert: num(fBuff.value) ?? 0, valuta: fVal.value, kontakt: fKontakt.value.trim(), kommentar: fKom.value.trim(), andrad: new Date().toISOString() };
      if (!o.namn) { toast("Fyll i namnet."); return; }
      if (isNew) {
        const nid = slug(o.namn) || "lev-" + Date.now();
        if (byId(D.lev, nid) || levByName(o.namn)) { toast("Leverantören finns redan."); return; }
        if (await create("leverantorer", nid, o)) { toast("Sparad"); closeSheet(); }
      } else { delete o.namn; if (await write("leverantorer", l._id, o)) { toast("Sparat"); closeSheet(); } }
    }
    const inUse = !isNew && (D.samples.some((s) => norm(s.leverantor) === norm(l.namn)) || D.styles.some((s) => norm(s.leverantor) === norm(l.namn)));
    openSheet({ tag: isNew ? "Ny" : l.kod || "", title: isNew ? "Ny leverantör" : l.namn, body: [form], foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("leverantorer", l._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: !inUse, blockText: "Leverantören används av samples eller styles", onSave: save }), focus: isNew ? "f_lnamn" : null });
  }

  // ---------- exports ----------
  async function saveFile(filename, data) {
    if (!downloads) { toast("Nedladdning är inte tillgänglig här."); return false; }
    try { await downloads.save({ filename, data }); return true; }
    catch (e) {
      const c = e && e.code;
      if (c === "declined") return false;
      if (c === "rate_limited") toast("En nedladdning väntar redan på svar.");
      else if (["unavailable", "not_granted", "capability_disabled", "capability_removed"].includes(c)) toast("Nedladdning är inte tillgänglig här.");
      else toast("Nedladdningen misslyckades.");
      return false;
    }
  }
  function csv(header, rows) {
    const q = (v) => { const s = v == null ? "" : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return "﻿" + header.join(";") + "\n" + rows.map((r) => r.map(q).join(";")).join("\n");
  }
  const safeName = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") || "export";
  function exportSamples() {
    const rows = D.samples.slice().sort((a, b) => a._id.localeCompare(b._id)).map((s) => { const e = expected(s); return [s._id, styleName(s), s.version, s.leverantor, s.farg, tygName(s), s.storlek, s.prisBelopp, s.prisValuta, s.bestalld, s.ledtid, e || "TBA", s.status, s.mottagen, platsText(s), s.platsNotering, s.beslut, s.andringar, s.tracking, s.p1Skickad, s.p2Skickad, seasonOf(s), s.kommentar]; });
    saveFile("Rubato_Samples_" + todayISO() + ".csv", csv(["Sample-ID", "Style", "Version", "Leverantör", "Färg", "Tyg", "Storlek", "Pris", "Valuta", "Beställd", "Ledtid (dgr)", "Förväntad leverans", "Status", "Mottagen", "Plats", "Platsnotering", "Beslut", "Ändringar", "Tracking", "P1 skickad", "P2 skickad", "Säsong", "Kommentar"], rows));
  }
  function exportLager() {
    const rows = D.lager.slice().sort((a, b) => (a.plats || "").localeCompare(b.plats || "", "sv") || a._id.localeCompare(b._id)).map((l) => [l._id, lotName(l), l.farg, l.plats, l.status, l.inkoptMeter, l.meter, l.bredd, l.prisPerMeter, l.prisValuta, l.inkopt, reservedName(l), l.raknad, l.kommentar]);
    saveFile("Rubato_Tyglager_" + todayISO() + ".csv", csv(["Parti-ID", "Tyg", "Färg", "Ligger hos", "Status", "Inköpt (m)", "Kvar (m, ca)", "Bredd (cm)", "Pris per meter", "Valuta", "Inköpt datum", "Reserverad för", "Senast räknad", "Kommentar"], rows));
  }
  function exportStyleEan(st) {
    saveFile("EAN_" + safeName(st.namn) + ".csv", csv(["Produkt", "Färg", "Storlek", "EAN"], (st.ean || []).map((e) => [st.namn, e.farg, e.storlek, e.ean])));
  }
  function exportAllEan() {
    const rows = [];
    for (const s of D.styles) for (const e of s.ean || []) rows.push([s.namn, s._id, s.leverantor, e.farg, e.storlek, e.ean, e.t ? String(e.t).slice(0, 10) : ""]);
    rows.sort((a, b) => String(a[5]).localeCompare(String(b[5])));
    saveFile("Rubato_EAN_" + todayISO() + ".csv", csv(["Produkt", "Style-ID", "Leverantör", "Färg", "Storlek", "EAN", "Tilldelad"], rows));
  }

  // ---------- labels (A4, 3 x 8, 70 x 37 mm, QR to the sample) ----------
  // <label-fn>
  function drawLabels(JsPDF, qrcode, items, start, appUrl) {
    const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const W = 70, H = 297 / 8, P = 4;
    let pos = Math.max(0, Math.min(23, (start || 1) - 1));
    const fit = (t, w) => { t = String(t || ""); if (doc.getTextWidth(t) <= w) return t; while (t.length > 1 && doc.getTextWidth(t + "...") > w) t = t.slice(0, -1); return t.replace(/\s+$/, "") + "..."; };
    items.forEach((it, i) => {
      if (i > 0 && pos > 23) { doc.addPage(); pos = 0; }
      const x = (pos % 3) * W, y = Math.floor(pos / 3) * H;
      const qr = qrcode(0, "M"); qr.addData(appUrl + "#" + it.id); qr.make();
      const n = qr.getModuleCount(), q = H - 2 * P - 2, cell = q / n;
      const qx = x + W - P - q, qy = y + (H - q) / 2;
      doc.setFillColor(0, 0, 0);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(qx + c * cell, qy + r * cell, cell + 0.02, cell + 0.02, "F");
      const tx = x + P, tw = qx - tx - 2;
      let ty = y + P + 5.2;
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(it.id, tx, ty);
      ty += 5.2; doc.setFontSize(8.5); doc.text(fit(it.title, tw), tx, ty);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      for (const line of it.lines) { ty += 3.7; if (line) doc.text(fit(line, tw), tx, ty); }
      pos++;
    });
    return doc;
  }
  // </label-fn>
  function loadScript(src) { return new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = src; sc.async = true; sc.onload = () => res(); sc.onerror = () => rej(new Error("load")); document.head.appendChild(sc); }); }
  async function loadLibs() { if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript(LIB_PDF); if (typeof window.qrcode !== "function") await loadScript(LIB_QR); }
  const labelItem = (s) => ({ id: s._id, title: styleName(s), lines: [[s.version, s.farg].filter(Boolean).join(" · "), tygName(s), [s.leverantor, platsText(s)].filter(Boolean).join(" · "), s.mottagen ? "Mottagen " + fmtDate(s.mottagen) : s.bestalld ? "Beställd " + fmtDate(s.bestalld) : ""] });
  let lblIds = [];
  const unprinted = () => D.samples.filter((s) => s.status === "Mottagen" && !s.etikett).map((s) => s._id);
  function openLabels(ids) {
    lblIds = (ids && ids.length ? ids : unprinted()).filter((id) => byId(D.samples, id));
    const sel = $("lblStart");
    if (!sel.options.length) for (let i = 1; i <= 24; i++) sel.add(new Option(String(i), String(i)));
    renderLabelDlg();
    $("lblScrim").hidden = false; $("lblDlg").hidden = false;
    setTimeout(() => $("lblStart").focus(), 30);
  }
  function renderLabelDlg() {
    const n = lblIds.length, start = Number($("lblStart").value || 1);
    $("lblWhat").textContent = n ? n + (n === 1 ? " etikett: " : " etiketter: ") + lblIds.slice().sort().slice(0, 14).join(", ") + (n > 14 ? " …" : "") : "Inga samples valda. Välj i listan eller ta alla mottagna utan etikett.";
    $("lblGrid").replaceChildren(...Array.from({ length: 24 }, (_, i) => h("span", { class: i + 1 < start ? "skip" : i + 1 < start + n ? "use" : null })));
    const pages = Math.max(1, Math.ceil((start - 1 + n) / 24));
    $("lblGo").textContent = pages > 1 ? "Ladda ner PDF (" + pages + " ark)" : "Ladda ner PDF";
    $("lblGo").disabled = !n || !downloads;
  }
  function closeLabels() { $("lblScrim").hidden = true; $("lblDlg").hidden = true; }
  $("lblStart").addEventListener("change", renderLabelDlg);
  $("lblAll").addEventListener("click", () => { lblIds = unprinted(); renderLabelDlg(); });
  $("lblCancel").addEventListener("click", closeLabels);
  $("lblScrim").addEventListener("click", closeLabels);
  $("lblGo").addEventListener("click", async () => {
    const btn = $("lblGo"); btn.disabled = true; btn.textContent = "Skapar PDF …";
    try {
      await loadLibs();
      const items = lblIds.map((id) => byId(D.samples, id)).filter(Boolean).sort((a, b) => a._id.localeCompare(b._id)).map(labelItem);
      const doc = drawLabels(window.jspdf.jsPDF, window.qrcode, items, Number($("lblStart").value || 1), APP_URL);
      const ok = await saveFile("Rubato_sample-etiketter_" + todayISO() + ".pdf", doc.output("blob"));
      if (ok) {
        toast("Etikett-PDF klar");
        if (canWrite) { const today = todayISO(); for (const id of lblIds.slice()) { const s = byId(D.samples, id); if (s && s.etikett !== today) await write("samples", id, { etikett: today }); } }
        selected.clear(); closeLabels(); scheduleRefresh();
      }
    } catch (e) { toast(e && e.message === "load" ? "Kunde inte ladda PDF-verktyget. Kontrollera nätet och försök igen." : "Kunde inte skapa PDF:en."); }
    finally { renderLabelDlg(); }
  });

  // ---------- deep links ----------
  let hashDone = false;
  function openFromHash() {
    if (hashDone) return;
    const k = decodeURIComponent((location.hash || "").slice(1));
    if (!k || VIEWS[k]) { hashDone = true; return; }
    if (/^S\d+$/i.test(k)) { if (!loaded.has("samples") || !loaded.has("styles")) return; hashDone = true; if (UI.tab !== "samples") switchTab("samples"); openSample(k.toUpperCase()); }
    else if (/^ST-\d+$/i.test(k)) { if (!loaded.has("styles") || !loaded.has("samples")) return; hashDone = true; if (UI.tab !== "styles") switchTab("styles"); openStyle(k.toUpperCase()); }
    else if (/^T-\d+$/i.test(k)) { if (!loaded.has("tyger")) return; hashDone = true; if (UI.tab !== "tyger") switchTab("tyger"); openTyg(k.toUpperCase()); }
    else if (/^TL-\d+$/i.test(k)) { if (!loaded.has("lager") || !loaded.has("tyger")) return; hashDone = true; if (UI.tab !== "tyglager") switchTab("tyglager"); openLager(k.toUpperCase()); }
    else hashDone = true;
  }
  window.addEventListener("hashchange", () => { hashDone = false; const k = (location.hash || "").slice(1); if (VIEWS[k]) switchTab(k); else openFromHash(); });
  function initialTab() {
    const k = (location.hash || "").slice(1);
    if (VIEWS[k]) return k;
    if (/^S\d+$/i.test(k)) return "samples";
    if (/^ST-\d+$/i.test(k)) return "styles";
    if (/^T-\d+$/i.test(k)) return "tyger";
    if (/^TL-\d+$/i.test(k)) return "tyglager";
    return VIEWS[UI.tab] ? UI.tab : "samples";
  }

  // ---------- boot ----------
  function showLogin() {
    $("login").hidden = false;
    $("loginBtn").addEventListener("click", () => { $("loginBtn").disabled = true; P.signIn(); });
  }
  function subError() { banner("Tappade kontakten med databasen. Ladda om sidan."); }
  switchTab(initialTab());
  (async () => {
    let me = null;
    try { me = await P.start(); } catch (e) { console.error(e); banner("Kunde inte läsa databasen: " + (e.message || e)); }
    if (!me) { showLogin(); return; }
    $("login").hidden = true;
    db = P.db; user = P.user; downloads = P.downloads;
    myId = me.id;
    try { canAdmin = await user.canEdit(); } catch (e) {}
    applyWriteMode();
    switchTab(UI.tab);
    const sub = (coll, key) => db.collection(coll).onSnapshot((snap) => {
      D[key] = snap.docs.map((doc) => Object.assign({}, doc.data(), { _id: doc.id }));
      loaded.add(key); scheduleRefresh(); openFromHash();
    }, subError);
    sub("samples", "samples"); sub("styles", "styles"); sub("tyger", "tyger"); sub("tyglager", "lager"); sub("leverantorer", "lev");
    db.doc("ean/pool").onSnapshot((snap) => { D.pool = snap.exists ? snap.data() : null; loaded.add("pool"); scheduleRefresh(); }, subError);
    db.doc("installningar/app").onSnapshot((snap) => { if (snap.exists) Object.assign(D.settings, snap.data()); scheduleRefresh(); }, subError);
    db.collection("eanLogg").orderBy("t", "desc").limit(50).onSnapshot((snap) => { D.logg = snap.docs.map((doc) => Object.assign({}, doc.data(), { _id: doc.id })); scheduleRefresh(); }, subError);
  })();
})();
