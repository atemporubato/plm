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
  const PLATSER = ["Hängare", "Fotohäng", "På plåtning", "Testas", "Utlånad", "Gåva", "Såld", "Hos leverantör", "Arkiv"];
  const PO_PLACED = ["Inskickad", "PO bekräftad", "I produktion", "Skickad", "Inlevererad", "Problem"];
  const FOTOSAMPLE_PO = [["", "– ej beställd (beställs automatiskt när PO:n läggs)"], ["Beställd", "Beställd"], ["Inne", "Inne fysiskt"], ["Ej aktuell", "Ej aktuell (restock/NOOS)"]];
  const fotoPoNorm = (v) => { const x = String(v || "").trim(); if (!x) return ""; if (/^inne$|finns|inne|mottag/i.test(x)) return "Inne"; if (/ej aktuell|saknas|nej/i.test(x)) return "Ej aktuell"; return "Beställd"; };
  const BESLUT = ["Godkänd", "Ny runda", "Pausad", "Kastad"];
  const beslutNorm = (b) => (b === "Underkänd" ? "Kastad" : (b || ""));
  const IDEA_STATUS = ["Produktidé", "Idé under utveckling"];
  const STYLE_STATUS = ["Produktidé", "Idé under utveckling", "Sampling", "Godkänd", "PO lagd", "I produktion", "Levererad", "Pausad", "Kastad"];
  const styleStatusNorm = (s) => (s === "Skippad" ? "Kastad" : (s || "Sampling"));
  const isIdea = (st) => !!st && IDEA_STATUS.includes(styleStatusNorm(st.status));
  const TAB_DEFS = [["bibliotek", "Bibliotek"], ["samples", "Samples"], ["ref", "Ref-plagg"], ["kollektion", "Kollektion"], ["produktion", "Produktion"], ["foto", "Foto"], ["ecom", "E-com"], ["shopify", "Shopify"], ["coo", "COO"], ["tyglager", "Tyglager"], ["leverantorer", "Leverantörer"]];
  const NEW_TABS = ["coo", "shopify"]; // flikar tillagda efter att roller kan ha sparats – visas tills rollen sparas om
  const ALL_TABS = TAB_DEFS.map((x) => x[0]);
  const ROLE_DEFAULTS = {
    admin: { namn: "Admin", flikar: ALL_TABS, redigera: true, fast: true },
    team: { namn: "Team", flikar: ALL_TABS, redigera: true },
    design: { namn: "Designer", flikar: ["bibliotek", "samples", "ref", "kollektion", "foto", "coo", "tyglager"], redigera: true },
    junior: { namn: "Junior", flikar: ["bibliotek", "samples", "ref", "kollektion", "coo", "tyglager"], redigera: true },
    extern: { namn: "Extern partner", flikar: ["bibliotek", "kollektion"], redigera: false },
    producent: { namn: "Producent", flikar: ["produktion"], redigera: false, leverantor: true },
    ingen: { namn: "Ingen åtkomst", flikar: [], redigera: false, fast: true }
  };
  const ROLE_ORDER = ["admin", "team", "design", "junior", "extern", "producent", "ingen"];
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
  const D = { samples: [], styles: [], tyger: [], lager: [], lev: [], drops: [], po: [], budget: [], ref: [], pool: null, logg: [], settings: { utvarderingDagar: 7, standardFrakt: 7, marginalGul: 14 }, anvandare: [], narvaro: [], roller: { roller: {}, standardRoll: "team" }, handelser: [], shopify: [] };
  const loaded = new Set();
  let db = null, user = null, downloads = null, assets = null, myId = null, myName = "", canWrite = true, canAdmin = false, platformWrite = true, isGuest = false;
  const ME = { roll: "team", flikar: ALL_TABS, redigera: true, leverantor: "" };
  const UI = {
    tab: "samples",
    bibliotek: { view: null, mode: "styles", q: "", season: "", kat: "", lev: "", status: "alla" },
    samples: { view: null, status: "aktiva", q: "", lev: "", season: "", plats: "", group: "kategori" },
    drops: { season: "" },
    styles: { view: null, status: "aktiva", q: "", lev: "", season: "" },
    prod: { view: null, status: "aktiva", q: "", lev: "", season: "" },
    koll: { season: "", mode: "drop", kat: "", typ: "alla" },
    foto: { view: null, season: "", q: "", typ: "Nyhet", touched: false },
    ecom: { view: null, season: "", q: "", touched: false },
    shopify: { view: null, status: "ej", q: "", lev: "", season: "", alla: false },
    coo: { view: null, mode: "lanseringar", q: "", typer: [], agare: "", season: "", visaAuto: true },
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
      if (saved.bibliotek) Object.assign(UI.bibliotek, saved.bibliotek, { view: null, q: "" });
      if (saved.samples) Object.assign(UI.samples, saved.samples, { view: null, q: "" });
      if (saved.drops) Object.assign(UI.drops, saved.drops);
      if (saved.styles) Object.assign(UI.styles, saved.styles, { view: null, q: "" });
      if (saved.prod) Object.assign(UI.prod, saved.prod, { view: null, q: "" });
      if (saved.koll) Object.assign(UI.koll, saved.koll);
      if (saved.foto) Object.assign(UI.foto, saved.foto, { view: null, q: "" });
      if (saved.ecom) Object.assign(UI.ecom, saved.ecom, { view: null, q: "" });
      if (saved.coo) Object.assign(UI.coo, saved.coo, { view: null, q: "" });
      if (saved.lager) Object.assign(UI.lager, saved.lager, { view: null, q: "" });
    }
  } catch (e) {}
  function persist() {
    try { localStorage.setItem("rubato-samples-v5", JSON.stringify({ tab: UI.tab, bibliotek: { mode: UI.bibliotek.mode, season: UI.bibliotek.season, kat: UI.bibliotek.kat, lev: UI.bibliotek.lev, status: UI.bibliotek.status }, samples: { status: UI.samples.status, group: UI.samples.group, lev: UI.samples.lev, season: UI.samples.season, plats: UI.samples.plats }, drops: { season: UI.drops.season }, styles: { status: UI.styles.status, lev: UI.styles.lev, season: UI.styles.season }, prod: { status: UI.prod.status, lev: UI.prod.lev, season: UI.prod.season }, koll: UI.koll, foto: { season: UI.foto.season, typ: UI.foto.typ, touched: UI.foto.touched }, ecom: { season: UI.ecom.season, touched: UI.ecom.touched }, coo: { mode: UI.coo.mode, typer: UI.coo.typer, agare: UI.coo.agare, season: UI.coo.season, visaAuto: UI.coo.visaAuto }, lager: { status: UI.lager.status, plats: UI.lager.plats, group: UI.lager.group } })); } catch (e) {}
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
  const seasonOf = (s) => { if (s.sasong) return s.sasong; const st = styleOf(s); return (st && st.sasong) || ""; };
  const isArchived = (s) => { if (["Kastad", "Pausad"].includes(beslutNorm(s.beslut))) return true; const st = styleOf(s); return !!st && ["Pausad", "Kastad"].includes(styleStatusNorm(st.status)); };
  const platsText = (s) => (!s.platsTyp ? "" : s.platsTyp === "Hängare" ? "Hängare " + (s.hangare || "?") : s.platsTyp === "Fotohäng" ? "Fotohäng" + (s.hangare ? " " + s.hangare : "") : s.platsTyp);
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
  // Styckpris på raden, annars stylens inköpspris (originalvaluta × dagens kurs) – så att restocks räknas rätt utan att priset skrivs om.
  const lineUnit = (r) => { const p = num(r.styckpris); if (p != null) return { pris: p, kalla: "rad" }; const st = r.styleId ? byId(D.styles, r.styleId) : null; if (st && num(st.inkopspris) && fx(st.inkopsValuta || "SEK")) return { pris: num(st.inkopspris) * fx(st.inkopsValuta || "SEK"), kalla: "style" }; return null; };
  const lineCost = (r) => { const a = num(r.antal), u = lineUnit(r), t = num(r.tygkostnad) || 0; return a == null || !u ? (num(r.kostnad) ?? null) : a * (u.pris + t); };
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
  const imgUrl = (id) => (/^https?:\/\//.test(String(id)) ? String(id) : P.assets.url(id));
  const shopUrl = (st) => (st && st.shopifyBild && st.shopifyBild.url) || "";
  const shopTitle = (st) => (st && st.shopifyBild ? (st.shopifyBild.titel || "Shopify") + (st.shopifyBild.likhet === "liknande" ? " (liknande produkt)" : "") : "");
  const fargText = (f) => { const raw = String(f || "").trim(); const words = raw.replace(/^(?:col(?:ou?r)?\.?\s*)?[#0-9][0-9a-z]*[\s.:\-–]+/i, "").split(/[\s,]+/).filter(Boolean); const kept = words.filter((w) => !/\d/.test(w) && !/^col(?:ou?r)?\.?$/i.test(w)); const out = (kept.length ? kept : words).join(" ").replace(/[\s.:\-–]+$/, ""); return out ? out[0].toUpperCase() + out.slice(1) : raw; };
  const expanded = new Set();
  const groupKeyOf = (s) => (s.styleId || "p:" + norm(s.produkt)) + "|" + norm(s.version) + "|" + norm(s.leverantor);
  const sampleImages = (s) => (Array.isArray(s.bilder) ? s.bilder.filter(Boolean) : []);
  const unmarked = (s) => !s.markt && (s.status === "Mottagen" || s.status === "Problem");
  const unmeasured = (s) => s.status === "Mottagen" && (s.mattGodkanda == null || s.mattGodkanda === "");
  const ECOM_STATUS = ["", "Planerade", "Bokad", "Fotade", "Retuscherade", "Publicerade"];
  const KAMP_STATUS = ["", "Planerad", "Bokad", "Fotad", "Klar"];
  const hasCommittedPo = (st) => poLinesOf(st._id).some((x) => PO_COMMITTED.includes(poStatusNorm(x.po.status)));
  const docImages = (o) => (o && Array.isArray(o.bilder) ? o.bilder.filter(Boolean) : []);
  function styleImage(st) {
    if (!st) return null;
    // Manuellt vald huvudbild vinner alltid. En automatiskt satt bild (bildAuto: Shopify-kopia eller genererad färgöversikt)
    // ersätts av riktiga sample-foton så fort sådana finns.
    if (st.bildId && !st.bildAuto) return st.bildId;
    const xs = samplesOfStyle(st._id).filter((x) => sampleImages(x).length);
    if (xs.length) { const pick = xs.find((x) => beslutNorm(x.beslut) === "Godkänd") || xs.find((x) => x.version === "Fotosample") || xs[xs.length - 1]; return sampleImages(pick)[0]; }
    if (st.bildId) return st.bildId;
    const own = docImages(st);
    if (own.length) return own[0];
    if (shopExact(st) && shopUrl(st)) return shopUrl(st);
    const g = st.grundId ? byId(D.styles, st.grundId) : null;
    if (g) { const gi = g.bildId || docImages(g)[0] || shopUrl(g); if (gi) return gi; }
    return null;
  }
  // Bara exakta Shopify-träffar ("samma" eller manuellt klistrad URL) hämtas som bild – aldrig "liknande" produkter.
  const shopExact = (x) => !!(x.shopifyBild && x.shopifyBild.url && x.shopifyBild.likhet !== "liknande");
  const shopTodo = () => D.styles.filter((x) => shopExact(x) && shopUrl(x) && !docImages(x).length && !x.bildId);
  let extImg = null; // null = ej testat, true = externa bilder visas, false = blockerade
  function probeExternalImages() {
    if (extImg !== null) return;
    const st = D.styles.find((x) => shopUrl(x)); if (!st) return;
    extImg = "pending";
    const im = new Image();
    im.onload = () => { extImg = true; renderDiag(); };
    im.onerror = () => { extImg = false; renderDiag(); };
    im.src = shopUrl(st);
  }
  function renderDiag() {
    const el = $("diag"); if (!el) return;
    const n = shopTodo().length;
    if (extImg !== false || !n || !["bibliotek", "kollektion", "produktion", "foto"].includes(UI.tab)) { el.hidden = true; el.replaceChildren(); return; }
    el.hidden = false;
    el.replaceChildren(h("span", { text: "Bilddiagnos: webbläsaren får inte visa bilder direkt från Shopify i den här appen (" + n + " styles berörs). " }),
      canWrite && assets ? h("button", { class: "linkish", type: "button", text: "Hämta Shopify-bilder till appen", onclick: importShopifyImages }) : h("span", { text: "Be Elliot köra \"Hämta Shopify-bilder\"." }),
      h("span", { class: "sub", text: " Fungerar inte det heller blockeras även hämtningen – då behöver bilderna läggas in via Claude (se chatten)." }));
  }
  async function importShopifyImages() {
    if (!assets) { toast("Kräver Contributor-behörighet eller mer."); return; }
    const todo = shopTodo();
    if (!todo.length) { toast("Alla Shopify-bilder är redan hämtade till appen."); return; }
    let ok = 0, fail = 0; const failed = [];
    banner("Hämtar " + todo.length + " bilder från Shopify till appen …");
    for (const s0 of todo) {
      try {
        const u = new URL(shopUrl(s0)); u.searchParams.set("width", "1200");
        const resp = await fetch(u.toString(), { mode: "cors" });
        if (!resp.ok) throw new Error("http " + resp.status);
        const blob = await resp.blob();
        const file = new File([blob], "shopify.jpg", { type: blob.type || "image/jpeg" });
        const small = await shrinkImage(file, 1600);
        const r = await assets.upload(small, small.type ? undefined : { type: "image/jpeg" });
        const cur = byId(D.styles, s0._id) || s0;
        const now = new Date().toISOString();
        if (await write("styles", s0._id, { bilder: docImages(cur).concat([r.id]), bildId: cur.bildId || r.id, andrad: now, logg: (cur.logg || []).concat(logEntry("Shopify-bild hämtad till appen: " + shopTitle(cur))) })) ok++; else { fail++; failed.push(s0.namn); }
      } catch (e) { fail++; failed.push(s0.namn); }
      banner("Hämtar bilder … " + (ok + fail) + " av " + todo.length);
    }
    banner(fail ? "Kunde inte hämta " + fail + " av " + todo.length + " bilder (" + failed.slice(0, 4).join(", ") + (failed.length > 4 ? " …" : "") + "). Appens säkerhetsregler stoppar hämtning från cdn.shopify.com – bilderna måste då läggas in via Claude." : "");
    if (ok) extImg = null;
    toast(ok + (ok === 1 ? " bild hämtad" : " bilder hämtade") + (fail ? ", " + fail + " misslyckades" : ""));
    renderActions();
  }
  const imageSource = (st) => { const img = styleImage(st); if (!img) return ""; if (img === shopUrl(st)) return "Shopify"; if (samplesOfStyle(st._id).some((x) => sampleImages(x).includes(img))) return "Sample"; if (st.bildAuto && img === st.bildId) return st.farger && st.farger.length > 1 && (st.bilder || []).length > 1 ? "Färgöversikt" : "Shopify"; const g = st.grundId ? byId(D.styles, st.grundId) : null; if (g && (img === g.bildId || docImages(g)[0] === img || img === shopUrl(g))) return "Grundstyle"; return ""; };
  const styleAllImages = (st) => uniq(docImages(st).concat(st.bildId ? [st.bildId] : [], st._id ? samplesOfStyle(st._id).flatMap(sampleImages) : [], shopUrl(st) ? [shopUrl(st)] : []));
  const grundOf = (st) => (st && st.grundId ? byId(D.styles, st.grundId) : null);
  const variantsOf = (id) => D.styles.filter((s) => s.grundId === id).sort((a, b) => seasonRank(b.sasong) - seasonRank(a.sasong) || (a.namn || "").localeCompare(b.namn || "", "sv"));
  const grundStyles = () => D.styles.filter((s) => s.grund).sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv"));
  const styleTyg = (st) => { const t = st && st.tygId ? byId(D.tyger, st.tygId) : null; return t ? t.namn : (st && st.tygNamn) || ""; };
  const refName = (id) => { if (!id) return ""; const st = byId(D.styles, id); if (st) return st.namn; const s = byId(D.samples, id); return s ? styleName(s) + (s.version ? " · " + s.version : "") + " (" + s._id + ")" : String(id); };
  const fotoSamplesOf = (st) => samplesOfStyle(st._id).filter((x) => (x.version === "Fotosample" || x.version === "Produktionssample") && !isArchived(x));
  function fotoState(st) {
    const xs = fotoSamplesOf(st);
    const got = xs.filter((x) => x.status === "Mottagen");
    if (got.length) { const onRack = got.find((x) => x.platsTyp === "Fotohäng") || got[0]; return { key: "finns", label: "Inne fysiskt" + (platsText(onRack) ? " · " + platsText(onRack) : ""), sample: onRack, all: got, onRack: got.some((x) => x.platsTyp === "Fotohäng") }; }
    const wait = xs.filter(isWaiting);
    if (wait.length) { const e = wait.map(expected).filter(Boolean).sort()[0]; return { key: "vantas", label: "Beställd" + (e ? " · väntas " + fmtDate(e) : " · datum saknas"), sample: wait[0], all: wait }; }
    const pos = poLinesOf(st._id).map((x) => x.po).filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status)));
    const po = pos.find((p) => fotoPoNorm(p.fotosample) === "Inne");
    if (po) return { key: "finns", label: "Inne fysiskt (enligt PO " + (po.nr || "") + ")", sample: null, all: [], onRack: false };
    const po2 = pos.find((p) => fotoPoNorm(p.fotosample) === "Beställd");
    if (po2) return { key: "vantas", label: "Beställd via PO " + (po2.nr || "") + (isISO(po2.fotosampleLeverans) ? " · väntas " + fmtDate(po2.fotosampleLeverans) : ""), sample: null, all: [] };
    const any = samplesOfStyle(st._id).find((x) => x.status === "Mottagen" && beslutNorm(x.beslut) === "Godkänd" && !isArchived(x));
    if (any) return { key: "godkand", label: "Ej beställd · godkänd sample kan fotas", sample: any, all: [] };
    return { key: "saknas", label: "Ej beställd", sample: null, all: [] };
  }
  const hasPlacedPo = (st) => poLinesOf(st._id).some((x) => PO_PLACED.includes(poStatusNorm(x.po.status)));
  // Beställer fotosample för en style: en sample per färg på lagda PO-rader (annars en), version Fotosample.
  async function orderFotosamples(st, po, who) {
    const pls = poLinesOf(st._id).filter((x) => PO_PLACED.includes(poStatusNorm(x.po.status)));
    const src = po ? pls.filter((x) => x.po._id === po._id) : pls;
    const colours = uniq(src.map((x) => x.r.farg)).filter(Boolean);
    const p0 = (src[0] && src[0].po) || po || null;
    const lev = (p0 && p0.leverantor) || st.leverantor || "";
    const sl = levNum(lev, "sampleLedtid");
    const start = (p0 && isISO(p0.orderDatum)) ? p0.orderDatum : todayISO();
    const forv = p0 && isISO(p0.fotosampleLeverans) ? p0.fotosampleLeverans : sl != null ? addDays(start, sl) : null;
    const last = samplesOfStyle(st._id).slice(-1)[0];
    const made = [];
    for (const farg of (colours.length ? colours : [""])) {
      const nid = await freshId("samples", D.samples, "S", 3);
      const body = { id: nid, styleId: st._id, produkt: st.namn, version: "Fotosample", leverantor: lev, farg, tygId: st.tygId || (last ? last.tygId : null) || null, material: "", storlek: "", sasong: st.sasong || (p0 && p0.sasong) || "", prisBelopp: null, prisValuta: null, status: "Beställd", bestalld: start, ledtid: sl, forvantad: forv, mottagen: null, tracking: "", p1Skickad: null, p2Skickad: null, platsTyp: "", hangare: "", platsNotering: "", beslut: "", utvarderad: false, markt: false, mattGodkanda: null, mattKommentar: "", andringar: "", kommentar: p0 ? "Fotosample till PO " + (p0.nr || p0._id) : "Fotosample", bilder: [], fotosampleViaPo: p0 ? (p0.nr || p0._id) : "", logg: [logEntry("Fotosample beställd" + (p0 ? " via PO " + (p0.nr || p0._id) : "") + (who ? " – initierad av " + who : ""))], andrad: new Date().toISOString() };
      if (await create("samples", nid, body)) { if (!byId(D.samples, nid)) D.samples.push(Object.assign({}, body, { _id: nid })); made.push(nid); }
    }
    if (made.length) await write("styles", st._id, { andrad: new Date().toISOString(), logg: (st.logg || []).concat(logEntry("Fotosample beställd: " + made.join(", ") + (p0 ? " (PO " + (p0.nr || p0._id) + ")" : ""))) });
    return made;
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
  // Generic image block for a document (style, drop, ref-plagg, tyg). For a new, unsaved document
  // the ids are kept in opts.pending and saved together with the document.
  // Tom bildruta i Bibliotek/Kollektion: kategori + vad som saknas, och uppladdning direkt från kortet (skiss, referens eller foto).
  function emptyTile(s, xs) {
    const what = isIdea(s) ? "Skiss eller referensbild saknas" : (xs && xs.length ? "Foto på samplen saknas" : "Ingen sample än – lägg en skiss");
    const box = h("div", { class: "noimg tile-empty" }, h("span", { class: "kat", text: styleKategori(s) || typLabel(s) || "" }), h("span", { class: "what", text: what }));
    if (assets && canWrite && db) {
      const input = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: async () => { const files = [...input.files]; input.value = ""; if (!files.length) return; const ids = await uploadImages(files); if (!ids.length) return; const cur = byId(D.styles, s._id) || s; await write("styles", s._id, { bilder: (cur.bilder || []).concat(ids), bildId: cur.bildId && !cur.bildAuto ? cur.bildId : ids[0], bildAuto: false, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry(ids.length + (ids.length === 1 ? " bild" : " bilder") + " uppladdad från Bibliotek")) }); toast("Bild sparad"); } });
      box.append(h("button", { class: "btn small", type: "button", text: "+ Lägg till bild", onclick: (e) => { e.stopPropagation(); input.click(); } }), input);
      box.addEventListener("click", (e) => e.stopPropagation());
    }
    return box;
  }
  function bilderSection(opts) {
    const sec = h("section");
    const ro = opts.ro;
    function render() {
      const cur = opts.current ? opts.current() : null;
      const ids = opts.pending ? opts.pending.slice() : docImages(cur);
      sec.replaceChildren(h("h3", { class: "sec-title", text: (opts.title || "Bilder") + (ids.length ? " (" + ids.length + ")" : "") }));
      if (ids.length) sec.append(gallery(ids, { hero: opts.hero ? opts.hero() : null, onHero: ro || !opts.onHero ? null : opts.onHero, onRemove: ro ? null : async (id) => {
        if (!confirm("Ta bort bilden för alla?")) return;
        if (opts.pending) { opts.pending.splice(opts.pending.indexOf(id), 1); render(); try { if (assets) await assets.delete(id); } catch (e) {} return; }
        const left = ids.filter((x) => x !== id);
        if (await opts.save(left, "Bild borttagen")) { try { if (assets && opts.deleteAsset !== false) await assets.delete(id); } catch (e) {} render(); }
      } }));
      else sec.append(h("p", { class: "hint", text: opts.empty || "Inga bilder ännu." }));
      if (!ro && assets) sec.append(imageDrop(async (files) => {
        const busy = h("p", { class: "hint", text: "Laddar upp " + files.length + " bild(er) …" }); sec.append(busy);
        const got = await uploadImages(files);
        if (!got.length) { busy.remove(); return; }
        if (opts.pending) { opts.pending.push(...got); render(); return; }
        const now = opts.pending ? ids : docImages(opts.current());
        await opts.save(now.concat(got), got.length + (got.length === 1 ? " bild tillagd" : " bilder tillagda"));
        render();
      }, opts.addLabel));
      else if (!ro && !assets) sec.append(h("p", { class: "hint", text: "Bilder kan bara laddas upp av den som har Contributor-behörighet eller mer på appen." }));
    }
    render();
    sec.render = render;
    return sec;
  }
  const sampleDone = (s) => { const st = styleOf(s); if (!st) return false; const ss = styleStatusNorm(st.status); if (!(PROD_STATUS.includes(ss) || ss === "Kastad")) return false; return !(ACTIVE.includes(s.status) || toEvaluate(s)); };
  const needsPlace = (s) => s.status === "Mottagen" && !s.platsTyp;
  function utfallParts(s) {
    const out = [];
    const b = beslutNorm(s.beslut);
    if (b) out.push(chip(b === "Godkänd" ? "Godkänd" : b, "b-" + slug(b)));
    if (isArchived(s)) out.push(chip("Arkiv", "b-arkiv"));
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
    const needsSample = (status === "Sampling" || IDEA_STATUS.includes(status)) && (st.typ || "Nyhet") === "Nyhet";
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
    if (code === "invalid_argument") { platformWrite = false; canWrite = false; applyWriteMode(); toast("Du har bara läsbehörighet här."); }
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
    if (k === "styleId" || k === "reserveradFor" || k === "grundId") { const st = byId(D.styles, v); return st ? st.namn : String(v); }
    if (k === "mattFran") return refName(v);
    if (k === "shopifyBild") return v && v.url ? v.url : "";
    if (k === "tygId") { const t = byId(D.tyger, v); return t ? t.namn : String(v); }
    if (typeof v === "boolean") return v ? "ja" : "nej";
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

  // ---------- idéer överlämnade till Alex ----------
  const ideaInbox = () => D.styles.filter((s) => styleStatusNorm(s.status) === "Idé under utveckling").sort((a, b) => String((b.overlamnad && b.overlamnad.t) || b.andrad || "").localeCompare(String((a.overlamnad && a.overlamnad.t) || a.andrad || "")));
  function fillNames(nodes) {
    const ids = uniq(nodes.map((n) => n.dataset.uid));
    if (!user || !ids.length) return;
    user.profiles(ids).then((ps) => nodes.forEach((n) => { const p = ps[n.dataset.uid]; if (p && p.name) n.textContent = p.name; })).catch(() => {});
  }
  function inboxCard(items, full) {
    const card = h("section", { class: "card inbox" }, h("div", { class: "card-head" }, h("h3", { text: "Idéer att sampla" }), h("span", { class: "sub", text: items.length + (items.length === 1 ? " idé överlämnad från Bibliotek" : " idéer överlämnade från Bibliotek") + " – beställ en sample så flyttar stylen till Sampling." })));
    if (!items.length) { card.append(h("p", { class: "hint", style: "padding:12px 16px", text: "Inga idéer väntar just nu. Carl skickar idéer hit från Bibliotek." })); return card; }
    const { t, tb } = table([["Idé"], ["Säsong"], ["Tyg"], ["Från"], ["", "num"]]);
    const who = [];
    for (const s of items) {
      const img = styleImage(s);
      const by = h("span", { class: "who", dataset: { uid: (s.overlamnad && s.overlamnad.av) || "" }, text: "Teamet" }); if (by.dataset.uid) who.push(by);
      const when = s.overlamnad && s.overlamnad.t ? fmtDate(String(s.overlamnad.t).slice(0, 10)) : "";
      tb.append(h("tr", { tabIndex: 0, dataset: { style: s._id } },
        td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, img ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(img), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(styleAllImages(s), img); } }) : null,
          h("div", null, h("div", { class: "prod", text: s.namn }), h("div", { class: "sub", text: [styleKategori(s), s.leverantor, grundOf(s) ? "variant av " + grundOf(s).namn : ""].filter(Boolean).join(" · ") }), s.beskrivning ? h("div", { class: "note", text: s.beskrivning }) : null))),
        td("Säsong", "mono", [s.sasong, s.drop].filter(Boolean).join(" · ")),
        td("Tyg", null, styleTyg(s) || h("span", { class: "muted", text: "–" })),
        td("Från", null, h("div", null, by, when ? h("div", { class: "sub mono", text: when }) : null)),
        td("", "num", canWrite && db ? h("div", { style: "display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap" }, h("button", { class: "btn small", type: "button", text: "Öppna idé", onclick: (e) => { e.stopPropagation(); openStyle(s._id); } }), h("button", { class: "btn small primary", type: "button", text: "Beställ sample", onclick: (e) => { e.stopPropagation(); openSample(null, { styleId: s._id, leverantor: s.leverantor || "", version: "Proto 1", tygId: s.tygId || null }); } })) : null)));
    }
    tb.addEventListener("click", (e) => { if (e.target.closest("input, select, button, img")) return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
    tb.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
    card.append(h("div", { class: "ledger-wrap" }, t));
    fillNames(who);
    return card;
  }

  // ---------- SAMPLES ----------
  const SamplesView = {
    mount(root) {
      const st = UI.samples;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "ideer", label: "Idéer att sampla" },
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
      this.seg = makeSeg([["aktiva", "Aktiva"], ["Beställd", "Beställd"], ["Skickad", "Skickad"], ["Problem", "Problem"], ["Mottagen", "Mottagen"], ["hangare", "Kollektionshängare"], ["produktion", "Gått till produktion"], ["arkiv", "Arkiv"], ["alla", "Alla"]], st, "status", upd);
      const grp = selectEl("f_s_group", [["kategori", "Gruppera per kategori"], ["style", "Gruppera per style"], ["sasong", "Gruppera per säsong"], ["lev", "Gruppera per leverantör"], ["none", "Ingen gruppering"]], st.group);
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
      root.append(h("p", { class: "lede", text: "Samples för produkter som inte är färdiga än. När produkten har gått till produktion flyttar dess samples till \"Gått till produktion\". Pausade och kastade samples ligger i Arkiv och kan plockas upp igen. Tilltänkt säsong sätts på varje sample." }),
        this.strip.el, this.bar = h("section", { class: "filters sticky-bar", "aria-label": "Filter" }, q, this.fLev.el, this.fSeason.el, this.fPlats.el, this.seg.el, grp, h("label", { class: "checkline" }, this.allBox, "Välj alla synliga"), this.count), this.tray, this.cards, this.empty);
      const setStick = () => { if (this.bar) document.documentElement.style.setProperty("--stick", (this.bar.offsetHeight - 2) + "px"); };
      setStick(); window.addEventListener("resize", setStick); setTimeout(setStick, 300);
    },
    filtered() {
      const st = UI.samples, q = norm(st.q);
      return D.samples.filter((s) => {
        const done = sampleDone(s);
        switch (st.view) {
          case "ideer": return false;
          case "waiting": if (!isWaiting(s) || done) return false; break;
          case "late": if (!isLate(s) || done) return false; break;
          case "problem": if (s.status !== "Problem" || done) return false; break;
          case "remind": if (!remindDue(s) || done) return false; break;
          case "evaluate": if (!toEvaluate(s) || done) return false; break;
          case "place": if (!needsPlace(s) || done) return false; break;
          case "mark": if (!unmarked(s) || done) return false; break;
          case "measure": if (!unmeasured(s) || done) return false; break;
          default:
            if (st.status === "produktion") { if (!done || isArchived(s)) return false; }
            else if (st.status === "arkiv") { if (!isArchived(s)) return false; }
            else if (st.status === "hangare") { const stx = styleOf(s); if (!(stx && beslutNorm(s.beslut) === "Godkänd" && HANGER_STYLE.includes(styleStatusNorm(stx.status)) && s.status !== "Returnerad")) return false; }
            else if (st.status === "alla") {}
            else if (done || isArchived(s)) return false;
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
      const inbox = ideaInbox();
      this.strip.set({ ideer: inbox.length, waiting: live.filter(isWaiting).length, late: live.filter(isLate).length, problem: live.filter((s) => s.status === "Problem").length, remind: live.filter((s) => remindDue(s)).length, evaluate: live.filter(toEvaluate).length, mark: live.filter(unmarked).length, measure: live.filter(unmeasured).length, place: live.filter(needsPlace).length });
      this.seg.sync();
      this.fLev.fill(uniq(D.samples.map((s) => s.leverantor)));
      this.fSeason.fill(uniq(D.samples.map(seasonOf)));
      this.fPlats.fill(PLATSER);
      const list = this.filtered();
      const keyOf = st.group === "kategori" ? (s) => kategoriOf(s) || "Utan kategori" : st.group === "style" ? (s) => styleName(s) + " · " + (s.leverantor || "") : st.group === "lev" ? (s) => s.leverantor || "Utan leverantör" : st.group === "sasong" ? (s) => seasonOf(s) || "Utan säsong" : () => "";
      const katRank = (k) => { const i = KATEGORIER.indexOf(k); return i < 0 ? 99 : i; };
      const seasonKeyRank = (k) => (k === "Utan säsong" ? 999 : -seasonRank(k));
      list.sort((a, b) => (st.group === "kategori" ? katRank(keyOf(a)) - katRank(keyOf(b)) : st.group === "sasong" ? seasonKeyRank(keyOf(a)) - seasonKeyRank(keyOf(b)) : 0) || keyOf(a).localeCompare(keyOf(b), "sv") || styleName(a).localeCompare(styleName(b), "sv") || versionRank(a.version) - versionRank(b.version) || (expected(a) || "9999").localeCompare(expected(b) || "9999") || a._id.localeCompare(b._id));
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
      if (st.view === "ideer") { cards.length = 0; cards.push(inboxCard(inbox, true)); }
      else if (inbox.length && !st.view && st.status === "aktiva" && !st.q) cards.unshift(inboxCard(inbox, false));
      this.cards.replaceChildren(...cards);
      this.empty.hidden = list.length > 0 || st.status === "hangare" || st.view === "ideer";
      if (!list.length) {
        this.empty.replaceChildren(...(!loaded.has("samples")
          ? [h("strong", { text: db ? "Laddar samples …" : "Inga samples att visa" }), h("span", { text: db ? "Listan fylls i så fort databasen svarar." : "Öppna sidan via länken i Claude." })]
          : st.status === "arkiv" && !st.q && !st.lev && !st.season && !st.plats ? [h("strong", { text: "Arkivet är tomt" }), h("span", { text: "Pausa eller kasta en sample så hamnar den här – och kan plockas upp igen när som helst." })]
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
    if (s.sasong && (!stn || norm(stn.sasong) !== norm(s.sasong))) subBits.push(h("span", { class: "place", text: (subBits.length ? " · " : "") + "tilltänkt " + s.sasong }));
    else if (stn && stn.sasong) subBits.push(h("span", { text: (subBits.length ? " · " : "") + stn.sasong + (stn.drop ? " " + stn.drop : "") }));
    else if (s.sasong) subBits.push(h("span", { text: (subBits.length ? " · " : "") + "tilltänkt " + s.sasong }));
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
    const sSeasons = uniq(items.map((x) => x.sasong));
    if (sSeasons.length && (!stn || sSeasons.some((x) => norm(x) !== norm(stn.sasong)))) subBits.push("tilltänkt " + sSeasons.join("/"));
    else if (stn && stn.sasong) subBits.push(stn.sasong + (stn.drop ? " " + stn.drop : ""));
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
    const pendingImgs = isNew ? [] : null;
    const imgSec = bilderSection({ title: "Bilder och moodboard", ro, pending: pendingImgs, current: () => byId(D.drops, d._id) || d, empty: "Lägg in moodboard, referensbilder eller en bild på hängaren för droppen. Visas överst i Kollektion.", save: (ids) => write("drops", d._id, { bilder: ids, andrad: new Date().toISOString() }) });
    async function save() {
      const o = { sasong: fSas.value.trim(), namn: fNamn.value.trim(), ordning: num(fOrd.value) ?? 1, klartSenast: fKlart.value || null, lansering: fLans.value || null, kommentar: fKom.value.trim(), andrad: new Date().toISOString() };
      if (!o.sasong || !o.namn) { toast("Fyll i säsong och namn."); return; }
      if (isNew) {
        const nid = slug(o.sasong + "-" + o.namn);
        if (byId(D.drops, nid) || D.drops.some((x) => dropKey(x.sasong, x.namn) === dropKey(o.sasong, o.namn))) { toast("Den droppen finns redan."); return; }
        o.bilder = pendingImgs.slice();
        if (await create("drops", nid, o)) { toast("Drop skapad"); closeSheet(); }
      } else {
        delete o.sasong; delete o.namn;
        if (await write("drops", d._id, o)) { toast("Sparat"); closeSheet(); }
      }
    }
    openSheet({ tag: isNew ? "Ny" : d.sasong, title: isNew ? "Ny drop" : d.sasong + " · " + d.namn, sub: isNew ? "" : members.length + (members.length === 1 ? " produkt" : " produkter"), body: [form, imgSec], foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("drops", d._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: !members.length, blockText: "Flytta produkterna först", onSave: save }), ctx: { refresh: () => { if (!isNew && !byId(D.drops, d._id)) { closeSheet(); return; } imgSec.render(); } }, focus: isNew ? "f_dsasong" : null });
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
        { key: "spent", label: "Lagt (tkr)" }
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
      root.append(h("p", { class: "lede", text: "Alla inköpsordrar per säsong: drop, ETA lager, status och kostnad. Betalningar ligger under Leverantörer. Budgeten per kategori längst ner." }),
        this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fSeason.el, this.fLev.el, this.seg.el, this.count), this.cards, this.empty, this.budget);
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
        spent: Math.round(spent / 1000)
      });
      this.seg.sync();
      const list = D.po.filter((p) => {
        const ps = poStatusNorm(p.status);
        if (season && norm(poSeason(p)) !== norm(season)) return false;
        switch (st.view) {
          case "open": if (!PO_OPEN.includes(ps)) return false; break;
          case "confirm": if (ps !== "Inskickad") return false; break;
          case "late": if (!poIsLate(p)) return false; break;
          case "spent": if (!PO_COMMITTED.includes(ps)) return false; break;
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
        const { t, tb } = table([["Produkt"], ["Färger"], ["Antal", "num"], ["Styckpris", "num"], ["Kostnad", "num"]]);
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
      this.renderBudget(season, inSeason);
    },
    renderTimelines(season) {
      const box = this.tl; box.replaceChildren();
      if (!season || ME.leverantor) return;
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
      if (ME.leverantor) { box.hidden = true; return; } box.hidden = false;
      const all = [];
      for (const p of D.po) { if (PO_DRAFT.includes(poStatusNorm(p.status))) continue; for (const x of payments(p)) if (!x.betald) all.push(x); }
      all.sort((a, b) => (a.datum || "9999").localeCompare(b.datum || "9999"));
      const due90 = all.filter((x) => !x.datum || x.datum <= addDays(todayISO(), 90));
      const sum = (xs) => xs.reduce((a, x) => a + x.belopp, 0);
      box.append(h("div", { class: "card-head" }, h("h3", { text: "Betalningar" }), h("span", { class: "sub", text: all.length ? "Obetalt totalt " + fmtTkr(sum(all)) + " · inom 90 dagar " + fmtTkr(sum(due90)) + " · alla säsonger" : "Inga obetalda betalningar. Betalningarna räknas från leverantörens villkor under Leverantörer, eller från förskott/slutbetalning på PO:n." })));
      if (!all.length) return;
      const { t, tb } = table([["Förfaller"], ["PO"], ["Leverantör"], ["Typ"], ["Belopp", "num"], ["Status"]]);
      const byLev = {};
      for (const x of all.slice(0, 40)) {
        const d = x.datum ? diffDays(x.datum) : null;
        tb.append(h("tr", { tabIndex: 0, dataset: { po: x.po._id } },
          td("Förfaller", "mono", x.datum ? fmtDate(x.datum) : h("span", { class: "muted", text: "datum saknas" }), d != null ? h("div", { class: "days " + (d < 0 ? "late" : d <= 14 ? "soon" : ""), text: fmtDays(d) }) : null),
          td("PO", "c-main", h("div", { class: "prod", text: x.po.nr || x.po._id }), h("div", { class: "sub", text: [x.po.sasong, x.po.drop].filter(Boolean).join(" ") })),
          td("Leverantör", null, x.po.leverantor || ""), td("Typ", null, x.typ, x.kalla === "antagande" ? h("div", { class: "sub", text: "villkor saknas – antaget" }) : null), td("Belopp", "num", fmtSEK(x.belopp), x.valuta !== "SEK" ? h("div", { class: "sub", text: fmtCur(x.beloppValuta, x.valuta) }) : null), td("Status", null, poStatusPill(x.po))));
        byLev[x.po.leverantor || "–"] = (byLev[x.po.leverantor || "–"] || 0) + x.belopp;
      }
      box.append(h("div", { class: "ledger-wrap" }, t));
      box.append(h("div", { class: "totals", style: "margin:0" }, Object.entries(byLev).sort((a, b) => b[1] - a[1]).map(([k, v]) => h("span", null, k + ": ", h("b", { text: fmtTkr(v) })))));
    },
    groupRow(p) {
      const ps = poStatusNorm(p.status);
      const eta = poEta(p);
      const d = eta ? diffDays(eta) : null;
      const bits = [h("span", { class: "nr", text: p.nr || p._id }), h("span", { class: "m", text: p.leverantor || "" }), poStatusPill(p)];
      bits.push(h("span", { class: "m" }, "Drop ", h("b", { text: [p.sasong, p.drop].filter(Boolean).join(" ") || "–" })));
      bits.push(h("span", { class: "m" }, "ETA lager ", h("b", { text: eta ? fmtDate(eta) : "–" })));
      if (d != null && PO_OPEN.includes(ps)) bits.push(h("span", { class: "days " + (d < 0 ? "late" : d <= 14 ? "soon" : ""), text: fmtDays(d) }));
      if (isISO(p.bekraftadEx) || isISO(p.planeradEx)) bits.push(h("span", { class: "m" }, "Ex-factory ", h("b", { text: fmtDate(p.bekraftadEx || p.planeradEx) })));
      if (p.prioritet && p.prioritet !== "Normal") bits.push(h("span", { class: "m", text: p.prioritet }));
      if (p.tygstatus) bits.push(h("span", { class: "m" }, "Tyg: ", h("b", { text: p.tygstatus })));
      const tot = poTotal(p);
      bits.push(h("span", { class: "m" }, "Totalt ", h("b", { text: fmtSEK(tot) })));
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
      const u0 = lineUnit(r0);
      const colours = rs.map((r) => (r.farg || "TBA") + (num(r.antal) != null ? " " + r.antal : "")).join(" · ");
      const pimg = st ? styleImage(st) : null;
      return h("tr", { tabIndex: 0, dataset: { po: p._id } },
        td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, pimg ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(pimg), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(styleAllImages(st), pimg); } }) : null, h("div", null, h("div", { class: "prod", text: r0.produkt || (st ? st.namn : "–") }), h("div", { class: "sub" }, r0.typ && r0.typ !== "Nyhet" ? chip(r0.typ) : null, st ? h("button", { class: "linkish", type: "button", text: st._id + (styleKategori(st) ? " · " + styleKategori(st) : ""), onclick: (e) => { e.stopPropagation(); openStyle(st._id); } }) : h("span", { class: "muted", text: "Ingen style kopplad" }))))),
        td("Färger", null, colours),
        td("Antal", "num", unknown && !units ? "?" : String(units) + (unknown ? "+" : "")),
        td("Styckpris", "num", u0 ? h("div", null, h("div", { text: fmtSEK(u0.pris) }), u0.kalla === "style" ? h("div", { class: "sub", text: "från stylen" + (st && st.inkopsValuta ? " · " + num(st.inkopspris) + " " + st.inkopsValuta : "") }) : null) : h("span", { class: "muted", text: "–" })),
        td("Kostnad", "num", cost ? fmtSEK(cost) : "–")
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
      if (ME.leverantor) { box.hidden = true; return; } box.hidden = false;
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
  const manualPayments = (po) => { const out = []; if (num(po.forskottBelopp)) out.push({ po, typ: "Förskott", belopp: num(po.forskottBelopp), datum: po.forskottDatum, betald: !!po.forskottBetald, kalla: "manuell", idx: "f" }); if (num(po.slutBelopp)) out.push({ po, typ: "Slutbetalning", belopp: num(po.slutBelopp), datum: po.slutDatum, betald: !!po.slutBetald, kalla: "manuell", idx: "s" }); return out; };
  const LEV_TYP = ["Producent", "Tyg", "Trim", "Övrigt"];
  const VILLKOR_VID = [["order", "vid order"], ["produktion", "vid produktionsstart"], ["exfactory", "vid ex-factory"], ["leverans", "vid leverans"], ["faktura", "netto från faktura (ex-factory)"]];
  const VID_LABEL = { order: "vid order", produktion: "vid produktion", exfactory: "vid ex-factory", leverans: "vid leverans", faktura: "netto" };
  const VILLKOR_STATUS = ["Bekräftade", "Att förhandla", "Okända"];
  const FX_DEFAULT = { EUR: 11.32, GBP: 13.08, JPY: 0.0657, USD: 10.6, SEK: 1 };
  const CURS = ["EUR", "GBP", "JPY", "USD"];
  const fx = (cur) => (!cur || cur === "SEK" ? 1 : (num((D.settings.kurser || {})[cur]) ?? FX_DEFAULT[cur] ?? null));
  const fmtCur = (n, cur) => (n == null || isNaN(n) ? "–" : (cur === "JPY" ? Math.round(n).toLocaleString("sv-SE") : Math.round(n).toLocaleString("sv-SE")) + " " + (cur || "SEK"));
  // ---------- PRISMARGINAL (GM1) OCH VALUTARISK ----------
  // GM1 = (pris exkl. moms − inköpskostnad) / pris exkl. moms. Kostnaden är snittet av styckpris (+ tygkostnad) på lagda POs, i SEK.
  // Valutarisk: kostnaden räknas om till leverantörens valuta med dagens kurs och stressas med settings.valutarisk % (SEK försvagas).
  const canSeeMoney = () => ME.flikar.includes("produktion") || ME.flikar.includes("leverantorer");
  const stressPct = () => num(D.settings.valutarisk) ?? 10;
  const unitCostOf = (styleId) => { const ls = poLinesOf(styleId).filter((x) => !PO_DRAFT.includes(poStatusNorm(x.po.status)) && num(x.r.antal) && num(x.r.styckpris) != null); const u = ls.reduce((a, x) => a + num(x.r.antal), 0); return u ? { kostnad: ls.reduce((a, x) => a + num(x.r.antal) * (num(x.r.styckpris) + (num(x.r.tygkostnad) || 0)), 0) / u, po: uniq(ls.map((x) => x.po.nr || x.po._id)) } : null; };
  const shopifyOf = (styleId) => D.shopify.filter((p) => p.styleId === styleId);
  const median = (arr) => { const a = arr.filter((x) => x != null && !isNaN(x)).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const stylePrice = (s) => num(s.ecomPris) ?? median(shopifyOf(s._id).map((p) => num(p.pris)).filter(Boolean));
  // Inköpspris i originalvaluta: Shopify-produktens egen inmatning (inkop) vinner, annars stylens inkopspris/inkopsValuta, annars PO-snittet i SEK.
  const inkopOf = (s, shop) => { const i = shop && shop.inkop && num(shop.inkop.pris) ? shop.inkop : (s && num(s.inkopspris) ? { pris: num(s.inkopspris), valuta: s.inkopsValuta || "", kalla: s.inkopsKalla || "", datum: s.inkopsDatum || "" } : null); return i && num(i.pris) ? i : null; };
  function gm1Info(s, prisIn, shop) {
    const pris = prisIn != null ? num(prisIn) : stylePrice(s);
    if (!pris) return null;
    const netto = pris / 1.25;
    const ink = inkopOf(s, shop);
    const lev = levByName(s.leverantor); const valuta = (ink && ink.valuta) || (lev && lev.valuta) || "SEK"; const kurs = fx(valuta) || 1;
    const stress = valuta === "SEK" ? 0 : stressPct() / 100;
    const out = { pris, netto, valuta, kurs, stress: stressPct(), kostnad: null, kostnadValuta: null, gm: null, gmStress: null, tal: null, po: [], kalla: "" };
    let kostnad = null;
    if (ink && !ink.valuta && !(lev && lev.valuta)) { out.kalla = "inköpspris " + num(ink.pris) + " – valuta saknas"; }
    else if (ink && fx(valuta)) { kostnad = num(ink.pris) * kurs; out.kalla = "inköpspris " + fmtCur(num(ink.pris), valuta) + (ink.kalla ? " (" + ink.kalla + (ink.datum ? " " + fmtDate(ink.datum) : "") + ")" : ""); }
    else { const uc = unitCostOf(s._id); if (uc) { kostnad = uc.kostnad; out.po = uc.po; out.kalla = "PO-snitt " + uc.po.join(", "); } }
    if (kostnad != null) { out.kostnad = kostnad; out.kostnadValuta = kostnad / kurs; out.gm = (netto - kostnad) / netto * 100; out.gmStress = (netto - kostnad * (1 + stress)) / netto * 100; out.tal = valuta === "SEK" ? null : (0.3 * netto / kostnad - 1) * 100; }
    return out;
  }
  const gmClass = (gm) => (gm == null ? "" : gm >= 75 ? "ts-ok" : gm >= 70 ? "ts-delvis-slut" : "ts-slut");
  const fmtPct = (n, d = 0) => (n == null || isNaN(n) ? "–" : (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString("sv-SE") + " %");
  function gmCell(info) {
    if (!info) return h("span", { class: "muted", text: "–" });
    if (info.kostnad == null) return h("span", { class: "sub", text: "GM1: kostnad saknas på PO" });
    return h("div", { class: "gm" }, h("div", { class: "gm-row" }, h("span", { class: "pill " + gmClass(info.gm), text: "GM1 " + fmtPct(info.gm) }),
      info.valuta !== "SEK" ? h("span", { class: "pill " + gmClass(info.gmStress), title: "GM1 om SEK försvagas " + info.stress + " % mot " + info.valuta, text: info.valuta + " +" + info.stress + " %: " + fmtPct(info.gmStress) }) : null),
      h("div", { class: "sub", text: "kostnad " + fmtSEK(info.kostnad) + (info.valuta !== "SEK" ? " (" + fmtCur(info.kostnadValuta, info.valuta) + ")" : "") + (info.kalla ? " · " + info.kalla : "") + " · netto " + fmtSEK(info.netto) + (info.tal != null ? (info.tal >= 0 ? " · tål +" + Math.round(info.tal) + " % " + info.valuta + " innan GM1 < 70 %" : " · under 70 % redan idag") : "") }));
  }
  const termsText = (l) => { if (!l) return ""; const v = Array.isArray(l.villkor) ? l.villkor : []; if (!v.length) return l.villkorText || ""; return v.map((t) => (num(t.andel) ?? 0) + " % " + (t.vid === "faktura" ? (num(t.dagar) || 0) + " dagar netto" : VID_LABEL[t.vid] + (num(t.dagar) ? " +" + t.dagar + " d" : ""))).join(", ") + (num(l.rabatt) ? " · " + l.rabatt + " % rabatt" : ""); };
  function poMilestones(po) {
    const prodDays = num(po.produktionstid) ?? levNum(po.leverantor, "produktionstid");
    const ord = isISO(po.orderDatum) ? po.orderDatum : null;
    const frakt = fraktFor(po.leverantor);
    const ex = isISO(po.bekraftadEx) ? po.bekraftadEx : isISO(po.planeradEx) ? po.planeradEx : ord && prodDays != null ? addDays(ord, prodDays) : isISO(po.leveransOnskad) ? addDays(po.leveransOnskad, -frakt) : null;
    const lev = isISO(po.etaLager) ? po.etaLager : ex ? addDays(ex, frakt) : isISO(po.leveransOnskad) ? po.leveransOnskad : null;
    return { order: ord || (ex && prodDays != null ? addDays(ex, -prodDays) : null), produktion: ord || (ex && prodDays != null ? addDays(ex, -prodDays) : null), exfactory: ex, faktura: ex, leverans: lev };
  }
  // Betalningsplan per PO: manuella fält om de finns, annars leverantörens villkor (eller antagandet 100 % vid leverans)
  function paymentPlan(po) {
    if (PO_DRAFT.includes(poStatusNorm(po.status))) return [];
    const lev = levByName(po.leverantor);
    const cur = (lev && lev.valuta) || po.valuta || "SEK";
    const rate = fx(cur) || 1;
    const manual = manualPayments(po);
    if (manual.length) return manual.map((x) => Object.assign(x, { valuta: cur, beloppValuta: x.belopp / rate }));
    const total = poTotal(po); if (!total) return [];
    const vill = lev && Array.isArray(lev.villkor) && lev.villkor.length ? lev.villkor : null;
    const terms = vill || [{ andel: 100, vid: "leverans", dagar: 0 }];
    const ms = poMilestones(po);
    const paid = po.betalningar || {};
    const st = poStatusNorm(po.status);
    return terms.map((t, i) => {
      const base = ms[t.vid] || null;
      const datum = base ? addDays(base, num(t.dagar) || 0) : null;
      const belopp = total * (num(t.andel) || 0) / 100;
      const rec = paid[i] || null;
      // Antagande: förfallna betalningar på inlevererade POs, och förskott på POs som är i produktion/skickade, är betalda tills någon bockar ur
      const antagenBetald = !rec && !!datum && datum < todayISO() && (st === "Inlevererad" || (["I produktion", "Skickad"].includes(st) && ["order", "produktion"].includes(t.vid)));
      const typ = (num(t.andel) ?? 0) + " % " + (t.vid === "faktura" ? (num(t.dagar) || 0) + " d netto" : VID_LABEL[t.vid] || t.vid);
      return { po, typ, belopp, valuta: cur, beloppValuta: belopp / rate, datum, betald: rec ? !!rec.betald : antagenBetald, antagenBetald, antagna: !vill, idx: i, kalla: vill ? "villkor" : "antagande", datumKalla: base ? (t.vid === "leverans" && !isISO(po.etaLager) ? "beräknad" : t.vid !== "leverans" && !isISO(po.bekraftadEx) && !isISO(po.orderDatum) ? "beräknad" : "") : "" };
    });
  }
  const payments = paymentPlan;
  const openPayments = () => { const out = []; for (const p of D.po) for (const x of paymentPlan(p)) if (!x.betald) out.push(x); return out.sort((a, b) => (a.datum || "9999").localeCompare(b.datum || "9999")); };
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
    const fFoto = selectEl("f_pfoto", FOTOSAMPLE_PO, fotoPoNorm(po.fotosample));
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
      h("h3", { class: "sec-title full", text: "Order" }),
      h("div", { class: "field" }, h("label", { for: "f_pnr", text: "PO-nr" }), fNr, nrHint), field("Leverantör", fLev), field("Status", fStatus),
      field("Säsong", fSas), field("Drop", fDrop), field("Prioritet", fPrio),
      h("h3", { class: "sec-title full", text: "Tidplan" }),
      field("Orderdatum", fOrdD), field("Produktionstid (dagar)", fProd), field("Önskad leverans", fLevO, { hint: "Tomt = droppens \"I lager senast\"" }),
      field("Planerad ex-factory", fPlan), field("Bekräftad ex-factory", fBekEx), field("ETA lager", fEta),
      h("h3", { class: "sec-title full", text: "Tyg och fotosample" }),
      field("Tygstatus", fTygS), field("Fotosample", fFoto, { hint: "Tomt = beställs automatiskt för nyheter" }), field("Fotosample väntas", fFotoD),
      h("h3", { class: "sec-title full", text: "Övrigt" }),
      field("Valuta", fVal), field("Kommentar", fKom, { full: false }), h("div"),
      field("Label instructions", fLabel, { full: true }));
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
      const o = { nr: fNr.value.trim(), leverantor: fLev.value.trim(), sasong: fSas.value.trim(), drop: fDrop.value.trim(), status: fStatus.value, prioritet: fPrio.value, produktionstid: num(fProd.value), fotosample: fFoto.value, fotosampleLeverans: fFotoD.value || null, tygstatus: fTygS.value, orderBekraftad: fBek.value === "1", planeradEx: fPlan.value || null, bekraftadEx: fBekEx.value || null, etaLager: fEta.value || null, valuta: fVal.value.trim() || "SEK", kommentar: fKom.value.trim(),
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
        // Fotosample: beställs automatiskt för nyheter när PO:n är lagd och inget annat är angivet
        if (PO_PLACED.includes(o.status) && !o.fotosample) {
          const curPo = byId(D.po, pid) || Object.assign({ _id: pid }, o);
          const seen = new Set(); const made = [];
          for (const r of rader) {
            const st = r.styleId ? byId(D.styles, r.styleId) : null;
            if (!st || seen.has(st._id) || (r.typ || st.typ || "Nyhet") !== "Nyhet") continue;
            seen.add(st._id);
            const fs = fotoState(st); if (fs.key !== "saknas" && fs.key !== "godkand") continue;
            made.push(...(await orderFotosamples(st, curPo, "PO " + o.nr)));
          }
          if (made.length) { const c2 = byId(D.po, pid) || curPo; await write("po", pid, { fotosample: "Beställd", andrad: now, logg: (c2.logg || []).concat(logEntry("Fotosample beställda automatiskt: " + made.join(", "))) }); toast(made.length + (made.length === 1 ? " fotosample beställd" : " fotosamples beställda") + " – syns under Samples och Foto"); }
        }
        if (isNew) openPo(pid); else closeSheet();
      } finally { if (btn) btn.disabled = false; }
    }
    const kvs = [];
    if (!isNew) { const tot = poTotal(po); kvs.push(h("div", { class: "kvs" }, h("div", { class: "kv" }, h("span", { class: "k", text: "Totalt" }), h("span", { class: "v big", text: fmtSEK(tot) })), h("div", { class: "kv" }, h("span", { class: "k", text: "Antal" }), h("span", { class: "v big", text: String(poUnits(po)) })), h("div", { class: "kv" }, h("span", { class: "k", text: "Dagar kvar" }), h("span", { class: "v big", text: poEta(po) ? fmtDays(diffDays(poEta(po))) : "–" })))); }
    const body = [...kvs, form, linesSec, attSec];
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
      const order = { "Produktidé": -2, "Idé under utveckling": -1, Sampling: 0, "Godkänd": 1, "PO lagd": 2, "I produktion": 3, Levererad: 4, Pausad: 5 };
      items.sort((a, b) => (order[styleStatusNorm(a.status)] ?? 9) - (order[styleStatusNorm(b.status)] ?? 9) || (a.namn || "").localeCompare(b.namn || "", "sv"));
      const units = (s) => poLinesOf(s._id).reduce((a, x) => a + (num(x.r.antal) || 0), 0);
      const cost = (s) => poLinesOf(s._id).reduce((a, x) => a + (lineCost(x.r) || 0), 0);
      const kv = (k, v, sub) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v big", text: v }), sub ? h("span", { class: "sub", text: sub }) : null);
      const nNew = items.filter((s) => (s.typ || "Nyhet") === "Nyhet").length, nRe = items.filter((s) => s.typ === "Restock").length, nNoos = items.filter((s) => s.typ === "NOOS").length;
      const withImg = items.filter((s) => styleImage(s)).length;
      const inProd = items.filter((s) => inProduction(s)).length;
      const nIdeas = items.filter(isIdea).length;
      this.stats.replaceChildren(kv("Produkter " + season, String(items.length), nNew + " new · " + nRe + " re-stock · " + nNoos + " NOOS"), kv("I produktion", String(inProd), items.filter((s) => styleStatusNorm(s.status) === "Sampling").length + " under sampling" + (nIdeas ? " · " + nIdeas + " idéer" : "")), kv("Plagg beställda", String(items.reduce((a, s) => a + units(s), 0))), kv("Med bild", withImg + " av " + items.length));
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
        const dImgs = g.drop ? docImages(g.drop) : [];
        if (dImgs.length) sec.append(h("div", { class: "gallery", style: "grid-template-columns:repeat(auto-fill,minmax(90px,1fr))" }, dImgs.map((id) => h("figure", { class: "thumb" }, h("img", { src: imgUrl(id), alt: "", loading: "lazy", onclick: () => openLightbox(dImgs, id) })))));
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
      const allImgs = styleAllImages(s);
      const g = grundOf(s);
      const b = h("button", { class: "pcard", type: "button", onclick: () => openStyle(s._id) },
        h("div", { class: "pimg" }, img ? h("img", { src: imgUrl(img), alt: s.namn, loading: "lazy", onerror: (e) => { const el = e.target; if (/^https?:/.test(el.src)) el.replaceWith(h("span", { class: "noimg", text: "Bilden från Shopify kunde inte visas – tryck \"Hämta Shopify-bilder\"" })); } }) : emptyTile(s, xs), styleStatusPill(s), h("span", { class: "typtag t-" + slug(s.typ || "Nyhet"), text: typLabel(s) }), allImgs.length > 1 ? h("span", { class: "n", text: allImgs.length + " bilder" }) : null, g ? h("span", { class: "grundtag", text: "Variant av " + g.namn }) : imageSource(s) ? h("span", { class: "grundtag", text: imageSource(s) === "Shopify" ? (s.shopifyBild && s.shopifyBild.likhet === "liknande" ? "Liknande · Shopify" : "Shopify") : imageSource(s) }) : null),
        h("div", { class: "pbody" }, h("span", { class: "pname", text: s.namn }), h("span", { class: "psub", text: [s.leverantor, styleKategori(s), styleTyg(s)].filter(Boolean).join(" · ") }),
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
        { key: "saknas", label: "Fotosample ej beställd", cls: "t-late" },
        { key: "vantas", label: "Beställd – väntas" },
        { key: "finns", label: "Inne fysiskt" },
        { key: "hang", label: "Inne men ej på fotohänget", cls: "t-warn" },
        { key: "ecom", label: "E-com-bilder saknas", cls: "t-warn" },
        { key: "klara", label: "Publicerade" }
      ], st, () => upd());
      const q = searchBox("q_foto", "Sök produkt, PO …", st, () => this.update());
      this.fSeason = filterSelect("f_f_season", "Alla säsonger", st, "season", () => { st.touched = true; upd(); });
      this.segTyp = makeSeg([["Nyhet", "Nyheter"], ["alla", "Alla typer"]], st, "typ", upd);
      this.count = h("span", { class: "count" });
      this.cards = h("div", { class: "cards" });
      root.append(h("p", { class: "lede", text: "Alla nyheter med lagd PO: är fotosample beställd eller inne fysiskt, var hänger den, när är kampanjfotot, när plåtas e-com och är bilderna klara? Fotosample beställs automatiskt när en PO läggs – eller med knappen här. Längst ner: fotohänget och kollektionshängaren." }),
        this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fSeason.el, this.segTyp.el, this.count), this.cards);
    },
    update() {
      const st = UI.foto, q = norm(st.q);
      const seasons = uniq(D.styles.map((s) => s.sasong)).sort((a, b) => seasonRank(b) - seasonRank(a) || b.localeCompare(a, "sv"));
      if (!st.touched && loaded.has("styles") && seasons.length) { st.season = KollView.seasonInView(); st.touched = true; }
      this.fSeason.fill(seasons);
      this.segTyp.sync();
      const season = st.season;
      const all = D.styles.filter((s) => (!season || norm(s.sasong) === norm(season)) && !["Kastad", "Pausad"].includes(styleStatusNorm(s.status)) && !isIdea(s) && (st.typ === "alla" || (s.typ || "Nyhet") === "Nyhet") && hasPlacedPo(s));
      const F = new Map(all.map((s) => [s._id, fotoState(s)]));
      const ecom = (s) => s.ecomBilder || "";
      const shot = (x) => ["Fotade", "Retuscherade", "Publicerade"].includes(x);
      const notOnRack = (s) => { const f = F.get(s._id); return f.key === "finns" && !f.onRack; };
      this.strip.set({ saknas: all.filter((s) => ["saknas", "godkand"].includes(F.get(s._id).key)).length, vantas: all.filter((s) => F.get(s._id).key === "vantas").length, finns: all.filter((s) => F.get(s._id).key === "finns").length, hang: all.filter(notOnRack).length, ecom: all.filter((s) => !shot(ecom(s))).length, klara: all.filter((s) => ecom(s) === "Publicerade").length });
      let list = all.filter((s) => {
        const f = F.get(s._id).key;
        switch (st.view) {
          case "saknas": if (!["saknas", "godkand"].includes(f)) return false; break;
          case "vantas": case "finns": if (f !== st.view) return false; break;
          case "hang": if (!notOnRack(s)) return false; break;
          case "ecom": if (shot(ecom(s))) return false; break;
          case "klara": if (ecom(s) !== "Publicerade") return false; break;
        }
        return !q || [s.namn, s.leverantor, s.drop, s.sasong, styleKategori(s), (s.farger || []).join(" "), poLinesOf(s._id).map((x) => x.po.nr).join(" ")].join(" ").toLowerCase().includes(q);
      });
      const eo = { "": 0, Planerade: 1, Bokad: 2, Fotade: 3, Retuscherade: 4, Publicerade: 5 }, fo = { saknas: 0, godkand: 1, vantas: 2, finns: 3 };
      list.sort((a, b) => (eo[ecom(a)] ?? 0) - (eo[ecom(b)] ?? 0) || fo[F.get(a._id).key] - fo[F.get(b._id).key] || (a.drop || "").localeCompare(b.drop || "") || (a.namn || "").localeCompare(b.namn || "", "sv"));
      const groups = new Map();
      for (const s of list) { const k = (s.sasong || "Utan säsong") + " · " + (s.drop || "Utan drop"); if (!groups.has(k)) groups.set(k, { season: s.sasong || "", drop: s.drop || "", items: [] }); groups.get(k).items.push(s); }
      const dRank = (g) => { const ds = dropsOfSeason(g.season).map((d) => d.namn); const i = ds.indexOf(g.drop); return i < 0 ? 99 : i; };
      const keys = [...groups.keys()].sort((a, b) => { const ga = groups.get(a), gb = groups.get(b); return seasonRank(gb.season) - seasonRank(ga.season) || dRank(ga) - dRank(gb) || a.localeCompare(b, "sv"); });
      const ro = !canWrite || !db;
      const cards = [];
      for (const k of keys) { const items = groups.get(k).items;
        const card = h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: k }), h("span", { class: "sub", text: items.length + " produkter · " + items.filter((s) => F.get(s._id).key === "finns").length + " med fotosample inne · " + items.filter((s) => ecom(s) === "Publicerade").length + " publicerade" })));
        const { t, tb } = table([["Produkt"], ["PO / leverans"], ["Fotosample"], ["Kampanjfoto"], ["E-com-plåtning"], ["E-com-bilder"], ["Notering"]]);
        for (const s of items) {
          const f = F.get(s._id);
          const img = styleImage(s);
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
          const pls = poLinesOf(s._id).filter((x) => PO_PLACED.includes(poStatusNorm(x.po.status)));
          const pos = uniq(pls.map((x) => x.po._id)).map((id) => byId(D.po, id)).filter(Boolean);
          const es = pos.map(poEta).filter(Boolean).sort();
          const poCell = td("PO / leverans", null);
          for (const p of pos) poCell.append(h("div", { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap" }, h("button", { class: "linkish", type: "button", text: p.nr || p._id, onclick: (e) => { e.stopPropagation(); openPo(p._id); } }), poStatusPill(p)));
          poCell.append(es[0] ? h("div", null, h("span", { class: "mono", text: "Leverans " + fmtDate(es[0]) }), h("span", { class: "days " + (diffDays(es[0]) < 0 ? "late" : diffDays(es[0]) <= 14 ? "soon" : ""), text: " · " + fmtDays(diffDays(es[0])) })) : h("div", { class: "muted", text: "ETA saknas" }));
          const fotoCell = td("Fotosample", null, h("div", null, h("span", { class: "pill fs-" + (f.key === "godkand" ? "saknas" : f.key), text: f.label })));
          if (f.all && f.all.length) fotoCell.append(h("div", { class: "sub" }, f.all.map((x, i) => h("button", { class: "linkish", type: "button", text: (i ? " · " : "") + x._id + (fargText(x.farg) ? " " + fargText(x.farg) : "") + (x.status === "Mottagen" && platsText(x) ? " (" + platsText(x) + ")" : ""), onclick: (e) => { e.stopPropagation(); openSample(x._id); } }))));
          else if (f.sample) fotoCell.append(h("div", { class: "sub" }, h("button", { class: "linkish", type: "button", text: f.sample._id + (platsText(f.sample) ? " · " + platsText(f.sample) : ""), onclick: (e) => { e.stopPropagation(); openSample(f.sample._id); } })));
          if (!ro) {
            const acts = h("div", { class: "quick", style: "margin-top:6px" });
            if (f.key === "saknas" || f.key === "godkand") acts.append(h("button", { class: "btn small primary", type: "button", text: "Beställ fotosample", onclick: async (e) => { e.stopPropagation(); const b = e.currentTarget; b.disabled = true; const made = await orderFotosamples(s, pos[0] || null, "Foto-fliken"); toast(made.length ? made.length + (made.length === 1 ? " fotosample beställd: " : " fotosamples beställda: ") + made.join(", ") : "Kunde inte beställa"); } }));
            if (f.key === "vantas" && f.all && f.all.length) acts.append(h("button", { class: "btn small", type: "button", text: "Mottagen idag", onclick: async (e) => { e.stopPropagation(); for (const x of f.all) await write("samples", x._id, { status: "Mottagen", mottagen: todayISO(), andrad: new Date().toISOString(), logg: (x.logg || []).concat(logEntry("Markerad mottagen från Foto-fliken")) }); toast("Fotosample inne – häng den på fotohänget"); } }));
            if (f.key === "finns" && f.all && f.all.length && !f.onRack) acts.append(h("button", { class: "btn small", type: "button", text: "Till fotohänget", onclick: async (e) => { e.stopPropagation(); for (const x of f.all) if (x.platsTyp !== "Fotohäng") await write("samples", x._id, { platsTyp: "Fotohäng", andrad: new Date().toISOString(), logg: (x.logg || []).concat(logEntry("Hängd på fotohänget")) }); toast("Hänger nu på fotohänget – ange krok nr på samplen om ni numrerar"); } }));
            if (acts.childElementCount) fotoCell.append(acts);
          }
          tb.append(h("tr", { tabIndex: 0, dataset: { style: s._id } },
            td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, img ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(img), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(styleAllImages(s), img); } }) : null, h("div", null, h("div", { class: "prod", text: s.namn }), h("div", { class: "sub", text: [s.leverantor, typLabel(s), styleKategori(s), (s.farger || []).join(", ")].filter(Boolean).join(" · ") }), h("div", null, styleStatusPill(s))))),
            poCell,
            fotoCell,
            td("Kampanjfoto", "foto-inline", h("div", { style: "display:grid;gap:4px" }, ksel, kdt)),
            td("E-com-plåtning", "foto-inline", dt),
            td("E-com-bilder", "foto-inline", sel),
            td("Notering", "foto-inline", note)));
        }
        tb.addEventListener("click", (e) => { if (e.target.closest("input, select, button, img")) return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
        card.append(h("div", { class: "ledger-wrap" }, t));
        cards.push(card);
      }
      cards.push(fotohangCard(season));
      cards.push(hangerCard(season));
      this.cards.replaceChildren(...cards);
      if (!list.length) this.cards.prepend(h("div", { class: "empty" }, h("strong", { text: "Inga " + (st.typ === "alla" ? "produkter" : "nyheter") + " med lagd PO" + (season ? " i " + season : "") }), h("span", { text: "Produkter dyker upp här när PO:n är lagd (Inskickad eller senare). Välj \"Alla säsonger\" eller \"Alla typer\" för att se mer." })));
      this.count.textContent = list.length + (st.typ === "alla" ? " produkter" : " nyheter") + " med lagd PO" + (season ? " i " + season : " (alla säsonger)");
    }
  };
  function fotohangCard(season) {
    const items = D.samples.filter((s) => s.platsTyp === "Fotohäng" && !isArchived(s)).sort((a, b) => (num(a.hangare) ?? 999) - (num(b.hangare) ?? 999) || styleName(a).localeCompare(styleName(b), "sv"));
    const inSeason = season ? items.filter((s) => norm(seasonOf(s)) === norm(season)) : items;
    const card = h("section", { class: "card hanger-card" });
    card.append(h("div", { class: "card-head" }, h("h3", { text: "Fotohänget" + (season ? " – " + season : "") }), h("span", { class: "sub", text: inSeason.length ? inSeason.length + " samples hänger på fotohänget" + (items.length > inSeason.length ? " (" + (items.length - inSeason.length) + " från andra säsonger)" : "") : "Tomt – markera fotosamples med plats \"Fotohäng\" så listas de här" })));
    if (!inSeason.length) return card;
    const { t, tb } = table([["Krok"], ["Produkt"], ["Färg"], ["Sample"], ["E-com-bilder"], ["Bild"]]);
    for (const s of inSeason) {
      const st = styleOf(s);
      const imgs = sampleImages(s);
      tb.append(h("tr", { tabIndex: 0, dataset: { id: s._id } },
        td("Krok", null, h("span", { class: "hanger", text: "Fotohäng" + (s.hangare ? " " + s.hangare : "") })),
        td("", "c-main", h("div", { class: "prod", text: styleName(s) }), h("div", { class: "sub", text: [st ? st.sasong : seasonOf(s), st ? st.drop : "", s.version].filter(Boolean).join(" · ") })),
        td("Färg", null, fargText(s.farg) || "–"),
        td("Sample", null, tag(s._id), h("span", { class: "sub", text: " " + (s.status || "") })),
        td("E-com-bilder", null, st ? h("span", { class: "pill es-" + slug(st.ecomBilder || "x"), text: st.ecomBilder || "inte planerade" }) : ""),
        td("Bild", null, imgs.length ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(imgs[0]), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(imgs, imgs[0]); } }) : h("span", { class: "muted", text: "–" }))));
    }
    tb.addEventListener("click", (e) => { if (e.target.closest("button, img")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openSample(tr.dataset.id); });
    card.append(h("div", { class: "ledger-wrap" }, t));
    return card;
  }

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
      tb.addEventListener("click", (e) => { if (e.target.closest("a, button, img")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openRef(tr.dataset.id); });
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
        const imgs = docImages(r);
        return h("tr", { tabIndex: 0, dataset: { id: r._id } },
          td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, imgs.length ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(imgs[0]), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(imgs, imgs[0]); } }) : null, h("div", null, h("div", { class: "prod", text: r.plagg || "–" }), h("div", { class: "sub", text: [r._id, r.styleNamn ? "för " + r.styleNamn : "", r.agare ? "ägare: " + r.agare : ""].filter(Boolean).join(" · ") })))),
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
    const pendingImgs = isNew ? [] : null;
    const imgSec = bilderSection({ title: "Bilder", ro, pending: pendingImgs, current: () => byId(D.ref, r._id) || r, empty: "Ta en bild på plagget innan det skickas – då vet alla vad som är ute.", save: (ids, logText) => { const cur = byId(D.ref, r._id) || r; return write("refplagg", cur._id, { bilder: ids, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry(logText)) }); } });
    async function save() {
      const o = { plagg: fPlagg.value.trim(), styleNamn: fStyle.value.trim(), agare: fAgare.value.trim(), skickadTill: fTill.value.trim(), skickad: fSkickad.value || null, fraktbolag: fBolag.value.trim(), tracking: fTrack.value.trim(), trackingUrl: fUrl.value.trim(), status: fStatus.value, aterSenast: fAter.value || null, tillbaka: fTillb.value || null, varde: num(fVarde.value), kommentar: fKom.value.trim() };
      if (!o.plagg) { toast("Beskriv plagget."); fPlagg.focus(); return; }
      if (!o.skickadTill) { toast("Vart skickades det?"); fTill.focus(); return; }
      const now = new Date().toISOString();
      if (isNew) {
        const nid = await freshId("refplagg", D.ref, "R", 3);
        const body = Object.assign({ id: nid, bilder: pendingImgs.slice(), logg: [logEntry("Registrerat")], andrad: now }, o);
        if (await create("refplagg", nid, body)) { if (!byId(D.ref, nid)) D.ref.push(Object.assign({}, body, { _id: nid })); toast(nid + " sparad" + (!o.tracking ? " – lägg in tracking så fort du har det" : "")); closeSheet(); }
      } else {
        const changes = describeChanges(r, o, REF_LABELS);
        if (!changes.length) { closeSheet(); return; }
        if (await write("refplagg", r._id, Object.assign({}, o, { andrad: now, logg: (r.logg || []).concat(changes.map(logEntry)) }))) { toast("Sparat"); closeSheet(); }
      }
    }
    const body = [form, imgSec];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl));
    openSheet({ tag: isNew ? "Ny" : r._id, title: isNew ? "Nytt referensplagg" : r.plagg, sub: isNew ? "" : [r.skickadTill, r.status].filter(Boolean).join(" · "), body, foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("refplagg", r._id)) { toast("Borttaget"); closeSheet(); } }, canDelete: true, onSave: save }), ctx: { refresh: () => { if (!isNew && !byId(D.ref, r._id)) { closeSheet(); return; } if (!isNew) { imgSec.render(); renderLogInto(logUl, (byId(D.ref, r._id) || r).logg); } } }, focus: isNew ? "f_rplagg" : null });
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
      const money = canSeeMoney();
      this.strip = makeStrip([
        { key: "lev30", label: "Levereras inom 30 d (PO)" },
        { key: "shopify", label: "Ej i Shopify", cls: "t-warn" },
        { key: "pris", label: "Saknar pris", cls: "t-warn" },
        { key: "bild", label: "Saknar e-com-bilder", cls: "t-late" },
        { key: "klara", label: "Klara för lansering" }
      ].concat(money ? [{ key: "marginal", label: "GM1 under 70 % (idag eller vid valutastress)", cls: "t-late" }] : []), st, () => upd());
      const q = searchBox("q_ecom", "Sök produkt …", st, () => this.update());
      this.fSeason = filterSelect("f_e_season", "Alla säsonger", st, "season", () => { st.touched = true; upd(); });
      this.count = h("span", { class: "count" });
      this.cards = h("div", { class: "cards" });
      this.marg = h("section", { class: "card", hidden: !money });
      root.append(h("p", { class: "lede", text: "Allt som ska vara klart i Shopify inför lansering: när plaggen kommer, när kampanj och e-com fotas (från Foto-fliken), och checklistan per produkt – Shopify-produkt, beskrivning, pris (hämtat från Shopify, med GM1 mot PO-kostnaden: grönt ≥ 75 %, gult 70–75 %, rött under 70 %), storleksguide, newsletter och taggar/collections. EAN hämtas från appen." }),
        this.strip.el, this.marg, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fSeason.el, this.count), this.cards);
    },
    // Prismarginaler för alla aktiva Shopify-produkter (kollektionen shopifypriser), med valutarisk. Bara för roller som ser kostnader.
    renderMarginal() {
      const el = this.marg; el.replaceChildren();
      if (!canSeeMoney()) { el.hidden = true; return; }
      el.hidden = false;
      const rows = D.shopify.map((p) => { const s = p.styleId ? byId(D.styles, p.styleId) : null; const info = s ? gm1Info(s, p.pris, p) : (p.inkop && num(p.inkop.pris) ? gm1Info({ _id: "", leverantor: p.leverantor || "" }, p.pris, p) : null); return { p, s, info }; });
      const withCost = rows.filter((r) => r.info && r.info.kostnad != null);
      const under = withCost.filter((r) => r.info.gm < 70), underStress = withCost.filter((r) => r.info.gm >= 70 && r.info.gmStress < 70), missing = rows.filter((r) => !r.info || r.info.kostnad == null);
      const datum = D.shopify.map((p) => p.hamtad).filter(Boolean).sort().pop();
      const tile = (n, l, cls) => h("div", { class: "tile" + (cls ? " " + cls : ""), style: "cursor:default" }, h("span", { class: "n mono", text: n }), h("span", { class: "l", text: l }));
      el.append(h("div", { class: "card-head" }, h("h3", { text: "Prismarginaler (GM1) mot Shopify-pris – med valutarisk" }), h("span", { class: "sub", text: (D.shopify.length ? D.shopify.length + " aktiva produkter i Shopify" + (datum ? ", priser hämtade " + fmtDate(datum) : "") : "Inga Shopify-priser inlästa än") + " · kostnad = inköpspris i leverantörens valuta till dagens kurs (annars PO-snitt i SEK) · stress = SEK försvagas " + stressPct() + " % mot leverantörens valuta (ändras under Leverantörer)" })));
      if (!D.shopify.length) return;
      el.append(h("div", { class: "strip", style: "--cols:4;margin:0 0 12px" }, tile(fmtPct(median(withCost.map((r) => r.info.gm)), 1), "Median-GM1 (" + withCost.length + " produkter med kostnad)"), tile(String(under.length), "Under 70 % idag", under.length ? "t-late" : ""), tile(String(underStress.length), "Hamnar under 70 % vid +" + stressPct() + " % valuta", underStress.length ? "t-warn" : ""), tile(String(missing.length), "Saknar inköpspris", missing.length ? "t-warn" : "")));
      const sorted = rows.slice().sort((a, b) => { const ga = a.info && a.info.kostnad != null ? a.info.gm : 999, gb = b.info && b.info.kostnad != null ? b.info.gm : 999; return ga - gb || (a.p.titel || "").localeCompare(b.p.titel || "", "sv"); });
      const { t, tb } = table([["Produkt (Shopify)"], ["Style"], ["Leverantör"], ["Pris inkl. moms", "num"], ["Kostnad", "num"], ["GM1", "num"], ["Vid +" + stressPct() + " %", "num"], ["Tål valuta"], ["Notering"]]);
      for (const r of sorted) {
        const i = r.info; const lev = r.s ? r.s.leverantor : (r.p.leverantor || ""); const cur = i ? i.valuta : (r.p.valuta || "");
        tb.append(h("tr", { tabIndex: 0, dataset: r.s ? { style: r.s._id } : {}, style: r.s ? "cursor:pointer" : "" },
          td("", "c-main", h("div", { class: "prod", text: r.p.titel }), h("div", { class: "sub", text: r.p.typ || "" })),
          td("Style", null, r.s ? h("span", { class: "mono", text: r.s._id + " · " + r.s.namn }) : h("span", { class: "muted", text: "ingen style i appen" })),
          td("Leverantör", null, (lev || "–") + (cur && cur !== "SEK" ? " · " + cur : "")),
          td("Pris inkl. moms", "num", fmtSEK(r.p.pris)),
          td("Kostnad", "num", i && i.kostnad != null ? h("div", null, h("div", { text: fmtSEK(i.kostnad) }), i.valuta !== "SEK" ? h("div", { class: "sub", text: fmtCur(i.kostnadValuta, i.valuta) }) : null) : h("span", { class: "muted", text: "–" })),
          td("GM1", "num", i && i.kostnad != null ? h("span", { class: "pill " + gmClass(i.gm), text: fmtPct(i.gm, 1) }) : h("span", { class: "muted", text: "–" })),
          td("Vid stress", "num", i && i.kostnad != null && i.valuta !== "SEK" ? h("span", { class: "pill " + gmClass(i.gmStress), text: fmtPct(i.gmStress, 1) }) : h("span", { class: "muted", text: "–" })),
          td("Tål", "mono", i && i.tal != null ? h("span", { style: "white-space:nowrap", title: i.tal >= 0 ? "Så mycket kan SEK försvagas mot " + i.valuta + " innan GM1 går under 70 %" : "GM1 är redan under 70 % till dagens kurs", text: i.tal >= 0 ? "+" + Math.round(i.tal) + " %" : "–" }) : ""),
          td("Notering", null, h("span", { class: "sub", text: [i && i.kalla ? i.kalla : "", r.p.notering || ""].filter(Boolean).join(" · ") }))));
      }
      tb.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
      const wrap = h("div", { class: "ledger-wrap", hidden: !UI.ecom.margOpen }, t);
      const tog = h("button", { class: "btn small", type: "button", text: (UI.ecom.margOpen ? "Dölj" : "Visa") + " alla " + rows.length + " produkter (sorterade på GM1, lägst först)", onclick: () => { UI.ecom.margOpen = !UI.ecom.margOpen; wrap.hidden = !UI.ecom.margOpen; tog.textContent = (UI.ecom.margOpen ? "Dölj" : "Visa") + " alla " + rows.length + " produkter (sorterade på GM1, lägst först)"; persist(); } });
      el.append(h("div", { class: "quick", style: "margin:0 0 8px" }, tog), wrap);
    },
    update() {
      const st = UI.ecom, q = norm(st.q);
      const seasons = uniq(D.styles.map((s) => s.sasong)).sort((a, b) => seasonRank(b) - seasonRank(a) || b.localeCompare(a, "sv"));
      if (!st.touched && loaded.has("styles") && seasons.length) { st.season = KollView.seasonInView(); st.touched = true; }
      this.fSeason.fill(seasons);
      const season = st.season;
      const all = D.styles.filter((s) => (!season || norm(s.sasong) === norm(season)) && !["Kastad", "Pausad"].includes(styleStatusNorm(s.status)) && !isIdea(s));
      const eta = (s) => { const pos = poLinesOf(s._id).map((x) => x.po).filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status))); const req = pos.map((p) => p.leveransOnskad).filter(isISO).sort(); if (req.length) return req[0]; const es = pos.map(poEta).filter(Boolean).sort(); return es[0] || null; };
      const etaSrc = (s) => { const pos = poLinesOf(s._id).map((x) => x.po).filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status))); return pos.some((p) => isISO(p.leveransOnskad)) ? "PO" : pos.some(poEta) ? "ETA" : ""; };
      const eanOk = (s) => { const vs = variants(s.farger || [], sizesOf(s)); return vs.length ? !eanMissing(s) : false; };
      const done = (s) => ECOM_CHECKS.every(([k]) => !!s[k]) && ["Fotade", "Retuscherade", "Publicerade"].includes(s.ecomBilder || "");
      const lim = addDays(todayISO(), 30);
      const money = canSeeMoney();
      const lowGm = (s) => { const i = gm1Info(s); return !!(i && i.kostnad != null && (i.gm < 70 || i.gmStress < 70)); };
      this.strip.set({ lev30: all.filter((s) => { const e = eta(s); return e && e <= lim && e >= todayISO(); }).length, shopify: all.filter((s) => !s.ecomShopify).length, pris: all.filter((s) => !s.ecomPrisSatt).length, bild: all.filter((s) => !["Fotade", "Retuscherade", "Publicerade"].includes(s.ecomBilder || "")).length, klara: all.filter(done).length, marginal: money ? all.filter(lowGm).length : 0 });
      this.renderMarginal();
      const list = all.filter((s) => {
        switch (st.view) {
          case "lev30": { const e = eta(s); if (!(e && e <= lim && e >= todayISO())) return false; break; }
          case "shopify": if (s.ecomShopify) return false; break;
          case "pris": if (s.ecomPrisSatt) return false; break;
          case "bild": if (["Fotade", "Retuscherade", "Publicerade"].includes(s.ecomBilder || "")) return false; break;
          case "klara": if (!done(s)) return false; break;
          case "marginal": if (!lowGm(s)) return false; break;
        }
        return !q || [s.namn, s.leverantor, s.drop, styleKategori(s)].join(" ").toLowerCase().includes(q);
      });
      const dOrderOf = (sea) => dropsOfSeason(sea).map((d) => d.namn);
      list.sort((a, b) => { const dA = dOrderOf(a.sasong), dB = dOrderOf(b.sasong); const ia = dA.indexOf(a.drop || ""), ib = dB.indexOf(b.drop || ""); return seasonRank(b.sasong) - seasonRank(a.sasong) || (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (eta(a) || "9999").localeCompare(eta(b) || "9999") || (a.namn || "").localeCompare(b.namn || "", "sv"); });
      const byDrop = new Map();
      for (const s of list) { const k = (s.drop || "Utan drop") + " – " + (s.sasong || "utan säsong"); if (!byDrop.has(k)) byDrop.set(k, { sasong: s.sasong || "", drop: s.drop || "", items: [] }); byDrop.get(k).items.push(s); }
      const cards = [];
      const ro = !canWrite || !db;
      for (const [k, grp] of byDrop) {
        const items = grp.items;
        const d = dropsOfSeason(grp.sasong).find((x) => x.namn === grp.drop);
        const card = h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: k }), h("span", { class: "sub", text: items.length + " produkter · " + items.filter(done).length + " klara" + (d && isISO(d.lansering) ? " · lansering " + fmtDate(d.lansering) : "") })));
        const { t, tb } = table([["Produkt"], ["Leverans"], ["Kampanjfoto"], ["E-com-foto"], ["Checklista"], ["Pris"], ["Lansering"], ["Notering"]]);
        for (const s of items) {
          const img = styleImage(s);
          const save = (patch, logText) => write("styles", s._id, Object.assign({ andrad: new Date().toISOString() }, patch, logText ? { logg: (s.logg || []).concat(logEntry(logText)) } : {}));
          const checks = h("div", { class: "checks" }, ECOM_CHECKS.map(([key, label]) => { const cb = h("input", { type: "checkbox", checked: !!s[key], disabled: ro, onchange: () => save({ [key]: cb.checked }, label + (cb.checked ? " klar" : " ej klar")) }); return h("label", { class: "checkline" }, cb, label); }),
            h("span", { class: "pill " + (eanOk(s) ? "ts-ok" : "ts-slut"), text: eanOk(s) ? "EAN klara" : "EAN saknas" }));
          const pris = inp("pris_" + s._id, s.ecomPris, { type: "number", min: "0", step: "1", placeholder: "SEK inkl. moms", "aria-label": "Pris" }); pris.disabled = ro;
          const gmEl = h("div");
          const renderGm = () => { gmEl.replaceChildren(); const pr = num(pris.value); if (!pr) return; const src = s.ecomPrisKalla ? h("div", { class: "sub", text: "Pris från " + s.ecomPrisKalla + (s.ecomPrisDatum ? " " + fmtDate(s.ecomPrisDatum) : "") + (pr !== num(s.ecomPris) ? " (ändrat här)" : "") }) : null; if (money) gmEl.append(gmCell(gm1Info(s, pr))); if (src) gmEl.append(src); };
          pris.addEventListener("input", renderGm); renderGm();
          pris.addEventListener("change", () => { const pv = num(pris.value); const same = pv != null && pv === num(s.ecomPris); save({ ecomPris: pv, ecomPrisSatt: pv != null, ecomPrisKalla: pv == null ? null : same ? (s.ecomPrisKalla || "manuellt") : "manuellt", ecomPrisDatum: pv == null ? null : same ? (s.ecomPrisDatum || todayISO()) : todayISO() }, "Pris " + (pris.value || "borttaget")); });
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
      this.count.textContent = list.length + " produkter" + (season ? " i " + season : " (alla säsonger)");
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

  // ---------- COO: rullande 12 månader ----------
  const EV_TYP = [["kollektion", "Kollektion & produkt"], ["inkop", "Inköp"], ["drop", "Drop & lansering"], ["innehall", "Innehåll"], ["massor", "Mässor & event"], ["ekonomi", "Ekonomi & admin"], ["lokaler", "Lokaler & personal"]];
  const EV_TYP_LABEL = Object.fromEntries(EV_TYP);
  const EV_STATUS = ["Planerad", "Pågår", "Klar", "Inställd"];
  const EV_OWNER_DEFAULT = { kollektion: "Carl", inkop: "Elliot", drop: "Jakob", innehall: "Oliver", massor: "Jakob", ekonomi: "Elliot", lokaler: "Jakob" };
  const AGARE = ["Carl", "Jakob", "Alex", "Oliver", "Elliot"];
  const isOverdue = (e) => !!e.datum && e.datum < todayISO() && e.status !== "Klar" && e.status !== "Inställd";
  const evWindow = () => { const t = todayISO(); return { from: addDays(t, -60), to: addDays(t.slice(0, 7) + "-01", 370) }; };
  function autoEvents() {
    const out = [];
    const seen = new Set();
    const add = (e) => { if (!isISO(e.datum)) return; const k = e.key; if (seen.has(k)) return; seen.add(k); out.push(Object.assign({ auto: true, status: e.klar ? "Klar" : "Planerad", slut: null, kommentar: "" }, e)); };
    const money = ME.flikar.includes("produktion") || ME.flikar.includes("leverantorer");
    for (const st of D.styles) {
      if (st.grund || ["Kastad", "Pausad"].includes(styleStatusNorm(st.status))) continue;
      const p = plan(st);
      const base = { sasong: st.sasong || "", drop: st.drop || "", styleId: st._id, open: () => openStyle(st._id) };
      if (!["klar", "skip", "paus"].includes(p.lage) && p.po) {
        const xs = samplesOfStyle(st._id);
        if (p.best && (st.typ || "Nyhet") === "Nyhet") add(Object.assign({}, base, { key: "s-best-" + st._id, typ: "kollektion", titel: "Sample beställd senast: " + st.namn, datum: p.best, agare: "Alex", klar: xs.some((x) => isISO(x.bestalld)) }));
        if (p.inne && (st.typ || "Nyhet") === "Nyhet") add(Object.assign({}, base, { key: "s-inne-" + st._id, typ: "kollektion", titel: "Sample inne senast: " + st.namn, datum: p.inne, agare: "Alex", klar: xs.some((x) => x.status === "Mottagen") }));
        add(Object.assign({}, base, { key: "s-po-" + st._id, typ: "inkop", titel: "PO senast: " + st.namn, datum: p.po, agare: "Elliot", klar: hasPlacedPo(st) }));
      }
      if (isISO(st.fotoSenast)) add(Object.assign({}, base, { key: "s-foto-" + st._id, typ: "innehall", titel: "Fotosample senast: " + st.namn, datum: st.fotoSenast, agare: "Oliver", klar: fotoState(st).key === "finns" }));
      if (isISO(st.kampanjDatum)) add(Object.assign({}, base, { key: "s-kamp-" + st._id, typ: "innehall", titel: "Kampanjfoto: " + st.namn, datum: st.kampanjDatum, agare: "Oliver", klar: ["Fotad", "Klar"].includes(st.kampanjStatus) }));
      if (isISO(st.ecomPlatDatum)) add(Object.assign({}, base, { key: "s-ecom-" + st._id, typ: "innehall", titel: "E-com-plåtning: " + st.namn, datum: st.ecomPlatDatum, agare: "Oliver", klar: ["Fotade", "Retuscherade", "Publicerade"].includes(st.ecomBilder) }));
      if (isISO(st.ecomLansering)) add(Object.assign({}, base, { key: "s-lans-" + st._id, typ: "drop", titel: "Lansering: " + st.namn, datum: st.ecomLansering, agare: "Jakob", klar: st.ecomBilder === "Publicerade" && !!st.ecomShopify }));
    }
    for (const d of D.drops) {
      const members = D.styles.filter((x) => dropKey(x.sasong, x.drop) === dropKey(d.sasong, d.namn) && styleStatusNorm(x.status) !== "Kastad");
      const base = { sasong: d.sasong, drop: d.namn, open: () => openDrop(d._id) };
      if (isISO(d.lansering)) add(Object.assign({}, base, { key: "d-lans-" + d._id, typ: "drop", titel: "Drop-datum: " + d.namn + " " + d.sasong, datum: d.lansering, agare: "Jakob", klar: d.lansering < todayISO() || (members.length > 0 && members.every((x) => x.ecomBilder === "Publicerade")) }));
      if (isISO(d.klartSenast)) add(Object.assign({}, base, { key: "d-klart-" + d._id, typ: "inkop", titel: "I lager senast: " + d.namn + " " + d.sasong, datum: d.klartSenast, agare: "Elliot", klar: members.length > 0 && members.every((x) => styleStatusNorm(x.status) === "Levererad") }));
    }
    for (const po of D.po) {
      const st0 = poStatusNorm(po.status); if (PO_DRAFT.includes(st0)) continue;
      const ms = poMilestones(po);
      const nr = po.nr || po._id;
      const base = { sasong: po.sasong || "", drop: po.drop || "", poId: po._id, open: () => openPo(po._id) };
      const rank = PO_STATUS.indexOf(st0);
      if (ms.produktion) add(Object.assign({}, base, { key: "po-prod-" + po._id, typ: "inkop", titel: "Produktionsstart " + nr + " · " + (po.leverantor || ""), datum: ms.produktion, agare: "Elliot", klar: rank >= PO_STATUS.indexOf("PO bekräftad") }));
      if (ms.exfactory) add(Object.assign({}, base, { key: "po-ex-" + po._id, typ: "inkop", titel: "Ex-factory " + nr + " · " + (po.leverantor || ""), datum: ms.exfactory, agare: "Elliot", klar: rank >= PO_STATUS.indexOf("Skickad") }));
      if (ms.leverans) add(Object.assign({}, base, { key: "po-lev-" + po._id, typ: "inkop", titel: "Leverans till lager " + nr, datum: ms.leverans, agare: "Alex", klar: st0 === "Inlevererad" }));
      paymentPlan(po).forEach((x, i) => { if (x.datum) add(Object.assign({}, base, { key: "po-pay-" + po._id + "-" + x.idx, typ: "inkop", titel: (x.typ.includes("100") ? "Betalning " : x.typ.includes("netto") ? "Slutbetalning " : i === 0 ? "Handpenning " : "Betalning ") + nr + (money ? " · " + fmtTkr(x.belopp) : ""), datum: x.datum, agare: "Elliot", klar: !!x.betald })); });
    }
    return out;
  }
  function allEvents() {
    const w = evWindow();
    const manual = D.handelser.map((e) => Object.assign({}, e, { auto: false, open: () => openEvent(e._id) }));
    return autoEvents().concat(manual).filter((e) => isISO(e.datum) && ((e.datum >= w.from && e.datum <= w.to) || (e.slut && e.slut >= w.from && e.datum <= w.to)) && (e.datum >= todayISO() || isOverdue(e) || (e.slut && e.slut >= todayISO()) || e.datum >= addDays(todayISO(), -30)));
  }
  const evPill = (e) => h("span", { class: "pill ev-" + (isOverdue(e) ? "sen" : slug(e.status || "Planerad")), text: isOverdue(e) ? "Försenad" : e.status || "Planerad" });
  const CooView = {
    mount(root) {
      const st = UI.coo;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "sen", label: "Försenade", cls: "t-late" },
        { key: "v7", label: "Inom 7 dagar", cls: "t-warn" },
        { key: "d30", label: "Inom 30 dagar" },
        { key: "man", label: "Manuella händelser" },
        { key: "mina", label: "Mina" }
      ], st, () => upd());
      const q = searchBox("q_coo", "Sök händelse, PO, style …", st, () => this.update());
      this.seg = makeSeg([["lanseringar", "Lanseringar"], ["tidslinje", "Tidslinje"], ["30", "Nästa 30 dagar"], ["lista", "Lista"]], st, "mode", upd);
      this.fAgare = filterSelect("f_c_agare", "Alla ägare", st, "agare", upd);
      this.fSeason = filterSelect("f_c_season", "Alla säsonger", st, "season", upd);
      this.typeBar = h("div", { class: "seg", role: "group", "aria-label": "Typ" });
      this.autoBox = h("input", { type: "checkbox", checked: st.visaAuto !== false, onchange: () => { st.visaAuto = this.autoBox.checked; upd(); } });
      this.count = h("span", { class: "count" });
      this.body = h("div", { class: "cards" });
      root.append(h("p", { class: "lede", text: "Vad som lanseras när, månad för månad: varje drop med sina produkter och var de står – levererat, foto, i Shopify. Mässor och andra händelser visas i samma flöde. Tidslinje och lista finns kvar för den som vill se alla deadlines." }),
        this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.seg.el, this.fAgare.el, this.fSeason.el, this.typeBar, h("label", { class: "checkline" }, this.autoBox, "Visa automatiska"), this.count), this.body);
      this.renderTypeBar();
    },
    renderTypeBar() {
      const st = UI.coo;
      this.typeBar.replaceChildren(...EV_TYP.map(([k, l]) => h("button", { type: "button", class: "evt-" + k, "aria-pressed": String(!st.typer.length || st.typer.includes(k)), text: l, onclick: () => { if (!st.typer.length) st.typer = [k]; else if (st.typer.includes(k)) st.typer = st.typer.filter((x) => x !== k); else st.typer = st.typer.concat([k]); if (st.typer.length === EV_TYP.length) st.typer = []; this.update(); persist(); } })));
    },
    filtered(all) {
      const st = UI.coo, q = norm(st.q), t = todayISO();
      return all.filter((e) => {
        switch (st.view) {
          case "sen": if (!isOverdue(e)) return false; break;
          case "v7": if (!(e.datum >= t && e.datum <= addDays(t, 7) && e.status !== "Klar")) return false; break;
          case "d30": if (!(e.datum >= t && e.datum <= addDays(t, 30) && e.status !== "Klar")) return false; break;
          case "man": if (e.auto) return false; break;
          case "mina": if (!(myName && norm(e.agare) === norm(myName))) return false; break;
        }
        if (st.typer.length && !st.typer.includes(e.typ)) return false;
        if (st.agare && norm(e.agare) !== norm(st.agare)) return false;
        if (st.season && norm(e.sasong) !== norm(st.season)) return false;
        if (st.visaAuto === false && e.auto) return false;
        if (q && ![e.titel, e.typ, EV_TYP_LABEL[e.typ], e.agare, e.sasong, e.drop, e.kommentar, e.status].join(" ").toLowerCase().includes(q)) return false;
        return true;
      });
    },
    update() {
      const st = UI.coo, t = todayISO();
      const all = allEvents().sort((a, b) => a.datum.localeCompare(b.datum) || (a.titel || "").localeCompare(b.titel || "", "sv"));
      this.strip.set({ sen: all.filter(isOverdue).length, v7: all.filter((e) => e.datum >= t && e.datum <= addDays(t, 7) && e.status !== "Klar").length, d30: all.filter((e) => e.datum >= t && e.datum <= addDays(t, 30) && e.status !== "Klar").length, man: all.filter((e) => !e.auto).length, mina: myName ? all.filter((e) => norm(e.agare) === norm(myName) && e.status !== "Klar").length : 0 });
      this.seg.sync(); this.renderTypeBar();
      this.fAgare.fill(uniq(AGARE.concat(all.map((e) => e.agare))));
      this.fSeason.fill(uniq(all.map((e) => e.sasong)).sort((a, b) => seasonRank(b) - seasonRank(a)));
      const list = this.filtered(all);
      this.body.replaceChildren();
      const simple = st.mode === "lanseringar" && !st.view; this.typeBar.hidden = simple; this.autoBox.parentElement.hidden = simple; this.fAgare.el.hidden = simple;
      if (simple) { this.body.append(...this.launches(list)); this.count.textContent = ""; return; }
      if (st.mode === "tidslinje" && !st.view) this.body.append(this.timeline(list));
      else if (st.mode === "30" && !st.view) this.body.append(this.listCard(list.filter((e) => (e.datum <= addDays(t, 30) && e.status !== "Klar") || isOverdue(e)), "Nästa 30 dagar", "Försenat överst, sedan i datumordning."));
      else this.body.append(this.listCard(list, st.view ? ({ sen: "Försenade", v7: "Inom 7 dagar", d30: "Inom 30 dagar", man: "Manuella händelser", mina: "Mina händelser" })[st.view] : "Alla händelser 12 månader", ""));
      this.count.textContent = list.length + " händelser · " + all.filter((e) => !e.auto).length + " manuella";
    },
    // Lanseringar: månad för månad, drop för drop, med produkterna och var de står.
    launches(list) {
      const st = UI.coo, t = todayISO();
      const w = evWindow();
      const live = (x) => !x.grund && !isIdea(x) && !["Kastad", "Pausad"].includes(styleStatusNorm(x.status));
      const etaOf = (x) => { const pos = poLinesOf(x._id).map((l) => l.po).filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status))); if (!pos.length) return null; if (pos.every((p) => poStatusNorm(p.status) === "Inlevererad")) return { key: "inne", label: "Levererad" }; const ds = pos.map((p) => (isISO(p.leveransOnskad) ? p.leveransOnskad : poEta(p))).filter(Boolean).sort(); return { key: ds[0] && ds[0] < t ? "sen" : "vantar", label: ds[0] ? "Leverans " + fmtDate(ds[0]) : "PO lagd, datum saknas" }; };
      const chip = (cls, txt) => h("span", { class: "pill " + cls, text: txt });
      const prodRow = (x) => {
        const img = styleImage(x); const eta = etaOf(x); const foto = x.ecomBilder || "";
        return h("div", { class: "launch-prod", tabIndex: 0, onclick: () => openStyle(x._id), onkeydown: (ev) => { if (ev.key === "Enter") openStyle(x._id); } },
          img ? h("img", { class: "rowthumb", style: "margin:0", src: imgUrl(img), alt: "", loading: "lazy" }) : h("div", { class: "rowthumb", style: "margin:0" }),
          h("div", { class: "launch-main" }, h("div", { class: "prod", text: x.namn }), h("div", { class: "sub", text: [styleKategori(x), (x.farger || []).join(", "), x.leverantor].filter(Boolean).join(" · ") })),
          h("div", { class: "launch-chips" },
            eta ? chip(eta.key === "inne" ? "ts-ok" : eta.key === "sen" ? "ts-slut" : "ts-delvis-slut", eta.label) : chip("ts-utgatt", styleStatusNorm(x.status) === "Levererad" ? "Levererad" : "Ingen PO"),
            chip(["Publicerade", "Retuscherade", "Fotade"].includes(foto) ? "ts-ok" : foto ? "ts-delvis-slut" : "ts-utgatt", foto ? "Foto: " + foto.toLowerCase() : "Foto ej planerat"),
            chip(x.ecomShopify ? "ts-ok" : "ts-utgatt", x.ecomShopify ? "I Shopify" : "Ej i Shopify")));
      };
      const dropCard = (d, members, date) => {
        const done = members.filter((x) => x.ecomShopify && ["Publicerade"].includes(x.ecomBilder || "")).length;
        const dd = date ? diffDays(date) : null;
        const card = h("section", { class: "card launch-card" + (dd != null && dd < 0 ? " past" : "") });
        card.append(h("div", { class: "card-head", style: d._id ? "cursor:pointer" : "", onclick: () => { if (d._id) openDrop(d._id); } }, h("div", null, h("h3", { text: (d.namn || "Utan drop") + " · " + (d.sasong || "") }), h("span", { class: "sub", text: members.length + " produkter · " + done + " klara i Shopify" + (isISO(d.klartSenast) ? " · i lager senast " + fmtDate(d.klartSenast) : "") })),
          date ? h("div", { class: "launch-date" }, h("div", { class: "mono", text: fmtDate(date) }), h("div", { class: "days " + (dd < 0 ? "" : dd <= 14 ? "soon" : ""), text: dd < 0 ? "lanserad" : fmtDays(dd) })) : h("span", { class: "pill ts-utgatt", text: "Datum saknas" })));
        const ms = members.slice().sort((a, b) => (styleKategori(a) || "").localeCompare(styleKategori(b) || "", "sv") || (a.namn || "").localeCompare(b.namn || "", "sv"));
        card.append(h("div", { class: "launch-list" }, ms.length ? ms.map(prodRow) : h("p", { class: "hint", style: "padding:8px 16px", text: "Inga produkter kopplade till droppen än." })));
        return card;
      };
      const q = norm(st.q);
      const styles = D.styles.filter((x) => live(x) && (!st.season || norm(x.sasong) === norm(st.season)) && (!q || [x.namn, x.leverantor, x.drop, x.sasong, styleKategori(x)].join(" ").toLowerCase().includes(q)));
      const drops = D.drops.filter((d) => (!st.season || norm(d.sasong) === norm(st.season)));
      const months = []; let cur = t.slice(0, 7) + "-01"; for (let i = 0; i < 12; i++) { months.push(cur.slice(0, 7)); cur = addDays(cur, 32).slice(0, 7) + "-01"; }
      const manual = list.filter((e) => !e.auto);
      const out = [];
      const usedDrop = new Set();
      for (const m of months) {
        const ds = drops.filter((d) => isISO(d.lansering) && d.lansering.slice(0, 7) === m).sort((a, b) => a.lansering.localeCompare(b.lansering));
        const evs = manual.filter((e) => e.datum.slice(0, 7) === m);
        if (!ds.length && !evs.length) continue;
        out.push(h("h2", { class: "launch-month", text: monthLabel(m) }));
        for (const e of evs) out.push(h("div", { class: "launch-event", onclick: () => e.open && e.open() }, h("span", { class: "chip evt-" + e.typ, text: EV_TYP_LABEL[e.typ] || e.typ }), h("span", { class: "mono", text: fmtDate(e.datum) + (e.slut ? "–" + fmtDate(e.slut) : "") }), h("strong", { text: e.titel }), h("span", { class: "sub", text: e.agare || "" }), evPill(e)));
        for (const d of ds) { usedDrop.add(d._id); out.push(dropCard(d, styles.filter((x) => dropKey(x.sasong, x.drop) === dropKey(d.sasong, d.namn)), d.lansering)); }
      }
      const rest = drops.filter((d) => !usedDrop.has(d._id) && !(isISO(d.lansering) && d.lansering < t)).sort((a, b) => seasonRank(a.sasong) - seasonRank(b.sasong) || (a.namn || "").localeCompare(b.namn || "", "sv"));
      const restWith = rest.map((d) => [d, styles.filter((x) => dropKey(x.sasong, x.drop) === dropKey(d.sasong, d.namn))]).filter(([d, ms]) => ms.length);
      if (restWith.length) { out.push(h("h2", { class: "launch-month", text: "Utan lanseringsdatum" })); for (const [d, ms] of restWith) out.push(dropCard(d, ms, null)); }
      const loose = styles.filter((x) => !x.drop && !["Levererad"].includes(styleStatusNorm(x.status)));
      if (loose.length) { out.push(h("h2", { class: "launch-month", text: "Utan drop" })); out.push(dropCard({ _id: null, namn: "Utan drop", sasong: "" }, loose, null)); }
      if (!out.length) out.push(h("div", { class: "empty" }, h("strong", { text: "Inga lanseringar" }), h("span", { text: "Sätt lanseringsdatum på dropparna under Kollektion så dyker de upp här." })));
      return out;
    },
    timeline(list) {
      const card = h("section", { class: "card" });
      const t = todayISO();
      const start = t.slice(0, 7) + "-01";
      const months = []; let cur = start; for (let i = 0; i < 12; i++) { months.push(cur); cur = addDays(cur, 32).slice(0, 7) + "-01"; }
      const end = cur;
      const days = daysBetween(start, end);
      const W = 1100, L = 150, R = 16, top = 30, laneH = 22, pad = 8;
      const X = (iso) => L + (Math.max(0, Math.min(days, daysBetween(start, iso))) / days) * (W - L - R);
      const inWin = list.filter((e) => e.datum < end && (e.datum >= start || (e.slut && e.slut >= start) || isOverdue(e)));
      const rows = EV_TYP.map(([k, l]) => ({ k, l, items: inWin.filter((e) => e.typ === k).sort((a, b) => a.datum.localeCompare(b.datum)) }));
      // lanes: ett event per "spår" så att de inte överlappar
      const laneOf = (items) => { const ends = []; return items.map((e) => { const x0 = X(e.datum < start ? start : e.datum), x1 = Math.max(e.slut ? X(e.slut) : x0, x0 + 14 + Math.min(200, (e.titel || "").slice(0, 34).length * 6)) + 10; let li = ends.findIndex((v) => v < x0); if (li < 0) { li = ends.length; ends.push(x1); } else ends[li] = x1; return li; }); };
      let H = top;
      const rowTop = [];
      for (const r of rows) { r.lanes = laneOf(r.items); r.n = Math.max(1, ...r.lanes.map((x) => x + 1)); rowTop.push(H); r.y = H; H += pad + r.n * laneH + pad; }
      H += 14;
      const el = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "coo-tl", role: "img", "aria-label": "Tidslinje 12 månader" });
      months.forEach((m, i) => { el.append(svg("rect", { x: X(m), y: top - 6, width: X(i + 1 < months.length ? months[i + 1] : end) - X(m), height: H - top + 6, class: "mbg" + (i % 2 ? " alt" : "") })); el.append(svg("text", { x: X(m) + 5, y: top - 12, class: "lbl" }, monthLabel(m.slice(0, 7)))); });
      rows.forEach((r) => { el.append(svg("line", { x1: 0, x2: W, y1: r.y, y2: r.y, class: "grid" })); el.append(svg("text", { x: 0, y: r.y + 16, class: "lev evt-" + r.k }, r.l)); el.append(svg("text", { x: 0, y: r.y + 30, class: "sub" }, r.items.length ? r.items.length + " st" + (r.items.filter(isOverdue).length ? " · " + r.items.filter(isOverdue).length + " försenade" : "") : "")); });
      el.append(svg("line", { x1: X(t), x2: X(t), y1: top - 6, y2: H, class: "today" }));
      el.append(svg("text", { x: X(t) + 4, y: H - 3, class: "lbl today-l" }, "idag"));
      rows.forEach((r) => r.items.forEach((e, i) => {
        const y = r.y + pad + r.lanes[i] * laneH + laneH / 2;
        const late = isOverdue(e);
        const g = svg("g", { class: "ev evt-" + r.k + (late ? " late" : "") + (e.status === "Klar" ? " done" : "") + (e.auto ? " auto" : ""), style: "cursor:pointer" });
        g.append(svg("title", null, (e.titel || "") + " · " + fmtDate(e.datum) + (e.slut ? "–" + fmtDate(e.slut) : "") + " · " + (e.agare || "") + " · " + (late ? "FÖRSENAD" : e.status || "") + (e.auto ? " · automatisk från " + (e.poId ? "PO" : e.styleId ? "style" : "drop") : "")));
        const x0 = X(e.datum < start ? start : e.datum);
        if (e.slut) { const x1 = X(e.slut > end ? end : e.slut); const bw = Math.max(6, x1 - x0); g.append(svg("rect", { x: x0, y: y - 7, width: bw, height: 14, rx: 2, class: "bar" })); if (bw > 90) g.append(svg("text", { x: x0 + 4, y: y + 4, class: "lab onbar" }, (e.titel || "").slice(0, Math.floor(bw / 6.5)))); else g.append(svg("text", { x: x0 + bw + 5, y: y + 4, class: "lab" }, (e.titel || "").slice(0, 34))); }
        else { g.append(svg("circle", { cx: x0, cy: y, r: 5, class: e.auto ? "dot auto" : "dot" })); g.append(svg("text", { x: x0 + 9, y: y + 4, class: "lab" }, (e.titel || "").slice(0, 34) + ((e.titel || "").length > 34 ? "…" : ""))); }
        g.addEventListener("click", () => e.open && e.open());
        el.append(g);
      }));
      card.append(h("div", { class: "card-head" }, h("h3", { text: "Tidslinje 12 månader" }), h("span", { class: "sub", text: inWin.length + " händelser · " + inWin.filter(isOverdue).length + " försenade · klicka på en händelse för källan" })), h("div", { class: "tl-wrap" }, el),
        h("div", { class: "tl-legend", style: "padding:0 16px 12px" }, h("span", null, h("i", { class: "dotc", style: "background:var(--ink)" }), " manuell"), h("span", null, h("i", { class: "dotc ant" }), " automatisk från PLM"), h("span", null, h("i", { class: "dotc", style: "background:var(--late)" }), " försenad")));
      return card;
    },
    listCard(items, title, sub) {
      const card = h("section", { class: "card" });
      const sorted = items.slice().sort((a, b) => (isOverdue(b) - isOverdue(a)) || a.datum.localeCompare(b.datum));
      card.append(h("div", { class: "card-head" }, h("h3", { text: title }), h("span", { class: "sub", text: sorted.length + " händelser" + (sub ? " · " + sub : "") })));
      if (!sorted.length) { card.append(h("p", { class: "hint", style: "padding:12px 16px", text: "Inget här." })); return card; }
      const { t, tb } = table([["Datum"], ["Händelse"], ["Typ"], ["Ägare"], ["Säsong"], ["Status"], [""]]);
      for (const e of sorted) {
        const d = diffDays(e.datum);
        const ro = !canWrite || !db;
        const cb = e.auto ? null : h("input", { type: "checkbox", checked: e.status === "Klar", disabled: ro, "aria-label": "Klar", onchange: async () => { await write("handelser", e._id, { status: cb.checked ? "Klar" : "Planerad", andrad: new Date().toISOString() }); } });
        tb.append(h("tr", { tabIndex: 0, class: isOverdue(e) ? "ev-late" : null, dataset: { ev: e.key || e._id } },
          td("Datum", "mono", fmtDate(e.datum) + (e.slut ? "–" + fmtDate(e.slut) : ""), h("div", { class: "days " + (d < 0 && e.status !== "Klar" ? "late" : d <= 7 ? "soon" : ""), text: e.status === "Klar" ? "" : fmtDays(d) })),
          td("", "c-main", h("div", { class: "prod", text: e.titel || "" }), h("div", { class: "sub", text: [e.drop, e.auto ? "automatisk" : "", e.kommentar].filter(Boolean).join(" · ") })),
          td("Typ", null, h("span", { class: "chip evt-" + e.typ, text: EV_TYP_LABEL[e.typ] || e.typ })),
          td("Ägare", null, e.agare || "–"),
          td("Säsong", "mono", e.sasong || ""),
          td("Status", null, evPill(e)),
          td("", null, cb ? h("label", { class: "checkline" }, cb, "Klar") : h("button", { class: "linkish", type: "button", text: "Öppna källa", onclick: (ev) => { ev.stopPropagation(); e.open && e.open(); } }))));
      }
      tb.addEventListener("click", (ev) => { if (ev.target.closest("input, label, button")) return; const tr = ev.target.closest("tr[data-ev]"); if (!tr) return; const e = sorted.find((x) => (x.key || x._id) === tr.dataset.ev); if (e && e.open) e.open(); });
      card.append(h("div", { class: "ledger-wrap" }, t));
      return card;
    }
  };
  const EV_LABELS = { titel: "Titel", typ: "Typ", datum: "Datum", slut: "Slut", agare: "Ägare", status: "Status", sasong: "Säsong", drop: "Drop", poId: "PO", styleId: "Style", kommentar: "Kommentar" };
  function openEvent(id, preset) {
    const isNew = !id;
    const e = isNew ? Object.assign({ _id: null, typ: "massor", status: "Planerad", datum: todayISO(), logg: [] }, preset || {}) : byId(D.handelser, id);
    if (!e) { toast("Hittar inte händelsen."); return; }
    const ro = !canWrite || !db;
    const fTitel = inp("f_etitel", e.titel, { placeholder: "t.ex. Pitti Uomo, Momsdeklaration, Flytt till Söder Mälarstrand" });
    const fTyp = selectEl("f_etyp", EV_TYP, e.typ || "massor");
    const fDatum = inp("f_edatum", e.datum, { type: "date" });
    const fSlut = inp("f_eslut", e.slut, { type: "date" });
    const fAgare = inp("f_eagare", e.agare || EV_OWNER_DEFAULT[e.typ] || "", { list: "dlAgare", autocomplete: "off" });
    const fStatus = selectEl("f_estatus", EV_STATUS, e.status || "Planerad");
    const fSas = inp("f_esas", e.sasong, { list: "dlSeason", autocomplete: "off" });
    const fDrop = inp("f_edrop", e.drop, { list: "dlDrop", autocomplete: "off" });
    const fPo = selectEl("f_epo", [["", "– ingen –"]].concat(D.po.filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status))).map((p) => [p._id, (p.nr || p._id) + " · " + (p.leverantor || "")])), e.poId || "");
    const fStyle = selectEl("f_estyle", [["", "– ingen –"]].concat(D.styles.filter((x) => !x.grund && styleStatusNorm(x.status) !== "Kastad").sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv")).map((x) => [x._id, x.namn + (x.sasong ? " · " + x.sasong : "")])), e.styleId || "");
    const fKom = area("f_ekom", e.kommentar);
    fTyp.addEventListener("change", () => { if (!fAgare.value.trim() || AGARE.includes(fAgare.value.trim())) fAgare.value = EV_OWNER_DEFAULT[fTyp.value] || ""; });
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (ev) => ev.preventDefault() },
      field("Titel", fTitel, { full: true }), field("Typ", fTyp), field("Ägare", fAgare),
      field("Datum", fDatum), field("Slut (om period)", fSlut, { hint: "Tomt = en dag" }),
      field("Status", fStatus), field("Säsong", fSas), field("Drop", fDrop), h("div"),
      field("Koppla till PO", fPo), field("Koppla till style", fStyle),
      field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);
    const logUl = h("ul", { class: "log" });
    async function save() {
      const o = { titel: fTitel.value.trim(), typ: fTyp.value, datum: fDatum.value || null, slut: fSlut.value || null, agare: fAgare.value.trim(), status: fStatus.value, sasong: fSas.value.trim(), drop: fDrop.value.trim(), poId: fPo.value || null, styleId: fStyle.value || null, kommentar: fKom.value.trim() };
      if (!o.titel) { toast("Ge händelsen en titel."); fTitel.focus(); return; }
      if (!o.datum) { toast("Sätt ett datum."); fDatum.focus(); return; }
      if (o.slut && o.slut < o.datum) { toast("Slutdatum ligger före startdatum."); return; }
      const now = new Date().toISOString();
      if (isNew) {
        const nid = await freshId("handelser", D.handelser, "H", 3);
        const body = Object.assign({ id: nid, logg: [logEntry("Händelse skapad")], andrad: now }, o);
        if (await create("handelser", nid, body)) { if (!byId(D.handelser, nid)) D.handelser.push(Object.assign({}, body, { _id: nid })); toast("Sparad"); closeSheet(); }
      } else {
        const changes = describeChanges(e, o, EV_LABELS);
        if (!changes.length) { closeSheet(); return; }
        if (await write("handelser", e._id, Object.assign({}, o, { andrad: now, logg: (e.logg || []).concat(changes.map(logEntry)) }))) { toast("Sparat"); closeSheet(); }
      }
    }
    const body = [form];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl));
    openSheet({ tag: isNew ? "Ny" : EV_TYP_LABEL[e.typ] || e._id, title: isNew ? "Ny händelse" : e.titel, sub: isNew ? "" : [fmtDate(e.datum) + (e.slut ? "–" + fmtDate(e.slut) : ""), e.agare, e.sasong].filter(Boolean).join(" · "), body, foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("handelser", e._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: true, onSave: save }), ctx: { refresh: () => { if (!isNew && !byId(D.handelser, e._id)) { closeSheet(); return; } if (!isNew) renderLogInto(logUl, (byId(D.handelser, e._id) || e).logg); } }, focus: isNew ? "f_etitel" : null });
    if (!isNew) renderLogInto(logUl, e.logg);
  }

  // ---------- LEVERANTÖRER ----------
  const svg = (tag, attrs, ...kids) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, String(v)); for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
  const monthKey = (iso) => iso.slice(0, 7);
  const monthLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return MONTHS[m - 1] + (m === 1 || ym === monthKey(todayISO()) ? " " + String(y).slice(2) : ""); };
  // Lista över de betalningar (POs) som bygger upp en summa i betalningsmatrisen
  function openPayList(xs) {
    const sum = xs.reduce((a, x) => a + x.belopp, 0);
    const { t, tb } = table([["Förfaller"], ["PO"], ["Del"], ["Belopp", "num"], ["I valuta", "num"], ["Status"]]);
    for (const x of xs.slice().sort((a, b) => (a.datum || "").localeCompare(b.datum || ""))) {
      tb.append(h("tr", { tabIndex: 0, style: "cursor:pointer", onclick: () => openPo(x.po._id) },
        td("Förfaller", "mono", x.datum ? fmtDate(x.datum) : "–"),
        td("PO", "c-main", h("div", { class: "prod", text: x.po.nr || x.po._id }), h("div", { class: "sub", text: [x.po.sasong, x.po.drop].filter(Boolean).join(" ") })),
        td("Del", null, x.typ, x.kalla === "antagande" ? h("div", { class: "sub", text: "villkor saknas – antaget" }) : null),
        td("Belopp", "num", fmtSEK(x.belopp)),
        td("I valuta", "num", x.valuta && x.valuta !== "SEK" ? fmtCur(x.beloppValuta, x.valuta) : "–"),
        td("Status", null, poStatusPill(x.po))));
    }
    openSheet({ tag: xs[0].po.leverantor || "", title: fmtTkr(sum), sub: xs.length + " betalningar · klicka på en rad för PO:n", body: [h("div", { class: "ledger-wrap" }, t)], foot: footButtons({ onSave: null }) });
  }
  const LevView = {
    mount(root) {
      const { t, tb } = table([["Leverantör"], ["Valuta"], ["Betalningsvillkor"], ["Ledtider"], ["Öppna POs"], ["Obetalt", "num"], ["Kontakt"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { if (e.target.closest("button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openLev(tr.dataset.id); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const tr = e.target.closest("tr[data-id]"); if (tr) openLev(tr.dataset.id); });
      this.sUtv = inp("set_utv", "", { type: "number", min: "0", step: "1" });
      this.sFrakt = inp("set_frakt", "", { type: "number", min: "0", step: "1" });
      this.sGul = inp("set_gul", "", { type: "number", min: "0", step: "1" });
      this.sRisk = inp("set_risk", "", { type: "number", min: "0", max: "50", step: "1" });
      const saveSettings = async (patch, msg) => { if (!db) return; try { await db.doc("installningar/app").set(Object.assign({}, D.settings, patch, { andrad: new Date().toISOString() })); toast(msg); } catch (e) { writeError(e); } };
      const saveBtn = h("button", { class: "btn small", type: "button", text: "Spara regler", onclick: () => saveSettings({ utvarderingDagar: num(this.sUtv.value) ?? 7, standardFrakt: num(this.sFrakt.value) ?? 7, marginalGul: num(this.sGul.value) ?? 14, valutarisk: num(this.sRisk.value) ?? 10 }, "Reglerna sparade") });
      this.fxIn = {}; CURS.forEach((c) => { this.fxIn[c] = inp("fx_" + c, "", { type: "number", min: "0", step: "0.0001", inputmode: "decimal" }); });
      const fxBtn = h("button", { class: "btn small", type: "button", text: "Spara kurser", onclick: () => { const k = {}; CURS.forEach((c) => { const v = num(this.fxIn[c].value); if (v) k[c] = v; }); saveSettings({ kurser: k, kurserDatum: todayISO() }, "Kurser sparade"); } });
      this.fxNote = h("span", { class: "sub" });
      this.settings = h("section", { class: "panel" }, h("h3", { class: "sec-title", text: "Valutakurser (SEK per enhet) och planeringsregler" }),
        h("div", { class: "form three" }, field("EUR", this.fxIn.EUR), field("GBP", this.fxIn.GBP), field("JPY", this.fxIn.JPY, { hint: "SEK per 1 JPY, t.ex. 0,0657" })),
        h("div", { class: "form three" }, field("Utvärdering (dagar)", this.sUtv, { hint: "Tid från sample inne till beslut" }), field("Standardfrakt (dagar)", this.sFrakt, { hint: "Används när leverantören saknar frakt" }), field("Gult läge under (dagar)", this.sGul, { hint: "Marginal innan en style blir röd" })),
        h("div", { class: "form three" }, field("Valutastress i GM1 (%)", this.sRisk, { hint: "Hur mycket SEK antas försvagas mot leverantörens valuta i stresstestet av prismarginalerna (E-com)" })),
        canWrite && db ? h("div", { class: "quick" }, fxBtn, saveBtn, this.fxNote) : this.fxNote);
      if (!canWrite || !db) [this.sUtv, this.sFrakt, this.sGul, this.sRisk].concat(Object.values(this.fxIn)).forEach((x) => (x.disabled = true));
      this.expo = h("section", { class: "strip", "aria-label": "Valutaexponering" });
      this.timeline = h("section", { class: "card" });
      this.upcoming = h("section", { class: "card" });
      UI.lev = UI.lev || { season: "" };
      this.fSeason = filterSelect("f_l_season", "Alla säsonger", UI.lev, "season", () => this.update());
      root.append(h("p", { class: "lede", text: "Betalningsschemat räknas från varje lagd PO och leverantörens villkor, i leverantörens valuta och i SEK till dagens kurs. Filtrera per säsong för att se vad AW26, SS27 eller AW27 kostar att betala, månad för månad." }),
        h("section", { class: "filters", "aria-label": "Filter" }, this.fSeason.el), this.expo, this.timeline, this.upcoming, h("section", { class: "ledger-wrap" }, t), this.settings);
    },
    update() {
      const std = num(D.settings.standardFrakt) ?? 7;
      const list = D.lev.slice().sort((a, b) => (LEV_TYP.indexOf(a.typ || "Producent") - LEV_TYP.indexOf(b.typ || "Producent")) || (a.namn || "").localeCompare(b.namn || "", "sv"));
      this.fSeason.fill(uniq(D.po.map(poSeason)).sort((a, b) => seasonRank(b) - seasonRank(a)));
      const season = UI.lev.season;
      const open = openPayments().filter((x) => !season || norm(poSeason(x.po)) === norm(season));
      this.tb.replaceChildren(...list.map((l) => {
        const a = actualLead(l.namn);
        const pos = D.po.filter((p) => norm(p.leverantor) === norm(l.namn) && PO_OPEN.includes(poStatusNorm(p.status)));
        const owed = open.filter((x) => norm(x.po.leverantor) === norm(l.namn));
        const owedSek = owed.reduce((s0, x) => s0 + x.belopp, 0);
        const d = (v) => (num(v) == null ? "–" : num(v) + " d");
        const vs = l.villkorStatus || (Array.isArray(l.villkor) && l.villkor.length ? "Bekräftade" : "Okända");
        return h("tr", { tabIndex: 0, dataset: { id: l._id } },
          td("", "c-main", h("div", { class: "prod", text: l.namn }), h("div", { class: "sub" }, chip(l.typ || "Producent"), l.kod ? h("span", { class: "mono", text: " " + l.kod }) : null)),
          td("Valuta", null, l.valuta || h("span", { class: "muted", text: "–" })),
          td("Betalningsvillkor", null, h("div", { text: termsText(l) || (l.villkorText || "") || "–" }), h("span", { class: "pill " + (vs === "Bekräftade" ? "ts-ok" : vs === "Att förhandla" ? "ts-delvis-slut" : "ts-utgatt"), text: vs })),
          td("Ledtider", null, h("div", { class: "sub", text: "Sample " + d(l.sampleLedtid) + (a ? " (snitt " + a.avg + ")" : "") + " · prod " + d(l.produktionstid) + " · frakt " + (num(l.frakt) == null ? std + " (std)" : num(l.frakt)) + " d" })),
          td("Öppna POs", "mono", String(pos.length)),
          td("Obetalt", "num", owedSek ? h("div", null, h("div", { text: fmtSEK(owedSek) }), l.valuta && l.valuta !== "SEK" ? h("div", { class: "sub", text: fmtCur(owedSek / (fx(l.valuta) || 1), l.valuta) }) : null) : h("span", { class: "muted", text: "–" })),
          td("Kontakt", null, l.kontakt || ""));
      }));
      const act = document.activeElement;
      if (![this.sUtv, this.sFrakt, this.sGul, this.sRisk].concat(Object.values(this.fxIn)).includes(act)) {
        this.sUtv.value = D.settings.utvarderingDagar ?? 7; this.sFrakt.value = D.settings.standardFrakt ?? 7; this.sGul.value = D.settings.marginalGul ?? 14; this.sRisk.value = D.settings.valutarisk ?? 10;
        CURS.forEach((c) => { this.fxIn[c].value = (D.settings.kurser || {})[c] ?? FX_DEFAULT[c]; });
      }
      this.fxNote.textContent = D.settings.kurserDatum ? "Kurser sparade " + fmtDate(D.settings.kurserDatum) : "Standardkurser (5 nov 2026) – spara era egna.";
      this.renderExposure(open); this.renderMatrix(open, season); this.renderUpcoming(open);
    },
    renderExposure(open) {
      const byCur = {};
      for (const x of open) { const c = x.valuta || "SEK"; byCur[c] = byCur[c] || { sek: 0, val: 0 }; byCur[c].sek += x.belopp; byCur[c].val += x.beloppValuta; }
      const total = open.reduce((a, x) => a + x.belopp, 0);
      const tiles = [h("div", { class: "tile", style: "cursor:default" }, h("span", { class: "n mono", text: fmtTkr(total) }), h("span", { class: "l", text: "Obetalt totalt (SEK)" }))];
      for (const c of ["EUR", "GBP", "JPY", "USD", "SEK"]) { const v = byCur[c]; if (!v || !v.sek) continue; tiles.push(h("div", { class: "tile", style: "cursor:default" }, h("span", { class: "n mono", text: c === "SEK" ? fmtTkr(v.sek) : fmtCur(v.val, c) }), h("span", { class: "l", text: c === "SEK" ? "i SEK (ingen valutarisk)" : "obetalt i " + c + " = " + fmtTkr(v.sek) + " · ±5 % = ±" + fmtTkr(v.sek * 0.05) }))); }
      this.expo.style.setProperty("--cols", String(tiles.length));
      this.expo.replaceChildren(...tiles);
    },
    // Betalningsschema som matris: leverantör × månad, summor i SEK (och valuta), totaler per rad och kolumn.
    renderMatrix(open, season) {
      const box = this.timeline; box.replaceChildren();
      const items = open.filter((x) => x.datum);
      const noDate = open.length - items.length;
      const m0 = todayISO().slice(0, 7);
      const past = items.filter((x) => x.datum.slice(0, 7) < m0);
      const months = []; let cur = m0 + "-01"; for (let i = 0; i < 12; i++) { months.push(cur.slice(0, 7)); cur = addDays(cur, 32).slice(0, 7) + "-01"; }
      const later = items.filter((x) => x.datum.slice(0, 7) > months[months.length - 1]);
      const cols = (past.length ? ["Förfallet"] : []).concat(months).concat(later.length ? ["Senare"] : []);
      const colOf = (x) => x.datum.slice(0, 7) < m0 ? "Förfallet" : x.datum.slice(0, 7) > months[months.length - 1] ? "Senare" : x.datum.slice(0, 7);
      const levs = uniq(items.map((x) => x.po.leverantor)).sort((a, b) => a.localeCompare(b, "sv"));
      box.append(h("div", { class: "card-head" }, h("h3", { text: "Betalningsschema" + (season ? " · " + season : " · alla säsonger") }), h("span", { class: "sub", text: items.length ? fmtTkr(items.reduce((a, x) => a + x.belopp, 0)) + " obetalt med datum · SEK till dagens kurs, valutabelopp under · klicka på en summa för PO:erna" + (noDate ? " · " + noDate + " betalningar utan datum (sätt orderdatum eller ex-factory på PO:n)" : "") : "Inga kommande betalningar med datum." })));
      if (!items.length) return;
      const { t, tb } = table([["Leverantör"]].concat(cols.map((c) => [c === "Förfallet" || c === "Senare" ? c : monthLabel(c), "num"])).concat([["Totalt", "num"]]));
      const colTot = {}; let grand = 0;
      const cell = (xs, cur0) => { if (!xs.length) return h("span", { class: "muted", text: "·" }); const sek = xs.reduce((a, x) => a + x.belopp, 0); const val = xs.reduce((a, x) => a + (x.beloppValuta || 0), 0); const ant = xs.some((x) => x.kalla === "antagande"); const b = h("button", { class: "linkish num", type: "button", title: xs.map((x) => (x.po.nr || x.po._id) + " · " + x.typ + " · " + fmtDate(x.datum) + " · " + fmtSEK(x.belopp)).join("\n"), onclick: () => { if (xs.length === 1) openPo(xs[0].po._id); else openPayList(xs); } }, h("div", { class: "mono", text: fmtTkr(sek) }), cur0 && cur0 !== "SEK" ? h("div", { class: "sub", text: fmtCur(val, cur0) }) : null, ant ? h("div", { class: "sub", text: "antaget" }) : null); return b; };
      for (const lv of levs) {
        const mine = items.filter((x) => x.po.leverantor === lv); const cur0 = mine[0].valuta; const sum = mine.reduce((a, x) => a + x.belopp, 0); grand += sum;
        const tr = h("tr", null, td("", "c-main", h("div", { class: "prod", text: lv }), h("div", { class: "sub", text: (cur0 || "SEK") + " · " + mine.length + " betalningar" })));
        for (const c of cols) { const xs = mine.filter((x) => colOf(x) === c); colTot[c] = (colTot[c] || 0) + xs.reduce((a, x) => a + x.belopp, 0); tr.append(td("", "num" + (c === "Förfallet" && xs.length ? " late-text" : ""), cell(xs, cur0))); }
        tr.append(td("Totalt", "num", h("b", { text: fmtTkr(sum) }), cur0 && cur0 !== "SEK" ? h("div", { class: "sub", text: fmtCur(mine.reduce((a, x) => a + (x.beloppValuta || 0), 0), cur0) }) : null));
        tb.append(tr);
      }
      const tot = h("tr", { class: "tot-row" }, td("", "c-main", h("b", { text: "Totalt SEK" })));
      for (const c of cols) tot.append(td("", "num", h("b", { text: colTot[c] ? fmtTkr(colTot[c]) : "·" })));
      tot.append(td("Totalt", "num", h("b", { text: fmtTkr(grand) })));
      tb.append(tot);
      box.append(h("div", { class: "ledger-wrap" }, t));
    },
    renderTimelineOld(open) {
      const box = this.timeline; box.replaceChildren();
      const items = open.filter((x) => x.datum);
      const noDate = open.length - items.length;
      box.append(h("div", { class: "card-head" }, h("h3", { text: "Betalningsschema per leverantör" }), h("span", { class: "sub", text: items.length ? items.length + " kommande betalningar · cirkelns storlek = belopp · klicka för PO:n" + (noDate ? " · " + noDate + " utan datum (sätt orderdatum eller ex-factory på PO:n)" : "") : "Inga kommande betalningar med datum." })));
      if (!items.length) return;
      const levs = uniq(items.map((x) => x.po.leverantor));
      const start = addDays(todayISO().slice(0, 7) + "-01", -31).slice(0, 7) + "-01";
      let endMax = items.map((x) => x.datum).sort().pop();
      const minEnd = addDays(todayISO(), 240); if (endMax < minEnd) endMax = minEnd;
      const end = addDays(endMax.slice(0, 7) + "-01", 40).slice(0, 7) + "-01";
      const days = daysBetween(start, end);
      const W = 1000, L = 170, R = 20, rowH = 36, top = 28;
      const H = top + levs.length * rowH + 10;
      const X = (iso) => L + (daysBetween(start, iso) / days) * (W - L - R);
      const el = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "pay-tl", role: "img", "aria-label": "Betalningsschema" });
      // month grid
      let cur = start;
      while (cur < end) { const next = addDays(cur.slice(0, 7) + "-01", 32).slice(0, 7) + "-01"; el.append(svg("line", { x1: X(cur), x2: X(cur), y1: top - 6, y2: H, class: "grid" })); el.append(svg("text", { x: X(cur) + 4, y: top - 10, class: "lbl" }, monthLabel(cur.slice(0, 7)))); cur = next; }
      el.append(svg("line", { x1: X(todayISO()), x2: X(todayISO()), y1: top - 6, y2: H, class: "today" }));
      el.append(svg("text", { x: X(todayISO()) + 4, y: H - 2, class: "lbl today-l" }, "idag"));
      const maxSek = Math.max(...items.map((x) => x.belopp), 1);
      levs.forEach((lv, i) => {
        const y = top + i * rowH + rowH / 2;
        el.append(svg("line", { x1: L, x2: W - R, y1: y, y2: y, class: "row" }));
        const mine = items.filter((x) => x.po.leverantor === lv);
        const sum = mine.reduce((a, x) => a + x.belopp, 0);
        el.append(svg("text", { x: 0, y: y - 2, class: "lev" }, lv));
        el.append(svg("text", { x: 0, y: y + 12, class: "sub" }, fmtTkr(sum) + (mine[0].valuta !== "SEK" ? " · " + mine[0].valuta : "")));
        mine.forEach((x, j) => {
          const r = 5 + Math.sqrt(x.belopp / maxSek) * 13;
          const g = svg("g", { class: "pay cur-" + (x.valuta || "SEK") + (x.kalla === "antagande" ? " ant" : ""), style: "cursor:pointer" });
          g.append(svg("title", null, (x.po.nr || x.po._id) + " · " + x.typ + " · " + fmtSEK(x.belopp) + (x.valuta !== "SEK" ? " (" + fmtCur(x.beloppValuta, x.valuta) + ")" : "") + " · " + fmtDate(x.datum) + (x.kalla === "antagande" ? " · villkor saknas, antaget 100 % vid leverans" : "")));
          g.append(svg("circle", { cx: X(x.datum), cy: y + (j % 2 ? 4 : -4), r }));
          if (r > 10) g.append(svg("text", { x: X(x.datum), y: y + (j % 2 ? 4 : -4) + 3, class: "amt", "text-anchor": "middle" }, fmtTkr(x.belopp).replace(" tkr", "")));
          g.addEventListener("click", () => openPo(x.po._id));
          el.append(g);
        });
      });
      box.append(h("div", { class: "tl-wrap" }, el), h("div", { class: "tl-legend", style: "padding:0 16px 12px" }, ["EUR", "GBP", "JPY", "SEK"].map((c) => h("span", null, h("i", { class: "dotc cur-" + c }), " " + c)), h("span", null, h("i", { class: "dotc ant" }), " villkor saknas – antaget vid leverans")));
    },
    renderMonths(open) {
      const box = this.months; box.replaceChildren();
      const items = open.filter((x) => x.datum);
      box.append(h("div", { class: "card-head" }, h("h3", { text: "Utbetalningar per månad" }), h("span", { class: "sub", text: "Obetalda betalningar i SEK till dagens kurs, staplade per valuta" })));
      if (!items.length) return;
      const m0 = todayISO().slice(0, 7);
      const months = []; let cur = m0 + "-01"; for (let i = 0; i < 12; i++) { months.push(cur.slice(0, 7)); cur = addDays(cur, 32).slice(0, 7) + "-01"; }
      const past = items.filter((x) => x.datum.slice(0, 7) < m0).reduce((a, x) => a + x.belopp, 0);
      const data = months.map((ym) => { const mine = items.filter((x) => x.datum.slice(0, 7) === ym); const byCur = {}; for (const x of mine) byCur[x.valuta || "SEK"] = (byCur[x.valuta || "SEK"] || 0) + x.belopp; return { ym, byCur, tot: mine.reduce((a, x) => a + x.belopp, 0) }; });
      if (past) data[0].byCur.Förfallet = past, data[0].tot += past;
      const maxV = Math.max(...data.map((d) => d.tot), 1);
      const W = 1000, H = 220, L = 10, B = 30, T = 26, bw = (W - 2 * L) / months.length;
      const el = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "pay-bars", role: "img", "aria-label": "Utbetalningar per månad" });
      data.forEach((d, i) => {
        let y = H - B; const x0 = L + i * bw + bw * 0.15, w = bw * 0.7;
        for (const [c, v] of Object.entries(d.byCur).sort((a, b) => b[1] - a[1])) { const hgt = (v / maxV) * (H - B - T); y -= hgt; el.append(svg("rect", { x: x0, y, width: w, height: hgt, class: "bar cur-" + (c === "Förfallet" ? "late" : c) }, svg("title", null, monthLabel(d.ym) + " · " + c + " " + fmtTkr(v)))); }
        if (d.tot) el.append(svg("text", { x: x0 + w / 2, y: y - 6, class: "lbl", "text-anchor": "middle" }, fmtTkr(d.tot)));
        el.append(svg("text", { x: x0 + w / 2, y: H - 10, class: "lbl", "text-anchor": "middle" }, monthLabel(d.ym)));
      });
      box.append(h("div", { class: "tl-wrap" }, el));
    },
    renderUpcoming(open) {
      const box = this.upcoming; box.replaceChildren();
      const lim = addDays(todayISO(), 120);
      const items = open.filter((x) => !x.datum || x.datum <= lim);
      box.append(h("div", { class: "card-head" }, h("h3", { text: "Att betala inom 120 dagar" }), h("span", { class: "sub", text: items.length ? fmtTkr(items.reduce((a, x) => a + x.belopp, 0)) + " · bocka av när betalningen är gjord" : "Inget att betala inom 120 dagar." })));
      if (!items.length) return;
      const { t, tb } = table([["Förfaller"], ["PO"], ["Leverantör"], ["Del"], ["Belopp", "num"], ["I valuta", "num"], ["Betald"]]);
      for (const x of items) {
        const d = x.datum ? diffDays(x.datum) : null;
        const cb = h("input", { type: "checkbox", disabled: !canWrite || !db, onchange: async () => {
          if (x.kalla === "manuell") { await write("po", x.po._id, x.idx === "f" ? { forskottBetald: cb.checked } : { slutBetald: cb.checked }); return; }
          const bet = Object.assign({}, x.po.betalningar || {}); bet[x.idx] = { betald: cb.checked, datum: cb.checked ? todayISO() : null, av: myId };
          await write("po", x.po._id, { betalningar: bet, andrad: new Date().toISOString(), logg: (x.po.logg || []).concat(logEntry((cb.checked ? "Betald: " : "Markerad obetald: ") + x.typ + " " + fmtSEK(x.belopp))) });
        } });
        tb.append(h("tr", { tabIndex: 0, dataset: { po: x.po._id } },
          td("Förfaller", "mono", x.datum ? fmtDate(x.datum) : h("span", { class: "flag", text: "datum saknas" }), d != null ? h("div", { class: "days " + (d < 0 ? "late" : d <= 14 ? "soon" : ""), text: fmtDays(d) }) : null, x.datumKalla ? h("div", { class: "sub", text: x.datumKalla }) : null),
          td("PO", "c-main", h("div", { class: "prod", text: x.po.nr || x.po._id }), h("div", { class: "sub" }, poStatusPill(x.po), " " + [x.po.sasong, x.po.drop].filter(Boolean).join(" "))),
          td("Leverantör", null, x.po.leverantor || ""),
          td("Del", null, x.typ, x.kalla === "antagande" ? h("div", { class: "sub", text: "villkor saknas – antaget" }) : null),
          td("Belopp", "num", fmtSEK(x.belopp)),
          td("I valuta", "num", x.valuta !== "SEK" ? fmtCur(x.beloppValuta, x.valuta) : "–"),
          td("Betald", null, h("label", { class: "checkline" }, cb, "Betald"))));
      }
      tb.addEventListener("click", (e) => { if (e.target.closest("input, label, button")) return; const tr = e.target.closest("tr[data-po]"); if (tr) openPo(tr.dataset.po); });
      box.append(h("div", { class: "ledger-wrap" }, t));
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
  // ---------- BIBLIOTEK (styles och idéer) ----------
  const LibView = {
    mount(root) {
      const st = UI.bibliotek;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "ideer", label: "Produktidéer" },
        { key: "hosAlex", label: "Hos Alex för sampling", cls: "t-warn" },
        { key: "sampling", label: "Under sampling" },
        { key: "godkanda", label: "Godkända" },
        { key: "produktion", label: "I produktion / levererade" },
        { key: "utanBild", label: "Utan bild", cls: "t-warn" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_lib", "Sök style, idé, tyg, leverantör …", st, () => this.update());
      this.fSeason = filterSelect("f_l_season", "Alla säsonger", st, "season", upd);
      this.fKat = filterSelect("f_l_kat", "Alla kategorier", st, "kat", upd);
      this.fLev = filterSelect("f_l_lev", "Alla leverantörer", st, "lev", upd);
      this.seg = makeSeg([["alla", "Allt"], ["ideer", "Idéer"], ["aktiva", "Sampling & godkända"], ["klara", "I produktion"], ["arkiv", "Pausade & kastade"]], st, "status", upd);
      this.segMode = makeSeg([["styles", "Per säsong"], ["grund", "Grundstyles"]], st, "mode", upd);
      this.count = h("span", { class: "count" });
      this.body = h("div", { style: "display:grid;gap:26px" });
      root.append(h("p", { class: "lede", text: "Alla styles och produktidéer på ett ställe – även innan en sample är beställd. Skapa en idé med beskrivning, tyg, mått och bilder och skicka den till Alex. En grundstyle (t.ex. Roper Shirt) återanvänds i flera kollektioner via varianter." }),
        this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fSeason.el, this.fKat.el, this.fLev.el, this.seg.el, this.segMode.el, this.count), this.body);
    },
    filtered() {
      const st = UI.bibliotek, q = norm(st.q);
      return D.styles.filter((s) => {
        const ss = styleStatusNorm(s.status);
        switch (st.view) {
          case "ideer": if (ss !== "Produktidé") return false; break;
          case "hosAlex": if (ss !== "Idé under utveckling") return false; break;
          case "sampling": if (ss !== "Sampling") return false; break;
          case "godkanda": if (ss !== "Godkänd") return false; break;
          case "produktion": if (!PROD_STATUS.includes(ss)) return false; break;
          case "utanBild": if (styleImage(s) || ["Kastad", "Pausad"].includes(ss)) return false; break;
          default:
            if (st.status === "ideer" && !IDEA_STATUS.includes(ss)) return false;
            if (st.status === "aktiva" && !["Sampling", "Godkänd"].includes(ss)) return false;
            if (st.status === "klara" && !PROD_STATUS.includes(ss)) return false;
            if (st.status === "arkiv" && !["Pausad", "Kastad"].includes(ss)) return false;
            if (st.status === "alla" && ss === "Kastad") return false;
        }
        if (st.season && (s.sasong || "Utan säsong") !== st.season) return false;
        if (st.kat && styleKategori(s) !== st.kat) return false;
        if (st.lev && s.leverantor !== st.lev) return false;
        if (q && ![s._id, s.namn, s.beskrivning, s.leverantor, s.sasong, s.drop, styleKategori(s), styleTyg(s), (s.farger || []).join(" "), ss, grundOf(s) ? grundOf(s).namn : "", s.referenser].join(" ").toLowerCase().includes(q)) return false;
        return true;
      });
    },
    update() {
      const st = UI.bibliotek;
      const seasons = uniq(D.styles.map((s) => s.sasong)).sort((a, b) => seasonRank(b) - seasonRank(a) || b.localeCompare(a, "sv"));
      if (D.styles.some((s) => !s.sasong)) seasons.push("Utan säsong");
      this.fSeason.fill(seasons); this.fKat.fill(KATEGORIER); this.fLev.fill(uniq(D.styles.map((s) => s.leverantor)));
      this.seg.sync(); this.segMode.sync();
      const S = (x) => styleStatusNorm(x.status);
      this.strip.set({ ideer: D.styles.filter((s) => S(s) === "Produktidé" && !s.grund).length, hosAlex: D.styles.filter((s) => S(s) === "Idé under utveckling").length, sampling: D.styles.filter((s) => S(s) === "Sampling").length, godkanda: D.styles.filter((s) => S(s) === "Godkänd").length, produktion: D.styles.filter((s) => PROD_STATUS.includes(S(s))).length, utanBild: D.styles.filter((s) => !styleImage(s) && !["Kastad", "Pausad"].includes(S(s))).length });
      const list = this.filtered();
      this.body.replaceChildren();
      if (st.mode === "grund" && !st.view) {
        const gs = grundStyles().filter((g) => list.includes(g) || variantsOf(g._id).some((v) => list.includes(v)));
        const loose = list.filter((s) => !s.grund && !grundOf(s));
        const sec = h("section", { class: "lib-sec" }, h("div", { class: "lib-h" }, h("h3", { text: "Grundstyles" }), h("span", { class: "sub", text: gs.length + (gs.length === 1 ? " grundstyle" : " grundstyles") + " · " + loose.length + " styles utan grundstyle" })));
        if (!gs.length) sec.append(h("p", { class: "hint", text: "Inga grundstyles ännu. Öppna en style och bocka i \"Detta är en grundstyle\", eller skapa en ny med \"+ Ny grundstyle\"." }));
        else sec.append(h("div", { class: "cards" }, gs.map((g) => this.grundCard(g, list))));
        this.body.append(sec);
        if (loose.length) {
          const sec2 = h("section", { class: "lib-sec" }, h("div", { class: "lib-h" }, h("h3", { text: "Utan grundstyle" }), h("span", { class: "sub", text: "Öppna en style och välj \"Variant av grundstyle\" för att koppla den." })), h("div", { class: "pgrid" }, loose.sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv")).map((s) => KollView.card(s))));
          this.body.append(sec2);
        }
        this.count.textContent = list.length + " styles";
        return;
      }
      const groups = new Map();
      for (const s of list) { const k = s.sasong || "Utan säsong"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
      const keys = [...groups.keys()].sort((a, b) => (a === "Utan säsong") - (b === "Utan säsong") || seasonRank(b) - seasonRank(a) || b.localeCompare(a, "sv"));
      const order = { "Produktidé": 0, "Idé under utveckling": 1, Sampling: 2, "Godkänd": 3, "PO lagd": 4, "I produktion": 5, Levererad: 6, Pausad: 7, Kastad: 8 };
      for (const k of keys) {
        const items = groups.get(k).sort((a, b) => (order[S(a)] ?? 9) - (order[S(b)] ?? 9) || (a.namn || "").localeCompare(b.namn || "", "sv"));
        const nI = items.filter((s) => isIdea(s) && !s.grund).length;
        this.body.append(h("section", { class: "lib-sec" }, h("div", { class: "lib-h" }, h("h3", { text: k }), h("span", { class: "sub", text: items.length + (items.length === 1 ? " style" : " styles") + (nI ? " · " + nI + (nI === 1 ? " idé" : " idéer") : "") })), h("div", { class: "pgrid" }, items.map((s) => KollView.card(s)))));
      }
      if (!list.length) this.body.append(h("div", { class: "empty" }, h("strong", { text: loaded.has("styles") ? (D.styles.length ? "Inget matchar" : "Inga styles ännu") : "Laddar …" }), h("span", { text: "Skapa en produktidé med \"+ Ny produktidé\"." })));
      this.count.textContent = list.length + " av " + D.styles.length + " styles";
    },
    grundCard(g, list) {
      const img = styleImage(g) || variantsOf(g._id).map(styleImage).find(Boolean);
      const vs = variantsOf(g._id);
      const open = () => openStyle(g._id);
      return h("article", { class: "gcard" },
        h("div", { class: "gimg", onclick: open }, img ? h("img", { src: imgUrl(img), alt: g.namn, loading: "lazy" }) : h("span", { class: "noimg", text: "Ingen bild" })),
        h("div", { class: "gbody" },
          h("div", null, h("div", { class: "gname", onclick: open, text: g.namn }), h("div", { class: "sub", text: [styleKategori(g), g.leverantor, g.beskrivning].filter(Boolean).join(" · ") })),
          h("div", { class: "gvars" }, vs.length ? vs.map((v) => h("button", { class: "gvar", type: "button", onclick: () => openStyle(v._id) }, h("span", { style: "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, v.namn, h("span", { class: "sub", text: [styleTyg(v), (v.farger || []).join(", ")].filter(Boolean).map((x) => " · " + x).join("") })), h("span", { class: "sub mono", text: [v.sasong, v.drop].filter(Boolean).join(" ") || "–" }), styleStatusPill(v))) : h("p", { class: "hint", style: "margin:0", text: "Inga varianter ännu." })),
          canWrite && db ? h("div", null, h("button", { class: "btn small", type: "button", text: "+ Ny variant", onclick: () => openStyle(null, { grundId: g._id, namn: g.namn, kategori: g.kategori || "", leverantor: g.leverantor || "", storlekar: (g.storlekar || []).slice(), mattFran: g._id, status: "Produktidé", sasong: UI.bibliotek.season && UI.bibliotek.season !== "Utan säsong" ? UI.bibliotek.season : "" }) })) : null));
    }
  };

  // ---------- ANVÄNDARE (Elliot) ----------
  const roleDef = (key) => { const base = ROLE_DEFAULTS[key] || ROLE_DEFAULTS.ingen; const ov = (D.roller.roller || {})[key] || {}; let flikar = Array.isArray(ov.flikar) ? ov.flikar.slice() : base.flikar; if (Array.isArray(ov.flikar) && (num(ov.flikVersion) || 1) < 2) flikar = uniq(flikar.concat(NEW_TABS.filter((t) => base.flikar.includes(t)))); return { key, namn: base.namn, flikar, redigera: typeof ov.redigera === "boolean" ? ov.redigera : base.redigera, leverantor: !!base.leverantor, fast: !!base.fast }; };
  const userDoc = (id) => D.anvandare.find((a) => a._id === id) || null;
  const AnvView = {
    mount(root) {
      this.people = h("div");
      this.roles = h("div");
      this.search = h("div", { class: "people" });
      root.append(h("p", { class: "lede", text: "Vem ser vad. Alla loggar in med sitt Rubato-konto (Microsoft) och dyker upp här efter första besöket; här styr du vilken roll de får i appen och vilka flikar rollen ser. Admin (kan hantera användare) sätts i databasen av Jakob." }),
        h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: "Personer" }), h("span", { class: "sub", text: "Alla som öppnat appen eller fått en roll" })), this.search, this.people),
        h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: "Roller" }), h("span", { class: "sub", text: "Vilka flikar varje roll ser och om den får ändra" })), this.roles));
      this.renderSearch();
    },
    renderSearch() {
      if (!user || !canAdmin) { this.search.replaceChildren(); return; }
      const q = h("input", { type: "search", placeholder: "Lägg till person – sök på namn …", "aria-label": "Sök person", style: "width:100%;padding:8px 12px;border:0;border-bottom:1px solid var(--line);background:var(--surface)" });
      const hits = h("div", { class: "hits", hidden: true });
      const run = async () => {
        let ps = [];
        try { ps = await user.search(q.value); } catch (e) {}
        ps = ps.filter((p) => p.id !== myId);
        hits.replaceChildren(...ps.map((p) => h("button", { type: "button", onclick: async () => { hits.hidden = true; q.value = ""; await setRole(p.id, userDoc(p.id) ? userDoc(p.id).roll : "team"); } }, h("img", { class: "avatar", src: p.avatarUrl, alt: "" }), h("span", { text: p.name || "Någon" }), p.guest ? h("span", { class: "sub", text: "gäst" }) : null, userDoc(p.id) ? h("span", { class: "sub", text: "har redan roll: " + roleDef(userDoc(p.id).roll).namn }) : null)));
        if (!ps.length) hits.replaceChildren(h("span", { class: "hint", style: "padding:8px 12px", text: q.value ? "Ingen träff. Personen måste finnas i Rubatos Claude-organisation, eller öppna appen en gång efter att du delat den." : "Skriv ett namn." }));
        hits.hidden = false;
      };
      q.addEventListener("focus", run); q.addEventListener("input", run);
      q.addEventListener("blur", () => setTimeout(() => (hits.hidden = true), 200));
      this.search.replaceChildren(q, hits);
    },
    async update() {
      if (!canAdmin) { this.people.replaceChildren(h("p", { class: "hint", style: "padding:14px 16px", text: "Bara admin kan hantera användare." })); this.roles.replaceChildren(); return; }
      const ids = uniq(D.anvandare.map((a) => a._id).concat(D.narvaro.map((n) => n._id), myId ? [myId] : []));
      let ps = {};
      try { if (user && ids.length) ps = await user.profiles(ids); } catch (e) {}
      const { t, tb } = table([["Person"], ["Roll"], ["Leverantör"], ["Senast i appen"], [""]]);
      t.classList.add("users");
      const rows = ids.map((id) => ({ id, doc: userDoc(id), nar: D.narvaro.find((n) => n._id === id), p: ps[id] || { name: "", avatarUrl: "", guest: false } }));
      rows.sort((a, b) => (a.id === myId ? -1 : b.id === myId ? 1 : 0) || (!!b.doc - !!a.doc) || (a.p.name || "zz").localeCompare(b.p.name || "zz", "sv"));
      for (const r of rows) {
        const roll = r.doc ? r.doc.roll : "";
        const sel = selectEl("roll_" + r.id, [["", "– Ingen roll (standard: " + roleDef(D.roller.standardRoll || "team").namn + ")"]].concat(ROLE_ORDER.map((k) => [k, roleDef(k).namn])), roll);
        sel.addEventListener("change", () => setRole(r.id, sel.value, r.doc ? r.doc.leverantor : ""));
        const lev = inp("lev_" + r.id, r.doc ? r.doc.leverantor : "", { list: "dlLev", autocomplete: "off", placeholder: "För producent" });
        lev.disabled = roll !== "producent";
        lev.addEventListener("change", () => setRole(r.id, roll, lev.value.trim()));
        const seen = r.nar && r.nar.senast ? new Date(r.nar.senast) : null;
        tb.append(h("tr", null,
          td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:center" }, r.p.avatarUrl ? h("img", { class: "avatar", src: r.p.avatarUrl, alt: "" }) : null, h("div", null, h("div", { class: "prod", text: (r.p.name || "Okänd person") + (r.id === myId ? " (du)" : "") }), h("div", { class: "sub", text: [r.p.guest ? "Gäst utanför organisationen" : "", r.id === myId && canAdmin ? "Editor/ägare – full åtkomst oavsett roll" : ""].filter(Boolean).join(" · ") })))),
          td("Roll", null, sel),
          td("Leverantör", null, lev),
          td("Senast i appen", "mono", seen && !isNaN(seen) ? fmtDate(seen.toISOString().slice(0, 10)) + " " + String(seen.getHours()).padStart(2, "0") + ":" + String(seen.getMinutes()).padStart(2, "0") : h("span", { class: "muted", text: "–" })),
          td("", "num", r.doc ? h("button", { class: "btn small", type: "button", text: "Ta bort roll", onclick: async () => { if (await remove("anvandare", r.id)) toast("Rollen borttagen"); } }) : null)));
      }
      if (!rows.length) tb.append(h("tr", null, h("td", { colSpan: 5, class: "sub", text: "Ingen har öppnat appen ännu." })));
      const std = selectEl("std_roll", ROLE_ORDER.filter((k) => k !== "admin").map((k) => [k, roleDef(k).namn]), D.roller.standardRoll || "team");
      std.addEventListener("change", async () => { try { await db.doc("behorighet/roller").set(Object.assign({}, D.roller, { standardRoll: std.value, andrad: new Date().toISOString() })); toast("Standardroll sparad"); } catch (e) { writeError(e); } });
      this.people.replaceChildren(h("div", { class: "ledger-wrap" }, t), h("div", { class: "budget-foot", style: "padding:10px 16px;border-top:1px solid var(--line)" }, h("span", { text: "Medarbetare i organisationen utan tilldelad roll får:" }), std, h("span", { class: "sub", text: "Gäster utanför organisationen utan roll ser ingenting." })));
      this.renderRoles();
    },
    renderRoles() {
      const tbl = h("table", { class: "rolegrid" });
      tbl.append(h("thead", null, h("tr", null, h("th", { text: "Roll" }), TAB_DEFS.map(([k, l]) => h("th", { text: l })), h("th", { text: "Får ändra" }))));
      const tb = h("tbody");
      const state = {};
      for (const k of ROLE_ORDER) {
        const r = roleDef(k); state[k] = { flikar: r.flikar.slice(), redigera: r.redigera };
        const tr = h("tr", null, h("td", null, h("strong", { text: r.namn }), r.key === "admin" ? h("div", { class: "sub", text: "Editor/ägare i Claude" }) : r.key === "producent" ? h("div", { class: "sub", text: "Ser bara sin leverantörs POs" }) : r.key === "ingen" ? h("div", { class: "sub", text: "Standard för gäster" }) : null));
        for (const [tk] of TAB_DEFS) { const cb = h("input", { type: "checkbox" }); cb.checked = r.flikar.includes(tk); cb.disabled = r.fast; cb.addEventListener("change", () => { state[k].flikar = cb.checked ? uniq(state[k].flikar.concat([tk])) : state[k].flikar.filter((x) => x !== tk); }); tr.append(h("td", null, cb)); }
        const ed = h("input", { type: "checkbox" }); ed.checked = r.redigera; ed.disabled = r.fast; ed.addEventListener("change", () => (state[k].redigera = ed.checked)); tr.append(h("td", null, ed));
        tb.append(tr);
      }
      tbl.append(tb);
      const saveBtn = h("button", { class: "btn small primary", type: "button", text: "Spara roller", onclick: async () => { const roller = {}; for (const k of ROLE_ORDER) if (!ROLE_DEFAULTS[k].fast) roller[k] = Object.assign({ flikVersion: 2 }, state[k]); try { await db.doc("behorighet/roller").set(Object.assign({}, D.roller, { roller, andrad: new Date().toISOString() })); toast("Roller sparade"); } catch (e) { writeError(e); } } });
      this.roles.replaceChildren(h("div", { class: "ledger-wrap", style: "padding:6px 10px" }, tbl), h("div", { class: "budget-foot", style: "padding:10px 16px;border-top:1px solid var(--line)" }, saveBtn, h("span", { class: "sub", text: "Admin och Ingen åtkomst är fasta. Ändringar gäller direkt när personen laddar om appen." })));
    }
  };
  async function setRole(id, roll, leverantor) {
    if (!db || !id) return;
    try {
      if (!roll) { await db.collection("anvandare").doc(id).delete(); toast("Rollen borttagen"); return; }
      await db.collection("anvandare").doc(id).set({ roll, leverantor: roll === "producent" ? (leverantor || "") : "", andrad: new Date().toISOString(), av: myId });
      toast("Roll sparad: " + roleDef(roll).namn);
    } catch (e) { writeError(e); }
  }
  function computeAccess() {
    const doc = myId ? userDoc(myId) : null;
    let roll = canAdmin ? "admin" : doc && doc.roll ? doc.roll : (isGuest ? "ingen" : (D.roller.standardRoll || "team"));
    if (!myId && !canAdmin) roll = db ? (D.roller.standardRoll || "team") : "team";
    const r = roleDef(roll);
    ME.roll = roll; ME.flikar = r.flikar.slice(); ME.redigera = r.redigera; ME.leverantor = r.leverantor && doc ? (doc.leverantor || "") : "";
    if (canAdmin) ME.flikar = ALL_TABS.concat(["anvandare"]);
    canWrite = platformWrite && ME.redigera;
  }
  function applyAccess() {
    computeAccess();
    document.querySelectorAll("#tabs .tab").forEach((b) => { b.hidden = !ME.flikar.includes(b.dataset.tab) || b.dataset.tab === "ean"; b.classList.toggle("me", false); });
    if (UI.tab === "ean") UI.tab = ME.flikar.includes("ecom") ? "ecom" : ME.flikar[0];
    if (!ME.flikar.length) {
      $("view").replaceChildren(h("div", { class: "empty" }, h("strong", { text: "Du har ingen behörighet i appen än" }), h("span", { text: "Be Elliot ge dig en roll under Användare, så ser du rätt flikar nästa gång du laddar om." })));
      $("actions").replaceChildren();
      banner("");
      return;
    }
    if (!ME.flikar.includes(UI.tab)) switchTab(ME.flikar[0]); else renderActions();
    if (db && !canWrite) banner(platformWrite ? "Din roll (" + roleDef(ME.roll).namn + ") har läsbehörighet i appen." : "Du har läsbehörighet. Be Elliot om en roll som får redigera.");
    else banner("");
  }

  const VIEWS = { bibliotek: LibView, samples: SamplesView, ref: RefView, kollektion: KollView, produktion: ProdView, foto: FotoView, ecom: EcomView, shopify: ShopifyView, coo: CooView, tyglager: LagerView, leverantorer: LevView, ean: EanView, anvandare: AnvView };
  function switchTab(t) {
    if (!VIEWS[t]) t = "samples";
    if (ME.flikar.length && !ME.flikar.includes(t)) t = ME.flikar[0];
    UI.tab = t;
    document.querySelectorAll("#tabs .tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    const root = $("view"); root.replaceChildren(); root.className = "view-" + t;
    root.style.display = "grid"; root.style.gap = "16px";
    VIEWS[t].mount(root); VIEWS[t].update(); renderActions(); renderDiag(); persist();
  }
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) switchTab(b.dataset.tab); });
  function renderActions() {
    const a = $("actions"); a.replaceChildren();
    const add = (label, fn, primary) => a.append(h("button", { class: "btn" + (primary ? " primary" : ""), type: "button", text: label, onclick: fn }));
    const w = canWrite && !!db, t = UI.tab;
    const libSeason = () => (UI.bibliotek.season && UI.bibliotek.season !== "Utan säsong" ? UI.bibliotek.season : KollView.seasonInView() || "");
    if ((t === "bibliotek" || t === "produktion" || t === "kollektion") && w && assets && shopTodo().length) add("Hämta Shopify-bilder (" + shopTodo().length + ")", importShopifyImages);
    if (t === "bibliotek" && w) { add("+ Ny grundstyle", () => openStyle(null, { grund: true, status: "Produktidé" })); add("+ Ny style", () => openStyle(null, { sasong: libSeason() })); add("+ Ny produktidé", () => openStyle(null, { status: "Produktidé", sasong: libSeason() }), true); }
    if (t === "samples") { if (downloads) add("Exportera CSV", exportSamples); if (w) add("+ Ny style", () => openStyle(null)); if (w) add("+ Ny sample", () => openSample(null), true); }
    if (t === "kollektion" && w) { add("+ Ny drop", () => openDrop(null, { sasong: KollView.seasonInView() || "" })); add("+ Ny sample", () => openSample(null)); add("+ Ny produktidé", () => openStyle(null, { status: "Produktidé", sasong: KollView.seasonInView() || "" })); add("+ Ny style", () => openStyle(null, { sasong: KollView.seasonInView() || "" }), true); }
    if (t === "foto" && w) add("+ Ny sample", () => openSample(null, { version: "Fotosample" }), true);
    if (t === "ref" && w) add("+ Nytt referensplagg", () => openRef(null), true);
    if (t === "produktion") { if (downloads) add("Exportera CSV", exportPo); if (w) add("+ Ny PO", () => openPo(null, { sasong: ProdView.seasonInView() || "", leverantor: UI.prod.lev || "" }), true); }
    if (t === "tyglager") { if (downloads) add("Exportera CSV", exportLager); if (w) add("+ Nytt tyg", () => openTyg(null)); if (w) add("+ Nytt parti", () => openLager(null), true); }
    if (t === "leverantorer" && w) add("+ Ny leverantör", () => openLev(null), true);
    if (t === "ean" && downloads) add("Exportera alla EAN", exportAllEan);
    a.append(h("button", { class: "btn", type: "button", text: "Logga ut", title: P.user.email(), onclick: P.signOut }));
    if (t === "coo" && w) add("+ Ny händelse", () => openEvent(null), true);
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
    set("c_foto", (() => { const season = KollView.seasonInView(); return D.styles.filter((s) => norm(s.sasong) === norm(season) && !["Kastad", "Pausad"].includes(styleStatusNorm(s.status)) && !isIdea(s) && fotoState(s).key === "saknas").length; })());
    set("c_bibliotek", D.styles.filter((s) => isIdea(s) && !s.grund).length);
    set("c_anvandare", D.anvandare.length || "");
    set("c_coo", (() => { try { return allEvents().filter((e) => isOverdue(e)).length; } catch (e) { return ""; } })());
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
    $("dlAgare").replaceChildren(...uniq(AGARE.concat(D.handelser.map((e) => e.agare))).map((v) => new Option(v, v)));
    $("dlDrop").replaceChildren(...uniq(DROP_NAMES.concat(D.drops.map((d) => d.namn), D.styles.map((s) => s.drop))).map((v) => new Option(v, v)));
  }
  let refreshT = 0;
  function scheduleRefresh() { if (refreshT) return; refreshT = setTimeout(() => { refreshT = 0; refresh(); }, 40); }
  function refresh() { updateCounts(); refreshLists(); VIEWS[UI.tab].update(); if (sheetCtx && sheetCtx.refresh) sheetCtx.refresh(); }
  function applyWriteMode() { applyAccess(); }

  // ---------- global sök ----------
  function styleSummary(st) {
    const xs = samplesOfStyle(st._id);
    const inne = xs.filter((x) => x.status === "Mottagen" && !isArchived(x)).length, vantar = xs.filter((x) => isWaiting(x) && !isArchived(x)).length, ark = xs.filter(isArchived).length;
    const pl = poLinesOf(st._id).filter((x) => poStatusNorm(x.po.status) !== "Avbruten");
    const u = (f) => pl.filter((x) => f(poStatusNorm(x.po.status))).reduce((a, x) => a + (num(x.r.antal) || 0), 0);
    const planerat = u((x) => PO_PLANNED.includes(x)), prod = u((x) => x === "PO bekräftad" || x === "I produktion"), pavag = u((x) => x === "Skickad"), inlev = u((x) => x === "Inlevererad");
    const etas = pl.filter((x) => PO_OPEN.includes(poStatusNorm(x.po.status))).map((x) => poEta(x.po)).filter(Boolean).sort();
    const parts = [];
    const ss = styleStatusNorm(st.status);
    if (IDEA_STATUS.includes(ss)) parts.push(["Idéstadiet", ss === "Idé under utveckling" ? "hos Alex" : "Carl"]);
    parts.push(["Samples", xs.length ? xs.length + " (" + inne + " inne, " + vantar + " väntas" + (ark ? ", " + ark + " i arkiv" : "") + ")" : "inga"]);
    if (pl.length) parts.push(["Produktion", [planerat ? planerat + " planerade" : "", prod ? prod + " i produktion" : "", pavag ? pavag + " på väg" : "", inlev ? inlev + " inlevererade" : ""].filter(Boolean).join(", ") + (etas[0] ? " · inkommande " + fmtDate(etas[0]) : "")]);
    else if (!IDEA_STATUS.includes(ss)) parts.push(["Produktion", "ingen PO"]);
    return h("div", { class: "srch-line" }, parts.map(([k, v]) => h("span", null, k + ": ", h("b", { text: v }))));
  }
  const TYG_STOP = new Set(["cotton", "linen", "wool", "inhouse", "canvas", "twill", "100%", "silk", "cashmere", "poly", "nylon", "denim", "fabric", "tyg"]);
  const tygTokens = (x) => norm(x).split(/[^a-z0-9%]+/).filter((w) => w.length >= 4 && !TYG_STOP.has(w));
  const tygMatch = (a, b) => { if (!a || !b) return false; const na = norm(a), nb = norm(b); if (na.includes(nb) || nb.includes(na)) return true; const tb = tygTokens(b); return tygTokens(a).some((w) => tb.includes(w)); };
  function tygSummary(t) {
    const xs = D.samples.filter((s) => s.tygId === t._id), sts = D.styles.filter((s) => s.tygId === t._id);
    const viaStyle = new Set(D.styles.filter((st) => st.tygId === t._id || xs.some((x) => x.styleId === st._id)).map((st) => st._id));
    const rows = []; for (const po of D.po) { if (PO_DRAFT.includes(poStatusNorm(po.status))) continue; for (const r of po.rader || []) if (tygMatch(r.tyg, t.namn) || (r.styleId && viaStyle.has(r.styleId))) rows.push({ po, r }); }
    const units = rows.reduce((a, x) => a + (num(x.r.antal) || 0), 0);
    const stock = stockText(t._id);
    return h("div", { class: "srch-line" }, h("span", null, "Samples: ", h("b", { text: String(xs.length) + (xs.filter(isArchived).length ? " (" + xs.filter(isArchived).length + " i arkiv)" : "") })), h("span", null, "Styles/idéer: ", h("b", { text: String(sts.length) })), h("span", null, "Produktion: ", h("b", { text: rows.length ? rows.length + " PO-rader · " + units + " plagg" : "–" })), h("span", null, "Eget lager: ", h("b", { text: stock || "–" })));
  }
  const hit = (q, ...fields) => fields.join(" ").toLowerCase().includes(q);
  function openSearch(q0) {
    const qIn = h("input", { type: "search", id: "f_gq", placeholder: "Sök style, tyg, färg, PO, sample-ID …", "aria-label": "Sök", autocomplete: "off" });
    qIn.value = q0 || "";
    const res = h("div", { style: "display:grid;gap:22px" });
    const can = (tab) => ME.flikar.includes(tab);
    function render() {
      const q = norm(qIn.value);
      res.replaceChildren();
      if (q.length < 2) { res.append(h("p", { class: "hint", text: "Skriv minst två tecken. Sök på t.ex. ett tyg för att se var det används – i samples, arkiv, idéer och produktion – eller på en style för att se vad som är inkommande, i produktion, under sampling och på idéstadiet." })); return; }
      const sec = (title, items, rowFn, emptyText) => {
        const s = h("section", { class: "srch-sec" }, h("h3", { class: "sec-title", text: title + " (" + items.length + ")" }));
        if (!items.length) { s.append(h("p", { class: "hint", text: emptyText || "Inga träffar." })); return s; }
        const ul = h("ul", { class: "mini" }, items.slice(0, 40).map(rowFn));
        if (items.length > 40) ul.append(h("li", { class: "sub", text: "… och " + (items.length - 40) + " till. Förfina sökningen." }));
        s.append(ul); return s;
      };
      if (can("bibliotek") || can("kollektion")) {
        const sts = D.styles.filter((s) => hit(q, s._id, s.namn, s.beskrivning, s.leverantor, s.kategori, styleTyg(s), (s.farger || []).join(" "), s.sasong, s.drop, grundOf(s) ? grundOf(s).namn : "", s.referenser, s.kommentar)).sort((a, b) => seasonRank(b.sasong) - seasonRank(a.sasong) || (a.namn || "").localeCompare(b.namn || "", "sv"));
        res.append(sec("Styles och idéer", sts, (s) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openStyle(s._id) }, tag(s._id), h("span", { class: "mini-main" }, h("strong", { text: s.namn + (s.grund ? " (grundstyle)" : "") }), h("span", { class: "sub", text: [s.sasong, s.drop, s.leverantor, styleTyg(s)].filter(Boolean).join(" · ") }), styleSummary(s)), h("span", { class: "mini-side" }, styleStatusPill(s))))));
      }
      if (can("samples")) {
        const xs = D.samples.filter((s) => hit(q, s._id, styleName(s), s.version, tygName(s), s.material, s.farg, s.leverantor, s.kommentar, s.andringar, s.storlek, platsText(s), s.hangare ? "h" + s.hangare : "", seasonOf(s), beslutNorm(s.beslut))).sort((a, b) => isArchived(a) - isArchived(b) || styleName(a).localeCompare(styleName(b), "sv") || versionRank(a.version) - versionRank(b.version));
        res.append(sec("Samples", xs, (x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openSample(x._id) }, tag(x._id), h("span", { class: "mini-main" }, h("strong", { text: styleName(x) + (x.version ? " · " + x.version : "") }), h("span", { class: "sub", text: [fargText(x.farg), tygName(x), x.leverantor, seasonOf(x), platsText(x)].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, statusPill(x.status), beslutNorm(x.beslut) ? chip(beslutNorm(x.beslut), "b-" + slug(beslutNorm(x.beslut))) : null, isArchived(x) ? chip("Arkiv", "b-arkiv") : null)))));
      }
      if (can("tyglager")) {
        const ts = D.tyger.filter((t) => hit(q, t._id, t.namn, t.leverantor, t.kommentar, t.status) || D.lager.some((l) => l.tygId === t._id && hit(q, l.farg, l.plats, l._id))).sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv"));
        res.append(sec("Tyger", ts, (t) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openTyg(t._id) }, tag(t._id), h("span", { class: "mini-main" }, h("strong", { text: t.namn }), h("span", { class: "sub", text: t.leverantor || "" }), tygSummary(t)), h("span", { class: "mini-side" }, t.status ? h("span", { class: "pill ts-" + slug(t.status), text: t.status }) : null)))));
      }
      if (can("produktion")) {
        const rows = [];
        for (const po of D.po) for (const r of po.rader || []) if (hit(q, po.nr, po._id, po.leverantor, po.sasong, po.drop, r.produkt, r.farg, r.tyg, r.beskrivning, (byId(D.styles, r.styleId) || {}).namn)) rows.push({ po, r });
        rows.sort((a, b) => String(a.po.nr || a.po._id).localeCompare(String(b.po.nr || b.po._id)));
        res.append(sec("Produktion (PO-rader)", rows, (x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openPo(x.po._id) }, h("span", { class: "tag", text: x.po.nr || x.po._id }), h("span", { class: "mini-main" }, h("strong", { text: [x.r.produkt || (byId(D.styles, x.r.styleId) || {}).namn || "Produkt", x.r.farg].filter(Boolean).join(" · ") }), h("span", { class: "sub", text: [x.po.leverantor, x.po.sasong, x.r.tyg, x.r.antal != null ? x.r.antal + " plagg" : "", poEta(x.po) ? "ETA " + fmtDate(poEta(x.po)) : ""].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, poStatusPill(x.po))))));
      }
      if (can("ref")) {
        const rs = D.ref.filter((r) => hit(q, r._id, r.plagg, r.styleNamn, r.skickadTill, r.agare, r.tracking, r.kommentar));
        if (rs.length) res.append(sec("Ref-plagg", rs, (r) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openRef(r._id) }, tag(r._id), h("span", { class: "mini-main" }, h("strong", { text: r.plagg }), h("span", { class: "sub", text: [r.skickadTill, r.styleNamn ? "för " + r.styleNamn : ""].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, h("span", { class: "pill rs-" + slug(r.status || ""), text: r.status || "–" }))))));
      }
    }
    let tmr = 0;
    qIn.addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(render, 120); });
    qIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); render(); } });
    openSheet({ tag: "Sök", title: "Sök i hela appen", sub: "Styles, idéer, samples, arkiv, tyger och produktion", body: [h("div", { class: "field" }, qIn), res], foot: [h("div"), h("div", { class: "foot-right" }, h("button", { class: "btn", type: "button", text: "Stäng", onclick: closeSheet }))], ctx: { refresh: render }, focus: "f_gq" });
    render();
  }
  $("gsearch").addEventListener("submit", (e) => { e.preventDefault(); openSearch($("gq").value); });
  $("gq").addEventListener("input", () => { if ($("gq").value.trim().length >= 2 && $("sheet").hidden) openSearch($("gq").value); else if (!$("sheet").hidden && $("f_gq")) { $("f_gq").value = $("gq").value; $("f_gq").dispatchEvent(new Event("input")); } });
  document.addEventListener("keydown", (e) => { if (e.key === "/" && !e.target.closest("input, textarea, select") && $("sheet").hidden) { e.preventDefault(); $("gq").focus(); } });

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
  const S_LABELS = { sasong: "Tilltänkt säsong", markt: "Fysiskt märkt", mattGodkanda: "Mått godkända", mattKommentar: "Måttkommentar", styleId: "Style", version: "Version", leverantor: "Leverantör", farg: "Färg", tygId: "Tyg", storlek: "Storlek", prisBelopp: "Pris", prisValuta: "Valuta", status: "Status", bestalld: "Beställd", ledtid: "Ledtid", forvantad: "Förväntad leverans", mottagen: "Mottagen", tracking: "Tracking", p1Skickad: "Påminnelse 1", p2Skickad: "Påminnelse 2", platsTyp: "Plats", hangare: "Hängare", platsNotering: "Platsnotering", beslut: "Beslut", andringar: "Ändringar", kommentar: "Kommentar", utvarderad: "Utvärderad" };
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
    const fSas = inp("f_ssas", s.sasong, { list: "dlSeason", autocomplete: "off", placeholder: "t.ex. SS27" });
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
    const hangWrap = field("Hängare / krok nr", fHang);
    const syncLedHint = () => { const n = fLev.value.trim(); const sl = levNum(n, "sampleLedtid"); const a = actualLead(n); ledHint.textContent = n ? "Standard " + (sl != null ? sl + " d" : "saknas") + (a ? " · faktiskt snitt " + a.avg + " d (" + a.n + ")" : "") : ""; };
    const fillLead = () => { const sl = levNum(fLev.value.trim(), "sampleLedtid"); if (sl != null && !fLed.value) fLed.value = sl; if (!fForv.value && fBest.value && Number(fLed.value) > 0) fForv.value = addDays(fBest.value, Number(fLed.value)); };
    const syncPlats = () => { const isH = fPlats.value === "Hängare" || fPlats.value === "Fotohäng"; fHang.disabled = ro || !isH; hangWrap.classList.toggle("dim", !isH); };
    fStyle.addEventListener("change", () => { newWrap.hidden = fStyle.value !== "__ny"; if (!newWrap.hidden) fNewStyle.focus(); const x = byId(D.styles, fStyle.value); if (x && !fLev.value.trim()) { fLev.value = x.leverantor || ""; syncLedHint(); if (isNew) fillLead(); } });
    fLev.addEventListener("change", () => { syncLedHint(); if (isNew) fillLead(); });
    fLed.addEventListener("change", () => { if (fBest.value && Number(fLed.value) > 0 && !fForv.value) fForv.value = addDays(fBest.value, Number(fLed.value)); });
    fStatus.addEventListener("change", () => { if (fStatus.value === "Mottagen" && !fMott.value) fMott.value = todayISO(); });
    fPlats.addEventListener("change", () => { syncPlats(); if (fPlats.value === "Hängare" || fPlats.value === "Fotohäng") fHang.focus(); });

    const form = h("form", { class: "form", id: "sampleForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("h3", { class: "sec-title full", text: "Produkt" }),
      field("Style", fStyle, { full: true }), newWrap,
      field("Version", fVersion), field("Leverantör", fLev),
      field("Färg", fFarg), field("Storlek", fStorlek),
      field("Tyg", fTyg, { hint: "Skriv fritt eller välj ett tyg som redan finns." }), field("Tilltänkt säsong", fSas, { hint: "Vilken kollektion samplen siktar på – styr prioritering" }),
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
      if (isArchived(cur)) add("Plocka upp igen", () => restoreSample(cur), true);
      if (["Mottagen", "Problem"].includes(cur.status) && beslutNorm(cur.beslut) !== "Pausad") add("Pausa → arkiv", () => quickUpdate(cur, { beslut: "Pausad", utvarderad: true }, "Pausad – ligger i Arkiv"));
      if (["Mottagen", "Problem"].includes(cur.status) && beslutNorm(cur.beslut) !== "Kastad") add("Kasta → arkiv", () => quickUpdate(cur, { beslut: "Kastad", utvarderad: true }, "Kastad – ligger i Arkiv"));
      if (cur.status !== "Problem" && cur.status !== "Mottagen") add("Flagga problem", () => quickUpdate(cur, { status: "Problem" }, "Flaggad som problem"));
      if (!cur.markt) add("Märkt med ID", () => quickUpdate(cur, { markt: true }, cur._id + " är märkt"), unmarked(cur));
      if (cur.status === "Mottagen" && (cur.version === "Fotosample" || cur.version === "Produktionssample") && cur.platsTyp !== "Fotohäng") add("Häng på fotohänget", () => quickUpdate(cur, { platsTyp: "Fotohäng" }, "Hänger nu på fotohänget – ange krok nr nedan"));
      add("Skriv ut etikett", () => openLabels([cur._id]));
    }
    async function quickUpdate(cur, patch, msg) {
      const changes = describeChanges(cur, patch, S_LABELS);
      const body = Object.assign({}, patch, { andrad: new Date().toISOString(), logg: (cur.logg || []).concat(changes.map(logEntry)) });
      const ok = await write("samples", cur._id, body);
      if (ok) { toast(msg); for (const [k, v] of Object.entries(patch)) { const el = S_INPUTS[k] && $(S_INPUTS[k]); if (el) el.value = v === true ? "1" : v === false ? "0" : v == null ? "" : v; } }
      return ok;
    }
    async function restoreSample(cur) {
      const patch = {};
      if (["Kastad", "Pausad"].includes(beslutNorm(cur.beslut))) { patch.beslut = ""; patch.utvarderad = false; }
      const stx = styleOf(cur);
      const ok = Object.keys(patch).length ? await quickUpdate(cur, patch, "Upplockad från arkivet") : true;
      if (ok && stx && ["Pausad", "Kastad"].includes(styleStatusNorm(stx.status))) { await write("styles", stx._id, { status: "Sampling", andrad: new Date().toISOString(), logg: (stx.logg || []).concat(logEntry("Upplockad från arkivet via " + cur._id + " – status Sampling")) }); toast("Samplen och stylen " + stx.namn + " är upplockade från arkivet"); }
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
          styleId: styleId || null, produkt: st ? st.namn : (s.produkt || ""), version: fVersion.value, leverantor: lev, farg: fFarg.value.trim(), tygId, storlek: fStorlek.value.trim(), sasong: fSas.value.trim(),
          prisBelopp: num(fPris.value), prisValuta: fValuta.value || null, status: fStatus.value, bestalld: fBest.value || null, ledtid: num(fLed.value), forvantad: fForv.value || null,
          mottagen: fMott.value || null, tracking: fTrack.value.trim(), p1Skickad: fP1.value || null, p2Skickad: fP2.value || null,
          platsTyp: fPlats.value, hangare: fPlats.value === "Hängare" || fPlats.value === "Fotohäng" ? fHang.value.trim() : "", platsNotering: fPNot.value.trim(), beslut: fBeslut.value, andringar: fAndr.value.trim(), kommentar: fKom.value.trim(),
          markt: fMarkt.value === "1", mattGodkanda: fMatt.value === "1" ? true : fMatt.value === "0" ? false : null, mattKommentar: fMattKom.value.trim()
        };
        if (!o.forvantad && o.bestalld && o.ledtid > 0) o.forvantad = addDays(o.bestalld, o.ledtid);
        if (o.beslut) o.utvarderad = true;
        const now = new Date().toISOString();
        if (isNew) {
          const nid = await freshId("samples", D.samples, "S", 3);
          const body = Object.assign({ id: nid, material: "", utvarderad: !!o.beslut, bilder: [], logg: [logEntry("Sample skapad (" + o.status + ")")], andrad: now }, o);
          if (await create("samples", nid, body)) {
            if (!byId(D.samples, nid)) D.samples.push(Object.assign({}, body, { _id: nid }));
            toast(nid + " sparad – märk samplen med " + nid + " när den kommer");
            if (o.beslut === "Godkänd") await approveStyleFrom(Object.assign({ _id: nid }, o));
            if (st && isIdea(st)) await write("styles", st._id, { status: "Sampling", andrad: now, logg: (st.logg || []).concat(logEntry("Första sample beställd (" + nid + ") – idén är nu under sampling")) });
            openSample(nid);
          }
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
  const ST_LABELS = { shopifyBild: "Shopify-bild", ecomBilder: "E-com-bilder", ecomPlatDatum: "E-com-plåtning", kampanjStatus: "Kampanjfoto", kampanjDatum: "Kampanjfoto datum", bildId: "Huvudbild", namn: "Namn", leverantor: "Leverantör", sasong: "Säsong", drop: "Drop", typ: "Typ", kategori: "Kategori", status: "Status", klartSenast: "I lager senast", fotoSenast: "Fotosample senast", kommentar: "Kommentar", farger: "Färger", storlekar: "Storlekar", beskrivning: "Beskrivning", tygId: "Tyg", grund: "Grundstyle", grundId: "Variant av", mattFran: "Mått från", mattlista: "Måttlista", referenser: "Referenser" };
  function openStyle(id, preset) {
    const isNew = !id;
    const st = isNew ? Object.assign({ _id: null, status: "Sampling", typ: "Nyhet", farger: [], storlekar: [], ean: [], bilder: [], logg: [] }, preset || {}) : byId(D.styles, id);
    if (!st) { toast("Hittar inte " + id + "."); return; }
    const ro = !canWrite || !db;
    const current = () => (isNew ? st : byId(D.styles, st._id) || st);
    const fNamn = inp("f_snamn", st.namn);
    const fBesk = area("f_sbesk", st.beskrivning, "Vad är det för plagg? Passform, detaljer, känsla, vad som skiljer från tidigare versioner …");
    const grundOpts = [["", "– Egen style, ingen grundstyle –"]].concat(grundStyles().filter((g) => g._id !== st._id).map((g) => [g._id, g.namn + (g.kategori ? " · " + g.kategori : "")]));
    const fGrund = selectEl("f_sgrund", grundOpts, st.grundId || "");
    const fIsGrund = h("input", { type: "checkbox", id: "f_sisgrund" }); fIsGrund.checked = !!st.grund;
    const fLev = inp("f_slev", st.leverantor, { list: "dlLev", autocomplete: "off" });
    const fTyg = inp("f_styg", styleTyg(st), { list: "dlTyg", autocomplete: "off", placeholder: "t.ex. Japan Blue inhouse – Westpoint Canvas 223" });
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
    const fInk = inp("f_sink", st.inkopspris, { type: "number", min: "0", step: "0.01", inputmode: "decimal", placeholder: "per plagg" });
    const fInkV = selectEl("f_sinkv", [["", "– valuta –"]].concat(CURS.concat(["SEK"]).map((c) => [c, c])), st.inkopsValuta || ((levByName(st.leverantor) || {}).valuta || ""));
    const mattOpts = [["", "– Egen måttlista nedan –"]]
      .concat(D.styles.filter((x) => x._id !== st._id && !["Kastad"].includes(styleStatusNorm(x.status))).sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv")).map((x) => [x._id, x.namn + (x.sasong ? " · " + x.sasong : "") + " (style)"]))
      .concat(D.samples.filter((x) => x.mattGodkanda === true || x.status === "Mottagen").sort((a, b) => styleName(a).localeCompare(styleName(b), "sv")).map((x) => [x._id, styleName(x) + (x.version ? " · " + x.version : "") + " (" + x._id + ")"]));
    const fMattFran = selectEl("f_smattfran", mattOpts, st.mattFran || "");
    const fMatt = area("f_smatt", st.mattlista, "En rad per mått, t.ex.\nBröstvidd (M) 56\nÄrmlängd 64\nRygglängd 72");
    const fRef = area("f_sref", st.referenser, "Referensplagg, länkar, inspiration …");
    const fShop = inp("f_sshop", shopUrl(st), { placeholder: "https://cdn.shopify.com/… eller produktsidans bild-URL" });
    const dropHint = h("span", { class: "hint" });
    const syncDropHint = () => { const d = dropOf({ sasong: fSas.value.trim(), drop: fDrop.value.trim() }); dropHint.textContent = fDrop.value.trim() ? (d ? (isISO(d.klartSenast) ? "Droppen har datum " + fmtDate(d.klartSenast) : "Droppen saknar datum") : "Ingen drop med det namnet i " + (fSas.value.trim() || "säsongen") + " – skapas under Drops") : "Tomt = utan drop"; };
    const grundHint = h("span", { class: "hint" });
    const syncGrund = () => { const g = byId(D.styles, fGrund.value); grundHint.textContent = g ? "Ärver namn, kategori och mått från " + g.namn + " om fälten är tomma." : fIsGrund.checked ? "Grundstyle: återanvänds i flera kollektioner via varianter." : "Välj en grundstyle om detta är en variant av ett plagg som redan finns."; fGrund.disabled = ro || fIsGrund.checked; if (fIsGrund.checked) fGrund.value = ""; };
    fGrund.addEventListener("change", () => { const g = byId(D.styles, fGrund.value); if (g) { if (!fNamn.value.trim()) fNamn.value = g.namn; if (!fKat.value && g.kategori) fKat.value = g.kategori; if (!fLev.value.trim() && g.leverantor) fLev.value = g.leverantor; if (!fMattFran.value && fMatt.value.trim() === "") fMattFran.value = g._id; } syncGrund(); });
    fIsGrund.addEventListener("change", syncGrund);
    const form = h("form", { class: "form", id: "styleForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("h3", { class: "sec-title full", text: "Produkt" }),
      field("Namn", fNamn, { full: true }),
      field("Beskrivning", fBesk, { full: true }),
      h("div", { class: "field" }, h("label", { for: "f_sgrund", text: "Variant av grundstyle" }), fGrund, grundHint),
      h("div", { class: "field" }, h("label", { for: "f_sisgrund", text: "Grundstyle" }), h("label", { class: "checkline", style: "color:var(--ink)" }, fIsGrund, "Detta är en grundstyle (kan få varianter)")),
      field("Kategori", fKat, { hint: "Styr storleksskala och budgetruta" }), field("Leverantör", fLev),
      field("Tyg", fTyg, { full: true, hint: "Skriv fritt eller välj ett tyg som redan finns i Tyglager." }),
      field("Säsong", fSas), h("div", { class: "field" }, h("label", { for: "f_sdrop", text: "Drop" }), fDrop, dropHint),
      field("Typ", fTyp, { hint: "Restock och NOOS behöver ingen ny sample" }), field("Status", fStatus, { hint: "Produktidé → Idé under utveckling (hos Alex) → Sampling → Godkänd → PO lagd …" }),
      h("h3", { class: "sec-title full", text: "Mått" }),
      field("Använd mått från", fMattFran, { full: true, hint: "Hänvisa till ett plagg vars mått ska användas, eller skriv egen måttlista." }),
      field("Måttlista", fMatt, { full: true }),
      h("h3", { class: "sec-title full", text: "Referenser" }),
      field("Referenser och länkar", fRef, { full: true }),
      field("Bild från Shopify (URL)", fShop, { full: true, hint: st.shopifyBild ? "Hämtad från " + shopTitle(st) + (st.shopifyBild.handle ? " – atemporubato.com/products/" + st.shopifyBild.handle : "") + ". Används när stylen saknar egna bilder; töm fältet för att ta bort." : "Klistra in bild-URL från Shopify för en placeholder tills egna bilder finns." }),
      h("h3", { class: "sec-title full", text: "Planering" }),
      field("I lager senast", fKlart, { hint: "Tomt = droppens datum används" }), field("Fotosample senast", fFoto, { hint: "Valfritt" }),
      h("h3", { class: "sec-title full", text: "Foto och e-com" }),
      field("E-com-bilder", fEcom, { hint: "Olivers status" }), field("E-com-plåtning, datum", fEcomD),
      field("Kampanjfoto", fKamp), field("Kampanjfoto, datum", fKampD),
      field("Kommentar", fKom, { full: true }),
      canSeeMoney() ? h("h3", { class: "sec-title full", text: "Inköp" }) : null,
      canSeeMoney() ? field("Inköpspris per plagg", fInk, { hint: st.inkopsKalla ? "Källa: " + st.inkopsKalla + (st.inkopsDatum ? " " + fmtDate(st.inkopsDatum) : "") : "I leverantörens valuta – räknas om till SEK med kurserna under Leverantörer" }) : null,
      canSeeMoney() ? field("Valuta", fInkV) : null);
    if (ro) { lock(form); fIsGrund.disabled = true; }
    fSas.addEventListener("input", syncDropHint); fDrop.addEventListener("input", syncDropHint); syncDropHint(); syncGrund();
    const formState = () => ({ _id: st._id, namn: fNamn.value.trim(), beskrivning: fBesk.value.trim(), grund: fIsGrund.checked, grundId: fIsGrund.checked ? "" : fGrund.value, leverantor: fLev.value.trim(), sasong: fSas.value.trim(), drop: fDrop.value.trim(), typ: fTyp.value, kategori: fKat.value, status: fStatus.value, mattFran: fMattFran.value, mattlista: fMatt.value.trim(), referenser: fRef.value.trim(), shopifyBild: fShop.value.trim() ? (st.shopifyBild && st.shopifyBild.url === fShop.value.trim() ? st.shopifyBild : { url: fShop.value.trim(), titel: "", handle: "", likhet: "manuell", t: new Date().toISOString() }) : null, ecomBilder: fEcom.value, ecomPlatDatum: fEcomD.value || null, kampanjStatus: fKamp.value, kampanjDatum: fKampD.value || null, klartSenast: fKlart.value || null, fotoSenast: fFoto.value || null, kommentar: fKom.value.trim(), inkopspris: canSeeMoney() ? num(fInk.value) : st.inkopspris ?? null, inkopsValuta: canSeeMoney() ? fInkV.value : st.inkopsValuta || "", inkopsKalla: canSeeMoney() && num(fInk.value) !== num(st.inkopspris) ? (num(fInk.value) == null ? "" : myName || "manuellt") : st.inkopsKalla || "", inkopsDatum: canSeeMoney() && num(fInk.value) !== num(st.inkopspris) ? (num(fInk.value) == null ? "" : todayISO()) : st.inkopsDatum || "" });

    const prodSec = h("section");
    function renderPris() {
      if (isNew || !canSeeMoney()) return null;
      const cur = current(); const info = gm1Info(cur); const shop = shopifyOf(cur._id);
      if (!info && !shop.length) return null;
      const kv = (k, v) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v big" }, v));
      return h("div", null, h("h3", { class: "sec-title", text: "Pris och marginal" }),
        h("div", { class: "kvs" }, kv("Pris inkl. moms", info ? fmtSEK(info.pris) + (cur.ecomPrisKalla ? " (" + cur.ecomPrisKalla + ")" : "") : "–"), kv("Netto exkl. moms", info ? fmtSEK(info.netto) : "–"), kv("Kostnad", info && info.kostnad != null ? fmtSEK(info.kostnad) + (info.valuta !== "SEK" ? " (" + fmtCur(info.kostnadValuta, info.valuta) + ")" : "") : "–"), kv("GM1 idag", info && info.kostnad != null ? h("span", { class: "pill " + gmClass(info.gm), text: fmtPct(info.gm, 1) }) : "kostnad saknas"), kv("GM1 om " + (info ? info.valuta : "valutan") + " +" + stressPct() + " % mot SEK", info && info.kostnad != null && info.valuta !== "SEK" ? h("span", { class: "pill " + gmClass(info.gmStress), text: fmtPct(info.gmStress, 1) }) : "–")),
        shop.length ? h("p", { class: "hint", text: "I Shopify: " + shop.map((p) => p.titel + " " + fmtSEK(p.pris)).join(" · ") }) : null);
    }
    function renderProd() {
      prodSec.replaceChildren();
      if (isNew) return;
      const prisBlock = renderPris(); if (prisBlock) prodSec.append(prisBlock);
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

    const pendingImgs = isNew ? [] : null;
    const ownImgs = bilderSection({ title: "Bilder och referenser", ro, pending: pendingImgs, current, hero: () => styleImage(current()), onHero: ro ? null : async (bid) => { await write("styles", current()._id, { bildId: bid, bildAuto: false, andrad: new Date().toISOString() }); },
      empty: "Skisser, referensbilder och foton på plagget. Första bilden blir huvudbild i Kollektion och Bibliotek om inget annat väljs.",
      save: (ids, logText) => { const cur = current(); return write("styles", cur._id, { bilder: ids, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry(logText)) }); } });
    const gallerySec = h("section");
    function renderGallery() {
      ownImgs.render();
      gallerySec.replaceChildren();
      if (isNew) return;
      const cur = current();
      const ids = uniq(samplesOfStyle(st._id).flatMap(sampleImages));
      if (!ids.length) return;
      gallerySec.append(h("h3", { class: "sec-title", text: "Bilder från samples (" + ids.length + ")" }));
      const hero = styleImage(cur);
      gallerySec.append(gallery(ids, { hero, onHero: ro ? null : async (bid) => { await write("styles", cur._id, { bildId: bid, bildAuto: false, andrad: new Date().toISOString() }); } }));
    }
    const varSec = h("section");
    function renderVariants() {
      varSec.replaceChildren();
      if (isNew) return;
      const cur = current();
      const g = grundOf(cur);
      if (g) { varSec.append(h("div", { class: "ideabanner" }, h("span", null, "Variant av grundstylen ", h("button", { class: "linkish", type: "button", text: g.namn, onclick: () => openStyle(g._id) })), h("span", { class: "sub", text: "· " + variantsOf(g._id).length + (variantsOf(g._id).length === 1 ? " variant totalt" : " varianter totalt") }))); }
      if (!cur.grund) return;
      const vs = variantsOf(cur._id);
      varSec.append(h("h3", { class: "sec-title", text: "Varianter (" + vs.length + ")" }));
      if (vs.length) varSec.append(h("ul", { class: "mini" }, vs.map((v) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openStyle(v._id) }, tag(v._id), h("span", { class: "mini-main" }, h("strong", { text: v.namn }), h("span", { class: "sub", text: [v.sasong, v.drop, styleTyg(v), (v.farger || []).join(", ")].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, styleStatusPill(v)))))));
      else varSec.append(h("p", { class: "hint", text: "Inga varianter ännu. En variant är samma plagg i ny kollektion, nytt tyg eller ny färgställning." }));
      if (!ro) varSec.append(h("button", { class: "btn small", type: "button", text: "+ Ny variant av " + cur.namn, onclick: () => openStyle(null, { grundId: cur._id, namn: cur.namn, kategori: cur.kategori || "", leverantor: cur.leverantor || "", storlekar: (cur.storlekar || []).slice(), mattFran: cur._id, status: "Produktidé", sasong: UI.bibliotek.season || "" }) }));
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

    async function collect() {
      const o = formState(); delete o._id;
      o.farger = parseList(fFarger.value); o.storlekar = parseList(fStorl.value);
      if (!o.storlekar.length && o.kategori) o.storlekar = defaultSizes(o.kategori);
      o.tygId = await resolveTyg(fTyg.value.trim(), o.leverantor);
      return o;
    }
    async function save(after) {
      const btn = $("btnSave"); if (btn) btn.disabled = true;
      try {
        const o = await collect();
        if (!o.namn) { toast("Ge stylen ett namn."); fNamn.focus(); return null; }
        const now = new Date().toISOString();
        if (isNew) {
          const nid = await freshId("styles", D.styles, "ST-", 3);
          const body = Object.assign({ id: nid, ean: [], bilder: pendingImgs.slice(), logg: [logEntry(IDEA_STATUS.includes(o.status) ? "Produktidé skapad" : "Style skapad")], andrad: now }, o);
          if (await create("styles", nid, body)) { if (!byId(D.styles, nid)) D.styles.push(Object.assign({}, body, { _id: nid })); toast(nid + " sparad"); if (after) return after(nid); openStyle(nid); return nid; }
          return null;
        }
        const cur = current();
        const changes = describeChanges(cur, o, ST_LABELS);
        await saveShopFields();
        if (!changes.length) { if (after) return after(cur._id); closeSheet(); return cur._id; }
        if (await write("styles", cur._id, Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) }))) { if (after) return after(cur._id); toast("Sparat"); closeSheet(); return cur._id; }
        return null;
      } finally { if (btn) btn.disabled = false; }
    }
    async function sendToAlex() {
      await save(async (sid) => {
        const cur = byId(D.styles, sid) || current();
        const now = new Date().toISOString();
        if (await write("styles", sid, { status: "Idé under utveckling", overlamnad: { till: "Alex", t: now, av: myId }, andrad: now, logg: (cur.logg || []).concat(logEntry("Skickad till Alex för att utvecklas till sample")) })) { toast("Idén ligger nu hos Alex under Samples › Idéer att sampla"); closeSheet(); }
        return sid;
      });
    }
    function orderSample() {
      save(async (sid) => { const cur = byId(D.styles, sid) || current(); openSample(null, { styleId: sid, leverantor: cur.leverantor || "", version: "Proto 1", tygId: cur.tygId || null }); return sid; });
    }

    const nSamples = isNew ? 0 : samplesOfStyle(st._id).length;
    const nVariants = isNew ? 0 : variantsOf(st._id).length;
    const body = [varSec, form, ownImgs, planSec, gallerySec, prodSec, samplesSec, eanSec, shopSec];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl, ro ? null : h("div", { class: "add-note" }, noteIn, h("button", { class: "btn small", type: "button", text: "Lägg till", onclick: addNote }))));
    const foot = footButtons({ onDelete: isNew ? null : async () => { if (await remove("styles", st._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: !nSamples && !(st.ean || []).length && !nVariants, blockText: "Stylen har samples, EAN eller varianter kopplade", onSave: () => save() });
    if (!ro) {
      const s0 = styleStatusNorm(st.status);
      if (s0 === "Produktidé") foot[1].insertBefore(h("button", { class: "btn", type: "button", id: "btnAlex", text: "Spara och skicka till Alex", onclick: sendToAlex }), foot[1].lastChild);
      if (s0 === "Idé under utveckling") foot[1].insertBefore(h("button", { class: "btn", type: "button", id: "btnSampla", text: "Beställ sample", onclick: orderSample }), foot[1].lastChild);
    }
    openSheet({
      tag: isNew ? (IDEA_STATUS.includes(st.status) ? "Ny idé" : "Ny") : st._id,
      title: isNew ? (IDEA_STATUS.includes(st.status) ? (st.grundId ? "Ny variant" : "Ny produktidé") : "Ny style") : st.namn,
      sub: isNew ? (st.grundId && byId(D.styles, st.grundId) ? "Variant av " + byId(D.styles, st.grundId).namn : "") : [st.grund ? "Grundstyle" : "", st.leverantor, st.sasong, st.drop].filter(Boolean).join(" · "),
      body,
      foot,
      ctx: { refresh: () => { if (!isNew && !byId(D.styles, st._id)) { closeSheet(); return; } renderVariants(); renderPlan(); renderGallery(); renderProd(); renderSamples(); renderEanTable(); if (!isNew) { renderFarger(); renderLogInto(logUl, current().logg); } } },
      focus: isNew ? "f_snamn" : null
    });
    renderVariants(); renderPlan(); renderGallery(); renderProd(); renderSamples(); renderEanTable();
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
    const pendingImgs = isNew ? [] : null;
    const imgSec = bilderSection({ title: "Tygbilder", ro, pending: pendingImgs, current: () => byId(D.tyger, t._id) || t, empty: "Fota tygprovet så att alla ser vilket tyg det är.", save: (ids) => write("tyger", t._id, { bilder: ids, andrad: new Date().toISOString() }) });
    const renderUsed = () => {
      imgSec.render();
      const xs = isNew ? [] : D.samples.filter((s) => s.tygId === t._id).sort((a, b) => a._id.localeCompare(b._id));
      const sts = isNew ? [] : D.styles.filter((s) => s.tygId === t._id);
      used.replaceChildren(h("h3", { class: "sec-title", text: "Använt i (" + (xs.length + sts.length) + ")" }),
        sts.length ? h("ul", { class: "mini" }, sts.map((x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openStyle(x._id) }, tag(x._id), h("span", { class: "mini-main" }, h("strong", { text: x.namn }), h("span", { class: "sub", text: [x.sasong, x.leverantor].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, styleStatusPill(x)))))) : null,
        xs.length ? h("ul", { class: "mini" }, xs.map((x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openSample(x._id) }, tag(x._id), h("span", { class: "mini-main" }, h("strong", { text: styleName(x) }), h("span", { class: "sub", text: [x.version, x.farg].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, statusPill(x.status)))))) : null,
        !xs.length && !sts.length ? h("p", { class: "hint", text: "Inga styles eller samples använder tyget ännu." }) : null);
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
      if (isNew) { const nid = await freshId("tyger", D.tyger, "T-", 3); if (await create("tyger", nid, Object.assign({ id: nid, bilder: pendingImgs.slice(), andrad: now }, o))) { toast(nid + " sparat"); closeSheet(); } }
      else if (await write("tyger", t._id, Object.assign({ andrad: now }, o))) { toast("Sparat"); closeSheet(); }
    }
    const inUse = !isNew && (D.samples.some((s) => s.tygId === t._id) || lotsOf(t._id).length > 0 || D.styles.some((s) => s.tygId === t._id));
    openSheet({ tag: isNew ? "Nytt" : t._id, title: isNew ? "Nytt tyg" : t.namn, sub: isNew ? "" : t.leverantor || "", body: [form, imgSec, stock, used], foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("tyger", t._id)) { toast("Borttaget"); closeSheet(); } }, canDelete: !inUse, blockText: "Tyget används av samples eller har lager", onSave: save }), ctx: { refresh: renderUsed }, focus: isNew ? "f_tnamn" : null });
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
    const l = isNew ? { _id: null, typ: "Producent", villkor: [] } : byId(D.lev, id);
    if (!l) { toast("Hittar inte leverantören."); return; }
    const ro = !canWrite || !db;
    const fNamn = inp("f_lnamn", l.namn);
    if (!isNew) fNamn.disabled = true;
    const fKod = inp("f_lkod", l.kod, { placeholder: "t.ex. JPB" });
    const fTyp = selectEl("f_ltyp", LEV_TYP, l.typ || "Producent");
    const fSl = inp("f_lsample", l.sampleLedtid, { type: "number", min: "0", step: "1" });
    const fProd = inp("f_lprod", l.produktionstid, { type: "number", min: "0", step: "1" });
    const fFrakt = inp("f_lfrakt", l.frakt, { type: "number", min: "0", step: "1", placeholder: "standard" });
    const fBuff = inp("f_lbuff", l.buffert, { type: "number", min: "0", step: "1" });
    const fVal = selectEl("f_lvaluta", [["", "–"], "SEK", "EUR", "JPY", "GBP", "USD"], l.valuta || "");
    const fVs = selectEl("f_lvs", VILLKOR_STATUS, l.villkorStatus || (Array.isArray(l.villkor) && l.villkor.length ? "Bekräftade" : "Okända"));
    const fVt = inp("f_lvt", l.villkorText, { placeholder: "Som leverantören skrev det, t.ex. 30 % on production, 70 % on delivery" });
    const fRab = inp("f_lrab", l.rabatt, { type: "number", min: "0", step: "0.5", placeholder: "%" });
    const fRabT = inp("f_lrabt", l.rabattText, { placeholder: "t.ex. vid betalning på produktion" });
    const fKontakt = inp("f_lkontakt", l.kontakt, { placeholder: "Namn och e-post" });
    const fKom = area("f_lkom", l.kommentar);
    const a = isNew ? null : actualLead(l.namn);
    // villkorsrader
    const rows = (Array.isArray(l.villkor) ? l.villkor : []).map((x) => Object.assign({}, x));
    const rowsEl = h("div", { class: "lines" });
    const sumEl = h("span", { class: "sub" });
    function renderRows() {
      rowsEl.replaceChildren();
      rows.forEach((r, i) => {
        const fA = inp("v_a_" + i, r.andel, { type: "number", min: "0", max: "100", step: "1", placeholder: "%" });
        const fV = selectEl("v_v_" + i, VILLKOR_VID, r.vid || "leverans");
        const fD = inp("v_d_" + i, r.dagar, { type: "number", min: "0", step: "1", placeholder: "dagar" });
        [fA, fV, fD].forEach((x) => { x.disabled = ro; x.addEventListener("change", () => { r.andel = num(fA.value); r.vid = fV.value; r.dagar = num(fD.value) || 0; syncSum(); }); });
        rowsEl.append(h("div", { class: "line" }, h("div", { class: "row two" }, field("Andel %", fA), field("Betalas", fV), field("+ dagar", fD)), ro ? null : h("div", { class: "foot" }, h("button", { class: "btn small", type: "button", text: "Ta bort", onclick: () => { rows.splice(i, 1); renderRows(); } }))));
      });
      if (!ro) rowsEl.append(h("div", { class: "quick" }, h("button", { class: "btn small", type: "button", text: "+ Delbetalning", onclick: () => { rows.push({ andel: rows.length ? Math.max(0, 100 - rows.reduce((s0, x) => s0 + (num(x.andel) || 0), 0)) : 100, vid: rows.length ? "leverans" : "produktion", dagar: 0 }); renderRows(); } }),
        h("button", { class: "btn small", type: "button", text: "30 dagar netto", onclick: () => { rows.length = 0; rows.push({ andel: 100, vid: "faktura", dagar: 30 }); renderRows(); } }),
        h("button", { class: "btn small", type: "button", text: "60 dagar netto", onclick: () => { rows.length = 0; rows.push({ andel: 100, vid: "faktura", dagar: 60 }); renderRows(); } }),
        h("button", { class: "btn small", type: "button", text: "30 / 70", onclick: () => { rows.length = 0; rows.push({ andel: 30, vid: "produktion", dagar: 0 }, { andel: 70, vid: "leverans", dagar: 0 }); renderRows(); } }),
        h("button", { class: "btn small", type: "button", text: "50 / 50", onclick: () => { rows.length = 0; rows.push({ andel: 50, vid: "produktion", dagar: 0 }, { andel: 50, vid: "leverans", dagar: 0 }); renderRows(); } })));
      syncSum();
    }
    function syncSum() { const sum = rows.reduce((s0, x) => s0 + (num(x.andel) || 0), 0); sumEl.textContent = rows.length ? "Summa " + sum + " %" + (sum !== 100 ? " – ska bli 100 %" : "") : "Inga villkor inlagda – schemat antar 100 % vid leverans."; sumEl.className = rows.length && sum !== 100 ? "late-text" : "sub"; }
    renderRows();
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("h3", { class: "sec-title full", text: "Leverantör" }),
      field("Namn", fNamn, { hint: isNew ? "Skriv som det står på samples och POs" : "Namnet kopplar ihop samples, styles och POs" }), field("Kod", fKod),
      field("Typ", fTyp, { hint: "Producent syr plagg; Tyg och Trim är material" }), field("Valuta", fVal, { hint: "Valutan ni betalar i" }),
      field("Kontakt", fKontakt, { full: true }),
      h("h3", { class: "sec-title full", text: "Ledtider" }),
      field("Sample-ledtid (dagar)", fSl, { hint: a ? "Faktiskt snitt " + a.avg + " d (" + a.n + " samples)" : "Från beställning till mottagen sample" }),
      field("Produktionstid (dagar)", fProd, { hint: "Från PO till klart hos leverantör" }),
      field("Frakt (dagar)", fFrakt, { hint: "Tomt = standard " + (num(D.settings.standardFrakt) ?? 7) + " d" }),
      field("Buffert (dagar)", fBuff, { hint: "Extra marginal om leverantören brukar bli sen" }),
      h("h3", { class: "sec-title full", text: "Betalningsvillkor" }),
      field("Status", fVs), field("Rabatt %", fRab),
      field("Villkor i klartext", fVt, { full: true }),
      field("Rabatten gäller", fRabT, { full: true }),
      h("div", { class: "full" }, h("div", { class: "plan-head" }, h("span", { class: "sec-title", style: "margin:0;border:0;padding:0", text: "Delbetalningar" }), sumEl), rowsEl),
      field("Kommentar", fKom, { full: true }));
    if (ro) lock(form);
    async function save() {
      const o = { namn: fNamn.value.trim(), kod: fKod.value.trim(), typ: fTyp.value, sampleLedtid: num(fSl.value), produktionstid: num(fProd.value), frakt: num(fFrakt.value), buffert: num(fBuff.value) ?? 0, valuta: fVal.value, kontakt: fKontakt.value.trim(), kommentar: fKom.value.trim(), villkor: rows.filter((r) => num(r.andel)).map((r) => ({ andel: num(r.andel), vid: r.vid || "leverans", dagar: num(r.dagar) || 0 })), villkorStatus: fVs.value, villkorText: fVt.value.trim(), rabatt: num(fRab.value), rabattText: fRabT.value.trim(), andrad: new Date().toISOString() };
      if (!o.namn) { toast("Fyll i namnet."); return; }
      const sum = o.villkor.reduce((s0, x) => s0 + x.andel, 0);
      if (o.villkor.length && sum !== 100) { toast("Delbetalningarna ska summera till 100 % (nu " + sum + " %)."); return; }
      if (isNew) {
        const nid = slug(o.namn) || "lev-" + Date.now();
        if (byId(D.lev, nid) || levByName(o.namn)) { toast("Leverantören finns redan."); return; }
        if (await create("leverantorer", nid, o)) { toast("Sparad"); closeSheet(); }
      } else { delete o.namn; if (await write("leverantorer", l._id, o)) { toast("Sparat"); closeSheet(); } }
    }
    const poSec = h("section");
    if (!isNew) {
      const pos = D.po.filter((p) => norm(p.leverantor) === norm(l.namn) && !PO_DRAFT.includes(poStatusNorm(p.status))).sort((a2, b2) => String(b2.orderDatum || "").localeCompare(String(a2.orderDatum || "")));
      poSec.append(h("h3", { class: "sec-title", text: "POs och betalningar (" + pos.length + ")" }));
      if (!pos.length) poSec.append(h("p", { class: "hint", text: "Inga lagda POs." }));
      else poSec.append(h("ul", { class: "mini" }, pos.map((p) => { const pl = paymentPlan(p); const unpaid = pl.filter((x) => !x.betald); return h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openPo(p._id) }, h("span", { class: "tag", text: p.nr || p._id }), h("span", { class: "mini-main" }, h("strong", { text: [p.sasong, p.drop].filter(Boolean).join(" ") + " · " + fmtSEK(poTotal(p)) }), h("span", { class: "sub", text: pl.length ? pl.map((x) => x.typ + " " + fmtTkr(x.belopp) + (x.datum ? " " + fmtDate(x.datum) : "") + (x.betald ? (x.antagenBetald ? " ✔ (antaget)" : " ✔") : "")).join(" · ") : "ingen betalningsplan" })), h("span", { class: "mini-side" }, poStatusPill(p), unpaid.length ? h("span", { class: "sub mono", text: "obetalt " + fmtTkr(unpaid.reduce((s0, x) => s0 + x.belopp, 0)) }) : null))); })));
    }
    const inUse = !isNew && (D.samples.some((s0) => norm(s0.leverantor) === norm(l.namn)) || D.styles.some((s0) => norm(s0.leverantor) === norm(l.namn)) || D.po.some((p) => norm(p.leverantor) === norm(l.namn)));
    openSheet({ tag: isNew ? "Ny" : l.kod || (l.typ || ""), title: isNew ? "Ny leverantör" : l.namn, sub: isNew ? "" : [l.typ || "Producent", l.valuta, termsText(l)].filter(Boolean).join(" · "), body: [form, poSec], foot: footButtons({ onDelete: isNew ? null : async () => { if (await remove("leverantorer", l._id)) { toast("Borttagen"); closeSheet(); } }, canDelete: !inUse, blockText: "Leverantören används av samples, styles eller POs", onSave: save }), focus: isNew ? "f_lnamn" : null });
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
    else if (/^H\d+$/i.test(k)) { if (!loaded.has("handelser")) return; hashDone = true; if (UI.tab !== "coo") switchTab("coo"); openEvent(k.toUpperCase()); }
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

  // ---------- boot ----------
  function showLogin() { $("login").hidden = false; $("loginBtn").addEventListener("click", () => { $("loginBtn").disabled = true; P.signIn(); }); }
  function showUnavailable() {
    banner("Appen kräver att du är inloggad i Claude och har fått sidan delad med dig.");
    loaded.add("samples"); loaded.add("styles"); loaded.add("tyger"); loaded.add("lager"); loaded.add("drops"); loaded.add("po"); loaded.add("ref"); loaded.add("pool");
    VIEWS[UI.tab].update();
  }
  function subError() { banner("Tappade kontakten med databasen. Ladda om sidan."); }
  switchTab(initialTab());
  (async () => {
    let me = null;
    try { me = await P.start(); } catch (e) { console.error(e); banner("Kunde inte läsa databasen: " + (e.message || e)); }
    if (!me) { showLogin(); return; }
    $("login").hidden = true;
    db = P.db; user = P.user; downloads = P.downloads; assets = P.assets;
    if (user) {
      try { myId = await user.id(); } catch (e) {}
      try { if ((await user.can("data.write")) === false) { platformWrite = false; canWrite = false; } } catch (e) {}
      try { canAdmin = !!(await user.canEdit()) || !!(await user.isOwner()); } catch (e) {}
      try { if (myId) { const ps = await user.profiles([myId]); isGuest = !!(ps[myId] && ps[myId].guest); myName = ((ps[myId] && ps[myId].name) || "").split(" ")[0]; } } catch (e) {}
    }
    // Roller och användare läses först, så att rätt flikar visas innan datan kommer.
    const mapDocs = (snap) => snap.docs.map((doc) => Object.assign({}, doc.data(), { _id: doc.id }));
    try {
      const [a, n, r] = await Promise.all([db.collection("anvandare").get(), db.collection("narvaro").get(), db.doc("behorighet/roller").get()]);
      D.anvandare = mapDocs(a); D.narvaro = mapDocs(n); if (r.exists) D.roller = Object.assign({ roller: {}, standardRoll: "team" }, r.data());
    } catch (e) {}
    applyAccess();
    if (myId && platformWrite) { try { const prev = D.narvaro.find((x) => x._id === myId); await db.doc("narvaro/" + myId).set({ senast: new Date().toISOString(), besok: ((prev && num(prev.besok)) || 0) + 1 }); } catch (e) {} }
    db.collection("anvandare").onSnapshot((snap) => { D.anvandare = mapDocs(snap); applyAccess(); scheduleRefresh(); }, () => {});
    db.collection("narvaro").onSnapshot((snap) => { D.narvaro = mapDocs(snap); scheduleRefresh(); }, () => {});
    db.doc("behorighet/roller").onSnapshot((snap) => { if (snap.exists) D.roller = Object.assign({ roller: {}, standardRoll: "team" }, snap.data()); applyAccess(); scheduleRefresh(); }, () => {});
    if (!ME.flikar.length) return;
    switchTab(UI.tab);
    const sub = (coll, key, filter, after) => db.collection(coll).onSnapshot((snap) => {
      D[key] = mapDocs(snap).filter(filter || (() => true));
      loaded.add(key); scheduleRefresh(); openFromHash(); if (after) after();
    }, subError);
    sub("samples", "samples"); sub("styles", "styles", null, () => { probeExternalImages(); renderDiag(); }); sub("tyger", "tyger"); sub("tyglager", "lager"); sub("leverantorer", "lev"); sub("drops", "drops"); sub("po", "po", (p) => !ME.leverantor || norm(p.leverantor) === norm(ME.leverantor)); sub("budget", "budget"); sub("refplagg", "ref"); sub("handelser", "handelser"); sub("shopifypriser", "shopify");
    db.doc("ean/pool").onSnapshot((snap) => { D.pool = snap.exists ? snap.data() : null; loaded.add("pool"); scheduleRefresh(); }, subError);
    db.doc("installningar/app").onSnapshot((snap) => { if (snap.exists) Object.assign(D.settings, snap.data()); scheduleRefresh(); }, subError);
    db.collection("eanLogg").orderBy("t", "desc").limit(50).onSnapshot((snap) => { D.logg = snap.docs.map((doc) => Object.assign({}, doc.data(), { _id: doc.id })); scheduleRefresh(); }, subError);
  })();
})();
