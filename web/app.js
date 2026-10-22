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
  const BESLUT = ["Godkänd", "Ny runda", "Pausad", "Kastad"];
  const beslutNorm = (b) => (b === "Underkänd" ? "Kastad" : (b || ""));
  const STYLE_STATUS = ["Sampling", "Godkänd", "PO lagd", "I produktion", "Levererad", "Pausad", "Kastad"];
  const styleStatusNorm = (s) => (s === "Skippad" ? "Kastad" : (s || "Sampling"));
  const PROD_STATUS = ["PO lagd", "I produktion", "Levererad"];
  const STYLE_TYP = ["Nyhet", "Restock", "NOOS"];
  const TYP_LABEL = { Nyhet: "New", Restock: "Re-stock", NOOS: "NOOS" };
  const typLabel = (st) => TYP_LABEL[(st && st.typ) || "Nyhet"] || st.typ;
  const TYG_STATUS = ["OK", "Delvis slut", "Slut", "Utgått"];
  const LAGER_STATUS = ["I lager", "Beställd", "Förbrukad"];
  const EGET_LAGER = "Rubato (eget lager)";
  const EAN_OK_STATUS = ["Godkänd", "PO lagd", "I produktion", "Levererad"];
  const SIZE_PRESETS = [["XS–XXL", "XS, S, M, L, XL, XXL"], ["44–58", "44, 46, 48, 50, 52, 54, 56, 58"], ["One size", "One size"]];
  const defaultSizes = (kategori) => (["Byxor", "Skrädderi"].includes(kategori) ? ["44", "46", "48", "50", "52", "54", "56", "58"] : ["Skjortor", "Stickat & Jersey", "Ytterplagg"].includes(kategori) ? ["XS", "S", "M", "L", "XL", "XXL"] : []);
  const sizesOf = (st) => (st && st.storlekar && st.storlekar.length ? st.storlekar : defaultSizes(st && st.kategori));
  const LAGE_TEXT = { gron: "I fas", gul: "Snävt", rod: "Hinner inte", okand: "Datum saknas", ingen: "Sätt datum", paus: "Pausad", skip: "Kastad" };
  const LAGE_ORDER = { rod: 0, gul: 1, okand: 2, gron: 3, ingen: 4, klar: 5, paus: 6, skip: 7 };
  const DROP_NAMES = ["Drop 1", "Drop 2", "Drop 3", "Tailoring", "Core"];
  const KATEGORIER = ["Byxor", "Ytterplagg", "Skjortor", "Stickat & Jersey", "Accessoarer", "Skrädderi"];
  const PO_STATUS = ["Placeholder", "Inskickad", "PO bekräftad", "I produktion", "Skickad", "Inlevererad", "Problem", "Avbruten"];
  const PO_OPEN = ["Inskickad", "PO bekräftad", "I produktion", "Skickad", "Problem"];
  const PO_COMMITTED = ["PO bekräftad", "I produktion", "Skickad", "Inlevererad"];
  const PO_PLANNED = ["Placeholder", "Inskickad", "Problem"];
  const PO_DRAFT = ["Placeholder", "Avbruten"];
  const LIB_XLSX = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
  const PO_DEFAULTS = { customer: "Dannefalk & Pers AB", email: "info@atemporubato.com", tel: "0046707994668 / 0046708341212", delivery: "Enhagsslingan 4, 187 40 Täby", invoice: "Strindbergsgatan 31, 115 31 Stockholm — EMAIL INVOICE TO: INVOICE@ATEMPORUBATO.COM", label: "Put on labels and barcodes delivered by customer (Rubato)" };
  const PRIORITET = ["Hög", "Normal", "Låg"];
  const TYGSTATUS_PO = ["", "Hos fabrik", "Beställt", "På väg", "Saknas", "Eget lager"];
  const poStatusNorm = (x) => (x === "Utkast" ? "Placeholder" : PO_STATUS.includes(x) ? x : x ? "Inskickad" : "Placeholder");

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
  const D = { samples: [], styles: [], tyger: [], lager: [], lev: [], drops: [], po: [], budget: [], ref: [], pool: null, logg: [], settings: { utvarderingDagar: 7, standardFrakt: 7, marginalGul: 14 } };
  const loaded = new Set();
  let db = null, user = null, downloads = null, assets = null, myId = null, canWrite = true, canAdmin = false;
  const UI = {
    tab: "samples",
    samples: { view: null, status: "aktiva", q: "", lev: "", season: "", plats: "", group: "kategori" },
    drops: { season: "" },
    styles: { view: null, status: "aktiva", q: "", lev: "", season: "" },
    prod: { view: null, status: "aktiva", q: "", lev: "", season: "" },
    koll: { season: "", mode: "drop", kat: "", typ: "alla" },
    foto: { view: null, season: "", q: "" },
    ecom: { view: null, season: "", q: "" },
    shopify: { view: null, status: "ej", q: "", lev: "", season: "", alla: false },
    ref: { status: "ute", q: "" },
    tyger: { q: "", status: "" },
    lager: { view: null, status: "I lager", q: "", plats: "", group: "plats" },
    ean: { q: "" }
  };
  const selected = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem("rubato-samples-v5") || "null");
    if (saved) {
      if (saved.tab) UI.tab = saved.tab;
      if (saved.samples) Object.assign(UI.samples, saved.samples, { view: null, q: "" });
      if (saved.drops) Object.assign(UI.drops, saved.drops);
      if (saved.styles) Object.assign(UI.styles, saved.styles, { view: null, q: "" });
      if (saved.prod) Object.assign(UI.prod, saved.prod, { view: null, q: "" });
      if (saved.koll) Object.assign(UI.koll, saved.koll);
      if (saved.foto) Object.assign(UI.foto, saved.foto, { view: null, q: "" });
      if (saved.ecom) Object.assign(UI.ecom, saved.ecom, { view: null, q: "" });
      if (saved.lager) Object.assign(UI.lager, saved.lager, { view: null, q: "" });
    }
  } catch (e) {}
  function persist() {
    try { localStorage.setItem("rubato-samples-v5", JSON.stringify({ tab: UI.tab, samples: { status: UI.samples.status, group: UI.samples.group, lev: UI.samples.lev, season: UI.samples.season, plats: UI.samples.plats }, drops: { season: UI.drops.season }, styles: { status: UI.styles.status, lev: UI.styles.lev, season: UI.styles.season }, prod: { status: UI.prod.status, lev: UI.prod.lev, season: UI.prod.season }, koll: UI.koll, foto: { season: UI.foto.season }, ecom: { season: UI.ecom.season }, lager: { status: UI.lager.status, plats: UI.lager.plats, group: UI.lager.group } })); } catch (e) {}
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
  const isActiveStyle = (st) => { const s = styleStatusNorm(st.status); return s === "Sampling" || s === "Godkänd"; };
  const inProduction = (st) => PROD_STATUS.includes(styleStatusNorm(st.status));
  const styleStatusPill = (st) => { const s = styleStatusNorm(st.status); return h("span", { class: "pill st-" + slug(s), text: s }); };
  const seasonRank = (s) => { const m = /^(SS|AW)\s?(\d{2})$/i.exec(String(s || "").trim()); return m ? Number(m[2]) * 2 + (m[1].toUpperCase() === "AW" ? 1 : 0) : -1; };
  const dropKey = (sasong, namn) => norm(sasong) + "|" + norm(namn);
  const dropOf = (st) => (st.sasong && st.drop ? D.drops.find((d) => dropKey(d.sasong, d.namn) === dropKey(st.sasong, st.drop)) || null : null);
  const dropsOfSeason = (season) => D.drops.filter((d) => norm(d.sasong) === norm(season)).sort((a, b) => (num(a.ordning) ?? 99) - (num(b.ordning) ?? 99) || (a.namn || "").localeCompare(b.namn || "", "sv"));
  function deadlineOf(st) {
    if (isISO(st.klartSenast)) return { date: st.klartSenast, from: "style" };
    const d = dropOf(st);
    return d && isISO(d.klartSenast) ? { date: d.klartSenast, from: "drop" } : null;
  }
  const nextEta = (st) => { const etas = (Array.isArray(st.produktion) ? st.produktion : []).filter((r) => r.status !== "Inlevererad" && isISO(r.eta)).map((r) => r.eta).sort(); return etas[0] || null; };
  const lageCell = (st, p) => { if (p.lage === "klar") { const e = nextEta(st); return e ? [h("span", { class: "sub", text: "ETA lager " }), h("span", { class: "mono", text: fmtDate(e) })] : [h("span", { class: "muted", text: "–" })]; } return [lagePill(p)]; };
  const fmtM = (n) => Number(n).toLocaleString("sv-SE", { maximumFractionDigits: 1 });
  const fmtSEK = (n) => (n == null || isNaN(n) ? "–" : Math.round(Number(n)).toLocaleString("sv-SE") + " kr");
  const fmtTkr = (n) => (n == null || isNaN(n) ? "–" : (Math.round(Number(n) / 1000)).toLocaleString("sv-SE") + " tkr");
  const lineCost = (r) => { const a = num(r.antal), p = num(r.styckpris), t = num(r.tygkostnad) || 0; return a == null || p == null ? (num(r.kostnad) ?? null) : a * (p + t); };
  const poTotal = (po) => (po.rader || []).reduce((a, r) => a + (lineCost(r) || 0), 0);
  const poUnits = (po) => (po.rader || []).reduce((a, r) => a + (num(r.antal) || 0), 0);
  const poSeason = (po) => po.sasong || "";
  const poLinesOf = (styleId) => { const out = []; for (const po of D.po) for (const r of po.rader || []) if (r.styleId === styleId) out.push({ po, r }); return out; };
  const poStatusPill = (po) => { const x = poStatusNorm(po.status); return h("span", { class: "pill ps-" + slug(x), text: x }); };
  const poEta = (po) => (isISO(po.etaLager) ? po.etaLager : isISO(po.bekraftadEx) ? po.bekraftadEx : isISO(po.planeradEx) ? po.planeradEx : null);
  const poIsLate = (po) => { const e = poEta(po); return !!e && PO_OPEN.includes(poStatusNorm(po.status)) && diffDays(e) < 0; };
  const budgetOf = (season) => D.budget.find((b) => norm(b._id) === norm(season) || norm(b.sasong) === norm(season)) || null;
  const styleKategori = (st) => (st && KATEGORIER.includes(st.kategori) ? st.kategori : (st && st.kategori) || "");
  const sizeQty = (r) => { const q = r.perStorlek && typeof r.perStorlek === "object" ? r.perStorlek : null; return q; };
  function poEanMissing(po) {
    let n = 0;
    for (const r of po.rader || []) {
      const st = byId(D.styles, r.styleId); if (!st || !r.farg) continue;
      const sizes = (r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st)) || [];
      const have = new Set((st.ean || []).map(vkey));
      for (const sz of sizes) if (!have.has(vkey({ farg: r.farg, storlek: sz }))) n++;
      if (!sizes.length) n++;
    }
    return n;
  }
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
  const kategoriOf = (s) => styleKategori(styleOf(s));
  const imgUrl = (id) => P.assets.url(id);
  const fargText = (f) => { const raw = String(f || "").trim(); const words = raw.replace(/^(?:col(?:ou?r)?\.?\s*)?[#0-9][0-9a-z]*[\s.:\-–]+/i, "").split(/[\s,]+/).filter(Boolean); const kept = words.filter((w) => !/\d/.test(w) && !/^col(?:ou?r)?\.?$/i.test(w)); const out = (kept.length ? kept : words).join(" ").replace(/[\s.:\-–]+$/, ""); return out ? out[0].toUpperCase() + out.slice(1) : raw; };
  const expanded = new Set();
  const groupKeyOf = (s) => (s.styleId || "p:" + norm(s.produkt)) + "|" + norm(s.version) + "|" + norm(s.leverantor);
  const sampleImages = (s) => (Array.isArray(s.bilder) ? s.bilder.filter(Boolean) : []);
  const unmarked = (s) => !s.markt && (s.status === "Mottagen" || s.status === "Problem");
  const unmeasured = (s) => s.status === "Mottagen" && (s.mattGodkanda == null || s.mattGodkanda === "");
  const ECOM_STATUS = ["", "Planerade", "Bokad", "Fotade", "Retuscherade", "Publicerade"];
  const KAMP_STATUS = ["", "Planerad", "Bokad", "Fotad", "Klar"];
  const hasCommittedPo = (st) => poLinesOf(st._id).some((x) => PO_COMMITTED.includes(poStatusNorm(x.po.status)));
  function styleImage(st) {
    if (!st) return null;
    if (st.bildId) return st.bildId;
    const xs = samplesOfStyle(st._id).filter((x) => sampleImages(x).length);
    if (!xs.length) return null;
    const pick = xs.find((x) => beslutNorm(x.beslut) === "Godkänd") || xs.find((x) => x.version === "Fotosample") || xs[xs.length - 1];
    return sampleImages(pick)[0];
  }
  function fotoState(st) {
    const xs = samplesOfStyle(st._id).filter((x) => x.version === "Fotosample" || x.version === "Produktionssample");
    const got = xs.find((x) => x.status === "Mottagen");
    if (got) return { key: "finns", label: "Fotosample inne", sample: got };
    const wait = xs.find((x) => isWaiting(x));
    if (wait) { const e = expected(wait); return { key: "vantas", label: "Fotosample väntas" + (e ? " " + fmtDate(e) : ""), sample: wait }; }
    const po = poLinesOf(st._id).map((x) => x.po).find((p) => /finns|inne|mottag/i.test(p.fotosample || ""));
    if (po) return { key: "finns", label: "Fotosample inne (PO " + (po.nr || "") + ")", sample: null };
    const po2 = poLinesOf(st._id).map((x) => x.po).find((p) => p.fotosample || p.fotosampleLeverans);
    if (po2) return { key: "vantas", label: "Fotosample " + (po2.fotosample || "beställd") + (isISO(po2.fotosampleLeverans) ? " " + fmtDate(po2.fotosampleLeverans) : ""), sample: null };
    const any = samplesOfStyle(st._id).find((x) => x.status === "Mottagen" && beslutNorm(x.beslut) === "Godkänd");
    if (any) return { key: "godkand", label: "Godkänd sample kan fotas", sample: any };
    return { key: "saknas", label: "Ingen fotosample", sample: null };
  }
  async function shrinkImage(file, max) {
    if (!/^image\//.test(file.type) || file.type === "image/svg+xml") return file;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (k >= 1 && file.size < 1.5e6) return file;
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.86));
      return blob || file;
    } catch (e) { return file; }
  }
  async function uploadImages(files) {
    if (!assets) { toast("Bilduppladdning kräver Editor-behörighet på appen."); return []; }
    const ids = [];
    for (const f of files) {
      try { const blob = await shrinkImage(f, 1600); const r = await assets.upload(blob, blob.type ? undefined : { type: "image/jpeg" }); ids.push(r.id); }
      catch (e) { const c = e && e.code; toast(c === "too_large" ? "Bilden är för stor (max 20 MB)." : c === "unsupported_type" ? "Filtypen stöds inte – använd JPG, PNG eller WebP." : c === "quota_or_state" ? "Bildlagringen är full." : "Kunde inte ladda upp bilden."); }
    }
    return ids;
  }
  function gallery(ids, opts) {
    opts = opts || {};
    const g = h("div", { class: "gallery" });
    for (const id of ids) {
      const fig = h("figure", { class: "thumb" + (opts.hero === id ? " hero" : "") }, h("img", { src: imgUrl(id), alt: "", loading: "lazy", onclick: () => openLightbox(ids, id) }));
      if (opts.onRemove) fig.append(h("button", { class: "thumb-x", type: "button", title: "Ta bort bild", "aria-label": "Ta bort bild", text: "×", onclick: () => opts.onRemove(id) }));
      if (opts.onHero) fig.append(h("button", { class: "thumb-hero", type: "button", text: opts.hero === id ? "Huvudbild" : "Gör till huvudbild", onclick: () => opts.onHero(id) }));
      g.append(fig);
    }
    return g;
  }
  function openLightbox(ids, id) {
    let i = Math.max(0, ids.indexOf(id));
    const img = h("img", { src: imgUrl(ids[i]), alt: "" });
    const box = h("div", { class: "lightbox", onclick: (e) => { if (e.target === box) box.remove(); } }, img,
      h("button", { class: "lb-x", type: "button", text: "×", onclick: () => box.remove() }),
      ids.length > 1 ? h("button", { class: "lb-prev", type: "button", text: "‹", onclick: () => { i = (i - 1 + ids.length) % ids.length; img.src = imgUrl(ids[i]); } }) : null,
      ids.length > 1 ? h("button", { class: "lb-next", type: "button", text: "›", onclick: () => { i = (i + 1) % ids.length; img.src = imgUrl(ids[i]); } }) : null);
    const key = (e) => { if (e.key === "Escape") { box.remove(); document.removeEventListener("keydown", key); } };
    document.addEventListener("keydown", key);
    document.body.append(box);
  }
  function imageDrop(onFiles, label) {
    const input = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: () => { if (input.files.length) onFiles([...input.files]); input.value = ""; } });
    const btn = h("button", { class: "btn small", type: "button", text: label || "+ Lägg till bilder", onclick: () => input.click() });
    const zone = h("div", { class: "dropzone" }, btn, h("span", { class: "hint", text: "eller släpp bilder här" }), input);
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); const fs = [...e.dataTransfer.files].filter((f) => /^image\//.test(f.type)); if (fs.length) onFiles(fs); });
    return zone;
  }
  const sampleDone = (s) => { const st = styleOf(s); if (!st) return false; const ss = styleStatusNorm(st.status); if (!(PROD_STATUS.includes(ss) || ss === "Kastad")) return false; return !(ACTIVE.includes(s.status) || toEvaluate(s)); };
  const needsPlace = (s) => s.status === "Mottagen" && !s.platsTyp;
  function utfallParts(s) {
    const out = [];
    const b = beslutNorm(s.beslut);
    if (b) out.push(chip(b === "Godkänd" ? "Godkänd" : b, "b-" + slug(b)));
    const st = styleOf(s);
    if (st) { const ss = styleStatusNorm(st.status); if (PROD_STATUS.includes(ss) || ss === "Pausad" || ss === "Kastad") out.push(h("span", { class: "pill st-" + slug(ss), text: ss === "Pausad" ? "Style pausad" : ss === "Kastad" ? "Style kastad" : ss })); }
    return out;
  }

  // ---------- style planning (backwards from "I lager senast") ----------
  function plan(st) {
    const r = { lage: "ingen", label: "", note: "", po: null, inne: null, best: null, ex: null, prod: null, frakt: null, buff: 0, utv: 7, sl: null, poDays: null, deadline: null, deadlineFrom: null };
    const status = styleStatusNorm(st.status);
    if (status === "Kastad") return Object.assign(r, { lage: "skip", label: "Kastad" });
    if (status === "Pausad") return Object.assign(r, { lage: "paus", label: "Pausad" });
    if (PROD_STATUS.includes(status)) return Object.assign(r, { lage: "klar", label: status });
    r.utv = num(D.settings.utvarderingDagar) ?? 7;
    r.frakt = fraktFor(st.leverantor);
    r.prod = levNum(st.leverantor, "produktionstid");
    r.buff = levNum(st.leverantor, "buffert") || 0;
    r.sl = levNum(st.leverantor, "sampleLedtid");
    const dl = deadlineOf(st);
    if (!dl) return Object.assign(r, { note: st.sasong && st.drop ? "Sätt \"I lager senast\" på stylen eller på " + st.sasong + " " + st.drop + "." : "Sätt \"I lager senast\" för att få en tidsplan." });
    r.deadline = dl.date; r.deadlineFrom = dl.from;
    if (r.prod == null) return Object.assign(r, { lage: "okand", note: "Produktionstid saknas för " + (st.leverantor || "leverantören") + "." });
    r.ex = addDays(dl.date, -r.frakt);
    r.po = addDays(r.ex, -(r.prod + r.buff));
    r.inne = addDays(r.po, -r.utv);
    r.best = r.sl != null ? addDays(r.inne, -r.sl) : null;
    r.poDays = diffDays(r.po);
    const gul = num(D.settings.marginalGul) ?? 14;
    const grade = (m) => (m < 0 ? "rod" : m < gul ? "gul" : "gron");
    const needsSample = status === "Sampling" && (st.typ || "Nyhet") === "Nyhet";
    const xs = st._id ? samplesOfStyle(st._id).filter((x) => !["Kastad", "Ny runda", "Pausad"].includes(beslutNorm(x.beslut)) && x.status !== "Returnerad") : [];
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
        { key: "mark", label: "Omärkta", cls: "t-late" },
        { key: "measure", label: "Ej mätta", cls: "t-warn" },
        { key: "place", label: "Saknar plats" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_samples", "Sök style, tyg, färg, ID, hängare …", st, () => this.update());
      this.fLev = filterSelect("f_s_lev", "Alla leverantörer", st, "lev", upd);
      this.fSeason = filterSelect("f_s_season", "Alla säsonger", st, "season", upd);
      this.fPlats = filterSelect("f_s_plats", "Alla platser", st, "plats", upd);
      this.seg = makeSeg([["aktiva", "Aktiva"], ["Beställd", "Beställd"], ["Skickad", "Skickad"], ["Problem", "Problem"], ["Mottagen", "Mottagen"], ["hangare", "Kollektionshängare"], ["produktion", "Gått till produktion"], ["alla", "Alla"]], st, "status", upd);
      const grp = selectEl("f_s_group", [["kategori", "Gruppera per kategori"], ["style", "Gruppera per style"], ["lev", "Gruppera per leverantör"], ["none", "Ingen gruppering"]], st.group);
      grp.addEventListener("change", () => { st.group = grp.value; upd(); });
      this.count = h("span", { class: "count" });
      this.selCount = h("span");
      this.tray = h("div", { class: "tray", hidden: true }, this.selCount,
        h("button", { class: "btn small primary", type: "button", text: "Skriv ut etiketter", onclick: () => openLabels([...selected]) }),
        h("button", { class: "btn small", type: "button", text: "Rensa val", onclick: () => { selected.clear(); this.update(); } }));
      this.allBox = h("input", { type: "checkbox", id: "s_all", onchange: () => { (this.visible || []).forEach((s) => (this.allBox.checked ? selected.add(s._id) : selected.delete(s._id))); this.update(); } });
      this.cards = h("div", { class: "cards" });
      this.empty = h("div", { class: "empty", hidden: true });
      const open = (e) => { if (e.target.closest("input, button")) return; const tr = e.target.closest("tr[data-id], tr[data-group]"); if (!tr) return; if (tr.dataset.id) openSample(tr.dataset.id); else { const k = tr.dataset.group; if (expanded.has(k)) expanded.delete(k); else expanded.add(k); this.update(); } };
      this.cards.addEventListener("click", open);
      this.cards.addEventListener("keydown", (e) => { if (e.key === "Enter") open(e); });
      root.append(h("p", { class: "lede", text: "Samples för produkter som inte är färdiga än. När produkten har gått till produktion flyttar dess samples till \"Gått till produktion\" och syns under Produktion." }),
        this.strip.el, this.bar = h("section", { class: "filters sticky-bar", "aria-label": "Filter" }, q, this.fLev.el, this.fSeason.el, this.fPlats.el, this.seg.el, grp, h("label", { class: "checkline" }, this.allBox, "Välj alla synliga"), this.count), this.tray, this.cards, this.empty);
      const setStick = () => { if (this.bar) document.documentElement.style.setProperty("--stick", (this.bar.offsetHeight - 2) + "px"); };
      setStick(); window.addEventListener("resize", setStick); setTimeout(setStick, 300);
    },
    filtered() {
      const st = UI.samples, q = norm(st.q);
      return D.samples.filter((s) => {
        const done = sampleDone(s);
        switch (st.view) {
          case "waiting": if (!isWaiting(s) || done) return false; break;
          case "late": if (!isLate(s) || done) return false; break;
          case "problem": if (s.status !== "Problem" || done) return false; break;
          case "remind": if (!remindDue(s) || done) return false; break;
          case "evaluate": if (!toEvaluate(s) || done) return false; break;
          case "place": if (!needsPlace(s) || done) return false; break;
          case "mark": if (!unmarked(s) || done) return false; break;
          case "measure": if (!unmeasured(s) || done) return false; break;
          default:
            if (st.status === "produktion") { if (!done) return false; }
            else if (st.status === "hangare") { const stx = styleOf(s); if (!(stx && beslutNorm(s.beslut) === "Godkänd" && HANGER_STYLE.includes(styleStatusNorm(stx.status)) && s.status !== "Returnerad")) return false; }
            else if (st.status === "alla") {}
            else if (done) return false;
            else if (st.status === "aktiva" && !ACTIVE.includes(s.status)) return false;
            else if (st.status !== "aktiva" && s.status !== st.status) return false;
        }
        if (st.lev && s.leverantor !== st.lev) return false;
        if (st.season && seasonOf(s) !== st.season) return false;
        if (st.plats && s.platsTyp !== st.plats) return false;
        if (q && ![s._id, styleName(s), s.version, tygName(s), s.farg, s.leverantor, s.kommentar, s.andringar, platsText(s), s.hangare ? "h" + s.hangare : "", s.tracking, s.storlek, beslutNorm(s.beslut), seasonOf(s), kategoriOf(s)].join(" ").toLowerCase().includes(q)) return false;
        return true;
      });
    },
    update() {
      const st = UI.samples;
      const live = D.samples.filter((s) => !sampleDone(s));
      this.strip.set({ waiting: live.filter(isWaiting).length, late: live.filter(isLate).length, problem: live.filter((s) => s.status === "Problem").length, remind: live.filter((s) => remindDue(s)).length, evaluate: live.filter(toEvaluate).length, mark: live.filter(unmarked).length, measure: live.filter(unmeasured).length, place: live.filter(needsPlace).length });
      this.seg.sync();
      this.fLev.fill(uniq(D.samples.map((s) => s.leverantor)));
      this.fSeason.fill(uniq(D.samples.map(seasonOf)));
      this.fPlats.fill(PLATSER);
      const list = this.filtered();
      const keyOf = st.group === "kategori" ? (s) => kategoriOf(s) || "Utan kategori" : st.group === "style" ? (s) => styleName(s) + " · " + (s.leverantor || "") : st.group === "lev" ? (s) => s.leverantor || "Utan leverantör" : () => "";
      const katRank = (k) => { const i = KATEGORIER.indexOf(k); return i < 0 ? 99 : i; };
      list.sort((a, b) => (st.group === "kategori" ? katRank(keyOf(a)) - katRank(keyOf(b)) : 0) || keyOf(a).localeCompare(keyOf(b), "sv") || styleName(a).localeCompare(styleName(b), "sv") || versionRank(a.version) - versionRank(b.version) || (expected(a) || "9999").localeCompare(expected(b) || "9999") || a._id.localeCompare(b._id));
      this.visible = list;
      const cols = [["", "c-check"], ["ID"], ["Style"], ["Version"], ["Hängare"], ["Leverantör"], ["Färg"], ["Status"], ["Utfall"], ["Förväntad"], ["Kommentar"]];
      const groups = new Map();
      for (const s of list) { const k = keyOf(s); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
      const cards = [];
      for (const [k, items] of groups) {
        const card = h("section", { class: "card" });
        if (st.group !== "none") {
          const head = h("div", { class: "card-head" }, h("h3", { text: k }), h("span", { class: "sub", text: items.length + (items.length === 1 ? " sample" : " samples") + (st.group === "kategori" ? " · " + uniq(items.map(styleName)).length + " styles" : "") }));
          if (st.group === "style" && items[0].styleId && byId(D.styles, items[0].styleId)) { const sid = items[0].styleId; head.append(h("button", { class: "linkish", type: "button", text: "Öppna style", onclick: () => openStyle(sid) })); }
          card.append(head);
        }
        const { t, tb } = table(cols);
        let lastStyle = null;
        const grouped = new Map();
        for (const s of items) { const gk = groupKeyOf(s); if (!grouped.has(gk)) grouped.set(gk, []); grouped.get(gk).push(s); }
        for (const gItems of grouped.values()) {
          const s = gItems[0];
          if (st.group === "kategori" || st.group === "lev") { const sn = styleName(s); if (sn !== lastStyle) { lastStyle = sn; const cell = h("td", { colSpan: 11, text: sn + (s.leverantor && st.group !== "lev" ? " · " + s.leverantor : "") }); if (s.styleId && byId(D.styles, s.styleId)) { const sid = s.styleId; cell.append(h("button", { class: "linkish", type: "button", text: "Öppna style", onclick: () => openStyle(sid) })); } tb.append(h("tr", { class: "group" }, cell)); } }
          if (gItems.length > 1 && !expanded.has(groupKeyOf(s))) tb.append(sampleGroupRow(gItems));
          else for (const x of gItems) tb.append(sampleRow(x));
        }
        card.append(h("div", { class: "ledger-wrap" }, t));
        cards.push(card);
      }
      if (st.status === "hangare" && !st.view) { cards.length = 0; cards.push(hangerCard(st.season || "")); }
      this.cards.replaceChildren(...cards);
      this.empty.hidden = list.length > 0 || st.status === "hangare";
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
    const subBits = [];
    if (tygName(s)) subBits.push(h("span", { class: t && t.status === "Slut" ? "late-text" : null, text: tygName(s) + (t && t.status === "Slut" ? " (slut)" : "") }));
    if (s.storlek) subBits.push(h("span", { text: (subBits.length ? " · " : "") + "stl " + s.storlek }));
    const stn = styleOf(s);
    if (stn && stn.sasong) subBits.push(h("span", { text: (subBits.length ? " · " : "") + stn.sasong + (stn.drop ? " " + stn.drop : "") }));
    const pl = platsText(s);
    const placeCell = td("Hängare", null, s.platsTyp === "Hängare" ? h("span", { class: "hanger", text: "Hängare " + (s.hangare || "?") }) : pl ? h("span", { class: "place", text: pl }) : needsPlace(s) ? h("span", { class: "flag", text: "Ange plats" }) : null);
    if (unmarked(s)) placeCell.append(h("span", { class: "flag bad", text: "Märk " + s._id }));
    if (unmeasured(s)) placeCell.append(h("span", { class: "flag", text: "Mät" }));
    if (s.mattGodkanda === false) placeCell.append(h("span", { class: "flag bad", text: "Mått ej OK" }));
    const imgs = sampleImages(s);
    const idCell = td("ID", "c-id", tag(s._id));
    if (imgs.length) idCell.append(h("img", { class: "rowthumb", src: imgUrl(imgs[0]), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(imgs, imgs[0]); } }));
    const noteCell = td("Kommentar", "note");
    if (s.kommentar) noteCell.append(h("div", { text: s.kommentar }));
    if (s.andringar) noteCell.append(h("div", { text: "Ändringar: " + s.andringar }));
    tr.append(
      td("Välj", "c-check", box),
      idCell,
      td("Style", "c-main", h("div", { class: "prod", text: styleName(s) }), subBits.length ? h("div", { class: "sub" }, subBits) : null),
      td("Version", null, chip(s.version || "–")),
      placeCell,
      td("Leverantör", null, s.leverantor || ""),
      td("Färg", null, s.farg ? h("span", { class: "swatch" }, h("i", { class: "dot s-" + (s.status || "x") }), fargText(s.farg)) : ""),
      td("Status", "c-status", statusPill(s.status)),
      td("Utfall", null, h("span", { class: "chips", style: "margin-top:0" }, utfallParts(s))),
      td("Förväntad", "c-exp", expCell(s)),
      noteCell
    );
    return tr;
  }

  function sampleGroupRow(items) {
    const s0 = items[0];
    const key = groupKeyOf(s0);
    const tr = h("tr", { tabIndex: 0, dataset: { group: key }, class: "grp" });
    const allSel = items.every((x) => selected.has(x._id));
    const box = h("input", { type: "checkbox", "aria-label": "Välj " + items.length + " samples", checked: allSel, onchange: () => { items.forEach((x) => (box.checked ? selected.add(x._id) : selected.delete(x._id))); SamplesView.update(); } });
    const ids = items.map((x) => x._id).sort();
    const idCell = td("ID", "c-id", tag(ids[0] + (ids.length > 1 ? "–" + ids[ids.length - 1].replace(/^S/, "") : "")), h("div", { class: "sub", text: items.length + " färger" }));
    const imgs = uniq(items.flatMap(sampleImages));
    if (imgs.length) idCell.append(h("img", { class: "rowthumb", src: imgUrl(imgs[0]), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(imgs, imgs[0]); } }));
    const t = tygOf(s0);
    const subBits = [];
    if (tygName(s0)) subBits.push(tygName(s0) + (t && t.status === "Slut" ? " (slut)" : ""));
    const stn = styleOf(s0);
    if (stn && stn.sasong) subBits.push(stn.sasong + (stn.drop ? " " + stn.drop : ""));
    const colours = h("div", { class: "swatches" }, items.slice().sort((a, b) => fargText(a.farg).localeCompare(fargText(b.farg), "sv")).map((x) => h("button", { class: "swatch btn-swatch", type: "button", title: x._id + " · " + (x.status || "") + (platsText(x) ? " · " + platsText(x) : ""), onclick: (e) => { e.stopPropagation(); openSample(x._id); } }, h("i", { class: "dot s-" + (x.status || "x") }), fargText(x.farg) || x._id, x.platsTyp === "Hängare" ? h("span", { class: "h", text: "H" + (x.hangare || "?") }) : null)));
    const statuses = uniq(items.map((x) => x.status));
    const placeCell = td("Hängare", null);
    const hangers = uniq(items.filter((x) => x.platsTyp === "Hängare").map((x) => x.hangare || "?"));
    if (hangers.length) placeCell.append(h("span", { class: "hanger", text: "Hängare " + hangers.join(", ") }));
    const others = uniq(items.filter((x) => x.platsTyp && x.platsTyp !== "Hängare").map((x) => x.platsTyp)); if (others.length) placeCell.append(h("span", { class: "place", text: others.join(", ") }));
    const nMark = items.filter(unmarked).length, nMeasure = items.filter(unmeasured).length, nPlace = items.filter(needsPlace).length;
    if (nMark) placeCell.append(h("span", { class: "flag bad", text: "Märk " + nMark }));
    if (nMeasure) placeCell.append(h("span", { class: "flag", text: "Mät " + nMeasure }));
    if (nPlace && !hangers.length) placeCell.append(h("span", { class: "flag", text: "Ange plats" }));
    const expDates = items.map(expected).filter(Boolean).sort();
    const expCellEl = td("Förväntad", "c-exp");
    const received = items.filter((x) => x.status === "Mottagen").length;
    if (received === items.length) expCellEl.append(h("div", { class: "mono", text: "alla mottagna" }));
    else if (expDates.length) { const d = diffDays(expDates[0]); expCellEl.append(h("div", { class: "mono", text: fmtDate(expDates[0]) + (expDates.length > 1 && expDates[expDates.length - 1] !== expDates[0] ? "–" + fmtDate(expDates[expDates.length - 1]) : "") }), h("div", { class: "days " + (d < 0 ? "late" : d <= 7 ? "soon" : ""), text: d < 0 ? (-d) + " d sen" : d === 0 ? "idag" : "om " + d + " d" })); }
    else expCellEl.append(h("div", { class: "mono muted", text: "TBA" }));
    if (received && received < items.length) expCellEl.append(h("div", { class: "sub", text: received + " av " + items.length + " mottagna" }));
    const utf = uniq(items.map((x) => beslutNorm(x.beslut)).filter(Boolean));
    const notes = uniq(items.map((x) => x.kommentar).filter(Boolean));
    tr.append(
      td("Välj", "c-check", box),
      idCell,
      td("Style", "c-main", h("div", { class: "prod", text: styleName(s0) }), subBits.length ? h("div", { class: "sub", text: subBits.join(" · ") }) : null, h("button", { class: "linkish", type: "button", text: expanded.has(key) ? "Dölj färgerna" : "Visa varje färg", onclick: (e) => { e.stopPropagation(); if (expanded.has(key)) expanded.delete(key); else expanded.add(key); SamplesView.update(); } })),
      td("Version", null, chip(s0.version || "–")),
      placeCell,
      td("Leverantör", null, s0.leverantor || ""),
      td("Färger", null, colours),
      td("Status", "c-status", h("span", { class: "chips", style: "margin-top:0" }, statuses.map((x) => statusPill(x)))),
      td("Utfall", null, h("span", { class: "chips", style: "margin-top:0" }, utf.map((b) => chip(b, "b-" + slug(b))), stn && (inProduction(stn) || ["Pausad", "Kastad"].includes(styleStatusNorm(stn.status))) ? h("span", { class: "pill st-" + slug(styleStatusNorm(stn.status)), text: styleStatusNorm(stn.status) }) : null)),
      expCellEl,
      td("Kommentar", "note", notes.length ? h("div", { text: notes.length === 1 ? notes[0] : notes.length + " kommentarer" }) : null)
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
      this.seg = makeSeg([["aktiva", "Aktiva"], ["Sampling", "Sampling"], ["Godkänd", "Godkänd"], ["produktion", "I produktion"], ["Levererad", "Levererad"], ["Pausad", "Pausad"], ["Kastad", "Kastad"], ["alla", "Alla"]], st, "status", upd);
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["Style"], ["Leverantör"], ["Säsong"], ["Status"], ["Senaste sample"], ["I lager senast"], ["PO senast"], ["Läge"], ["EAN"]]);
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
          default: {
            const ss = styleStatusNorm(s.status);
            if (st.status === "aktiva" && !isActiveStyle(s)) return false;
            else if (st.status === "produktion" && !(ss === "PO lagd" || ss === "I produktion")) return false;
            else if (!["aktiva", "produktion", "alla"].includes(st.status) && ss !== st.status) return false;
          }
        }
        if (st.lev && s.leverantor !== st.lev) return false;
        if (st.season && s.sasong !== st.season) return false;
        if (q && ![s._id, s.namn, s.leverantor, s.sasong, s.drop, s.kommentar, styleStatusNorm(s.status), (s.po || []).join(" "), (s.farger || []).join(" ")].join(" ").toLowerCase().includes(q)) return false;
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
    const dl = deadlineOf(s);
    return h("tr", { tabIndex: 0, dataset: { style: s._id } },
      td("", "c-main", h("div", { class: "prod", text: s.namn || "Namnlös" }), h("div", { class: "sub" }, s.typ && s.typ !== "Nyhet" ? chip(s.typ) : null, styleKategori(s) ? chip(styleKategori(s)) : null, s._id + " · " + xs.length + (xs.length === 1 ? " sample" : " samples") + ((s.po || []).length ? " · " + s.po.join(", ") : "") + (poLinesOf(s._id).length ? " · " + poLinesOf(s._id).reduce((a, x) => a + (num(x.r.antal) || 0), 0) + " st · " + fmtTkr(poLinesOf(s._id).reduce((a, x) => a + (lineCost(x.r) || 0), 0)) : ""))),
      td("Leverantör", null, s.leverantor || ""),
      td("Säsong", null, [s.sasong, s.drop].filter(Boolean).join(" · ")),
      td("Status", null, styleStatusPill(s)),
      td("Senaste", null, last ? h("span", { class: "chips" }, chip(last.version || "–"), statusPill(last.status), beslutNorm(last.beslut) ? chip(beslutNorm(last.beslut), "b-" + slug(beslutNorm(last.beslut))) : null) : h("span", { class: "muted", text: "Ingen sample" })),
      td("I lager senast", "mono", dl ? fmtDate(dl.date) + (dl.from === "drop" ? " (drop)" : "") : ""),
      td("PO senast", null, p.po ? h("div", null, h("div", { class: "mono", text: fmtDate(p.po) }), h("div", { class: "days " + (p.poDays < 0 ? "late" : p.poDays < 14 ? "soon" : ""), text: fmtDays(p.poDays) })) : null),
      td("Läge", null, lageCell(s, p), p.note && !["klar", "skip", "paus"].includes(p.lage) ? h("div", { class: "sub", text: p.note }) : null),
      td("EAN", "mono", eanTxt)
    );
  }

  // ---------- DROPS ----------
  const DropsView = {
    mount(root) {
      const st = UI.drops;
      this.fSeason = filterSelect("f_d_season", "Alla säsonger", st, "season", () => { this.update(); persist(); });
      this.count = h("span", { class: "count" });
      this.body = h("div", { style: "display:grid;gap:22px" });
      root.append(h("p", { class: "lede", text: "Kollektionen per säsong och drop, med produkterna från Produktion-fliken och de samples som hör till varje produkt. Klicka på en produkt för att öppna stylen, eller på ett sample-ID för att se var samplen hänger." }), h("section", { class: "filters", "aria-label": "Filter" }, this.fSeason.el, this.count), this.body);
    },
    update() {
      const st = UI.drops;
      const seasons = uniq(D.drops.map((d) => d.sasong).concat(D.styles.map((s) => s.sasong))).sort((a, b) => seasonRank(b) - seasonRank(a) || b.localeCompare(a, "sv"));
      this.fSeason.fill(seasons);
      const show = st.season ? seasons.filter((s) => s === st.season) : seasons;
      this.body.replaceChildren();
      let nDrops = 0;
      for (const season of show) {
        const drops = dropsOfSeason(season);
        const inSeason = D.styles.filter((s) => norm(s.sasong) === norm(season));
        const placed = new Set();
        const sec = h("section", { class: "season" });
        sec.append(h("h2", { class: "season-h" }, season, h("span", { class: "sub", text: inSeason.length + (inSeason.length === 1 ? " produkt" : " produkter") + " · " + drops.length + (drops.length === 1 ? " drop" : " drops") })));
        for (const d of drops) {
          const members = inSeason.filter((s) => dropKey(s.sasong, s.drop) === dropKey(d.sasong, d.namn));
          members.forEach((m) => placed.add(m._id));
          sec.append(dropSection(d, members, false));
          nDrops++;
        }
        const rest = inSeason.filter((s) => !placed.has(s._id));
        if (rest.length) sec.append(dropSection({ sasong: season, namn: "Utan drop", _id: null }, rest, true));
        this.body.append(sec);
      }
      if (!show.length) this.body.append(h("div", { class: "empty" }, h("strong", { text: loaded.has("drops") && loaded.has("styles") ? "Inga drops ännu" : "Laddar …" }), h("span", { text: "Skapa en drop med \"+ Ny drop\" och sätt säsong och drop på era styles." })));
      this.count.textContent = nDrops + (nDrops === 1 ? " drop" : " drops");
    }
  };
  function sampleChip(x) {
    const b = h("button", { class: "samplechip", type: "button", title: [x.version, x.farg, platsText(x), x.status].filter(Boolean).join(" · "), onclick: (e) => { e.stopPropagation(); openSample(x._id); } },
      h("span", { class: "dot " + "s-" + (x.status || "x") }), h("span", { class: "id", text: x._id }), h("span", { class: "sub", text: x.version || "" }));
    if (x.platsTyp === "Hängare") b.append(h("span", { class: "h", text: "H" + (x.hangare || "?") }));
    else if (x.platsTyp) b.append(h("span", { class: "sub", text: x.platsTyp }));
    return b;
  }
  function dropSection(d, members, isRest) {
    const box = h("section", { class: "drop" + (isRest ? " nodrop" : "") });
    const head = h("div", { class: "drop-head" }, h("h3", { text: d.namn }));
    const meta = h("div", { class: "drop-meta" });
    if (isISO(d.klartSenast)) meta.append(h("span", null, "I lager senast ", h("span", { class: "mono", text: fmtDate(d.klartSenast) }), h("span", { class: "sub", text: " (" + fmtDays(diffDays(d.klartSenast)) + ")" })));
    if (isISO(d.lansering)) meta.append(h("span", null, "Lansering ", h("span", { class: "mono", text: fmtDate(d.lansering) })));
    const counts = { sampling: 0, godkand: 0, po: 0, prod: 0, lev: 0, paus: 0, kast: 0, rod: 0, gul: 0 };
    for (const s of members) {
      const ss = styleStatusNorm(s.status);
      if (ss === "Sampling") counts.sampling++; else if (ss === "Godkänd") counts.godkand++; else if (ss === "PO lagd") counts.po++; else if (ss === "I produktion") counts.prod++; else if (ss === "Levererad") counts.lev++; else if (ss === "Pausad") counts.paus++; else if (ss === "Kastad") counts.kast++;
      const p = plan(s); if (p.lage === "rod") counts.rod++; if (p.lage === "gul") counts.gul++;
    }
    const bits = [];
    if (counts.sampling) bits.push(counts.sampling + " sampling"); if (counts.godkand) bits.push(counts.godkand + " godkända"); if (counts.po) bits.push(counts.po + " PO lagda"); if (counts.prod) bits.push(counts.prod + " i produktion"); if (counts.lev) bits.push(counts.lev + " levererade"); if (counts.paus) bits.push(counts.paus + " pausade"); if (counts.kast) bits.push(counts.kast + " kastade");
    meta.append(h("span", { class: "sub", text: members.length + (members.length === 1 ? " produkt" : " produkter") + (bits.length ? ": " + bits.join(", ") : "") }));
    if (counts.rod) meta.append(h("span", { class: "lage l-rod", text: counts.rod + " hinner inte" }));
    if (counts.gul) meta.append(h("span", { class: "lage l-gul", text: counts.gul + " snävt" }));
    head.append(meta);
    if (d.kommentar) head.append(h("span", { class: "sub", text: d.kommentar }));
    const right = h("div", { class: "right" });
    if (!isRest && canWrite && db) right.append(h("button", { class: "btn small", type: "button", text: "Redigera drop", onclick: () => openDrop(d._id) }));
    if (!isRest && canWrite && db) right.append(h("button", { class: "btn small", type: "button", text: "+ Style i droppen", onclick: () => openStyle(null, { sasong: d.sasong, drop: d.namn }) }));
    head.append(right);
    box.append(head);
    if (!members.length) { box.append(h("div", { class: "empty" }, h("span", { text: isRest ? "" : "Inga produkter ännu. Sätt \"" + d.sasong + "\" och \"" + d.namn + "\" på en style så hamnar den här." }))); return box; }
    const { t, tb } = table([["Produkt"], ["Leverantör"], ["Status"], ["Läge"], ["Samples"], ["PO"]]);
    const order = { Sampling: 0, "Godkänd": 1, "PO lagd": 2, "I produktion": 3, Levererad: 4, Pausad: 5, Kastad: 6 };
    members.slice().sort((a, b) => (order[styleStatusNorm(a.status)] ?? 9) - (order[styleStatusNorm(b.status)] ?? 9) || (a.namn || "").localeCompare(b.namn || "", "sv")).forEach((s) => {
      const xs = samplesOfStyle(s._id);
      const p = plan(s);
      const tr = h("tr", { tabIndex: 0, dataset: { style: s._id } });
      tr.append(
        td("", "c-main", h("div", { class: "prod", text: s.namn }), h("div", { class: "sub", text: [s.typ && s.typ !== "Nyhet" ? s.typ : "", styleKategori(s), (s.farger || []).join(", "), (() => { const pl = poLinesOf(s._id); if (!pl.length) return ""; const u = pl.reduce((a, x) => a + (num(x.r.antal) || 0), 0); const c = pl.reduce((a, x) => a + (lineCost(x.r) || 0), 0); return u + " st · " + fmtTkr(c); })(), isRest && s.drop ? "drop: " + s.drop : ""].filter(Boolean).join(" · ") })),
        td("Leverantör", null, s.leverantor || ""),
        td("Status", null, styleStatusPill(s)),
        td("Läge", null, lageCell(s, p), p.po && !["klar", "skip", "paus"].includes(p.lage) ? h("div", { class: "sub", text: "PO senast " + fmtDate(p.po) }) : null),
        td("Samples", null, xs.length ? h("span", { class: "chips", style: "margin-top:0" }, xs.map(sampleChip)) : h("span", { class: "muted", text: (s.typ || "Nyhet") === "Nyhet" ? "Ingen sample" : "–" })),
        td("PO", "pos", (s.po || []).join(", "))
      );
      tb.append(tr);
    });
    tb.addEventListener("click", (e) => { if (e.target.closest("button")) return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
    tb.addEventListener("keydown", (e) => { if (e.key !== "Enter" || e.target.closest("button")) return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
    box.append(h("div", { class: "ledger-wrap" }, t));
    const tl = dropTimeline(d, members);
    if (tl) box.append(tl);
    return box;
  }
  function dropTimeline(d, members) {
    const ids = new Set(members.map((m) => m._id));
    const pos = D.po.filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status)) && (p.rader || []).some((r) => ids.has(r.styleId)));
    if (!pos.length) return null;
    const today = todayISO();
    const items = pos.map((p) => {
      const start = isISO(p.orderDatum) ? p.orderDatum : isISO(p.importerad) ? p.importerad : (p.andrad || "").slice(0, 10);
      const ex = isISO(p.bekraftadEx) ? p.bekraftadEx : isISO(p.planeradEx) ? p.planeradEx : null;
      let eta = isISO(p.etaLager) ? p.etaLager : null;
      if (!eta && ex) eta = addDays(ex, fraktFor(p.leverantor));
      if (!eta && isISO(start) && num(p.produktionstid) != null) eta = addDays(start, num(p.produktionstid) + fraktFor(p.leverantor));
      return { p, start: isISO(start) ? start : null, ex, eta, est: !isISO(p.etaLager) };
    }).filter((x) => x.start);
    if (!items.length) return null;
    const marks = [];
    if (isISO(d.klartSenast)) marks.push({ date: d.klartSenast, label: "I lager senast", cls: "key" });
    if (isISO(d.lansering)) marks.push({ date: d.lansering, label: "Lansering", cls: "" });
    marks.push({ date: today, label: "Idag", cls: "today" });
    let min = items.reduce((m, x) => (x.start < m ? x.start : m), today), max = today;
    for (const x of items) { if (x.eta && x.eta > max) max = x.eta; if (x.ex && x.ex > max) max = x.ex; }
    for (const m of marks) { if (m.date < min) min = m.date; if (m.date > max) max = m.date; }
    min = addDays(min, -7); max = addDays(max, 14);
    const span = Math.max(1, daysBetween(min, max));
    const pct = (iso) => (daysBetween(min, iso) / span) * 100;
    const wrap = h("div", { class: "tl" });
    wrap.append(h("div", { class: "tl-head" }, h("span", { class: "sec-title", style: "margin:0", text: "Tidslinje" }), h("span", { class: "sub", text: "PO lagd → ex-factory → ETA lager. Streckad = uppskattad från produktionstid och frakt." })));
    const scale = h("div", { class: "tl-scale" });
    let cur = min.slice(0, 7) + "-01";
    while (cur <= max) { const [y, m] = cur.split("-").map(Number); scale.append(h("span", { style: "left:" + pct(cur) + "%", text: MONTHS[m - 1] + (m === 1 ? " " + String(y).slice(2) : "") })); cur = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); }
    wrap.append(scale);
    for (const x of items) {
      const end = x.eta || x.ex || x.start;
      const row = h("div", { class: "tl-row", onclick: () => openPo(x.p._id), tabIndex: 0 });
      row.append(h("span", { class: "tl-label" }, h("b", { text: x.p.nr || x.p._id }), h("span", { class: "sub", text: " " + (x.p.leverantor || "") })));
      const track = h("div", { class: "tl-track" });
      track.append(h("i", { class: "tl-bar" + (x.est ? " est" : "") + (poIsLate(x.p) ? " late" : ""), style: "left:" + pct(x.start) + "%;width:" + Math.max(0.5, pct(end) - pct(x.start)) + "%", title: fmtDate(x.start) + " → " + fmtDate(end) }));
      if (x.ex) track.append(h("i", { class: "tl-dot", style: "left:" + pct(x.ex) + "%", title: "Ex-factory " + fmtDate(x.ex) }));
      for (const m of marks) track.append(h("i", { class: "tl-mark " + m.cls, style: "left:" + pct(m.date) + "%" }));
      track.append(h("span", { class: "tl-end", style: "left:" + Math.min(97, pct(end)) + "%", text: (x.eta ? "ETA " : "") + fmtDate(end) + (x.est ? "?" : "") }));
      row.append(track);
      wrap.append(row);
    }
    wrap.append(h("div", { class: "tl-legend" }, marks.map((m) => h("span", null, h("i", { class: "tl-mark " + m.cls, style: "position:static;display:inline-block;height:10px;margin-right:6px;vertical-align:middle" }), m.label + " " + fmtDate(m.date)))));
    return wrap;
  }
  const DR_LABELS = { sasong: "Säsong", namn: "Namn", ordning: "Ordning", klartSenast: "I lager senast", lansering: "Lansering", kommentar: "Kommentar" };
  function openDrop(id, preset) {
    const isNew = !id;
    const d = isNew ? Object.assign({ _id: null, ordning: 1 }, preset || {}) : byId(D.drops, id);
    if (!d) { toast("Hittar inte droppen."); return; }
    const ro = !canWrite || !db;
    const fSas = inp("f_dsasong", d.sasong, { list: "dlSeason", autocomplete: "off", placeholder: "t.ex. SS27" });
    const fNamn = inp("f_dnamn", d.namn, { list: "dlDrop", autocomplete: "off", placeholder: "t.ex. Drop 1" });
    const fOrd = inp("f_dordning", d.ordning, { type: "number", min: "1", step: "1" });
    const fKlart = inp("f_dklart", d.klartSenast, { type: "date" });
    const fLans = inp("f_dlans", d.lansering, { type: "date" });
    const fKom = area("f_dkom", d.kommentar);
    if (!isNew) { fSas.disabled = true; fNamn.disabled = true; }
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      field("Säsong", fSas), field("Namn", fNamn, { hint: isNew ? "Styles kopplas via säsong + namn" : "Byt inte namn; styles pekar på det" }),
      field("Ordning", fOrd, { hint: "Sorteringsordning inom säsongen" }), field("I lager senast", fKlart, { hint: "Ärvs av styles utan eget datum" }),
      field("Lansering", fLans, { hint: "Valfritt, bara för översikten" }), h("div"),
      field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);
    const members = isNew ? [] : D.styles.filter((s) => dropKey(s.sasong, s.drop) === dropKey(d.sasong, d.namn));
    async function save() {
      const o = { sasong: fSas.value.trim(), namn: fNamn.value.trim(), ordning: num(fOrd.value) ?? 1, klartSenast: fKlart.value || null, lansering: fLans.value || null, kommentar: fKom.value.trim(), andrad: new Date().toISOString() };
      if (!o.sasong || !o.namn) { toast("Fyll i säsong och namn."); return; }
      if (isNew) {
        const nid = slug(o.sasong + "-" + o.namn);
        if (byId(D.drops, nid) || D.drops.some((x) => dropKey(x.sasong, x.namn) === dropKey(o.sasong, o.namn))) { toast("Den droppen finns redan."); return; }
        if (await create("drops", nid, o)) { toast("Drop skapad"); closeSheet(); }
      } else {
        delete o.sasong; delete o.namn;
        if (await write("drops", d._id, o)) { toast("Sparat"); closeSheet(); }
      }
    }
    openSheet({ tag: isNew ? "Ny" : d.sasong, title: isNew ? "Ny drop" : d.sasong + " · " + d.namn, sub: isNew ? "" : members.length + (members.length === 1 ? " produkt" : " produkter"), body: [form], foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("drops", d._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: !members.length, blockText: "Flytta produkterna först", onSave: save }), focus: isNew ? "f_dsasong" : null });
  }

  // ---------- PRODUKTION ----------
  const ProdView = {
    mount(root) {
      const st = UI.prod;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "open", label: "Öppna POs" },
        { key: "confirm", label: "Väntar på bekräftelse", cls: "t-warn" },
        { key: "late", label: "Försenade", cls: "t-late" },
        { key: "ean", label: "Saknar EAN", cls: "t-warn" },
        { key: "spent", label: "Lagt (tkr)" },
        { key: "pay", label: "Att betala 90 d (tkr)", cls: "t-warn" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_prod", "Sök PO, produkt, färg, tyg …", st, () => this.update());
      this.fSeason = filterSelect("f_p_season", "Alla säsonger", st, "season", upd);
      this.fLev = filterSelect("f_p_lev", "Alla leverantörer", st, "lev", upd);
      this.seg = makeSeg([["aktiva", "Aktiva"], ["Placeholder", "Placeholder"], ["Inskickad", "Inskickad"], ["PO bekräftad", "Bekräftad"], ["I produktion", "I produktion"], ["Inlevererad", "Inlevererad"], ["alla", "Alla"]], st, "status", upd);
      this.count = h("span", { class: "count" });
      this.cards = h("div", { class: "cards" });
      const open = (e) => { if (e.target.closest("button")) return; const tr = e.target.closest("tr[data-po], .card-head[data-po]"); if (tr) openPo(tr.dataset.po); };
      this.cards.addEventListener("click", open);
      this.cards.addEventListener("keydown", (e) => { if (e.key === "Enter") open(e); });
      this.empty = h("div", { class: "empty", hidden: true });
      this.budget = h("section", { class: "budget", "aria-label": "Budget" });
      this.pay = h("section", { class: "card", "aria-label": "Betalningar" });
      this.tl = h("div", { class: "cards" });
      this.budgetEdit = false;
      root.append(h("p", { class: "lede", text: "Alla inköpsordrar per säsong: vad som är lagt, bekräftat, i produktion och inlevererat, med kostnad per rad. När en PO sparas får varje SKU (produkt, färg, storlek) sitt EAN automatiskt. Rutan längst ner summerar mot budgeten per kategori." }),
        this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fSeason.el, this.fLev.el, this.seg.el, this.count), this.cards, this.empty, this.tl, this.pay, this.budget);
    },
    seasonInView() {
      const st = UI.prod;
      if (st.season) return st.season;
      const seasons = uniq(D.po.map(poSeason).concat(D.budget.map((b) => b.sasong || b._id))).sort((a, b) => seasonRank(b) - seasonRank(a));
      return seasons[0] || "";
    },
    update() {
      const st = UI.prod, q = norm(st.q);
      const seasons = uniq(D.po.map(poSeason).concat(D.budget.map((b) => b.sasong || b._id), D.styles.map((s) => s.sasong))).sort((a, b) => seasonRank(b) - seasonRank(a) || b.localeCompare(a, "sv"));
      this.fSeason.fill(seasons);
      this.fLev.fill(uniq(D.po.map((p) => p.leverantor)));
      const season = this.seasonInView();
      const inSeason = D.po.filter((p) => !season || norm(poSeason(p)) === norm(season));
      const spent = inSeason.filter((p) => PO_COMMITTED.includes(poStatusNorm(p.status))).reduce((a, p) => a + poTotal(p), 0);
      this.strip.set({
        open: inSeason.filter((p) => PO_OPEN.includes(poStatusNorm(p.status))).length,
        confirm: inSeason.filter((p) => poStatusNorm(p.status) === "Inskickad").length,
        late: inSeason.filter(poIsLate).length,
        ean: inSeason.filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status)) && poEanMissing(p) > 0).length,
        spent: Math.round(spent / 1000),
        pay: Math.round(this.duePayments(90).reduce((a, x) => a + x.belopp, 0) / 1000)
      });
      this.seg.sync();
      const list = D.po.filter((p) => {
        const ps = poStatusNorm(p.status);
        if (season && norm(poSeason(p)) !== norm(season)) return false;
        switch (st.view) {
          case "open": if (!PO_OPEN.includes(ps)) return false; break;
          case "confirm": if (ps !== "Inskickad") return false; break;
          case "late": if (!poIsLate(p)) return false; break;
          case "ean": if (PO_DRAFT.includes(ps) || !poEanMissing(p)) return false; break;
          case "spent": if (!PO_COMMITTED.includes(ps)) return false; break;
          case "pay": if (!this.duePayments(90).some((x) => x.po._id === p._id)) return false; break;
          default:
            if (st.status === "aktiva" && !(PO_OPEN.includes(ps) || ps === "Placeholder")) return false;
            if (st.status !== "aktiva" && st.status !== "alla" && ps !== st.status) return false;
        }
        if (st.lev && p.leverantor !== st.lev) return false;
        if (q && ![p._id, p.nr, p.leverantor, p.sasong, p.drop, p.status, p.kommentar, (p.rader || []).map((r) => [r.produkt, r.farg, r.tyg].join(" ")).join(" ")].join(" ").toLowerCase().includes(q)) return false;
        return true;
      });
      const order = { Problem: 0, Inskickad: 1, "PO bekräftad": 2, "I produktion": 3, Skickad: 4, Placeholder: 5, Inlevererad: 6, Avbruten: 7 };
      list.sort((a, b) => (order[poStatusNorm(a.status)] ?? 9) - (order[poStatusNorm(b.status)] ?? 9) || (poEta(a) || "9999").localeCompare(poEta(b) || "9999") || String(a.nr || a._id).localeCompare(String(b.nr || b._id), "sv"));
      const cards = [];
      for (const p of list) {
        const card = h("section", { class: "card po-card" });
        card.append(this.groupRow(p));
        const lines = (p.rader || []);
        const { t, tb } = table([["Produkt"], ["Färger"], ["Antal", "num"], ["Kostnad", "num"], ["EAN"]]);
        if (!lines.length) tb.append(h("tr", { dataset: { po: p._id } }, h("td", { colSpan: 5, class: "sub", text: "Inga rader ännu – öppna PO:n och lägg till produkter." })));
        const byProd = new Map();
        for (const r of lines) { const k = (r.styleId || "") + "|" + norm(r.produkt); if (!byProd.has(k)) byProd.set(k, []); byProd.get(k).push(r); }
        for (const rs of byProd.values()) tb.append(this.prodRow(p, rs));
        card.append(h("div", { class: "ledger-wrap" }, t));
        cards.push(card);
      }
      this.cards.replaceChildren(...cards);
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(...(!loaded.has("po") ? [h("strong", { text: db ? "Laddar produktion …" : "Ingen produktion att visa" })] : D.po.length ? [h("strong", { text: "Inget matchar filtret" }), h("span", { text: "Byt säsong, status eller rensa sökningen." })] : [h("strong", { text: "Inga POs ännu" }), h("span", { text: "Lägg den första med \"+ Ny PO\"." })]));
      this.count.textContent = list.length + " av " + inSeason.length + " POs" + (season ? " i " + season : "");
      this.renderPayments();
      this.renderTimelines(season);
      this.renderBudget(season, inSeason);
    },
    renderTimelines(season) {
      const box = this.tl; box.replaceChildren();
      if (!season) return;
      const drops = dropsOfSeason(season);
      const inSeason = D.styles.filter((s) => norm(s.sasong) === norm(season));
      const cards = [];
      for (const d of drops) {
        const members = inSeason.filter((s) => dropKey(s.sasong, s.drop) === dropKey(d.sasong, d.namn));
        const tl = dropTimeline(d, members);
        if (tl) cards.push(h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: d.namn + " – " + season }), h("span", { class: "sub", text: [isISO(d.klartSenast) ? "I lager senast " + fmtDate(d.klartSenast) : "", isISO(d.lansering) ? "Lansering " + fmtDate(d.lansering) : ""].filter(Boolean).join(" · ") }), canWrite && db ? h("div", { class: "right" }, h("button", { class: "btn small", type: "button", text: "Redigera drop", onclick: () => openDrop(d._id) })) : null), tl));
      }
      const placed = new Set(drops.flatMap((d) => inSeason.filter((s) => dropKey(s.sasong, s.drop) === dropKey(d.sasong, d.namn)).map((s) => s._id)));
      const rest = inSeason.filter((s) => !placed.has(s._id));
      const tlr = rest.length ? dropTimeline({ sasong: season, namn: "Utan drop" }, rest) : null;
      if (tlr) cards.push(h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: "Utan drop – " + season })), tlr));
      box.replaceChildren(...cards);
    },
    duePayments(days) {
      const lim = addDays(todayISO(), days);
      const out = [];
      for (const p of D.po) { if (PO_DRAFT.includes(poStatusNorm(p.status))) continue; for (const x of payments(p)) if (!x.betald && (!x.datum || x.datum <= lim)) out.push(x); }
      return out.sort((a, b) => (a.datum || "9999").localeCompare(b.datum || "9999"));
    },
    renderPayments() {
      const box = this.pay; box.replaceChildren();
      const all = [];
      for (const p of D.po) { if (PO_DRAFT.includes(poStatusNorm(p.status))) continue; for (const x of payments(p)) if (!x.betald) all.push(x); }
      all.sort((a, b) => (a.datum || "9999").localeCompare(b.datum || "9999"));
      const due90 = all.filter((x) => !x.datum || x.datum <= addDays(todayISO(), 90));
      const sum = (xs) => xs.reduce((a, x) => a + x.belopp, 0);
      box.append(h("div", { class: "card-head" }, h("h3", { text: "Betalningar" }), h("span", { class: "sub", text: all.length ? "Obetalt totalt " + fmtTkr(sum(all)) + " · inom 90 dagar " + fmtTkr(sum(due90)) + " · alla säsonger" : "Inga obetalda betalningar registrerade. Lägg förskott och slutbetalning på varje PO under Betalningsplan." })));
      if (!all.length) return;
      const { t, tb } = table([["Förfaller"], ["PO"], ["Leverantör"], ["Typ"], ["Belopp", "num"], ["Status"]]);
      const byLev = {};
      for (const x of all.slice(0, 40)) {
        const d = x.datum ? diffDays(x.datum) : null;
        tb.append(h("tr", { tabIndex: 0, dataset: { po: x.po._id } },
          td("Förfaller", "mono", x.datum ? fmtDate(x.datum) : h("span", { class: "muted", text: "datum saknas" }), d != null ? h("div", { class: "days " + (d < 0 ? "late" : d <= 14 ? "soon" : ""), text: fmtDays(d) }) : null),
          td("PO", "c-main", h("div", { class: "prod", text: x.po.nr || x.po._id }), h("div", { class: "sub", text: [x.po.sasong, x.po.drop].filter(Boolean).join(" ") })),
          td("Leverantör", null, x.po.leverantor || ""), td("Typ", null, x.typ), td("Belopp", "num", fmtSEK(x.belopp)), td("Status", null, poStatusPill(x.po))));
        byLev[x.po.leverantor || "–"] = (byLev[x.po.leverantor || "–"] || 0) + x.belopp;
      }
      box.append(h("div", { class: "ledger-wrap" }, t));
      box.append(h("div", { class: "totals", style: "margin:0" }, Object.entries(byLev).sort((a, b) => b[1] - a[1]).map(([k, v]) => h("span", null, k + ": ", h("b", { text: fmtTkr(v) })))));
    },
    groupRow(p) {
      const ps = poStatusNorm(p.status);
      const eta = poEta(p);
      const d = eta ? diffDays(eta) : null;
      const bits = [h("span", { class: "nr", text: p.nr || p._id }), h("span", { class: "m", text: p.leverantor || "" }), h("span", { class: "m", text: [p.sasong, p.drop].filter(Boolean).join(" ") }), poStatusPill(p)];
      if (p.prioritet && p.prioritet !== "Normal") bits.push(h("span", { class: "m", text: "Prio " + p.prioritet.toLowerCase() }));
      bits.push(h("span", { class: "m" }, "Order bekräftad ", h("b", { text: p.orderBekraftad ? "✔" : "–" })));
      if (isISO(p.bekraftadEx) || isISO(p.planeradEx)) bits.push(h("span", { class: "m" }, (isISO(p.bekraftadEx) ? "Ex-factory " : "Planerad ex-factory "), h("b", { text: fmtDate(p.bekraftadEx || p.planeradEx) })));
      if (isISO(p.etaLager)) bits.push(h("span", { class: "m" }, "ETA lager ", h("b", { text: fmtDate(p.etaLager) })));
      if (d != null && PO_OPEN.includes(ps)) bits.push(h("span", { class: "days " + (d < 0 ? "late" : d <= 14 ? "soon" : ""), text: fmtDays(d) }));
      if (p.tygstatus) bits.push(h("span", { class: "m" }, "Tyg: ", h("b", { text: p.tygstatus })));
      const pays = payments(p);
      if (pays.length) bits.push(h("span", { class: "m" }, "Betalning: ", h("b", { text: pays.map((x) => x.typ.toLowerCase() + " " + fmtTkr(x.belopp) + (x.betald ? " ✔" : x.datum ? " " + fmtDate(x.datum) : "")).join(", ") })));
      else if (p.forskottBetalt || p.slutbetalning) bits.push(h("span", { class: "m" }, "Betalt: ", h("b", { text: [p.forskottBetalt ? "förskott " + p.forskottBetalt : "", p.slutbetalning ? "slut " + p.slutbetalning : ""].filter(Boolean).join(", ") })));
      const tot = poTotal(p);
      bits.push(h("span", { class: "m" }, "Totalt ", h("b", { text: fmtSEK(tot) })));
      const miss = PO_DRAFT.includes(ps) ? 0 : poEanMissing(p);
      if (miss) bits.push(h("span", { class: "flag", text: miss + " SKU utan EAN" }));
      if (Array.isArray(p.bilagor) && p.bilagor.length) bits.push(h("span", { class: "m" }, "Bilagor ", h("b", { text: String(p.bilagor.length) })));
      if (p.kommentar) bits.push(h("span", { class: "m", text: p.kommentar }));
      const head = h("div", { class: "card-head", dataset: { po: p._id }, tabIndex: 0, style: "cursor:pointer" }, h("h3", { text: p.nr || p._id }), h("div", { class: "po-head" }, bits.slice(1)));
      if (canWrite && db) head.append(h("div", { class: "right" }, h("button", { class: "btn small", type: "button", text: "Öppna PO", onclick: () => openPo(p._id) })));
      return head;
    },
    prodRow(p, rs) {
      const r0 = rs[0];
      const st = byId(D.styles, r0.styleId);
      const units = rs.reduce((a, r) => a + (num(r.antal) || 0), 0);
      const unknown = rs.some((r) => num(r.antal) == null);
      const cost = rs.reduce((a, r) => a + (lineCost(r) || 0), 0);
      let eanTot = 0, eanGot = 0;
      if (st) { const have = new Set((st.ean || []).map(vkey)); for (const r of rs) { if (!r.farg) continue; const sizes = (r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st)) || []; eanTot += sizes.length; eanGot += sizes.filter((sz) => have.has(vkey({ farg: r.farg, storlek: sz }))).length; } }
      const colours = rs.map((r) => (r.farg || "TBA") + (num(r.antal) != null ? " " + r.antal : "")).join(" · ");
      return h("tr", { tabIndex: 0, dataset: { po: p._id } },
        td("", "c-main", h("div", { class: "prod", text: r0.produkt || (st ? st.namn : "–") }), h("div", { class: "sub" }, r0.typ && r0.typ !== "Nyhet" ? chip(r0.typ) : null, st ? h("button", { class: "linkish", type: "button", text: st._id + (styleKategori(st) ? " · " + styleKategori(st) : ""), onclick: (e) => { e.stopPropagation(); openStyle(st._id); } }) : h("span", { class: "muted", text: "Ingen style kopplad" }))),
        td("Färger", null, colours),
        td("Antal", "num", unknown && !units ? "?" : String(units) + (unknown ? "+" : "")),
        td("Kostnad", "num", cost ? fmtSEK(cost) : "–"),
        td("EAN", "num", !st || !eanTot ? "–" : eanGot + "/" + eanTot)
      );
    },
    lineRow(p, r) {
      const st = byId(D.styles, r.styleId);
      const sizes = (r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st));
      const have = st ? new Set((st.ean || []).map(vkey)) : new Set();
      const got = r.farg ? sizes.filter((sz) => have.has(vkey({ farg: r.farg, storlek: sz }))).length : 0;
      const cost = lineCost(r);
      const perSize = sizeQty(r);
      const tr = h("tr", { tabIndex: 0, dataset: { po: p._id } },
        td("", "c-main", h("div", { class: "prod", text: r.produkt || (st ? st.namn : "–") }), h("div", { class: "sub" }, r.typ && r.typ !== "Nyhet" ? chip(r.typ) : null, st ? h("button", { class: "linkish", type: "button", text: st._id + (styleKategori(st) ? " · " + styleKategori(st) : ""), onclick: (e) => { e.stopPropagation(); openStyle(st._id); } }) : h("span", { class: "muted", text: "Ingen style kopplad" }))),
        td("Färg", null, r.farg || h("span", { class: "muted", text: "TBA" })),
        td("Tyg", "note", r.tyg || ""),
        td("Antal", "num", r.antal == null || r.antal === "" ? "?" : String(r.antal), perSize ? h("div", { class: "sub", style: "text-align:right;font-family:var(--f-mono)", text: sizes.map((sz) => sz + ":" + (perSize[sz] ?? 0)).join(" ") }) : null),
        td("Tyg/enhet", "num", num(r.tygkostnad) != null ? fmtSEK(r.tygkostnad) : "–"),
        td("Styckpris", "num", num(r.styckpris) != null ? fmtSEK(r.styckpris) : "–"),
        td("Kostnad", "num", cost != null ? fmtSEK(cost) : "–"),
        td("EAN", "mono", !st || !r.farg ? "–" : sizes.length ? got + "/" + sizes.length : "–"),
        td("Fotosample", null, r.fotosample || p.fotosample || "", (r.fotosampleLeverans || p.fotosampleLeverans) ? h("div", { class: "sub mono", text: fmtDate(r.fotosampleLeverans || p.fotosampleLeverans) }) : null)
      );
      return tr;
    },
    renderBudget(season, inSeason) {
      const box = this.budget; box.replaceChildren();
      if (!season) { box.append(h("p", { class: "hint", text: "Välj en säsong för att se budgeten." })); return; }
      const b = budgetOf(season);
      const kats = KATEGORIER.slice();
      const per = {};
      for (const k of kats) per[k] = { budget: b && b.kategorier ? num(b.kategorier[k]) : null, lagt: 0, plan: 0 };
      per["Okategoriserat"] = { budget: null, lagt: 0, plan: 0 };
      for (const p of inSeason) {
        const ps = poStatusNorm(p.status);
        if (ps === "Avbruten") continue;
        const bucket = PO_COMMITTED.includes(ps) ? "lagt" : "plan";
        for (const r of p.rader || []) { const st = byId(D.styles, r.styleId); const k = styleKategori(st) || "Okategoriserat"; if (!per[k]) per[k] = { budget: null, lagt: 0, plan: 0 }; per[k][bucket] += lineCost(r) || 0; }
      }
      const total = b ? num(b.total) : null;
      const sumBudget = kats.reduce((a, k) => a + (per[k].budget || 0), 0);
      const sumLagt = Object.values(per).reduce((a, x) => a + x.lagt, 0);
      const sumPlan = Object.values(per).reduce((a, x) => a + x.plan, 0);
      const edit = this.budgetEdit;
      const head = h("div", { class: "budget-head" }, h("h3", { text: "Budget " + season }), h("span", { class: "sub", text: b ? "Inköpsvärde exkl. frakt och tull" : "Ingen budget satt för " + season + " ännu." }));
      if (canAdmin && canWrite && db && !edit && this.allowEdit !== false) head.append(h("span", { class: "spacer" }), h("button", { class: "btn small", type: "button", text: b ? "Ändra budget" : "Sätt budget", onclick: () => { this.budgetEdit = true; this.update(); } }));
      box.append(head);
      const inputs = {};
      const over = total != null && sumLagt + sumPlan > total;
      const tile = (k, v, cls) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v big " + (cls || ""), text: v }));
      const totRow = h("div", { class: "budget-tot" });
      if (edit) { const i = inp("bud_total", total == null ? "" : Math.round(total / 1000), { type: "number", min: "0", step: "1" }); inputs._total = i; totRow.append(h("div", { class: "kv" }, h("span", { class: "k", text: "Ram (tkr)" }), i)); }
      else totRow.append(tile("Ram", total != null ? fmtTkr(total) : "–"));
      totRow.append(tile("Lagt", fmtTkr(sumLagt)), tile("Planerat", fmtTkr(sumPlan)), tile("Kvar", total != null ? fmtTkr(total - sumLagt - sumPlan) : "–", over ? "over" : ""), tile("Använt", total ? Math.round(((sumLagt + sumPlan) / total) * 100) + " %" : "–"));
      box.append(totRow);
      const grid = h("div", { class: "budget-grid" });
      const allKats = kats.concat(Object.keys(per).filter((k) => !kats.includes(k) && (per[k].lagt || per[k].plan)));
      for (const k of allKats) {
        const x = per[k]; const bud = x.budget; const used = x.lagt + x.plan;
        const pct = bud ? Math.min(100, (x.lagt / bud) * 100) : 0, pct2 = bud ? Math.min(100, (used / bud) * 100) : 0;
        const card = h("div", { class: "bcat" }, h("span", { class: "k", text: k }));
        if (edit && kats.includes(k)) { const i = inp("bud_" + slug(k), bud == null ? "" : Math.round(bud / 1000), { type: "number", min: "0", step: "1", placeholder: "tkr" }); inputs[k] = i; card.append(i); }
        else card.append(h("span", { class: "big" }, bud != null ? fmtTkr(bud) : "–", bud ? h("small", { text: Math.round((used / bud) * 100) + " %" }) : null));
        card.append(h("div", { class: "bar" }, h("i", { class: "plan" + (bud && used > bud ? " over" : ""), style: "width:" + pct2 + "%" }), h("i", { style: "width:" + pct + "%" })));
        card.append(h("div", { class: "rows" }, h("div", null, "Lagt", h("b", { text: fmtTkr(x.lagt) })), h("div", null, "Planerat", h("b", { text: fmtTkr(x.plan) })), h("div", { class: bud != null && bud - used < 0 ? "over" : "" }, "Kvar", h("b", { text: bud != null ? fmtTkr(bud - used) : "–" }))));
        grid.append(card);
      }
      box.append(grid);
      const foot = h("div", { class: "budget-foot" });
      foot.append(h("span", { text: "Svart = lagt (bekräftade POs), grått = planerat (placeholders och inskickade)." }));
      if (total != null && sumBudget && Math.round(sumBudget) !== Math.round(total)) foot.append(h("span", { text: "Kategorierna summerar till " + fmtTkr(sumBudget) + " – " + fmtTkr(total - sumBudget) + " av ramen är ofördelat." }));
      if (per["Okategoriserat"].lagt || per["Okategoriserat"].plan) foot.append(h("span", { class: "late-text", text: "Rader utan kategori räknas inte mot någon kategori – sätt kategori på stylen." }));
      if (edit) foot.append(h("span", { class: "spacer" }), h("button", { class: "btn small", type: "button", text: "Avbryt", onclick: () => { this.budgetEdit = false; this.update(); } }),
        h("button", { class: "btn small primary", type: "button", text: "Spara budget", onclick: async () => {
          const kategorier = {}; for (const k of kats) { const v = num(inputs[k].value); kategorier[k] = v == null ? null : v * 1000; }
          const tv = num(inputs._total.value);
          try { await db.collection("budget").doc(slug(season)).set({ sasong: season, total: tv == null ? null : tv * 1000, kategorier, andrad: new Date().toISOString(), av: myId }); toast("Budget sparad"); this.budgetEdit = false; } catch (e) { writeError(e); }
        } }));
      box.append(foot);
    }
  };

  // ---------- PO sheet ----------
  const PO_LABELS = { nr: "PO-nr", leverantor: "Leverantör", sasong: "Säsong", drop: "Drop", status: "Status", prioritet: "Prioritet", produktionstid: "Produktionstid", fotosample: "Fotosample", fotosampleLeverans: "Fotosample väntas", tygstatus: "Tygstatus", orderBekraftad: "Order bekräftad", planeradEx: "Planerad ex-factory", bekraftadEx: "Bekräftad ex-factory", etaLager: "ETA lager", valuta: "Valuta", kommentar: "Kommentar", orderDatum: "Order date", leveransOnskad: "Requested delivery", labelInstructions: "Label instructions", forskottBelopp: "Förskott belopp", forskottDatum: "Förskott förfaller", forskottBetald: "Förskott betalt", slutBelopp: "Slutbetalning belopp", slutDatum: "Slutbetalning förfaller", slutBetald: "Slutbetalning betald" };
  const payments = (po) => { const out = []; if (num(po.forskottBelopp)) out.push({ po, typ: "Förskott", belopp: num(po.forskottBelopp), datum: po.forskottDatum, betald: !!po.forskottBetald }); if (num(po.slutBelopp)) out.push({ po, typ: "Slutbetalning", belopp: num(po.slutBelopp), datum: po.slutDatum, betald: !!po.slutBetald }); return out; };
  function nextPoNr(lev, season) {
    const l = levByName(lev);
    const code = (l && l.kod) || String(lev || "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "PO";
    const pre = (code + "-" + (season || "") + "-").toUpperCase();
    let n = 0;
    const consider = (x) => { const u = String(x || "").toUpperCase(); if (u.startsWith(pre) && /^\d+$/.test(u.slice(pre.length))) n = Math.max(n, Number(u.slice(pre.length))); };
    for (const p of D.po) consider(p.nr);
    for (const s of D.styles) for (const x of s.po || []) consider(x);
    return pre + (n + 1);
  }
  function openPo(id, preset) {
    const isNew = !id;
    const po = isNew ? Object.assign({ _id: null, status: "Placeholder", prioritet: "Normal", valuta: "SEK", rader: [], logg: [], orderDatum: todayISO(), labelInstructions: PO_DEFAULTS.label }, preset || {}) : byId(D.po, id);
    if (!po) { toast("Hittar inte PO:n."); return; }
    const ro = !canWrite || !db;
    const current = () => (isNew ? po : byId(D.po, po._id) || po);
    const fNr = inp("f_pnr", po.nr, { placeholder: "t.ex. EMI-SS27-5" });
    const fLev = inp("f_plev", po.leverantor, { list: "dlLev", autocomplete: "off" });
    const fSas = inp("f_psas", po.sasong, { list: "dlSeason", autocomplete: "off", placeholder: "t.ex. SS27" });
    const fDrop = inp("f_pdrop", po.drop, { list: "dlDrop", autocomplete: "off", placeholder: "t.ex. Drop 1" });
    const fStatus = selectEl("f_pstatus", PO_STATUS, poStatusNorm(po.status));
    const fPrio = selectEl("f_pprio", PRIORITET, po.prioritet || "Normal");
    const fProd = inp("f_pprod", po.produktionstid, { type: "number", min: "0", step: "1", placeholder: "dagar" });
    const fFoto = inp("f_pfoto", po.fotosample, { placeholder: "Finns / Beställd / Saknas" });
    const fFotoD = inp("f_pfotod", po.fotosampleLeverans, { type: "date" });
    const fTygS = selectEl("f_ptygs", TYGSTATUS_PO.map((x) => [x, x || "–"]), po.tygstatus || "");
    const fBek = selectEl("f_pbek", [["", "Nej"], ["1", "Ja"]], po.orderBekraftad ? "1" : "");
    const fPlan = inp("f_pplan", po.planeradEx, { type: "date" });
    const fBekEx = inp("f_pbekex", po.bekraftadEx, { type: "date" });
    const fEta = inp("f_peta", po.etaLager, { type: "date" });
    const fOrdD = inp("f_pordd", po.orderDatum, { type: "date" });
    const fLevO = inp("f_plevo", po.leveransOnskad, { type: "date" });
    const fLabel = area("f_plabel", po.labelInstructions == null ? PO_DEFAULTS.label : po.labelInstructions, "Label instructions till PO-filen");
    const fFskB = inp("f_pfskb", po.forskottBelopp, { type: "number", min: "0", step: "1", placeholder: "belopp" });
    const fFskD = inp("f_pfskd", po.forskottDatum, { type: "date" });
    const fFskP = selectEl("f_pfskp", [["", "Ej betalt"], ["1", "Betalt"]], po.forskottBetald ? "1" : "");
    const fSlutB = inp("f_pslutb", po.slutBelopp, { type: "number", min: "0", step: "1", placeholder: "belopp" });
    const fSlutD = inp("f_pslutd", po.slutDatum, { type: "date" });
    const fSlutP = selectEl("f_pslutp", [["", "Ej betalt"], ["1", "Betalt"]], po.slutBetald ? "1" : "");
    const legacyPay = [po.forskottBetalt ? "Förskott (gammalt fält): " + po.forskottBetalt : "", po.slutbetalning ? "Slutbetalning (gammalt fält): " + po.slutbetalning : ""].filter(Boolean).join(" · ");
    const fVal = inp("f_pval", po.valuta || "SEK");
    const fKom = area("f_pkom", po.kommentar);
    const nrHint = h("span", { class: "hint", text: isNew ? "Tomt = nästa löpnummer för leverantören och säsongen" : "" });
    const syncProd = () => { if (!fProd.value && fLev.value) { const v = levNum(fLev.value, "produktionstid"); if (v != null) fProd.placeholder = v + " d (leverantörens)"; } };
    fLev.addEventListener("change", syncProd); syncProd();
    const form = h("form", { class: "form three", id: "poForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("div", { class: "field" }, h("label", { for: "f_pnr", text: "PO-nr" }), fNr, nrHint), field("Leverantör", fLev), field("Status", fStatus),
      field("Säsong", fSas), field("Drop", fDrop), field("Prioritet", fPrio),
      field("Produktionstid (dagar)", fProd), field("Tygstatus", fTygS), field("Order bekräftad", fBek),
      field("Planerad ex-factory", fPlan), field("Bekräftad ex-factory", fBekEx), field("ETA lager", fEta),
      field("Fotosample", fFoto), field("Fotosample väntas", fFotoD), field("Valuta", fVal),
      field("Kommentar", fKom, { full: true }),
      h("h3", { class: "sec-title full", text: "Betalningsplan" }),
      field("Förskott, belopp", fFskB), field("Förskott, förfaller", fFskD), field("Förskott", fFskP),
      field("Slutbetalning, belopp", fSlutB), field("Slutbetalning, förfaller", fSlutD), field("Slutbetalning", fSlutP),
      legacyPay ? h("p", { class: "hint full", text: legacyPay }) : null,
      h("h3", { class: "sec-title full", text: "PO-filen (Rubatos mall)" }),
      field("Order date", fOrdD), field("Requested delivery date", fLevO, { hint: "Tomt = droppens \"I lager senast\"" }), h("div"),
      field("Label instructions", fLabel, { full: true, hint: "Payment terms skrivs aldrig på PO:n" }));
    if (ro) lock(form);

    // ---- lines ----
    const linesEl = h("div", { class: "lines" });
    const totalsEl = h("div", { class: "totals" });
    const lines = (po.rader || []).map((r) => Object.assign({}, r));
    function styleByName(name) { const n = norm(name); return D.styles.find((s) => norm(s.namn) === n) || null; }
    function lineEditor(r, idx) {
      const st = r.styleId ? byId(D.styles, r.styleId) : null;
      const fProdN = inp("l_prod_" + idx, r.produkt || (st ? st.namn : ""), { list: "dlStyle", autocomplete: "off", placeholder: "Produkt (style)" });
      const fFarg = inp("l_farg_" + idx, r.farg, { placeholder: "Färg" });
      const fTyp = selectEl("l_typ_" + idx, STYLE_TYP, r.typ || (st ? st.typ : "Nyhet") || "Nyhet");
      const fTyg = inp("l_tyg_" + idx, r.tyg, { list: "dlTyg", autocomplete: "off", placeholder: "Tyg" });
      const fStorl = inp("l_storl_" + idx, (r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st)).join(", "), { placeholder: "Storlekar, t.ex. 46, 48, 50" });
      const fPer = inp("l_per_" + idx, r.perStorlek ? (r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st)).map((sz) => r.perStorlek[sz] ?? 0).join(", ") : "", { placeholder: "Antal per storlek, t.ex. 4, 5, 11" });
      const fBesk = inp("l_besk_" + idx, r.beskrivning, { placeholder: "Beskrivning till PO-filen, t.ex. tyg, knappar, label" });
      const fAntal = inp("l_antal_" + idx, r.antal, { type: "number", min: "0", step: "1", placeholder: "Antal" });
      const fTygK = inp("l_tygk_" + idx, r.tygkostnad, { type: "number", min: "0", step: "0.01", placeholder: "Tyg/enhet" });
      const fPris = inp("l_pris_" + idx, r.styckpris, { type: "number", min: "0", step: "0.01", placeholder: "Styckpris (CMT)" });
      const fFotoL = inp("l_foto_" + idx, r.fotosample, { placeholder: "Fotosample" });
      const kost = h("span", { class: "mono" });
      const hint = h("span", { class: "sub" });
      const sync = () => {
        const s2 = styleByName(fProdN.value);
        r.produkt = fProdN.value.trim(); r.styleId = s2 ? s2._id : (r.styleId && st && norm(st.namn) === norm(r.produkt) ? r.styleId : null);
        r.farg = fFarg.value.trim(); r.typ = fTyp.value; r.tyg = fTyg.value.trim(); r.fotosample = fFotoL.value.trim();
        r.storlekar = parseList(fStorl.value);
        const per = parseList(fPer.value).map(num);
        if (per.length && r.storlekar.length) { r.perStorlek = {}; r.storlekar.forEach((sz, i) => (r.perStorlek[sz] = per[i] ?? 0)); if (!fAntal.value || fAntal.dataset.auto === "1") { fAntal.value = per.reduce((a, b) => a + (b || 0), 0); fAntal.dataset.auto = "1"; } }
        else r.perStorlek = null;
        r.antal = num(fAntal.value); r.tygkostnad = num(fTygK.value); r.styckpris = num(fPris.value);
        const c = lineCost(r); r.kostnad = c;
        kost.textContent = c != null ? fmtSEK(c) : "–";
        hint.textContent = s2 ? s2._id + (styleKategori(s2) ? " · " + styleKategori(s2) : " · saknar kategori") + (s2.storlekar && s2.storlekar.length && !fStorl.value ? " · storlekar från stylen" : "") : (r.produkt ? "Ny style skapas vid sparning" : "");
        renderTotals();
      };
      [fProdN, fFarg, fTyp, fTyg, fStorl, fPer, fAntal, fTygK, fPris, fFotoL].forEach((x) => { x.addEventListener("input", sync); x.addEventListener("change", sync); });
      fAntal.addEventListener("input", () => { fAntal.dataset.auto = ""; });
      fProdN.addEventListener("change", () => { const s2 = styleByName(fProdN.value); if (s2 && !fStorl.value && sizesOf(s2).length) fStorl.value = sizesOf(s2).join(", "); if (s2 && !fTyp.dataset.touched) fTyp.value = s2.typ || "Nyhet"; sync(); });
      fBesk.addEventListener("input", () => { r.beskrivning = fBesk.value.trim(); });
      fTyp.addEventListener("change", () => (fTyp.dataset.touched = "1"));
      const box = h("div", { class: "line" },
        h("div", { class: "row two" }, field("Produkt", fProdN), field("Färg", fFarg), field("Nyhet / restock", fTyp)),
        h("div", { class: "row two" }, field("Tyg", fTyg), field("Storlekar", fStorl), field("Antal per storlek", fPer)),
        h("div", { class: "row", style: "grid-template-columns:1fr" }, field("Beskrivning (PO-filen)", fBesk)),
        h("div", { class: "row" }, field("Antal", fAntal), field("Tyg/enhet", fTygK), field("Styckpris", fPris), field("Fotosample", fFotoL), h("div", { class: "field" }, h("label", { text: "Kostnad" }), h("div", { style: "padding:7px 0" }, kost)), h("div")),
        h("div", { class: "foot" }, hint, ro ? null : h("button", { class: "btn small danger", type: "button", text: "Ta bort rad", onclick: () => { lines.splice(idx, 1); renderLines(); } })));
      if (ro) lock(box);
      sync();
      return box;
    }
    function renderLines() { linesEl.replaceChildren(...lines.map((r, i) => lineEditor(r, i))); renderTotals(); }
    function renderTotals() {
      const units = lines.reduce((a, r) => a + (num(r.antal) || 0), 0);
      const cost = lines.reduce((a, r) => a + (lineCost(r) || 0), 0);
      const perColor = {}; for (const r of lines) { const k = r.farg || "TBA"; perColor[k] = (perColor[k] || 0) + (num(r.antal) || 0); }
      totalsEl.replaceChildren(h("span", null, "Rader: ", h("b", { text: String(lines.length) })), h("span", null, "Antal: ", h("b", { text: String(units) })), h("span", null, "Per färg: ", h("b", { text: Object.entries(perColor).map(([k, v]) => k + " " + v).join(", ") || "–" })), h("span", null, "Snitt/enhet: ", h("b", { text: units ? fmtSEK(cost / units) : "–" })), h("span", null, "Totalt: ", h("b", { text: fmtSEK(cost) })));
    }
    renderLines();
    const linesSec = h("section", null, h("h3", { class: "sec-title", text: "Produkter på PO:n" }), linesEl, ro ? null : h("div", { style: "margin-top:10px" }, h("button", { class: "btn small", type: "button", text: "+ Lägg till rad", onclick: () => { lines.push({ produkt: "", farg: "", typ: "Nyhet", tyg: "", storlekar: [], antal: null, tygkostnad: null, styckpris: null }); renderLines(); setTimeout(() => { const el = $("l_prod_" + (lines.length - 1)); if (el) el.focus(); }, 20); } })), totalsEl);

    // ---- EAN for the SKUs on this PO ----
    const attSec = h("section");
    function renderAtt() {
      attSec.replaceChildren(h("h3", { class: "sec-title", text: "Bilagor (PDF)" }));
      if (isNew) { attSec.append(h("p", { class: "hint", text: "Spara PO:n först, sedan kan du lägga till PDF:er – orderbekräftelse, proforma, faktura." })); return; }
      const cur = current() || po;
      const list = Array.isArray(cur.bilagor) ? cur.bilagor : [];
      if (list.length) attSec.append(h("ul", { class: "mini" }, list.map((b) => h("li", null, h("div", { class: "mini-row", style: "cursor:default" }, h("span", { class: "tag", text: "PDF" }), h("span", { class: "mini-main" }, h("a", { href: imgUrl(b.id), target: "_blank", rel: "noopener", text: b.namn || "bilaga.pdf" }), h("span", { class: "sub", text: b.t ? fmtDate(String(b.t).slice(0, 10)) : "" })), h("span", { class: "mini-side" }, ro || !assets ? null : h("button", { class: "btn small danger", type: "button", text: "Ta bort", onclick: async () => { if (!confirm("Ta bort bilagan för alla?")) return; const left = list.filter((x) => x.id !== b.id); if (await write("po", cur._id, { bilagor: left, andrad: new Date().toISOString() })) { try { await assets.delete(b.id); } catch (e) {} } } })))))));
      else attSec.append(h("p", { class: "hint", text: "Inga bilagor ännu." }));
      if (!ro && assets) {
        const input = h("input", { type: "file", accept: "application/pdf,image/*", multiple: true, hidden: true, onchange: async () => {
          const files = [...input.files]; input.value = ""; if (!files.length) return;
          const added = [];
          for (const f of files) { try { const blob = f.type === "application/pdf" ? f : await shrinkImage(f, 2000); const r = await assets.upload(blob, blob.type ? undefined : { type: "application/pdf" }); added.push({ id: r.id, namn: f.name, t: new Date().toISOString(), av: myId }); } catch (e) { toast(e && e.code === "too_large" ? f.name + " är för stor (max 20 MB)." : "Kunde inte ladda upp " + f.name + "."); } }
          const c2 = current() || cur;
          if (added.length) await write("po", c2._id, { bilagor: (Array.isArray(c2.bilagor) ? c2.bilagor : []).concat(added), andrad: new Date().toISOString(), logg: (c2.logg || []).concat(logEntry(added.length + (added.length === 1 ? " bilaga tillagd: " : " bilagor tillagda: ") + added.map((a) => a.namn).join(", "))) });
          renderAtt();
        } });
        attSec.append(h("div", { class: "dropzone" }, h("button", { class: "btn small", type: "button", text: "+ Lägg till PDF", onclick: () => input.click() }), h("span", { class: "hint", text: "Orderbekräftelse, proforma, faktura, specar" }), input));
      } else if (!ro && !assets) attSec.append(h("p", { class: "hint", text: "Bilagor kan bara laddas upp med Editor-behörighet." }));
    }
    const eanSec = h("section");
    function skuPlan(cur) {
      const out = [];
      for (const r of cur.rader || []) {
        const st = byId(D.styles, r.styleId); if (!st || !r.farg) continue;
        const sizes = (r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st)) || [];
        const have = new Set((st.ean || []).map(vkey));
        const miss = sizes.filter((sz) => !have.has(vkey({ farg: r.farg, storlek: sz })));
        out.push({ st, r, sizes, miss });
      }
      return out;
    }
    function renderEan() {
      eanSec.replaceChildren(h("h3", { class: "sec-title", text: "EAN per SKU" }));
      if (isNew) { eanSec.append(h("p", { class: "hint", text: "När PO:n sparas får varje SKU (produkt × färg × storlek) ett EAN ur er GS1-serie. Placeholders får EAN först när statusen ändras." })); return; }
      const cur = current(); const plan = skuPlan(cur);
      const missing = plan.reduce((a, x) => a + x.miss.length, 0);
      const noSizes = plan.filter((x) => !x.sizes.length);
      const rows = [];
      for (const x of plan) for (const sz of x.sizes) { const e = (x.st.ean || []).find((y) => vkey(y) === vkey({ farg: x.r.farg, storlek: sz })); rows.push(h("tr", null, h("td", { text: x.st.namn }), h("td", { text: x.r.farg }), h("td", { text: sz }), h("td", { class: "mono" }, e ? e.ean : h("span", { class: "muted", text: "–" })))); }
      if (rows.length) eanSec.append(h("div", { class: "vscroll", style: "margin-top:0" }, h("table", { class: "vtable" }, h("thead", null, h("tr", null, ["Produkt", "Färg", "Storlek", "EAN"].map((t) => h("th", { text: t })))), h("tbody", null, rows))));
      else eanSec.append(h("p", { class: "hint", text: "Inga SKU:er ännu. Rader behöver en kopplad style, färg och storlekar." }));
      if (noSizes.length) eanSec.append(h("p", { class: "warnline", text: noSizes.map((x) => x.st.namn + (x.r.farg ? " " + x.r.farg : "")).join(", ") + " saknar storlekar – fyll i på raden eller på stylen." }));
      const acts = h("div", { class: "ean-actions" });
      if (!ro && missing) acts.append(h("button", { class: "btn small primary", type: "button", text: "Tilldela EAN till " + missing + (missing === 1 ? " SKU" : " SKU:er"), onclick: () => assignEans(cur, true) }));
      if (rows.length && downloads) acts.append(h("button", { class: "btn small", type: "button", text: "Exportera CSV", onclick: () => exportPoEan(cur) }));
      if (acts.childElementCount) eanSec.append(acts);
    }
    async function assignEans(cur, manual) {
      const plan = skuPlan(cur).filter((x) => x.miss.length);
      if (!plan.length) { if (manual) toast("Alla SKU:er har redan EAN."); return 0; }
      const total = plan.reduce((a, x) => a + x.miss.length, 0);
      let codes;
      try { codes = await allocateEan(total); }
      catch (e) { const c = e && e.code; toast(c === "busy" ? "Någon annan tilldelar EAN just nu. Försök igen om några sekunder." : c === "empty" ? "EAN-serien räcker inte till." : c === "nopool" ? "EAN-serien är inte inställd." : "Kunde inte reservera EAN."); return 0; }
      const t = new Date().toISOString();
      let i = 0, saved = 0;
      const byStyle = new Map();
      for (const x of plan) { const arr = byStyle.get(x.st._id) || []; for (const sz of x.miss) arr.push({ farg: x.r.farg, storlek: sz, ean: codes[i++], t, av: myId, po: cur.nr || cur._id }); byStyle.set(x.st._id, arr); }
      for (const [sid, added] of byStyle) {
        const st = byId(D.styles, sid); if (!st) continue;
        const farger = uniq((st.farger || []).concat(added.map((a) => a.farg)));
        const storlekar = sizesOf(st).length ? sizesOf(st) : uniq(added.map((a) => a.storlek));
        const range = added[0].ean + (added.length > 1 ? "–" + added[added.length - 1].ean : "");
        const ok = await write("styles", sid, { farger, storlekar, ean: (st.ean || []).concat(added), logg: (st.logg || []).concat(logEntry(added.length + " EAN tilldelade via PO " + (cur.nr || cur._id) + " (" + range + ")")), andrad: t });
        if (ok) saved += added.length;
        try { await db.collection("eanLogg").doc("L" + Date.now() + Math.random().toString(36).slice(2, 6)).set({ t, av: myId, styleId: sid, styleNamn: st.namn, antal: added.length, forsta: added[0].ean, sista: added[added.length - 1].ean, po: cur.nr || cur._id, sparad: ok }); } catch (e) {}
      }
      toast(saved + " EAN tilldelade" + (saved < total ? " (" + (total - saved) + " kunde inte sparas – se EAN-loggen)" : ""));
      return saved;
    }

    const logUl = h("ul", { class: "log" });
    async function save() {
      const o = { nr: fNr.value.trim(), leverantor: fLev.value.trim(), sasong: fSas.value.trim(), drop: fDrop.value.trim(), status: fStatus.value, prioritet: fPrio.value, produktionstid: num(fProd.value), fotosample: fFoto.value.trim(), fotosampleLeverans: fFotoD.value || null, tygstatus: fTygS.value, orderBekraftad: fBek.value === "1", planeradEx: fPlan.value || null, bekraftadEx: fBekEx.value || null, etaLager: fEta.value || null, valuta: fVal.value.trim() || "SEK", kommentar: fKom.value.trim(),
        orderDatum: fOrdD.value || null, leveransOnskad: fLevO.value || null, labelInstructions: fLabel.value.trim(),
        forskottBelopp: num(fFskB.value), forskottDatum: fFskD.value || null, forskottBetald: fFskP.value === "1", slutBelopp: num(fSlutB.value), slutDatum: fSlutD.value || null, slutBetald: fSlutP.value === "1" };
      if (!o.leverantor) { toast("Ange leverantör."); fLev.focus(); return; }
      if (!o.sasong) { toast("Ange säsong."); fSas.focus(); return; }
      if (!o.nr) o.nr = nextPoNr(o.leverantor, o.sasong);
      const btn = $("btnSave"); if (btn) btn.disabled = true;
      try {
        const now = new Date().toISOString();
        // resolve styles for lines (create new ones when needed)
        const rader = [];
        for (const r of lines) {
          if (!r.produkt && !r.styleId) continue;
          let sid = r.styleId;
          if (!sid && r.produkt) { const hit = styleByName(r.produkt); sid = hit ? hit._id : await createStyleQuick(r.produkt, o.leverantor); if (sid && !hit) { const ns = byId(D.styles, sid); if (ns) { ns.sasong = o.sasong; ns.drop = o.drop; ns.typ = r.typ || "Nyhet"; await write("styles", sid, { sasong: o.sasong, drop: o.drop, typ: r.typ || "Nyhet" }); } } }
          rader.push({ styleId: sid || null, produkt: r.produkt || (sid ? (byId(D.styles, sid) || {}).namn : ""), farg: r.farg || "", typ: r.typ || "Nyhet", tyg: r.tyg || "", storlekar: r.storlekar || [], perStorlek: r.perStorlek || null, antal: num(r.antal), tygkostnad: num(r.tygkostnad), styckpris: num(r.styckpris), kostnad: lineCost(r), fotosample: r.fotosample || "", beskrivning: r.beskrivning || "" });
        }
        o.rader = rader;
        let pid = po._id;
        if (isNew) {
          pid = slug(o.nr) || await freshId("po", D.po, "PO-", 3);
          if (byId(D.po, pid)) { toast("PO-numret finns redan."); return; }
          const body = Object.assign({ id: pid, logg: [logEntry("PO skapad")], andrad: now }, o);
          if (!(await create("po", pid, body))) return;
          if (!byId(D.po, pid)) D.po.push(Object.assign({}, body, { _id: pid }));
          toast(o.nr + " sparad");
        } else {
          const cur = current();
          const changes = describeChanges(cur, o, PO_LABELS);
          if (JSON.stringify(cur.rader || []) !== JSON.stringify(rader)) changes.push("Rader ändrade (" + rader.length + ")");
          if (!(await write("po", cur._id, Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) })))) return;
          Object.assign(cur, o);
          toast("Sparat");
        }
        // reflect on styles: PO number, colours, sizes, status
        const active = !PO_DRAFT.includes(o.status);
        for (const r of rader) {
          const st = r.styleId ? byId(D.styles, r.styleId) : null; if (!st) continue;
          const patch = {};
          const pos = uniq((st.po || []).concat([o.nr])); if (pos.length !== (st.po || []).length) patch.po = pos;
          if (r.farg) { const f = uniq((st.farger || []).concat([r.farg])); if (f.length !== (st.farger || []).length) patch.farger = f; }
          if ((!st.storlekar || !st.storlekar.length) && r.storlekar.length) patch.storlekar = r.storlekar;
          if (!st.sasong && o.sasong) patch.sasong = o.sasong;
          if (!st.drop && o.drop) patch.drop = o.drop;
          const ss = styleStatusNorm(st.status);
          if (active && (ss === "Sampling" || ss === "Godkänd")) patch.status = o.status === "Inlevererad" ? "Levererad" : ["I produktion", "Skickad"].includes(o.status) ? "I produktion" : "PO lagd";
          else if (active && ss === "PO lagd" && ["I produktion", "Skickad"].includes(o.status)) patch.status = "I produktion";
          else if (o.status === "Inlevererad" && ["PO lagd", "I produktion"].includes(ss)) patch.status = "Levererad";
          if (Object.keys(patch).length) { patch.andrad = now; patch.logg = (st.logg || []).concat(logEntry("Uppdaterad från PO " + o.nr + (patch.status ? ": status " + patch.status : ""))); await write("styles", st._id, patch); Object.assign(st, patch); }
        }
        if (active) { const cur = byId(D.po, pid) || Object.assign({ _id: pid }, o); await assignEans(cur, false); }
        if (isNew) openPo(pid); else closeSheet();
      } finally { if (btn) btn.disabled = false; }
    }
    const kvs = [];
    if (!isNew) { const tot = poTotal(po); kvs.push(h("div", { class: "kvs" }, h("div", { class: "kv" }, h("span", { class: "k", text: "Totalt" }), h("span", { class: "v big", text: fmtSEK(tot) })), h("div", { class: "kv" }, h("span", { class: "k", text: "Antal" }), h("span", { class: "v big", text: String(poUnits(po)) })), h("div", { class: "kv" }, h("span", { class: "k", text: "Dagar kvar" }), h("span", { class: "v big", text: poEta(po) ? fmtDays(diffDays(poEta(po))) : "–" })))); }
    const body = [...kvs, form, linesSec, attSec, eanSec];
    if (!isNew && downloads) body.push(h("section", null, h("h3", { class: "sec-title", text: "PO-fil" }), h("p", { class: "hint", text: "Excel enligt Rubatos PO-mall: ett blad \"PO\" med orderuppgifter, en kolumn per storlek och TOTAL-rad. Fyll i antal per storlek på raderna för en komplett PO." }), h("div", { class: "quick" }, h("button", { class: "btn small primary", type: "button", text: "Skapa PO-fil (Excel)", onclick: () => exportPoXlsx(current()) }))));
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl));
    openSheet({
      tag: isNew ? "Ny" : poStatusNorm(po.status),
      title: isNew ? "Ny PO" : (po.nr || po._id),
      sub: isNew ? "" : [po.leverantor, po.sasong, po.drop].filter(Boolean).join(" · "),
      body,
      foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("po", po._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: true, onSave: save, saveLabel: isNew ? "Spara PO" : "Spara" }),
      ctx: { refresh: () => { if (!isNew && !byId(D.po, po._id)) { closeSheet(); return; } renderEan(); renderAtt(); if (!isNew) renderLogInto(logUl, current().logg); } },
      focus: isNew ? "f_plev" : null
    });
    renderEan(); renderAtt();
    if (!isNew) renderLogInto(logUl, po.logg);
  }
  function exportPoEan(po) {
    const rows = [];
    for (const r of po.rader || []) { const st = byId(D.styles, r.styleId); if (!st) continue; const sizes = (r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st)) || []; for (const sz of sizes) { const e = (st.ean || []).find((y) => vkey(y) === vkey({ farg: r.farg, storlek: sz })); rows.push([po.nr, st.namn, r.farg, sz, e ? e.ean : "", r.perStorlek ? (r.perStorlek[sz] ?? "") : ""]); } }
    saveFile("EAN_" + safeName(po.nr) + ".csv", csv(["PO", "Produkt", "Färg", "Storlek", "EAN", "Antal"], rows));
  }
  async function exportPoXlsx(po) {
    try { if (!window.ExcelJS) await loadScript(LIB_XLSX); } catch (e) { toast("Kunde inte ladda Excel-verktyget. Kontrollera nätet och försök igen."); return; }
    const wb = new window.ExcelJS.Workbook();
    const ws = wb.addWorksheet("PO");
    const F = { name: "Arial", size: 10 }, FB = { name: "Arial", size: 10, bold: true };
    const d = dropOf({ sasong: po.sasong, drop: po.drop });
    const reqDate = po.leveransOnskad || (d && d.klartSenast) || "";
    const head = [["Order Date", po.orderDatum || todayISO()], ["Customer Name", PO_DEFAULTS.customer], ["Contact Email", PO_DEFAULTS.email], ["Contact Tel", PO_DEFAULTS.tel], ["Delivery Address", PO_DEFAULTS.delivery], ["Invoice Address", PO_DEFAULTS.invoice], ["Label Instructions", po.labelInstructions == null ? PO_DEFAULTS.label : po.labelInstructions], ["Requested Delivery Date", reqDate], ["Payment Terms", ""]];
    head.forEach(([k, v], i) => { const r = ws.getRow(i + 1); r.getCell(1).value = k; r.getCell(1).font = FB; r.getCell(2).value = v; r.getCell(2).font = F; r.height = 15; });
    ws.getCell("E1").value = "PO: " + (po.nr || po._id) + (poStatusNorm(po.status) === "Placeholder" ? " (DRAFT)" : "");
    ws.getCell("E1").font = { name: "Arial", size: 11, bold: true };
    const sizes = [];
    const lines = po.rader || [];
    for (const r of lines) { const st = byId(D.styles, r.styleId); for (const sz of (r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st))) if (!sizes.includes(sz)) sizes.push(sz); }
    const totCol = 3 + sizes.length;
    const hr = ws.getRow(13); hr.height = 15;
    ["Printed Name", "Description & Colours"].concat(sizes, ["Tot"]).forEach((t, i) => { const c = hr.getCell(i + 1); c.value = t; c.font = FB; c.alignment = { horizontal: i >= 2 ? "center" : "left" }; });
    let row = 14;
    const first = 14;
    for (const r of lines) {
      const st = byId(D.styles, r.styleId);
      const rr = ws.getRow(row); rr.height = 15;
      rr.getCell(1).value = r.produkt || (st ? st.namn : ""); rr.getCell(1).font = F;
      rr.getCell(2).value = [r.beskrivning || "", r.tyg ? "Fabric: " + r.tyg : "", r.farg ? "Colour: " + r.farg : ""].filter(Boolean).join(" – "); rr.getCell(2).font = F;
      const per = r.perStorlek && typeof r.perStorlek === "object" ? r.perStorlek : null;
      sizes.forEach((sz, i) => { const c = rr.getCell(3 + i); c.font = F; c.alignment = { horizontal: "center" }; if (per && per[sz] != null) c.value = Number(per[sz]) || 0; });
      const tc = rr.getCell(totCol); tc.font = FB; tc.alignment = { horizontal: "center" };
      if (per && sizes.length) tc.value = { formula: "SUM(" + ws.getRow(row).getCell(3).address + ":" + ws.getRow(row).getCell(2 + sizes.length).address + ")" };
      else tc.value = num(r.antal) ?? null;
      row++;
    }
    const last = row - 1;
    const tr = ws.getRow(row); tr.height = 15;
    tr.getCell(1).value = "TOTAL"; tr.getCell(1).font = FB;
    sizes.forEach((sz, i) => { const col = 3 + i; const c = tr.getCell(col); c.font = FB; c.alignment = { horizontal: "center" }; if (last >= first) c.value = { formula: "SUM(" + ws.getRow(first).getCell(col).address + ":" + ws.getRow(last).getCell(col).address + ")" }; });
    const tt = tr.getCell(totCol); tt.font = { name: "Arial", size: 11, bold: true }; tt.alignment = { horizontal: "center" }; tt.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
    if (last >= first) tt.value = { formula: "SUM(" + ws.getRow(first).getCell(totCol).address + ":" + ws.getRow(last).getCell(totCol).address + ")" };
    const thin = { style: "thin" };
    for (let rI = 13; rI <= row; rI++) for (let cI = 1; cI <= totCol; cI++) {
      const c = ws.getRow(rI).getCell(cI); const b = {};
      if (rI === 13) { b.top = thin; b.bottom = thin; }
      if (rI === row) b.bottom = thin;
      if (cI === 1) b.left = thin;
      if (cI === totCol) b.right = thin;
      if (Object.keys(b).length) c.border = b;
    }
    ws.getColumn(1).width = 16; ws.getColumn(2).width = 78; sizes.forEach((sz, i) => (ws.getColumn(3 + i).width = 6)); ws.getColumn(totCol).width = 8;
    ws.getColumn(5).width = Math.max(ws.getColumn(5).width || 0, 6);
    const buf = await wb.xlsx.writeBuffer();
    const ok = await saveFile((po.nr || po._id).replace(/[^A-Za-z0-9-]+/g, "") + ".xlsx", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    if (ok) toast("PO-filen är klar");
  }
  function exportPo() {
    const rows = [];
    for (const p of D.po) for (const r of p.rader || []) { const st = byId(D.styles, r.styleId); rows.push([p.nr, p.leverantor, p.sasong, p.drop, poStatusNorm(p.status), p.prioritet, r.produkt, r.styleId, st ? styleKategori(st) : "", r.farg, r.typ, r.tyg, r.antal, r.tygkostnad, r.styckpris, lineCost(r), p.valuta, p.tygstatus, p.orderBekraftad ? "Ja" : "Nej", p.planeradEx, p.bekraftadEx, p.etaLager, p.fotosample, p.forskottBetalt, p.slutbetalning, p.kommentar]); }
    saveFile("Rubato_Produktion_" + todayISO() + ".csv", csv(["PO-nr", "Leverantör", "Säsong", "Drop", "Status", "Prioritet", "Produkt", "Style-ID", "Kategori", "Färg", "Nyhet/Restock", "Tyg", "Antal", "Tygkostnad/enhet", "Styckpris", "Kostnad", "Valuta", "Tygstatus", "Order bekräftad", "Planerad ex-factory", "Bekräftad ex-factory", "ETA lager", "Fotosample", "Förskott betalt", "Slutbetalning", "Kommentar"], rows));
  }

  // ---------- KOLLEKTION (Carl) ----------
  const KollView = {
    mount(root) {
      const st = UI.koll;
      const upd = () => { this.update(); persist(); };
      this.fSeason = filterSelect("f_k_season", "Alla säsonger", st, "season", upd);
      this.seg = makeSeg([["drop", "Per drop"], ["kategori", "Per kategori"], ["helhet", "Helhet"]], st, "mode", upd);
      this.fKat = filterSelect("f_k_kat", "Alla kategorier", st, "kat", upd);
      this.segTyp = makeSeg([["alla", "Allt"], ["Nyhet", "New"], ["Restock", "Re-stock"], ["NOOS", "NOOS"]], st, "typ", upd);
      this.count = h("span", { class: "count" });
      this.stats = h("div", { class: "koll-stats" });
      this.body = h("div", { style: "display:grid;gap:26px" });
      root.append(h("p", { class: "lede", text: "Kommande kollektion i bild: varje produkt med senaste sample och status. Växla mellan drop, kategori och helhet, och filtrera på New, Re-stock eller NOOS. Klicka på en produkt för detaljer och alla bilder." }),
        h("section", { class: "filters", "aria-label": "Filter" }, this.fSeason.el, this.seg.el, this.segTyp.el, this.fKat.el, this.count), this.stats, this.body);
    },
    seasonInView() {
      const st = UI.koll;
      if (st.season) return st.season;
      const seasons = uniq(D.styles.map((s) => s.sasong)).sort((a, b) => seasonRank(b) - seasonRank(a));
      const today = todayISO();
      const upcoming = seasons.filter((x) => { const ds = dropsOfSeason(x); return ds.some((d) => (isISO(d.klartSenast) && d.klartSenast >= today) || (isISO(d.lansering) && d.lansering >= today)) || !ds.length; });
      return upcoming[upcoming.length - 1] || seasons[0] || "";
    },
    update() {
      const st = UI.koll;
      const seasons = uniq(D.styles.map((s) => s.sasong)).sort((a, b) => seasonRank(b) - seasonRank(a) || b.localeCompare(a, "sv"));
      this.fSeason.fill(seasons);
      this.fKat.fill(KATEGORIER);
      this.seg.sync(); this.segTyp.sync();
      const season = this.seasonInView();
      let items = D.styles.filter((s) => norm(s.sasong) === norm(season) && styleStatusNorm(s.status) !== "Kastad");
      if (st.kat) items = items.filter((s) => styleKategori(s) === st.kat);
      if (st.typ && st.typ !== "alla") items = items.filter((s) => (s.typ || "Nyhet") === st.typ);
      const order = { Sampling: 0, "Godkänd": 1, "PO lagd": 2, "I produktion": 3, Levererad: 4, Pausad: 5 };
      items.sort((a, b) => (order[styleStatusNorm(a.status)] ?? 9) - (order[styleStatusNorm(b.status)] ?? 9) || (a.namn || "").localeCompare(b.namn || "", "sv"));
      const units = (s) => poLinesOf(s._id).reduce((a, x) => a + (num(x.r.antal) || 0), 0);
      const cost = (s) => poLinesOf(s._id).reduce((a, x) => a + (lineCost(x.r) || 0), 0);
      const kv = (k, v, sub) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v big", text: v }), sub ? h("span", { class: "sub", text: sub }) : null);
      const nNew = items.filter((s) => (s.typ || "Nyhet") === "Nyhet").length, nRe = items.filter((s) => s.typ === "Restock").length, nNoos = items.filter((s) => s.typ === "NOOS").length;
      const withImg = items.filter((s) => styleImage(s)).length;
      const inProd = items.filter((s) => inProduction(s)).length;
      this.stats.replaceChildren(kv("Produkter " + season, String(items.length), nNew + " new · " + nRe + " re-stock · " + nNoos + " NOOS"), kv("I produktion", String(inProd), items.filter((s) => styleStatusNorm(s.status) === "Sampling").length + " under sampling"), kv("Plagg beställda", String(items.reduce((a, s) => a + units(s), 0))), kv("Med bild", withImg + " av " + items.length));
      this.body.replaceChildren();
      const groups = [];
      if (st.mode === "drop") {
        const placed = new Set();
        for (const d of dropsOfSeason(season)) { const m = items.filter((s) => dropKey(s.sasong, s.drop) === dropKey(d.sasong, d.namn)); m.forEach((x) => placed.add(x._id)); groups.push({ title: d.namn + " – " + season, drop: d, sub: [isISO(d.lansering) ? "Lansering " + fmtDate(d.lansering) : "", isISO(d.klartSenast) ? "I lager senast " + fmtDate(d.klartSenast) : ""].filter(Boolean).join(" · "), items: m }); }
        const rest = items.filter((s) => !placed.has(s._id)); if (rest.length) groups.push({ title: "Utan drop – " + season, sub: "", items: rest });
      } else if (st.mode === "kategori") {
        for (const k of KATEGORIER.concat(["Okategoriserat"])) { const m = items.filter((s) => (styleKategori(s) || "Okategoriserat") === k); if (m.length) groups.push({ title: k, sub: "", items: m }); }
      } else groups.push({ title: season + " – hela kollektionen", sub: "", items });
      for (const g of groups) {
        const sec = h("section", { class: "koll-sec" });
        const gu = g.items.reduce((a, s) => a + units(s), 0);
        const head = h("div", { class: "koll-h" }, h("h3", { text: g.title }), h("span", { class: "sub", text: g.items.length + (g.items.length === 1 ? " produkt" : " produkter") + (gu ? " · " + gu + " plagg" : "") + (g.sub ? " · " + g.sub : "") }));
        if (g.drop && canWrite && db) head.append(h("button", { class: "linkish", type: "button", text: "Redigera drop", onclick: () => openDrop(g.drop._id) }));
        sec.append(head);
        if (!g.items.length) sec.append(h("p", { class: "hint", text: "Inga produkter här ännu." }));
        else sec.append(h("div", { class: "pgrid" }, g.items.map((s) => this.card(s))));
        this.body.append(sec);
      }
      this.count.textContent = items.length + " produkter i " + season;
    },
    card(s) {
      const img = styleImage(s);
      const xs = samplesOfStyle(s._id);
      const last = xs[xs.length - 1];
      const pl = poLinesOf(s._id);
      const units = pl.reduce((a, x) => a + (num(x.r.antal) || 0), 0);
      const fs = fotoState(s);
      const allImgs = uniq(xs.flatMap(sampleImages).concat(s.bildId ? [s.bildId] : []));
      const b = h("button", { class: "pcard", type: "button", onclick: () => openStyle(s._id) },
        h("div", { class: "pimg" }, img ? h("img", { src: imgUrl(img), alt: s.namn, loading: "lazy" }) : h("span", { class: "noimg", text: xs.length ? "Ingen bild än" : "Ingen sample än" }), styleStatusPill(s), h("span", { class: "typtag t-" + slug(s.typ || "Nyhet"), text: typLabel(s) }), allImgs.length > 1 ? h("span", { class: "n", text: allImgs.length + " bilder" }) : null),
        h("div", { class: "pbody" }, h("span", { class: "pname", text: s.namn }), h("span", { class: "psub", text: [s.leverantor, styleKategori(s)].filter(Boolean).join(" · ") }),
          (s.farger || []).length ? h("span", { class: "psub", text: s.farger.join(", ") }) : null,
          h("span", { class: "psub", text: units ? units + " plagg" : last ? (last.version || "") + " · " + (last.status || "") : "" }),
          h("div", { class: "pflags" }, last && beslutNorm(last.beslut) ? chip(beslutNorm(last.beslut), "b-" + slug(beslutNorm(last.beslut))) : null, last && last.platsTyp === "Hängare" ? h("span", { class: "hanger", text: "H" + (last.hangare || "?") }) : null, fs.key === "finns" ? chip("Fotosample", "fs-finns") : null)));
      return b;
    }
  };

  // ---------- FOTO (Oliver) ----------
  const FotoView = {
    mount(root) {
      const st = UI.foto;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "saknas", label: "Ingen fotosample", cls: "t-late" },
        { key: "vantas", label: "Fotosample på väg" },
        { key: "finns", label: "Fotosample inne" },
        { key: "ecom", label: "E-com-bilder saknas", cls: "t-warn" },
        { key: "klara", label: "Publicerade" }
      ], st, () => upd());
      const q = searchBox("q_foto", "Sök produkt …", st, () => this.update());
      this.fSeason = filterSelect("f_f_season", "Alla säsonger", st, "season", upd);
      this.count = h("span", { class: "count" });
      this.cards = h("div", { class: "cards" });
      root.append(h("p", { class: "lede", text: "Nya produkter med bekräftad PO: finns fotosample, när är kampanjfotot, när plåtas e-com och är bilderna klara? Status och datum sätts direkt i listan. Längst ner hänger kollektionshängaren med de godkända samplesen." }),
        this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fSeason.el, this.count), this.cards);
    },
    update() {
      const st = UI.foto, q = norm(st.q);
      const seasons = uniq(D.styles.map((s) => s.sasong)).sort((a, b) => seasonRank(b) - seasonRank(a) || b.localeCompare(a, "sv"));
      this.fSeason.fill(seasons);
      const season = st.season || KollView.seasonInView();
      const all = D.styles.filter((s) => norm(s.sasong) === norm(season) && !["Kastad", "Pausad"].includes(styleStatusNorm(s.status)) && (s.typ || "Nyhet") === "Nyhet" && hasCommittedPo(s));
      const F = new Map(all.map((s) => [s._id, fotoState(s)]));
      const ecom = (s) => s.ecomBilder || "";
      const shot = (x) => ["Fotade", "Retuscherade", "Publicerade"].includes(x);
      this.strip.set({ saknas: all.filter((s) => F.get(s._id).key === "saknas").length, vantas: all.filter((s) => F.get(s._id).key === "vantas").length, finns: all.filter((s) => F.get(s._id).key === "finns").length, ecom: all.filter((s) => !shot(ecom(s))).length, klara: all.filter((s) => ecom(s) === "Publicerade").length });
      let list = all.filter((s) => {
        const f = F.get(s._id).key;
        switch (st.view) {
          case "saknas": case "vantas": case "finns": if (f !== st.view) return false; break;
          case "ecom": if (shot(ecom(s))) return false; break;
          case "klara": if (ecom(s) !== "Publicerade") return false; break;
        }
        return !q || [s.namn, s.leverantor, s.drop, styleKategori(s), (s.farger || []).join(" ")].join(" ").toLowerCase().includes(q);
      });
      const eo = { "": 0, Planerade: 1, Fotade: 2, Publicerade: 3 }, fo = { saknas: 0, godkand: 1, vantas: 2, finns: 3 };
      list.sort((a, b) => (eo[ecom(a)] ?? 0) - (eo[ecom(b)] ?? 0) || fo[F.get(a._id).key] - fo[F.get(b._id).key] || (a.drop || "").localeCompare(b.drop || "") || (a.namn || "").localeCompare(b.namn || "", "sv"));
      const byDrop = new Map();
      const dOrder = dropsOfSeason(season).map((d) => d.namn);
      for (const s of list) { const k = s.drop || "Utan drop"; if (!byDrop.has(k)) byDrop.set(k, []); byDrop.get(k).push(s); }
      const keys = [...byDrop.keys()].sort((a, b) => { const ia = dOrder.indexOf(a), ib = dOrder.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "sv"); });
      const cards = [];
      for (const k of keys) { const items = byDrop.get(k);
        const card = h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: season + " · " + k }), h("span", { class: "sub", text: items.length + " produkter · " + items.filter((s) => F.get(s._id).key === "finns").length + " med fotosample · " + items.filter((s) => ecom(s) === "Publicerade").length + " publicerade" })));
        const { t, tb } = table([["Produkt"], ["Leverans"], ["Fotosample"], ["Kampanjfoto"], ["E-com-plåtning"], ["E-com-bilder"], ["Notering"]]);
        for (const s of items) {
          const f = F.get(s._id);
          const img = styleImage(s);
          const ro = !canWrite || !db;
          const mk = (el) => { if (ro) el.disabled = true; return el; };
          const save = (patch, logText) => write("styles", s._id, Object.assign({ andrad: new Date().toISOString() }, patch, logText ? { logg: (s.logg || []).concat(logEntry(logText)) } : {}));
          const sel = mk(selectEl("ecom_" + s._id, ECOM_STATUS.map((x) => [x, x || "– inte planerade"]), ecom(s)));
          const dt = mk(inp("ecomd_" + s._id, s.ecomPlatDatum, { type: "date", "aria-label": "Datum för e-com-plåtning" }));
          const ksel = mk(selectEl("kamp_" + s._id, KAMP_STATUS.map((x) => [x, x || "– ingen kampanj"]), s.kampanjStatus || ""));
          const kdt = mk(inp("kampd_" + s._id, s.kampanjDatum, { type: "date", "aria-label": "Datum för kampanjfoto" }));
          const note = mk(inp("ecomn_" + s._id, s.fotoNotering, { placeholder: "t.ex. fotas 3 nov med Lot 1", "aria-label": "Fotonotering" }));
          sel.addEventListener("change", () => save({ ecomBilder: sel.value }, "E-com-bilder: " + (sel.value || "inte planerade")));
          dt.addEventListener("change", () => save({ ecomPlatDatum: dt.value || null }));
          ksel.addEventListener("change", () => save({ kampanjStatus: ksel.value }, "Kampanjfoto: " + (ksel.value || "ingen")));
          kdt.addEventListener("change", () => save({ kampanjDatum: kdt.value || null }));
          note.addEventListener("change", () => save({ fotoNotering: note.value.trim() }));
          const es = poLinesOf(s._id).map((x) => poEta(x.po)).filter(Boolean).sort();
          tb.append(h("tr", { tabIndex: 0, dataset: { style: s._id } },
            td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, img ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(img), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox([img], img); } }) : null, h("div", null, h("div", { class: "prod", text: s.namn }), h("div", { class: "sub", text: [s.leverantor, styleKategori(s), (s.farger || []).join(", ")].filter(Boolean).join(" · ") }), h("div", null, styleStatusPill(s))))),
            td("Leverans", null, es[0] ? h("div", null, h("div", { class: "mono", text: fmtDate(es[0]) }), h("div", { class: "days " + (diffDays(es[0]) < 0 ? "late" : diffDays(es[0]) <= 14 ? "soon" : ""), text: fmtDays(diffDays(es[0])) })) : h("span", { class: "muted", text: "ETA saknas" })),
            td("Fotosample", null, h("span", { class: "pill fs-" + f.key, text: f.label }), f.sample ? h("div", { class: "sub" }, h("button", { class: "linkish", type: "button", text: f.sample._id + (f.sample.platsTyp === "Hängare" ? " · H" + (f.sample.hangare || "?") : f.sample.platsTyp ? " · " + f.sample.platsTyp : ""), onclick: (e) => { e.stopPropagation(); openSample(f.sample._id); } })) : null),
            td("Kampanjfoto", "foto-inline", h("div", { style: "display:grid;gap:4px" }, ksel, kdt)),
            td("E-com-plåtning", "foto-inline", dt),
            td("E-com-bilder", "foto-inline", sel),
            td("Notering", "foto-inline", note)));
        }
        tb.addEventListener("click", (e) => { if (e.target.closest("input, select, button")) return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
        card.append(h("div", { class: "ledger-wrap" }, t));
        cards.push(card);
      }
      cards.push(hangerCard(season));
      this.cards.replaceChildren(...cards);
      if (!list.length) this.cards.prepend(h("div", { class: "empty" }, h("strong", { text: "Inga nya produkter med bekräftad PO i " + season }), h("span", { text: "Produkter dyker upp här när PO:n är bekräftad. NOOS och re-stock har redan bilder." })));
      this.count.textContent = list.length + " nya produkter med PO i " + season;
    }
  };

  // ---------- REF-PLAGG (Alex) ----------
  const REF_STATUS = ["Skickat", "Hos leverantören", "På väg tillbaka", "Tillbaka hos Rubato", "Förlorat"];
  const RefView = {
    mount(root) {
      const st = UI.ref;
      const upd = () => { this.update(); persist(); };
      this.seg = makeSeg([["ute", "Ute"], ["Tillbaka hos Rubato", "Tillbaka"], ["alla", "Alla"]], st, "status", upd);
      const q = searchBox("q_ref", "Sök plagg, leverantör, tracking …", st, () => this.update());
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["Plagg"], ["Skickat till"], ["Skickat"], ["Fraktbolag / tracking"], ["Status"], ["Tillbaka senast"], ["Kommentar"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { if (e.target.closest("a, button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openRef(tr.dataset.id); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const tr = e.target.closest("tr[data-id]"); if (tr) openRef(tr.dataset.id); });
      this.empty = h("div", { class: "empty", hidden: true });
      root.append(h("p", { class: "lede", text: "Referensplagg som skickats till leverantörer (egna plagg, vintage, konkurrentplagg). Här finns tracking så att inget försvinner, och en påminnelse när plagget borde vara tillbaka." }),
        h("section", { class: "filters", "aria-label": "Filter" }, q, this.seg.el, this.count), h("section", { class: "ledger-wrap" }, t, this.empty));
    },
    update() {
      const st = UI.ref, q = norm(st.q);
      this.seg.sync();
      const list = D.ref.filter((r) => {
        const out = r.status !== "Tillbaka hos Rubato";
        if (st.status === "ute" && !out) return false;
        if (st.status === "Tillbaka hos Rubato" && out) return false;
        return !q || [r._id, r.plagg, r.skickadTill, r.fraktbolag, r.tracking, r.kommentar, r.styleNamn].join(" ").toLowerCase().includes(q);
      }).sort((a, b) => (a.status === "Tillbaka hos Rubato") - (b.status === "Tillbaka hos Rubato") || (a.aterSenast || "9999").localeCompare(b.aterSenast || "9999") || (b.skickad || "").localeCompare(a.skickad || ""));
      this.tb.replaceChildren(...list.map((r) => {
        const d = isISO(r.aterSenast) && r.status !== "Tillbaka hos Rubato" ? diffDays(r.aterSenast) : null;
        return h("tr", { tabIndex: 0, dataset: { id: r._id } },
          td("", "c-main", h("div", { class: "prod", text: r.plagg || "–" }), h("div", { class: "sub", text: [r._id, r.styleNamn ? "för " + r.styleNamn : "", r.agare ? "ägare: " + r.agare : ""].filter(Boolean).join(" · ") })),
          td("Skickat till", null, r.skickadTill || ""),
          td("Skickat", "mono", fmtDate(r.skickad)),
          td("Tracking", null, r.fraktbolag ? h("div", { text: r.fraktbolag }) : null, r.tracking ? h("div", { class: "mono" }, r.trackingUrl ? h("a", { href: r.trackingUrl, target: "_blank", rel: "noopener", text: r.tracking }) : r.tracking) : h("span", { class: "flag", text: "Saknar tracking" })),
          td("Status", null, h("span", { class: "pill rs-" + slug(r.status || ""), text: r.status || "–" })),
          td("Tillbaka senast", null, isISO(r.aterSenast) ? h("div", null, h("div", { class: "mono", text: fmtDate(r.aterSenast) }), d != null ? h("div", { class: "days " + (d < 0 ? "late" : d <= 7 ? "soon" : ""), text: fmtDays(d) }) : null) : r.status === "Tillbaka hos Rubato" ? h("span", { class: "muted", text: "tillbaka " + fmtDate(r.tillbaka) }) : h("span", { class: "muted", text: "–" })),
          td("Kommentar", "note", r.kommentar || ""));
      }));
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(h("strong", { text: loaded.has("ref") ? (D.ref.length ? "Inget matchar" : "Inga referensplagg registrerade") : "Laddar …" }), h("span", { text: "Lägg till när något skickas iväg, med tracking." }));
      this.count.textContent = list.length + " av " + D.ref.length + " plagg";
    }
  };
  const REF_LABELS = { plagg: "Plagg", styleNamn: "För style", agare: "Ägare", skickadTill: "Skickat till", skickad: "Skickat", fraktbolag: "Fraktbolag", tracking: "Tracking", trackingUrl: "Spårningslänk", status: "Status", aterSenast: "Tillbaka senast", tillbaka: "Tillbaka", varde: "Värde", kommentar: "Kommentar" };
  function openRef(id, preset) {
    const isNew = !id;
    const r = isNew ? Object.assign({ _id: null, status: "Skickat", skickad: todayISO(), logg: [] }, preset || {}) : byId(D.ref, id);
    if (!r) { toast("Hittar inte plagget."); return; }
    const ro = !canWrite || !db;
    const fPlagg = inp("f_rplagg", r.plagg, { placeholder: "t.ex. Vintage Levi's 501, strl 32" });
    const fStyle = inp("f_rstyle", r.styleNamn, { list: "dlStyle", autocomplete: "off", placeholder: "Vilken style är det referens för?" });
    const fAgare = inp("f_ragare", r.agare, { placeholder: "t.ex. Carl, Rubato, lånat av …" });
    const fTill = inp("f_rtill", r.skickadTill, { list: "dlLev", autocomplete: "off" });
    const fSkickad = inp("f_rskickad", r.skickad, { type: "date" });
    const fBolag = inp("f_rbolag", r.fraktbolag, { placeholder: "DHL, UPS, PostNord …" });
    const fTrack = inp("f_rtrack", r.tracking, { placeholder: "Spårningsnummer" });
    const fUrl = inp("f_rurl", r.trackingUrl, { placeholder: "https://…" });
    const fStatus = selectEl("f_rstatus", REF_STATUS, r.status || "Skickat");
    const fAter = inp("f_rater", r.aterSenast, { type: "date" });
    const fTillb = inp("f_rtillb", r.tillbaka, { type: "date" });
    const fVarde = inp("f_rvarde", r.varde, { type: "number", min: "0", step: "1", placeholder: "kr" });
    const fKom = area("f_rkom", r.kommentar);
    fStatus.addEventListener("change", () => { if (fStatus.value === "Tillbaka hos Rubato" && !fTillb.value) fTillb.value = todayISO(); });
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      field("Plagg", fPlagg, { full: true }), field("Referens för style", fStyle), field("Ägare", fAgare),
      field("Skickat till", fTill), field("Skickat", fSkickad),
      field("Fraktbolag", fBolag), field("Tracking", fTrack), field("Spårningslänk", fUrl, { full: true }),
      field("Status", fStatus), field("Ska vara tillbaka senast", fAter, { hint: "Ger en påminnelse i listan" }),
      field("Tillbaka hos Rubato", fTillb), field("Värde (kr)", fVarde, { hint: "Om det försvinner" }),
      field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);
    const logUl = h("ul", { class: "log" });
    async function save() {
      const o = { plagg: fPlagg.value.trim(), styleNamn: fStyle.value.trim(), agare: fAgare.value.trim(), skickadTill: fTill.value.trim(), skickad: fSkickad.value || null, fraktbolag: fBolag.value.trim(), tracking: fTrack.value.trim(), trackingUrl: fUrl.value.trim(), status: fStatus.value, aterSenast: fAter.value || null, tillbaka: fTillb.value || null, varde: num(fVarde.value), kommentar: fKom.value.trim() };
      if (!o.plagg) { toast("Beskriv plagget."); fPlagg.focus(); return; }
      if (!o.skickadTill) { toast("Vart skickades det?"); fTill.focus(); return; }
      const now = new Date().toISOString();
      if (isNew) {
        const nid = await freshId("refplagg", D.ref, "R", 3);
        const body = Object.assign({ id: nid, logg: [logEntry("Registrerat")], andrad: now }, o);
        if (await create("refplagg", nid, body)) { if (!byId(D.ref, nid)) D.ref.push(Object.assign({}, body, { _id: nid })); toast(nid + " sparad" + (!o.tracking ? " – lägg in tracking så fort du har det" : "")); closeSheet(); }
      } else {
        const changes = describeChanges(r, o, REF_LABELS);
        if (!changes.length) { closeSheet(); return; }
        if (await write("refplagg", r._id, Object.assign({}, o, { andrad: now, logg: (r.logg || []).concat(changes.map(logEntry)) }))) { toast("Sparat"); closeSheet(); }
      }
    }
    const body = [form];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl));
    openSheet({ tag: isNew ? "Ny" : r._id, title: isNew ? "Nytt referensplagg" : r.plagg, sub: isNew ? "" : [r.skickadTill, r.status].filter(Boolean).join(" · "), body, foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("refplagg", r._id)) { toast("Borttaget"); closeSheet(); } }, canDelete: true, onSave: save }), ctx: { refresh: () => { if (!isNew && !byId(D.ref, r._id)) { closeSheet(); return; } if (!isNew) renderLogInto(logUl, (byId(D.ref, r._id) || r).logg); } }, focus: isNew ? "f_rplagg" : null });
    if (!isNew) renderLogInto(logUl, r.logg);
  }

  // ---------- Kollektionshängare ----------
  const HANGER_STYLE = ["Godkänd", "PO lagd", "I produktion", "Levererad"];
  function hangerItems(season) {
    return D.samples.filter((s) => { const st = styleOf(s); if (!st) return false; if (season && norm(st.sasong) !== norm(season)) return false; return beslutNorm(s.beslut) === "Godkänd" && HANGER_STYLE.includes(styleStatusNorm(st.status)) && s.status !== "Returnerad"; })
      .sort((a, b) => (num(a.hangare) ?? 999) - (num(b.hangare) ?? 999) || styleName(a).localeCompare(styleName(b), "sv"));
  }
  function hangerCard(season, opts) {
    const items = hangerItems(season);
    const card = h("section", { class: "card hanger-card" });
    card.append(h("div", { class: "card-head" }, h("h3", { text: "Kollektionshängare" + (season ? " – " + season : "") }), h("span", { class: "sub", text: items.length ? items.length + " godkända samples som har eller ska få PO · " + items.filter((s) => s.platsTyp === "Hängare").length + " på hängare" : "Inga godkända samples ännu" })));
    if (!items.length) return card;
    const { t, tb } = table([["Hängare"], ["Produkt"], ["Färg"], ["Sample"], ["Style-status"], ["Bild"]]);
    for (const s of items) {
      const st = styleOf(s);
      const imgs = sampleImages(s);
      tb.append(h("tr", { tabIndex: 0, dataset: { id: s._id } },
        td("Hängare", null, s.platsTyp === "Hängare" ? h("span", { class: "hanger", text: "Hängare " + (s.hangare || "?") }) : s.platsTyp ? h("span", { class: "place", text: s.platsTyp }) : h("span", { class: "flag", text: "Saknar plats" })),
        td("", "c-main", h("div", { class: "prod", text: styleName(s) }), h("div", { class: "sub", text: [st.sasong, st.drop, typLabel(st), styleKategori(st)].filter(Boolean).join(" · ") })),
        td("Färg", null, fargText(s.farg) || "–"),
        td("Sample", null, tag(s._id), h("span", { class: "sub", text: " " + (s.version || "") })),
        td("Style-status", null, styleStatusPill(st)),
        td("Bild", null, imgs.length ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(imgs[0]), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(imgs, imgs[0]); } }) : h("span", { class: "muted", text: "–" }))));
    }
    tb.addEventListener("click", (e) => { if (e.target.closest("button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openSample(tr.dataset.id); });
    card.append(h("div", { class: "ledger-wrap" }, t));
    return card;
  }

  // ---------- E-COM (Jakob) ----------
  const ECOM_CHECKS = [["ecomShopify", "I Shopify"], ["ecomBeskrivning", "Beskrivning"], ["ecomPrisSatt", "Pris satt"], ["ecomStorleksguide", "Storleksguide"], ["ecomNewsletter", "Newsletter"], ["ecomSeo", "Taggar/Collections"]];
  const EcomView = {
    mount(root) {
      const st = UI.ecom;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "lev30", label: "Levereras inom 30 d (PO)" },
        { key: "shopify", label: "Ej i Shopify", cls: "t-warn" },
        { key: "pris", label: "Saknar pris", cls: "t-warn" },
        { key: "bild", label: "Saknar e-com-bilder", cls: "t-late" },
        { key: "klara", label: "Klara för lansering" }
      ], st, () => upd());
      const q = searchBox("q_ecom", "Sök produkt …", st, () => this.update());
      this.fSeason = filterSelect("f_e_season", "Alla säsonger", st, "season", upd);
      this.count = h("span", { class: "count" });
      this.cards = h("div", { class: "cards" });
      root.append(h("p", { class: "lede", text: "Allt som ska vara klart i Shopify inför lansering: när plaggen kommer, när kampanj och e-com fotas (från Foto-fliken), och checklistan per produkt – Shopify-produkt, beskrivning, pris (med GM1 mot PO-kostnaden: grönt ≥ 75 %, gult 70–75 %, rött under 70 %), storleksguide, newsletter och taggar/collections. EAN hämtas från appen." }),
        this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fSeason.el, this.count), this.cards);
    },
    update() {
      const st = UI.ecom, q = norm(st.q);
      const seasons = uniq(D.styles.map((s) => s.sasong)).sort((a, b) => seasonRank(b) - seasonRank(a) || b.localeCompare(a, "sv"));
      this.fSeason.fill(seasons);
      const season = st.season || KollView.seasonInView();
      const all = D.styles.filter((s) => norm(s.sasong) === norm(season) && !["Kastad", "Pausad"].includes(styleStatusNorm(s.status)));
      const eta = (s) => { const pos = poLinesOf(s._id).map((x) => x.po).filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status))); const req = pos.map((p) => p.leveransOnskad).filter(isISO).sort(); if (req.length) return req[0]; const es = pos.map(poEta).filter(Boolean).sort(); return es[0] || null; };
      const etaSrc = (s) => { const pos = poLinesOf(s._id).map((x) => x.po).filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status))); return pos.some((p) => isISO(p.leveransOnskad)) ? "PO" : pos.some(poEta) ? "ETA" : ""; };
      const eanOk = (s) => { const vs = variants(s.farger || [], sizesOf(s)); return vs.length ? !eanMissing(s) : false; };
      const done = (s) => ECOM_CHECKS.every(([k]) => !!s[k]) && ["Fotade", "Retuscherade", "Publicerade"].includes(s.ecomBilder || "");
      const lim = addDays(todayISO(), 30);
      this.strip.set({ lev30: all.filter((s) => { const e = eta(s); return e && e <= lim && e >= todayISO(); }).length, shopify: all.filter((s) => !s.ecomShopify).length, pris: all.filter((s) => !s.ecomPrisSatt).length, bild: all.filter((s) => !["Fotade", "Retuscherade", "Publicerade"].includes(s.ecomBilder || "")).length, klara: all.filter(done).length });
      const list = all.filter((s) => {
        switch (st.view) {
          case "lev30": { const e = eta(s); if (!(e && e <= lim && e >= todayISO())) return false; break; }
          case "shopify": if (s.ecomShopify) return false; break;
          case "pris": if (s.ecomPrisSatt) return false; break;
          case "bild": if (["Fotade", "Retuscherade", "Publicerade"].includes(s.ecomBilder || "")) return false; break;
          case "klara": if (!done(s)) return false; break;
        }
        return !q || [s.namn, s.leverantor, s.drop, styleKategori(s)].join(" ").toLowerCase().includes(q);
      });
      const dOrder = dropsOfSeason(season).map((d) => d.namn);
      list.sort((a, b) => { const ia = dOrder.indexOf(a.drop || ""), ib = dOrder.indexOf(b.drop || ""); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (eta(a) || "9999").localeCompare(eta(b) || "9999") || (a.namn || "").localeCompare(b.namn || "", "sv"); });
      const byDrop = new Map();
      for (const s of list) { const k = s.drop || "Utan drop"; if (!byDrop.has(k)) byDrop.set(k, []); byDrop.get(k).push(s); }
      const cards = [];
      const ro = !canWrite || !db;
      for (const [k, items] of byDrop) {
        const d = dropsOfSeason(season).find((x) => x.namn === k);
        const card = h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: k + " – " + season }), h("span", { class: "sub", text: items.length + " produkter · " + items.filter(done).length + " klara" + (d && isISO(d.lansering) ? " · lansering " + fmtDate(d.lansering) : "") })));
        const { t, tb } = table([["Produkt"], ["Leverans"], ["Kampanjfoto"], ["E-com-foto"], ["Checklista"], ["Pris"], ["Lansering"], ["Notering"]]);
        for (const s of items) {
          const img = styleImage(s);
          const save = (patch, logText) => write("styles", s._id, Object.assign({ andrad: new Date().toISOString() }, patch, logText ? { logg: (s.logg || []).concat(logEntry(logText)) } : {}));
          const checks = h("div", { class: "checks" }, ECOM_CHECKS.map(([key, label]) => { const cb = h("input", { type: "checkbox", checked: !!s[key], disabled: ro, onchange: () => save({ [key]: cb.checked }, label + (cb.checked ? " klar" : " ej klar")) }); return h("label", { class: "checkline" }, cb, label); }),
            h("span", { class: "pill " + (eanOk(s) ? "ts-ok" : "ts-slut"), text: eanOk(s) ? "EAN klara" : "EAN saknas" }));
          const pris = inp("pris_" + s._id, s.ecomPris, { type: "number", min: "0", step: "1", placeholder: "SEK inkl. moms", "aria-label": "Pris" }); pris.disabled = ro;
          const gmEl = h("div");
          const unitCost = (() => { const ls = poLinesOf(s._id).filter((x) => !PO_DRAFT.includes(poStatusNorm(x.po.status)) && num(x.r.antal) && num(x.r.styckpris) != null); const u = ls.reduce((a, x) => a + num(x.r.antal), 0); return u ? ls.reduce((a, x) => a + num(x.r.antal) * (num(x.r.styckpris) + (num(x.r.tygkostnad) || 0)), 0) / u : null; })();
          const renderGm = () => { const pr = num(pris.value); gmEl.replaceChildren(); if (pr == null || !pr) return; if (unitCost == null) { gmEl.append(h("span", { class: "sub", text: "GM1: kostnad saknas på PO" })); return; } const netto = pr / 1.25; const gm = (netto - unitCost) / netto * 100; gmEl.append(h("span", { class: "pill " + (gm >= 75 ? "ts-ok" : gm >= 70 ? "ts-delvis-slut" : "ts-slut"), text: "GM1 " + Math.round(gm) + " %" }), h("div", { class: "sub", text: "kostnad " + fmtSEK(unitCost) + " · netto " + fmtSEK(netto) })); };
          pris.addEventListener("input", renderGm); renderGm();
          pris.addEventListener("change", () => save({ ecomPris: num(pris.value), ecomPrisSatt: num(pris.value) != null }, "Pris " + (pris.value || "borttaget")));
          const lans = inp("lans_" + s._id, s.ecomLansering, { type: "date", "aria-label": "Lanseringsdatum" }); lans.disabled = ro;
          lans.addEventListener("change", () => save({ ecomLansering: lans.value || null }));
          const note = inp("enote_" + s._id, s.ecomNotering, { placeholder: "Notering", "aria-label": "Notering" }); note.disabled = ro;
          note.addEventListener("change", () => save({ ecomNotering: note.value.trim() }));
          const e = eta(s);
          const kamp = s.kampanjDatum || s.kampanjStatus ? [isISO(s.kampanjDatum) ? fmtDate(s.kampanjDatum) : "", s.kampanjStatus || ""].filter(Boolean).join(" · ") : "–";
          tb.append(h("tr", { tabIndex: 0, dataset: { style: s._id } },
            td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, img ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(img), alt: "", loading: "lazy" }) : null, h("div", null, h("div", { class: "prod", text: s.namn }), h("div", { class: "sub", text: [typLabel(s), styleKategori(s), (s.farger || []).join(", ")].filter(Boolean).join(" · ") }), h("div", null, styleStatusPill(s))))),
            td("Leverans", null, e ? h("div", null, h("div", { class: "mono", text: fmtDate(e) }), h("div", { class: "days " + (diffDays(e) < 0 ? "late" : diffDays(e) <= 14 ? "soon" : ""), text: fmtDays(diffDays(e)) }), etaSrc(s) === "ETA" ? h("div", { class: "sub", text: "ETA lager (PO saknar leveransdatum)" }) : h("div", { class: "sub", text: "enligt PO" })) : h("span", { class: "muted", text: inProduction(s) ? "PO saknar leveransdatum" : "ingen PO" })),
            td("Kampanjfoto", null, kamp),
            td("E-com-foto", null, isISO(s.ecomPlatDatum) ? h("div", null, h("div", { class: "mono", text: fmtDate(s.ecomPlatDatum) }), h("div", { class: "days " + (diffDays(s.ecomPlatDatum) < 0 ? "" : diffDays(s.ecomPlatDatum) <= 14 ? "soon" : ""), text: fmtDays(diffDays(s.ecomPlatDatum)) }), h("span", { class: "pill es-" + (s.ecomBilder ? slug(s.ecomBilder) : "x"), text: s.ecomBilder || "planerad" })) : h("span", { class: "pill es-" + (s.ecomBilder ? slug(s.ecomBilder) : "x"), text: s.ecomBilder ? s.ecomBilder + " – datum saknas" : "inte planerad av Oliver än" })),
            td("Checklista", "foto-inline", checks),
            td("Pris", "foto-inline", h("div", { style: "display:grid;gap:4px" }, pris, gmEl)),
            td("Lansering", "foto-inline", lans),
            td("Notering", "foto-inline", note)));
        }
        tb.addEventListener("click", (e) => { if (e.target.closest("input, select, button, label")) return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
        card.append(h("div", { class: "ledger-wrap" }, t));
        cards.push(card);
      }
      this.cards.replaceChildren(...cards);
      if (!list.length) this.cards.append(h("div", { class: "empty" }, h("strong", { text: "Inget att visa" }), h("span", { text: "Byt säsong eller rensa filtret." })));
      this.count.textContent = list.length + " produkter i " + season;
    }
  };

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
      renderLogInto(this.logList, D.logg.slice().reverse().map((l) => ({ t: l.t, av: l.av, text: l.antal + " EAN till " + (l.styleNamn || l.styleId) + " (" + l.forsta + (l.antal > 1 ? "–" + l.sista : "") + ")" + (l.sparad === false ? ", ej sparade på stylen" : "") })));
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


  // ---------- SHOPIFY (färgvägar från produktionen som ska upp i butiken) ----------
  const shopSel = new Set();
  function shopRows() {
    // En rad per style och färg. Styles som finns i en PO (eller har status PO lagd/Levererad) räknas som produktion.
    const inPo = new Map();
    for (const p of D.po) for (const r of p.rader || []) if (r.styleId) (inPo.get(r.styleId) || inPo.set(r.styleId, []).get(r.styleId)).push(p);
    const out = [];
    const H = P.hosted();
    for (const st of D.styles) {
      const pos = inPo.get(st._id) || [];
      const sh = (H.shopify || {})[st._id] || {};
      const prod = pos.length > 0 || (st.po || []).length > 0 || ["PO lagd", "I produktion", "Levererad"].includes(st.status);
      if (!prod && !(UI.shopify.alla && EAN_OK_STATUS.includes(st.status))) continue;
      for (const farg of st.farger || []) {
        const fr = ((H.farger || {})[st._id] || []).find((x) => x.farg.toLowerCase() === farg.toLowerCase()) || {};
        const lev = levByName(st.leverantor);
        const sys = (D.settings.storlekskoder || {})[sh.storlekssystem];
        const vs = (st.ean || []).filter((e) => e.farg.toLowerCase() === farg.toLowerCase());
        const saknar = [];
        if (!(st.storlekar || []).length) saknar.push("storlekar");
        else if (vs.length < st.storlekar.length) saknar.push("EAN");
        if (!sh.produkttyp) saknar.push("produkttyp");
        if (!sh.storlekssystem) saknar.push("storlekssystem");
        else if (sys && (st.storlekar || []).some((s) => sys[s] == null)) saknar.push("storlekskod");
        if (!(sh.rrp_sek > 0)) saknar.push("pris");
        if (!sh.hs_kod) saknar.push("HS-kod");
        if (!lev || !lev.land) saknar.push("ursprungsland");
        if (!sh.description_en) saknar.push("beskrivning");
        if (!sh.sammansattning) saknar.push("material");
        if (!sh.tvattrad) saknar.push("skötselråd");
        const varnar = [];
        if (!sh.size_chart) varnar.push("storlekstabell");
        if (!fr.swatch) varnar.push("swatch");
        if (!fr.colour_family) varnar.push("färgfamilj");
        if (!sh.fit_note) varnar.push("fit note");
        out.push({ key: st._id + "|" + farg, st, farg, fr, pos, saknar, varnar, pushed: !!fr.shopify_product_id });
      }
    }
    return out;
  }
  const ShopifyView = {
    mount(root) {
      const st = UI.shopify;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "redo", label: "Redo att pusha" },
        { key: "saknar", label: "Saknar data", cls: "t-warn" },
        { key: "utkast", label: "Utkast i Shopify" },
        { key: "aktiva", label: "Aktiva i Shopify" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_shopify", "Sök style, färg, leverantör …", st, () => this.update());
      this.fLev = filterSelect("f_sh_lev", "Alla leverantörer", st, "lev", upd);
      this.fSeason = filterSelect("f_sh_season", "Alla säsonger", st, "season", upd);
      this.seg = makeSeg([["ej", "Ej i Shopify"], ["i", "I Shopify"], ["alla", "Alla"]], st, "status", upd);
      const allaBox = h("label", { class: "chk" }, h("input", { type: "checkbox", checked: !!st.alla, onchange: (e) => { st.alla = e.target.checked; upd(); } }), " Visa även godkända styles utan PO");
      this.count = h("span", { class: "count" });
      this.selCount = h("span");
      this.tray = h("div", { class: "tray", hidden: true }, this.selCount,
        h("button", { class: "btn small primary", type: "button", text: "Skapa utkast i Shopify", onclick: () => this.pushSelected() }),
        h("button", { class: "btn small", type: "button", text: "Rensa val", onclick: () => { shopSel.clear(); this.update(); } }));
      const { t, tb } = table([["", "c-check"], ["Style"], ["Färg"], ["Leverantör"], ["Säsong"], ["PO"], ["Data"], ["Shopify"]]);
      this.tb = tb;
      this.allBox = h("input", { type: "checkbox", "aria-label": "Välj alla redo", onchange: () => { (this.visible || []).filter((r) => !r.pushed && !r.saknar.length).forEach((r) => (this.allBox.checked ? shopSel.add(r.key) : shopSel.delete(r.key))); this.update(); } });
      t.querySelector("th.c-check").append(this.allBox);
      this.empty = h("div", { class: "empty", hidden: true });
      this.result = h("div", { class: "shopify-result" });
      tb.addEventListener("click", (e) => { if (e.target.closest("input, button, a")) return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
      root.append(this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fLev.el, this.fSeason.el, this.seg.el, allaBox, this.count), this.tray, this.result, h("section", { class: "ledger-wrap" }, t, this.empty));
    },
    update() {
      const st = UI.shopify;
      const all = shopRows();
      this.fLev.fill(uniq(all.map((r) => r.st.leverantor)));
      this.fSeason.fill(uniq(all.map((r) => r.st.sasong)));
      this.strip.set({ redo: all.filter((r) => !r.pushed && !r.saknar.length).length, saknar: all.filter((r) => !r.pushed && r.saknar.length).length, utkast: all.filter((r) => r.pushed && r.fr.shopify_status === "DRAFT").length, aktiva: all.filter((r) => r.pushed && r.fr.shopify_status === "ACTIVE").length });
      let list = all;
      if (st.view === "redo") list = list.filter((r) => !r.pushed && !r.saknar.length);
      else if (st.view === "saknar") list = list.filter((r) => !r.pushed && r.saknar.length);
      else if (st.view === "utkast") list = list.filter((r) => r.pushed && r.fr.shopify_status === "DRAFT");
      else if (st.view === "aktiva") list = list.filter((r) => r.pushed && r.fr.shopify_status === "ACTIVE");
      else if (st.status === "ej") list = list.filter((r) => !r.pushed);
      else if (st.status === "i") list = list.filter((r) => r.pushed);
      if (st.lev) list = list.filter((r) => r.st.leverantor === st.lev);
      if (st.season) list = list.filter((r) => r.st.sasong === st.season);
      const q = norm(st.q);
      if (q) list = list.filter((r) => [r.st.namn, r.st._id, r.farg, r.st.leverantor, r.st.sasong, ...r.pos.map((p) => p.nr || p._id)].join(" ").toLowerCase().includes(q));
      list.sort((a, b) => (a.pushed - b.pushed) || (a.saknar.length > 0) - (b.saknar.length > 0) || a.st.namn.localeCompare(b.st.namn, "sv") || a.farg.localeCompare(b.farg, "sv"));
      this.visible = list;
      for (const k of [...shopSel]) if (!all.some((r) => r.key === k && !r.pushed)) shopSel.delete(k);
      this.tb.replaceChildren(...list.map((r) => {
        const box = h("input", { type: "checkbox", "aria-label": "Välj " + r.st.namn + " " + r.farg, checked: shopSel.has(r.key), disabled: r.pushed || r.saknar.length > 0, onchange: () => { if (box.checked) shopSel.add(r.key); else shopSel.delete(r.key); ShopifyView.update(); } });
        const status = r.pushed
          ? h("a", { class: "chip " + (r.fr.shopify_status === "ACTIVE" ? "b-godkand" : "b-ny-runda"), href: "https://admin.shopify.com/store/atemporubato/products/" + r.fr.shopify_product_id, target: "_blank", rel: "noopener", text: (r.fr.shopify_status === "ACTIVE" ? "Aktiv" : "Utkast") + " · " + (r.fr.shopify_handle || "") })
          : chip("Ej i Shopify");
        return h("tr", { tabIndex: 0, dataset: { style: r.st._id } },
          h("td", { class: "c-check" }, box),
          td("Style", "c-main", h("div", { class: "prod", text: r.st.namn }), h("div", { class: "sub", text: r.st._id + " · " + (r.st.status || "") })),
          td("Färg", null, r.fr.swatch ? h("span", { class: "swatch", style: "background:" + r.fr.swatch }) : null, r.farg),
          td("Leverantör", null, r.st.leverantor || ""),
          td("Säsong", null, [r.st.sasong, r.st.drop].filter(Boolean).join(" · ")),
          td("PO", null, r.pos.length ? h("div", { class: "sub" }, uniq(r.pos.map((p) => p.nr || p._id)).map((id) => tag(id))) : h("span", { class: "sub", text: "Ingen PO" })),
          td("Data", null, r.saknar.length ? h("span", { class: "flag bad", text: "Saknar " + r.saknar.join(", ") }) : r.varnar.length ? h("span", { class: "flag", text: "Redo · utan " + r.varnar.join(", ") }) : h("span", { class: "flag eval", text: "Redo" })),
          td("Shopify", null, status));
      }));
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(h("strong", { text: all.length ? "Inget matchar" : "Inget att pusha ännu" }), h("span", { text: all.length ? "Ändra filter eller sökning." : "Färgvägar dyker upp här när en style ligger i en PO och har färger ifyllda." }));
      this.count.textContent = list.length + " av " + all.length;
      this.selCount.textContent = shopSel.size + (shopSel.size === 1 ? " vald" : " valda");
      this.tray.hidden = shopSel.size === 0 || !canWrite;
      this.allBox.checked = list.length > 0 && list.filter((r) => !r.pushed && !r.saknar.length).every((r) => shopSel.has(r.key));
    },
    async pushSelected() {
      const keys = [...shopSel];
      if (!keys.length) return;
      const { data: { session } } = await P.supabase.auth.getSession();
      const ul = h("ul", { class: "log" });
      this.result.replaceChildren(h("h4", { class: "sec-title", text: "Pushar " + keys.length + " färgvägar till Shopify (utkast)" }), ul);
      let ok = 0;
      for (const key of keys) {
        const [style_id, farg] = key.split("|");
        const st = byId(D.styles, style_id);
        const li = h("li", null, h("time", { text: (st ? st.namn : style_id) + " · " + farg }), h("div", { text: "Skickar …" }));
        ul.append(li);
        try {
          const res = await fetch("/api/shopify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session ? session.access_token : "") }, body: JSON.stringify({ action: "create", style_id, farg }) });
          const j = await res.json();
          if (j.admin_url) { ok++; li.lastChild.replaceChildren(h("span", { class: "okline", text: "Skapad som utkast. " }), h("a", { href: j.admin_url, target: "_blank", rel: "noopener", text: "Öppna i Shopify" })); shopSel.delete(key); }
          else li.lastChild.replaceChildren(h("span", { class: "late-text", text: (j.error || "Fel") + (j.errors && j.errors.length ? ": " + j.errors.join(" ") : "") }));
        } catch (e) { li.lastChild.replaceChildren(h("span", { class: "late-text", text: "Nätverksfel: " + e.message })); }
      }
      toast(ok + " av " + keys.length + " skapade i Shopify");
      this.update();
    }
  };

  // ---------- tabs ----------
  const VIEWS = { samples: SamplesView, ref: RefView, kollektion: KollView, produktion: ProdView, foto: FotoView, ecom: EcomView, shopify: ShopifyView, tyglager: LagerView, leverantorer: LevView, ean: EanView };
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
    if (t === "samples") { if (downloads) add("Exportera CSV", exportSamples); if (w) add("+ Ny style", () => openStyle(null)); if (w) add("+ Ny sample", () => openSample(null), true); }
    if (t === "kollektion" && w) { add("+ Ny drop", () => openDrop(null, { sasong: KollView.seasonInView() || "" })); add("+ Ny sample", () => openSample(null)); add("+ Ny style", () => openStyle(null, { sasong: KollView.seasonInView() || "" }), true); }
    if (t === "foto" && w) add("+ Ny sample", () => openSample(null, { version: "Fotosample" }), true);
    if (t === "ref" && w) add("+ Nytt referensplagg", () => openRef(null), true);
    if (t === "produktion") { if (downloads) add("Exportera CSV", exportPo); if (w) add("+ Ny PO", () => openPo(null, { sasong: ProdView.seasonInView() || "", leverantor: UI.prod.lev || "" }), true); }
    if (t === "tyglager") { if (downloads) add("Exportera CSV", exportLager); if (w) add("+ Nytt tyg", () => openTyg(null)); if (w) add("+ Nytt parti", () => openLager(null), true); }
    if (t === "leverantorer" && w) add("+ Ny leverantör", () => openLev(null), true);
    if (t === "ean" && downloads) add("Exportera alla EAN", exportAllEan);
    a.append(h("button", { class: "btn", type: "button", text: "Logga ut", title: P.user.email(), onclick: P.signOut }));
  }
  function updateCounts() {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v ? String(v) : ""; };
    set("c_samples", D.samples.filter((s) => ACTIVE.includes(s.status) && !sampleDone(s)).length);
    set("c_drops", D.drops.length);
    set("c_styles", D.styles.filter(isActiveStyle).length);
    set("c_produktion", D.po.filter((p) => PO_OPEN.includes(poStatusNorm(p.status))).length);
    set("c_kollektion", "");
    set("c_ref", D.ref.filter((r) => r.status !== "Tillbaka hos Rubato").length);
    set("c_ecom", "");
    set("c_foto", (() => { const season = KollView.seasonInView(); return D.styles.filter((s) => norm(s.sasong) === norm(season) && !["Kastad", "Pausad"].includes(styleStatusNorm(s.status)) && fotoState(s).key === "saknas").length; })());
    set("c_tyger", D.tyger.length);
    set("c_tyglager", D.lager.filter((l) => l.status === "I lager").length);
    set("c_leverantorer", D.lev.length);
    set("c_shopify", shopRows().filter((r) => !r.pushed && !r.saknar.length).length);
    set("c_ean", D.styles.reduce((n, s) => n + (s.ean || []).length, 0));
  }
  function refreshLists() {
    $("dlLev").replaceChildren(...uniq(D.lev.map((l) => l.namn).concat(D.samples.map((s) => s.leverantor), D.styles.map((s) => s.leverantor))).map((v) => new Option(v, v)));
    $("dlTyg").replaceChildren(...uniq(D.tyger.map((t) => t.namn)).map((v) => new Option(v, v)));
    $("dlPlats").replaceChildren(...uniq([EGET_LAGER].concat(D.lev.map((l) => l.namn), D.lager.map((l) => l.plats))).map((v) => new Option(v, v)));
    $("dlSeason").replaceChildren(...uniq(["AW26", "SS27", "AW27", "SS28"].concat(D.styles.map((s) => s.sasong), D.drops.map((d) => d.sasong))).map((v) => new Option(v, v)));
    $("dlStyle").replaceChildren(...uniq(D.styles.filter((x) => !["Kastad", "Skippad"].includes(x.status)).map((x) => x.namn)).map((v) => new Option(v, v)));
    $("dlKategori").replaceChildren(...KATEGORIER.map((v) => new Option(v, v)));
    $("dlDrop").replaceChildren(...uniq(DROP_NAMES.concat(D.drops.map((d) => d.namn), D.styles.map((s) => s.drop))).map((v) => new Option(v, v)));
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
  const S_LABELS = { markt: "Fysiskt märkt", mattGodkanda: "Mått godkända", mattKommentar: "Måttkommentar", styleId: "Style", version: "Version", leverantor: "Leverantör", farg: "Färg", tygId: "Tyg", storlek: "Storlek", prisBelopp: "Pris", prisValuta: "Valuta", status: "Status", bestalld: "Beställd", ledtid: "Ledtid", forvantad: "Förväntad leverans", mottagen: "Mottagen", tracking: "Tracking", p1Skickad: "Påminnelse 1", p2Skickad: "Påminnelse 2", platsTyp: "Plats", hangare: "Hängare", platsNotering: "Platsnotering", beslut: "Beslut", andringar: "Ändringar", kommentar: "Kommentar", utvarderad: "Utvärderad" };
  const S_INPUTS = { status: "f_status", mottagen: "f_mottagen", p1Skickad: "f_p1", p2Skickad: "f_p2", beslut: "f_beslut", markt: "f_markt", mattGodkanda: "f_matt" };

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
    const fMarkt = selectEl("f_markt", [["", "Nej – inte märkt än"], ["1", "Ja, märkt med ID"]], s.markt ? "1" : "");
    const fMatt = selectEl("f_matt", [["", "– inte mätt än"], ["1", "JA – mått godkända"], ["0", "NEJ – mått avviker"]], s.mattGodkanda === true ? "1" : s.mattGodkanda === false ? "0" : "");
    const fMattKom = inp("f_mattkom", s.mattKommentar, { placeholder: "t.ex. ärm 2 cm för lång, midja ok" });
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
      field("Fysiskt märkt", fMarkt, { hint: "Skriv ID:t på samplen när den kommer" }), field("Plats", fPlats), hangWrap,
      field("Notering", fPNot, { full: true }),
      h("h3", { class: "sec-title full", text: "Mått" }),
      field("Mått godkända", fMatt, { hint: "Mät direkt när samplen kommer" }), field("Måttkommentar", fMattKom),
      h("h3", { class: "sec-title full", text: "Utvärdering" }),
      field("Beslut", fBeslut),
      field("Ändringar till nästa runda", fAndr, { full: true }),
      field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);
    syncLedHint(); syncPlats();

    const quick = h("div", { class: "quick" });
    const remind = h("div", { class: "warnline", style: "margin:0" });
    const planBox = h("div", { class: "planline" });
    const imgSec = h("section");
    function renderImages() {
      imgSec.replaceChildren(h("h3", { class: "sec-title", text: "Bilder" }));
      if (isNew) { imgSec.append(h("p", { class: "hint", text: "Spara samplen först, sedan kan du lägga till bilder. Bilderna syns för Carl under Kollektion." })); return; }
      const cur = current() || s;
      const ids = sampleImages(cur);
      if (ids.length) imgSec.append(gallery(ids, { onRemove: ro || !assets ? null : async (id) => { if (!confirm("Ta bort bilden för alla?")) return; const left = ids.filter((x) => x !== id); if (await write("samples", cur._id, { bilder: left, andrad: new Date().toISOString() })) { try { await assets.delete(id); } catch (e) {} } } }));
      else imgSec.append(h("p", { class: "hint", text: "Inga bilder ännu. Ta en bild på samplen när den kommer – helst på byst eller hängare, rak framifrån." }));
      if (!ro && assets) imgSec.append(imageDrop(async (files) => { imgSec.append(h("p", { class: "hint", id: "imgBusy", text: "Laddar upp " + files.length + " bild(er) …" })); const got = await uploadImages(files); const c2 = current() || cur; if (got.length) await write("samples", c2._id, { bilder: sampleImages(c2).concat(got), andrad: new Date().toISOString(), logg: (c2.logg || []).concat(logEntry(got.length + (got.length === 1 ? " bild tillagd" : " bilder tillagda"))) }); renderImages(); }));
      else if (!ro && !assets) imgSec.append(h("p", { class: "hint", text: "Bilder kan bara laddas upp av den som har Editor-behörighet på appen." }));
    }
    function renderRemind() {
      const cur = current();
      remind.hidden = true;
      if (!cur) return;
      const bits = [];
      if (!cur.markt) bits.push(cur.status === "Mottagen" || cur.status === "Problem" ? "Samplen är inte märkt – skriv " + cur._id + " på den och tryck \"Märkt med ID\"." : "Märk samplen med " + cur._id + " så fort den kommer.");
      if (cur.status === "Mottagen" && (cur.mattGodkanda == null || cur.mattGodkanda === "")) bits.push("Måtten är inte kontrollerade.");
      if (cur.status === "Mottagen" && !sampleImages(cur).length) bits.push("Ingen bild ännu.");
      if (bits.length) { remind.hidden = false; remind.textContent = bits.join(" "); }
    }
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
      if (cur.status === "Mottagen" && beslutNorm(cur.beslut) !== "Godkänd") add("Godkänn", async () => { if (await quickUpdate(cur, { beslut: "Godkänd", utvarderad: true }, "Godkänd")) await approveStyleFrom(cur); }, true);
      if (cur.status === "Mottagen" || cur.beslut) add("Ny runda", () => newRound(cur));
      if (["Mottagen", "Problem"].includes(cur.status) && beslutNorm(cur.beslut) !== "Pausad") add("Pausa", () => quickUpdate(cur, { beslut: "Pausad", utvarderad: true }, "Pausad"));
      if (["Mottagen", "Problem"].includes(cur.status) && beslutNorm(cur.beslut) !== "Kastad") add("Kasta", () => quickUpdate(cur, { beslut: "Kastad", utvarderad: true }, "Markerad som kastad"));
      if (cur.status !== "Problem" && cur.status !== "Mottagen") add("Flagga problem", () => quickUpdate(cur, { status: "Problem" }, "Flaggad som problem"));
      if (!cur.markt) add("Märkt med ID", () => quickUpdate(cur, { markt: true }, cur._id + " är märkt"), unmarked(cur));
      add("Skriv ut etikett", () => openLabels([cur._id]));
    }
    async function quickUpdate(cur, patch, msg) {
      const changes = describeChanges(cur, patch, S_LABELS);
      const body = Object.assign({}, patch, { andrad: new Date().toISOString(), logg: (cur.logg || []).concat(changes.map(logEntry)) });
      const ok = await write("samples", cur._id, body);
      if (ok) { toast(msg); for (const [k, v] of Object.entries(patch)) { const el = S_INPUTS[k] && $(S_INPUTS[k]); if (el) el.value = v === true ? "1" : v === false ? "0" : v == null ? "" : v; } }
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
          platsTyp: fPlats.value, hangare: fPlats.value === "Hängare" ? fHang.value.trim() : "", platsNotering: fPNot.value.trim(), beslut: fBeslut.value, andringar: fAndr.value.trim(), kommentar: fKom.value.trim(),
          markt: fMarkt.value === "1", mattGodkanda: fMatt.value === "1" ? true : fMatt.value === "0" ? false : null, mattKommentar: fMattKom.value.trim()
        };
        if (!o.forvantad && o.bestalld && o.ledtid > 0) o.forvantad = addDays(o.bestalld, o.ledtid);
        if (o.beslut) o.utvarderad = true;
        const now = new Date().toISOString();
        if (isNew) {
          const nid = await freshId("samples", D.samples, "S", 3);
          const body = Object.assign({ id: nid, material: "", utvarderad: !!o.beslut, bilder: [], logg: [logEntry("Sample skapad (" + o.status + ")")], andrad: now }, o);
          if (await create("samples", nid, body)) { if (!byId(D.samples, nid)) D.samples.push(Object.assign({}, body, { _id: nid })); toast(nid + " sparad – märk samplen med " + nid + " när den kommer"); if (o.beslut === "Godkänd") await approveStyleFrom(Object.assign({ _id: nid }, o)); openSample(nid); }
        } else {
          const cur = current() || s;
          const changes = describeChanges(cur, o, S_LABELS);
          if (!changes.length) { closeSheet(); return; }
          const body = Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) });
          if (await write("samples", cur._id, body)) { toast("Sparat"); if (o.beslut === "Godkänd" && cur.beslut !== "Godkänd") await approveStyleFrom(Object.assign({}, cur, o)); closeSheet(); }
        }
      } finally { if (btn) btn.disabled = false; }
    }

    const body = [quick, remind, planBox, imgSec, form];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl, ro ? null : noteRow));
    openSheet({
      tag: isNew ? "Ny" : s._id,
      title: isNew ? "Ny sample" : styleName(s) + (s.version ? " · " + s.version : ""),
      sub: isNew ? "" : [s.farg, s.leverantor, platsText(s)].filter(Boolean).join(" · "),
      body,
      foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("samples", s._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: true, onSave: save }),
      ctx: { refresh: () => { if (!isNew && !current()) { closeSheet(); return; } renderQuick(); renderRemind(); renderPlanLine(); renderImages(); if (!isNew) renderLogInto(logUl, (current() || s).logg); } },
      focus: isNew ? "f_style" : null
    });
    renderQuick(); renderRemind(); renderPlanLine(); renderImages();
    if (!isNew) renderLogInto(logUl, s.logg);
  }

  // ---------- style sheet ----------
  const ST_LABELS = { ecomBilder: "E-com-bilder", ecomPlatDatum: "E-com-plåtning", kampanjStatus: "Kampanjfoto", kampanjDatum: "Kampanjfoto datum", bildId: "Huvudbild", namn: "Namn", leverantor: "Leverantör", sasong: "Säsong", drop: "Drop", typ: "Typ", kategori: "Kategori", status: "Status", klartSenast: "I lager senast", fotoSenast: "Fotosample senast", kommentar: "Kommentar", farger: "Färger", storlekar: "Storlekar" };
  function openStyle(id, preset) {
    const isNew = !id;
    const st = isNew ? Object.assign({ _id: null, status: "Sampling", typ: "Nyhet", farger: [], storlekar: [], ean: [], logg: [] }, preset || {}) : byId(D.styles, id);
    if (!st) { toast("Hittar inte " + id + "."); return; }
    const ro = !canWrite || !db;
    const current = () => (isNew ? st : byId(D.styles, st._id) || st);
    const fNamn = inp("f_snamn", st.namn);
    const fLev = inp("f_slev", st.leverantor, { list: "dlLev", autocomplete: "off" });
    const fSas = inp("f_ssasong", st.sasong, { list: "dlSeason", autocomplete: "off", placeholder: "t.ex. SS27" });
    const fDrop = inp("f_sdrop", st.drop, { list: "dlDrop", autocomplete: "off", placeholder: "t.ex. Drop 1" });
    const fTyp = selectEl("f_styp", STYLE_TYP, st.typ || "Nyhet");
    const fKat = selectEl("f_skat", [["", "– välj –"]].concat(KATEGORIER), styleKategori(st));
    const fStatus = selectEl("f_sstatus", STYLE_STATUS, styleStatusNorm(st.status));
    const fKlart = inp("f_sklart", st.klartSenast, { type: "date" });
    const fFoto = inp("f_sfoto", st.fotoSenast, { type: "date" });
    const fEcom = selectEl("f_secom", ECOM_STATUS.map((x) => [x, x || "– inte planerade"]), st.ecomBilder || "");
    const fEcomD = inp("f_secomd", st.ecomPlatDatum, { type: "date" });
    const fKamp = selectEl("f_skamp", KAMP_STATUS.map((x) => [x, x || "– ingen kampanj"]), st.kampanjStatus || "");
    const fKampD = inp("f_skampd", st.kampanjDatum, { type: "date" });
    const fKom = area("f_skom", st.kommentar);
    const dropHint = h("span", { class: "hint" });
    const syncDropHint = () => { const d = dropOf({ sasong: fSas.value.trim(), drop: fDrop.value.trim() }); dropHint.textContent = fDrop.value.trim() ? (d ? (isISO(d.klartSenast) ? "Droppen har datum " + fmtDate(d.klartSenast) : "Droppen saknar datum") : "Ingen drop med det namnet i " + (fSas.value.trim() || "säsongen") + " – skapas under Drops") : "Tomt = utan drop"; };
    const form = h("form", { class: "form", id: "styleForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      field("Namn", fNamn, { full: true }), field("Leverantör", fLev), field("Säsong", fSas),
      h("div", { class: "field" }, h("label", { for: "f_sdrop", text: "Drop" }), fDrop, dropHint),
      field("Typ", fTyp, { hint: "Restock och NOOS behöver ingen ny sample" }), field("Status", fStatus, { hint: "PO lagd / I produktion / Levererad = gått till produktion" }),
      field("Kategori", fKat, { hint: "Styr budgetrutan under Produktion" }),
      field("I lager senast", fKlart, { hint: "Tomt = droppens datum används" }), field("Fotosample senast", fFoto, { hint: "Valfritt" }),
      field("E-com-bilder", fEcom, { hint: "Olivers status" }), field("E-com-plåtning, datum", fEcomD),
      field("Kampanjfoto", fKamp), field("Kampanjfoto, datum", fKampD),
      field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);
    fSas.addEventListener("input", syncDropHint); fDrop.addEventListener("input", syncDropHint); syncDropHint();
    const formState = () => ({ _id: st._id, namn: fNamn.value.trim(), leverantor: fLev.value.trim(), sasong: fSas.value.trim(), drop: fDrop.value.trim(), typ: fTyp.value, kategori: fKat.value, status: fStatus.value, ecomBilder: fEcom.value, ecomPlatDatum: fEcomD.value || null, kampanjStatus: fKamp.value, kampanjDatum: fKampD.value || null, klartSenast: fKlart.value || null, fotoSenast: fFoto.value || null, kommentar: fKom.value.trim() });

    const prodSec = h("section");
    function renderProd() {
      prodSec.replaceChildren();
      if (isNew) return;
      const pl = poLinesOf(st._id).filter((x) => poStatusNorm(x.po.status) !== "Avbruten");
      if (pl.length) {
        const units = pl.reduce((a, x) => a + (num(x.r.antal) || 0), 0);
        const cost = pl.reduce((a, x) => a + (lineCost(x.r) || 0), 0);
        const perColor = {}; for (const x of pl) { const k = x.r.farg || "TBA"; perColor[k] = (perColor[k] || 0) + (num(x.r.antal) || 0); }
        const kv = (k, v) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v big", text: v }));
        prodSec.append(h("h3", { class: "sec-title", text: "Produktion" }),
          h("div", { class: "kvs" }, kv("Antal totalt", String(units)), kv("Per färg", Object.entries(perColor).map(([k, v]) => k + " " + v).join(", ") || "–"), kv("Snitt/enhet", units ? fmtSEK(cost / units) : "–"), kv("Inköpsvärde", fmtSEK(cost))),
          h("div", { class: "vscroll" }, h("table", { class: "prodrows" }, h("thead", null, h("tr", null, ["PO", "Färg", "Antal", "Tyg/enhet", "Styckpris", "Kostnad", "Status", "ETA lager"].map((x) => h("th", { text: x })))),
            h("tbody", null, pl.map((x) => { const tr = h("tr", { style: "cursor:pointer", onclick: () => openPo(x.po._id) }, h("td", { class: "mono", text: x.po.nr || x.po._id }), h("td", { text: x.r.farg || "TBA" }), h("td", { class: "num", text: x.r.antal == null ? "?" : String(x.r.antal) }), h("td", { class: "num", text: num(x.r.tygkostnad) != null ? fmtSEK(x.r.tygkostnad) : "–" }), h("td", { class: "num", text: num(x.r.styckpris) != null ? fmtSEK(x.r.styckpris) : "–" }), h("td", { class: "num", text: fmtSEK(lineCost(x.r)) }), h("td", null, poStatusPill(x.po)), h("td", { class: "mono", text: poEta(x.po) ? fmtDate(poEta(x.po)) : "" })); return tr; })))),
          h("p", { class: "hint", text: "Klicka på en rad för att öppna PO:n. Kostnad = antal × (styckpris + tygkostnad)." }));
        return;
      }
      const rows = Array.isArray(st.produktion) ? st.produktion : [];
      if (!rows.length) return;
      prodSec.append(h("h3", { class: "sec-title", text: "Produktion" + (st.produktionUppdaterad ? " · från Masterplaner " + fmtDate(st.produktionUppdaterad) : "") }),
        h("div", { class: "vscroll", style: "margin-top:0" }, h("table", { class: "prodrows" }, h("thead", null, h("tr", null, ["PO", "Färg", "Antal", "Status", "ETA lager"].map((x) => h("th", { text: x })))),
          h("tbody", null, rows.map((r) => h("tr", null, h("td", { class: "mono", text: r.po || "" }), h("td", { text: r.farg || "" }), h("td", { class: "mono", text: r.antal == null ? "" : String(r.antal) }), h("td", { text: r.status || "" }), h("td", { class: "mono", text: isISO(r.eta) ? fmtDate(r.eta) : (r.eta || "") })))))));
    }

    const planSec = h("section");
    function renderPlan() {
      const cur = formState(); const p = plan(cur);
      planSec.replaceChildren(h("h3", { class: "sec-title", text: "Tidsplan" }), h("div", { class: "plan-head" }, lagePill(p), h("span", { class: "plan-note", text: p.note || "" })));
      if (["klar", "skip", "paus"].includes(p.lage) || !p.po) return;
      const rows = [
        ["I lager senast" + (p.deadlineFrom === "drop" ? " (från " + cur.sasong + " " + cur.drop + ")" : ""), p.deadline, false, true],
        ["Frakt " + p.frakt + " d → klart hos leverantör", p.ex, false, true],
        ["Produktion " + p.prod + " d" + (p.buff ? " + buffert " + p.buff + " d" : "") + " → PO senast", p.po, true, true],
        ["Utvärdering " + p.utv + " d → sample inne senast", p.inne, false, (cur.typ || "Nyhet") === "Nyhet"],
        [p.sl != null ? "Sample-ledtid " + p.sl + " d → sample beställd senast" : "Sample-ledtid saknas för leverantören", p.best, false, (cur.typ || "Nyhet") === "Nyhet"]
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
    [fLev, fKlart, fStatus, fTyp, fFoto, fSas, fDrop].forEach((x) => x.addEventListener("change", () => { renderPlan(); renderEanTable(); }));
    fKlart.addEventListener("input", renderPlan);

    const gallerySec = h("section");
    function renderGallery() {
      gallerySec.replaceChildren();
      if (isNew) return;
      const cur = current();
      const ids = uniq(samplesOfStyle(st._id).flatMap(sampleImages).concat(cur.bildId ? [cur.bildId] : []));
      gallerySec.append(h("h3", { class: "sec-title", text: "Bilder (" + ids.length + ")" }));
      if (!ids.length) { gallerySec.append(h("p", { class: "hint", text: "Bilder läggs på varje sample. Den godkända samplens första bild blir huvudbild i Kollektion om inget annat väljs." })); return; }
      const hero = styleImage(cur);
      gallerySec.append(gallery(ids, { hero, onHero: ro ? null : async (id) => { await write("styles", cur._id, { bildId: id, andrad: new Date().toISOString() }); } }));
    }
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
          h("span", { class: "mini-side" }, statusPill(x.status), beslutNorm(x.beslut) ? chip(beslutNorm(x.beslut), "b-" + slug(beslutNorm(x.beslut))) : null, h("span", { class: "sub mono", text: e })))));
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
    fKat.addEventListener("change", () => { if (!fStorl.value.trim()) { const d = defaultSizes(fKat.value); if (d.length) { fStorl.value = d.join(", "); renderEanTable(); } } });
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
    // ---- Shopify: produktdata och push (hosted-only, ligger utanför artefaktens datamodell) ----
    const sh = (P.hosted().shopify || {})[st._id] || {};
    const fargRaderOf = () => (P.hosted().farger || {})[st._id] || [];
    const SH = D.settings.shopify || {};
    const SIZE_SYS = D.settings.storlekskoder || {};
    const CARE_LINES = ["Wash at 30° and hang to dry.", "Wash at 30° inside out and hang to dry.", "Hand wash cold and dry flat, or dry clean.", "Dry clean only.", "Do not wash or dry clean. Sponge clean with cold water. Re-wax when needed."];
    const SIZE_CHARTS = ["lot-no-2", "officer-s-chino", "pilot-chino", "cotton-and-linen-slacks", "lot-nr-1-denim", "lot-nr-2-denim", "french-pocket-deck-pant", "french-pocket-trouser", "r-shirt", "roper-shirt", "lightweight-roper-shirt", "work-shirt", "fatigue-shirt", "standard-crew-neck-and-v-neck", "standard-sportsman", "cashman", "camelhair-ridge-crew", "button-through-polo", "mercer-jacket", "fireman-s-jacket", "american-hunting-jacket", "tailored-jackets", "belts", "explorers-roll-neck", "funnel-neck", "geelongora-cable-knit", "cashmere-turtleneck", "cashmere-crew-neck", "5-pkt-trouser", "cortina"];
    const COLOUR_FAMILIES = ["black", "navy", "brown", "ecru", "khaki", "grey", "blue", "beige", "camel", "clay", "olive", "persimmon"];
    const pTyp = selectEl("f_sh_typ", [["", "Välj …"]].concat(Object.keys(SH.produkttyper || {})), sh.produkttyp || "");
    const pSys = selectEl("f_sh_sys", [["", "Välj …"], ["alpha", "XS till XXL (01 till 06)"], ["midja", "Midja 30 till 38 (07 till 13)"], ["eu", "44 till 56 (14 till 20)"], ["eu_tailoring", "Tailoring 46 till 54 (21 till 25)"], ["balte", "Bälten 80 till 105 (35 till 40)"], ["one", "One size (99)"]], sh.storlekssystem || "");
    const pKod = inp("f_sh_kod", sh.stylekod, { placeholder: "sätts automatiskt", disabled: !!sh.stylekod || !canAdmin });
    const pPris = inp("f_sh_pris", sh.rrp_sek, { type: "number", min: "0", step: "1", inputmode: "numeric" });
    const pHs = inp("f_sh_hs", sh.hs_kod, { placeholder: "t.ex. 6203493520" });
    const pVikt = inp("f_sh_vikt", sh.vikt_gram, { type: "number", min: "0", step: "10", placeholder: "gram" });
    const pMat = inp("f_sh_mat", sh.sammansattning, { placeholder: "t.ex. 100% Cotton" });
    const pMatFam = selectEl("f_sh_matfam", [["", "–"], "Cotton", "Wool", "Cashmere", "Camelhair", "Linen", "Silk", "Leather", "Denim"], sh.material_family || "");
    const pCare = inp("f_sh_care", sh.tvattrad, { list: "dlCare", autocomplete: "off" });
    const pCut = inp("f_sh_cut", sh.cut, { placeholder: "t.ex. Straight, Wide, Relaxed" });
    const pFit = inp("f_sh_fit", sh.fit_note, { placeholder: "En rad om passformen" });
    const pModel = inp("f_sh_model", sh.model_note, { placeholder: "t.ex. Model is 186 cm and wears 48" });
    const pMill = inp("f_sh_mill", sh.fabric_mill);
    const pGsm = inp("f_sh_gsm", sh.fabric_weight, { placeholder: "t.ex. 320" });
    const pOrigin = inp("f_sh_origin", sh.fabric_origin, { placeholder: "Var tyget vävs" });
    const pConstr = inp("f_sh_constr", sh.construction, { placeholder: "t.ex. half canvassed" });
    const pFeat = inp("f_sh_feat", sh.features);
    const pChart = inp("f_sh_chart", sh.size_chart, { list: "dlSizeChart", autocomplete: "off", placeholder: "handle, t.ex. pilot-chino" });
    const pDesc = area("f_sh_desc", sh.description_en, "Kalles format: en till två meningar, vad det är plus snitt och tyg, sedan hur det bärs.");
    if (!$("dlCare")) document.body.append(h("datalist", { id: "dlCare" }, CARE_LINES.map((c) => h("option", { value: c }))), h("datalist", { id: "dlSizeChart" }, SIZE_CHARTS.map((c) => h("option", { value: c }))));
    const shopForm = h("div", { class: "form" },
      field("Produkttyp", pTyp), field("Storlekssystem (SKU)", pSys, { hint: "Avgör storlekskoden i SKU" }), field("Stylekod", pKod, { hint: "Löpnummer i SKU, t.ex. 1079" }),
      field("Pris (RRP, SEK)", pPris), field("HS-kod", pHs), field("Vikt", pVikt),
      field("Material (sammansättning)", pMat), field("Material family", pMatFam), field("Skötselråd", pCare, { hint: "Välj en av de sex standardraderna" }),
      field("Cut", pCut), field("Fit note", pFit), field("Model note", pModel),
      field("Fabric mill", pMill), field("Fabric weight (gsm)", pGsm), field("Fabric origin", pOrigin),
      field("Construction", pConstr), field("Features", pFeat), field("Storlekstabell", pChart),
      field("Beskrivning (engelska)", pDesc, { full: true }));
    shopForm.classList.add("three");
    const shopState = () => ({ produkttyp: pTyp.value || null, storlekssystem: pSys.value || null, stylekod: pKod.value.trim() || null, rrp_sek: num(pPris.value), hs_kod: pHs.value.trim() || null, vikt_gram: num(pVikt.value), sammansattning: pMat.value.trim() || null, material_family: pMatFam.value || null, tvattrad: pCare.value.trim() || null, cut: pCut.value.trim() || null, fit_note: pFit.value.trim() || null, model_note: pModel.value.trim() || null, fabric_mill: pMill.value.trim() || null, fabric_weight: pGsm.value.trim() || null, fabric_origin: pOrigin.value.trim() || null, construction: pConstr.value.trim() || null, features: pFeat.value.trim() || null, size_chart: pChart.value.trim() || null, description_en: pDesc.value.trim() || null });
    if (ro) lock(shopForm);

    // En rad per färg: swatch, färgfamilj, status i Shopify, knappar
    const fargSec = h("div");
    const fargState = {};
    const resultBox = h("div", { class: "shopify-result" });
    async function callShopify(action, farg) {
      const { data: { session } } = await P.supabase.auth.getSession();
      const res = await fetch("/api/shopify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session ? session.access_token : "") }, body: JSON.stringify({ action, style_id: st._id, farg }) });
      let j; try { j = await res.json(); } catch (e) { j = { error: "Servern svarade inte som väntat (" + res.status + ")." }; }
      return j;
    }
    function renderResult(farg, j) {
      resultBox.replaceChildren(h("h4", { class: "sec-title", text: (j.update ? "Uppdatering" : "Ny produkt") + ": " + (j.title || farg) }));
      if (j.error && !j.errors) resultBox.append(h("p", { class: "warnline bad", text: j.error }));
      if (j.errors && j.errors.length) resultBox.append(h("ul", { class: "shop-errors" }, j.errors.map((e) => h("li", { text: e }))));
      if (j.warnings && j.warnings.length) resultBox.append(h("ul", { class: "shop-warnings" }, j.warnings.map((e) => h("li", { text: e }))));
      if (j.variants) resultBox.append(h("div", { class: "vscroll" }, h("table", { class: "vtable" }, h("thead", null, h("tr", null, h("th", { text: "Storlek" }), h("th", { text: "SKU" }), h("th", { text: "EAN" }), h("th", { text: "Pris" }))), h("tbody", null, j.variants.map((v) => h("tr", null, h("td", { text: v.size }), h("td", { class: "mono", text: v.sku }), h("td", { class: "mono", text: v.ean || "–" }), h("td", { class: "mono", text: v.price != null ? String(v.price) : "–" })))))));
      if (j.tags) resultBox.append(h("p", { class: "sub", text: "Taggar: " + j.tags.join(", ") }));
      if (j.metafields) resultBox.append(h("details", null, h("summary", { class: "sub", text: j.metafields.length + " metafält" }), h("ul", { class: "shop-mf" }, j.metafields.map((m) => h("li", { class: "mono", text: m })))));
      if (j.admin_url) resultBox.append(h("p", { class: "okline" }, "Skapad som utkast i Shopify. ", h("a", { href: j.admin_url, target: "_blank", rel: "noopener", text: "Öppna i Shopify-admin" })));
      else if (j.errors && !j.errors.length && !ro) resultBox.append(h("button", { class: "btn small primary", type: "button", text: j.update ? "Uppdatera i Shopify" : "Skapa utkast i Shopify", onclick: async (e) => { e.target.disabled = true; e.target.textContent = "Skickar …"; await saveShopFields(); const r = await callShopify("create", farg); renderResult(farg, r); if (r.admin_url) toast("Skapad i Shopify"); } }));
    }
    async function saveShopFields() {
      if (isNew || ro) return;
      const { error: e1 } = await P.supabase.from("shopify_styles").upsert(Object.assign({ style_id: st._id }, shopState()));
      if (e1) toast("Kunde inte spara Shopify-fälten: " + e1.message);
      const rows = Object.entries(fargState).map(([farg, f]) => ({ style_id: st._id, farg, swatch: f.swatch.value && f.swatch.value !== "#888888" ? f.swatch.value : null, colour_family: f.fam.value || null, titel: f.titel.value.trim() || null }));
      if (rows.length) { const { error } = await P.supabase.from("style_farger").upsert(rows, { onConflict: "style_id,farg" }); if (error) toast("Kunde inte spara färgraderna: " + error.message); }
    }
    function renderFarger() {
      const cur = current();
      const farger = parseList(fFarger.value);
      const rader = fargRaderOf();
      fargSec.replaceChildren(h("h4", { class: "sec-title", text: "Färger i Shopify" }));
      if (!farger.length) { fargSec.append(h("p", { class: "hint", text: "Fyll i färger på stylen först." })); return; }
      for (const farg of farger) {
        const r = rader.find((x) => x.farg.toLowerCase() === farg.toLowerCase()) || {};
        const f = fargState[farg] || (fargState[farg] = { swatch: inp("f_sw_" + slug(farg), r.swatch || "#888888", { type: "color" }), fam: selectEl("f_cf_" + slug(farg), [["", "Färgfamilj …"]].concat(COLOUR_FAMILIES.map((c) => [c, c.charAt(0).toUpperCase() + c.slice(1)])), r.colour_family || ""), titel: inp("f_ti_" + slug(farg), r.titel || "", { placeholder: cur.namn + " in " + farg }) });
        if (ro) [f.swatch, f.fam, f.titel].forEach((x) => (x.disabled = true));
        const status = r.shopify_product_id ? h("a", { class: "chip b-godkand", href: "https://admin.shopify.com/store/" + "atemporubato" + "/products/" + r.shopify_product_id, target: "_blank", rel: "noopener", text: (r.shopify_status || "I Shopify") + " · " + (r.shopify_handle || r.shopify_product_id) }) : chip("Ej i Shopify");
        fargSec.append(h("div", { class: "farg-rad" }, h("strong", { text: farg }), f.swatch, f.fam, f.titel, status, ro || isNew ? null : h("button", { class: "btn small", type: "button", text: "Förhandsgranska", onclick: async (e) => { e.target.disabled = true; await saveShopFields(); const j = await callShopify("preview", farg); e.target.disabled = false; renderResult(farg, j); } })));
      }
    }
    fFarger.addEventListener("change", renderFarger);
    const shopSec = h("section", { class: "shop-sec" }, h("h3", { class: "sec-title", text: "Shopify" }), isNew ? h("p", { class: "hint", text: "Spara stylen först." }) : shopForm, isNew ? null : fargSec, isNew ? null : resultBox);
    if (!isNew) renderFarger();

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
          await saveShopFields();
          if (!changes.length) { closeSheet(); return; }
          if (await write("styles", cur._id, Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) }))) { toast("Sparat"); closeSheet(); }
        }
      } finally { if (btn) btn.disabled = false; }
    }

    const nSamples = isNew ? 0 : samplesOfStyle(st._id).length;
    const body = [form, planSec, gallerySec, prodSec, samplesSec, eanSec, shopSec];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl, ro ? null : h("div", { class: "add-note" }, noteIn, h("button", { class: "btn small", type: "button", text: "Lägg till", onclick: addNote }))));
    openSheet({
      tag: isNew ? "Ny" : st._id,
      title: isNew ? "Ny style" : st.namn,
      sub: isNew ? "" : [st.leverantor, st.sasong, st.drop].filter(Boolean).join(" · "),
      body,
      foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("styles", st._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: !nSamples && !(st.ean || []).length, blockText: "Stylen har samples eller EAN kopplade", onSave: save }),
      ctx: { refresh: () => { if (!isNew && !byId(D.styles, st._id)) { closeSheet(); return; } renderPlan(); renderGallery(); renderProd(); renderSamples(); renderEanTable(); if (!isNew) { renderFarger(); renderLogInto(logUl, current().logg); } } },
      focus: isNew ? "f_snamn" : null
    });
    renderPlan(); renderGallery(); renderProd(); renderSamples(); renderEanTable();
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
    const rows = D.samples.slice().sort((a, b) => a._id.localeCompare(b._id)).map((s) => { const e = expected(s); const st = styleOf(s); return [s._id, styleName(s), s.version, s.leverantor, s.farg, tygName(s), s.storlek, s.prisBelopp, s.prisValuta, s.bestalld, s.ledtid, e || "TBA", s.status, s.mottagen, platsText(s), s.platsNotering, beslutNorm(s.beslut), st ? styleStatusNorm(st.status) : "", s.andringar, s.tracking, s.p1Skickad, s.p2Skickad, seasonOf(s), st ? st.drop || "" : "", s.kommentar]; });
    saveFile("Rubato_Samples_" + todayISO() + ".csv", csv(["Sample-ID", "Style", "Version", "Leverantör", "Färg", "Tyg", "Storlek", "Pris", "Valuta", "Beställd", "Ledtid (dgr)", "Förväntad leverans", "Status", "Mottagen", "Plats", "Platsnotering", "Beslut", "Style-status", "Ändringar", "Tracking", "P1 skickad", "P2 skickad", "Säsong", "Drop", "Kommentar"], rows));
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
    else if (/^ST-\d+$/i.test(k)) { if (!loaded.has("styles") || !loaded.has("samples")) return; hashDone = true; if (UI.tab !== "kollektion") switchTab("kollektion"); openStyle(k.toUpperCase()); }
    else if (/^T-\d+$/i.test(k)) { if (!loaded.has("tyger")) return; hashDone = true; if (UI.tab !== "tyglager") switchTab("tyglager"); openTyg(k.toUpperCase()); }
    else if (/^TL-\d+$/i.test(k)) { if (!loaded.has("lager") || !loaded.has("tyger")) return; hashDone = true; if (UI.tab !== "tyglager") switchTab("tyglager"); openLager(k.toUpperCase()); }
    else if (/^po:/i.test(k)) { if (!loaded.has("po") || !loaded.has("styles")) return; hashDone = true; if (UI.tab !== "produktion") switchTab("produktion"); openPo(k.slice(3)); }
    else if (/^R\d+$/i.test(k)) { if (!loaded.has("ref")) return; hashDone = true; if (UI.tab !== "ref") switchTab("ref"); openRef(k.toUpperCase()); }
    else hashDone = true;
  }
  window.addEventListener("hashchange", () => { hashDone = false; const k = (location.hash || "").slice(1); if (VIEWS[k]) switchTab(k); else openFromHash(); });
  function initialTab() {
    const k = (location.hash || "").slice(1);
    if (VIEWS[k]) return k;
    if (/^S\d+$/i.test(k)) return "samples";
    if (/^ST-\d+$/i.test(k)) return "kollektion";
    if (/^T-\d+$/i.test(k)) return "tyglager";
    if (/^TL-\d+$/i.test(k)) return "tyglager";
    if (/^po:/i.test(k)) return "produktion";
    return VIEWS[UI.tab] ? UI.tab : "samples";
  }

  // ---------- boot (hostad) ----------
  function showLogin() { $("login").hidden = false; $("loginBtn").addEventListener("click", () => { $("loginBtn").disabled = true; P.signIn(); }); }
  function subError() { banner("Tappade kontakten med databasen. Ladda om sidan."); }
  switchTab(initialTab());
  (async () => {
    let me = null;
    try { me = await P.start(); } catch (e) { console.error(e); banner("Kunde inte läsa databasen: " + (e.message || e)); }
    if (!me) { showLogin(); return; }
    $("login").hidden = true;
    db = P.db; user = P.user; downloads = P.downloads; assets = P.assets;
    myId = me.id;
    try { canAdmin = await user.canEdit(); } catch (e) {}
    applyWriteMode();
    switchTab(UI.tab);
    const sub = (coll, key) => db.collection(coll).onSnapshot((snap) => { D[key] = snap.docs.map((doc) => Object.assign({}, doc.data(), { _id: doc.id })); loaded.add(key); scheduleRefresh(); openFromHash(); }, subError);
    sub("samples", "samples"); sub("styles", "styles"); sub("tyger", "tyger"); sub("tyglager", "lager"); sub("leverantorer", "lev"); sub("drops", "drops"); sub("po", "po"); sub("budget", "budget"); sub("refplagg", "ref");    db.doc("ean/pool").onSnapshot((snap) => { D.pool = snap.exists ? snap.data() : null; loaded.add("pool"); scheduleRefresh(); }, subError);
    db.doc("installningar/app").onSnapshot((snap) => { if (snap.exists) Object.assign(D.settings, snap.data()); scheduleRefresh(); }, subError);
    db.collection("eanLogg").orderBy("t", "desc").limit(50).onSnapshot((snap) => { D.logg = snap.docs.map((doc) => Object.assign({}, doc.data(), { _id: doc.id })); scheduleRefresh(); }, subError);
  })();
})();
