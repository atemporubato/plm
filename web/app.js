import * as P from "./platform.js";
(() => {
  "use strict";
  const APP_URL = location.origin + location.pathname;
  const LIB_PDF = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
  const LIB_QR = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
  const $ = (id) => document.getElementById(id);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const SAMPLE_STATUS = ["Beställd", "Skickad", "Mottagen", "Problem", "Returnerad"];
  const WAITING = ["Beställd", "Skickad"];
  const ACTIVE = ["Beställd", "Skickad", "Problem"];
  const VERSIONS = ["Proto 1", "Proto 2", "Proto 3", "Proto 4", "Proto 5", "Fotosample", "Produktionssample", "Storleksset"];
  const PLATSER = ["Hängare", "Fotohäng", "På plåtning", "Testas", "Utlånad", "Gåva", "Såld", "Hos leverantör", "Arkiv"];
  const PO_PLACED = ["Inskickad", "PO bekräftad", "I produktion", "Skickad", "Inlevererad", "Problem"];
  const FOTOSAMPLE_PO = [["", "– not ordered (ordered automatically when the PO is placed)"], ["Beställd", "Beställd"], ["Inne", "Physically in"], ["Ej aktuell", "Not applicable (restock/NOOS)"]];
  const fotoPoNorm = (v) => { const x = String(v || "").trim(); if (!x) return ""; if (/^inne$|finns|inne|mottag/i.test(x)) return "Inne"; if (/ej aktuell|saknas|nej/i.test(x)) return "Ej aktuell"; return "Beställd"; };
  const BESLUT = ["Godkänd", "Ny runda", "Pausad", "Kastad"];
  const beslutNorm = (b) => (b === "Underkänd" ? "Kastad" : (b || ""));
  // Idéflödet: Carl äger idén tills den är redo. Sedan antingen till Conor (design) eller direkt till Alex.
  // Äldre statusnamn läses som de nya (ingen data skrivs om förrän stylen sparas nästa gång).
  const ST_IDE = "Idé ej redo för design", ST_DESIGN = "Idé redo att designa", ST_KANBEST = "Sample kan beställas";
  const IDEA_STATUS = [ST_IDE, ST_DESIGN, ST_KANBEST];
  const STYLE_STATUS = [ST_IDE, ST_DESIGN, ST_KANBEST, "Sampling", "Godkänd", "PO lagd", "I produktion", "Levererad", "Pausad", "Kastad"];
  const STATUS_GAMLA = { "Skippad": "Kastad", "Produktidé": ST_IDE, "Idé under utveckling": ST_KANBEST };
  const styleStatusNorm = (s) => STATUS_GAMLA[s] || s || "Sampling";
  const isIdea = (st) => !!st && IDEA_STATUS.includes(styleStatusNorm(st.status));
  const TAB_DEFS = [["bibliotek", "Ideas"], ["design", "Design"], ["samples", "Samples"], ["ref", "Ref garments"], ["kollektion", "Collection"], ["produktion", "Production"], ["foto", "Photo"], ["ecom", "E-com"], ["shopify", "Shopify"], ["coo", "Launches"], ["tyglager", "Stock"], ["leverantorer", "Suppliers"]];
  const NEW_TABS = ["coo", "shopify"]; // flikar tillagda efter att roller kan ha sparats – visas tills rollen sparas om
  const NEW_TABS_3 = ["design"]; // tillagda i v10 (flikVersion 3)
  // Tre områden: Produkt är själva PLM-flödet i den ordning plagget rör sig, resten ligger vid sidan av.
  const AREA_TABS = { produkt: ["bibliotek", "design", "samples", "kollektion", "produktion", "foto", "ecom"], planering: ["coo", "leverantorer"], register: ["tyglager", "ref", "ean", "shopify", "anvandare"] };
  const AREA_HEAD = {
    produkt: ["Samples <em>&amp; production</em>", "The product's path: idea, design, sample, collection, order, photo and launch. Every step has an owner."],
    planering: ["Planning <em>&amp; finance</em>", "Launches, timeline and payments. The dates here drive the product flow."],
    register: ["Reference <em>&amp; settings</em>", "What the products draw on: fabric and trims, reference garments, the Shopify link and users."]
  };
  const areaOf = (t) => Object.keys(AREA_TABS).find((a) => AREA_TABS[a].includes(t)) || "produkt";
  const ALL_TABS = TAB_DEFS.map((x) => x[0]);
  const ROLE_DEFAULTS = {
    admin: { namn: "Admin", flikar: ALL_TABS, redigera: true, fast: true },
    team: { namn: "Team", flikar: ALL_TABS, redigera: true },
    design: { namn: "Designer", flikar: ["bibliotek", "design", "samples", "ref", "kollektion", "foto", "coo", "tyglager"], redigera: true },
    junior: { namn: "Junior", flikar: ["bibliotek", "design", "samples", "ref", "kollektion", "coo", "tyglager"], redigera: true },
    formgivare: { namn: "External designer", flikar: ["design"], redigera: true },
    extern: { namn: "External partner", flikar: ["bibliotek", "kollektion"], redigera: false },
    producent: { namn: "Producent", flikar: ["produktion"], redigera: false, leverantor: true },
    ingen: { namn: "No access", flikar: [], redigera: false, fast: true }
  };
  const ROLE_ORDER = ["admin", "team", "design", "junior", "formgivare", "extern", "producent", "ingen"];
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
  const LAGE_TEXT = { gron: "On track", gul: "Tight", rod: "Will be late", okand: "Date missing", ingen: "Set date", paus: "Pausad", skip: "Kastad" };
  const LAGE_ORDER = { rod: 0, gul: 1, okand: 2, gron: 3, ingen: 4, klar: 5, paus: 6, skip: 7 };
  const DROP_NAMES = ["Drop 1", "Drop 2", "Drop 3", "RYC", "Tailoring", "Core"];
  const KATEGORIER = ["Byxor", "Ytterplagg", "Skjortor", "Stickat & Jersey", "Accessoarer", "Skrädderi"];
  // v10.11: Inskickad och I produktion finns inte längre som egna lägen – båda räknas som PO bekräftad (äldre data läses om i poStatusNorm).
  const PO_STATUS = ["Placeholder", "PO bekräftad", "Skickad", "Inlevererad", "Problem", "Avbruten"];
  const PO_OPEN = ["Inskickad", "PO bekräftad", "I produktion", "Skickad", "Problem"];
  const PO_COMMITTED = ["PO bekräftad", "I produktion", "Skickad", "Inlevererad"];
  const PO_PLANNED = ["Placeholder", "Inskickad", "Problem"];
  const PO_DRAFT = ["Placeholder", "Avbruten"];
  const LIB_XLSX = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
  const PO_DEFAULTS = { customer: "Dannefalk & Pers AB", email: "info@atemporubato.com", tel: "0046707994668 / 0046708341212", delivery: "Enhagsslingan 4, 187 40 Täby", invoice: "Strindbergsgatan 31, 115 31 Stockholm — EMAIL INVOICE TO: INVOICE@ATEMPORUBATO.COM", label: "Put on labels and barcodes delivered by customer (Rubato)" };
  const PRIORITET = ["Hög", "Normal", "Låg"];
  const TYGSTATUS_PO = ["Hos fabrik", "Beställt", "På väg", "Saknas", "Eget lager", ""];
  const PO_VALUTOR = ["SEK", "JPY", "EUR", "GBP", "USD"];
  const PO_SKALOR = { "XS–XXL": ["XS", "S", "M", "L", "XL", "XXL"], "44–58": ["44", "46", "48", "50", "52", "54", "56", "58"] };
  const skalaAv = (list) => { if (!list || !list.length) return null; const up = list.map((x) => String(x).trim().toUpperCase()); for (const k of Object.keys(PO_SKALOR)) if (up.every((x) => PO_SKALOR[k].includes(x))) return k; return null; };
  const sortSizes = (list) => { const k = skalaAv(list); if (!k) return list; const o = PO_SKALOR[k]; return list.slice().sort((a, b) => o.indexOf(String(a).trim().toUpperCase()) - o.indexOf(String(b).trim().toUpperCase())); };
  const poStatusNorm = (x) => (x === "Utkast" ? "Placeholder" : PO_STATUS.includes(x) ? x : x ? "PO bekräftad" : "Placeholder");

  // ---------- DOM helpers ----------
  // Engelsk visning av värden som sparas på svenska i databasen (status, kategori, plats …). Listan är tom i källan;
  // den engelska byggen (tools/i18n.mjs) fyller i den. Datan skrivs aldrig om – bara det som visas.
  const EN_VAL = {"Storleksset":"Size set","På plåtning":"At photo shoot","Testas":"Being tested","Utlånad":"On loan","Gåva":"Gift","Såld":"Sold","Hos leverantör":"At supplier","Arkiv":"Archive","Ej aktuell":"Not applicable","Idé ej redo för design":"Idea – not ready for design","Idé redo att designa":"Idea – ready for design","Sample kan beställas":"Sample can be ordered","Delvis slut":"Partly sold out","Utgått":"Discontinued","Rubato (eget lager)":"Rubato (own stock)","Accessoarer":"Accessories","Hög":"High","Låg":"Low","Hos fabrik":"Fabric already at producer","Beställt":"Ordered","På väg":"On its way","Saknas":"Missing","Eget lager":"Own stock","Hängare":"Hanger","Planerade":"Planned","Bokad":"Booked","Planerad":"Planned","Tyg":"Fabric","Producent":"Manufacturer","Övrigt":"Other","Okända":"Unknown","Nej":"No","Ja":"Yes","Ej betalt":"Not paid","Betalt":"Paid","Skickat":"Sent","Hos leverantören":"At the supplier","På väg tillbaka":"On its way back","Förlorat":"Lost","Mottagen":"Received","Beställd":"Ordered","Skickad":"Shipped","Returnerad":"Returned","Fotosample":"Photo sample","Produktionssample":"Production sample","Fotohäng":"Photo rail","Inskickad":"Submitted","PO bekräftad":"PO confirmed","I produktion":"In production","Inlevererad":"Delivered","Inne":"In","Godkänd":"Approved","Ny runda":"New round","Pausad":"Paused","Kastad":"Dropped","Underkänd":"Rejected","Skippad":"Dropped","PO lagd":"PO placed","Levererad":"Delivered","Nyhet":"New","Slut":"Sold out","I lager":"In stock","Förbrukad":"Used up","Byxor":"Trousers","Skrädderi":"Tailoring","Skjortor":"Shirts","Stickat & Jersey":"Knitwear & Jersey","Ytterplagg":"Outerwear","Avbruten":"Cancelled","Utkast":"Draft","Inställd":"Cancelled","Fotade":"Shot","Retuscherade":"Retouched","Publicerade":"Published","Fotad":"Shot","Klar":"Done","Utan säsong":"No season","Okategoriserat":"Uncategorised","Bekräftade":"Confirmed","Att förhandla":"To negotiate","Tillbaka hos Rubato":"Back at Rubato","Pågår":"Ongoing","Förfallet":"Overdue","Senare":"Later","Löst":"Resolved","Öppen":"Open","beräknad":"estimated","Produktidé":"Idea – not ready for design","Idé under utveckling":"Sample can be ordered","Restock":"Re-stock"};
  const tv = (s) => { if (typeof s !== "string" || !s) return s; const v = EN_VAL[s]; if (v != null) return v; if (s.includes(" · ")) return s.split(" · ").map(tv).join(" · "); const m = /^(.*\D) (\d+[a-z]?)$/.exec(s); return m && EN_VAL[m[1]] != null ? EN_VAL[m[1]] + " " + m[2] : s; };
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = tv(v);
      else if (k === "dataset") Object.assign(e.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (typeof v !== "string" && k in e) e[k] = v;
      else e.setAttribute(k, v === true ? "" : (k === "title" || k === "placeholder" || k === "aria-label") ? tv(String(v)) : String(v));
    }
    for (const k of kids.flat(2)) if (k != null && k !== false) e.append(k.nodeType ? k : tv(String(k)));
    return e;
  }
  function inp(id, value, attrs) { const e = h("input", Object.assign({ id, type: "text" }, attrs || {})); e.value = value == null ? "" : String(value); return e; }
  function area(id, value, placeholder) { const e = h("textarea", { id, placeholder: placeholder || null }); e.value = value == null ? "" : String(value); return e; }
  function selectEl(id, options, value) {
    const e = h("select", { id });
    for (const o of options) { const [v, l] = Array.isArray(o) ? o : [o, o]; e.add(new Option(tv(l), v)); }
    const val = value == null ? "" : String(value);
    const has = [...e.options].some((o) => o.value === val);
    if (!has && val !== "") e.add(new Option(tv(val), val));
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
  // Problem-status i listan är klickbar: visar vad problemet är utan att öppna hela samplen.
  const problemPill = (items) => { const ps = items.filter((x) => x.status === "Problem"); if (!ps.length) return statusPill(items[0] && items[0].status); return h("button", { class: "pill s-Problem clickable", type: "button", text: "Problem" + (ps.length > 1 ? " ×" + ps.length : ""), title: "Show the problem", onclick: (e) => { e.stopPropagation(); openProblem(ps); } }); };
  function openProblem(ps) {
    const body = ps.map((x) => h("section", { class: "panel", style: "margin-bottom:10px" },
      h("h3", { class: "sec-title", text: styleName(x) + " · " + (sampleFarg(x) || x._id) + " · " + (x.version || "") }),
      h("p", { style: "font-size:16px;margin:6px 0", text: x.kommentar || "No problem described – open the sample and write what is wrong." }),
      x.andringar ? h("p", { class: "sub", text: "Changes: " + x.andringar }) : null,
      h("p", { class: "sub", text: [x._id, x.leverantor, isISO(x.bestalld) ? "ordered " + fmtDate(x.bestalld) : "", expected(x) ? "expected " + fmtDate(expected(x)) : ""].filter(Boolean).join(" · ") }),
      h("div", { class: "quick" }, h("button", { class: "btn small", type: "button", text: "Open sample", onclick: () => openSample(x._id) }), canWrite && db ? h("button", { class: "btn small", type: "button", text: "Problem solved → Ordered", onclick: async () => { await write("samples", x._id, { status: "Beställd", andrad: new Date().toISOString(), logg: (x.logg || []).concat(logEntry("Problem marked as solved")) }); closeSheet(); } }) : null)));
    openSheet({ tag: "Problem", title: ps.length === 1 ? styleName(ps[0]) : ps.length + " samples with problems", sub: "", body, foot: footButtons({}) });
  }
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
  const fmtDays = (n) => (n < 0 ? (-n) + " d late" : n === 0 ? "today" : n + " d left");

  // ---------- state ----------
  const D = { flaggor: [], samples: [], styles: [], tyger: [], lager: [], lev: [], drops: [], po: [], budget: [], ref: [], pool: null, logg: [], settings: { utvarderingDagar: 7, standardFrakt: 7, marginalGul: 14 }, anvandare: [], narvaro: [], roller: { roller: {}, standardRoll: "team" }, handelser: [], shopify: [] };
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
    try { localStorage.setItem("rubato-samples-v5", JSON.stringify({ tab: UI.tab, bibliotek: { mode: UI.bibliotek.mode, season: UI.bibliotek.season, kat: UI.bibliotek.kat, lev: UI.bibliotek.lev, status: UI.bibliotek.status }, samples: { status: UI.samples.status, group: UI.samples.group, lev: UI.samples.lev, season: UI.samples.season, plats: UI.samples.plats }, drops: { season: UI.drops.season }, styles: { status: UI.styles.status, lev: UI.styles.lev, season: UI.styles.season }, prod: { status: UI.prod.status, lev: UI.prod.lev, season: UI.prod.season }, koll: UI.koll, foto: { season: UI.foto.season, typ: UI.foto.typ, touched: UI.foto.touched }, ecom: { season: UI.ecom.season, touched: UI.ecom.touched }, coo: { mode: UI.coo.mode, typer: UI.coo.typer, agare: UI.coo.agare, season: UI.coo.season, visaAuto: UI.coo.visaAuto }, lager: { status: UI.lager.status, plats: UI.lager.plats, group: UI.lager.group, typ: UI.lager.typ } })); } catch (e) {}
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
  const styleName = (s) => { const st = styleOf(s); return st ? st.namn : (s.produkt || "No style"); };
  const tygOf = (s) => (s ? byId(D.tyger, s.tygId) : null);
  const tygName = (s) => { const t = tygOf(s); return t ? t.namn : (s.material || ""); };
  const seasonOf = (s) => { if (s.sasong) return s.sasong; const st = styleOf(s); return (st && st.sasong) || ""; };
  const isArchived = (s) => { if (["Kastad", "Pausad"].includes(beslutNorm(s.beslut))) return true; const st = styleOf(s); return !!st && ["Pausad", "Kastad"].includes(styleStatusNorm(st.status)); };
  const platsText = (s) => (!s.platsTyp ? "" : s.platsTyp === "Hängare" ? "Hanger " + (s.hangare || "?") : s.platsTyp === "Fotohäng" ? "Fotohäng" + (s.hangare ? " " + s.hangare : "") : s.platsTyp);
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
  // ---- drop-register ----
  // Ett register för alla drops: dokumenten i "drops" plus Jakobs drop-rader i COO (händelser med matris "drop").
  // Lanseringen ägs av COO-raden. "I lager senast" = lansering minus marginalen (5 dagar), om droppen inte har ett eget datum.
  // D.drops och D.po är härledda vyer av RAW.drops och RAW.po – allt som läser dem får samma svar; bara formulären skriver råvärden.
  const RAW = { drops: [], po: [] };
  const lagerMarginal = () => num(D.settings.lagerMarginal) ?? 5;
  const dropNr = (namn) => { const m = /(\d+)/.exec(String(namn || "")); return m ? Number(m[1]) : 99; };
  function cooDropRows() {
    const rows = new Map(); const tbd = (x) => /^TBD\s/i.test(x.titel || "");
    for (const e of D.handelser || []) {
      if (e.matris !== "drop" || e.hor_till || e.status === "Inställd" || !String(e.sasong || "").trim() || !String(e.drop || "").trim()) continue;
      const k = dropKey(e.sasong, e.drop); const cur = rows.get(k);
      if (!cur || (tbd(cur) && !tbd(e)) || (tbd(cur) === tbd(e) && String(e.datum || "9") < String(cur.datum || "9"))) rows.set(k, e);
    }
    return rows;
  }
  function effDrop(doc, ev) {
    const lans = ev && isISO(ev.datum) ? ev.datum : (isISO(doc.lansering) ? doc.lansering : null);
    const eget = isISO(doc.klartSenast) ? doc.klartSenast : null;
    return Object.assign({}, doc, { lansering: lans, klartSenast: eget || (lans ? addDays(lans, -lagerMarginal()) : null), _doc: doc, _coo: ev ? ev._id : null, _klartEget: !!eget });
  }
  function deriveDrops() {
    const rows = cooDropRows(); const seen = new Set(); const out = [];
    for (const d of RAW.drops) { const k = dropKey(d.sasong, d.namn); seen.add(k); out.push(effDrop(d, rows.get(k) || null)); }
    for (const [k, e] of rows) if (!seen.has(k)) out.push(effDrop({ _id: slug(e.sasong.trim() + "-" + e.drop.trim()), sasong: e.sasong.trim(), namn: e.drop.trim(), ordning: dropNr(e.drop), klartSenast: null, lansering: null, kommentar: "", _virtual: true }, e));
    D.drops = out;
  }
  // PO:ns drop följer stylarna på raderna (samma säsong). Har ingen style en drop gäller det som står på PO:n.
  function poStyleDrops(p) {
    const out = [];
    for (const r of p.rader || []) { const st = r.styleId ? byId(D.styles, r.styleId) : null; const dn = st ? String(st.drop || "").trim() : ""; if (dn && norm(st.sasong) === norm(p.sasong) && !out.some((x) => norm(x) === norm(dn))) out.push(dn); }
    return out.sort((a, b) => a.localeCompare(b, "sv"));
  }
  function derivePo() {
    // Saknar PO:n leverantör tas den ur prefixet i PO-numret (EMI-… = Eminento).
    const levAvNr = (p) => { if (p.leverantor) return p; const kod = String(p.nr || p._id || "").split("-")[0].toUpperCase(); const l = kod ? D.lev.find((x) => String(x.kod || "").toUpperCase() === kod) : null; return l ? Object.assign({}, p, { leverantor: l.namn }) : p; };
    D.po = RAW.po.map(levAvNr).map((p) => { const ds = poStyleDrops(p); const raw = String(p.drop || "").trim(); return ds.length && !p.dropEgen ? Object.assign({}, p, { drop: ds.join(" + "), _drops: ds, _dropRaw: raw, _dropFranStyles: true }) : Object.assign({}, p, { _drops: raw ? [raw] : [], _dropRaw: raw, _dropFranStyles: false }); });
  }
  // Vad en flyttad lansering betyder för leveranserna: nytt "i lager senast" och vilka PO som inte hinner.
  function launchImpact(sasong, dropNamn, nyLansering) {
    if (!isISO(nyLansering) || !String(dropNamn || "").trim()) return null;
    const d = D.drops.find((x) => dropKey(x.sasong, x.namn) === dropKey(sasong, dropNamn));
    const eget = !!(d && d._klartEget);
    const klart = eget ? d._doc.klartSenast : addDays(nyLansering, -lagerMarginal());
    const pos = D.po.filter((p) => !["Avbruten", "Inlevererad"].includes(poStatusNorm(p.status)) && norm(p.sasong) === norm(sasong) && (p._drops || []).some((n) => norm(n) === norm(dropNamn)));
    const rows = pos.map((p) => ({ po: p, eta: poEta(p) || (isISO(p.leveransOnskad) ? p.leveransOnskad : null) }));
    return { klart, eget, pos, sena: rows.filter((x) => x.eta && x.eta > klart).map((x) => Object.assign(x, { dagar: daysBetween(klart, x.eta) })), utanEta: rows.filter((x) => !x.eta) };
  }
  function launchImpactText(sasong, dropNamn, nyLansering) {
    const i = launchImpact(sasong, dropNamn, nyLansering); if (!i) return "";
    return "In stock by " + (i.eget ? "stays at " + fmtDate(i.klart) + " (the drop has its own date)" : "becomes " + fmtDate(i.klart)) + ". " +
      (i.sena.length ? i.sena.length + " PO will be late: " + i.sena.map((x) => (x.po.nr || x.po._id) + " (+" + x.dagar + " d)").join(", ") + "." : i.pos.length ? "All " + i.pos.length + " PO are on time." : "No open PO in the drop.") +
      (i.utanEta.length ? " " + i.utanEta.length + " PO have no ETA." : "");
  }
  // Rullistor i stället för fritext, så att säsong och drop alltid pekar på registret.
  function seasonSelect(id, value, emptyLabel) {
    const y = new Date().getFullYear() % 100; const gen = []; for (let i = y - 1; i <= y + 2; i++) gen.push("SS" + i, "AW" + i);
    const seen = new Set();
    const all = gen.concat(D.drops.map((d) => d.sasong), D.styles.map((s) => s.sasong), D.po.map((p) => p.sasong)).map((x) => String(x || "").trim()).filter((x) => { const k = norm(x); if (!x || seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => seasonRank(a) - seasonRank(b) || a.localeCompare(b, "sv"));
    return selectEl(id, [["", emptyLabel || "– No season –"]].concat(all.map((x) => [x, x])), value || "");
  }
  function dropSelect(id, value, seasonEl) {
    const e = h("select", { id });
    const names = () => dropsOfSeason(seasonEl.value).map((d) => d.namn);
    e.refill = (keep) => {
      const ns = names(); const hit = ns.find((n) => norm(n) === norm(keep));
      e.replaceChildren(new Option("– No drop, season only –", ""), ...ns.map((n) => new Option(n, n)));
      if (keep && !hit) e.add(new Option(keep + " (not a drop in " + (seasonEl.value || "the season") + ")", keep));
      e.value = hit || keep || "";
    };
    e.refill(String(value || "").trim());
    seasonEl.addEventListener("change", () => { const cur = e.value; e.refill(names().some((n) => norm(n) === norm(cur)) ? cur : ""); e.dispatchEvent(new Event("change")); });
    return e;
  }
  const dropOf = (st) => (st.sasong && st.drop ? D.drops.find((d) => dropKey(d.sasong, d.namn) === dropKey(st.sasong, st.drop)) || null : null);
  const dropsOfSeason = (season) => D.drops.filter((d) => norm(d.sasong) === norm(season)).sort((a, b) => (num(a.ordning) ?? 99) - (num(b.ordning) ?? 99) || (a.namn || "").localeCompare(b.namn || "", "sv"));
  function deadlineOf(st) {
    if (isISO(st.klartSenast)) return { date: st.klartSenast, from: "style" };
    const d = dropOf(st);
    return d && isISO(d.klartSenast) ? { date: d.klartSenast, from: "drop" } : null;
  }
  const nextEta = (st) => { const etas = (Array.isArray(st.produktion) ? st.produktion : []).filter((r) => r.status !== "Inlevererad" && isISO(r.eta)).map((r) => r.eta).sort(); return etas[0] || null; };
  const lageCell = (st, p) => { if (p.lage === "klar") { const e = nextEta(st); return e ? [h("span", { class: "sub", text: "ETA warehouse " }), h("span", { class: "mono", text: fmtDate(e) })] : [h("span", { class: "muted", text: "–" })]; } return [lagePill(p)]; };
  const fmtM = (n) => Number(n).toLocaleString("sv-SE", { maximumFractionDigits: 1 });
  const fmtSEK = (n) => (n == null || isNaN(n) ? "–" : Math.round(Number(n)).toLocaleString("sv-SE") + " SEK");
  const fmtTkr = (n) => (n == null || isNaN(n) ? "–" : (Math.round(Number(n) / 1000)).toLocaleString("sv-SE") + " k SEK");
  // Styckpris på raden, annars stylens inköpspris (originalvaluta × dagens kurs) – så att restocks räknas rätt utan att priset skrivs om.
  const lineUnit = (r) => { const p = num(r.styckpris); if (p != null) return { pris: p, kalla: "rad" }; const st = r.styleId ? byId(D.styles, r.styleId) : null; if (st && num(st.inkopspris) && fx(st.inkopsValuta || "SEK")) return { pris: num(st.inkopspris) * fx(st.inkopsValuta || "SEK"), kalla: "style" }; return null; };
  const lineCost = (r) => { const a = num(r.antal), u = lineUnit(r), t = num(r.tygkostnad) || 0; return a == null || !u ? (num(r.kostnad) ?? null) : a * (u.pris + t); };
  const poTotal = (po) => (po.rader || []).reduce((a, r) => a + (lineCost(r) || 0), 0);
  const poUnits = (po) => (po.rader || []).reduce((a, r) => a + (num(r.antal) || 0), 0);
  const poSeason = (po) => po.sasong || "";
  const poLinesOf = (styleId) => { const out = []; for (const po of D.po) for (const r of po.rader || []) if (r.styleId === styleId) out.push({ po, r }); return out; };
  // Försenad leverans: ETA lager ligger efter droppens "I lager senast". Räknas fram, sparas inte – försvinner när ETA ändras eller PO:n är inlevererad.
  function poLate(p) {
    if (!p || ["Avbruten", "Inlevererad"].includes(poStatusNorm(p.status))) return null;
    const eta = poEta(p); if (!eta) return null;
    const d = (p._drops && p._drops.length ? p._drops : [p.drop]).map((n) => dropOf({ sasong: p.sasong, drop: n })).filter((x) => x && isISO(x.klartSenast)).sort((a, b) => a.klartSenast.localeCompare(b.klartSenast))[0];
    if (!d || eta <= d.klartSenast) return null;
    return { eta, klart: d.klartSenast, dagar: daysBetween(d.klartSenast, eta), drop: d };
  }
  const poLateText = (p, l) => "ETA warehouse " + fmtDate(l.eta) + " – " + l.dagar + (l.dagar === 1 ? " day" : " days") + " after in stock by " + fmtDate(l.klart) + " (" + [l.drop.sasong, l.drop.namn].filter(Boolean).join(" ") + ")";
  const poStatusPill = (po) => { const x = poStatusNorm(po.status); const pill = h("span", { class: "pill ps-" + slug(x), text: x }); const l = poLate(po); return l ? h("span", { style: "display:inline-flex;gap:6px;align-items:center" }, pill, h("span", { class: "pill s-Problem", title: poLateText(po, l), text: "Problem · late " + l.dagar + " d" })) : pill; };
  // Regel (v10.12): ETA lager = ex-factory + 5 dagar, överallt. Ett sparat ETA-datum används bara när PO:n saknar ex-factory.
  const ETA_DAGAR = 5;
  const poEx = (po) => (isISO(po.bekraftadEx) ? po.bekraftadEx : isISO(po.planeradEx) ? po.planeradEx : null);
  const poEta = (po) => { const ex = poEx(po); return ex ? addDays(ex, ETA_DAGAR) : isISO(po.etaLager) ? po.etaLager : null; };
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
  const lotName = (l) => { const t = tygOf(l); return t ? t.namn : (l.tygNamn || "Unknown fabric"); };
  // Lager: partier är antingen tyg (meter) eller trims (antal st). Partier utan typ är tyg.
  const isTrims = (l) => !!l && l.typ === "trims";
  const lotQty = (l) => num(isTrims(l) ? l.antal : l.meter);
  const fmtSt = (n) => Math.round(Number(n)).toLocaleString("sv-SE") + " pcs";
  const fmtQty = (l, n) => (isTrims(l) ? fmtSt(n) : "approx. " + fmtM(n) + " m");
  const reservedName = (l) => { const st = l.reserveradFor ? byId(D.styles, l.reserveradFor) : null; return st ? st.namn : ""; };
  function stockSummary(tygId) {
    const lots = lotsOf(tygId).filter((l) => l.status === "I lager");
    const known = lots.filter((l) => num(l.meter) != null);
    return { lots, meter: known.reduce((a, l) => a + num(l.meter), 0), known: known.length, unknown: lots.length - known.length, platser: uniq(lots.map((l) => l.plats)), bestallda: lotsOf(tygId).filter((l) => l.status === "Beställd").length };
  }
  function stockText(tygId) {
    const s = stockSummary(tygId);
    if (!s.lots.length) return s.bestallda ? s.bestallda + (s.bestallda === 1 ? " batch ordered" : " batches ordered") : "";
    const parts = [];
    if (s.known) parts.push("approx. " + fmtM(s.meter) + " m");
    if (s.unknown) parts.push(s.unknown + (s.unknown === 1 ? " batch without metres" : " batches without metres"));
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
  const shopTitle = (st) => (st && st.shopifyBild ? (st.shopifyBild.titel || "Shopify") + (st.shopifyBild.likhet === "liknande" ? " (similar product)" : "") : "");
  // Färgnamn -> ungefärlig färg för chipsens prick. Först träff vinner; okänd färg blir grå.
  const COLOUR_MAP = [
    [/signal red|röd|\bred\b|persimmon|rust|brick|wine|burgundy|bordeaux/, "#b5362f"],
    [/dark navy|navy|marin|midnight|deep\b|blu scuro|dark blue/, "#1f2a44"],
    [/light blue|sky|new haven|chambray|celeste/, "#9fb9d6"],
    [/indigo|denim|blue rinse|rinse|dark blue rinse|\bblue\b|blå|blu\b/, "#2f4f8a"],
    [/black|svart|nero|charcoal|anthracite|onyx/, "#1a1a1a"],
    [/ecru|cream|ivory|off.?white|vellum|bianco|natural|undyed|chalk|bone/, "#efe8d8"],
    [/\bwhite\b|vit\b|optical/, "#f7f7f5"],
    [/khaki|olive|olive drab|sage|army|moss|green|grön|verde|forest/, "#6b6a3e"],
    [/shale/, "#4f4f4f"],
    [/earth|coffee|kaffe|cafe|espresso/, "#6f4e37"],
    [/birch|driftwood/, "#a8957a"],
    [/dark brown|dk brown|chocolate|dale/, "#3a281c"],
    [/brown|brun/, "#4e3524"],
    [/tobacco|tan|camel|cognac|peak|dun|clay|tankard|rust/, "#8a6a4a"],
    [/beige|sand|stone|oat|marble|taupe|dune|cloud|storm|putty/, "#c9bca6"],
    [/grey|gray|grå|grigio|silver|slate|mid grey|light grey/, "#8d8d8d"],
    [/yellow|gul|mustard|ochre|gold/, "#c9a227"],
    [/orange|apricot|peach|coral/, "#d8793a"],
    [/pink|rosa|rose|blush/, "#d9a3ad"],
    [/purple|lilac|violet|plum|aubergine/, "#6b4a7a"],
    [/stripe|hundtand|check|houndstooth|herringbone/, "#5c5c5c"]
  ];
  const colourHex = (name) => { const n = String(name || "").toLowerCase(); for (const [re, hex] of COLOUR_MAP) if (re.test(n)) return hex; return ""; };
  const colourDot = (name, extraClass) => { const hex = colourHex(name); return h("i", { class: "dot cdot" + (extraClass ? " " + extraClass : ""), style: hex ? "background:" + hex + (/^#(f|e)/.test(hex) ? ";border:1px solid #bbb" : "") : "", title: name || "" }); };
  const fargText = (f) => { const raw = String(f || "").trim(); const words = raw.replace(/^(?:col(?:ou?r)?\.?\s*)?[#0-9][0-9a-z]*[\s.:\-–]+/i, "").split(/[\s,]+/).filter(Boolean); const kept = words.filter((w) => !/\d/.test(w) && !/^col(?:ou?r)?\.?$/i.test(w)); const out = (kept.length ? kept : words).join(" ").replace(/[\s.:\-–]+$/, ""); return out ? out[0].toUpperCase() + out.slice(1) : raw; };
  // De 15 vanligaste färgerna i Shopify (räknat på produkttitlar i hela katalogen, 23 nov 2026). Rullistan för färg utgår från dem.
  const FARGER_STD = ["Navy", "Black", "Brown", "Cream", "White", "Natural", "Ecru", "Khaki", "Dark Brown", "Indigo", "Charcoal", "Beige", "Tobacco", "Pink", "Olive"];
  // En sample kan ha flera färger (farger). Äldre samples har bara farg – den läses som en färg. farg sparas alltid med (färgerna med komma emellan).
  const sampleColours = (x) => { const a = x && Array.isArray(x.farger) ? x.farger.map((c) => String(c || "").trim()).filter(Boolean) : []; return a.length ? a : x && x.farg ? [String(x.farg)] : []; };
  const sampleFarg = (x) => sampleColours(x).map((c) => fargText(c) || c).join(", ");
  const colourChips = (x) => sampleColours(x).map((c) => h("span", { class: "swatch" }, colourDot(fargText(c) || c), fargText(c) || c));
  // Rullista per färg + "Lägg till färg". Första rullistan får id:t, så etiketten pekar rätt.
  function colourPicker(id, values, ro) {
    const OTHER = "__annan";
    const list = h("div", { class: "colours" });
    const rows = []; let seq = 0;
    const addBtn = ro ? null : h("button", { class: "btn small add", type: "button", text: "+ Add colour", onclick: () => addRow("", true) });
    const syncRm = () => rows.forEach((r) => { if (r.rm) r.rm.hidden = rows.length < 2; });
    function addRow(val, focus) {
      const v = String(val || "").trim();
      const std = FARGER_STD.find((c) => norm(c) === norm(v));
      const rid = seq++ ? id + "_" + seq : id;
      const sel = selectEl(rid, [["", "Choose colour …"]].concat(FARGER_STD.map((c) => [c, c]), [[OTHER, "Other colour …"]]), std || (v ? OTHER : ""));
      const txt = inp(rid + "_txt", std ? "" : v, { placeholder: "Type the colour", "aria-label": "Other colour" });
      const dot = h("span");
      const r = { get: () => (sel.value === OTHER ? txt.value.trim() : sel.value), rm: null };
      r.rm = ro ? null : h("button", { class: "btn small rm", type: "button", text: "×", title: "Remove colour", "aria-label": "Remove colour", onclick: () => { rows.splice(rows.indexOf(r), 1); r.el.remove(); syncRm(); } });
      r.el = h("div", { class: "colour-row" }, dot, sel, txt, r.rm);
      const sync = () => { const other = sel.value === OTHER; txt.hidden = !other; r.el.classList.toggle("other", other); dot.replaceChildren(colourDot(r.get())); };
      sel.addEventListener("change", () => { sync(); if (sel.value === OTHER) txt.focus(); });
      txt.addEventListener("input", sync);
      if (ro) { sel.disabled = true; txt.disabled = true; }
      rows.push(r); if (addBtn) list.insertBefore(r.el, addBtn); else list.append(r.el);
      sync(); syncRm();
      if (focus) sel.focus();
    }
    if (addBtn) list.append(addBtn);
    const vs = (values || []).filter(Boolean);
    (vs.length ? vs : [""]).forEach((v) => addRow(v));
    return { el: list, get: () => rows.map((r) => r.get()).filter(Boolean).filter((v, i, a) => a.findIndex((x) => norm(x) === norm(v)) === i) };
  }
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
    el.hidden = true; el.replaceChildren(); // rutan visas inte längre (v10.9)
  }
  async function importShopifyImages() {
    if (!assets) { toast("Requires Contributor access or higher."); return; }
    const todo = shopTodo();
    if (!todo.length) { toast("All Shopify images have already been fetched into the app."); return; }
    let ok = 0, fail = 0; const failed = [];
    banner("Fetching " + todo.length + " images from Shopify into the app …");
    for (const s0 of todo) {
      try {
        const u = new URL(shopUrl(s0)); u.searchParams.set("width", "1200");
        const blob = await hostedBild(u.toString());
        const file = new File([blob], "shopify.jpg", { type: blob.type || "image/jpeg" });
        const small = await shrinkImage(file, 1600);
        if (!small) throw new Error("Not an image");
        const r = await assets.upload(small, small.type ? undefined : { type: "image/jpeg" });
        const cur = byId(D.styles, s0._id) || s0;
        const now = new Date().toISOString();
        if (await write("styles", s0._id, { bilder: docImages(cur).concat([r.id]), bildId: cur.bildId || r.id, andrad: now, logg: (cur.logg || []).concat(logEntry("Shopify image fetched into the app: " + shopTitle(cur))) })) ok++; else { fail++; failed.push(s0.namn); }
      } catch (e) { fail++; failed.push(s0.namn + " – " + String((e && e.message) || e).slice(0, 120)); }
      banner("Fetching images … " + (ok + fail) + " of " + todo.length);
    }
    banner(fail ? "Could not fetch " + fail + " of " + todo.length + " images (" + failed.slice(0, 4).join(", ") + (failed.length > 4 ? " …" : "") + "). Check the Shopify address on the style, or upload the image yourself." : "");
    if (ok) extImg = null;
    toast(ok + (ok === 1 ? " image fetched" : " images fetched") + (fail ? ", " + fail + " failed" : ""));
    renderActions();
  }
  const imageSource = (st) => { const img = styleImage(st); if (!img) return ""; if (img === shopUrl(st)) return "Shopify"; if (samplesOfStyle(st._id).some((x) => sampleImages(x).includes(img))) return "Sample"; if (st.bildAuto && img === st.bildId) return st.farger && st.farger.length > 1 && (st.bilder || []).length > 1 ? "Colour overview" : "Shopify"; const g = st.grundId ? byId(D.styles, st.grundId) : null; if (g && (img === g.bildId || docImages(g)[0] === img || img === shopUrl(g))) return "Base style"; return ""; };
  const styleAllImages = (st) => uniq(docImages(st).concat(st.bildId ? [st.bildId] : [], st._id ? samplesOfStyle(st._id).flatMap(sampleImages) : [], shopUrl(st) ? [shopUrl(st)] : []));
  const grundOf = (st) => (st && st.grundId ? byId(D.styles, st.grundId) : null);
  const variantsOf = (id) => D.styles.filter((s) => s.grundId === id).sort((a, b) => seasonRank(b.sasong) - seasonRank(a.sasong) || (a.namn || "").localeCompare(b.namn || "", "sv"));
  const isGrund = (s) => !!s && (!!s.grund || D.styles.some((v) => v.grundId === s._id));
  const grundStyles = () => D.styles.filter(isGrund).sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv"));
  const styleTyg = (st) => { const t = st && st.tygId ? byId(D.tyger, st.tygId) : null; return t ? t.namn : (st && st.tygNamn) || ""; };
  const refName = (id) => { if (!id) return ""; const st = byId(D.styles, id); if (st) return st.namn; const s = byId(D.samples, id); return s ? styleName(s) + (s.version ? " · " + s.version : "") + " (" + s._id + ")" : String(id); };
  const fotoSamplesOf = (st) => samplesOfStyle(st._id).filter((x) => (x.version === "Fotosample" || x.version === "Produktionssample") && !isArchived(x));
  function fotoState(st) {
    const xs = fotoSamplesOf(st);
    const got = xs.filter((x) => x.status === "Mottagen");
    if (got.length) { const onRack = got.find((x) => x.platsTyp === "Fotohäng") || got[0]; return { key: "finns", label: "Physically in" + (platsText(onRack) ? " · " + platsText(onRack) : ""), sample: onRack, all: got, onRack: got.some((x) => x.platsTyp === "Fotohäng") }; }
    const wait = xs.filter(isWaiting);
    if (wait.length) { const e = wait.map(expected).filter(Boolean).sort()[0]; return { key: "vantas", label: "Beställd" + (e ? " · expected " + fmtDate(e) : " · date missing"), sample: wait[0], all: wait }; }
    const pos = poLinesOf(st._id).map((x) => x.po).filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status)));
    const po = pos.find((p) => fotoPoNorm(p.fotosample) === "Inne");
    if (po) return { key: "finns", label: "Physically in (per PO " + (po.nr || "") + ")", sample: null, all: [], onRack: false };
    const po2 = pos.find((p) => fotoPoNorm(p.fotosample) === "Beställd");
    if (po2) return { key: "vantas", label: "Ordered via PO " + (po2.nr || "") + (isISO(po2.fotosampleLeverans) ? " · expected " + fmtDate(po2.fotosampleLeverans) : ""), sample: null, all: [] };
    const any = samplesOfStyle(st._id).find((x) => x.status === "Mottagen" && beslutNorm(x.beslut) === "Godkänd" && !isArchived(x));
    if (any) return { key: "godkand", label: "Not ordered · an approved sample can be photographed", sample: any, all: [] };
    return { key: "saknas", label: "Not ordered", sample: null, all: [] };
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
      const body = { id: nid, styleId: st._id, produkt: st.namn, version: "Fotosample", leverantor: lev, farg, tygId: st.tygId || (last ? last.tygId : null) || null, material: "", storlek: "", sasong: st.sasong || (p0 && p0.sasong) || "", prisBelopp: null, prisValuta: null, status: "Beställd", bestalld: start, ledtid: sl, forvantad: forv, mottagen: null, tracking: "", p1Skickad: null, p2Skickad: null, platsTyp: "", hangare: "", platsNotering: "", beslut: "", utvarderad: false, markt: false, mattGodkanda: null, mattKommentar: "", andringar: "", kommentar: p0 ? "Photo sample for PO " + (p0.nr || p0._id) : "Fotosample", bilder: [], fotosampleViaPo: p0 ? (p0.nr || p0._id) : "", logg: [logEntry("Photo sample ordered" + (p0 ? " via PO " + (p0.nr || p0._id) : "") + (who ? " – initiated by " + who : ""))], andrad: new Date().toISOString() };
      if (await create("samples", nid, body)) { if (!byId(D.samples, nid)) D.samples.push(Object.assign({}, body, { _id: nid })); made.push(nid); }
    }
    if (made.length) await write("styles", st._id, { andrad: new Date().toISOString(), logg: (st.logg || []).concat(logEntry("Photo sample ordered: " + made.join(", ") + (p0 ? " (PO " + (p0.nr || p0._id) + ")" : ""))) });
    return made;
  }
  // Bilder: allt webbläsaren kan läsa plus HEIC/HEIF (iPhone). Allt som inte redan är en liten JPG/PNG/WebP/GIF
  // görs om till JPG, högst `max` pixlar på längsta sidan (ingen beskärning – hela bilden behålls).
  const IMG_ACCEPT = "image/*,.heic,.heif,.avif";
  const IMG_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif|tiff?|svg)$/i;
  const isImageFile = (f) => /^image\//.test(f.type || "") || IMG_EXT.test(f.name || "");
  const isHeic = (f) => /hei[cf]/i.test(f.type || "") || /\.(heic|heif)$/i.test(f.name || "");
  let heicLib = null;
  const loadHeic = () => heicLib || (heicLib = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/heic-to@1.6.7/dist/iife/heic-to.js";
    s.onload = () => (typeof window.HeicTo === "function" ? res(window.HeicTo) : rej(new Error("heic")));
    s.onerror = () => { heicLib = null; rej(new Error("heic")); };
    document.head.append(s);
  }));
  const viaImg = (file) => new Promise((res) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => res(im); im.onerror = () => { URL.revokeObjectURL(u); res(null); }; im.src = u; });
  async function decodeImage(file) {
    try { return await createImageBitmap(file); } catch (e) {}
    const im = await viaImg(file); if (im && im.naturalWidth) return im;
    if (isHeic(file) || !/^image\/(jpeg|png|webp|gif)$/.test(file.type || "")) { try { const heicTo = await loadHeic(); return await heicTo({ blob: file, type: "bitmap" }); } catch (e) {} }
    return null;
  }
  async function shrinkImage(file, max) {
    const t = file.type || "";
    if (t === "image/svg+xml" || /\.svg$/i.test(file.name || "")) return file;
    const webSafe = /^image\/(jpeg|png|webp|gif)$/.test(t);
    const bmp = await decodeImage(file);
    if (!bmp) return webSafe ? file : null;
    const bw = bmp.naturalWidth || bmp.width, bh = bmp.naturalHeight || bmp.height;
    const k = Math.min(1, max / Math.max(bw, bh));
    if (k >= 1 && webSafe && file.size < 1.5e6) return file;
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bw * k)); c.height = Math.max(1, Math.round(bh * k));
    const ctx = c.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.86));
    return blob || (webSafe ? file : null);
  }
  async function uploadImages(files) {
    if (!assets) { toast("Uploading images requires Editor access to the app."); return []; }
    const ids = [];
    for (const f of files) {
      let blob = null;
      try { blob = await shrinkImage(f, 1600); } catch (e) {}
      if (!blob) { toast("Could not read " + (f.name || "the file") + " – upload an image (JPG, PNG, HEIC, WebP …)."); continue; }
      try { const r = await assets.upload(blob, blob.type ? undefined : { type: "image/jpeg" }); ids.push(r.id); }
      catch (e) { const c = e && e.code; toast(c === "too_large" ? "The image is too large (max 20 MB)." : c === "unsupported_type" ? "File type not supported – use JPG, PNG, HEIC or WebP." : c === "quota_or_state" ? "Image storage is full." : "Could not upload the image."); }
    }
    return ids;
  }
  function gallery(ids, opts) {
    opts = opts || {};
    const g = h("div", { class: "gallery" });
    for (const id of ids) {
      const fig = h("figure", { class: "thumb" + (opts.hero === id ? " hero" : "") }, h("img", { src: imgUrl(id), alt: "", loading: "lazy", onclick: () => openLightbox(ids, id) }));
      if (opts.onRemove) fig.append(h("button", { class: "thumb-x", type: "button", title: "Remove image", "aria-label": "Remove image", text: "×", onclick: () => opts.onRemove(id) }));
      if (opts.onHero) fig.append(h("button", { class: "thumb-hero", type: "button", text: opts.hero === id ? "Main image" : "Make main image", onclick: () => opts.onHero(id) }));
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
    const input = h("input", { type: "file", accept: IMG_ACCEPT, multiple: true, hidden: true, onchange: () => { if (input.files.length) onFiles([...input.files]); input.value = ""; } });
    const btn = h("button", { class: "btn small", type: "button", text: label || "+ Add images", onclick: () => input.click() });
    const zone = h("div", { class: "dropzone" }, btn, h("span", { class: "hint", text: "or drag images here – JPG, PNG, HEIC, screenshots" }), input);
    zone._onFiles = onFiles;
    return zone;
  }
  // Släpp hanteras på ett ställe för hela sidan: en fil som släpps bredvid rutan ska hamna i närmaste bildruta,
  // inte öppnas av webbläsaren (då försvinner appen).
  const dragHasFiles = (e) => !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
  function dropZoneFor(e) {
    const t = e.target instanceof Element ? e.target : null;
    const own = t && t.closest(".dropzone, .tile-empty");
    if (own && own._onFiles) return own;
    const sec = t && t.closest("section");
    const inSec = sec && [...sec.querySelectorAll(".dropzone")].filter((z) => z._onFiles);
    if (inSec && inSec.length === 1) return inSec[0];
    const scope = (t && t.closest(".sheet, .modal")) || document;
    const zs = [...scope.querySelectorAll(".dropzone")].filter((z) => z._onFiles && z.offsetParent !== null);
    return zs.length === 1 ? zs[0] : null;
  }
  let dragZone = null;
  const setDragZone = (z) => { if (dragZone === z) return; if (dragZone) dragZone.classList.remove("over"); dragZone = z; if (z) z.classList.add("over"); };
  document.addEventListener("dragover", (e) => { if (!dragHasFiles(e)) return; e.preventDefault(); const z = dropZoneFor(e); setDragZone(z); e.dataTransfer.dropEffect = z ? "copy" : "none"; });
  document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) setDragZone(null); });
  document.addEventListener("drop", (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    const z = dropZoneFor(e); setDragZone(null);
    const all = [...e.dataTransfer.files];
    if (!z) { if (all.length) toast("Drop the image on an image box (\"+ Add images\")."); return; }
    const fs = all.filter(isImageFile);
    if (fs.length) z._onFiles(fs); else if (all.length) toast("Only images can be added here (JPG, PNG, HEIC, WebP …).");
  });
  // Generic image block for a document (style, drop, ref-plagg, tyg). For a new, unsaved document
  // the ids are kept in opts.pending and saved together with the document.
  // Tom bildruta i Bibliotek/Kollektion: kategori + vad som saknas, och uppladdning direkt från kortet (skiss, referens eller foto).
  function emptyTile(s, xs) {
    const what = isIdea(s) ? "Sketch or reference image missing" : (xs && xs.length ? "Photo of the sample missing" : "No sample yet – add a sketch");
    const box = h("div", { class: "noimg tile-empty" }, h("span", { class: "kat", text: styleKategori(s) || typLabel(s) || "" }), h("span", { class: "what", text: what }));
    if (assets && canWrite && db) {
      const addFiles = async (files) => { if (!files.length) return; toast("Uploading " + files.length + (files.length === 1 ? " image …" : " images …")); const ids = await uploadImages(files); if (!ids.length) return; const cur = byId(D.styles, s._id) || s; await write("styles", s._id, { bilder: (cur.bilder || []).concat(ids), bildId: cur.bildId && !cur.bildAuto ? cur.bildId : ids[0], bildAuto: false, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry(ids.length + (ids.length === 1 ? " image" : " images") + " uploaded from Ideas")) }); toast("Image saved"); };
      const input = h("input", { type: "file", accept: IMG_ACCEPT, multiple: true, hidden: true, onchange: () => { const files = [...input.files]; input.value = ""; addFiles(files); } });
      box._onFiles = addFiles;
      box.append(h("button", { class: "btn small", type: "button", text: "+ Add image", onclick: (e) => { e.stopPropagation(); input.click(); } }), input);
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
      sec.replaceChildren(h("h3", { class: "sec-title", text: (opts.title || "Images") + (ids.length ? " (" + ids.length + ")" : "") }));
      if (ids.length) sec.append(gallery(ids, { hero: opts.hero ? opts.hero() : null, onHero: ro || !opts.onHero ? null : opts.onHero, onRemove: ro ? null : async (id) => {
        if (!confirm("Remove the image for everyone?")) return;
        if (opts.pending) { opts.pending.splice(opts.pending.indexOf(id), 1); render(); try { if (assets) await assets.delete(id); } catch (e) {} return; }
        const left = ids.filter((x) => x !== id);
        if (await opts.save(left, "Image removed")) { try { if (assets && opts.deleteAsset !== false) await assets.delete(id); } catch (e) {} render(); }
      } }));
      else sec.append(h("p", { class: "hint", text: opts.empty || "No images yet." }));
      if (!ro && assets) sec.append(imageDrop(async (files) => {
        const busy = h("p", { class: "hint", text: "Uploading " + files.length + " image(s) …" }); sec.append(busy);
        const got = await uploadImages(files);
        if (!got.length) { busy.remove(); return; }
        if (opts.pending) { opts.pending.push(...got); render(); return; }
        const now = opts.pending ? ids : docImages(opts.current());
        await opts.save(now.concat(got), got.length + (got.length === 1 ? " image added" : " images added"));
        render();
      }, opts.addLabel));
      else if (!ro && !assets) sec.append(h("p", { class: "hint", text: "Images can only be uploaded by someone with Contributor access or higher to the app." }));
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
    if (st) { const ss = styleStatusNorm(st.status); if (PROD_STATUS.includes(ss) || ss === "Pausad" || ss === "Kastad") out.push(h("span", { class: "pill st-" + slug(ss), text: ss === "Pausad" ? "Style paused" : ss === "Kastad" ? "Style dropped" : ss })); }
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
    r.prod = levNum(st.leverantor, "production time");
    r.buff = levNum(st.leverantor, "buffer") || 0;
    r.sl = levNum(st.leverantor, "sampleLedtid");
    const dl = deadlineOf(st);
    if (!dl) return Object.assign(r, { note: st.sasong && st.drop ? "Set \"In stock by\" on the style or on " + st.sasong + " " + st.drop + "." : "Set \"In stock by\" to get a timeline." });
    r.deadline = dl.date; r.deadlineFrom = dl.from;
    if (r.prod == null) return Object.assign(r, { lage: "okand", note: "Production time missing for " + (st.leverantor || "the supplier") + "." });
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
      r.note = r.poDays < 0 ? "The PO date " + fmtDate(r.po) + " has passed." : "Place the PO by " + fmtDate(r.po) + ".";
    } else if (!xs.length) {
      const ref = r.best || r.inne; const m = diffDays(ref);
      lage = grade(m);
      r.note = (r.best ? "No sample yet. Order by " + fmtDate(r.best) : "No sample yet. It is needed by " + fmtDate(r.inne)) + ".";
    } else {
      let arrival = null;
      for (const x of xs) {
        const a = x.status === "Mottagen" ? todayISO() : expected(x);
        if (a && (!arrival || a < arrival)) arrival = a;
      }
      if (!arrival) { lage = "okand"; r.note = "No sample has a delivery date. It is needed by " + fmtDate(r.inne) + "."; }
      else {
        const m = daysBetween(arrival, r.inne);
        lage = grade(m);
        r.note = (arrival === todayISO() ? "Sample in" : "Sample expected " + fmtDate(arrival)) + ", needed by " + fmtDate(r.inne) + ".";
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
    if (code === "invalid_argument") { platformWrite = false; canWrite = false; applyWriteMode(); toast("You only have read access here."); }
    else if (code === "quota_exceeded") toast("The database is full. Remove old records and try again.");
    else toast("Could not save. Try again in a moment.");
  }
  async function write(coll, id, patch) {
    if (!db) { toast("The database is not available in this view."); return false; }
    // En style som blir Godkänd är redo att beställa: Elliot får ett direktmejl (bara hostad, servern skickar högst ett per style).
    const becameReady = coll === "styles" && patch && patch.status === "Godkänd" && (() => { const c = byId(D.styles, id); return !!c && styleStatusNorm(c.status) !== "Godkänd"; })();
    try { await serial(coll + "/" + id, () => db.collection(coll).doc(id).update(patch)); if (becameReady) notifyReady(id); return true; } catch (e) { writeError(e); return false; }
  }
  async function create(coll, id, body) {
    if (!db) { toast("The database is not available in this view."); return false; }
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
    if (typeof v === "boolean") return v ? "yes" : "no";
    if (isISO(v)) return fmtDate(v);
    return String(v);
  }
  function describeChanges(before, after, labels) {
    const out = [];
    for (const k of Object.keys(after)) {
      if (!(k in labels)) continue;
      const a = showVal(k, before[k]), b = showVal(k, after[k]);
      if (a === b) continue;
      if (k === "status") out.push("Status: " + (tv(a) || "–") + " → " + (tv(b) || "–"));
      else if (k === "kommentar" || k === "andringar") out.push(labels[k] + " changed");
      else if (k === "utvarderad") out.push(after[k] ? "Marked as evaluated" : "Evaluation removed");
      else out.push(labels[k] + ": " + (b || "empty"));
    }
    return out;
  }
  async function renderLogInto(ul, items) {
    const list = (items || []).slice().reverse();
    if (!list.length) { ul.replaceChildren(h("li", { class: "sub", text: "No events yet." })); return; }
    const ids = [...new Set(list.map((i) => i.av).filter(Boolean))];
    let ps = {};
    try { if (user && ids.length) ps = await user.profiles(ids); } catch (e) {}
    ul.replaceChildren(...list.map((i) => {
      const d = new Date(i.t);
      const when = isNaN(d) ? "" : d.getDate() + " " + MONTHS[d.getMonth()] + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      const who = i.av ? ((ps[i.av] && ps[i.av].name) || "Someone in the team") : "Import";
      const tagged = Array.isArray(i.till) && i.till.length ? " · tagged " + i.till.map(personName).join(", ") : "";
      return h("li", null, h("time", { text: when }), h("div", null, h("div", { text: i.text || "" }), h("div", { class: "who", text: who + tagged })));
    }));
  }

  // ---------- strip / seg / filter widgets ----------
  function makeStrip(defs, state, onChange) {
    const el = h("section", { class: "strip", "aria-label": "Overview" });
    el.style.setProperty("--cols", String(defs.length));
    const parts = {};
    for (const d of defs) {
      const n = h("span", { class: "n mono", text: "–" });
      const s = h("span", { class: "s" });
      const b = h("button", { class: "tile " + (d.cls || ""), type: "button", onclick: () => { state.view = state.view === d.key ? null : d.key; onChange(); } }, n, h("span", { class: "l", text: d.label }), s);
      parts[d.key] = { n, b, s }; el.append(b);
    }
    return { el, set(counts, subs) { for (const d of defs) { const v = counts[d.key] || 0; parts[d.key].n.textContent = String(v); parts[d.key].n.classList.toggle("zero", !v); parts[d.key].s.textContent = (subs && subs[d.key]) || ""; parts[d.key].b.setAttribute("aria-pressed", String(state.view === d.key)); } } };
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
      items.forEach((v) => s.add(new Option(tv(v), v)));
      if (items.includes(cur)) s.value = cur; else { s.value = ""; state[key] = ""; }
    } };
  }
  function searchBox(id, placeholder, state, onChange) {
    const q = h("input", { type: "search", id, placeholder, "aria-label": placeholder, oninput: () => { state.q = q.value; onChange(); } });
    q.value = state.q || "";
    return q;
  }

  // ---------- idéer överlämnade till Alex ----------
  const ideaInbox = () => D.styles.filter((s) => styleStatusNorm(s.status) === ST_KANBEST).sort((a, b) => String((b.overlamnad && b.overlamnad.t) || b.andrad || "").localeCompare(String((a.overlamnad && a.overlamnad.t) || a.andrad || "")));
  function fillNames(nodes) {
    const ids = uniq(nodes.map((n) => n.dataset.uid));
    if (!user || !ids.length) return;
    user.profiles(ids).then((ps) => nodes.forEach((n) => { const p = ps[n.dataset.uid]; if (p && p.name) n.textContent = p.name; })).catch(() => {});
  }
  function inboxCard(items, full) {
    const card = h("section", { class: "card inbox" }, h("div", { class: "card-head" }, h("h3", { text: "Sample kan beställas" }), h("span", { class: "sub", text: items.length + (items.length === 1 ? " style ready for a sample" : " styles ready for a sample") + " – from Design or straight from Carl. Order a sample and the style moves to Sampling." })));
    if (!items.length) { card.append(h("p", { class: "hint", style: "padding:12px 16px", text: "Nothing is waiting right now. Styles arrive here when Conor has finished the design, or straight from Carl." })); return card; }
    const { t, tb } = table([["Idea"], ["Season"], ["Tyg"], ["From"], ["", "num"]]);
    const who = [];
    for (const s of items) {
      const img = styleImage(s);
      const by = h("span", { class: "who", dataset: { uid: (s.overlamnad && s.overlamnad.av) || "" }, text: "The team" }); if (by.dataset.uid) who.push(by);
      const when = s.overlamnad && s.overlamnad.t ? fmtDate(String(s.overlamnad.t).slice(0, 10)) : "";
      tb.append(h("tr", { tabIndex: 0, dataset: { style: s._id } },
        td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, img ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(img), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(styleAllImages(s), img); } }) : null,
          h("div", null, h("div", { class: "prod", text: s.namn }), h("div", { class: "sub", text: [styleKategori(s), s.leverantor, grundOf(s) ? "variant of " + grundOf(s).namn : ""].filter(Boolean).join(" · ") }), s.beskrivning ? h("div", { class: "note", text: s.beskrivning }) : null))),
        td("Season", "mono", [s.sasong, s.drop].filter(Boolean).join(" · ")),
        td("Tyg", null, styleTyg(s) || h("span", { class: "muted", text: "–" })),
        td("From", null, h("div", null, by, when ? h("div", { class: "sub mono", text: when }) : null)),
        td("", "num", canWrite && db ? h("div", { style: "display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap" }, h("button", { class: "btn small", type: "button", text: "Open idea", onclick: (e) => { e.stopPropagation(); openStyle(s._id); } }), h("button", { class: "btn small primary", type: "button", text: "Order sample", onclick: (e) => { e.stopPropagation(); openSample(null, { styleId: s._id, leverantor: s.leverantor || "", version: "Proto 1", tygId: s.tygId || null }); } })) : null)));
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
        { key: "ideer", label: "Ideas to sample" },
        { key: "waiting", label: "Awaiting delivery" },
        { key: "late", label: "Late", cls: "t-late" },
        { key: "problem", label: "Problem", cls: "t-late" },
        { key: "remind", label: "Remind now", cls: "t-warn" },
        { key: "evaluate", label: "To evaluate" },
        { key: "mark", label: "Unlabelled", cls: "t-late" },
        { key: "measure", label: "Not measured", cls: "t-warn" },
        { key: "place", label: "No location" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_samples", "Search style, fabric, colour, ID, hanger …", st, () => this.update());
      this.fLev = filterSelect("f_s_lev", "All suppliers", st, "lev", upd);
      this.fSeason = filterSelect("f_s_season", "All seasons", st, "season", upd);
      this.fPlats = filterSelect("f_s_plats", "All locations", st, "plats", upd);
      this.seg = makeSeg([["aktiva", "Active"], ["Beställd", "Beställd"], ["Skickad", "Skickad"], ["Problem", "Problem"], ["Mottagen", "Mottagen"], ["hangare", "Collection rail"], ["produktion", "Gone to production"], ["arkiv", "Arkiv"], ["alla", "All"]], st, "status", upd);
      const grp = selectEl("f_s_group", [["kategori", "Group by category"], ["style", "Group by style"], ["sasong", "Group by season"], ["lev", "Group by supplier"], ["none", "No grouping"]], st.group);
      grp.addEventListener("change", () => { st.group = grp.value; upd(); });
      this.count = h("span", { class: "count" });
      this.selCount = h("span");
      this.tray = h("div", { class: "tray", hidden: true }, this.selCount,
        h("button", { class: "btn small primary", type: "button", text: "Print labels", onclick: () => openLabels([...selected]) }),
        h("button", { class: "btn small", type: "button", text: "Clear selection", onclick: () => { selected.clear(); this.update(); } }));
      this.allBox = h("input", { type: "checkbox", id: "s_all", onchange: () => { (this.visible || []).forEach((s) => (this.allBox.checked ? selected.add(s._id) : selected.delete(s._id))); this.update(); } });
      this.cards = h("div", { class: "cards" });
      this.empty = h("div", { class: "empty", hidden: true });
      const open = (e) => { if (e.target.closest("input, button")) return; const tr = e.target.closest("tr[data-id], tr[data-group]"); if (!tr) return; if (tr.dataset.id) openSample(tr.dataset.id); else { const k = tr.dataset.group; if (expanded.has(k)) expanded.delete(k); else expanded.add(k); this.update(); } };
      this.cards.addEventListener("click", open);
      this.cards.addEventListener("keydown", (e) => { if (e.key === "Enter") open(e); });
      root.append(h("p", { class: "lede", text: "Samples for products that are not finished yet. Once the product has gone to production its samples move to \"Gone to production\". Paused and dropped samples sit in the Archive and can be picked up again. The intended season is set on each sample." }),
        this.strip.el, this.bar = h("section", { class: "filters sticky-bar", "aria-label": "Filter" }, q, this.fLev.el, this.fSeason.el, this.fPlats.el, this.seg.el, grp, h("label", { class: "checkline" }, this.allBox, "Select all visible"), this.count), this.tray, this.cards, this.empty);
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
      const keyOf = st.group === "kategori" ? (s) => kategoriOf(s) || "No category" : st.group === "style" ? (s) => styleName(s) + " · " + (s.leverantor || "") : st.group === "lev" ? (s) => s.leverantor || "No supplier" : st.group === "sasong" ? (s) => seasonOf(s) || "Utan säsong" : () => "";
      const katRank = (k) => { const i = KATEGORIER.indexOf(k); return i < 0 ? 99 : i; };
      const seasonKeyRank = (k) => (k === "Utan säsong" ? 999 : -seasonRank(k));
      list.sort((a, b) => (st.group === "kategori" ? katRank(keyOf(a)) - katRank(keyOf(b)) : st.group === "sasong" ? seasonKeyRank(keyOf(a)) - seasonKeyRank(keyOf(b)) : 0) || keyOf(a).localeCompare(keyOf(b), "sv") || styleName(a).localeCompare(styleName(b), "sv") || versionRank(a.version) - versionRank(b.version) || (expected(a) || "9999").localeCompare(expected(b) || "9999") || a._id.localeCompare(b._id));
      this.visible = list;
      const cols = [["", "c-check"], ["ID"], ["Style"], ["Version"], ["Hängare"], ["Supplier"], ["Colour"], ["Status"], ["Outcome"], ["Expected"], ["Comment"]];
      const groups = new Map();
      for (const s of list) { const k = keyOf(s); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
      const cards = [];
      for (const [k, items] of groups) {
        const card = h("section", { class: "card" });
        if (st.group !== "none") {
          const head = h("div", { class: "card-head" }, h("h3", { text: k }), h("span", { class: "sub", text: items.length + (items.length === 1 ? " sample" : " samples") + (st.group === "kategori" ? " · " + uniq(items.map(styleName)).length + " styles" : "") }));
          if (st.group === "style" && items[0].styleId && byId(D.styles, items[0].styleId)) { const sid = items[0].styleId; head.append(h("button", { class: "linkish", type: "button", text: "Open style", onclick: () => openStyle(sid) })); }
          card.append(head);
        }
        const { t, tb } = table(cols);
        let lastStyle = null;
        const grouped = new Map();
        for (const s of items) { const gk = groupKeyOf(s); if (!grouped.has(gk)) grouped.set(gk, []); grouped.get(gk).push(s); }
        for (const gItems of grouped.values()) {
          const s = gItems[0];
          if (st.group === "kategori" || st.group === "lev") { const sn = styleName(s); if (sn !== lastStyle) { lastStyle = sn; const cell = h("td", { colSpan: 11, text: sn + (s.leverantor && st.group !== "lev" ? " · " + s.leverantor : "") }); if (s.styleId && byId(D.styles, s.styleId)) { const sid = s.styleId; cell.append(h("button", { class: "linkish", type: "button", text: "Open style", onclick: () => openStyle(sid) })); } tb.append(h("tr", { class: "group" }, cell)); } }
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
          ? [h("strong", { text: db ? "Loading samples …" : "No samples to show" }), h("span", { text: db ? "The list fills in as soon as the database responds." : "Open the page through the link in Claude." })]
          : st.status === "arkiv" && !st.q && !st.lev && !st.season && !st.plats ? [h("strong", { text: "The archive is empty" }), h("span", { text: "Pause or drop a sample and it ends up here – and can be picked up again at any time." })]
          : D.samples.length ? [h("strong", { text: "Nothing matches the filter" }), h("span", { text: "Change status or supplier, or clear the search." })]
          : [h("strong", { text: "No samples yet" }), h("span", { text: "Add the first one with \"+ New sample\"." })]));
      }
      this.count.textContent = list.length + " of " + D.samples.length + " samples";
      this.tray.hidden = selected.size === 0;
      this.selCount.textContent = selected.size + (selected.size === 1 ? " selected" : " selected");
      this.allBox.checked = list.length > 0 && list.every((s) => selected.has(s._id));
    }
  };
  function expCell(s) {
    const out = []; const e = expected(s);
    if (s.status === "Mottagen") {
      out.push(h("div", { class: "mono", text: s.mottagen ? "rec. " + fmtDate(s.mottagen) : e ? fmtDate(e) : "received" }));
      if (toEvaluate(s)) out.push(h("span", { class: "flag eval", text: "Evaluate" }));
    } else if (e) {
      out.push(h("div", { class: "mono", text: fmtDate(e) }));
      if (isWaiting(s)) { const d = diffDays(e); out.push(h("div", { class: "days " + (d < 0 ? "late" : d <= 7 ? "soon" : ""), text: d < 0 ? (-d) + " d late" : d === 0 ? "today" : "in " + d + " d" })); }
      const r = remindDue(s); if (r) out.push(h("span", { class: "flag", text: "Reminder " + r }));
    } else out.push(h("div", { class: "mono muted", text: "TBA" }));
    return out;
  }
  function sampleRow(s) {
    const tr = h("tr", { tabIndex: 0, dataset: { id: s._id } });
    const box = h("input", { type: "checkbox", "aria-label": "Select " + s._id, checked: selected.has(s._id), onchange: () => { if (box.checked) selected.add(s._id); else selected.delete(s._id); SamplesView.update(); } });
    const t = tygOf(s);
    const subBits = [];
    if (tygName(s)) subBits.push(h("span", { class: t && t.status === "Slut" ? "late-text" : null, text: tygName(s) + (t && t.status === "Slut" ? " (sold out)" : "") }));
    if (s.storlek) subBits.push(h("span", { text: (subBits.length ? " · " : "") + "size " + s.storlek }));
    const stn = styleOf(s);
    if (s.sasong && (!stn || norm(stn.sasong) !== norm(s.sasong))) subBits.push(h("span", { class: "place", text: (subBits.length ? " · " : "") + "intended " + s.sasong }));
    else if (stn && stn.sasong) subBits.push(h("span", { text: (subBits.length ? " · " : "") + stn.sasong + (stn.drop ? " " + stn.drop : "") }));
    else if (s.sasong) subBits.push(h("span", { text: (subBits.length ? " · " : "") + "intended " + s.sasong }));
    const pl = platsText(s);
    const placeCell = td("Hängare", null, s.platsTyp === "Hängare" ? h("span", { class: "hanger", text: "Hanger " + (s.hangare || "?") }) : pl ? h("span", { class: "place", text: pl }) : needsPlace(s) ? h("span", { class: "flag", text: "Set location" }) : null);
    if (unmarked(s)) placeCell.append(h("span", { class: "flag bad", text: "Label " + s._id }));
    if (unmeasured(s)) placeCell.append(h("span", { class: "flag", text: "Measure" }));
    if (s.mattGodkanda === false) placeCell.append(h("span", { class: "flag bad", text: "Measurements not OK" }));
    const imgs = sampleImages(s);
    const idCell = td("ID", "c-id", tag(s._id));
    if (imgs.length) idCell.append(h("img", { class: "rowthumb", src: imgUrl(imgs[0]), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(imgs, imgs[0]); } }));
    const noteCell = td("Comment", "note");
    if (s.kommentar) noteCell.append(h("div", { text: s.kommentar }));
    if (s.andringar) noteCell.append(h("div", { text: "Changes: " + s.andringar }));
    tr.append(
      td("Select", "c-check", box),
      idCell,
      td("Style", "c-main", h("div", { class: "prod", text: styleName(s) }), subBits.length ? h("div", { class: "sub" }, subBits) : null),
      td("Version", null, chip(s.version || "–")),
      placeCell,
      td("Supplier", null, s.leverantor || ""),
      td("Colour", null, sampleColours(s).length ? h("div", { class: "swatches" }, colourChips(s)) : ""),
      td("Status", "c-status", problemPill([s])),
      td("Outcome", null, h("span", { class: "chips", style: "margin-top:0" }, utfallParts(s))),
      td("Expected", "c-exp", expCell(s)),
      noteCell
    );
    return tr;
  }

  function sampleGroupRow(items) {
    const s0 = items[0];
    const key = groupKeyOf(s0);
    const tr = h("tr", { tabIndex: 0, dataset: { group: key }, class: "grp" });
    const allSel = items.every((x) => selected.has(x._id));
    const box = h("input", { type: "checkbox", "aria-label": "Select " + items.length + " samples", checked: allSel, onchange: () => { items.forEach((x) => (box.checked ? selected.add(x._id) : selected.delete(x._id))); SamplesView.update(); } });
    const ids = items.map((x) => x._id).sort();
    const idCell = td("ID", "c-id", tag(ids[0] + (ids.length > 1 ? "–" + ids[ids.length - 1].replace(/^S/, "") : "")), h("div", { class: "sub", text: items.length + " colours" }));
    const imgs = uniq(items.flatMap(sampleImages));
    if (imgs.length) idCell.append(h("img", { class: "rowthumb", src: imgUrl(imgs[0]), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(imgs, imgs[0]); } }));
    const t = tygOf(s0);
    const subBits = [];
    if (tygName(s0)) subBits.push(tygName(s0) + (t && t.status === "Slut" ? " (sold out)" : ""));
    const stn = styleOf(s0);
    const sSeasons = uniq(items.map((x) => x.sasong));
    if (sSeasons.length && (!stn || sSeasons.some((x) => norm(x) !== norm(stn.sasong)))) subBits.push("intended " + sSeasons.join("/"));
    else if (stn && stn.sasong) subBits.push(stn.sasong + (stn.drop ? " " + stn.drop : ""));
    const colours = h("div", { class: "swatches" }, items.slice().sort((a, b) => sampleFarg(a).localeCompare(sampleFarg(b), "sv")).map((x) => h("button", { class: "swatch btn-swatch" + (x.status === "Problem" ? " problem" : isWaiting(x) ? " wait" : ""), type: "button", title: x._id + " · " + (x.status || "") + (platsText(x) ? " · " + platsText(x) : ""), onclick: (e) => { e.stopPropagation(); openSample(x._id); } }, sampleColours(x).map((c) => colourDot(fargText(c) || c)), sampleFarg(x) || x._id, x.platsTyp === "Hängare" ? h("span", { class: "h", text: "H" + (x.hangare || "?") }) : null)));
    const statuses = uniq(items.map((x) => x.status));
    const placeCell = td("Hängare", null);
    const hangers = uniq(items.filter((x) => x.platsTyp === "Hängare").map((x) => x.hangare || "?"));
    if (hangers.length) placeCell.append(h("span", { class: "hanger", text: "Hanger " + hangers.join(", ") }));
    const others = uniq(items.filter((x) => x.platsTyp && x.platsTyp !== "Hängare").map((x) => x.platsTyp)); if (others.length) placeCell.append(h("span", { class: "place", text: others.join(", ") }));
    const nMark = items.filter(unmarked).length, nMeasure = items.filter(unmeasured).length, nPlace = items.filter(needsPlace).length;
    if (nMark) placeCell.append(h("span", { class: "flag bad", text: "Label " + nMark }));
    if (nMeasure) placeCell.append(h("span", { class: "flag", text: "Measure " + nMeasure }));
    if (nPlace && !hangers.length) placeCell.append(h("span", { class: "flag", text: "Set location" }));
    const expDates = items.map(expected).filter(Boolean).sort();
    const expCellEl = td("Expected", "c-exp");
    const received = items.filter((x) => x.status === "Mottagen").length;
    if (received === items.length) expCellEl.append(h("div", { class: "mono", text: "all received" }));
    else if (expDates.length) { const d = diffDays(expDates[0]); expCellEl.append(h("div", { class: "mono", text: fmtDate(expDates[0]) + (expDates.length > 1 && expDates[expDates.length - 1] !== expDates[0] ? "–" + fmtDate(expDates[expDates.length - 1]) : "") }), h("div", { class: "days " + (d < 0 ? "late" : d <= 7 ? "soon" : ""), text: d < 0 ? (-d) + " d late" : d === 0 ? "today" : "in " + d + " d" })); }
    else expCellEl.append(h("div", { class: "mono muted", text: "TBA" }));
    if (received && received < items.length) expCellEl.append(h("div", { class: "sub", text: received + " of " + items.length + " received" }));
    const utf = uniq(items.map((x) => beslutNorm(x.beslut)).filter(Boolean));
    const notes = uniq(items.map((x) => x.kommentar).filter(Boolean));
    tr.append(
      td("Select", "c-check", box),
      idCell,
      td("Style", "c-main", h("div", { class: "prod", text: styleName(s0) }), subBits.length ? h("div", { class: "sub", text: subBits.join(" · ") }) : null, h("button", { class: "linkish", type: "button", text: expanded.has(key) ? "Hide the colours" : "Show each colour", onclick: (e) => { e.stopPropagation(); if (expanded.has(key)) expanded.delete(key); else expanded.add(key); SamplesView.update(); } })),
      td("Version", null, chip(s0.version || "–")),
      placeCell,
      td("Supplier", null, s0.leverantor || ""),
      td("Colours", null, colours),
      td("Status", "c-status", h("span", { class: "chips", style: "margin-top:0" }, statuses.map((x) => x === "Problem" ? problemPill(items) : statusPill(x)))),
      td("Outcome", null, h("span", { class: "chips", style: "margin-top:0" }, utf.map((b) => chip(b, "b-" + slug(b))), stn && (inProduction(stn) || ["Pausad", "Kastad"].includes(styleStatusNorm(stn.status))) ? h("span", { class: "pill st-" + slug(styleStatusNorm(stn.status)), text: styleStatusNorm(stn.status) }) : null)),
      expCellEl,
      td("Comment", "note", notes.length ? h("div", { text: notes.length === 1 ? notes[0] : notes.length + " comments" }) : null)
    );
    return tr;
  }

  // ---------- STYLES ----------
  const StylesView = {
    mount(root) {
      const st = UI.styles;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "rod", label: "Will be late", cls: "t-late" },
        { key: "gul", label: "Tight", cls: "t-warn" },
        { key: "po30", label: "PO within 30 days" },
        { key: "datum", label: "No date" },
        { key: "ean", label: "Approved without EAN" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_styles", "Search style, supplier, season …", st, () => this.update());
      this.fLev = filterSelect("f_st_lev", "All suppliers", st, "lev", upd);
      this.fSeason = filterSelect("f_st_season", "All seasons", st, "season", upd);
      this.seg = makeSeg([["aktiva", "Active"], ["Sampling", "Sampling"], ["Godkänd", "Godkänd"], ["produktion", "I produktion"], ["Levererad", "Levererad"], ["Pausad", "Pausad"], ["Kastad", "Kastad"], ["alla", "All"]], st, "status", upd);
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["Style"], ["Supplier"], ["Season"], ["Status"], ["Latest sample"], ["In stock by"], ["PO by"], ["Position"], ["EAN"]]);
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
      if (!list.length) this.empty.replaceChildren(...(!loaded.has("styles") ? [h("strong", { text: "Loading styles …" })] : D.styles.length ? [h("strong", { text: "Nothing matches the filter" }), h("span", { text: "Change status or clear the search." })] : [h("strong", { text: "No styles yet" }), h("span", { text: "Create one with \"+ New style\"." })]));
      this.count.textContent = list.length + " of " + D.styles.length + " styles";
    }
  };
  function styleRow(s, p) {
    const xs = samplesOfStyle(s._id);
    const last = xs[xs.length - 1];
    const vs = variants(s.farger || [], s.storlekar || []);
    const eanTxt = (s.ean || []).length ? (s.ean || []).length + (vs.length ? "/" + vs.length : "") : "–";
    const dl = deadlineOf(s);
    return h("tr", { tabIndex: 0, dataset: { style: s._id } },
      td("", "c-main", h("div", { class: "prod", text: s.namn || "Unnamed" }), h("div", { class: "sub" }, s.typ && s.typ !== "Nyhet" ? chip(s.typ) : null, styleKategori(s) ? chip(styleKategori(s)) : null, s._id + " · " + xs.length + (xs.length === 1 ? " sample" : " samples") + ((s.po || []).length ? " · " + s.po.join(", ") : "") + (poLinesOf(s._id).length ? " · " + poLinesOf(s._id).reduce((a, x) => a + (num(x.r.antal) || 0), 0) + " pcs · " + fmtTkr(poLinesOf(s._id).reduce((a, x) => a + (lineCost(x.r) || 0), 0)) : ""))),
      td("Supplier", null, s.leverantor || ""),
      td("Season", null, [s.sasong, s.drop].filter(Boolean).join(" · ")),
      td("Status", null, styleStatusPill(s)),
      td("Latest", null, last ? h("span", { class: "chips" }, chip(last.version || "–"), statusPill(last.status), beslutNorm(last.beslut) ? chip(beslutNorm(last.beslut), "b-" + slug(beslutNorm(last.beslut))) : null) : h("span", { class: "muted", text: "No sample" })),
      td("In stock by", "mono", dl ? fmtDate(dl.date) + (dl.from === "drop" ? " (drop)" : "") : ""),
      td("PO by", null, p.po ? h("div", null, h("div", { class: "mono", text: fmtDate(p.po) }), h("div", { class: "days " + (p.poDays < 0 ? "late" : p.poDays < 14 ? "soon" : ""), text: fmtDays(p.poDays) })) : null),
      td("Position", null, lageCell(s, p), p.note && !["klar", "skip", "paus"].includes(p.lage) ? h("div", { class: "sub", text: p.note }) : null),
      td("EAN", "mono", eanTxt)
    );
  }

  // ---------- DROPS ----------
  const DropsView = {
    mount(root) {
      const st = UI.drops;
      this.fSeason = filterSelect("f_d_season", "All seasons", st, "season", () => { this.update(); persist(); });
      this.count = h("span", { class: "count" });
      this.body = h("div", { style: "display:grid;gap:22px" });
      root.append(h("p", { class: "lede", text: "The collection by season and drop, with the products from the Production tab and the samples that belong to each product. Click a product to open the style, or a sample ID to see where the sample hangs." }), h("section", { class: "filters", "aria-label": "Filter" }, this.fSeason.el, this.count), this.body);
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
        sec.append(h("h2", { class: "season-h" }, season, h("span", { class: "sub", text: inSeason.length + (inSeason.length === 1 ? " product" : " products") + " · " + drops.length + (drops.length === 1 ? " drop" : " drops") })));
        for (const d of drops) {
          const members = inSeason.filter((s) => dropKey(s.sasong, s.drop) === dropKey(d.sasong, d.namn));
          members.forEach((m) => placed.add(m._id));
          sec.append(dropSection(d, members, false));
          nDrops++;
        }
        const rest = inSeason.filter((s) => !placed.has(s._id));
        if (rest.length) sec.append(dropSection({ sasong: season, namn: "No drop", _id: null }, rest, true));
        this.body.append(sec);
      }
      if (!show.length) this.body.append(h("div", { class: "empty" }, h("strong", { text: loaded.has("drops") && loaded.has("styles") ? "No drops yet" : "Loading …" }), h("span", { text: "Create a drop with \"+ New drop\" and set season and drop on your styles." })));
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
    if (isISO(d.klartSenast)) meta.append(h("span", null, "In stock by ", h("span", { class: "mono", text: fmtDate(d.klartSenast) }), h("span", { class: "sub", text: " (" + fmtDays(diffDays(d.klartSenast)) + ")" })));
    if (isISO(d.lansering)) meta.append(h("span", null, "Launch ", h("span", { class: "mono", text: fmtDate(d.lansering) })));
    const counts = { sampling: 0, godkand: 0, po: 0, prod: 0, lev: 0, paus: 0, kast: 0, rod: 0, gul: 0 };
    for (const s of members) {
      const ss = styleStatusNorm(s.status);
      if (ss === "Sampling") counts.sampling++; else if (ss === "Godkänd") counts.godkand++; else if (ss === "PO lagd") counts.po++; else if (ss === "I produktion") counts.prod++; else if (ss === "Levererad") counts.lev++; else if (ss === "Pausad") counts.paus++; else if (ss === "Kastad") counts.kast++;
      const p = plan(s); if (p.lage === "rod") counts.rod++; if (p.lage === "gul") counts.gul++;
    }
    const bits = [];
    if (counts.sampling) bits.push(counts.sampling + " sampling"); if (counts.godkand) bits.push(counts.godkand + " approved"); if (counts.po) bits.push(counts.po + " PO placed"); if (counts.prod) bits.push(counts.prod + " in production"); if (counts.lev) bits.push(counts.lev + " delivered"); if (counts.paus) bits.push(counts.paus + " paused"); if (counts.kast) bits.push(counts.kast + " dropped");
    meta.append(h("span", { class: "sub", text: members.length + (members.length === 1 ? " product" : " products") + (bits.length ? ": " + bits.join(", ") : "") }));
    if (counts.rod) meta.append(h("span", { class: "lage l-rod", text: counts.rod + " will be late" }));
    if (counts.gul) meta.append(h("span", { class: "lage l-gul", text: counts.gul + " tight" }));
    head.append(meta);
    if (d.kommentar) head.append(h("span", { class: "sub", text: d.kommentar }));
    const right = h("div", { class: "right" });
    if (!isRest && canWrite && db) right.append(h("button", { class: "btn small", type: "button", text: "Edit drop", onclick: () => openDrop(d._id) }));
    if (!isRest && canWrite && db) right.append(h("button", { class: "btn small", type: "button", text: "+ Style in the drop", onclick: () => openStyle(null, { sasong: d.sasong, drop: d.namn }) }));
    head.append(right);
    box.append(head);
    if (!members.length) { box.append(h("div", { class: "empty" }, h("span", { text: isRest ? "" : "No products yet. Set \"" + d.sasong + "\" and \"" + d.namn + "\" on a style and it ends up here." }))); return box; }
    const { t, tb } = table([["Product"], ["Supplier"], ["Status"], ["Position"], ["Samples"], ["PO"]]);
    const order = { Sampling: 0, "Godkänd": 1, "PO lagd": 2, "I produktion": 3, Levererad: 4, Pausad: 5, Kastad: 6 };
    members.slice().sort((a, b) => (order[styleStatusNorm(a.status)] ?? 9) - (order[styleStatusNorm(b.status)] ?? 9) || (a.namn || "").localeCompare(b.namn || "", "sv")).forEach((s) => {
      const xs = samplesOfStyle(s._id);
      const p = plan(s);
      const tr = h("tr", { tabIndex: 0, dataset: { style: s._id } });
      tr.append(
        td("", "c-main", h("div", { class: "prod", text: s.namn }), h("div", { class: "sub", text: [s.typ && s.typ !== "Nyhet" ? s.typ : "", styleKategori(s), (s.farger || []).join(", "), (() => { const pl = poLinesOf(s._id); if (!pl.length) return ""; const u = pl.reduce((a, x) => a + (num(x.r.antal) || 0), 0); const c = pl.reduce((a, x) => a + (lineCost(x.r) || 0), 0); return u + " pcs · " + fmtTkr(c); })(), isRest && s.drop ? "drop: " + s.drop : ""].filter(Boolean).join(" · ") })),
        td("Supplier", null, s.leverantor || ""),
        td("Status", null, styleStatusPill(s)),
        td("Position", null, lageCell(s, p), p.po && !["klar", "skip", "paus"].includes(p.lage) ? h("div", { class: "sub", text: "PO by " + fmtDate(p.po) }) : null),
        td("Samples", null, xs.length ? h("span", { class: "chips", style: "margin-top:0" }, xs.map(sampleChip)) : h("span", { class: "muted", text: (s.typ || "Nyhet") === "Nyhet" ? "No sample" : "–" })),
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
      let eta = poEta(p);
      if (!eta && isISO(start) && num(p.produktionstid) != null) eta = addDays(start, num(p.produktionstid) + ETA_DAGAR);
      return { p, start: isISO(start) ? start : null, ex, eta, est: !poEta(p) };
    }).filter((x) => x.start);
    if (!items.length) return null;
    const marks = [];
    if (isISO(d.klartSenast)) marks.push({ date: d.klartSenast, label: "In stock by", cls: "key" });
    if (isISO(d.lansering)) marks.push({ date: d.lansering, label: "Launch", cls: "" });
    marks.push({ date: today, label: "Today", cls: "today" });
    let min = items.reduce((m, x) => (x.start < m ? x.start : m), today), max = today;
    for (const x of items) { if (x.eta && x.eta > max) max = x.eta; if (x.ex && x.ex > max) max = x.ex; }
    for (const m of marks) { if (m.date < min) min = m.date; if (m.date > max) max = m.date; }
    min = addDays(min, -7); max = addDays(max, 14);
    const span = Math.max(1, daysBetween(min, max));
    const pct = (iso) => (daysBetween(min, iso) / span) * 100;
    const wrap = h("div", { class: "tl" });
    wrap.append(h("div", { class: "tl-head" }, h("span", { class: "sec-title", style: "margin:0", text: "Timeline" }), h("span", { class: "sub", text: "PO placed → ex-factory → ETA warehouse. Dashed = estimated from production time and freight." })));
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
  const DR_LABELS = { sasong: "Season", namn: "Name", ordning: "Order", klartSenast: "In stock by", lansering: "Launch", kommentar: "Comment" };
  function openDrop(id, preset) {
    if (designOnly()) return;
    const isNew = !id;
    const d = isNew ? Object.assign({ _id: null, ordning: 1 }, preset || {}) : byId(D.drops, id);
    if (!d) { toast("Cannot find the drop."); return; }
    const ro = !canWrite || !db;
    // Droppen finns bara som rad i COO: lägg upp den i registret när någon som får redigera öppnar den.
    if (!isNew && d._virtual && !ro) {
      const body = { sasong: d.sasong, namn: d.namn, ordning: d.ordning, klartSenast: null, lansering: null, kommentar: "", andrad: new Date().toISOString() };
      create("drops", d._id, body).then((ok) => { if (!ok) return; if (!RAW.drops.some((x) => x._id === d._id)) RAW.drops.push(Object.assign({}, body, { _id: d._id })); deriveDrops(); openDrop(id); });
      return;
    }
    const raw = d._doc || d;
    const cooEv = d._coo ? byId(D.handelser, d._coo) : null;
    const marg = lagerMarginal();
    const fSas = inp("f_dsasong", d.sasong, { list: "dlSeason", autocomplete: "off", placeholder: "e.g. SS27" });
    const fNamn = inp("f_dnamn", d.namn, { list: "dlDrop", autocomplete: "off", placeholder: "e.g. Drop 1" });
    const fOrd = inp("f_dordning", d.ordning, { type: "number", min: "1", step: "1" });
    const fKlart = inp("f_dklart", raw.klartSenast, { type: "date" });
    const fLans = inp("f_dlans", d.lansering, { type: "date" }); if (cooEv) fLans.disabled = true;
    const klartHint = h("span", { class: "hint" });
    const syncKlart = () => { const l = cooEv ? d.lansering : fLans.value; const auto = isISO(l) ? addDays(l, -marg) : null; klartHint.textContent = fKlart.value ? (isISO(l) && fKlart.value > l ? "Own date that falls after the launch " + fmtDate(l) + ". Clear the field for " + marg + " days before." : "Own date. Clear the field to follow the launch" + (auto ? " (" + fmtDate(auto) + ")" : "") + ".") : (auto ? "Follows the launch: " + fmtDate(auto) + ", " + marg + " days before. Only fill in if the drop should have its own date." : "Empty = " + marg + " days before the launch."); };
    fKlart.addEventListener("input", syncKlart); fLans.addEventListener("input", syncKlart); syncKlart();
    const fKom = area("f_dkom", d.kommentar);
    if (!isNew) { fSas.disabled = true; fNamn.disabled = true; }
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      field("Season", fSas), field("Name", fNamn, { hint: isNew ? "Styles are linked by season + name" : "Do not rename; styles point to it" }),
      field("Order", fOrd, { hint: "Sort order within the season" }), h("div", { class: "field" }, h("label", { for: "f_dklart", text: "In stock by" }), fKlart, klartHint),
      h("div", { class: "field" }, h("label", { for: "f_dlans", text: "Launch" }), fLans, cooEv ? h("span", { class: "hint" }, "Controlled by Jakob under Launches. ", h("button", { class: "linkish", type: "button", text: "Change it there", onclick: () => { closeSheet(); switchTab("coo"); openEvent(cooEv._id); } })) : h("span", { class: "hint", text: "No drop row under Launches yet. The date here applies until the drop is set up there." })), h("div"),
      field("Comment", fKom, { full: true }));
    if (ro) lock(form);
    const members = isNew ? [] : D.styles.filter((s) => dropKey(s.sasong, s.drop) === dropKey(d.sasong, d.namn));
    const pendingImgs = isNew ? [] : null;
    const imgSec = bilderSection({ title: "Images and moodboard", ro, pending: pendingImgs, current: () => byId(D.drops, d._id) || d, empty: "Add a moodboard, reference images or a picture of the rail for the drop. Shown at the top of Collection.", save: (ids) => write("drops", d._id, { bilder: ids, andrad: new Date().toISOString() }) });
    async function save() {
      const o = { sasong: fSas.value.trim(), namn: fNamn.value.trim(), ordning: num(fOrd.value) ?? 1, klartSenast: fKlart.value || null, lansering: cooEv ? (raw.lansering || null) : (fLans.value || null), kommentar: fKom.value.trim(), andrad: new Date().toISOString() };
      if (!o.sasong || !o.namn) { toast("Fill in season and name."); return; }
      if (isNew) {
        const nid = slug(o.sasong + "-" + o.namn);
        if (byId(D.drops, nid) || D.drops.some((x) => dropKey(x.sasong, x.namn) === dropKey(o.sasong, o.namn))) { toast("That drop already exists."); return; }
        o.bilder = pendingImgs.slice();
        if (await create("drops", nid, o)) { toast("Drop created"); closeSheet(); }
      } else {
        delete o.sasong; delete o.namn;
        if (await write("drops", d._id, o)) { toast("Saved"); closeSheet(); }
      }
    }
    openSheet({ flagRef: isNew ? null : { typ: "drop", ref: d._id, titel: d.sasong + " " + d.namn, tab: "kollektion" }, tag: isNew ? "New" : d.sasong, title: isNew ? "New drop" : d.sasong + " · " + d.namn, sub: isNew ? "" : members.length + (members.length === 1 ? " product" : " products"), body: [form, imgSec], foot: footButtons({ del: "Delete drop", onDelete: isNew ? null : async () => { if (await remove("drops", d._id)) { toast("Removed"); closeSheet(); } }, canDelete: !members.length, blockText: "Move the products first", onSave: save }), ctx: { refresh: () => { if (!isNew && !byId(D.drops, d._id)) { closeSheet(); return; } imgSec.render(); } }, focus: isNew ? "f_dsasong" : null });
  }

  // ---------- PRODUKTION ----------
  // Tre lägen som ska synas på håll: Beställd (leverantören har bekräftat – bundna pengar), Inskickad (skickad men inte bekräftad)
  // och Preliminär (placeholder, inget beställt). Inlevererade och avbrutna ligger för sig.
  // När en sample godkänns blir stylen Godkänd. Här syns den i Produktion tills den ligger på en PO som är inskickad.
  const readyToOrder = () => (designOnly() || ME.leverantor ? [] : D.styles.filter((s) => styleStatusNorm(s.status) === "Godkänd" && !s.grund && !hasPlacedPo(s)))
    .sort((a, b) => String((plan(a) || {}).po || "9999").localeCompare(String((plan(b) || {}).po || "9999")) || (a.namn || "").localeCompare(b.namn || "", "sv"));
  // Redo att beställa ligger som en egen ruta ihop med Flaggat överst i Produktion tills PO:n är inskickad.
  function readyCard(items) {
    const card = h("section", { class: "card flagbox ready" }, h("div", { class: "card-head" }, h("h3", { text: "Ready to order" }), h("span", { class: "sub", text: items.length + (items.length === 1 ? " approved style without a placed PO" : " approved styles without a placed PO") + " – set quantities and colours and place the order." + " Stays here until the PO is confirmed." })));
    for (const st of items) {
      const p = plan(st); const ph = poLinesOf(st._id).map((x) => x.po).find((po) => poStatusNorm(po.status) === "Placeholder");
      const cols = (st.farger || []).filter(Boolean);
      const mk = () => openPo(null, { leverantor: st.leverantor || "", sasong: st.sasong || ProdView.seasonInView() || "", rader: (cols.length ? cols : [""]).map((farg) => ({ styleId: st._id, produkt: st.namn, farg, typ: st.typ || "Nyhet", storlekar: (st.storlekar || []).slice() })) });
      const bits = [[st.sasong, st.drop].filter(Boolean).join(" "), st.leverantor, cols.length ? cols.length + (cols.length === 1 ? " colour" : " colours") : "colours not set"].filter(Boolean).join(" · ");
      card.append(h("div", { class: "flagrow", dataset: { style: st._id } }, h("span", { class: "pill", text: "Godkänd" }),
        h("div", null, h("div", { class: "ft" }, h("b", { text: st.namn }), " – ", bits), h("div", { class: "fm", text: (p && p.note) || "No PO schedule yet." })),
        h("div", { class: "fa" }, h("button", { class: "btn small", type: "button", text: "Open style", onclick: () => openStyle(st._id, null, { full: true }) }),
          canWrite && db && ph ? h("button", { class: "btn small", type: "button", text: "Open " + (ph.nr || "placeholder"), onclick: () => openPo(ph._id) }) : null,
          canWrite && db ? h("button", { class: "btn small primary", type: "button", text: "Create PO", onclick: mk }) : null)));
    }
    return card;
  }
  const PO_GROUPS = [
    { key: "ordered", titel: "Ordered", desc: "confirmed by the supplier – committed money" },
    { key: "prelim", titel: "Preliminary", desc: "placeholders – planned, nothing ordered" },
    { key: "done", titel: "Delivered", desc: "in the warehouse" },
    { key: "cancel", titel: "Cancelled", desc: "not counted" }
  ];
  const poGroup = (p) => { const s = poStatusNorm(p.status); return s === "Placeholder" ? "prelim" : s === "Inlevererad" ? "done" : s === "Avbruten" ? "cancel" : "ordered"; };
  const PO_STAGE_TEXT = { "Placeholder": "Preliminary · not ordered", "PO bekräftad": "Ordered · confirmed", "Skickad": "Ordered · shipped", "Inlevererad": "Inlevererad", "Avbruten": "Avbruten", "Problem": "Problem" };
  function poStagePill(p) {
    const s = poStatusNorm(p.status), g = poGroup(p);
    const pill = h("span", { class: "pill pg-" + g, text: PO_STAGE_TEXT[s] || s });
    const l = poLate(p);
    return h("span", { style: "display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap" }, pill, l ? h("span", { class: "pill s-Problem", title: poLateText(p, l), text: "Problem · late " + l.dagar + " d" }) : null);
  }
  const ProdView = {
    mount(root) {
      const st = UI.prod;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "ordered", label: "Beställt" },
        { key: "prelim", label: "Preliminary", cls: "t-prelim" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_prod", "Search PO, product, colour, fabric …", st, () => this.update());
      this.fSeason = filterSelect("f_p_season", "All seasons", st, "season", upd);
      this.fLev = filterSelect("f_p_lev", "All suppliers", st, "lev", upd);
      this.seg = makeSeg([["aktiva", "Active"], ["Placeholder", "Placeholder"], ["PO bekräftad", "Confirmed"], ["Inlevererad", "Inlevererad"], ["alla", "All"]], st, "status", upd);
      this.count = h("span", { class: "count" });
      this.cards = h("div", { class: "cards" });
      const open = (e) => { if (e.target.closest("button")) return; const tr = e.target.closest("tr[data-po], .card-head[data-po]"); if (tr) openPo(tr.dataset.po); };
      this.cards.addEventListener("click", open);
      this.cards.addEventListener("keydown", (e) => { if (e.key === "Enter") open(e); });
      this.empty = h("div", { class: "empty", hidden: true });
      this.budget = h("section", { class: "budget", "aria-label": "Budget" });
      this.pay = h("section", { class: "card", "aria-label": "Payments" });
      this.tl = h("div", { class: "cards" });
      this.budgetEdit = false;
      root.append(this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fSeason.el, this.fLev.el, this.seg.el, this.count), this.cards, this.empty, this.budget);
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
      const gsum = (g) => inSeason.filter((p) => poGroup(p) === g).reduce((a, p) => a + poTotal(p), 0);
      const gn = (g) => inSeason.filter((p) => poGroup(p) === g).length;
      if (!["ordered", "prelim"].includes(st.view)) st.view = null;
      if (["Inskickad", "I produktion"].includes(st.status)) st.status = "aktiva";
      this.strip.set({ ordered: fmtTkr(gsum("ordered")), prelim: fmtTkr(gsum("prelim")) },
        { ordered: gn("ordered") + " PO confirmed", prelim: gn("prelim") + " placeholders, nothing ordered" });
      this.seg.sync();
      const list = D.po.filter((p) => {
        const ps = poStatusNorm(p.status);
        if (season && norm(poSeason(p)) !== norm(season)) return false;
        switch (st.view) {
          case "ordered": case "prelim": if (poGroup(p) !== st.view) return false; break;
          default:
            if (st.status === "aktiva" && !(PO_OPEN.includes(ps) || ps === "Placeholder")) return false;
            if (st.status !== "aktiva" && st.status !== "alla" && ps !== st.status) return false;
        }
        if (st.lev && p.leverantor !== st.lev) return false;
        if (q && ![p._id, p.nr, p.leverantor, p.sasong, p.drop, p.status, p.kommentar, (p.rader || []).map((r) => [r.produkt, r.farg, r.tyg].join(" ")).join(" ")].join(" ").toLowerCase().includes(q)) return false;
        return true;
      });
      const gOrder = { ordered: 0, prelim: 2, done: 3, cancel: 4 };
      const order = { Skickad: 0, "I produktion": 1, "PO bekräftad": 2, Problem: 3, Inskickad: 4, Placeholder: 5, Inlevererad: 6, Avbruten: 7 };
      list.sort((a, b) => gOrder[poGroup(a)] - gOrder[poGroup(b)] || (order[poStatusNorm(a.status)] ?? 9) - (order[poStatusNorm(b.status)] ?? 9) || (poEta(a) || "9999").localeCompare(poEta(b) || "9999") || String(a.nr || a._id).localeCompare(String(b.nr || b._id), "sv"));
      const cards = [];
      let lastG = null;
      for (const p of list) {
        const g = poGroup(p);
        if (g !== lastG) {
          lastG = g; const def = PO_GROUPS.find((x) => x.key === g); const inG = list.filter((x) => poGroup(x) === g);
          cards.push(h("div", { class: "po-sec g-" + g }, h("h2", { text: def.titel }), h("span", { class: "d", text: inG.length + " PO · " + def.desc }), h("span", { class: "sum", text: fmtTkr(inG.reduce((a, x) => a + poTotal(x), 0)) })));
        }
        const card = h("section", { class: "card po-card g-" + g });
        card.append(this.groupRow(p));
        const lines = (p.rader || []);
        const { t, tb } = table([["Product"], ["Colours"], ["Quantity", "num"], ["Unit price", "num"], ["Cost", "num"]]);
        if (!lines.length) tb.append(h("tr", { dataset: { po: p._id } }, h("td", { colSpan: 5, class: "sub", text: "No lines yet – open the PO and add products." })));
        const byProd = new Map();
        for (const r of lines) { const k = (r.styleId || "") + "|" + norm(r.produkt); if (!byProd.has(k)) byProd.set(k, []); byProd.get(k).push(r); }
        for (const rs of byProd.values()) tb.append(this.prodRow(p, rs));
        card.append(h("div", { class: "ledger-wrap" }, t));
        cards.push(card);
      }
      this.cards.replaceChildren(...cards);
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(...(!loaded.has("po") ? [h("strong", { text: db ? "Loading production …" : "No production to show" })] : D.po.length ? [h("strong", { text: "Nothing matches the filter" }), h("span", { text: "Change season or status, or clear the search." })] : [h("strong", { text: "No POs yet" }), h("span", { text: "Add the first one with \"+ New PO\"." })]));
      this.count.textContent = list.length + " of " + inSeason.length + " POs" + (season ? " in " + season : "");
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
        if (tl) cards.push(h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: d.namn + " – " + season }), h("span", { class: "sub", text: [isISO(d.klartSenast) ? "In stock by " + fmtDate(d.klartSenast) : "", isISO(d.lansering) ? "Launch " + fmtDate(d.lansering) : ""].filter(Boolean).join(" · ") }), canWrite && db ? h("div", { class: "right" }, h("button", { class: "btn small", type: "button", text: "Edit drop", onclick: () => openDrop(d._id) })) : null), tl));
      }
      const placed = new Set(drops.flatMap((d) => inSeason.filter((s) => dropKey(s.sasong, s.drop) === dropKey(d.sasong, d.namn)).map((s) => s._id)));
      const rest = inSeason.filter((s) => !placed.has(s._id));
      const tlr = rest.length ? dropTimeline({ sasong: season, namn: "No drop" }, rest) : null;
      if (tlr) cards.push(h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: "No drop – " + season })), tlr));
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
      box.append(h("div", { class: "card-head" }, h("h3", { text: "Payments" }), h("span", { class: "sub", text: all.length ? "Unpaid in total " + fmtTkr(sum(all)) + " · within 90 days " + fmtTkr(sum(due90)) + " · all seasons" : "No unpaid payments. Payments are calculated from the supplier's terms under Suppliers, or from the deposit/final payment on the PO." })));
      if (!all.length) return;
      const { t, tb } = table([["Due"], ["PO"], ["Supplier"], ["Type"], ["Amount", "num"], ["Status"]]);
      const byLev = {};
      for (const x of all.slice(0, 40)) {
        const d = x.datum ? diffDays(x.datum) : null;
        tb.append(h("tr", { tabIndex: 0, dataset: { po: x.po._id } },
          td("Due", "mono", x.datum ? fmtDate(x.datum) : h("span", { class: "muted", text: "date missing" }), d != null ? h("div", { class: "days " + (d < 0 ? "late" : d <= 14 ? "soon" : ""), text: fmtDays(d) }) : null),
          td("PO", "c-main", h("div", { class: "prod", text: x.po.nr || x.po._id }), h("div", { class: "sub", text: [x.po.sasong, x.po.drop].filter(Boolean).join(" ") })),
          td("Supplier", null, x.po.leverantor || ""), td("Type", null, x.typ, x.kalla === "antagande" ? h("div", { class: "sub", text: "terms missing – assumed" }) : null), td("Amount", "num", fmtSEK(x.belopp), x.valuta !== "SEK" ? h("div", { class: "sub", text: fmtCur(x.beloppValuta, x.valuta) }) : null), td("Status", null, poStatusPill(x.po))));
        byLev[x.po.leverantor || "–"] = (byLev[x.po.leverantor || "–"] || 0) + x.belopp;
      }
      box.append(h("div", { class: "ledger-wrap" }, t));
      box.append(h("div", { class: "totals", style: "margin:0" }, Object.entries(byLev).sort((a, b) => b[1] - a[1]).map(([k, v]) => h("span", null, k + ": ", h("b", { text: fmtTkr(v) })))));
    },
    groupRow(p) {
      const ps = poStatusNorm(p.status);
      const eta = poEta(p);
      const d = eta ? diffDays(eta) : null;
      const bits = [h("span", { class: "nr", text: p.nr || p._id }), h("span", { class: "m", text: p.leverantor || "" }), poStagePill(p)];
      // Nyhet / Restock / NOOS, ur raderna – kommentaren visas inte på kortet (den står kvar i PO:n).
      const typer = STYLE_TYP.filter((t) => (p.rader || []).some((r) => (r.typ || "Nyhet") === t));
      if (typer.length) bits.push(h("span", { class: "m" }, h("b", { text: typer.join(" · ") })));
      bits.push(h("span", { class: "m" }, "Drop ", h("b", { text: [p.sasong, p.drop].filter(Boolean).join(" ") || "–" })));
      bits.push(h("span", { class: "m" }, "ETA warehouse ", h("b", { text: eta ? fmtDate(eta) : "–" })));
      if (d != null && PO_OPEN.includes(ps)) bits.push(h("span", { class: "days " + (d < 0 ? "late" : d <= 14 ? "soon" : ""), text: fmtDays(d) }));
      if (isISO(p.bekraftadEx) || isISO(p.planeradEx)) bits.push(h("span", { class: "m" }, "Ex-factory ", h("b", { text: fmtDate(p.bekraftadEx || p.planeradEx) })));
      if (p.tygstatus) bits.push(h("span", { class: "m" }, "Fabric: ", h("b", { text: p.tygstatus })));
      const tot = poTotal(p);
      bits.push(h("span", { class: "m" }, "Total ", h("b", { text: fmtSEK(tot) })));
      const head = h("div", { class: "card-head", dataset: { po: p._id }, tabIndex: 0, style: "cursor:pointer" }, h("h3", { text: p.nr || p._id }), h("div", { class: "po-head" }, bits.slice(1)));
      if (p.kommentar) head.title = p.kommentar;
      if (canWrite && db) head.append(h("div", { class: "right" }, h("button", { class: "btn small", type: "button", text: "Open PO", onclick: () => openPo(p._id) })));
      return head;
    },
    prodRow(p, rs) {
      const r0 = rs[0];
      const st = byId(D.styles, r0.styleId);
      const units = rs.reduce((a, r) => a + (num(r.antal) || 0), 0);
      const unknown = rs.some((r) => num(r.antal) == null);
      const cost = rs.reduce((a, r) => a + (lineCost(r) || 0), 0);
      const u0 = lineUnit(r0);
      const colours = h("div", { class: "swatches" }, rs.slice().sort((a, b) => fargText(a.farg || "").localeCompare(fargText(b.farg || ""), "sv")).map((r) => h("span", { class: "swatch btn-swatch", style: "cursor:default" }, colourDot(fargText(r.farg)), (fargText(r.farg) || "TBA") + (num(r.antal) != null ? " " + r.antal : ""))));
      const pimg = st ? styleImage(st) : null;
      return h("tr", { tabIndex: 0, dataset: { po: p._id } },
        td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, pimg ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(pimg), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(styleAllImages(st), pimg); } }) : null, h("div", null, h("div", { class: "prod", text: r0.produkt || (st ? st.namn : "–") }), h("div", { class: "sub" }, r0.typ && r0.typ !== "Nyhet" ? chip(r0.typ) : null, st ? h("button", { class: "linkish", type: "button", text: st._id + (styleKategori(st) ? " · " + styleKategori(st) : ""), onclick: (e) => { e.stopPropagation(); openStyle(st._id); } }) : h("span", { class: "muted", text: "No style linked" }))))),
        td("Colours", null, colours),
        td("Quantity", "num", unknown && !units ? "?" : String(units) + (unknown ? "+" : "")),
        td("Unit price", "num", u0 ? h("div", null, h("div", { text: fmtSEK(u0.pris) }), u0.kalla === "style" ? h("div", { class: "sub", text: "from the style" + (st && st.inkopsValuta ? " · " + num(st.inkopspris) + " " + st.inkopsValuta : "") }) : null) : h("span", { class: "muted", text: "–" })),
        td("Cost", "num", cost ? fmtSEK(cost) : "–")
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
        td("", "c-main", h("div", { class: "prod", text: r.produkt || (st ? st.namn : "–") }), h("div", { class: "sub" }, r.typ && r.typ !== "Nyhet" ? chip(r.typ) : null, st ? h("button", { class: "linkish", type: "button", text: st._id + (styleKategori(st) ? " · " + styleKategori(st) : ""), onclick: (e) => { e.stopPropagation(); openStyle(st._id); } }) : h("span", { class: "muted", text: "No style linked" }))),
        td("Colour", null, r.farg || h("span", { class: "muted", text: "TBA" })),
        td("Tyg", "note", r.tyg || ""),
        td("Quantity", "num", r.antal == null || r.antal === "" ? "?" : String(r.antal), perSize ? h("div", { class: "sub", style: "text-align:right;font-family:var(--f-mono)", text: sizes.map((sz) => sz + ":" + (perSize[sz] ?? 0)).join(" ") }) : null),
        td("Fabric/unit", "num", num(r.tygkostnad) != null ? fmtSEK(r.tygkostnad) : "–"),
        td("Unit price", "num", num(r.styckpris) != null ? fmtSEK(r.styckpris) : "–"),
        td("Cost", "num", cost != null ? fmtSEK(cost) : "–"),
        td("EAN", "mono", !st || !r.farg ? "–" : sizes.length ? got + "/" + sizes.length : "–"),
        td("Fotosample", null, r.fotosample || p.fotosample || "", (r.fotosampleLeverans || p.fotosampleLeverans) ? h("div", { class: "sub mono", text: fmtDate(r.fotosampleLeverans || p.fotosampleLeverans) }) : null)
      );
      return tr;
    },
    renderBudget(season, inSeason) {
      const box = this.budget; box.replaceChildren();
      if (ME.leverantor) { box.hidden = true; return; } box.hidden = false;
      if (!season) { box.append(h("p", { class: "hint", text: "Choose a season to see the budget." })); return; }
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
      const head = h("div", { class: "budget-head" }, h("h3", { text: "Budget " + season }), h("span", { class: "sub", text: b ? "Purchase value excl. freight and duty" : "No budget set for " + season + " yet." }));
      if (canAdmin && canWrite && db && !edit && this.allowEdit !== false) head.append(h("span", { class: "spacer" }), h("button", { class: "btn small", type: "button", text: b ? "Change budget" : "Set budget", onclick: () => { this.budgetEdit = true; this.update(); } }));
      box.append(head);
      const inputs = {};
      const over = total != null && sumLagt + sumPlan > total;
      const tile = (k, v, cls) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v big " + (cls || ""), text: v }));
      const totRow = h("div", { class: "budget-tot" });
      if (edit) { const i = inp("bud_total", total == null ? "" : Math.round(total / 1000), { type: "number", min: "0", step: "1" }); inputs._total = i; totRow.append(h("div", { class: "kv" }, h("span", { class: "k", text: "Frame (k SEK)" }), i)); }
      else totRow.append(tile("Frame", total != null ? fmtTkr(total) : "–"));
      totRow.append(tile("Placed", fmtTkr(sumLagt)), tile("Planned", fmtTkr(sumPlan)), tile("Left", total != null ? fmtTkr(total - sumLagt - sumPlan) : "–", over ? "over" : ""), tile("Used", total ? Math.round(((sumLagt + sumPlan) / total) * 100) + " %" : "–"));
      box.append(totRow);
      const grid = h("div", { class: "budget-grid" });
      const allKats = kats.concat(Object.keys(per).filter((k) => !kats.includes(k) && (per[k].lagt || per[k].plan)));
      for (const k of allKats) {
        const x = per[k]; const bud = x.budget; const used = x.lagt + x.plan;
        const pct = bud ? Math.min(100, (x.lagt / bud) * 100) : 0, pct2 = bud ? Math.min(100, (used / bud) * 100) : 0;
        const card = h("div", { class: "bcat" }, h("span", { class: "k", text: k }));
        if (edit && kats.includes(k)) { const i = inp("bud_" + slug(k), bud == null ? "" : Math.round(bud / 1000), { type: "number", min: "0", step: "1", placeholder: "k SEK" }); inputs[k] = i; card.append(i); }
        else card.append(h("span", { class: "big" }, bud != null ? fmtTkr(bud) : "–", bud ? h("small", { text: Math.round((used / bud) * 100) + " %" }) : null));
        card.append(h("div", { class: "bar" }, h("i", { class: "plan" + (bud && used > bud ? " over" : ""), style: "width:" + pct2 + "%" }), h("i", { style: "width:" + pct + "%" })));
        card.append(h("div", { class: "rows" }, h("div", null, "Placed", h("b", { text: fmtTkr(x.lagt) })), h("div", null, "Planned", h("b", { text: fmtTkr(x.plan) })), h("div", { class: bud != null && bud - used < 0 ? "over" : "" }, "Left", h("b", { text: bud != null ? fmtTkr(bud - used) : "–" }))));
        grid.append(card);
      }
      box.append(grid);
      const foot = h("div", { class: "budget-foot" });
      foot.append(h("span", { text: "Black = placed (confirmed POs), grey = planned (placeholders)." }));
      if (total != null && sumBudget && Math.round(sumBudget) !== Math.round(total)) foot.append(h("span", { text: "The categories add up to " + fmtTkr(sumBudget) + " – " + fmtTkr(total - sumBudget) + " of the frame is unallocated." }));
      if (per["Okategoriserat"].lagt || per["Okategoriserat"].plan) foot.append(h("span", { class: "late-text", text: "Lines without a category are not counted against any category – set a category on the style." }));
      if (edit) foot.append(h("span", { class: "spacer" }), h("button", { class: "btn small", type: "button", text: "Cancel", onclick: () => { this.budgetEdit = false; this.update(); } }),
        h("button", { class: "btn small primary", type: "button", text: "Save budget", onclick: async () => {
          const kategorier = {}; for (const k of kats) { const v = num(inputs[k].value); kategorier[k] = v == null ? null : v * 1000; }
          const tv = num(inputs._total.value);
          try { await db.collection("budget").doc(slug(season)).set({ sasong: season, total: tv == null ? null : tv * 1000, kategorier, andrad: new Date().toISOString(), av: myId }); toast("Budget saved"); this.budgetEdit = false; } catch (e) { writeError(e); }
        } }));
      box.append(foot);
    }
  };

  // ---------- PO sheet ----------
  const PO_LABELS = { nr: "PO no.", leverantor: "Supplier", sasong: "Season", drop: "Drop", status: "Status", prioritet: "Priority", produktionstid: "Production time", fotosample: "Fotosample", fotosampleLeverans: "Photo sample expected", tygstatus: "Fabric status", orderBekraftad: "Order confirmed", planeradEx: "Requested ex-factory", bekraftadEx: "Confirmed ex-factory", etaLager: "ETA warehouse", valuta: "Currency", kommentar: "Comment", orderDatum: "Order date", leveransOnskad: "Requested delivery", labelInstructions: "Label instructions", forskottBelopp: "Deposit amount", forskottDatum: "Deposit due", forskottBetald: "Deposit paid", slutBelopp: "Final payment amount", slutDatum: "Final payment due", slutBetald: "Final payment paid" };
  const manualPayments = (po) => { const out = []; if (num(po.forskottBelopp)) out.push({ po, typ: "Förskott", belopp: num(po.forskottBelopp), datum: po.forskottDatum, betald: !!po.forskottBetald, kalla: "manuell", idx: "f" }); if (num(po.slutBelopp)) out.push({ po, typ: "Slutbetalning", belopp: num(po.slutBelopp), datum: po.slutDatum, betald: !!po.slutBetald, kalla: "manuell", idx: "s" }); return out; };
  const LEV_TYP = ["Producent", "Tyg", "Trim", "Övrigt"];
  const VILLKOR_VID = [["order", "on order"], ["produktion", "at production start"], ["exfactory", "at ex-factory"], ["leverans", "on delivery"], ["faktura", "net from invoice (ex-factory)"]];
  const VID_LABEL = { order: "on order", produktion: "at production", exfactory: "at ex-factory", leverans: "on delivery", faktura: "netto" };
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
    if (ink && !ink.valuta && !(lev && lev.valuta)) { out.kalla = "purchase price " + num(ink.pris) + " – currency missing"; }
    else if (ink && fx(valuta)) { kostnad = num(ink.pris) * kurs; out.kalla = "purchase price " + fmtCur(num(ink.pris), valuta) + (ink.kalla ? " (" + ink.kalla + (ink.datum ? " " + fmtDate(ink.datum) : "") + ")" : ""); }
    else { const uc = unitCostOf(s._id); if (uc) { kostnad = uc.kostnad; out.po = uc.po; out.kalla = "PO average " + uc.po.join(", "); } }
    if (kostnad != null) { out.kostnad = kostnad; out.kostnadValuta = kostnad / kurs; out.gm = (netto - kostnad) / netto * 100; out.gmStress = (netto - kostnad * (1 + stress)) / netto * 100; out.tal = valuta === "SEK" ? null : (0.3 * netto / kostnad - 1) * 100; }
    return out;
  }
  const gmClass = (gm) => (gm == null ? "" : gm >= 75 ? "ts-ok" : gm >= 70 ? "ts-delvis-slut" : "ts-slut");
  const fmtPct = (n, d = 0) => (n == null || isNaN(n) ? "–" : (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString("sv-SE") + " %");
  function gmCell(info) {
    if (!info) return h("span", { class: "muted", text: "–" });
    if (info.kostnad == null) return h("span", { class: "sub", text: "GM1: cost missing on PO" });
    return h("div", { class: "gm" }, h("div", { class: "gm-row" }, h("span", { class: "pill " + gmClass(info.gm), text: "GM1 " + fmtPct(info.gm) }),
      info.valuta !== "SEK" ? h("span", { class: "pill " + gmClass(info.gmStress), title: "GM1 if SEK weakens " + info.stress + " % vs " + info.valuta, text: info.valuta + " +" + info.stress + " %: " + fmtPct(info.gmStress) }) : null),
      h("div", { class: "sub", text: "cost " + fmtSEK(info.kostnad) + (info.valuta !== "SEK" ? " (" + fmtCur(info.kostnadValuta, info.valuta) + ")" : "") + (info.kalla ? " · " + info.kalla : "") + " · net " + fmtSEK(info.netto) + (info.tal != null ? (info.tal >= 0 ? " · tolerates +" + Math.round(info.tal) + " % " + info.valuta + " before GM1 < 70 %" : " · already below 70 % today") : "") }));
  }
  const termsText = (l) => { if (!l) return ""; const v = Array.isArray(l.villkor) ? l.villkor : []; if (!v.length) return l.villkorText || ""; return v.map((t) => (num(t.andel) ?? 0) + " % " + (t.vid === "faktura" ? (num(t.dagar) || 0) + " days net" : VID_LABEL[t.vid] + (num(t.dagar) ? " +" + t.dagar + " d" : ""))).join(", ") + (num(l.rabatt) ? " · " + l.rabatt + " % discount" : ""); };
  function poMilestones(po) {
    const prodDays = num(po.produktionstid) ?? levNum(po.leverantor, "production time");
    const ord = isISO(po.orderDatum) ? po.orderDatum : null;
    const frakt = ETA_DAGAR;
    const ex = isISO(po.bekraftadEx) ? po.bekraftadEx : isISO(po.planeradEx) ? po.planeradEx : ord && prodDays != null ? addDays(ord, prodDays) : isISO(po.leveransOnskad) ? addDays(po.leveransOnskad, -frakt) : null;
    const lev = poEta(po) || (ex ? addDays(ex, frakt) : null) || (isISO(po.leveransOnskad) ? po.leveransOnskad : null);
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
      const antagenBetald = !rec && !!datum && datum < todayISO() && (st === "Inlevererad" || (["PO bekräftad", "Skickad"].includes(st) && ["order", "produktion"].includes(t.vid)));
      const typ = (num(t.andel) ?? 0) + " % " + (t.vid === "faktura" ? (num(t.dagar) || 0) + " d net" : VID_LABEL[t.vid] || t.vid);
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
    if (designOnly()) return;
    const isNew = !id;
    const po = isNew ? Object.assign({ _id: null, status: "Placeholder", prioritet: "Normal", valuta: "SEK", rader: [], logg: [], orderDatum: todayISO(), labelInstructions: PO_DEFAULTS.label }, preset || {}) : byId(D.po, id);
    if (!po) { toast("Cannot find the PO."); return; }
    const ro = !canWrite || !db;
    const current = () => (isNew ? po : byId(D.po, po._id) || po);
    const fNr = inp("f_pnr", po.nr, { placeholder: "Set automatically" });
    const fLev = inp("f_plev", po.leverantor, { list: "dlLev", autocomplete: "off" });
    const fSas = seasonSelect("f_psas", po.sasong, "– Choose season –");
    // Drop på PO:n: följer stylarna om inget annat väljs. Alla som får redigera kan välja en annan drop –
    // antingen bara för den här PO:n (t.ex. en restock) eller för stylarna också (då flyttas droppen överallt).
    const FOLJ = "__stylarna";
    const styleDropsNow = () => (isNew ? [] : poStyleDrops({ sasong: fSas.value, rader: (current() || po).rader || [] }));
    let poDropFoljer = !isNew && !po.dropEgen && styleDropsNow().length > 0;
    fSas.addEventListener("change", () => { poDropFoljer = fDrop.value === FOLJ; });
    const fDrop = dropSelect("f_pdrop", po._dropRaw != null ? po._dropRaw : po.drop, fSas);
    const baseRefill = fDrop.refill;
    fDrop.refill = (keep) => { baseRefill(keep === FOLJ ? "" : keep); const ds = styleDropsNow(); if (ds.length) { fDrop.insertBefore(new Option("Follows the styles: " + ds.join(" + "), FOLJ), fDrop.firstChild); if (poDropFoljer || keep === FOLJ) fDrop.value = FOLJ; } };
    fDrop.refill(po._dropRaw != null ? po._dropRaw : po.drop);
    const fFlytta = h("input", { type: "checkbox", id: "f_pflytta" });
    const flyttaWrap = h("div", { hidden: true }, h("label", { class: "plain", for: "f_pflytta" }, fFlytta, h("span")), h("span", { class: "hint", text: "Changes the drop everywhere. Unticked = only this PO, e.g. a restock." }));
    const dropHint = h("span", { class: "hint" });
    const syncDropPo = () => {
      const ds = styleDropsNow(); const v = fDrop.value;
      const annan = ds.length > 0 && v !== FOLJ && v !== "" && !(ds.length === 1 && norm(ds[0]) === norm(v));
      flyttaWrap.hidden = !annan;
      if (annan) flyttaWrap.querySelector("label span").textContent = "Also move the styles to " + v;
      dropHint.textContent = !ds.length ? "Follows the styles as soon as they have a drop" : v === FOLJ ? "Follows the styles' drop. Choose another drop to move the PO, e.g. a restock or a late delivery." : v === "" ? "Own choice: the PO is not counted against any drop." : annan ? "Own choice on the PO – overrides the styles' drop." : "Same drop as the styles.";
    };
    const poDropChoice = () => {
      const ds = styleDropsNow(); const v = fDrop.value;
      if (v === FOLJ) return { drop: po._dropRaw || "", egen: false, flytta: false };
      const same = ds.length === 1 && norm(ds[0]) === norm(v);
      const flytta = ds.length > 0 && v !== "" && !same && fFlytta.checked;
      return { drop: v.trim(), egen: ds.length > 0 && !same && !flytta, flytta };
    };
    fDrop.addEventListener("change", () => { const ds = styleDropsNow(); if (fDrop.value !== FOLJ && fDrop.value !== "" && ds.length) fFlytta.checked = !((current() || po).rader || []).some((r) => (r.typ || "Nyhet") !== "Nyhet"); syncDropPo(); });
    syncDropPo();
    const fStatus = selectEl("f_pstatus", PO_STATUS, poStatusNorm(po.status));
    const fProd = h("div", { class: "calc", id: "f_pprod" });
    const fFoto = selectEl("f_pfoto", FOTOSAMPLE_PO, fotoPoNorm(po.fotosample));
    const fFotoD = inp("f_pfotod", po.fotosampleLeverans, { type: "date" });
    const fTygS = selectEl("f_ptygs", TYGSTATUS_PO.map((x) => [x, x || "–"]), isNew ? "Hos fabrik" : po.tygstatus || "");
    const fBek = selectEl("f_pbek", [["", "Nej"], ["1", "Ja"]], po.orderBekraftad ? "1" : "");
    const fPlan = inp("f_pplan", po.planeradEx, { type: "date" });
    const fBekEx = inp("f_pbekex", po.bekraftadEx, { type: "date" });
    const fEta = h("div", { class: "calc", id: "f_peta" });
    const fOrdD = inp("f_pordd", po.orderDatum, { type: "date" });
    const fLevO = inp("f_plevo", po.leveransOnskad, { type: "date" });
    const fLabel = area("f_plabel", po.labelInstructions == null ? PO_DEFAULTS.label : po.labelInstructions, "Label instructions for the PO file");
    const fFskB = inp("f_pfskb", po.forskottBelopp, { type: "number", min: "0", step: "1", placeholder: "amount" });
    const fFskD = inp("f_pfskd", po.forskottDatum, { type: "date" });
    const fFskP = selectEl("f_pfskp", [["", "Ej betalt"], ["1", "Betalt"]], po.forskottBetald ? "1" : "");
    const fSlutB = inp("f_pslutb", po.slutBelopp, { type: "number", min: "0", step: "1", placeholder: "amount" });
    const fSlutD = inp("f_pslutd", po.slutDatum, { type: "date" });
    const fSlutP = selectEl("f_pslutp", [["", "Ej betalt"], ["1", "Betalt"]], po.slutBetald ? "1" : "");
    const legacyPay = [po.forskottBetalt ? "Deposit (old field): " + po.forskottBetalt : "", po.slutbetalning ? "Final payment (old field): " + po.slutbetalning : ""].filter(Boolean).join(" · ");
    const fVal = selectEl("f_pval", PO_VALUTOR, po.valuta || "SEK");
    const fKom = area("f_pkom", po.kommentar);
    const nrHint = h("span", { class: "hint", text: isNew ? "Prefix, season and running number – set automatically" : "" });
    // PO-nr: leverantörens prefix + säsong + nästa löpnummer. Följer med tills någon skriver ett eget.
    const syncNr = () => { if (!isNew || fNr.dataset.egen === "1") return; fNr.value = fLev.value.trim() && fSas.value ? nextPoNr(fLev.value.trim(), fSas.value) : ""; };
    fNr.addEventListener("input", () => { fNr.dataset.egen = fNr.value.trim() ? "1" : ""; });
    // Valuta: leverantörens valuta föreslås på en ny PO tills någon väljer själv.
    const syncVal = () => { if (!isNew || fVal.dataset.egen === "1") return; const l = levByName(fLev.value); if (l && PO_VALUTOR.includes(l.valuta)) fVal.value = l.valuta; };
    fVal.addEventListener("change", () => { fVal.dataset.egen = "1"; });
    // Produktionstid räknas ut: orderdatum till önskad ex-factory.
    const prodDagar = () => (isISO(fOrdD.value) && isISO(fPlan.value) ? daysBetween(fOrdD.value, fPlan.value) : null);
    const syncProd = () => { const d = prodDagar(); fProd.textContent = d == null ? "–" : d < 0 ? "Ex-factory is before the order date" : d + " " + "days"; };
    [fOrdD, fPlan].forEach((x) => { x.addEventListener("input", syncProd); x.addEventListener("change", syncProd); });
    [fLev, fSas].forEach((x) => { x.addEventListener("input", syncNr); x.addEventListener("change", () => { syncNr(); syncVal(); }); });
    // ETA lager räknas ut: ex-factory (bekräftad, annars önskad) + 5 dagar.
    const etaNu = () => { const ex = isISO(fBekEx.value) ? fBekEx.value : isISO(fPlan.value) ? fPlan.value : null; return ex ? addDays(ex, ETA_DAGAR) : isISO(po.etaLager) ? po.etaLager : null; };
    const syncEta = () => { const e = etaNu(); fEta.textContent = e ? fmtDate(e) : "–"; };
    [fPlan, fBekEx].forEach((x) => { x.addEventListener("input", syncEta); x.addEventListener("change", syncEta); });
    syncProd(); syncNr(); syncVal(); syncEta();
    const form = h("form", { class: "form three", id: "poForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("h3", { class: "sec-title full", text: "Order" }),
      h("div", { class: "field" }, h("label", { for: "f_pnr", text: "PO no." }), fNr, nrHint), field("Supplier", fLev), field("Status", fStatus),
      field("Season", fSas), h("div", { class: "field" }, h("label", { for: "f_pdrop", text: "Drop" }), fDrop, dropHint, flyttaWrap), h("div"),
      h("h3", { class: "sec-title full", text: "Schedule" }),
      field("Order date", fOrdD), field("Requested ex-factory", fPlan), field("Production time", fProd, { hint: "Calculated: order date to ex-factory" }),
      isNew ? null : field("Confirmed ex-factory", fBekEx), isNew ? null : field("ETA warehouse", fEta, { hint: "Calculated: ex-factory + 5 days" }), isNew ? null : field("Requested delivery", fLevO, { hint: "Empty = the drop's \"In stock by\"" }),
      h("h3", { class: "sec-title full", text: "Fabric and photo sample" }),
      field("Fabric status", fTygS), field("Fotosample", fFoto, { hint: "Empty = ordered automatically for new styles" }), field("Photo sample expected", fFotoD),
      h("h3", { class: "sec-title full", text: "Övrigt" }),
      field("Currency", fVal), field("Comment", fKom, { full: false }), h("div"),
      field("Label instructions", fLabel, { full: true }));
    if (ro) lock(form);

    // ---- lines ----
    const linesEl = h("div", { class: "lines" });
    const totalsEl = h("div", { class: "totals" });
    const lines = (po.rader || []).map((r) => Object.assign({}, r));
    function styleByName(name) { const n = norm(name); return D.styles.find((s) => norm(s.namn) === n) || null; }
    function lineEditor(r, idx) {
      const st = r.styleId ? byId(D.styles, r.styleId) : null;
      const fProdN = inp("l_prod_" + idx, r.produkt || (st ? st.namn : ""), { list: "dlStyle", autocomplete: "off", placeholder: "Product (style)" });
      const fFarg = inp("l_farg_" + idx, r.farg, { placeholder: "Colour", list: "dlFarger", autocomplete: "off" });
      const fTyp = selectEl("l_typ_" + idx, STYLE_TYP, r.typ || (st ? st.typ : "Nyhet") || "Nyhet");
      const fTyg = inp("l_tyg_" + idx, r.tyg, { list: "dlTyg", autocomplete: "off", placeholder: "Tyg" });
      const fPris = inp("l_pris_" + idx, r.styckpris, { type: "number", min: "0", step: "0.01", placeholder: "Unit price" });
      // Storlekar: en ruta per storlek. Skalan är XS–XXL eller 44–58; andra storlekar (stylens egna) visas som de är.
      const EGNA = "__egna";
      const start = r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st);
      const egna = start.length && !skalaAv(start) ? start.slice() : null;
      let sizes = egna || PO_SKALOR[skalaAv(start) || "XS–XXL"];
      const q = {};
      if (r.perStorlek) for (const k of Object.keys(r.perStorlek)) { const hit = sizes.find((sz) => norm(sz) === norm(k)); if (hit && num(r.perStorlek[k])) q[hit] = num(r.perStorlek[k]); }
      const utanStorlek = Object.keys(q).length ? null : num(r.antal);
      const fSkala = selectEl("l_skala_" + idx, Object.keys(PO_SKALOR).concat(egna ? [[EGNA, "The style's sizes"]] : []), egna ? EGNA : skalaAv(start) || "XS–XXL");
      const grid = h("div", { class: "szrow" });
      const tot = h("b", { text: "0" });
      const hint = h("span", { class: "sub" });
      const sum = () => sizes.reduce((a, sz) => a + (num(q[sz]) || 0), 0);
      const sync = () => {
        const s2 = styleByName(fProdN.value);
        r.produkt = fProdN.value.trim(); r.styleId = s2 ? s2._id : (r.styleId && st && norm(st.namn) === norm(r.produkt) ? r.styleId : null);
        r.farg = fFarg.value.trim(); r.typ = fTyp.value; r.tyg = fTyg.value.trim(); r.styckpris = num(fPris.value);
        const fyllda = sizes.filter((sz) => num(q[sz]) > 0);
        if (fyllda.length) { r.storlekar = fyllda; r.perStorlek = {}; fyllda.forEach((sz) => (r.perStorlek[sz] = num(q[sz]))); r.antal = sum(); }
        else { r.storlekar = sizes.slice(); r.perStorlek = null; r.antal = utanStorlek; }
        r.kostnad = lineCost(r);
        tot.textContent = String(num(r.antal) || 0);
        hint.textContent = [s2 ? s2._id + (styleKategori(s2) ? " · " + styleKategori(s2) : " · no category") : (r.produkt ? "A new style is created on save" : ""), !fyllda.length && utanStorlek ? "Quantity has no split per size" : "", num(r.tygkostnad) ? "Fabric cost " + fmtSEK(num(r.tygkostnad)) + " per unit is included in the total" : ""].filter(Boolean).join(" · ");
        renderTotals();
      };
      const renderGrid = () => {
        grid.replaceChildren(...sizes.map((sz, i) => {
          const f = h("input", { type: "number", min: "0", step: "1", inputmode: "numeric", id: "l_q_" + idx + "_" + i, "aria-label": sz });
          f.value = num(q[sz]) ? String(q[sz]) : "";
          f.addEventListener("input", () => { const v = num(f.value); if (v) q[sz] = v; else delete q[sz]; sync(); });
          f.addEventListener("focus", () => f.select());
          // Klistra in en hel rad (t.ex. "1 3 12 10 4") så fylls rutorna härifrån och framåt.
          f.addEventListener("paste", (e) => { const parts = ((e.clipboardData && e.clipboardData.getData("text")) || "").split(/[^0-9]+/).filter(Boolean); if (parts.length < 2) return; e.preventDefault(); parts.forEach((v, j) => { const s3 = sizes[i + j]; if (!s3) return; if (Number(v)) q[s3] = Number(v); else delete q[s3]; }); renderGrid(); sync(); });
          return h("label", { class: "sz" }, h("span", { text: sz }), f);
        }), h("div", { class: "sztot" }, h("span", { text: "Quantity" }), tot));
        if (ro) lock(grid);
      };
      [fProdN, fFarg, fTyp, fTyg, fPris].forEach((x) => { x.addEventListener("input", sync); x.addEventListener("change", sync); });
      fSkala.addEventListener("change", () => { sizes = fSkala.value === EGNA ? egna : PO_SKALOR[fSkala.value]; renderGrid(); sync(); });
      fProdN.addEventListener("change", () => { const s2 = styleByName(fProdN.value); const k = s2 ? skalaAv(sizesOf(s2)) : null; if (k && !sum() && fSkala.value !== k) { fSkala.value = k; sizes = PO_SKALOR[k]; renderGrid(); } if (s2 && !fTyp.dataset.touched) fTyp.value = s2.typ || "Nyhet"; sync(); });
      fTyp.addEventListener("change", () => (fTyp.dataset.touched = "1"));
      const box = h("div", { class: "line" },
        h("div", { class: "row two" }, field("Product", fProdN), field("Colour", fFarg), field("New / restock", fTyp)),
        h("div", { class: "row three" }, field("Tyg", fTyg), field("Size scale", fSkala), field("Unit price", fPris)),
        grid,
        h("div", { class: "foot" }, hint, ro ? null : h("button", { class: "btn small danger", type: "button", text: "Remove line", onclick: () => { lines.splice(idx, 1); renderLines(); } })));
      if (ro) lock(box);
      renderGrid(); sync();
      return box;
    }
    function renderLines() { linesEl.replaceChildren(...lines.map((r, i) => lineEditor(r, i))); renderTotals(); }
    function renderTotals() {
      const units = lines.reduce((a, r) => a + (num(r.antal) || 0), 0);
      const cost = lines.reduce((a, r) => a + (lineCost(r) || 0), 0);
      const perColor = {}; for (const r of lines) { const k = r.farg || "TBA"; perColor[k] = (perColor[k] || 0) + (num(r.antal) || 0); }
      totalsEl.replaceChildren(h("span", null, "Lines: ", h("b", { text: String(lines.length) })), h("span", null, "Quantity: ", h("b", { text: String(units) })), h("span", null, "Per colour: ", h("b", { text: Object.entries(perColor).map(([k, v]) => k + " " + v).join(", ") || "–" })), h("span", null, "Average/unit: ", h("b", { text: units ? fmtSEK(cost / units) : "–" })), h("span", null, "Total: ", h("b", { text: fmtSEK(cost) })));
    }
    renderLines();
    const linesSec = h("section", null, h("h3", { class: "sec-title", text: "Products on the PO" }), linesEl, ro ? null : h("div", { style: "margin-top:10px" }, h("button", { class: "btn small", type: "button", text: "+ Add line", onclick: () => { lines.push({ produkt: "", farg: "", typ: "Nyhet", tyg: "", storlekar: [], antal: null, tygkostnad: null, styckpris: null }); renderLines(); setTimeout(() => { const el = $("l_prod_" + (lines.length - 1)); if (el) el.focus(); }, 20); } })), totalsEl);

    // ---- EAN for the SKUs on this PO ----
    const attSec = h("section");
    function renderAtt() {
      attSec.replaceChildren(h("h3", { class: "sec-title", text: "Attachments (PDF)" }));
      if (isNew) { attSec.append(h("p", { class: "hint", text: "Save the PO first, then you can add PDFs – order confirmation, pro forma, invoice." })); return; }
      const cur = current() || po;
      const list = Array.isArray(cur.bilagor) ? cur.bilagor : [];
      if (list.length) attSec.append(h("ul", { class: "mini" }, list.map((b) => h("li", null, h("div", { class: "mini-row", style: "cursor:default" }, h("span", { class: "tag", text: "PDF" }), h("span", { class: "mini-main" }, h("a", { href: imgUrl(b.id), target: "_blank", rel: "noopener", text: b.namn || "bilaga.pdf" }), h("span", { class: "sub", text: b.t ? fmtDate(String(b.t).slice(0, 10)) : "" })), h("span", { class: "mini-side" }, ro || !assets ? null : h("button", { class: "btn small danger", type: "button", text: "Remove", onclick: async () => { if (!confirm("Remove the attachment for everyone?")) return; const left = list.filter((x) => x.id !== b.id); if (await write("po", cur._id, { bilagor: left, andrad: new Date().toISOString() })) { try { await assets.delete(b.id); } catch (e) {} } } })))))));
      else attSec.append(h("p", { class: "hint", text: "No attachments yet." }));
      if (!ro && assets) {
        const input = h("input", { type: "file", accept: "application/pdf,image/*", multiple: true, hidden: true, onchange: async () => {
          const files = [...input.files]; input.value = ""; if (!files.length) return;
          const added = [];
          for (const f of files) { try { const blob = f.type === "application/pdf" ? f : await shrinkImage(f, 2000); const r = await assets.upload(blob, blob.type ? undefined : { type: "application/pdf" }); added.push({ id: r.id, namn: f.name, t: new Date().toISOString(), av: myId }); } catch (e) { toast(e && e.code === "too_large" ? f.name + " is too large (max 20 MB)." : "Could not upload " + f.name + "."); } }
          const c2 = current() || cur;
          if (added.length) await write("po", c2._id, { bilagor: (Array.isArray(c2.bilagor) ? c2.bilagor : []).concat(added), andrad: new Date().toISOString(), logg: (c2.logg || []).concat(logEntry(added.length + (added.length === 1 ? " attachment added: " : " attachments added: ") + added.map((a) => a.namn).join(", "))) });
          renderAtt();
        } });
        attSec.append(h("div", { class: "dropzone" }, h("button", { class: "btn small", type: "button", text: "+ Add PDF", onclick: () => input.click() }), h("span", { class: "hint", text: "Order confirmation, pro forma, invoice, specs" }), input));
      } else if (!ro && !assets) attSec.append(h("p", { class: "hint", text: "Attachments can only be uploaded with Editor access." }));
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
      if (isNew) { eanSec.append(h("p", { class: "hint", text: "When the PO is saved every SKU (product × colour × size) gets an EAN from your GS1 range. Placeholders get EAN only when the status changes." })); return; }
      const cur = current(); const plan = skuPlan(cur);
      const missing = plan.reduce((a, x) => a + x.miss.length, 0);
      const noSizes = plan.filter((x) => !x.sizes.length);
      const rows = [];
      for (const x of plan) for (const sz of x.sizes) { const e = (x.st.ean || []).find((y) => vkey(y) === vkey({ farg: x.r.farg, storlek: sz })); rows.push(h("tr", null, h("td", { text: x.st.namn }), h("td", { text: x.r.farg }), h("td", { text: sz }), h("td", { class: "mono" }, e ? e.ean : h("span", { class: "muted", text: "–" })))); }
      if (rows.length) eanSec.append(h("div", { class: "vscroll", style: "margin-top:0" }, h("table", { class: "vtable" }, h("thead", null, h("tr", null, ["Product", "Colour", "Size", "EAN"].map((t) => h("th", { text: t })))), h("tbody", null, rows))));
      else eanSec.append(h("p", { class: "hint", text: "No SKUs yet. Lines need a linked style, colour and sizes." }));
      if (noSizes.length) eanSec.append(h("p", { class: "warnline", text: noSizes.map((x) => x.st.namn + (x.r.farg ? " " + x.r.farg : "")).join(", ") + " has no sizes – fill in on the line or on the style." }));
      const acts = h("div", { class: "ean-actions" });
      if (!ro && missing) acts.append(h("button", { class: "btn small primary", type: "button", text: "Assign EAN to " + missing + (missing === 1 ? " SKU" : " SKUs"), onclick: () => assignEans(cur, true) }));
      if (rows.length && downloads) acts.append(h("button", { class: "btn small", type: "button", text: "Export CSV", onclick: () => exportPoEan(cur) }));
      if (acts.childElementCount) eanSec.append(acts);
    }
    async function assignEans(cur, manual) {
      const plan = skuPlan(cur).filter((x) => x.miss.length);
      if (!plan.length) { if (manual) toast("All SKUs already have an EAN."); return 0; }
      const total = plan.reduce((a, x) => a + x.miss.length, 0);
      let codes;
      try { codes = await allocateEan(total); }
      catch (e) { const c = e && e.code; toast(c === "busy" ? "Someone else is assigning EAN right now. Try again in a few seconds." : c === "empty" ? "The EAN range is not large enough." : c === "nopool" ? "The EAN range is not set up." : "Could not reserve EAN."); return 0; }
      const t = new Date().toISOString();
      let i = 0, saved = 0;
      const byStyle = new Map();
      for (const x of plan) { const arr = byStyle.get(x.st._id) || []; for (const sz of x.miss) arr.push({ farg: x.r.farg, storlek: sz, ean: codes[i++], t, av: myId, po: cur.nr || cur._id }); byStyle.set(x.st._id, arr); }
      for (const [sid, added] of byStyle) {
        const st = byId(D.styles, sid); if (!st) continue;
        const farger = uniq((st.farger || []).concat(added.map((a) => a.farg)));
        const storlekar = sizesOf(st).length ? sizesOf(st) : uniq(added.map((a) => a.storlek));
        const range = added[0].ean + (added.length > 1 ? "–" + added[added.length - 1].ean : "");
        const ok = await write("styles", sid, { farger, storlekar, ean: (st.ean || []).concat(added), logg: (st.logg || []).concat(logEntry(added.length + " EAN assigned via PO " + (cur.nr || cur._id) + " (" + range + ")")), andrad: t });
        if (ok) saved += added.length;
        try { await db.collection("eanLogg").doc("L" + Date.now() + Math.random().toString(36).slice(2, 6)).set({ t, av: myId, styleId: sid, styleNamn: st.namn, antal: added.length, forsta: added[0].ean, sista: added[added.length - 1].ean, po: cur.nr || cur._id, sparad: ok }); } catch (e) {}
      }
      toast(saved + " EAN assigned" + (saved < total ? " (" + (total - saved) + " could not be saved – see the EAN log)" : ""));
      return saved;
    }

    const logUl = h("ul", { class: "log" });
    async function save() {
      const o = { nr: fNr.value.trim(), leverantor: fLev.value.trim(), sasong: fSas.value.trim(), drop: poDropChoice().drop, dropEgen: poDropChoice().egen, status: fStatus.value, prioritet: po.prioritet || "Normal", produktionstid: prodDagar() != null && prodDagar() >= 0 ? prodDagar() : num(po.produktionstid), fotosample: fFoto.value, fotosampleLeverans: fFotoD.value || null, tygstatus: fTygS.value, orderBekraftad: fBek.value === "1", planeradEx: fPlan.value || null, bekraftadEx: fBekEx.value || null, etaLager: etaNu(), valuta: fVal.value || "SEK", kommentar: fKom.value.trim(),
        orderDatum: fOrdD.value || null, leveransOnskad: fLevO.value || null, labelInstructions: fLabel.value.trim(),
        forskottBelopp: num(fFskB.value), forskottDatum: fFskD.value || null, forskottBetald: fFskP.value === "1", slutBelopp: num(fSlutB.value), slutDatum: fSlutD.value || null, slutBetald: fSlutP.value === "1" };
      if (!o.leverantor) { toast("Enter supplier."); fLev.focus(); return; }
      if (!o.sasong) { toast("Enter season."); fSas.focus(); return; }
      if (!o.nr) o.nr = nextPoNr(o.leverantor, o.sasong);
      const btn = $("btnSave"); if (btn) btn.disabled = true;
      try {
        const now = new Date().toISOString();
        // resolve styles for lines (create new ones when needed)
        const flyttaStyles = !isNew && poDropChoice().flytta;
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
          if (byId(D.po, pid)) { toast("The PO number already exists."); return; }
          const body = Object.assign({ id: pid, logg: [logEntry("PO created")], andrad: now }, o);
          if (!(await create("po", pid, body))) return;
          if (!byId(D.po, pid)) D.po.push(Object.assign({}, body, { _id: pid }));
          toast(o.nr + " saved");
        } else {
          const cur = current();
          const changes = describeChanges(Object.assign({}, cur, { drop: cur._dropRaw != null ? cur._dropRaw : cur.drop }), o, PO_LABELS);
          if (JSON.stringify(cur.rader || []) !== JSON.stringify(rader)) changes.push("Lines changed (" + rader.length + ")");
          if (!!cur.dropEgen !== !!o.dropEgen) changes.push(o.dropEgen ? "Drop: own choice on the PO (" + (o.drop || "no drop") + ")" : "Drop: follows the styles again");
          if (flyttaStyles) changes.push("Styles on the PO moved to " + o.drop);
          if (!(await write("po", cur._id, Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) })))) return;
          Object.assign(cur, o);
          toast("Saved");
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
          const flyttad = flyttaStyles && norm(st.sasong) === norm(o.sasong) && norm(st.drop) !== norm(o.drop);
          if (flyttad) patch.drop = o.drop;
          const ss = styleStatusNorm(st.status);
          if (active && (ss === "Sampling" || ss === "Godkänd")) patch.status = o.status === "Inlevererad" ? "Levererad" : ["I produktion", "Skickad"].includes(o.status) ? "I produktion" : "PO lagd";
          else if (active && ss === "PO lagd" && ["I produktion", "Skickad"].includes(o.status)) patch.status = "I produktion";
          else if (o.status === "Inlevererad" && ["PO lagd", "I produktion"].includes(ss)) patch.status = "Levererad";
          if (Object.keys(patch).length) { patch.andrad = now; patch.logg = (st.logg || []).concat(logEntry("Updated from PO " + o.nr + (patch.status ? ": status " + patch.status : "") + (flyttad ? ": drop " + o.drop : ""))); await write("styles", st._id, patch); Object.assign(st, patch); }
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
          if (made.length) { const c2 = byId(D.po, pid) || curPo; await write("po", pid, { fotosample: "Beställd", andrad: now, logg: (c2.logg || []).concat(logEntry("Photo samples ordered automatically: " + made.join(", "))) }); toast(made.length + (made.length === 1 ? " photo sample ordered" : " photo samples ordered") + " – shown under Samples and Photo"); }
        }
        if (isNew) openPo(pid); else closeSheet();
      } finally { if (btn) btn.disabled = false; }
    }
    const kvs = [];
    if (!isNew) { const tot = poTotal(po); kvs.push(h("div", { class: "kvs" }, h("div", { class: "kv" }, h("span", { class: "k", text: "Total" }), h("span", { class: "v big", text: fmtSEK(tot) })), h("div", { class: "kv" }, h("span", { class: "k", text: "Quantity" }), h("span", { class: "v big", text: String(poUnits(po)) })), h("div", { class: "kv" }, h("span", { class: "k", text: "Days left" }), h("span", { class: "v big", text: poEta(po) ? fmtDays(diffDays(poEta(po))) : "–" })))); }
    const body = [...kvs, form, linesSec, attSec];
    if (!isNew && downloads) body.push(h("section", null, h("h3", { class: "sec-title", text: "PO file" }), h("p", { class: "hint", text: "Excel in Rubato's PO template: a \"PO\" sheet with the order details, one column per size and a TOTAL row. Fill in quantity per size on the lines for a complete PO." }), h("div", { class: "quick" }, h("button", { class: "btn small primary", type: "button", text: "Create PO file (Excel)", onclick: () => exportPoXlsx(current()) }))));
    const noteIn = attachMentions(inp("f_pnote", "", { placeholder: NOTE_PH, autocomplete: "off" }));
    const addNote = async () => { if (!isNew) await addComment("po", current(), noteIn); };
    noteIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } });
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "History" }), logUl, ro ? null : h("div", { class: "add-note" }, noteIn, h("button", { class: "btn small", type: "button", text: "Add", onclick: addNote }))));
    openSheet({
      flagRef: isNew ? null : { typ: "po", ref: po._id, titel: (po.nr || po._id) + (po.leverantor ? " · " + po.leverantor : ""), tab: "produktion" },
      tag: isNew ? "New" : poStatusNorm(po.status),
      title: isNew ? "New PO" : (po.nr || po._id),
      sub: isNew ? "" : [po.leverantor, po.sasong, po.drop].filter(Boolean).join(" · "),
      body,
      foot: footButtons({ del: "Delete PO", onDelete: isNew ? null : async () => { if (await remove("po", po._id)) { toast("Removed"); closeSheet(); } }, canDelete: true, onSave: save, saveLabel: isNew ? "Save PO" : "Save" }),
      ctx: { refresh: () => { if (!isNew && !byId(D.po, po._id)) { closeSheet(); return; } renderEan(); renderAtt(); if (!isNew) renderLogInto(logUl, current().logg); } },
      focus: isNew ? "f_plev" : null
    });
    renderEan(); renderAtt();
    if (!isNew) renderLogInto(logUl, po.logg);
  }
  function exportPoEan(po) {
    const rows = [];
    for (const r of po.rader || []) { const st = byId(D.styles, r.styleId); if (!st) continue; const sizes = (r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st)) || []; for (const sz of sizes) { const e = (st.ean || []).find((y) => vkey(y) === vkey({ farg: r.farg, storlek: sz })); rows.push([po.nr, st.namn, r.farg, sz, e ? e.ean : "", r.perStorlek ? (r.perStorlek[sz] ?? "") : ""]); } }
    saveFile("EAN_" + safeName(po.nr) + ".csv", csv(["PO", "Product", "Colour", "Size", "EAN", "Quantity"], rows));
  }
  async function exportPoXlsx(po) {
    try { if (!window.ExcelJS) await loadScript(LIB_XLSX); } catch (e) { toast("Could not load the Excel tool. Check the network and try again."); return; }
    const wb = new window.ExcelJS.Workbook();
    const ws = wb.addWorksheet("PO");
    const F = { name: "Arial", size: 10 }, FB = { name: "Arial", size: 10, bold: true };
    const d = (po._drops && po._drops.length ? po._drops : [po.drop]).map((n) => dropOf({ sasong: po.sasong, drop: n })).filter((x) => x && isISO(x.klartSenast)).sort((a, b) => a.klartSenast.localeCompare(b.klartSenast))[0] || null;
    const reqDate = po.leveransOnskad || (d && d.klartSenast) || "";
    const head = [["Order Date", po.orderDatum || todayISO()], ["Customer Name", PO_DEFAULTS.customer], ["Contact Email", PO_DEFAULTS.email], ["Contact Tel", PO_DEFAULTS.tel], ["Delivery Address", PO_DEFAULTS.delivery], ["Invoice Address", PO_DEFAULTS.invoice], ["Label Instructions", po.labelInstructions == null ? PO_DEFAULTS.label : po.labelInstructions], ["Requested Delivery Date", reqDate], ["Payment Terms", ""]];
    head.forEach(([k, v], i) => { const r = ws.getRow(i + 1); r.getCell(1).value = k; r.getCell(1).font = FB; r.getCell(2).value = v; r.getCell(2).font = F; r.height = 15; });
    ws.getCell("E1").value = "PO: " + (po.nr || po._id) + (poStatusNorm(po.status) === "Placeholder" ? " (DRAFT)" : "");
    ws.getCell("E1").font = { name: "Arial", size: 11, bold: true };
    const sizes = [];
    const lines = po.rader || [];
    for (const r of lines) { const st = byId(D.styles, r.styleId); for (const sz of (r.storlekar && r.storlekar.length ? r.storlekar : sizesOf(st))) if (!sizes.includes(sz)) sizes.push(sz); }
    sizes.splice(0, sizes.length, ...sortSizes(sizes));
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
    if (ok) toast("The PO file is ready");
  }
  function exportPo() {
    const rows = [];
    for (const p of D.po) for (const r of p.rader || []) { const st = byId(D.styles, r.styleId); rows.push([p.nr, p.leverantor, p.sasong, p.drop, poStatusNorm(p.status), r.produkt, r.styleId, st ? styleKategori(st) : "", r.farg, r.typ, r.tyg, r.antal, r.tygkostnad, r.styckpris, lineCost(r), p.valuta, p.tygstatus, p.orderBekraftad ? "Ja" : "Nej", p.planeradEx, p.bekraftadEx, poEta(p), p.fotosample, p.forskottBetalt, p.slutbetalning, p.kommentar]); }
    saveFile("Rubato_Produktion_" + todayISO() + ".csv", csv(["PO no.", "Supplier", "Season", "Drop", "Status", "Product", "Style ID", "Category", "Colour", "New/Restock", "Tyg", "Quantity", "Fabric cost/unit", "Unit price", "Cost", "Currency", "Fabric status", "Order confirmed", "Planned ex-factory", "Confirmed ex-factory", "ETA warehouse", "Fotosample", "Deposit paid", "Final payment", "Comment"], rows));
  }

  // ---------- KOLLEKTION (Carl) ----------
  const KollView = {
    mount(root) {
      const st = UI.koll;
      const upd = () => { this.update(); persist(); };
      this.fSeason = filterSelect("f_k_season", "All seasons", st, "season", upd);
      this.seg = makeSeg([["drop", "By drop"], ["kategori", "By category"], ["helhet", "Overall"]], st, "mode", upd);
      this.fKat = filterSelect("f_k_kat", "All categories", st, "kat", upd);
      this.segTyp = makeSeg([["alla", "All"], ["Nyhet", "New"], ["Restock", "Re-stock"], ["NOOS", "NOOS"]], st, "typ", upd);
      this.count = h("span", { class: "count" });
      this.stats = h("div", { class: "koll-stats" });
      this.body = h("div", { style: "display:grid;gap:26px" });
      root.append(h("p", { class: "lede", text: "The coming collection in pictures: every product with its latest sample and status. Switch between drop, category and overall, and filter on New, Re-stock or NOOS. Click a product for details and all images." }),
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
      const order = { [ST_IDE]: -3, [ST_DESIGN]: -2, [ST_KANBEST]: -1, Sampling: 0, "Godkänd": 1, "PO lagd": 2, "I produktion": 3, Levererad: 4, Pausad: 5 };
      items.sort((a, b) => (order[styleStatusNorm(a.status)] ?? 9) - (order[styleStatusNorm(b.status)] ?? 9) || (a.namn || "").localeCompare(b.namn || "", "sv"));
      const units = (s) => poLinesOf(s._id).reduce((a, x) => a + (num(x.r.antal) || 0), 0);
      const cost = (s) => poLinesOf(s._id).reduce((a, x) => a + (lineCost(x.r) || 0), 0);
      const kv = (k, v, sub) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v big", text: v }), sub ? h("span", { class: "sub", text: sub }) : null);
      const nNew = items.filter((s) => (s.typ || "Nyhet") === "Nyhet").length, nRe = items.filter((s) => s.typ === "Restock").length, nNoos = items.filter((s) => s.typ === "NOOS").length;
      const withImg = items.filter((s) => styleImage(s)).length;
      const inProd = items.filter((s) => inProduction(s)).length;
      const nIdeas = items.filter(isIdea).length;
      this.stats.replaceChildren(kv("Products " + season, String(items.length), nNew + " new · " + nRe + " re-stock · " + nNoos + " NOOS"), kv("I produktion", String(inProd), items.filter((s) => styleStatusNorm(s.status) === "Sampling").length + " in sampling" + (nIdeas ? " · " + nIdeas + " ideas" : "")), kv("Units ordered", String(items.reduce((a, s) => a + units(s), 0))), kv("With image", withImg + " of " + items.length));
      this.body.replaceChildren();
      const groups = [];
      if (st.mode === "drop") {
        const placed = new Set();
        for (const d of dropsOfSeason(season)) { const m = items.filter((s) => dropKey(s.sasong, s.drop) === dropKey(d.sasong, d.namn)); m.forEach((x) => placed.add(x._id)); groups.push({ title: d.namn + " – " + season, drop: d, sub: [isISO(d.lansering) ? "Launch " + fmtDate(d.lansering) : "", isISO(d.klartSenast) ? "In stock by " + fmtDate(d.klartSenast) : ""].filter(Boolean).join(" · "), items: m }); }
        const rest = items.filter((s) => !placed.has(s._id)); if (rest.length) groups.push({ title: "No drop – " + season, sub: "", items: rest });
      } else if (st.mode === "kategori") {
        for (const k of KATEGORIER.concat(["Okategoriserat"])) { const m = items.filter((s) => (styleKategori(s) || "Okategoriserat") === k); if (m.length) groups.push({ title: k, sub: "", items: m }); }
      } else groups.push({ title: season + " – the whole collection", sub: "", items });
      for (const g of groups) {
        const sec = h("section", { class: "koll-sec" });
        const gu = g.items.reduce((a, s) => a + units(s), 0);
        const head = h("div", { class: "koll-h" }, h("h3", { text: g.title }), h("span", { class: "sub", text: g.items.length + (g.items.length === 1 ? " product" : " products") + (gu ? " · " + gu + " units" : "") + (g.sub ? " · " + g.sub : "") }));
        if (g.drop && canWrite && db) head.append(h("button", { class: "linkish", type: "button", text: "Edit drop", onclick: () => openDrop(g.drop._id) }));
        sec.append(head);
        const dImgs = g.drop ? docImages(g.drop) : [];
        if (dImgs.length) sec.append(h("div", { class: "gallery", style: "grid-template-columns:repeat(auto-fill,minmax(90px,1fr))" }, dImgs.map((id) => h("figure", { class: "thumb" }, h("img", { src: imgUrl(id), alt: "", loading: "lazy", onclick: () => openLightbox(dImgs, id) })))));
        if (!g.items.length) sec.append(h("p", { class: "hint", text: "No products here yet." }));
        else sec.append(h("div", { class: "pgrid" }, g.items.map((s) => this.card(s))));
        this.body.append(sec);
      }
      this.count.textContent = items.length + " products in " + season;
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
        h("div", { class: "pimg" }, img ? h("img", { src: imgUrl(img), alt: s.namn, loading: "lazy", onerror: (e) => { const el = e.target; if (/^https?:/.test(el.src)) el.replaceWith(h("span", { class: "noimg", text: "The image from Shopify could not be shown – press \"Fetch Shopify images\"" })); } }) : emptyTile(s, xs), styleStatusPill(s), h("span", { class: "typtag t-" + slug(s.typ || "Nyhet"), text: typLabel(s) }), (() => { const fb = s.fargBilder && typeof s.fargBilder === "object" ? uniq(Object.values(s.fargBilder)) : []; const rest = (fb.length ? fb : allImgs.filter((x) => !(x === shopUrl(s) && docImages(s).length))).filter((x) => x !== img); if (!rest.length) return null; const visa = rest.slice(0, 3); return h("span", { class: "pthumbs" }, rest.length > visa.length ? h("span", { class: "more", text: "+" + (rest.length - visa.length) }) : null, visa.slice().reverse().map((x) => h("img", { src: imgUrl(x), alt: "", loading: "lazy", onerror: (e) => e.target.remove() }))); })(), g ? h("span", { class: "grundtag", text: "Variant of " + g.namn }) : imageSource(s) ? h("span", { class: "grundtag", text: imageSource(s) === "Shopify" ? (s.shopifyBild && s.shopifyBild.likhet === "liknande" ? "Similar · Shopify" : "Shopify") : imageSource(s) }) : null),
        h("div", { class: "pbody" }, h("span", { class: "pname", text: s.namn }), h("span", { class: "psub", text: [s.leverantor, styleKategori(s), styleTyg(s)].filter(Boolean).join(" · ") }),
          (s.farger || []).length ? h("span", { class: "psub", text: s.farger.join(", ") }) : null,
          h("span", { class: "psub", text: units ? units + " units" : last ? (last.version || "") + " · " + (last.status || "") : "" }),
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
        { key: "saknas", label: "Photo sample not ordered", cls: "t-late" },
        { key: "vantas", label: "Ordered – expected" },
        { key: "finns", label: "Physically in" },
        { key: "hang", label: "In, but not on the photo rail", cls: "t-warn" },
        { key: "ecom", label: "E-com images missing", cls: "t-warn" },
        { key: "klara", label: "Publicerade" }
      ], st, () => upd());
      const q = searchBox("q_foto", "Search product, PO …", st, () => this.update());
      this.fSeason = filterSelect("f_f_season", "All seasons", st, "season", () => { st.touched = true; upd(); });
      this.segTyp = makeSeg([["Nyhet", "New styles"], ["alla", "All types"]], st, "typ", upd);
      this.count = h("span", { class: "count" });
      this.cards = h("div", { class: "cards" });
      root.append(h("p", { class: "lede", text: "All new styles with a placed PO: is the photo sample ordered or physically in, where does it hang, when is the campaign shoot, when is e-com shot and are the images done? The photo sample is ordered automatically when a PO is placed – or with the button here. At the bottom: the photo rail and the collection rail." }),
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
      for (const s of list) { const k = (s.sasong || "Utan säsong") + " · " + (s.drop || "No drop"); if (!groups.has(k)) groups.set(k, { season: s.sasong || "", drop: s.drop || "", items: [] }); groups.get(k).items.push(s); }
      const dRank = (g) => { const ds = dropsOfSeason(g.season).map((d) => d.namn); const i = ds.indexOf(g.drop); return i < 0 ? 99 : i; };
      const keys = [...groups.keys()].sort((a, b) => { const ga = groups.get(a), gb = groups.get(b); return seasonRank(gb.season) - seasonRank(ga.season) || dRank(ga) - dRank(gb) || a.localeCompare(b, "sv"); });
      const ro = !canWrite || !db;
      const cards = [];
      for (const k of keys) { const items = groups.get(k).items;
        const card = h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: k }), h("span", { class: "sub", text: items.length + " products · " + items.filter((s) => F.get(s._id).key === "finns").length + " with photo sample in · " + items.filter((s) => ecom(s) === "Publicerade").length + " published" })));
        const { t, tb } = table([["Product"], ["PO / delivery"], ["Fotosample"], ["Campaign shoot"], ["E-com shoot"], ["E-com images"], ["Note"]]);
        for (const s of items) {
          const f = F.get(s._id);
          const img = styleImage(s);
          const mk = (el) => { if (ro) el.disabled = true; return el; };
          const save = (patch, logText) => write("styles", s._id, Object.assign({ andrad: new Date().toISOString() }, patch, logText ? { logg: (s.logg || []).concat(logEntry(logText)) } : {}));
          const sel = mk(selectEl("ecom_" + s._id, ECOM_STATUS.map((x) => [x, x || "– not planned"]), ecom(s)));
          const dt = mk(inp("ecomd_" + s._id, s.ecomPlatDatum, { type: "date", "aria-label": "Date of e-com shoot" }));
          const ksel = mk(selectEl("kamp_" + s._id, KAMP_STATUS.map((x) => [x, x || "– no campaign"]), s.kampanjStatus || ""));
          const kdt = mk(inp("kampd_" + s._id, s.kampanjDatum, { type: "date", "aria-label": "Date of campaign shoot" }));
          const note = mk(inp("ecomn_" + s._id, s.fotoNotering, { placeholder: "e.g. shot 3 Nov with Lot 1", "aria-label": "Photo note" }));
          sel.addEventListener("change", () => save({ ecomBilder: sel.value }, "E-com images: " + (sel.value || "not planned")));
          dt.addEventListener("change", () => save({ ecomPlatDatum: dt.value || null }));
          ksel.addEventListener("change", () => save({ kampanjStatus: ksel.value }, "Campaign shoot: " + (ksel.value || "ingen")));
          kdt.addEventListener("change", () => save({ kampanjDatum: kdt.value || null }));
          note.addEventListener("change", () => save({ fotoNotering: note.value.trim() }));
          const pls = poLinesOf(s._id).filter((x) => PO_PLACED.includes(poStatusNorm(x.po.status)));
          const pos = uniq(pls.map((x) => x.po._id)).map((id) => byId(D.po, id)).filter(Boolean);
          const es = pos.map(poEta).filter(Boolean).sort();
          const poCell = td("PO / delivery", null);
          for (const p of pos) poCell.append(h("div", { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap" }, h("button", { class: "linkish", type: "button", text: p.nr || p._id, onclick: (e) => { e.stopPropagation(); openPo(p._id); } }), poStatusPill(p)));
          poCell.append(es[0] ? h("div", null, h("span", { class: "mono", text: "Delivery " + fmtDate(es[0]) }), h("span", { class: "days " + (diffDays(es[0]) < 0 ? "late" : diffDays(es[0]) <= 14 ? "soon" : ""), text: " · " + fmtDays(diffDays(es[0])) })) : h("div", { class: "muted", text: "ETA missing" }));
          const fotoCell = td("Fotosample", null, h("div", null, h("span", { class: "pill fs-" + (f.key === "godkand" ? "saknas" : f.key), text: f.label })));
          if (f.all && f.all.length) fotoCell.append(h("div", { class: "sub" }, f.all.map((x, i) => h("button", { class: "linkish", type: "button", text: (i ? " · " : "") + x._id + (sampleFarg(x) ? " " + sampleFarg(x) : "") + (x.status === "Mottagen" && platsText(x) ? " (" + platsText(x) + ")" : ""), onclick: (e) => { e.stopPropagation(); openSample(x._id); } }))));
          else if (f.sample) fotoCell.append(h("div", { class: "sub" }, h("button", { class: "linkish", type: "button", text: f.sample._id + (platsText(f.sample) ? " · " + platsText(f.sample) : ""), onclick: (e) => { e.stopPropagation(); openSample(f.sample._id); } })));
          if (!ro) {
            const acts = h("div", { class: "quick", style: "margin-top:6px" });
            if (f.key === "saknas" || f.key === "godkand") acts.append(h("button", { class: "btn small primary", type: "button", text: "Order photo sample", onclick: async (e) => { e.stopPropagation(); const b = e.currentTarget; b.disabled = true; const made = await orderFotosamples(s, pos[0] || null, "The Photo tab"); toast(made.length ? made.length + (made.length === 1 ? " photo sample ordered: " : " photo samples ordered: ") + made.join(", ") : "Could not order"); } }));
            if (f.key === "vantas" && f.all && f.all.length) acts.append(h("button", { class: "btn small", type: "button", text: "Received today", onclick: async (e) => { e.stopPropagation(); for (const x of f.all) await write("samples", x._id, { status: "Mottagen", mottagen: todayISO(), andrad: new Date().toISOString(), logg: (x.logg || []).concat(logEntry("Marked received from the Photo tab")) }); toast("Photo sample in – hang it on the photo rail"); } }));
            if (f.key === "finns" && f.all && f.all.length && !f.onRack) acts.append(h("button", { class: "btn small", type: "button", text: "To the photo rail", onclick: async (e) => { e.stopPropagation(); for (const x of f.all) if (x.platsTyp !== "Fotohäng") await write("samples", x._id, { platsTyp: "Fotohäng", andrad: new Date().toISOString(), logg: (x.logg || []).concat(logEntry("Hung on the photo rail")) }); toast("Now on the photo rail – enter the hook no. on the sample if you number them"); } }));
            if (acts.childElementCount) fotoCell.append(acts);
          }
          tb.append(h("tr", { tabIndex: 0, dataset: { style: s._id } },
            td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, img ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(img), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(styleAllImages(s), img); } }) : null, h("div", null, h("div", { class: "prod", text: s.namn }), h("div", { class: "sub", text: [s.leverantor, typLabel(s), styleKategori(s), (s.farger || []).join(", ")].filter(Boolean).join(" · ") }), h("div", null, styleStatusPill(s))))),
            poCell,
            fotoCell,
            td("Campaign shoot", "foto-inline", h("div", { style: "display:grid;gap:4px" }, ksel, kdt)),
            td("E-com shoot", "foto-inline", dt),
            td("E-com images", "foto-inline", sel),
            td("Note", "foto-inline", note)));
        }
        tb.addEventListener("click", (e) => { if (e.target.closest("input, select, button, img")) return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
        card.append(h("div", { class: "ledger-wrap" }, t));
        cards.push(card);
      }
      cards.push(fotohangCard(season));
      cards.push(hangerCard(season));
      this.cards.replaceChildren(...cards);
      if (!list.length) this.cards.prepend(h("div", { class: "empty" }, h("strong", { text: "No " + (st.typ === "alla" ? "products" : "new styles") + " with a placed PO" + (season ? " in " + season : "") }), h("span", { text: "Products appear here once the PO is placed (Confirmed or later). Choose \"All seasons\" or \"All types\" to see more." })));
      this.count.textContent = list.length + (st.typ === "alla" ? " products" : " new styles") + " with a placed PO" + (season ? " in " + season : " (all seasons)");
    }
  };
  function fotohangCard(season) {
    const items = D.samples.filter((s) => s.platsTyp === "Fotohäng" && !isArchived(s)).sort((a, b) => (num(a.hangare) ?? 999) - (num(b.hangare) ?? 999) || styleName(a).localeCompare(styleName(b), "sv"));
    const inSeason = season ? items.filter((s) => norm(seasonOf(s)) === norm(season)) : items;
    const card = h("section", { class: "card hanger-card" });
    card.append(h("div", { class: "card-head" }, h("h3", { text: "The photo rail" + (season ? " – " + season : "") }), h("span", { class: "sub", text: inSeason.length ? inSeason.length + " samples hang on the photo rail" + (items.length > inSeason.length ? " (" + (items.length - inSeason.length) + " from other seasons)" : "") : "Empty – set the location of photo samples to \"Photo rail\" and they are listed here" })));
    if (!inSeason.length) return card;
    const { t, tb } = table([["Hook"], ["Product"], ["Colour"], ["Sample"], ["E-com images"], ["Image"]]);
    for (const s of inSeason) {
      const st = styleOf(s);
      const imgs = sampleImages(s);
      tb.append(h("tr", { tabIndex: 0, dataset: { id: s._id } },
        td("Hook", null, h("span", { class: "hanger", text: "Fotohäng" + (s.hangare ? " " + s.hangare : "") })),
        td("", "c-main", h("div", { class: "prod", text: styleName(s) }), h("div", { class: "sub", text: [st ? st.sasong : seasonOf(s), st ? st.drop : "", s.version].filter(Boolean).join(" · ") })),
        td("Colour", null, sampleColours(s).length ? h("div", { class: "swatches" }, colourChips(s)) : "–"),
        td("Sample", null, tag(s._id), h("span", { class: "sub", text: " " + (s.status || "") })),
        td("E-com images", null, st ? h("span", { class: "pill es-" + slug(st.ecomBilder || "x"), text: st.ecomBilder || "not planned" }) : ""),
        td("Image", null, imgs.length ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(imgs[0]), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(imgs, imgs[0]); } }) : h("span", { class: "muted", text: "–" }))));
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
      this.seg = makeSeg([["ute", "Out"], ["Tillbaka hos Rubato", "Back"], ["alla", "All"]], st, "status", upd);
      const q = searchBox("q_ref", "Search garment, supplier, tracking …", st, () => this.update());
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["Garment"], ["Sent to"], ["Skickat"], ["Carrier / tracking"], ["Status"], ["Back by"], ["Comment"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { if (e.target.closest("a, button, img")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openRef(tr.dataset.id); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const tr = e.target.closest("tr[data-id]"); if (tr) openRef(tr.dataset.id); });
      this.empty = h("div", { class: "empty", hidden: true });
      root.append(h("p", { class: "lede", text: "Reference garments sent to suppliers (own garments, vintage, competitor garments). Tracking is kept here so nothing goes missing, with a reminder when the garment should be back." }),
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
          td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, imgs.length ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(imgs[0]), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(imgs, imgs[0]); } }) : null, h("div", null, h("div", { class: "prod", text: r.plagg || "–" }), h("div", { class: "sub", text: [r._id, r.styleNamn ? "for " + r.styleNamn : "", r.agare ? "owner: " + r.agare : ""].filter(Boolean).join(" · ") })))),
          td("Sent to", null, r.skickadTill || ""),
          td("Skickat", "mono", fmtDate(r.skickad)),
          td("Tracking", null, r.fraktbolag ? h("div", { text: r.fraktbolag }) : null, r.tracking ? h("div", { class: "mono" }, r.trackingUrl ? h("a", { href: r.trackingUrl, target: "_blank", rel: "noopener", text: r.tracking }) : r.tracking) : h("span", { class: "flag", text: "No tracking" })),
          td("Status", null, h("span", { class: "pill rs-" + slug(r.status || ""), text: r.status || "–" })),
          td("Back by", null, isISO(r.aterSenast) ? h("div", null, h("div", { class: "mono", text: fmtDate(r.aterSenast) }), d != null ? h("div", { class: "days " + (d < 0 ? "late" : d <= 7 ? "soon" : ""), text: fmtDays(d) }) : null) : r.status === "Tillbaka hos Rubato" ? h("span", { class: "muted", text: "back " + fmtDate(r.tillbaka) }) : h("span", { class: "muted", text: "–" })),
          td("Comment", "note", r.kommentar || ""));
      }));
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(h("strong", { text: loaded.has("ref") ? (D.ref.length ? "Nothing matches" : "No reference garments registered") : "Loading …" }), h("span", { text: "Add one when something is sent off, with tracking." }));
      this.count.textContent = list.length + " of " + D.ref.length + " units";
    }
  };
  const REF_LABELS = { plagg: "Garment", styleNamn: "For style", agare: "Owner", skickadTill: "Sent to", skickad: "Skickat", fraktbolag: "Carrier", tracking: "Tracking", trackingUrl: "Tracking link", status: "Status", aterSenast: "Back by", tillbaka: "Back", varde: "Value", kommentar: "Comment" };
  function openRef(id, preset) {
    if (designOnly()) return;
    const isNew = !id;
    const r = isNew ? Object.assign({ _id: null, status: "Skickat", skickad: todayISO(), logg: [] }, preset || {}) : byId(D.ref, id);
    if (!r) { toast("Cannot find the garment."); return; }
    const ro = !canWrite || !db;
    const fPlagg = inp("f_rplagg", r.plagg, { placeholder: "e.g. Vintage Levi's 501, size 32" });
    const fStyle = inp("f_rstyle", r.styleNamn, { list: "dlStyle", autocomplete: "off", placeholder: "Which style is it a reference for?" });
    const fAgare = inp("f_ragare", r.agare, { placeholder: "e.g. Carl, Rubato, borrowed from …" });
    const fTill = inp("f_rtill", r.skickadTill, { list: "dlLev", autocomplete: "off" });
    const fSkickad = inp("f_rskickad", r.skickad, { type: "date" });
    const fBolag = inp("f_rbolag", r.fraktbolag, { placeholder: "DHL, UPS, PostNord …" });
    const fTrack = inp("f_rtrack", r.tracking, { placeholder: "Tracking number" });
    const fUrl = inp("f_rurl", r.trackingUrl, { placeholder: "https://…" });
    const fStatus = selectEl("f_rstatus", REF_STATUS, r.status || "Skickat");
    const fAter = inp("f_rater", r.aterSenast, { type: "date" });
    const fTillb = inp("f_rtillb", r.tillbaka, { type: "date" });
    const fVarde = inp("f_rvarde", r.varde, { type: "number", min: "0", step: "1", placeholder: "SEK" });
    const fKom = area("f_rkom", r.kommentar);
    fStatus.addEventListener("change", () => { if (fStatus.value === "Tillbaka hos Rubato" && !fTillb.value) fTillb.value = todayISO(); });
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      field("Garment", fPlagg, { full: true }), field("Reference for style", fStyle), field("Owner", fAgare),
      field("Sent to", fTill), field("Skickat", fSkickad),
      field("Carrier", fBolag), field("Tracking", fTrack), field("Tracking link", fUrl, { full: true }),
      field("Status", fStatus), field("Should be back by", fAter, { hint: "Gives a reminder in the list" }),
      field("Tillbaka hos Rubato", fTillb), field("Value (SEK)", fVarde, { hint: "In case it goes missing" }),
      field("Comment", fKom, { full: true }));
    if (ro) lock(form);
    const logUl = h("ul", { class: "log" });
    const pendingImgs = isNew ? [] : null;
    const imgSec = bilderSection({ title: "Images", ro, pending: pendingImgs, current: () => byId(D.ref, r._id) || r, empty: "Take a picture of the garment before it is sent – then everyone knows what is out.", save: (ids, logText) => { const cur = byId(D.ref, r._id) || r; return write("refplagg", cur._id, { bilder: ids, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry(logText)) }); } });
    async function save() {
      const o = { plagg: fPlagg.value.trim(), styleNamn: fStyle.value.trim(), agare: fAgare.value.trim(), skickadTill: fTill.value.trim(), skickad: fSkickad.value || null, fraktbolag: fBolag.value.trim(), tracking: fTrack.value.trim(), trackingUrl: fUrl.value.trim(), status: fStatus.value, aterSenast: fAter.value || null, tillbaka: fTillb.value || null, varde: num(fVarde.value), kommentar: fKom.value.trim() };
      if (!o.plagg) { toast("Describe the garment."); fPlagg.focus(); return; }
      if (!o.skickadTill) { toast("Where was it sent?"); fTill.focus(); return; }
      const now = new Date().toISOString();
      if (isNew) {
        const nid = await freshId("refplagg", D.ref, "R", 3);
        const body = Object.assign({ id: nid, bilder: pendingImgs.slice(), logg: [logEntry("Registered")], andrad: now }, o);
        if (await create("refplagg", nid, body)) { if (!byId(D.ref, nid)) D.ref.push(Object.assign({}, body, { _id: nid })); toast(nid + " saved" + (!o.tracking ? " – add tracking as soon as you have it" : "")); closeSheet(); }
      } else {
        const changes = describeChanges(r, o, REF_LABELS);
        if (!changes.length) { closeSheet(); return; }
        if (await write("refplagg", r._id, Object.assign({}, o, { andrad: now, logg: (r.logg || []).concat(changes.map(logEntry)) }))) { toast("Saved"); closeSheet(); }
      }
    }
    const body = [form, imgSec];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "History" }), logUl));
    openSheet({ tag: isNew ? "New" : r._id, title: isNew ? "New reference garment" : r.plagg, sub: isNew ? "" : [r.skickadTill, r.status].filter(Boolean).join(" · "), body, foot: footButtons({ del: "Delete reference garment", onDelete: isNew ? null : async () => { if (await remove("refplagg", r._id)) { toast("Removed"); closeSheet(); } }, canDelete: true, onSave: save }), ctx: { refresh: () => { if (!isNew && !byId(D.ref, r._id)) { closeSheet(); return; } if (!isNew) { imgSec.render(); renderLogInto(logUl, (byId(D.ref, r._id) || r).logg); } } }, focus: isNew ? "f_rplagg" : null });
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
    card.append(h("div", { class: "card-head" }, h("h3", { text: "Collection rail" + (season ? " – " + season : "") }), h("span", { class: "sub", text: items.length ? items.length + " approved samples that have or will get a PO · " + items.filter((s) => s.platsTyp === "Hängare").length + " on hangers" : "No approved samples yet" })));
    if (!items.length) return card;
    const { t, tb } = table([["Hängare"], ["Product"], ["Colour"], ["Sample"], ["Style status"], ["Image"]]);
    for (const s of items) {
      const st = styleOf(s);
      const imgs = sampleImages(s);
      tb.append(h("tr", { tabIndex: 0, dataset: { id: s._id } },
        td("Hängare", null, s.platsTyp === "Hängare" ? h("span", { class: "hanger", text: "Hanger " + (s.hangare || "?") }) : s.platsTyp ? h("span", { class: "place", text: s.platsTyp }) : h("span", { class: "flag", text: "No location" })),
        td("", "c-main", h("div", { class: "prod", text: styleName(s) }), h("div", { class: "sub", text: [st.sasong, st.drop, typLabel(st), styleKategori(st)].filter(Boolean).join(" · ") })),
        td("Colour", null, sampleColours(s).length ? h("div", { class: "swatches" }, colourChips(s)) : "–"),
        td("Sample", null, tag(s._id), h("span", { class: "sub", text: " " + (s.version || "") })),
        td("Style status", null, styleStatusPill(st)),
        td("Image", null, imgs.length ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(imgs[0]), alt: "", loading: "lazy", onclick: (e) => { e.stopPropagation(); openLightbox(imgs, imgs[0]); } }) : h("span", { class: "muted", text: "–" }))));
    }
    tb.addEventListener("click", (e) => { if (e.target.closest("button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openSample(tr.dataset.id); });
    card.append(h("div", { class: "ledger-wrap" }, t));
    return card;
  }

  // ---------- E-COM (Jakob) ----------
  const ECOM_CHECKS = [["ecomShopify", "In Shopify"], ["ecomBeskrivning", "Description"], ["ecomPrisSatt", "Price set"], ["ecomStorleksguide", "Size guide"], ["ecomNewsletter", "Newsletter"], ["ecomSeo", "Tags/Collections"]];
  const EcomView = {
    mount(root) {
      const st = UI.ecom;
      const upd = () => { this.update(); persist(); };
      const money = canSeeMoney();
      this.strip = makeStrip([
        { key: "lev30", label: "Delivered within 30 d (PO)" },
        { key: "shopify", label: "Not in Shopify", cls: "t-warn" },
        { key: "pris", label: "No price", cls: "t-warn" },
        { key: "bild", label: "No e-com images", cls: "t-late" },
        { key: "klara", label: "Ready for launch" }
      ].concat(money ? [{ key: "marginal", label: "GM1 below 70 % (today or under currency stress)", cls: "t-late" }] : []), st, () => upd());
      const q = searchBox("q_ecom", "Search product …", st, () => this.update());
      this.fSeason = filterSelect("f_e_season", "All seasons", st, "season", () => { st.touched = true; upd(); });
      this.count = h("span", { class: "count" });
      this.cards = h("div", { class: "cards" });
      this.marg = h("section", { class: "card", hidden: !money });
      root.append(h("p", { class: "lede", text: "Everything that must be ready in Shopify before launch: when the garments arrive, when campaign and e-com are shot (from the Photo tab), and the checklist per product – Shopify product, description, price (fetched from Shopify, with GM1 against the PO cost: green ≥ 75 %, yellow 70–75 %, red below 70 %), size guide, newsletter and tags/collections. EAN comes from the app." }),
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
      el.append(h("div", { class: "card-head" }, h("h3", { text: "Price margins (GM1) against the Shopify price – with currency risk" }), h("span", { class: "sub", text: (D.shopify.length ? D.shopify.length + " active products in Shopify" + (datum ? ", prices fetched " + fmtDate(datum) : "") : "No Shopify prices loaded yet") + " · cost = purchase price in the supplier's currency at today's rate (otherwise PO average in SEK) · stress = SEK weakens " + stressPct() + " % against the supplier's currency (changed under Suppliers)" })));
      if (!D.shopify.length) return;
      el.append(h("div", { class: "strip", style: "--cols:4;margin:0 0 12px" }, tile(fmtPct(median(withCost.map((r) => r.info.gm)), 1), "Median GM1 (" + withCost.length + " products with cost)"), tile(String(under.length), "Below 70 % today", under.length ? "t-late" : ""), tile(String(underStress.length), "Falls below 70 % at +" + stressPct() + " % currency", underStress.length ? "t-warn" : ""), tile(String(missing.length), "No purchase price", missing.length ? "t-warn" : "")));
      const sorted = rows.slice().sort((a, b) => { const ga = a.info && a.info.kostnad != null ? a.info.gm : 999, gb = b.info && b.info.kostnad != null ? b.info.gm : 999; return ga - gb || (a.p.titel || "").localeCompare(b.p.titel || "", "sv"); });
      const { t, tb } = table([["Product (Shopify)"], ["Style"], ["Supplier"], ["Price incl. VAT", "num"], ["Cost", "num"], ["GM1", "num"], ["At +" + stressPct() + " %", "num"], ["Currency headroom"], ["Note"]]);
      for (const r of sorted) {
        const i = r.info; const lev = r.s ? r.s.leverantor : (r.p.leverantor || ""); const cur = i ? i.valuta : (r.p.valuta || "");
        tb.append(h("tr", { tabIndex: 0, dataset: r.s ? { style: r.s._id } : {}, style: r.s ? "cursor:pointer" : "" },
          td("", "c-main", h("div", { class: "prod", text: r.p.titel }), h("div", { class: "sub", text: r.p.typ || "" })),
          td("Style", null, r.s ? h("span", { class: "mono", text: r.s._id + " · " + r.s.namn }) : h("span", { class: "muted", text: "no style in the app" })),
          td("Supplier", null, (lev || "–") + (cur && cur !== "SEK" ? " · " + cur : "")),
          td("Price incl. VAT", "num", fmtSEK(r.p.pris)),
          td("Cost", "num", i && i.kostnad != null ? h("div", null, h("div", { text: fmtSEK(i.kostnad) }), i.valuta !== "SEK" ? h("div", { class: "sub", text: fmtCur(i.kostnadValuta, i.valuta) }) : null) : h("span", { class: "muted", text: "–" })),
          td("GM1", "num", i && i.kostnad != null ? h("span", { class: "pill " + gmClass(i.gm), text: fmtPct(i.gm, 1) }) : h("span", { class: "muted", text: "–" })),
          td("Under stress", "num", i && i.kostnad != null && i.valuta !== "SEK" ? h("span", { class: "pill " + gmClass(i.gmStress), text: fmtPct(i.gmStress, 1) }) : h("span", { class: "muted", text: "–" })),
          td("Headroom", "mono", i && i.tal != null ? h("span", { style: "white-space:nowrap", title: i.tal >= 0 ? "This is how much SEK can weaken against " + i.valuta + " before GM1 falls below 70 %" : "GM1 is already below 70 % at today's rate", text: i.tal >= 0 ? "+" + Math.round(i.tal) + " %" : "–" }) : ""),
          td("Note", null, h("span", { class: "sub", text: [i && i.kalla ? i.kalla : "", r.p.notering || ""].filter(Boolean).join(" · ") }))));
      }
      tb.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
      const wrap = h("div", { class: "ledger-wrap", hidden: !UI.ecom.margOpen }, t);
      const tog = h("button", { class: "btn small", type: "button", text: (UI.ecom.margOpen ? "Hide" : "Show") + " all " + rows.length + " products (sorted by GM1, lowest first)", onclick: () => { UI.ecom.margOpen = !UI.ecom.margOpen; wrap.hidden = !UI.ecom.margOpen; tog.textContent = (UI.ecom.margOpen ? "Hide" : "Show") + " all " + rows.length + " products (sorted by GM1, lowest first)"; persist(); } });
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
      for (const s of list) { const k = (s.drop || "No drop") + " – " + (s.sasong || "no season"); if (!byDrop.has(k)) byDrop.set(k, { sasong: s.sasong || "", drop: s.drop || "", items: [] }); byDrop.get(k).items.push(s); }
      const cards = [];
      const ro = !canWrite || !db;
      for (const [k, grp] of byDrop) {
        const items = grp.items;
        const d = dropsOfSeason(grp.sasong).find((x) => x.namn === grp.drop);
        const card = h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: k }), h("span", { class: "sub", text: items.length + " products · " + items.filter(done).length + " ready" + (d && isISO(d.lansering) ? " · launch " + fmtDate(d.lansering) : "") })));
        const { t, tb } = table([["Product"], ["Delivery"], ["Campaign shoot"], ["E-com photo"], ["Checklist"], ["Price"], ["Launch"], ["Note"]]);
        for (const s of items) {
          const img = styleImage(s);
          const save = (patch, logText) => write("styles", s._id, Object.assign({ andrad: new Date().toISOString() }, patch, logText ? { logg: (s.logg || []).concat(logEntry(logText)) } : {}));
          const checks = h("div", { class: "checks" }, ECOM_CHECKS.map(([key, label]) => { const cb = h("input", { type: "checkbox", checked: !!s[key], disabled: ro, onchange: () => save({ [key]: cb.checked }, label + (cb.checked ? " ready" : " not ready")) }); return h("label", { class: "checkline" }, cb, label); }),
            h("span", { class: "pill " + (eanOk(s) ? "ts-ok" : "ts-slut"), text: eanOk(s) ? "EAN ready" : "EAN missing" }));
          const pris = inp("pris_" + s._id, s.ecomPris, { type: "number", min: "0", step: "1", placeholder: "SEK incl. VAT", "aria-label": "Price" }); pris.disabled = ro;
          const gmEl = h("div");
          const renderGm = () => { gmEl.replaceChildren(); const pr = num(pris.value); if (!pr) return; const src = s.ecomPrisKalla ? h("div", { class: "sub", text: "Price from " + s.ecomPrisKalla + (s.ecomPrisDatum ? " " + fmtDate(s.ecomPrisDatum) : "") + (pr !== num(s.ecomPris) ? " (changed here)" : "") }) : null; if (money) gmEl.append(gmCell(gm1Info(s, pr))); if (src) gmEl.append(src); };
          pris.addEventListener("input", renderGm); renderGm();
          pris.addEventListener("change", () => { const pv = num(pris.value); const same = pv != null && pv === num(s.ecomPris); save({ ecomPris: pv, ecomPrisSatt: pv != null, ecomPrisKalla: pv == null ? null : same ? (s.ecomPrisKalla || "manual") : "manual", ecomPrisDatum: pv == null ? null : same ? (s.ecomPrisDatum || todayISO()) : todayISO() }, "Price " + (pris.value || "removed")); });
          const lans = inp("lans_" + s._id, s.ecomLansering, { type: "date", "aria-label": "Launch date" }); lans.disabled = ro;
          lans.addEventListener("change", () => save({ ecomLansering: lans.value || null }));
          const note = inp("enote_" + s._id, s.ecomNotering, { placeholder: "Note", "aria-label": "Note" }); note.disabled = ro;
          note.addEventListener("change", () => save({ ecomNotering: note.value.trim() }));
          const e = eta(s);
          const kamp = s.kampanjDatum || s.kampanjStatus ? [isISO(s.kampanjDatum) ? fmtDate(s.kampanjDatum) : "", s.kampanjStatus || ""].filter(Boolean).join(" · ") : "–";
          tb.append(h("tr", { tabIndex: 0, dataset: { style: s._id } },
            td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, img ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(img), alt: "", loading: "lazy" }) : null, h("div", null, h("div", { class: "prod", text: s.namn }), h("div", { class: "sub", text: [typLabel(s), styleKategori(s), (s.farger || []).join(", ")].filter(Boolean).join(" · ") }), h("div", null, styleStatusPill(s))))),
            td("Delivery", null, e ? h("div", null, h("div", { class: "mono", text: fmtDate(e) }), h("div", { class: "days " + (diffDays(e) < 0 ? "late" : diffDays(e) <= 14 ? "soon" : ""), text: fmtDays(diffDays(e)) }), etaSrc(s) === "ETA" ? h("div", { class: "sub", text: "ETA warehouse (the PO has no delivery date)" }) : h("div", { class: "sub", text: "per PO" })) : h("span", { class: "muted", text: inProduction(s) ? "The PO has no delivery date" : "no PO" })),
            td("Campaign shoot", null, kamp),
            td("E-com photo", null, isISO(s.ecomPlatDatum) ? h("div", null, h("div", { class: "mono", text: fmtDate(s.ecomPlatDatum) }), h("div", { class: "days " + (diffDays(s.ecomPlatDatum) < 0 ? "" : diffDays(s.ecomPlatDatum) <= 14 ? "soon" : ""), text: fmtDays(diffDays(s.ecomPlatDatum)) }), h("span", { class: "pill es-" + (s.ecomBilder ? slug(s.ecomBilder) : "x"), text: s.ecomBilder || "planned" })) : h("span", { class: "pill es-" + (s.ecomBilder ? slug(s.ecomBilder) : "x"), text: s.ecomBilder ? s.ecomBilder + " – date missing" : "not planned by Oliver yet" })),
            td("Checklist", "foto-inline", checks),
            td("Price", "foto-inline", h("div", { style: "display:grid;gap:4px" }, pris, gmEl)),
            td("Launch", "foto-inline", lans),
            td("Note", "foto-inline", note)));
        }
        tb.addEventListener("click", (e) => { if (e.target.closest("input, select, button, label")) return; const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
        card.append(h("div", { class: "ledger-wrap" }, t));
        cards.push(card);
      }
      this.cards.replaceChildren(...cards);
      if (!list.length) this.cards.append(h("div", { class: "empty" }, h("strong", { text: "Nothing to show" }), h("span", { text: "Change season or clear the filter." })));
      this.count.textContent = list.length + " products" + (season ? " in " + season : " (all seasons)");
    }
  };

  // ---------- TYGER ----------
  const TygerView = {
    mount(root) {
      const st = UI.tyger;
      const q = searchBox("q_tyger", "Search fabric or supplier …", st, () => this.update());
      const fs = selectEl("f_t_status", [["", "All statuses"]].concat(TYG_STATUS), st.status);
      fs.addEventListener("change", () => { st.status = fs.value; this.update(); });
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["Tyg"], ["Supplier"], ["Status"], ["Used in"], ["Eget lager"], ["Last ordered"], ["Comment"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openTyg(tr.dataset.id); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const tr = e.target.closest("tr[data-id]"); if (tr) openTyg(tr.dataset.id); });
      this.empty = h("div", { class: "empty", hidden: true });
      root.append(h("p", { class: "lede", text: "All fabrics you have tried or use, written the way you talk about them, e.g. \"Japan Blue inhouse – Westpoint Canvas 223\". New fabrics typed on a sample end up here automatically. Metres you own yourselves are under Stock." }), h("section", { class: "filters" }, q, fs, this.count), h("section", { class: "ledger-wrap" }, t, this.empty));
    },
    update() {
      const st = UI.tyger, q = norm(st.q);
      const list = D.tyger.filter((t) => (!st.status || t.status === st.status) && (!q || [t._id, t.namn, t.leverantor, t.kommentar].join(" ").toLowerCase().includes(q))).sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv"));
      this.tb.replaceChildren(...list.map((t) => {
        const used = D.samples.filter((s) => s.tygId === t._id);
        const nStyles = uniq(used.map((s) => s.styleId)).length;
        const lastOrder = used.map((s) => s.bestalld).filter(isISO).sort().pop();
        const statusCell = td("Status", null, t.status ? h("span", { class: "pill ts-" + slug(t.status), text: t.status }) : h("span", { class: "muted", text: "–" }));
        if (isISO(t.aterDatum)) statusCell.append(h("div", { class: "sub", text: "again " + fmtDate(t.aterDatum) }));
        if (isISO(t.aterDatum) && /slut/i.test(t.status || "") && diffDays(t.aterDatum) <= 0) statusCell.append(h("span", { class: "flag", text: "Check availability" }));
        return h("tr", { tabIndex: 0, dataset: { id: t._id } },
          td("", "c-main", h("div", { class: "prod", text: t.namn || "Unnamed fabric" }), h("div", { class: "sub", text: t._id })),
          td("Supplier", null, t.leverantor || ""), statusCell,
          td("Used in", null, used.length ? used.length + (used.length === 1 ? " sample" : " samples") + " · " + nStyles + (nStyles === 1 ? " style" : " styles") : "–"),
          td("Eget lager", null, stockText(t._id) || h("span", { class: "muted", text: "–" })),
          td("Last ordered", "mono", lastOrder ? fmtDate(lastOrder) : ""),
          td("Comment", "note", t.kommentar || ""));
      }));
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(h("strong", { text: loaded.has("tyger") ? (D.tyger.length ? "Nothing matches" : "No fabrics yet") : "Loading fabrics …" }));
      this.count.textContent = list.length + " of " + D.tyger.length + " fabrics";
    }
  };

  // ---------- TYGLAGER ----------
  const LagerView = {
    mount(root) {
      const st = UI.lager;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "meter", label: "Metres of fabric left (approx.)" },
        { key: "antal", label: "Trims left" },
        { key: "partier", label: "Batches in stock" },
        { key: "saknar", label: "No quantity", cls: "t-warn" },
        { key: "bestallda", label: "Ordered" },
        { key: "reserverade", label: "Reserved" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_lager", "Search fabric, colour, location, style …", st, () => this.update());
      this.fPlats = filterSelect("f_l_plats", "All locations", st, "plats", upd);
      this.seg = makeSeg([["I lager", "I lager"], ["Beställd", "Beställd"], ["Förbrukad", "Förbrukad"], ["alla", "All"]], st, "status", upd);
      if (!st.typ) st.typ = "alla";
      const typState = { get typ() { return st.typ; }, set typ(v) { st.typ = v; }, view: null };
      this.segTyp = makeSeg([["tyg", "Tyg"], ["trims", "Trims"], ["alla", "Fabric + trims"]], typState, "typ", upd);
      this.segTyp.el.setAttribute("aria-label", "Typ");
      const grp = selectEl("f_l_group", [["plats", "Group by location"], ["tyg", "Group by fabric"], ["none", "No grouping"]], st.group);
      grp.addEventListener("change", () => { st.group = grp.value; upd(); });
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["Item"], ["Location"], ["Left"], ["Reserved for"], ["Updated"], ["Status"], ["Comment"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { if (e.target.closest("button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openLager(tr.dataset.id); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter" || e.target.closest("button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openLager(tr.dataset.id); });
      this.empty = h("div", { class: "empty", hidden: true });
      root.append(h("p", { class: "lede", text: "Fabric and trims that Rubato owns: where it is and how much is left – metres for fabric, quantity for trims (buttons, zips, labels …). Update when an order has been sewn or when the supplier has counted." }), this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.segTyp.el, this.fPlats.el, this.seg.el, grp, this.count), h("section", { class: "ledger-wrap" }, t, this.empty));
    },
    update() {
      const st = UI.lager, q = norm(st.q);
      const typOk = (l) => !st.typ || st.typ === "alla" || (st.typ === "trims") === isTrims(l);
      this.segTyp.sync();
      const inStock = D.lager.filter((l) => l.status === "I lager" && typOk(l));
      this.strip.set({
        meter: Math.round(inStock.filter((l) => !isTrims(l)).reduce((a, l) => a + (num(l.meter) || 0), 0)),
        antal: inStock.filter(isTrims).reduce((a, l) => a + (num(l.antal) || 0), 0),
        partier: inStock.length,
        saknar: inStock.filter((l) => lotQty(l) == null).length,
        bestallda: D.lager.filter((l) => l.status === "Beställd" && typOk(l)).length,
        reserverade: inStock.filter((l) => l.reserveradFor).length
      });
      this.seg.sync();
      this.fPlats.fill(uniq(D.lager.map((l) => l.plats)));
      const list = D.lager.filter((l) => {
        switch (st.view) {
          case "meter": if (!(l.status === "I lager" && !isTrims(l) && num(l.meter) != null)) return false; break;
          case "antal": if (!(l.status === "I lager" && isTrims(l) && num(l.antal) != null)) return false; break;
          case "partier": if (l.status !== "I lager") return false; break;
          case "saknar": if (!(l.status === "I lager" && lotQty(l) == null)) return false; break;
          case "bestallda": if (l.status !== "Beställd") return false; break;
          case "reserverade": if (!(l.status === "I lager" && l.reserveradFor)) return false; break;
          default: if (st.status !== "alla" && l.status !== st.status) return false;
        }
        if (!typOk(l)) return false;
        if (st.plats && l.plats !== st.plats) return false;
        if (q && ![l._id, lotName(l), l.farg, l.storlek, isTrims(l) ? "trims" : "tyg", l.plats, l.kommentar, reservedName(l), l.status].join(" ").toLowerCase().includes(q)) return false;
        return true;
      });
      const keyOf = st.group === "plats" ? (l) => l.plats || "No location" : st.group === "tyg" ? (l) => lotName(l) : () => "";
      list.sort((a, b) => keyOf(a).localeCompare(keyOf(b), "sv") || lotName(a).localeCompare(lotName(b), "sv") || (a.farg || "").localeCompare(b.farg || "", "sv") || a._id.localeCompare(b._id));
      const rows = [];
      let last = null;
      for (const l of list) {
        const k = keyOf(l);
        if (st.group !== "none" && k !== last) {
          last = k;
          const grpLots = list.filter((x) => keyOf(x) === k);
          const inL = grpLots.filter((x) => x.status === "I lager");
          const knownM = inL.filter((x) => !isTrims(x) && num(x.meter) != null);
          const knownS = inL.filter((x) => isTrims(x) && num(x.antal) != null);
          const unknown = inL.filter((x) => lotQty(x) == null).length;
          const bits = [k, grpLots.length + (grpLots.length === 1 ? " batch" : " batches")];
          if (knownM.length) bits.push("approx. " + fmtM(knownM.reduce((a, x) => a + num(x.meter), 0)) + " m");
          if (knownS.length) bits.push(fmtSt(knownS.reduce((a, x) => a + num(x.antal), 0)));
          if (unknown) bits.push(unknown + " no quantity");
          rows.push(h("tr", { class: "group" }, h("td", { colSpan: 7, text: bits.join(" · ") })));
        }
        rows.push(lagerRow(l));
      }
      this.tb.replaceChildren(...rows);
      this.empty.hidden = list.length > 0;
      if (!list.length) {
        this.empty.replaceChildren(...(!loaded.has("lager")
          ? [h("strong", { text: db ? "Loading stock …" : "No stock to show" })]
          : D.lager.length ? [h("strong", { text: "Nothing matches the filter" }), h("span", { text: "Change status or location, or clear the search." })]
          : [h("strong", { text: "No batches yet" }), h("span", { text: "Add the first one with \"+ New batch\": fabric or trims, where it is and how much." })]));
      }
      this.count.textContent = list.length + " of " + D.lager.length + " batches";
    }
  };
  function lagerRow(l) {
    const tr = h("tr", { tabIndex: 0, dataset: { id: l._id } });
    const t = tygOf(l);
    const trm = isTrims(l);
    const sub = [l._id, trm ? "Trims" : "", l.farg, trm ? l.storlek : (num(l.bredd) != null ? l.bredd + " cm" : "")].filter(Boolean).join(" · ");
    const kvar = h("td", { "data-label": "Left", class: "c-exp" });
    const qn = lotQty(l), qi = num(trm ? l.inkoptAntal : l.inkoptMeter);
    if (qn != null) kvar.append(h("div", { class: "mono", text: fmtQty(l, qn) }));
    else if (l.status === "I lager") kvar.append(h("span", { class: "flag", text: trm ? "Enter quantity" : "Enter metres" }));
    else kvar.append(h("span", { class: "muted", text: "–" }));
    if (qi != null) kvar.append(h("div", { class: "sub", text: "purchased " + (trm ? fmtSt(qi) : fmtM(qi) + " m") }));
    const upd = l.raknad || (l.andrad ? String(l.andrad).slice(0, 10) : "");
    tr.append(
      td("", "c-main", h("div", { class: "prod" + (t && t.status === "Slut" ? " late-text" : ""), text: lotName(l) }), h("div", { class: "sub", text: sub })),
      td("Location", null, h("span", { class: "place", text: l.plats || "" })),
      kvar,
      td("Reserved for", null, reservedName(l) || ""),
      td("Updated", "mono", isISO(upd) ? fmtDate(upd) : ""),
      td("Status", "c-status", h("span", { class: "pill ls-" + slug(l.status || "x"), text: l.status || "–" })),
      td("Comment", "note", l.kommentar || "")
    );
    return tr;
  }

  // ---------- COO: rullande 12 månader ----------
  const EV_TYP = [["kollektion", "Collection & product"], ["inkop", "Purchasing"], ["drop", "Drop & launch"], ["innehall", "Content"], ["massor", "Fairs & events"], ["ekonomi", "Finance & admin"], ["lokaler", "Premises & staff"]];
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
        if (p.best && (st.typ || "Nyhet") === "Nyhet") add(Object.assign({}, base, { key: "s-best-" + st._id, typ: "kollektion", titel: "Sample ordered by: " + st.namn, datum: p.best, agare: "Alex", klar: xs.some((x) => isISO(x.bestalld)) }));
        if (p.inne && (st.typ || "Nyhet") === "Nyhet") add(Object.assign({}, base, { key: "s-inne-" + st._id, typ: "kollektion", titel: "Sample in by: " + st.namn, datum: p.inne, agare: "Alex", klar: xs.some((x) => x.status === "Mottagen") }));
        add(Object.assign({}, base, { key: "s-po-" + st._id, typ: "inkop", titel: "PO by: " + st.namn, datum: p.po, agare: "Elliot", klar: hasPlacedPo(st) }));
      }
      if (isISO(st.fotoSenast)) add(Object.assign({}, base, { key: "s-foto-" + st._id, typ: "innehall", titel: "Photo sample by: " + st.namn, datum: st.fotoSenast, agare: "Oliver", klar: fotoState(st).key === "finns" }));
      if (isISO(st.kampanjDatum)) add(Object.assign({}, base, { key: "s-kamp-" + st._id, typ: "innehall", titel: "Campaign shoot: " + st.namn, datum: st.kampanjDatum, agare: "Oliver", klar: ["Fotad", "Klar"].includes(st.kampanjStatus) }));
      if (isISO(st.ecomPlatDatum)) add(Object.assign({}, base, { key: "s-ecom-" + st._id, typ: "innehall", titel: "E-com shoot: " + st.namn, datum: st.ecomPlatDatum, agare: "Oliver", klar: ["Fotade", "Retuscherade", "Publicerade"].includes(st.ecomBilder) }));
      if (isISO(st.ecomLansering)) add(Object.assign({}, base, { key: "s-lans-" + st._id, typ: "drop", titel: "Launch: " + st.namn, datum: st.ecomLansering, agare: "Jakob", klar: st.ecomBilder === "Publicerade" && !!st.ecomShopify }));
    }
    for (const d of D.drops) {
      const members = D.styles.filter((x) => dropKey(x.sasong, x.drop) === dropKey(d.sasong, d.namn) && styleStatusNorm(x.status) !== "Kastad");
      const base = { sasong: d.sasong, drop: d.namn, open: () => openDrop(d._id) };
      if (isISO(d.lansering) && !d._coo) add(Object.assign({}, base, { key: "d-lans-" + d._id, typ: "drop", titel: "Drop date: " + d.namn + " " + d.sasong, datum: d.lansering, agare: "Jakob", klar: d.lansering < todayISO() || (members.length > 0 && members.every((x) => x.ecomBilder === "Publicerade")) }));
      if (isISO(d.klartSenast)) add(Object.assign({}, base, { key: "d-klart-" + d._id, typ: "inkop", titel: "In stock by: " + d.namn + " " + d.sasong, datum: d.klartSenast, agare: "Elliot", klar: members.length > 0 && members.every((x) => styleStatusNorm(x.status) === "Levererad") }));
    }
    for (const po of D.po) {
      const st0 = poStatusNorm(po.status); if (PO_DRAFT.includes(st0)) continue;
      const ms = poMilestones(po);
      const nr = po.nr || po._id;
      const base = { sasong: po.sasong || "", drop: po.drop || "", poId: po._id, open: () => openPo(po._id) };
      const rank = PO_STATUS.indexOf(st0);
      if (ms.produktion) add(Object.assign({}, base, { key: "po-prod-" + po._id, typ: "inkop", titel: "Production start " + nr + " · " + (po.leverantor || ""), datum: ms.produktion, agare: "Elliot", klar: rank >= PO_STATUS.indexOf("PO bekräftad") }));
      if (ms.exfactory) add(Object.assign({}, base, { key: "po-ex-" + po._id, typ: "inkop", titel: "Ex-factory " + nr + " · " + (po.leverantor || ""), datum: ms.exfactory, agare: "Elliot", klar: rank >= PO_STATUS.indexOf("Skickad") }));
      if (ms.leverans) add(Object.assign({}, base, { key: "po-lev-" + po._id, typ: "inkop", titel: "Delivery to warehouse " + nr, datum: ms.leverans, agare: "Alex", klar: st0 === "Inlevererad" }));
      paymentPlan(po).forEach((x, i) => { if (x.datum) add(Object.assign({}, base, { key: "po-pay-" + po._id + "-" + x.idx, typ: "inkop", titel: (x.typ.includes("100") ? "Payment " : x.typ.includes("netto") ? "Final payment " : i === 0 ? "Deposit " : "Payment ") + nr + (money ? " · " + fmtTkr(x.belopp) : ""), datum: x.datum, agare: "Elliot", klar: !!x.betald })); });
    }
    return out;
  }
  function allEvents() {
    const w = evWindow();
    const manual = D.handelser.map((e) => Object.assign({}, e, { auto: false, open: () => openEvent(e._id) }));
    return autoEvents().concat(manual).filter((e) => isISO(e.datum) && ((e.datum >= w.from && e.datum <= w.to) || (e.slut && e.slut >= w.from && e.datum <= w.to)) && (e.datum >= todayISO() || isOverdue(e) || (e.slut && e.slut >= todayISO()) || e.datum >= addDays(todayISO(), -30)));
  }
  const evPill = (e) => h("span", { class: "pill ev-" + (isOverdue(e) ? "sen" : slug(e.status || "Planerad")), text: isOverdue(e) ? "Late" : e.status || "Planerad" });
  const CooView = {
    mount(root) {
      const st = UI.coo;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "sen", label: "Late", cls: "t-late" },
        { key: "v7", label: "Within 7 days", cls: "t-warn" },
        { key: "d30", label: "Within 30 days" },
        { key: "man", label: "Manual events" },
        { key: "mina", label: "Mine" }
      ], st, () => upd());
      const q = searchBox("q_coo", "Search event, PO, style …", st, () => this.update());
      this.seg = makeSeg([["lanseringar", "Launches"], ["tidslinje", "Timeline"], ["30", "Next 30 days"], ["lista", "List"]], st, "mode", upd);
      this.fAgare = filterSelect("f_c_agare", "All owners", st, "agare", upd);
      this.fSeason = filterSelect("f_c_season", "All seasons", st, "season", upd);
      this.typeBar = h("div", { class: "seg", role: "group", "aria-label": "Type" });
      this.autoBox = h("input", { type: "checkbox", checked: st.visaAuto !== false, onchange: () => { st.visaAuto = this.autoBox.checked; upd(); } });
      this.count = h("span", { class: "count" });
      this.body = h("div", { class: "cards" });
      root.append(h("p", { class: "lede", text: "What launches when, month by month: every drop with its products and where they stand – delivered, photo, in Shopify. Fairs and other events are shown in the same flow. Timeline and list remain for anyone who wants to see every deadline." }),
        this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.seg.el, this.fAgare.el, this.fSeason.el, this.typeBar, h("label", { class: "checkline" }, this.autoBox, "Show automatic"), this.count), this.body);
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
      else if (st.mode === "30" && !st.view) this.body.append(this.listCard(list.filter((e) => (e.datum <= addDays(t, 30) && e.status !== "Klar") || isOverdue(e)), "Next 30 days", "Late first, then in date order."));
      else this.body.append(this.listCard(list, st.view ? ({ sen: "Late", v7: "Within 7 days", d30: "Within 30 days", man: "Manual events", mina: "My events" })[st.view] : "All events 12 months", ""));
      this.count.textContent = list.length + " events · " + all.filter((e) => !e.auto).length + " manual";
    },
    // Lanseringar: månad för månad, drop för drop, med produkterna och var de står.
    launches(list) {
      const st = UI.coo, t = todayISO();
      const w = evWindow();
      const live = (x) => !x.grund && !isIdea(x) && !["Kastad", "Pausad"].includes(styleStatusNorm(x.status));
      const etaOf = (x) => { const pos = poLinesOf(x._id).map((l) => l.po).filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status))); if (!pos.length) return null; if (pos.every((p) => poStatusNorm(p.status) === "Inlevererad")) return { key: "inne", label: "Levererad" }; const ds = pos.map((p) => (isISO(p.leveransOnskad) ? p.leveransOnskad : poEta(p))).filter(Boolean).sort(); return { key: ds[0] && ds[0] < t ? "sen" : "vantar", label: ds[0] ? "Delivery " + fmtDate(ds[0]) : "PO placed, date missing" }; };
      const chip = (cls, txt) => h("span", { class: "pill " + cls, text: txt });
      const prodRow = (x) => {
        const img = styleImage(x); const eta = etaOf(x); const foto = x.ecomBilder || "";
        return h("div", { class: "launch-prod", tabIndex: 0, onclick: () => openStyle(x._id), onkeydown: (ev) => { if (ev.key === "Enter") openStyle(x._id); } },
          img ? h("img", { class: "rowthumb", style: "margin:0", src: imgUrl(img), alt: "", loading: "lazy" }) : h("div", { class: "rowthumb", style: "margin:0" }),
          h("div", { class: "launch-main" }, h("div", { class: "prod", text: x.namn }), h("div", { class: "sub", text: [styleKategori(x), (x.farger || []).join(", "), x.leverantor].filter(Boolean).join(" · ") })),
          h("div", { class: "launch-chips" },
            eta ? chip(eta.key === "inne" ? "ts-ok" : eta.key === "sen" ? "ts-slut" : "ts-delvis-slut", eta.label) : chip("ts-utgatt", styleStatusNorm(x.status) === "Levererad" ? "Levererad" : "No PO"),
            chip(["Publicerade", "Retuscherade", "Fotade"].includes(foto) ? "ts-ok" : foto ? "ts-delvis-slut" : "ts-utgatt", foto ? "Photo: " + foto.toLowerCase() : "Photo not planned"),
            chip(x.ecomShopify ? "ts-ok" : "ts-utgatt", x.ecomShopify ? "In Shopify" : "Not in Shopify")));
      };
      const dropCard = (d, members, date) => {
        const done = members.filter((x) => x.ecomShopify && ["Publicerade"].includes(x.ecomBilder || "")).length;
        const dd = date ? diffDays(date) : null;
        const card = h("section", { class: "card launch-card" + (dd != null && dd < 0 ? " past" : "") });
        card.append(h("div", { class: "card-head", style: d._id ? "cursor:pointer" : "", onclick: () => { if (d._id) openDrop(d._id); } }, h("div", null, h("h3", { text: (d.namn || "No drop") + " · " + (d.sasong || "") }), h("span", { class: "sub", text: members.length + " products · " + done + " ready in Shopify" + (isISO(d.klartSenast) ? " · in stock by " + fmtDate(d.klartSenast) : "") })),
          date ? h("div", { class: "launch-date" }, h("div", { class: "mono", text: fmtDate(date) }), h("div", { class: "days " + (dd < 0 ? "" : dd <= 14 ? "soon" : ""), text: dd < 0 ? "launched" : fmtDays(dd) })) : h("span", { class: "pill ts-utgatt", text: "Date missing" })));
        const ms = members.slice().sort((a, b) => (styleKategori(a) || "").localeCompare(styleKategori(b) || "", "sv") || (a.namn || "").localeCompare(b.namn || "", "sv"));
        card.append(h("div", { class: "launch-list" }, ms.length ? ms.map(prodRow) : h("p", { class: "hint", style: "padding:8px 16px", text: "No products linked to the drop yet." })));
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
      if (restWith.length) { out.push(h("h2", { class: "launch-month", text: "No launch date" })); for (const [d, ms] of restWith) out.push(dropCard(d, ms, null)); }
      const loose = styles.filter((x) => !x.drop && !["Levererad"].includes(styleStatusNorm(x.status)));
      if (loose.length) { out.push(h("h2", { class: "launch-month", text: "No drop" })); out.push(dropCard({ _id: null, namn: "No drop", sasong: "" }, loose, null)); }
      if (!out.length) out.push(h("div", { class: "empty" }, h("strong", { text: "No launches" }), h("span", { text: "Set a launch date on the drops under Collection and they appear here." })));
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
      const el = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "coo-tl", role: "img", "aria-label": "Timeline 12 months" });
      months.forEach((m, i) => { el.append(svg("rect", { x: X(m), y: top - 6, width: X(i + 1 < months.length ? months[i + 1] : end) - X(m), height: H - top + 6, class: "mbg" + (i % 2 ? " alt" : "") })); el.append(svg("text", { x: X(m) + 5, y: top - 12, class: "lbl" }, monthLabel(m.slice(0, 7)))); });
      rows.forEach((r) => { el.append(svg("line", { x1: 0, x2: W, y1: r.y, y2: r.y, class: "grid" })); el.append(svg("text", { x: 0, y: r.y + 16, class: "lev evt-" + r.k }, r.l)); el.append(svg("text", { x: 0, y: r.y + 30, class: "sub" }, r.items.length ? r.items.length + " pcs" + (r.items.filter(isOverdue).length ? " · " + r.items.filter(isOverdue).length + " late" : "") : "")); });
      el.append(svg("line", { x1: X(t), x2: X(t), y1: top - 6, y2: H, class: "today" }));
      el.append(svg("text", { x: X(t) + 4, y: H - 3, class: "lbl today-l" }, "today"));
      rows.forEach((r) => r.items.forEach((e, i) => {
        const y = r.y + pad + r.lanes[i] * laneH + laneH / 2;
        const late = isOverdue(e);
        const g = svg("g", { class: "ev evt-" + r.k + (late ? " late" : "") + (e.status === "Klar" ? " done" : "") + (e.auto ? " auto" : ""), style: "cursor:pointer" });
        g.append(svg("title", null, (e.titel || "") + " · " + fmtDate(e.datum) + (e.slut ? "–" + fmtDate(e.slut) : "") + " · " + (e.agare || "") + " · " + (late ? "LATE" : e.status || "") + (e.auto ? " · automatic from " + (e.poId ? "PO" : e.styleId ? "style" : "drop") : "")));
        const x0 = X(e.datum < start ? start : e.datum);
        if (e.slut) { const x1 = X(e.slut > end ? end : e.slut); const bw = Math.max(6, x1 - x0); g.append(svg("rect", { x: x0, y: y - 7, width: bw, height: 14, rx: 2, class: "bar" })); if (bw > 90) g.append(svg("text", { x: x0 + 4, y: y + 4, class: "lab onbar" }, (e.titel || "").slice(0, Math.floor(bw / 6.5)))); else g.append(svg("text", { x: x0 + bw + 5, y: y + 4, class: "lab" }, (e.titel || "").slice(0, 34))); }
        else { g.append(svg("circle", { cx: x0, cy: y, r: 5, class: e.auto ? "dot auto" : "dot" })); g.append(svg("text", { x: x0 + 9, y: y + 4, class: "lab" }, (e.titel || "").slice(0, 34) + ((e.titel || "").length > 34 ? "…" : ""))); }
        g.addEventListener("click", () => e.open && e.open());
        el.append(g);
      }));
      card.append(h("div", { class: "card-head" }, h("h3", { text: "Timeline 12 months" }), h("span", { class: "sub", text: inWin.length + " events · " + inWin.filter(isOverdue).length + " late · click an event for the source" })), h("div", { class: "tl-wrap" }, el),
        h("div", { class: "tl-legend", style: "padding:0 16px 12px" }, h("span", null, h("i", { class: "dotc", style: "background:var(--ink)" }), " manual"), h("span", null, h("i", { class: "dotc ant" }), " automatic from PLM"), h("span", null, h("i", { class: "dotc", style: "background:var(--late)" }), " late")));
      return card;
    },
    listCard(items, title, sub) {
      const card = h("section", { class: "card" });
      const sorted = items.slice().sort((a, b) => (isOverdue(b) - isOverdue(a)) || a.datum.localeCompare(b.datum));
      card.append(h("div", { class: "card-head" }, h("h3", { text: title }), h("span", { class: "sub", text: sorted.length + " events" + (sub ? " · " + sub : "") })));
      if (!sorted.length) { card.append(h("p", { class: "hint", style: "padding:12px 16px", text: "Nothing here." })); return card; }
      const { t, tb } = table([["Date"], ["Event"], ["Type"], ["Owner"], ["Season"], ["Status"], [""]]);
      for (const e of sorted) {
        const d = diffDays(e.datum);
        const ro = !canWrite || !db;
        const cb = e.auto ? null : h("input", { type: "checkbox", checked: e.status === "Klar", disabled: ro, "aria-label": "Klar", onchange: async () => { await write("handelser", e._id, { status: cb.checked ? "Klar" : "Planerad", andrad: new Date().toISOString() }); } });
        tb.append(h("tr", { tabIndex: 0, class: isOverdue(e) ? "ev-late" : null, dataset: { ev: e.key || e._id } },
          td("Date", "mono", fmtDate(e.datum) + (e.slut ? "–" + fmtDate(e.slut) : ""), h("div", { class: "days " + (d < 0 && e.status !== "Klar" ? "late" : d <= 7 ? "soon" : ""), text: e.status === "Klar" ? "" : fmtDays(d) })),
          td("", "c-main", h("div", { class: "prod", text: e.titel || "" }), h("div", { class: "sub", text: [e.drop, e.auto ? "automatic" : "", e.kommentar].filter(Boolean).join(" · ") })),
          td("Type", null, h("span", { class: "chip evt-" + e.typ, text: EV_TYP_LABEL[e.typ] || e.typ })),
          td("Owner", null, e.agare || "–"),
          td("Season", "mono", e.sasong || ""),
          td("Status", null, evPill(e)),
          td("", null, cb ? h("label", { class: "checkline" }, cb, "Klar") : h("button", { class: "linkish", type: "button", text: "Open source", onclick: (ev) => { ev.stopPropagation(); e.open && e.open(); } }))));
      }
      tb.addEventListener("click", (ev) => { if (ev.target.closest("input, label, button")) return; const tr = ev.target.closest("tr[data-ev]"); if (!tr) return; const e = sorted.find((x) => (x.key || x._id) === tr.dataset.ev); if (e && e.open) e.open(); });
      card.append(h("div", { class: "ledger-wrap" }, t));
      return card;
    }
  };
  const EV_LABELS = { titel: "Title", typ: "Typ", datum: "Date", slut: "Slut", agare: "Owner", ansvarig: "Responsible", status: "Status", sasong: "Season", drop: "Drop", poId: "PO", styleId: "Style", kommentar: "Comment" };
  function openEvent(id, preset) {
    if (designOnly()) return;
    const isNew = !id;
    const e = isNew ? Object.assign({ _id: null, typ: "massor", status: "Planerad", datum: todayISO(), logg: [] }, preset || {}) : byId(D.handelser, id);
    if (!e) { toast("Cannot find the event."); return; }
    const ro = !canWrite || !db;
    const fTitel = inp("f_etitel", e.titel, { placeholder: "e.g. Pitti Uomo, VAT return, Move to Söder Mälarstrand" });
    const fTyp = selectEl("f_etyp", EV_TYP, e.typ || "massor");
    const fDatum = inp("f_edatum", e.datum, { type: "date" });
    const fSlut = inp("f_eslut", e.slut, { type: "date" });
    const fAgare = inp("f_eagare", e.agare || EV_OWNER_DEFAULT[e.typ] || "", { list: "dlAgare", autocomplete: "off" });
    const fStatus = selectEl("f_estatus", EV_STATUS, e.status || "Planerad");
    const fSas = seasonSelect("f_esas", e.sasong);
    const fDrop = dropSelect("f_edrop", e.drop, fSas);
    const fPo = selectEl("f_epo", [["", "– none –"]].concat(D.po.filter((p) => !PO_DRAFT.includes(poStatusNorm(p.status))).map((p) => [p._id, (p.nr || p._id) + " · " + (p.leverantor || "")])), e.poId || "");
    const fStyle = selectEl("f_estyle", [["", "– none –"]].concat(D.styles.filter((x) => !x.grund && styleStatusNorm(x.status) !== "Kastad").sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv")).map((x) => [x._id, x.namn + (x.sasong ? " · " + x.sasong : "")])), e.styleId || "");
    const fKom = area("f_ekom", e.kommentar);
    const fAnsv = inp("f_eansv", e.ansvarig, { list: "dlAgare", autocomplete: "off", placeholder: "e.g. Oliver or Kalle, Jakob" });
    fTyp.addEventListener("change", () => { if (!fAgare.value.trim() || AGARE.includes(fAgare.value.trim())) fAgare.value = EV_OWNER_DEFAULT[fTyp.value] || ""; });
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (ev) => ev.preventDefault() },
      field("Title", fTitel, { full: true }), field("Type", fTyp), field("Owner", fAgare),
      field("Date", fDatum), field("End (if a period)", fSlut, { hint: "Empty = one day" }),
      field("Status", fStatus), field("Season", fSas), field("Drop", fDrop), h("div"),
      field("Link to PO", fPo), field("Link to style", fStyle),
      field("Responsible for the phase", fAnsv), field("Comment", fKom, { full: true }));
    if (ro) lock(form);
    const logUl = h("ul", { class: "log" });
    async function save() {
      const o = { titel: fTitel.value.trim(), typ: fTyp.value, datum: fDatum.value || null, slut: fSlut.value || null, agare: fAgare.value.trim(), status: fStatus.value, sasong: fSas.value.trim(), drop: fDrop.value.trim(), poId: fPo.value || null, styleId: fStyle.value || null, kommentar: fKom.value.trim() };
      o.ansvarig = fAnsv.value.trim();
      if (!isNew && isISO(e.datum) && isISO(o.datum) && o.datum !== e.datum && isISO(e.slut) && o.slut === e.slut) o.slut = addDays(e.slut, daysBetween(e.datum, o.datum));
      if (!o.titel) { toast("Give the event a title."); fTitel.focus(); return; }
      if (!o.datum) { toast("Set a date."); fDatum.focus(); return; }
      if (o.slut && o.slut < o.datum) { toast("The end date is before the start date."); return; }
      const now = new Date().toISOString();
      if (isNew) {
        const nid = await freshId("handelser", D.handelser, "H", 3);
        const body = Object.assign({ id: nid, logg: [logEntry("Event created")], andrad: now }, o);
        if (await create("handelser", nid, body)) { if (!byId(D.handelser, nid)) D.handelser.push(Object.assign({}, body, { _id: nid })); toast("Saved"); closeSheet(); }
      } else {
        const changes = describeChanges(e, o, EV_LABELS);
        if (!changes.length) { closeSheet(); return; }
        const lansFlytt = e.matris === "drop" && !e.hor_till && isISO(o.datum) && o.datum !== e.datum ? launchImpactText(o.sasong, o.drop, o.datum) : "";
        if (lansFlytt) setTimeout(() => { if ($("sheet").hidden) toast("Launch " + fmtDate(o.datum) + ". " + lansFlytt); }, 700);
        if (await write("handelser", e._id, Object.assign({}, o, { andrad: now, logg: (e.logg || []).concat(changes.map(logEntry)) }))) { toast("Saved"); closeSheet(); await mxMoveKids(e, o); }
      }
    }
    const body = [form];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "History" }), logUl));
    openSheet({ flagRef: isNew ? null : { typ: "handelse", ref: e._id, titel: e.titel, tab: "coo" }, tag: isNew ? "New" : EV_TYP_LABEL[e.typ] || e._id, title: isNew ? "New event" : e.titel, sub: isNew ? "" : [fmtDate(e.datum) + (e.slut ? "–" + fmtDate(e.slut) : ""), e.agare, e.sasong].filter(Boolean).join(" · "), body, foot: footButtons({ del: "Delete event", onDelete: isNew ? null : async () => { if (await remove("handelser", e._id)) { toast("Removed"); closeSheet(); } }, canDelete: true, onSave: save }), ctx: { refresh: () => { if (!isNew && !byId(D.handelser, e._id)) { closeSheet(); return; } if (!isNew) renderLogInto(logUl, (byId(D.handelser, e._id) || e).logg); } }, focus: isNew ? "f_etitel" : null });
    if (!isNew) renderLogInto(logUl, e.logg);
  }

  // ---------- LEVERANTÖRER ----------
  const svg = (tag, attrs, ...kids) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, String(v)); for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
  const monthKey = (iso) => iso.slice(0, 7);
  const monthLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return MONTHS[m - 1] + (m === 1 || ym === monthKey(todayISO()) ? " " + String(y).slice(2) : ""); };
  // Lista över de betalningar (POs) som bygger upp en summa i betalningsmatrisen
  function openPayList(xs) {
    const sum = xs.reduce((a, x) => a + x.belopp, 0);
    const { t, tb } = table([["Due"], ["PO"], ["Share"], ["Amount", "num"], ["In currency", "num"], ["Status"]]);
    for (const x of xs.slice().sort((a, b) => (a.datum || "").localeCompare(b.datum || ""))) {
      tb.append(h("tr", { tabIndex: 0, style: "cursor:pointer", onclick: () => openPo(x.po._id) },
        td("Due", "mono", x.datum ? fmtDate(x.datum) : "–"),
        td("PO", "c-main", h("div", { class: "prod", text: x.po.nr || x.po._id }), h("div", { class: "sub", text: [x.po.sasong, x.po.drop].filter(Boolean).join(" ") })),
        td("Share", null, x.typ, x.kalla === "antagande" ? h("div", { class: "sub", text: "terms missing – assumed" }) : null),
        td("Amount", "num", fmtSEK(x.belopp)),
        td("In currency", "num", x.valuta && x.valuta !== "SEK" ? fmtCur(x.beloppValuta, x.valuta) : "–"),
        td("Status", null, poStatusPill(x.po))));
    }
    openSheet({ tag: xs[0].po.leverantor || "", title: fmtTkr(sum), sub: xs.length + " payments · click a row for the PO", body: [h("div", { class: "ledger-wrap" }, t)], foot: footButtons({ onSave: null }) });
  }
  const LevView = {
    mount(root) {
      const { t, tb } = table([["Supplier"], ["Currency"], ["Payment terms"], ["Lead times"], ["Open POs"], ["Unpaid", "num"], ["Contact"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { if (e.target.closest("button")) return; const tr = e.target.closest("tr[data-id]"); if (tr) openLev(tr.dataset.id); });
      tb.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const tr = e.target.closest("tr[data-id]"); if (tr) openLev(tr.dataset.id); });
      this.sUtv = inp("set_utv", "", { type: "number", min: "0", step: "1" });
      this.sFrakt = inp("set_frakt", "", { type: "number", min: "0", step: "1" });
      this.sGul = inp("set_gul", "", { type: "number", min: "0", step: "1" });
      this.sRisk = inp("set_risk", "", { type: "number", min: "0", max: "50", step: "1" });
      const saveSettings = async (patch, msg) => { if (!db) return; try { await db.doc("installningar/app").set(Object.assign({}, D.settings, patch, { andrad: new Date().toISOString() })); toast(msg); } catch (e) { writeError(e); } };
      const saveBtn = h("button", { class: "btn small", type: "button", text: "Save rules", onclick: () => saveSettings({ utvarderingDagar: num(this.sUtv.value) ?? 7, standardFrakt: num(this.sFrakt.value) ?? 7, marginalGul: num(this.sGul.value) ?? 14, valutarisk: num(this.sRisk.value) ?? 10 }, "Rules saved") });
      this.fxIn = {}; CURS.forEach((c) => { this.fxIn[c] = inp("fx_" + c, "", { type: "number", min: "0", step: "0.0001", inputmode: "decimal" }); });
      const fxBtn = h("button", { class: "btn small", type: "button", text: "Save rates", onclick: () => { const k = {}; CURS.forEach((c) => { const v = num(this.fxIn[c].value); if (v) k[c] = v; }); saveSettings({ kurser: k, kurserDatum: todayISO() }, "Rates saved"); } });
      this.fxNote = h("span", { class: "sub" });
      this.settings = h("section", { class: "panel" }, h("h3", { class: "sec-title", text: "Exchange rates (SEK per unit) and planning rules" }),
        h("div", { class: "form three" }, field("EUR", this.fxIn.EUR), field("GBP", this.fxIn.GBP), field("JPY", this.fxIn.JPY, { hint: "SEK per 1 JPY, e.g. 0.0657" })),
        h("div", { class: "form three" }, field("Evaluation (days)", this.sUtv, { hint: "Time from sample in to decision" }), field("Standard freight (days)", this.sFrakt, { hint: "Used when the supplier has no freight time" }), field("Yellow below (days)", this.sGul, { hint: "Margin before a style turns red" })),
        h("div", { class: "form three" }, field("Currency stress in GM1 (%)", this.sRisk, { hint: "How much SEK is assumed to weaken against the supplier's currency in the stress test of the price margins (E-com)" })),
        canWrite && db ? h("div", { class: "quick" }, fxBtn, saveBtn, this.fxNote) : this.fxNote);
      if (!canWrite || !db) [this.sUtv, this.sFrakt, this.sGul, this.sRisk].concat(Object.values(this.fxIn)).forEach((x) => (x.disabled = true));
      this.expo = h("section", { class: "strip", "aria-label": "Currency exposure" });
      this.timeline = h("section", { class: "card" });
      this.upcoming = h("section", { class: "card" });
      UI.lev = UI.lev || { season: "" };
      this.fSeason = filterSelect("f_l_season", "All seasons", UI.lev, "season", () => this.update());
      root.append(h("p", { class: "lede", text: "The payment schedule is calculated from every placed PO and the supplier's terms, in the supplier's currency and in SEK at today's rate. Filter by season to see what AW26, SS27 or AW27 costs to pay, month by month." }),
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
          td("Currency", null, l.valuta || h("span", { class: "muted", text: "–" })),
          td("Payment terms", null, h("div", { text: termsText(l) || (l.villkorText || "") || "–" }), h("span", { class: "pill " + (vs === "Bekräftade" ? "ts-ok" : vs === "Att förhandla" ? "ts-delvis-slut" : "ts-utgatt"), text: vs })),
          td("Lead times", null, h("div", { class: "sub", text: "Sample " + d(l.sampleLedtid) + (a ? " (average " + a.avg + ")" : "") + " · prod " + d(l.produktionstid) + " · freight " + (num(l.frakt) == null ? std + " (std)" : num(l.frakt)) + " d" })),
          td("Open POs", "mono", String(pos.length)),
          td("Unpaid", "num", owedSek ? h("div", null, h("div", { text: fmtSEK(owedSek) }), l.valuta && l.valuta !== "SEK" ? h("div", { class: "sub", text: fmtCur(owedSek / (fx(l.valuta) || 1), l.valuta) }) : null) : h("span", { class: "muted", text: "–" })),
          td("Contact", null, l.kontakt || ""));
      }));
      const act = document.activeElement;
      if (![this.sUtv, this.sFrakt, this.sGul, this.sRisk].concat(Object.values(this.fxIn)).includes(act)) {
        this.sUtv.value = D.settings.utvarderingDagar ?? 7; this.sFrakt.value = D.settings.standardFrakt ?? 7; this.sGul.value = D.settings.marginalGul ?? 14; this.sRisk.value = D.settings.valutarisk ?? 10;
        CURS.forEach((c) => { this.fxIn[c].value = (D.settings.kurser || {})[c] ?? FX_DEFAULT[c]; });
      }
      this.fxNote.textContent = D.settings.kurserDatum ? "Rates saved " + fmtDate(D.settings.kurserDatum) : "Standard rates (5 Nov 2026) – save your own.";
      this.renderExposure(open); this.renderMatrix(open, season); this.renderUpcoming(open);
    },
    renderExposure(open) {
      const byCur = {};
      for (const x of open) { const c = x.valuta || "SEK"; byCur[c] = byCur[c] || { sek: 0, val: 0 }; byCur[c].sek += x.belopp; byCur[c].val += x.beloppValuta; }
      const total = open.reduce((a, x) => a + x.belopp, 0);
      const tiles = [h("div", { class: "tile", style: "cursor:default" }, h("span", { class: "n mono", text: fmtTkr(total) }), h("span", { class: "l", text: "Unpaid in total (SEK)" }))];
      for (const c of ["EUR", "GBP", "JPY", "USD", "SEK"]) { const v = byCur[c]; if (!v || !v.sek) continue; tiles.push(h("div", { class: "tile", style: "cursor:default" }, h("span", { class: "n mono", text: c === "SEK" ? fmtTkr(v.sek) : fmtCur(v.val, c) }), h("span", { class: "l", text: c === "SEK" ? "in SEK (no currency risk)" : "unpaid in " + c + " = " + fmtTkr(v.sek) + " · ±5 % = ±" + fmtTkr(v.sek * 0.05) }))); }
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
      box.append(h("div", { class: "card-head" }, h("h3", { text: "Payment schedule" + (season ? " · " + season : " · all seasons") }), h("span", { class: "sub", text: items.length ? fmtTkr(items.reduce((a, x) => a + x.belopp, 0)) + " unpaid with a date · SEK at today's rate, currency amount below · click a sum for the POs" + (noDate ? " · " + noDate + " payments without a date (set order date or ex-factory on the PO)" : "") : "No upcoming payments with a date." })));
      if (!items.length) return;
      const { t, tb } = table([["Supplier"]].concat(cols.map((c) => [c === "Förfallet" || c === "Senare" ? c : monthLabel(c), "num"])).concat([["Total", "num"]]));
      const colTot = {}; let grand = 0;
      const cell = (xs, cur0) => { if (!xs.length) return h("span", { class: "muted", text: "·" }); const sek = xs.reduce((a, x) => a + x.belopp, 0); const val = xs.reduce((a, x) => a + (x.beloppValuta || 0), 0); const ant = xs.some((x) => x.kalla === "antagande"); const b = h("button", { class: "linkish num", type: "button", title: xs.map((x) => (x.po.nr || x.po._id) + " · " + x.typ + " · " + fmtDate(x.datum) + " · " + fmtSEK(x.belopp)).join("\n"), onclick: () => { if (xs.length === 1) openPo(xs[0].po._id); else openPayList(xs); } }, h("div", { class: "mono", text: fmtTkr(sek) }), cur0 && cur0 !== "SEK" ? h("div", { class: "sub", text: fmtCur(val, cur0) }) : null, ant ? h("div", { class: "sub", text: "assumed" }) : null); return b; };
      for (const lv of levs) {
        const mine = items.filter((x) => x.po.leverantor === lv); const cur0 = mine[0].valuta; const sum = mine.reduce((a, x) => a + x.belopp, 0); grand += sum;
        const tr = h("tr", null, td("", "c-main", h("div", { class: "prod", text: lv }), h("div", { class: "sub", text: (cur0 || "SEK") + " · " + mine.length + " payments" })));
        for (const c of cols) { const xs = mine.filter((x) => colOf(x) === c); colTot[c] = (colTot[c] || 0) + xs.reduce((a, x) => a + x.belopp, 0); tr.append(td("", "num" + (c === "Förfallet" && xs.length ? " late-text" : ""), cell(xs, cur0))); }
        tr.append(td("Total", "num", h("b", { text: fmtTkr(sum) }), cur0 && cur0 !== "SEK" ? h("div", { class: "sub", text: fmtCur(mine.reduce((a, x) => a + (x.beloppValuta || 0), 0), cur0) }) : null));
        tb.append(tr);
      }
      const tot = h("tr", { class: "tot-row" }, td("", "c-main", h("b", { text: "Total SEK" })));
      for (const c of cols) tot.append(td("", "num", h("b", { text: colTot[c] ? fmtTkr(colTot[c]) : "·" })));
      tot.append(td("Total", "num", h("b", { text: fmtTkr(grand) })));
      tb.append(tot);
      box.append(h("div", { class: "ledger-wrap" }, t));
    },
    renderTimelineOld(open) {
      const box = this.timeline; box.replaceChildren();
      const items = open.filter((x) => x.datum);
      const noDate = open.length - items.length;
      box.append(h("div", { class: "card-head" }, h("h3", { text: "Payment schedule per supplier" }), h("span", { class: "sub", text: items.length ? items.length + " upcoming payments · circle size = amount · click for the PO" + (noDate ? " · " + noDate + " without a date (set order date or ex-factory on the PO)" : "") : "No upcoming payments with a date." })));
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
      const el = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "pay-tl", role: "img", "aria-label": "Payment schedule" });
      // month grid
      let cur = start;
      while (cur < end) { const next = addDays(cur.slice(0, 7) + "-01", 32).slice(0, 7) + "-01"; el.append(svg("line", { x1: X(cur), x2: X(cur), y1: top - 6, y2: H, class: "grid" })); el.append(svg("text", { x: X(cur) + 4, y: top - 10, class: "lbl" }, monthLabel(cur.slice(0, 7)))); cur = next; }
      el.append(svg("line", { x1: X(todayISO()), x2: X(todayISO()), y1: top - 6, y2: H, class: "today" }));
      el.append(svg("text", { x: X(todayISO()) + 4, y: H - 2, class: "lbl today-l" }, "today"));
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
          g.append(svg("title", null, (x.po.nr || x.po._id) + " · " + x.typ + " · " + fmtSEK(x.belopp) + (x.valuta !== "SEK" ? " (" + fmtCur(x.beloppValuta, x.valuta) + ")" : "") + " · " + fmtDate(x.datum) + (x.kalla === "antagande" ? " · terms missing, assumed 100 % on delivery" : "")));
          g.append(svg("circle", { cx: X(x.datum), cy: y + (j % 2 ? 4 : -4), r }));
          if (r > 10) g.append(svg("text", { x: X(x.datum), y: y + (j % 2 ? 4 : -4) + 3, class: "amt", "text-anchor": "middle" }, fmtTkr(x.belopp).replace(" tkr", "")));
          g.addEventListener("click", () => openPo(x.po._id));
          el.append(g);
        });
      });
      box.append(h("div", { class: "tl-wrap" }, el), h("div", { class: "tl-legend", style: "padding:0 16px 12px" }, ["EUR", "GBP", "JPY", "SEK"].map((c) => h("span", null, h("i", { class: "dotc cur-" + c }), " " + c)), h("span", null, h("i", { class: "dotc ant" }), " terms missing – assumed on delivery")));
    },
    renderMonths(open) {
      const box = this.months; box.replaceChildren();
      const items = open.filter((x) => x.datum);
      box.append(h("div", { class: "card-head" }, h("h3", { text: "Payments out per month" }), h("span", { class: "sub", text: "Unpaid payments in SEK at today's rate, stacked by currency" })));
      if (!items.length) return;
      const m0 = todayISO().slice(0, 7);
      const months = []; let cur = m0 + "-01"; for (let i = 0; i < 12; i++) { months.push(cur.slice(0, 7)); cur = addDays(cur, 32).slice(0, 7) + "-01"; }
      const past = items.filter((x) => x.datum.slice(0, 7) < m0).reduce((a, x) => a + x.belopp, 0);
      const data = months.map((ym) => { const mine = items.filter((x) => x.datum.slice(0, 7) === ym); const byCur = {}; for (const x of mine) byCur[x.valuta || "SEK"] = (byCur[x.valuta || "SEK"] || 0) + x.belopp; return { ym, byCur, tot: mine.reduce((a, x) => a + x.belopp, 0) }; });
      if (past) data[0].byCur.Förfallet = past, data[0].tot += past;
      const maxV = Math.max(...data.map((d) => d.tot), 1);
      const W = 1000, H = 220, L = 10, B = 30, T = 26, bw = (W - 2 * L) / months.length;
      const el = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "pay-bars", role: "img", "aria-label": "Payments out per month" });
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
      box.append(h("div", { class: "card-head" }, h("h3", { text: "To pay within 120 days" }), h("span", { class: "sub", text: items.length ? fmtTkr(items.reduce((a, x) => a + x.belopp, 0)) + " · tick off when the payment is made" : "Nothing to pay within 120 days." })));
      if (!items.length) return;
      const { t, tb } = table([["Due"], ["PO"], ["Supplier"], ["Share"], ["Amount", "num"], ["In currency", "num"], ["Paid"]]);
      for (const x of items) {
        const d = x.datum ? diffDays(x.datum) : null;
        const cb = h("input", { type: "checkbox", disabled: !canWrite || !db, onchange: async () => {
          if (x.kalla === "manuell") { await write("po", x.po._id, x.idx === "f" ? { forskottBetald: cb.checked } : { slutBetald: cb.checked }); return; }
          const bet = Object.assign({}, x.po.betalningar || {}); bet[x.idx] = { betald: cb.checked, datum: cb.checked ? todayISO() : null, av: myId };
          await write("po", x.po._id, { betalningar: bet, andrad: new Date().toISOString(), logg: (x.po.logg || []).concat(logEntry((cb.checked ? "Paid: " : "Marked unpaid: ") + x.typ + " " + fmtSEK(x.belopp))) });
        } });
        tb.append(h("tr", { tabIndex: 0, dataset: { po: x.po._id } },
          td("Due", "mono", x.datum ? fmtDate(x.datum) : h("span", { class: "flag", text: "date missing" }), d != null ? h("div", { class: "days " + (d < 0 ? "late" : d <= 14 ? "soon" : ""), text: fmtDays(d) }) : null, x.datumKalla ? h("div", { class: "sub", text: x.datumKalla }) : null),
          td("PO", "c-main", h("div", { class: "prod", text: x.po.nr || x.po._id }), h("div", { class: "sub" }, poStatusPill(x.po), " " + [x.po.sasong, x.po.drop].filter(Boolean).join(" "))),
          td("Supplier", null, x.po.leverantor || ""),
          td("Share", null, x.typ, x.kalla === "antagande" ? h("div", { class: "sub", text: "terms missing – assumed" }) : null),
          td("Amount", "num", fmtSEK(x.belopp)),
          td("In currency", "num", x.valuta !== "SEK" ? fmtCur(x.beloppValuta, x.valuta) : "–"),
          td("Paid", null, h("label", { class: "checkline" }, cb, "Paid"))));
      }
      tb.addEventListener("click", (e) => { if (e.target.closest("input, label, button")) return; const tr = e.target.closest("tr[data-po]"); if (tr) openPo(tr.dataset.po); });
      box.append(h("div", { class: "ledger-wrap" }, t));
    }
  };

  // ---------- EAN ----------
  const EanView = {
    mount(root) {
      this.panel = h("section", { class: "panel" });
      const q = searchBox("q_ean", "Search EAN, style, colour, size …", UI.ean, () => this.update());
      this.count = h("span", { class: "count" });
      const { t, tb } = table([["EAN"], ["Style"], ["Colour"], ["Size"], ["Assigned"]]);
      this.tb = tb;
      tb.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-style]"); if (tr) openStyle(tr.dataset.style); });
      this.empty = h("div", { class: "empty", hidden: true });
      this.logList = h("ul", { class: "log" });
      this.adminOpen = false;
      root.append(this.panel, h("section", { class: "filters" }, q, this.count), h("section", { class: "ledger-wrap" }, t, this.empty), h("section", { class: "logsec" }, h("h3", { class: "sec-title", text: "Latest assignments" }), this.logList));
    },
    update() {
      const p = D.pool; const pn = this.panel;
      if (!this.adminOpen) {
        pn.replaceChildren();
        if (!p) pn.append(h("p", { class: "hint", text: loaded.has("pool") ? "The EAN range is not set up." : "Loading the EAN range …" }));
        else {
          const pre = String(p.prefix || "");
          const next = ean13(pre + String(p.nasta).padStart(12 - pre.length, "0"));
          const left = Math.max(0, Number(p.slut) - Number(p.nasta) + 1);
          const assigned = D.styles.reduce((n, s) => n + (s.ean || []).length, 0);
          const kv = (k, v, cls) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v " + (cls || ""), text: v }));
          pn.append(h("div", { class: "kvs" }, kv("Next EAN", next, "mono big"), kv("Left in the range", left.toLocaleString("sv-SE"), "mono big"), kv("Assigned in the app", String(assigned), "mono big"), kv("GS1 prefix", pre, "mono"), kv("Highest in Shopify at the start", p.shopifyHogsta || "–", "mono")));
          if (p.kommentar) pn.append(h("p", { class: "hint", text: p.kommentar }));
          pn.append(h("p", { class: "hint", text: "EAN is assigned from an approved style, one number per colour and size. Let the app be the only place where new numbers are assigned, so there are never duplicates." }));
          if (canAdmin && canWrite) pn.append(h("div", { class: "admin-row" }, h("button", { class: "btn small", type: "button", text: "Change next serial number", onclick: () => this.openAdmin() })));
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
        td("Colour", null, r.e.farg), td("Size", null, r.e.storlek),
        td("Assigned", "mono", r.e.t ? fmtDate(String(r.e.t).slice(0, 10)) : ""))));
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(h("strong", { text: rows.length ? "Nothing matches the search" : "No EAN assigned yet" }), h("span", { text: rows.length ? "Clear the search." : "Approve a style, fill in colours and sizes and press \"Assign EAN\"." }));
      this.count.textContent = list.length + " EAN";
      renderLogInto(this.logList, D.logg.slice().reverse().map((l) => ({ t: l.t, av: l.av, text: l.antal + " EAN for " + (l.styleNamn || l.styleId) + " (" + l.forsta + (l.antal > 1 ? "–" + l.sista : "") + ")" + (l.sparad === false ? ", not saved on the style" : "") })));
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
        if (n == null || n < 0 || n > Number(p.slut) || Math.floor(n) !== n) { toast("Enter a whole number between 0 and " + p.slut + "."); return; }
        try {
          const ref = db.doc("ean/pool");
          const lease = await ref.acquire({ holder: myId || "admin", ttlMs: 5000 });
          if (!lease.acquired) { toast("Someone is assigning EAN right now. Try again in a few seconds."); return; }
          await ref.update({ nasta: n, andrad: new Date().toISOString() });
          toast("The next serial number is now " + n); close();
        } catch (e) { writeError(e); }
      };
      pn.replaceChildren(h("h3", { class: "sec-title", text: "Change next serial number" }),
        h("p", { class: "hint", text: "The serial number is the four digits after the prefix. Never set a lower number than one already used in Shopify or with suppliers, or there will be duplicates." }),
        h("div", { class: "admin-row" }, i, preview, h("span", { class: "spacer" }), h("button", { class: "btn small", type: "button", text: "Cancel", onclick: close }), h("button", { class: "btn small primary", type: "button", text: "Save", onclick: save })));
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
        if (!(st.storlekar || []).length) saknar.push("sizes");
        else if (vs.length < st.storlekar.length) saknar.push("EAN");
        if (!sh.produkttyp) saknar.push("product type");
        if (!sh.storlekssystem) saknar.push("size system");
        else if (sys && (st.storlekar || []).some((s) => sys[s] == null)) saknar.push("size code");
        if (!(sh.rrp_sek > 0)) saknar.push("RRP");
        if (!sh.hs_kod) saknar.push("HS code");
        if (!lev || !lev.land) saknar.push("country of origin");
        if (!sh.description_en) saknar.push("description");
        if (!sh.sammansattning) saknar.push("material");
        if (!sh.tvattrad) saknar.push("care instructions");
        const varnar = [];
        if (!sh.size_chart) varnar.push("size table");
        if (!fr.swatch) varnar.push("swatch");
        if (!fr.colour_family) varnar.push("colour family");
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
        { key: "redo", label: "Ready to push" },
        { key: "saknar", label: "Missing data", cls: "t-warn" },
        { key: "utkast", label: "Draft in Shopify" },
        { key: "aktiva", label: "Active in Shopify" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_shopify", "Search style, colour, supplier …", st, () => this.update());
      this.fLev = filterSelect("f_sh_lev", "All suppliers", st, "lev", upd);
      this.fSeason = filterSelect("f_sh_season", "All seasons", st, "season", upd);
      this.seg = makeSeg([["ej", "Not in Shopify"], ["i", "In Shopify"], ["alla", "All"]], st, "status", upd);
      const allaBox = h("label", { class: "chk" }, h("input", { type: "checkbox", checked: !!st.alla, onchange: (e) => { st.alla = e.target.checked; upd(); } }), " Also show approved styles without a PO");
      this.count = h("span", { class: "count" });
      this.selCount = h("span");
      this.tray = h("div", { class: "tray", hidden: true }, this.selCount,
        h("button", { class: "btn small primary", type: "button", text: "Create draft in Shopify", onclick: () => this.pushSelected() }),
        h("button", { class: "btn small", type: "button", text: "Clear selection", onclick: () => { shopSel.clear(); this.update(); } }));
      const { t, tb } = table([["", "c-check"], ["Style"], ["Colour"], ["Supplier"], ["Season"], ["PO"], ["Data"], ["Shopify"]]);
      this.tb = tb;
      this.allBox = h("input", { type: "checkbox", "aria-label": "Select all ready", onchange: () => { (this.visible || []).filter((r) => !r.pushed && !r.saknar.length).forEach((r) => (this.allBox.checked ? shopSel.add(r.key) : shopSel.delete(r.key))); this.update(); } });
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
        const box = h("input", { type: "checkbox", "aria-label": "Select " + r.st.namn + " " + r.farg, checked: shopSel.has(r.key), disabled: r.pushed || r.saknar.length > 0, onchange: () => { if (box.checked) shopSel.add(r.key); else shopSel.delete(r.key); ShopifyView.update(); } });
        const status = r.pushed
          ? h("a", { class: "chip " + (r.fr.shopify_status === "ACTIVE" ? "b-godkand" : "b-ny-runda"), href: "https://admin.shopify.com/store/atemporubato/products/" + r.fr.shopify_product_id, target: "_blank", rel: "noopener", text: (r.fr.shopify_status === "ACTIVE" ? "Active" : "Utkast") + " · " + (r.fr.shopify_handle || "") })
          : chip("Not in Shopify");
        return h("tr", { tabIndex: 0, dataset: { style: r.st._id } },
          h("td", { class: "c-check" }, box),
          td("Style", "c-main", h("div", { class: "prod", text: r.st.namn }), h("div", { class: "sub", text: r.st._id + " · " + (r.st.status || "") })),
          td("Colour", null, r.fr.swatch ? h("span", { class: "sh-swatch", style: "background:" + r.fr.swatch }) : null, r.farg),
          td("Supplier", null, r.st.leverantor || ""),
          td("Season", null, [r.st.sasong, r.st.drop].filter(Boolean).join(" · ")),
          td("PO", null, r.pos.length ? h("div", { class: "sub" }, uniq(r.pos.map((p) => p.nr || p._id)).map((id) => tag(id))) : h("span", { class: "sub", text: "No PO" })),
          td("Data", null, r.saknar.length ? h("span", { class: "flag bad", text: "Missing " + r.saknar.join(", ") }) : r.varnar.length ? h("span", { class: "flag", text: "Ready · without " + r.varnar.join(", ") }) : h("span", { class: "flag eval", text: "Ready" })),
          td("Shopify", null, status));
      }));
      this.empty.hidden = list.length > 0;
      if (!list.length) this.empty.replaceChildren(h("strong", { text: all.length ? "Nothing matches" : "Nothing to push yet" }), h("span", { text: all.length ? "Change filter or search." : "Colourways appear here once a style is on a PO and has colours filled in." }));
      this.count.textContent = list.length + " of " + all.length;
      this.selCount.textContent = shopSel.size + (shopSel.size === 1 ? " selected" : " selected");
      this.tray.hidden = shopSel.size === 0 || !canWrite;
      this.allBox.checked = list.length > 0 && list.filter((r) => !r.pushed && !r.saknar.length).every((r) => shopSel.has(r.key));
    },
    async pushSelected() {
      const keys = [...shopSel];
      if (!keys.length) return;
      const { data: { session } } = await P.supabase.auth.getSession();
      const ul = h("ul", { class: "log" });
      this.result.replaceChildren(h("h4", { class: "sec-title", text: "Pushing " + keys.length + " colourways to Shopify (draft)" }), ul);
      let ok = 0;
      for (const key of keys) {
        const [style_id, farg] = key.split("|");
        const st = byId(D.styles, style_id);
        const li = h("li", null, h("time", { text: (st ? st.namn : style_id) + " · " + farg }), h("div", { text: "Sending …" }));
        ul.append(li);
        try {
          const res = await fetch("/api/shopify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session ? session.access_token : "") }, body: JSON.stringify({ action: "create", style_id, farg }) });
          const j = await res.json();
          if (j.admin_url) { ok++; li.lastChild.replaceChildren(h("span", { class: "okline", text: "Created as draft. " }), h("a", { href: j.admin_url, target: "_blank", rel: "noopener", text: "Open in Shopify" })); shopSel.delete(key); }
          else li.lastChild.replaceChildren(h("span", { class: "late-text", text: (j.error || "Error") + (j.errors && j.errors.length ? ": " + j.errors.join(" ") : "") }));
        } catch (e) { li.lastChild.replaceChildren(h("span", { class: "late-text", text: "Network error: " + e.message })); }
      }
      toast(ok + " of " + keys.length + " created in Shopify");
      this.update();
    }
  };

  // ---------- FLAGGA: direktmejl (bara hostad) ----------
  // Appen sparar flaggan själv; servern skickar mejlet till dem som valts. Går mejlet inte att skicka kommer flaggan med i mejlet kl. 10.
  async function hostedNotifyFlag(id) {
    const { data: { session } } = await P.supabase.auth.getSession();
    const res = await fetch("/api/flagga", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session ? session.access_token : "") }, body: JSON.stringify({ id }) });
    if (!res.ok) return null;
    return res.json();
  }
  // Redo att beställa: direktmejl till Elliot när en style blir godkänd. Servern skickar högst ett mejl per style.
  async function hostedNotifyReady(id) {
    const { data: { session } } = await P.supabase.auth.getSession();
    const res = await fetch("/api/redo", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session ? session.access_token : "") }, body: JSON.stringify({ id }) });
    if (!res.ok) return null;
    return res.json();
  }

  // @-taggning i kommentarer: direktmejl till dem som taggats. Servern läser loggraden själv och skickar högst en gång per kommentar.
  async function hostedNotifyMention(coll, id, t) {
    const { data: { session } } = await P.supabase.auth.getSession();
    const res = await fetch("/api/omnamn", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session ? session.access_token : "") }, body: JSON.stringify({ coll, id, t }) });
    if (!res.ok) { let info = "HTTP " + res.status; try { info = (await res.json()).error || info; } catch (e) {} return { skickat: 0, info }; }
    return res.json();
  }
  // ---------- SHOPIFY-BILD: hämtas direkt, annars via servern (bara hostad) ----------
  // Webbläsaren får inte alltid läsa bilder från Shopify (CORS), och en produktsida är ingen bild. Då hämtar /api/bild den i stället.
  async function hostedBild(url) {
    try {
      const resp = await fetch(url, { mode: "cors" });
      if (resp.ok) { const b = await resp.blob(); if (/^image\//.test(b.type)) return b; }
    } catch (e) {}
    const { data: { session } } = await P.supabase.auth.getSession();
    const res = await fetch("/api/bild", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session ? session.access_token : "") }, body: JSON.stringify({ url }) });
    if (!res.ok) { let msg = "HTTP " + res.status; try { msg = (await res.json()).error || msg; } catch (e) {} throw new Error(msg); }
    return res.blob();
  }
  // Regel: NOOS och restock finns redan i butiken. Saknar en sådan style bild letas produktbilden upp i Shopify automatiskt
  // när appen laddas, och hämtas in. Bara säkra träffar (samma produktnamn) – annars lämnas stylen orörd. Varje style provas
  // högst en gång i veckan per webbläsare.
  let autoShopifyKor = false;
  async function hostedAutoShopify() {
    if (autoShopifyKor || !canWrite || !db || !assets || designOnly() || ME.leverantor) return;
    let provat = {}; try { provat = JSON.parse(localStorage.getItem("plmAutoShopify4") || "{}"); } catch (e) {}
    const nu = Date.now(), vecka = 7 * 864e5;
    // Utan bild, eller flera färger där den enda bilden är en automatisk (Shopify-kopia eller färgöversikt) – då hämtas en bild per färg.
    const tom = (s) => !s.shopifyBild && !s.bildId && !docImages(s).length;
    const baraAuto = (s) => (s.farger || []).length > 1 && !s.fargBilder && docImages(s).length <= 1 && (!!s.bildAuto || !!s.shopifyBild);
    // Färgbilder hämtade tidigare men inte för alla färger (t.ex. Lot 1 där en färg heter något annat i butiken): prova igen.
    const ofull = (s) => !!s.bildAuto && !!s.fargBilder && Object.keys(s.fargBilder).length < (s.farger || []).length && docImages(s).length === Object.keys(s.fargBilder).length;
    // Gäller alla styles som finns i butiken, även historiska (arkiverade) produkter. För nyheter krävs att namnet stämmer exakt.
    const gammal = (s) => ["NOOS", "Restock"].includes(s.typ);
    const todo = D.styles.filter((s) => s.namn && !["Kastad"].includes(styleStatusNorm(s.status)) && (tom(s) || (gammal(s) && (baraAuto(s) || ofull(s)))) && !(provat[s._id] && nu - provat[s._id] < vecka)).slice(0, 40);
    if (!todo.length) return;
    autoShopifyKor = true;
    let hits = 0, antal = 0;
    try {
      const { data: { session } } = await P.supabase.auth.getSession();
      for (const s of todo) {
        provat[s._id] = nu;
        try {
          const res = await fetch("/api/bild", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session ? session.access_token : "") }, body: JSON.stringify({ sok: s.namn, farger: s.farger || [] }) });
          if (!res.ok) { delete provat[s._id]; continue; }
          const svar = await res.json();
          const hit = svar.hit;
          const cur = byId(D.styles, s._id) || s;
          if (!(tom(cur) || baraAuto(cur) || ofull(cur))) continue;
          // En bild per färg (t.ex. Lot 2 i Indigo, Black, Ecru): alla hämtas in, första blir huvudbild och övriga visas som miniatyrer.
          const per = (Array.isArray(svar.perFarg) ? svar.perFarg.slice(0, 8) : []).filter((x) => gammal(s) || x.exakt);
          if (!tom(cur) && per.length < 2) continue;
          if (ofull(cur) && per.length <= Object.keys(cur.fargBilder).length) continue;
          if (per.length > 1 || (per.length === 1 && !hit)) {
            const ids = [], fargBilder = {};
            for (const x of per) {
              try {
                const u = new URL(x.url); u.searchParams.set("width", "1200");
                const blob = await hostedBild(u.toString());
                const small = await shrinkImage(new File([blob], "shopify.jpg", { type: blob.type || "image/jpeg" }), 1600);
                if (!small) continue;
                const r = await assets.upload(small, small.type ? undefined : { type: "image/jpeg" });
                ids.push(r.id); fargBilder[x.farg] = r.id;
              } catch (e) {}
            }
            if (ids.length && await write("styles", s._id, { bilder: ids, bildId: ids[0], bildAuto: true, fargBilder, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry("Shopify images fetched automatically: " + per.map((x) => x.titel).join(", "))) })) antal += ids.length;
            continue;
          }
          if (!hit || !hit.url || !(gammal(s) || hit.exakt)) continue;
          if (await write("styles", s._id, { shopifyBild: { url: hit.url, titel: hit.titel, handle: hit.handle, likhet: "samma", auto: true }, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry("Shopify image linked automatically: " + hit.titel)) })) { Object.assign(cur, { shopifyBild: { url: hit.url, titel: hit.titel, handle: hit.handle, likhet: "samma", auto: true } }); hits++; }
        } catch (e) { delete provat[s._id]; }
      }
      try { localStorage.setItem("plmAutoShopify4", JSON.stringify(provat)); } catch (e) {}
      if (antal) toast(antal + " " + "Shopify images fetched");
      if (hits) await importShopifyImages();
    } finally { autoShopifyKor = false; }
  }
  // Måttreferens från butiken: alla produkter som har en måttabell i Shopify, även arkiverade och utkast (t.ex. Mercer Jacket).
  // Väljer man en fylls stylens måttlista i med tabellen.
  let butikMatt = null;
  const hamtaButikMatt = () => butikMatt || (butikMatt = (async () => {
    const { data: { session } } = await P.supabase.auth.getSession();
    const res = await fetch("/api/matt", { headers: { Authorization: "Bearer " + (session ? session.access_token : "") } });
    if (!res.ok) { butikMatt = null; throw new Error("HTTP " + res.status); }
    return (await res.json()).tabeller || [];
  })());
  function hostedMattField(fMatt, fMattFran) {
    const dl = h("datalist", { id: "dlButikMatt" });
    const f = inp("f_smattbutik", "", { list: "dlButikMatt", autocomplete: "off", placeholder: "Search product, e.g. Mercer Jacket" });
    let tabeller = [];
    const ladda = async () => { if (tabeller.length) return; try { tabeller = await hamtaButikMatt(); dl.replaceChildren(...tabeller.map((x) => h("option", { value: x.namn }))); } catch (e) { toast("Could not fetch the size charts from Shopify"); } };
    f.addEventListener("focus", ladda);
    f.addEventListener("change", async () => {
      await ladda();
      const x = tabeller.find((y) => norm(y.namn) === norm(f.value)); if (!x) return;
      const text = "Measurements from the shop: " + x.namn + " (cm)\n" + x.rader.map((r) => r[0] + ": " + r.slice(1).map((v, i) => (x.kolumner[i] ? x.kolumner[i] + " " : "") + v).join(" · ")).join("\n");
      fMatt.value = fMatt.value.trim() ? fMatt.value.trim() + "\n\n" + text : text;
      fMatt.dispatchEvent(new Event("input", { bubbles: true }));
      fMattFran.value = ""; f.value = "";
      toast("Measurement list filled in from " + x.namn);
    });
    return h("div", { class: "field full" }, h("label", { for: "f_smattbutik", text: "Measurements from the shop" }), f, dl, h("span", { class: "hint", text: "Every product with a size chart in Shopify, including historical ones. Pick one and the measurement list is filled in." }));
  }
  // ---------- COO: matrisvy (hosted-only) ----------
  // Kritisk linje per drop och per event. Rader = föräldrar (hor_till tom, matris satt), kolumner = mallens faser
  // (installningar "planeringsmallar"), celler = barnen (hor_till = förälderns id, fas = kolumnens fas).
  // Elliots COO-vy ligger orörd som läget "Lista".
  const MX_SECTIONS = [["drop", "Drops", "New drop"], ["pr", "PR events", "New PR event"], ["in_residence", "In Residence", "New In Residence"], ["massa", "Fairs", "New fair"], ["invigning", "Premises", "New opening"]];
  const MX_PARENT_FAS = { drop: "lansering" };
  const MX_DROP_LABELS = ["Drop 1", "Drop 2", "Drop 3", "RYC", "Tailoring", "Coats"];
  const mxStore = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const MXS = Object.assign({ vy: "matris", sasong: "", ansvarig: "", tbd: true }, mxStore.get("plm-coo-matris", {}));
  const mxSave = () => mxStore.set("plm-coo-matris", { vy: MXS.vy, sasong: MXS.sasong, ansvarig: MXS.ansvarig, tbd: MXS.tbd });
  const mxOpenKey = () => "plm-coo-open-" + (myId || "anon");
  let mxOpen = null;
  const mxIsOpen = (id) => { if (!mxOpen) mxOpen = new Set(mxStore.get(mxOpenKey(), [])); return mxOpen.has(id); };
  const mxToggle = (id) => { mxIsOpen(id); if (mxOpen.has(id)) mxOpen.delete(id); else mxOpen.add(id); mxStore.set(mxOpenKey(), [...mxOpen]); };
  const mxMallar = () => (D.settings && D.settings.planeringsmallar) || {};
  const mxParentFas = (matris) => MX_PARENT_FAS[matris] || "event";
  const mxLedtid = (o) => { o = Number(o) || 0; if (o === 0) return "day 0"; const a = Math.abs(o); const t = a % 7 === 0 ? a / 7 + " v" : a + " d"; return t + (o < 0 ? " before" : " after"); };
  const mxShort = (iso) => { if (!isISO(iso)) return ""; const [, m, d] = iso.split("-").map(Number); return d + " " + MONTHS[m - 1]; };
  const mxIsTbd = (e) => /^TBD\s/i.test(e.titel || "");
  const mxState = (e) => (e.status === "Inställd" ? "installd" : e.status === "Klar" ? "klar" : isISO(e.datum) && e.datum < todayISO() ? "sen" : e.status === "Pågår" ? "pagar" : "planned");
  const MX_STATE_LABEL = { planerad: "Planerad", pagar: "Pågår", klar: "Klar", sen: "Late", installd: "Inställd" };
  const mxHasPerson = (e, name) => !name || norm(e.ansvarig || e.agare || "").split(/\s*,\s*|\s+och\s+/).includes(norm(name));
  const mxStripTbd = (t) => String(t || "").replace(/^TBD\s+/i, "");
  const mxFirstName = (a) => String(a || "").split(/\s*,\s*/)[0] || "";

  function mxModel() {
    const all = D.handelser;
    const parents = all.filter((e) => e.matris && !e.hor_till);
    const kids = new Map();
    for (const e of all) if (e.hor_till) (kids.get(e.hor_till) || kids.set(e.hor_till, []).get(e.hor_till)).push(e);
    // Krock: två eller fler händelser i matriserna samma dag, oavsett rad
    const perDay = new Map();
    for (const e of all) if (e.matris && isISO(e.datum) && e.status !== "Inställd") perDay.set(e.datum, (perDay.get(e.datum) || 0) + 1);
    return { parents, kids, krock: (e) => e.status !== "Inställd" && (perDay.get(e.datum) || 0) > 1 };
  }

  function mxCell(e, krock, dim) {
    const s = mxState(e);
    return h("button", { "data-id": e._id, class: "mx-cell" + (krock(e) ? " krock" : "") + (dim ? " dim" : "") + (s === "installd" ? " installd" : ""), type: "button", title: e.titel + " · " + MX_STATE_LABEL[s] + (krock(e) ? " · more events the same day" : ""), onclick: () => openEvent(e._id) },
      h("span", { class: "mx-date" }, h("i", { class: "mx-dot " + s }), mxShort(e.datum) + (e.slut && e.slut !== e.datum ? "–" + mxShort(e.slut) : "")),
      h("span", { class: "mx-who", text: e.ansvarig || e.agare || "" }));
  }

  async function mxNextId() {
    const id = await freshId("handelser", D.handelser, "H", 3);
    return id;
  }
  async function mxCreate(id, body) {
    if (!(await create("handelser", id, body))) return false;
    if (!byId(D.handelser, id)) D.handelser.push(Object.assign({}, body, { _id: id }));
    return true;
  }
  function mxChildBody(p, row, matris, etikett) {
    const datum = addDays(p.datum, Number(row.offset_dagar) || 0);
    return {
      titel: "TBD " + row.namn + (etikett ? " " + etikett : ""), typ: p.typ || "drop", datum, slut: datum,
      sasong: p.sasong || "", drop: p.drop || "", agare: mxFirstName(row.ansvarig) || p.agare || "", ansvarig: row.ansvarig || "",
      bana: row.bana || "", status: "Planerad", kommentar: "", poId: null, styleId: null,
      hor_till: p._id || p.id, fas: row.fas, offset_dagar: Number(row.offset_dagar) || 0, matris
    };
  }
  async function mxAddChild(p, row) {
    if (!canWrite || !db) return;
    const id = await mxNextId();
    const etikett = p.matris === "drop" ? p.drop || mxStripTbd(p.titel) : mxStripTbd(p.titel);
    const body = Object.assign({ id, logg: [logEntry("Created from the template (" + row.namn + ", " + mxLedtid(row.offset_dagar) + ")")], andrad: new Date().toISOString() }, mxChildBody(p, row, p.matris, etikett));
    if (await mxCreate(id, body)) { toast(id + " created"); scheduleRefresh(); }
  }

  function mxNewFromTemplate(matris, label) {
    const mall = mxMallar()[matris] || [];
    if (!mall.length) { toast("The template \"" + matris + "\" is missing in the settings."); return; }
    const isDrop = matris === "drop";
    const pfas = mxParentFas(matris);
    const prow = mall.find((r) => r.fas === pfas) || { fas: pfas, ansvarig: "Jakob", bana: "" };
    const fNamn = inp("f_mxnamn", "", { placeholder: isDrop ? "e.g. SS27 Drop 3" : "e.g. London PR Drop 3" });
    const fSas = seasonSelect("f_mxsas", MXS.sasong || "");
    const fDropSel = selectEl("f_mxdrop", [["", isDrop ? "Choose …" : "– none –"]].concat(MX_DROP_LABELS.map((x) => [x, x])).concat([["__annat", "Other …"]]), "");
    const fDropAnnat = inp("f_mxdropannat", "", { placeholder: "Own label" }); fDropAnnat.hidden = true;
    fDropSel.addEventListener("change", () => { fDropAnnat.hidden = fDropSel.value !== "__annat"; });
    const fDatum = inp("f_mxdatum", "", { type: "date" });
    const fSlut = inp("f_mxslut", "", { type: "date" });
    const preview = h("ul", { class: "mx-preview" });
    const renderPreview = () => {
      const d = fDatum.value;
      preview.replaceChildren(...mall.map((r) => h("li", null, h("span", { class: "mono", text: isISO(d) ? fmtDate(addDays(d, Number(r.offset_dagar) || 0)) : "–" }), " ", r.namn, h("span", { class: "sub", text: " · " + (r.ansvarig || "") + " · " + mxLedtid(r.offset_dagar) }))));
    };
    fDatum.addEventListener("input", renderPreview); renderPreview();
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (ev) => ev.preventDefault() },
      field("Name", fNamn, { full: true }), field("Season", fSas),
      field(isDrop ? "Drop label" : "Drop (optional)", h("div", { style: "display:grid;gap:6px" }, fDropSel, fDropAnnat)),
      field(isDrop ? "Launch date" : "Date", fDatum), isDrop ? h("div") : field("End (if several days)", fSlut));
    async function save(btn) {
      const etikett = fDropSel.value === "__annat" ? fDropAnnat.value.trim() : fDropSel.value;
      const namn = fNamn.value.trim();
      if (!namn) { toast("Give it a name."); fNamn.focus(); return; }
      if (!isISO(fDatum.value)) { toast("Set a date."); fDatum.focus(); return; }
      if (isDrop && !etikett) { toast("Choose a drop label."); fDropSel.focus(); return; }
      if (btn) btn.disabled = true;
      try {
        const now = new Date().toISOString();
        const pid = await mxNextId();
        const datum = fDatum.value;
        const slut = !isDrop && isISO(fSlut.value) && fSlut.value >= datum ? fSlut.value : datum;
        const parent = { id: pid, titel: namn, typ: isDrop ? "drop" : (matris === "invigning" ? "lokaler" : "massor"), datum, slut, sasong: fSas.value.trim(), drop: etikett, agare: mxFirstName(prow.ansvarig) || "Jakob", ansvarig: prow.ansvarig || "Jakob", bana: prow.bana || "", status: "Planerad", kommentar: "", poId: null, styleId: null, hor_till: null, fas: pfas, offset_dagar: 0, matris, logg: [logEntry("Created from the template " + label)], andrad: now };
        if (!(await mxCreate(pid, parent))) return;
        const p = Object.assign({}, parent, { _id: pid });
        let n = 1;
        for (const row of mall) {
          if (row.fas === pfas) continue;
          const id = await mxNextId();
          const body = Object.assign({ id, logg: [logEntry("Created from the template " + label + " (" + mxLedtid(row.offset_dagar) + ")")], andrad: now }, mxChildBody(p, row, matris, isDrop ? etikett : mxStripTbd(namn)));
          if (await mxCreate(id, body)) n++;
        }
        toast(n + " events created (" + pid + ")");
        mxIsOpen(pid);
        closeSheet(); scheduleRefresh();
      } finally { if (btn) btn.disabled = false; }
    }
    const saveBtn = h("button", { class: "btn primary", type: "button", text: "Create from the template", onclick: (ev) => save(ev.target) });
    openSheet({ tag: "New", title: label, sub: mall.length + " events per the template", body: [form, h("section", null, h("h3", { class: "sec-title", text: "The template" }), preview)], foot: [h("button", { class: "btn", type: "button", text: "Cancel", onclick: closeSheet }), saveBtn], focus: "f_mxnamn" });
  }

  function mxPoPanel(p) {
    const pos = D.po.filter((po) => norm(po.sasong) === norm(p.sasong) && p.drop && (po._drops && po._drops.length ? po._drops : [po.drop]).some((n) => norm(n) === norm(p.drop)));
    if (!p.drop) return h("p", { class: "sub", text: "No drop label on the launch, so no POs can be matched." });
    if (!pos.length) return h("p", { class: "sub", text: "No POs with season " + (p.sasong || "–") + " and drop " + p.drop + "." });
    const t = h("table", { class: "ledger mx-po" });
    t.append(h("thead", null, h("tr", null, ...["PO", "Supplier", "Status", "Requested delivery", "Planned ex", "ETA warehouse", "Fotosample"].map((x) => h("th", { text: x })))));
    const tb = h("tbody");
    for (const po of pos.sort((a, b) => String(a.nr || a._id).localeCompare(String(b.nr || b._id), "sv"))) {
      const eta = typeof poEta === "function" ? poEta(po) : po.etaLager;
      tb.append(h("tr", { class: "mx-po-row" },
        h("td", null, h("button", { class: "linklike", type: "button", text: po.nr || po._id, onclick: () => { closeSheet(); switchTab("produktion"); openPo(po._id); } })),
        h("td", { text: po.leverantor || "" }), h("td", null, h("span", { class: "chip", text: poStatusNorm(po.status) || "" })),
        h("td", { class: "mono", text: fmtDate(po.leveransOnskad) }), h("td", { class: "mono", text: fmtDate(po.planeradEx) || (isISO(po.bekraftadEx) ? "conf. " + fmtDate(po.bekraftadEx) : "") }),
        h("td", { class: "mono", text: fmtDate(eta) }), h("td", { text: po.fotosample || "" })));
      const rader = (po.rader || []).filter((r) => r.produkt || r.styleId);
      if (rader.length) {
        const list = h("div", { class: "mx-prod" }, ...rader.map((r) => {
          const st = r.styleId ? byId(D.styles, r.styleId) : null;
          const ps = r.perStorlek ? Object.values(r.perStorlek).reduce((a, x) => a + (num(x) || 0), 0) : 0;
          const antal = ps || num(r.antal) || 0;
          return h("span", { class: "mx-prod-item" }, h("span", { text: (st && st.namn) || r.produkt || r.styleId }), h("span", { class: "sub", text: " · " + (fargText(r.farg) || r.farg || "TBA") + " · " + antal + " pcs" }));
        }));
        tb.append(h("tr", { class: "mx-po-prod" }, h("td", { colspan: "7" }, list)));
      }
    }
    t.append(tb);
    return h("div", { class: "ledger-wrap" }, t);
  }

  function mxDetail(p, kids, cols) {
    const logUl = h("ul", { class: "log" });
    renderLogInto(logUl, p.logg);
    const others = kids.filter((k) => !cols.includes(k.fas));
    return h("div", { class: "mx-detail" },
      p.matris === "drop" ? h("section", null, h("h3", { class: "sec-title", text: "POs and products · " + [p.sasong, p.drop].filter(Boolean).join(" ") }), mxPoPanel(p)) : null,
      others.length ? h("section", null, h("h3", { class: "sec-title", text: "Outside the template" }), h("div", { class: "mx-others" }, ...others.map((k) => h("button", { class: "btn small", type: "button", text: k.titel + " · " + mxShort(k.datum), onclick: () => openEvent(k._id) })))) : null,
      h("section", null, h("h3", { class: "sec-title", text: "Comment" }), p.kommentar ? h("p", { class: "mx-kom", text: p.kommentar }) : h("p", { class: "sub", text: "No comment." })),
      h("section", null, h("h3", { class: "sec-title", text: "History" }), logUl));
  }

  function mxMatrix(matris, label, newLabel, model) {
    const mall = mxMallar()[matris] || [];
    const pfas = mxParentFas(matris);
    const cols = mall.map((r) => r.fas);
    let rows = model.parents.filter((p) => p.matris === matris);
    if (MXS.sasong) rows = rows.filter((p) => norm(p.sasong) === norm(MXS.sasong));
    if (!MXS.tbd) rows = rows.filter((p) => !mxIsTbd(p));
    if (MXS.ansvarig) rows = rows.filter((p) => mxHasPerson(p, MXS.ansvarig) || (model.kids.get(p._id) || []).some((k) => mxHasPerson(k, MXS.ansvarig)));
    rows.sort((a, b) => String(a.datum || "").localeCompare(String(b.datum || "")));
    const ro = !canWrite || !db;
    const head = h("div", { class: "mx-head" }, h("h3", { class: "sec-title", text: label + " · " + rows.length }), ro ? null : h("button", { class: "btn small", type: "button", text: newLabel, onclick: () => mxNewFromTemplate(matris, newLabel) }));
    if (!mall.length) return h("section", { class: "mx-sec" }, head, h("p", { class: "sub", text: "The template is missing in the settings (planeringsmallar." + matris + ")." }));
    const t = h("table", { class: "mx" });
    t.append(h("thead", null, h("tr", null, h("th", { class: "mx-rowh", text: matris === "drop" ? "Drop" : "Event" }), ...mall.map((r) => h("th", { class: r.fas === pfas ? "mx-parentcol" : null }, h("span", { text: r.namn }), h("span", { class: "sub", text: mxLedtid(r.offset_dagar) }))))));
    const tb = h("tbody");
    if (!rows.length) tb.append(h("tr", null, h("td", { colspan: String(cols.length + 1), class: "sub", text: "Nothing to show with the chosen filters." })));
    for (const p of rows) {
      const kids = model.kids.get(p._id) || [];
      const open = mxIsOpen(p._id);
      const tbd = mxIsTbd(p);
      const tr = h("tr", { class: "mx-row" + (tbd ? " tbd" : "") + (open ? " open" : "") });
      tr.append(h("th", { class: "mx-rowh", scope: "row" },
        h("button", { class: "mx-name", type: "button", "aria-expanded": String(open), onclick: () => { mxToggle(p._id); MatrisView.update(); } }, h("span", { class: "mx-caret", text: open ? "▾" : "▸" }), h("span", { text: p.titel })),
        h("span", { class: "sub", text: [mxShort(p.datum), p.sasong, p.drop, matris === "drop" && dropOf({ sasong: p.sasong, drop: p.drop }) && isISO(dropOf({ sasong: p.sasong, drop: p.drop }).klartSenast) ? "in stock by " + mxShort(dropOf({ sasong: p.sasong, drop: p.drop }).klartSenast) : ""].filter(Boolean).join(" · ") })));
      for (const r of mall) {
        const td = h("td");
        if (r.fas === pfas) td.append(mxCell(p, model.krock, MXS.ansvarig && !mxHasPerson(p, MXS.ansvarig)));
        else {
          const ks = kids.filter((k) => k.fas === r.fas).sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
          if (ks.length) ks.forEach((k) => td.append(mxCell(k, model.krock, MXS.ansvarig && !mxHasPerson(k, MXS.ansvarig))));
          else if (!ro) td.append(h("button", { class: "mx-add", type: "button", title: "Create \"" + r.namn + "\" from the template (" + mxLedtid(r.offset_dagar) + ")", text: "+", onclick: () => mxAddChild(p, r) }));
        }
        tr.append(td);
      }
      tb.append(tr);
      if (open) tb.append(h("tr", { class: "mx-open" }, h("td", { colspan: String(cols.length + 1) }, mxDetail(p, kids, cols))));
    }
    t.append(tb);
    return h("section", { class: "mx-sec" }, head, h("div", { class: "mx-wrap" }, t));
  }

  function mxWeek() {
    const who = MXS.ansvarig || myName;
    const from = todayISO(), to = addDays(from, 7);
    const xs = D.handelser.filter((e) => isISO(e.datum) && e.datum <= to && (e.datum >= from || (e.status !== "Klar" && e.status !== "Inställd")) && e.status !== "Klar" && e.status !== "Inställd" && (!who || mxHasPerson(e, who)))
      .sort((a, b) => a.datum.localeCompare(b.datum));
    return h("section", { class: "mx-week" },
      h("h3", { class: "sec-title", text: "My week" + (who ? " · " + who : "") }),
      xs.length ? h("ul", null, ...xs.map((e) => h("li", null, h("button", { class: "linklike", type: "button", onclick: () => openEvent(e._id) }, h("i", { class: "mx-dot " + mxState(e) }), h("span", { class: "mono", text: mxShort(e.datum) }), " ", e.titel))))
        : h("p", { class: "sub", text: "Nothing for " + (who || "anyone") + " in the coming 7 days." }));
  }

  const MatrisView = {
    mount(root) {
      this.root = root;
      this.bar = h("section", { class: "filters mx-bar", "aria-label": "Filter" });
      this.body = h("div", { class: "mx-body" });
      root.append(this.bar, this.body);
    },
    update() {
      const model = mxModel();
      const seasons = uniq(D.handelser.map((e) => e.sasong).filter(Boolean)).sort();
      const people = uniq(D.handelser.flatMap((e) => String(e.ansvarig || "").split(/\s*,\s*/)).filter(Boolean)).sort((a, b) => a.localeCompare(b, "sv"));
      const sSel = selectEl("f_mxsas_f", [["", "All seasons"]].concat(seasons.map((x) => [x, x])), MXS.sasong);
      sSel.addEventListener("change", () => { MXS.sasong = sSel.value; mxSave(); this.update(); });
      const aSel = selectEl("f_mxansv_f", [["", "All responsible"]].concat(people.map((x) => [x, x])), MXS.ansvarig);
      aSel.addEventListener("change", () => { MXS.ansvarig = aSel.value; mxSave(); this.update(); });
      const tbdBox = h("input", { type: "checkbox", checked: MXS.tbd, onchange: () => { MXS.tbd = tbdBox.checked; mxSave(); this.update(); } });
      const tbd = h("label", { class: "checkline" }, tbdBox, "Show TBD");
      const legend = h("span", { class: "mx-legend" }, ...["planned", "pagar", "klar", "sen"].map((s) => h("span", null, h("i", { class: "mx-dot " + s }), MX_STATE_LABEL[s])), h("span", null, h("i", { class: "mx-krockbox" }), "Same day"));
      this.bar.replaceChildren(sSel, aSel, tbd, legend);
      this.body.replaceChildren(mxWeek(), ...MX_SECTIONS.map(([m, l, n]) => mxMatrix(m, l, n, model)));
    }
  };

  const CooMatrisView = {
    mount(root) {
      this.seg = h("div", { class: "seg mx-seg", role: "group", "aria-label": "View" });
      this.btns = [["matris", "Matrix"], ["lista", "List"]].map(([v, l]) => { const b = h("button", { type: "button", text: l, onclick: () => { if (MXS.vy === v) return; MXS.vy = v; mxSave(); this.remount(); } }); b.dataset.v = v; return b; });
      this.seg.append(...this.btns);
      this.inner = h("div", { style: "display:grid;gap:16px" });
      root.append(this.seg, this.inner);
      this.remount(true);
    },
    remount(first) {
      this.btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === MXS.vy)));
      this.inner.replaceChildren();
      this.cur = MXS.vy === "lista" ? CooView : MatrisView;
      this.cur.mount(this.inner);
      if (!first) { this.cur.update(); renderActions(); }
    },
    update() { this.cur.update(); }
  };

  // Flytta lansering: anropas från openEvent efter att en förälder sparats med nytt datum.
  async function mxMoveKids(e, o) {
    if (!e || e.hor_till || !e.matris || !isISO(o.datum) || o.datum === e.datum) return;
    const kids = D.handelser.filter((k) => k.hor_till === e._id && k.status !== "Inställd");
    if (!kids.length) return;
    const plan = kids.map((k) => { const nd = addDays(o.datum, Number(k.offset_dagar) || 0); const ns = k.slut && isISO(k.slut) && k.slut !== k.datum && isISO(k.datum) ? addDays(k.slut, daysBetween(k.datum, nd)) : nd; return { k, nd, ns }; }).filter((x) => x.nd !== x.k.datum || x.ns !== (x.k.slut || x.k.datum));
    if (!plan.length) return;
    const list = h("ul", { class: "mx-preview" }, ...plan.map((x) => h("li", null, h("span", { class: "mono", text: fmtDate(x.k.datum) + " → " + fmtDate(x.nd) }), " ", x.k.titel)));
    const doMove = async (btn) => {
      btn.disabled = true;
      let n = 0;
      for (const x of plan) {
        const fresh = byId(D.handelser, x.k._id) || x.k;
        const ok = await write("handelser", x.k._id, { datum: x.nd, slut: x.ns, andrad: new Date().toISOString(), logg: (fresh.logg || []).concat(logEntry("Moved with the launch from " + fmtDate(x.k.datum) + " to " + fmtDate(x.nd))) });
        if (ok) n++;
      }
      toast(n + " phases moved"); closeSheet(); scheduleRefresh();
    };
    openSheet({ tag: "Move", title: "Move all phases along?", sub: e.titel + ": " + fmtDate(e.datum) + " → " + fmtDate(o.datum),
      body: [e.matris === "drop" && launchImpactText(o.sasong, o.drop, o.datum) ? h("p", { class: "mx-kom", text: "Deliveries: " + launchImpactText(o.sasong, o.drop, o.datum) }) : null, h("p", { text: "Each phase gets the launch's new date plus its lead time from the template. No moves only " + (e.matris === "drop" ? "the launch" : "the event") + "." }), list],
      foot: [h("button", { class: "btn", type: "button", text: "No, only " + (e.matris === "drop" ? "the launch" : "the event"), onclick: closeSheet }), h("button", { class: "btn primary", type: "button", text: "Yes, move " + plan.length + " phases", onclick: (ev) => doMove(ev.target) })] });
  }

  // ---------- tabs ----------
  // ---------- BIBLIOTEK (styles och idéer) ----------
  const LibView = {
    mount(root) {
      const st = UI.bibliotek;
      const upd = () => { this.update(); persist(); };
      this.strip = makeStrip([
        { key: "ideer", label: "Ideas not ready for design" },
        { key: "hosConor", label: "With Conor for design", cls: "t-warn" },
        { key: "hosAlex", label: "Sample can be ordered (Alex)", cls: "t-warn" },
        { key: "sampling", label: "In sampling" },
        { key: "godkanda", label: "Approved" },
        { key: "produktion", label: "In production / delivered" },
        { key: "utanBild", label: "No image", cls: "t-warn" }
      ], st, () => { this.seg.sync(); upd(); });
      const q = searchBox("q_lib", "Search style, idea, fabric, supplier …", st, () => this.update());
      this.fSeason = filterSelect("f_l_season", "All seasons", st, "season", upd);
      this.fKat = filterSelect("f_l_kat", "All categories", st, "kat", upd);
      this.fLev = filterSelect("f_l_lev", "All suppliers", st, "lev", upd);
      this.seg = makeSeg([["alla", "All"], ["ideer", "Ideas"], ["aktiva", "Sampling & approved"], ["klara", "I produktion"], ["arkiv", "Paused & dropped"]], st, "status", upd);
      this.segMode = makeSeg([["styles", "By season"], ["grund", "Base styles"]], st, "mode", upd);
      this.count = h("span", { class: "count" });
      this.body = h("div", { style: "display:grid;gap:26px" });
      root.append(h("p", { class: "lede", text: "All styles and ideas in one place – even before a sample is ordered. Create an idea with description, fabric, measurements and images, then send it to design or straight to sampling. A base style (e.g. Roper Shirt) is reused across collections through variants." }),
        this.strip.el, h("section", { class: "filters", "aria-label": "Filter" }, q, this.fSeason.el, this.fKat.el, this.fLev.el, this.seg.el, this.segMode.el, this.count), this.body);
    },
    filtered() {
      const st = UI.bibliotek, q = norm(st.q);
      return D.styles.filter((s) => {
        const ss = styleStatusNorm(s.status);
        switch (st.view) {
          case "ideer": if (ss !== ST_IDE) return false; break;
          case "hosConor": if (ss !== ST_DESIGN) return false; break;
          case "hosAlex": if (ss !== ST_KANBEST) return false; break;
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
      this.strip.set({ ideer: D.styles.filter((s) => S(s) === ST_IDE && !s.grund).length, hosConor: D.styles.filter((s) => S(s) === ST_DESIGN).length, hosAlex: D.styles.filter((s) => S(s) === ST_KANBEST).length, sampling: D.styles.filter((s) => S(s) === "Sampling").length, godkanda: D.styles.filter((s) => S(s) === "Godkänd").length, produktion: D.styles.filter((s) => PROD_STATUS.includes(S(s))).length, utanBild: D.styles.filter((s) => !styleImage(s) && !["Kastad", "Pausad"].includes(S(s))).length });
      const list = this.filtered();
      this.body.replaceChildren();
      if (st.mode === "grund" && !st.view) {
        const gs = grundStyles().filter((g) => list.includes(g) || variantsOf(g._id).some((v) => list.includes(v)));
        const loose = list.filter((s) => !isGrund(s) && !grundOf(s));
        const sec = h("section", { class: "lib-sec" }, h("div", { class: "lib-h" }, h("h3", { text: "Base styles" }), h("span", { class: "sub", text: gs.length + (gs.length === 1 ? " base style" : " base styles") + " · " + loose.length + " styles without a base style" })));
        if (!gs.length) sec.append(h("p", { class: "hint", text: "No base styles yet. Open a style and choose the garment it builds on under \"Base style\" – the chosen style becomes a base style." }));
        else sec.append(h("div", { class: "cards" }, gs.map((g) => this.grundCard(g, list))));
        this.body.append(sec);
        if (loose.length) {
          const sec2 = h("section", { class: "lib-sec" }, h("div", { class: "lib-h" }, h("h3", { text: "No base style" }), h("span", { class: "sub", text: "Open a style and choose \"Base style\" to link it." })), h("div", { class: "pgrid" }, loose.sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv")).map((s) => KollView.card(s))));
          this.body.append(sec2);
        }
        this.count.textContent = list.length + " styles";
        return;
      }
      const groups = new Map();
      for (const s of list) { const k = s.sasong || "Utan säsong"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
      const keys = [...groups.keys()].sort((a, b) => (a === "Utan säsong") - (b === "Utan säsong") || seasonRank(b) - seasonRank(a) || b.localeCompare(a, "sv"));
      const order = { [ST_IDE]: -1, [ST_DESIGN]: 0, [ST_KANBEST]: 1, Sampling: 2, "Godkänd": 3, "PO lagd": 4, "I produktion": 5, Levererad: 6, Pausad: 7, Kastad: 8 };
      for (const k of keys) {
        const items = groups.get(k).sort((a, b) => (order[S(a)] ?? 9) - (order[S(b)] ?? 9) || (a.namn || "").localeCompare(b.namn || "", "sv"));
        const nI = items.filter((s) => isIdea(s) && !s.grund).length;
        this.body.append(h("section", { class: "lib-sec" }, h("div", { class: "lib-h" }, h("h3", { text: k }), h("span", { class: "sub", text: items.length + (items.length === 1 ? " style" : " styles") + (nI ? " · " + nI + (nI === 1 ? " idea" : " ideas") : "") })), h("div", { class: "pgrid" }, items.map((s) => KollView.card(s)))));
      }
      if (!list.length) this.body.append(h("div", { class: "empty" }, h("strong", { text: loaded.has("styles") ? (D.styles.length ? "Nothing matches" : "No styles yet") : "Loading …" }), h("span", { text: "Create an idea with \"+ New idea\"." })));
      this.count.textContent = list.length + " of " + D.styles.length + " styles";
    },
    grundCard(g, list) {
      const img = styleImage(g) || variantsOf(g._id).map(styleImage).find(Boolean);
      const vs = variantsOf(g._id);
      const open = () => openStyle(g._id);
      return h("article", { class: "gcard" },
        h("div", { class: "gimg", onclick: open }, img ? h("img", { src: imgUrl(img), alt: g.namn, loading: "lazy" }) : h("span", { class: "noimg", text: "No image" })),
        h("div", { class: "gbody" },
          h("div", null, h("div", { class: "gname", onclick: open, text: g.namn }), h("div", { class: "sub", text: [styleKategori(g), g.leverantor, g.beskrivning].filter(Boolean).join(" · ") })),
          h("div", { class: "gvars" }, vs.length ? vs.map((v) => h("button", { class: "gvar", type: "button", onclick: () => openStyle(v._id) }, h("span", { style: "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, v.namn, h("span", { class: "sub", text: [styleTyg(v), (v.farger || []).join(", ")].filter(Boolean).map((x) => " · " + x).join("") })), h("span", { class: "sub mono", text: [v.sasong, v.drop].filter(Boolean).join(" ") || "–" }), styleStatusPill(v))) : h("p", { class: "hint", style: "margin:0", text: "No variants yet." })),
          canWrite && db ? h("div", null, h("button", { class: "btn small", type: "button", text: "+ New variant", onclick: () => openStyle(null, { grundId: g._id, namn: g.namn, kategori: g.kategori || "", leverantor: g.leverantor || "", storlekar: (g.storlekar || []).slice(), mattFran: g._id, status: ST_IDE, sasong: UI.bibliotek.season && UI.bibliotek.season !== "Utan säsong" ? UI.bibliotek.season : "" }) })) : null));
    }
  };

  // ---------- DESIGN (Conor) ----------
  // Extern designer: ser bara idéer som Carl har markerat som redo att designa, med en nedskalad brief. Inga priser, PO, leverantörer eller EAN.
  const designOnly = () => ME.flikar.length > 0 && ME.flikar.every((t) => t === "design");
  const designInbox = () => D.styles.filter((s) => styleStatusNorm(s.status) === ST_DESIGN).sort((a, b) => String((a.overlamnad && a.overlamnad.t) || a.andrad || "").localeCompare(String((b.overlamnad && b.overlamnad.t) || b.andrad || "")));
  const designDone = () => D.styles.filter((s) => s.design && s.design.klar && styleStatusNorm(s.status) !== ST_DESIGN && !["Kastad"].includes(styleStatusNorm(s.status))).sort((a, b) => String(b.design.klar).localeCompare(String(a.design.klar))).slice(0, 30);
  const DesignView = {
    mount(root) {
      root.append(h("p", { class: "lede", text: "Ideas that are ready to design. Open an idea to see the brief, upload the design and send it on to sampling." }));
      this.host = h("div", { style: "display:grid;gap:16px" }); root.append(this.host);
    },
    update() {
      const card = (title, sub, items, empty, done) => {
        const c = h("section", { class: "card" + (done ? "" : " inbox") }, h("div", { class: "card-head" }, h("h3", { text: title }), h("span", { class: "sub", text: sub })));
        if (!items.length) { c.append(h("p", { class: "hint", style: "padding:12px 16px", text: empty })); return c; }
        const { t, tb } = table([["Idea"], ["Season"], ["Tyg"], [done ? "Design done" : "From Carl"], ["", "num"]]);
        for (const s of items) {
          const img = styleImage(s); const n = ((s.design && s.design.bilder) || []).length;
          const when = done ? s.design.klar : (s.overlamnad && s.overlamnad.t);
          tb.append(h("tr", { tabIndex: 0, dataset: { style: s._id } },
            td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:flex-start" }, img ? h("img", { class: "rowthumb", style: "margin-top:0", src: imgUrl(img), alt: "", loading: "lazy" }) : null,
              h("div", null, h("div", { class: "prod", text: s.namn }), h("div", { class: "sub", text: [styleKategori(s), grundOf(s) ? "variant of " + grundOf(s).namn : "", n ? n + (n === 1 ? " design file" : " design files") : ""].filter(Boolean).join(" · ") }), s.beskrivning ? h("div", { class: "note", text: s.beskrivning }) : null))),
            td("Season", "mono", [s.sasong, s.drop].filter(Boolean).join(" · ")),
            td("Tyg", null, styleTyg(s) || h("span", { class: "muted", text: "–" })),
            td(done ? "Design done" : "From Carl", "mono", when ? fmtDate(String(when).slice(0, 10)) : "–"),
            td("", "num", h("button", { class: "btn small" + (done ? "" : " primary"), type: "button", text: done ? "Open" : "Open brief" }))));
        }
        tb.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-style]"); if (tr) openDesign(tr.dataset.style); });
        tb.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const tr = e.target.closest("tr[data-style]"); if (tr) openDesign(tr.dataset.style); });
        c.append(h("div", { class: "ledger-wrap" }, t));
        return c;
      };
      const todo = designInbox(), done = designDone();
      this.host.replaceChildren(
        card("To design", todo.length + (todo.length === 1 ? " idea waiting for design" : " ideas waiting for design"), todo, "Nothing to design right now. Carl sends ideas here when they are ready.", false),
        card("Designed", "Sent on to sampling", done, "No designed ideas yet.", true));
    }
  };
  function openDesign(id) {
    const st = byId(D.styles, id);
    if (!st) { toast("Cannot find the idea."); return; }
    const current = () => byId(D.styles, id) || st;
    const ro = !canWrite || !db;
    const waiting = () => styleStatusNorm(current().status) === ST_DESIGN;
    const g = grundOf(st);
    const row = (k, v) => (String(v || "").trim() ? h("div", { class: "brief-row" }, h("span", { class: "k", text: k }), h("div", { class: "v", text: String(v).trim() })) : null);
    const brief = h("section", null, h("h3", { class: "sec-title", text: "Brief from Carl" }), h("div", { class: "brief" },
      row("Description", st.beskrivning), row("Category", styleKategori(st)), row("Season", [st.sasong, st.drop].filter(Boolean).join(" · ")), row("Tyg", styleTyg(st)),
      row("Sizes", sizesOf(st).join(", ")), row("Builds on", g ? g.namn : ""), row("Measurements", [st.mattFran ? "Same measurements as " + refName(st.mattFran) : "", st.mattlista].filter(Boolean).join("\n")),
      row("References and links", st.referenser), row("Comment", st.kommentar)));
    const refImgs = styleAllImages(st);
    const refSec = h("section", null, h("h3", { class: "sec-title", text: "Images and references" + (refImgs.length ? " (" + refImgs.length + ")" : "") }), refImgs.length ? gallery(refImgs, {}) : h("p", { class: "hint", text: "No images from Carl yet." }));
    const dz = () => current().design || {};
    const designSec = bilderSection({ title: "Design", empty: "No design files uploaded yet.", addLabel: "+ Upload design", ro, current: () => ({ bilder: dz().bilder || [] }),
      save: async (ids, text) => write("styles", id, { design: Object.assign({}, dz(), { bilder: ids }), andrad: new Date().toISOString(), logg: (current().logg || []).concat(logEntry("Design: " + text)) }) });
    const fLank = inp("f_dlank", dz().lank || "", { type: "url", placeholder: "https://… (Figma, Drive or PDF)" });
    const fKom = h("textarea", { id: "f_dkom", rows: 3, placeholder: "What Carl and Alex need to know about the design" }); fKom.value = dz().kommentar || "";
    const state = h("p", { class: "hint" });
    const syncState = () => { const d = dz(); state.textContent = waiting() ? "Waiting for design." : d.klar ? "Design done " + fmtDate(String(d.klar).slice(0, 10)) + " – sent to sampling." : "The style is no longer in design."; };
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("div", { class: "field full" }, h("label", { for: "f_dlank", text: "Link to design file" }), fLank),
      h("div", { class: "field full" }, h("label", { for: "f_dkom", text: "Comment to Carl and Alex" }), fKom), state);
    if (ro) lock(form);
    const save = async (done, btn) => {
      const cur = current(); const now = new Date().toISOString(); const d = Object.assign({}, cur.design || {}, { lank: fLank.value.trim(), kommentar: fKom.value.trim() });
      if (done && !(d.bilder || []).length && !d.lank) { toast("Upload the design or add a link before you send it on."); return; }
      if (btn) btn.disabled = true;
      const patch = { design: d, andrad: now };
      if (done) { d.klar = now; d.av = myId; patch.status = ST_KANBEST; patch.overlamnad = { till: "Alex", t: now, av: myId, fran: "design" }; patch.logg = (cur.logg || []).concat(logEntry("Design done – sent to sampling, sample can be ordered")); }
      else if (d.lank !== ((cur.design || {}).lank || "") || d.kommentar !== ((cur.design || {}).kommentar || "")) patch.logg = (cur.logg || []).concat(logEntry("Design updated"));
      const ok = await write("styles", id, patch);
      if (btn) btn.disabled = false;
      if (ok) { toast(done ? "Sent to sampling – Alex can order a sample" : "Saved"); closeSheet(); }
    };
    const right = h("div", { class: "foot-right" }, h("button", { class: "btn", type: "button", text: ro ? "Close" : "Cancel", onclick: closeSheet }));
    if (!ro) { right.append(h("button", { class: "btn" + (waiting() ? "" : " primary"), type: "button", text: "Save", onclick: (e) => save(false, e.target) })); if (waiting()) right.append(h("button", { class: "btn primary", type: "button", text: "Design done – send to sampling", onclick: (e) => save(true, e.target) })); }
    openSheet({ flagRef: { typ: "style", ref: id, titel: st.namn + (st.sasong ? " · " + st.sasong : ""), tab: "design" }, tag: "Design", title: st.namn, sub: [styleKategori(st), st.sasong, st.drop].filter(Boolean).join(" · "),
      body: [brief, refSec, designSec, h("section", null, h("h3", { class: "sec-title", text: "To Carl and Alex" }), form)], foot: [h("div"), right],
      ctx: { refresh: () => { if (!byId(D.styles, id)) { closeSheet(); return; } designSec.render(); syncState(); } } });
    syncState();
  }
  // Det Conor har levererat, så som Carl och Alex ser det på stylen.
  function designSummary(st) {
    const d = st.design || {};
    if (!(d.bilder || []).length && !d.lank && !d.kommentar && !d.klar) return null;
    return h("section", null, h("h3", { class: "sec-title", text: "Design (Conor)" + (d.klar ? " – done " + fmtDate(String(d.klar).slice(0, 10)) : "") }),
      (d.bilder || []).length ? gallery(d.bilder, {}) : null,
      d.lank ? h("p", null, h("a", { href: d.lank, target: "_blank", rel: "noopener", text: "Open the design file" })) : null,
      d.kommentar ? h("p", { class: "note", text: d.kommentar }) : null);
  }

  // ---------- ANVÄNDARE (Elliot) ----------
  const roleDef = (key) => { const base = ROLE_DEFAULTS[key] || ROLE_DEFAULTS.ingen; const ov = (D.roller.roller || {})[key] || {}; let flikar = Array.isArray(ov.flikar) ? ov.flikar.slice() : base.flikar; if (Array.isArray(ov.flikar) && (num(ov.flikVersion) || 1) < 2) flikar = uniq(flikar.concat(NEW_TABS.filter((t) => base.flikar.includes(t)))); if (Array.isArray(ov.flikar) && (num(ov.flikVersion) || 1) < 3) flikar = uniq(flikar.concat(NEW_TABS_3.filter((t) => base.flikar.includes(t)))); return { key, namn: base.namn, flikar, redigera: typeof ov.redigera === "boolean" ? ov.redigera : base.redigera, leverantor: !!base.leverantor, fast: !!base.fast }; };
  const userDoc = (id) => D.anvandare.find((a) => a._id === id) || null;
  const AnvView = {
    mount(root) {
      this.people = h("div");
      this.roles = h("div");
      this.search = h("div", { class: "people" });
      root.append(h("p", { class: "lede", text: "Who sees what. Everyone signs in with their Rubato account (Microsoft) and appears here after the first visit; here you control which role they get in the app and which tabs the role sees. Admin (can manage users) is set in the database by Jakob." }),
        h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: "People" }), h("span", { class: "sub", text: "Everyone who has opened the app or been given a role" })), this.search, this.people),
        h("section", { class: "card" }, h("div", { class: "card-head" }, h("h3", { text: "Roles" }), h("span", { class: "sub", text: "Which tabs each role sees and whether it may edit" })), this.roles));
      this.renderSearch();
    },
    renderSearch() {
      if (!user || !canAdmin) { this.search.replaceChildren(); return; }
      const q = h("input", { type: "search", placeholder: "Add person – search by name …", "aria-label": "Search person", style: "width:100%;padding:8px 12px;border:0;border-bottom:1px solid var(--line);background:var(--surface)" });
      const hits = h("div", { class: "hits", hidden: true });
      const run = async () => {
        let ps = [];
        try { ps = await user.search(q.value); } catch (e) {}
        ps = ps.filter((p) => p.id !== myId);
        hits.replaceChildren(...ps.map((p) => h("button", { type: "button", onclick: async () => { hits.hidden = true; q.value = ""; await setRole(p.id, userDoc(p.id) ? userDoc(p.id).roll : "team"); } }, h("img", { class: "avatar", src: p.avatarUrl, alt: "" }), h("span", { text: p.name || "Someone" }), p.guest ? h("span", { class: "sub", text: "guest" }) : null, userDoc(p.id) ? h("span", { class: "sub", text: "already has the role: " + roleDef(userDoc(p.id).roll).namn }) : null)));
        if (!ps.length) hits.replaceChildren(h("span", { class: "hint", style: "padding:8px 12px", text: q.value ? "No match. The person must be in Rubato's Claude organisation, or open the app once after you have shared it." : "Type a name." }));
        hits.hidden = false;
      };
      q.addEventListener("focus", run); q.addEventListener("input", run);
      q.addEventListener("blur", () => setTimeout(() => (hits.hidden = true), 200));
      this.search.replaceChildren(q, hits);
    },
    async update() {
      if (!canAdmin) { this.people.replaceChildren(h("p", { class: "hint", style: "padding:14px 16px", text: "Only admin can manage users." })); this.roles.replaceChildren(); return; }
      const ids = uniq(D.anvandare.map((a) => a._id).concat(D.narvaro.map((n) => n._id), myId ? [myId] : []));
      let ps = {};
      try { if (user && ids.length) ps = await user.profiles(ids); } catch (e) {}
      const { t, tb } = table([["Person"], ["Role"], ["Supplier"], ["Last in the app"], [""]]);
      t.classList.add("users");
      const rows = ids.map((id) => ({ id, doc: userDoc(id), nar: D.narvaro.find((n) => n._id === id), p: ps[id] || { name: "", avatarUrl: "", guest: false } }));
      rows.sort((a, b) => (a.id === myId ? -1 : b.id === myId ? 1 : 0) || (!!b.doc - !!a.doc) || (a.p.name || "zz").localeCompare(b.p.name || "zz", "sv"));
      for (const r of rows) {
        const roll = r.doc ? r.doc.roll : "";
        const sel = selectEl("roll_" + r.id, [["", "– No role (default: " + roleDef(D.roller.standardRoll || "team").namn + ")"]].concat(ROLE_ORDER.map((k) => [k, roleDef(k).namn])), roll);
        sel.addEventListener("change", () => setRole(r.id, sel.value, r.doc ? r.doc.leverantor : ""));
        const lev = inp("lev_" + r.id, r.doc ? r.doc.leverantor : "", { list: "dlLev", autocomplete: "off", placeholder: "For manufacturer" });
        lev.disabled = roll !== "producent";
        lev.addEventListener("change", () => setRole(r.id, roll, lev.value.trim()));
        const seen = r.nar && r.nar.senast ? new Date(r.nar.senast) : null;
        tb.append(h("tr", null,
          td("", "c-main", h("div", { style: "display:flex;gap:10px;align-items:center" }, r.p.avatarUrl ? h("img", { class: "avatar", src: r.p.avatarUrl, alt: "" }) : null, h("div", null, h("div", { class: "prod", text: (r.p.name || "Unknown person") + (r.id === myId ? " (you)" : "") }), h("div", { class: "sub", text: [r.p.guest ? "Guest outside the organisation" : "", r.id === myId && canAdmin ? "Editor/owner – full access regardless of role" : ""].filter(Boolean).join(" · ") })))),
          td("Role", null, sel),
          td("Supplier", null, lev),
          td("Last in the app", "mono", seen && !isNaN(seen) ? fmtDate(seen.toISOString().slice(0, 10)) + " " + String(seen.getHours()).padStart(2, "0") + ":" + String(seen.getMinutes()).padStart(2, "0") : h("span", { class: "muted", text: "–" })),
          td("", "num", r.doc ? h("button", { class: "btn small", type: "button", text: "Remove role", onclick: async () => { if (await remove("anvandare", r.id)) toast("Role removed"); } }) : null)));
      }
      if (!rows.length) tb.append(h("tr", null, h("td", { colSpan: 5, class: "sub", text: "Nobody has opened the app yet." })));
      const std = selectEl("std_roll", ROLE_ORDER.filter((k) => k !== "admin").map((k) => [k, roleDef(k).namn]), D.roller.standardRoll || "team");
      std.addEventListener("change", async () => { try { await db.doc("behorighet/roller").set(Object.assign({}, D.roller, { standardRoll: std.value, andrad: new Date().toISOString() })); toast("Default role saved"); } catch (e) { writeError(e); } });
      this.people.replaceChildren(h("div", { class: "ledger-wrap" }, t), h("div", { class: "budget-foot", style: "padding:10px 16px;border-top:1px solid var(--line)" }, h("span", { text: "Staff in the organisation without an assigned role get:" }), std, h("span", { class: "sub", text: "Guests outside the organisation without a role see nothing." })));
      this.renderRoles();
    },
    renderRoles() {
      const tbl = h("table", { class: "rolegrid" });
      tbl.append(h("thead", null, h("tr", null, h("th", { text: "Role" }), TAB_DEFS.map(([k, l]) => h("th", { text: l })), h("th", { text: "May edit" }))));
      const tb = h("tbody");
      const state = {};
      for (const k of ROLE_ORDER) {
        const r = roleDef(k); state[k] = { flikar: r.flikar.slice(), redigera: r.redigera };
        const tr = h("tr", null, h("td", null, h("strong", { text: r.namn }), r.key === "admin" ? h("div", { class: "sub", text: "Editor/owner in Claude" }) : r.key === "producent" ? h("div", { class: "sub", text: "Only sees their supplier's POs" }) : r.key === "ingen" ? h("div", { class: "sub", text: "Default for guests" }) : null));
        for (const [tk] of TAB_DEFS) { const cb = h("input", { type: "checkbox" }); cb.checked = r.flikar.includes(tk); cb.disabled = r.fast; cb.addEventListener("change", () => { state[k].flikar = cb.checked ? uniq(state[k].flikar.concat([tk])) : state[k].flikar.filter((x) => x !== tk); }); tr.append(h("td", null, cb)); }
        const ed = h("input", { type: "checkbox" }); ed.checked = r.redigera; ed.disabled = r.fast; ed.addEventListener("change", () => (state[k].redigera = ed.checked)); tr.append(h("td", null, ed));
        tb.append(tr);
      }
      tbl.append(tb);
      const saveBtn = h("button", { class: "btn small primary", type: "button", text: "Save roles", onclick: async () => { const roller = {}; for (const k of ROLE_ORDER) if (!ROLE_DEFAULTS[k].fast) roller[k] = Object.assign({ flikVersion: 3 }, state[k]); try { await db.doc("behorighet/roller").set(Object.assign({}, D.roller, { roller, andrad: new Date().toISOString() })); toast("Roles saved"); } catch (e) { writeError(e); } } });
      this.roles.replaceChildren(h("div", { class: "ledger-wrap", style: "padding:6px 10px" }, tbl), h("div", { class: "budget-foot", style: "padding:10px 16px;border-top:1px solid var(--line)" }, saveBtn, h("span", { class: "sub", text: "Admin and No access are fixed. Changes apply as soon as the person reloads the app." })));
    }
  };
  async function setRole(id, roll, leverantor) {
    if (!db || !id) return;
    try {
      if (!roll) { await db.collection("anvandare").doc(id).delete(); toast("Role removed"); return; }
      await db.collection("anvandare").doc(id).set({ roll, leverantor: roll === "producent" ? (leverantor || "") : "", andrad: new Date().toISOString(), av: myId });
      toast("Role saved: " + roleDef(roll).namn);
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
    document.querySelectorAll("#tabs .tab").forEach((b) => b.classList.toggle("me", false));
    renderNav();
    if (UI.tab === "ean") UI.tab = ME.flikar.includes("ecom") ? "ecom" : ME.flikar[0];
    if (!ME.flikar.length) {
      $("view").replaceChildren(h("div", { class: "empty" }, h("strong", { text: "You do not have access to the app yet" }), h("span", { text: "Ask Elliot to give you a role under Users, and you will see the right tabs the next time you reload." })));
      $("actions").replaceChildren();
      banner("");
      return;
    }
    $("gsearch").hidden = designOnly();
    if (!ME.flikar.includes(UI.tab)) switchTab(ME.flikar[0]); else renderActions();
    if (db && !canWrite) banner(platformWrite ? "Your role (" + roleDef(ME.roll).namn + ") has read access in the app." : "You have read access. Ask Elliot for a role that may edit.");
    else banner("");
  }

  const VIEWS = { bibliotek: LibView, design: DesignView, samples: SamplesView, ref: RefView, kollektion: KollView, produktion: ProdView, foto: FotoView, ecom: EcomView, shopify: ShopifyView, coo: CooMatrisView, tyglager: LagerView, leverantorer: LevView, ean: EanView, anvandare: AnvView };
  function switchTab(t) {
    if (!VIEWS[t]) t = "samples";
    if (ME.flikar.length && !ME.flikar.includes(t)) t = ME.flikar[0];
    UI.tab = t;
    document.querySelectorAll("#tabs .tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    lastTab[areaOf(t)] = t; renderNav();
    const root = $("view"); root.replaceChildren(); root.className = "view-" + t;
    root.style.display = "grid"; root.style.gap = "16px";
    VIEWS[t].mount(root); VIEWS[t].update(); renderActions(); renderDiag(); renderFlags(); persist();
  }
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) switchTab(b.dataset.tab); });
  const lastTab = {};
  const tabAllowed = (t) => ME.flikar.includes(t) && t !== "ean" && !!VIEWS[t];
  function renderNav() {
    const area = areaOf(UI.tab); const nav = $("tabs"); let areas = 0;
    document.querySelectorAll("#areas .area").forEach((b) => { const any = (AREA_TABS[b.dataset.area] || []).some(tabAllowed); b.hidden = !any; if (any) areas++; b.setAttribute("aria-selected", String(b.dataset.area === area)); });
    $("areas").hidden = areas < 2;
    const btns = [...nav.querySelectorAll(".tab")]; let n = 0, last = null;
    for (const b of btns) { b.hidden = true; b.classList.remove("last"); }
    for (const t of AREA_TABS[area]) { const b = btns.find((x) => x.dataset.tab === t); if (!b) continue; nav.append(b); b.hidden = !tabAllowed(t); const nr = b.querySelector(".nr"); if (nr) nr.textContent = !b.hidden && area === "produkt" ? String(++n) : ""; if (!b.hidden) last = b; }
    if (last) last.classList.add("last");
    nav.classList.toggle("flow", area === "produkt" && n > 1);
    $("brandH").innerHTML = AREA_HEAD[area][0]; $("brandP").textContent = AREA_HEAD[area][1];
  }
  $("areas").addEventListener("click", (e) => { const b = e.target.closest(".area"); if (!b) return; const a = b.dataset.area; const t = lastTab[a] && tabAllowed(lastTab[a]) ? lastTab[a] : (AREA_TABS[a] || []).find(tabAllowed); if (t) switchTab(t); });
  function renderActions() {
    const a = $("actions"); a.replaceChildren();
    const add = (label, fn, primary) => a.append(h("button", { class: "btn" + (primary ? " primary" : ""), type: "button", text: label, onclick: fn }));
    const w = canWrite && !!db, t = UI.tab;
    const libSeason = () => (UI.bibliotek.season && UI.bibliotek.season !== "Utan säsong" ? UI.bibliotek.season : KollView.seasonInView() || "");
    if ((t === "bibliotek" || t === "produktion" || t === "kollektion") && w && assets && shopTodo().length) add("Fetch Shopify images (" + shopTodo().length + ")", importShopifyImages);
    if (t === "bibliotek" && w) { add("+ New style", () => openStyle(null, { sasong: libSeason() })); add("+ New idea", () => openStyle(null, { status: ST_IDE, sasong: libSeason() }), true); }
    if (t === "samples") { if (downloads) add("Export CSV", exportSamples); if (w) add("+ New style", () => openStyle(null)); if (w) add("+ New sample", () => openSample(null), true); }
    if (t === "kollektion" && w) { add("+ New drop", () => openDrop(null, { sasong: KollView.seasonInView() || "" })); add("+ New sample", () => openSample(null)); add("+ New idea", () => openStyle(null, { status: ST_IDE, sasong: KollView.seasonInView() || "" })); add("+ New style", () => openStyle(null, { sasong: KollView.seasonInView() || "" }), true); }
    if (t === "foto" && w) add("+ New sample", () => openSample(null, { version: "Fotosample" }), true);
    if (t === "ref" && w) add("+ New reference garment", () => openRef(null), true);
    if (t === "produktion") { if (downloads) add("Export CSV", exportPo); if (w) add("+ New PO", () => openPo(null, { sasong: ProdView.seasonInView() || "", leverantor: UI.prod.lev || "" }), true); }
    if (t === "tyglager") { if (downloads) add("Export CSV", exportLager); if (w) add("+ New fabric", () => openTyg(null)); if (w) add("+ New batch", () => openLager(null, UI.lager.typ === "trims" ? { typ: "trims" } : null), true); }
    if (t === "leverantorer" && w) add("+ New supplier", () => openLev(null), true);
    if (t === "ean" && downloads) add("Export all EAN", exportAllEan);
    a.append(h("button", { class: "btn", type: "button", text: "Sign out", title: P.user.email(), onclick: P.signOut }));
    if (t === "coo" && w) add("+ New event", () => openEvent(null), true);
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
    set("c_design", designInbox().length);
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
    if (!$("dlFarger").options.length) $("dlFarger").replaceChildren(...FARGER_STD.map((v) => new Option(v, v)));
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
  function refresh() { updateCounts(); refreshLists(); renderFlags(); VIEWS[UI.tab].update(); if (sheetCtx && sheetCtx.refresh) sheetCtx.refresh(); }
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
    if (IDEA_STATUS.includes(ss)) parts.push(["Idea stage", ss === ST_KANBEST ? "with Alex, sample can be ordered" : ss === ST_DESIGN ? "with Conor for design" : "with Carl"]);
    parts.push(["Samples", xs.length ? xs.length + " (" + inne + " in, " + vantar + " expected" + (ark ? ", " + ark + " in archive" : "") + ")" : "none"]);
    if (pl.length) parts.push(["Production", [planerat ? planerat + " planned" : "", prod ? prod + " in production" : "", pavag ? pavag + " on their way" : "", inlev ? inlev + " delivered" : ""].filter(Boolean).join(", ") + (etas[0] ? " · incoming " + fmtDate(etas[0]) : "")]);
    else if (!IDEA_STATUS.includes(ss)) parts.push(["Production", "no PO"]);
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
    return h("div", { class: "srch-line" }, h("span", null, "Samples: ", h("b", { text: String(xs.length) + (xs.filter(isArchived).length ? " (" + xs.filter(isArchived).length + " in archive)" : "") })), h("span", null, "Styles/ideas: ", h("b", { text: String(sts.length) })), h("span", null, "Production: ", h("b", { text: rows.length ? rows.length + " PO lines · " + units + " units" : "–" })), h("span", null, "Own stock: ", h("b", { text: stock || "–" })));
  }
  const hit = (q, ...fields) => fields.join(" ").toLowerCase().includes(q);
  function openSearch(q0) {
    const qIn = h("input", { type: "search", id: "f_gq", placeholder: "Search style, fabric, colour, PO, sample ID …", "aria-label": "Search", autocomplete: "off" });
    qIn.value = q0 || "";
    const res = h("div", { style: "display:grid;gap:22px" });
    const can = (tab) => ME.flikar.includes(tab);
    function render() {
      const q = norm(qIn.value);
      res.replaceChildren();
      if (q.length < 2) { res.append(h("p", { class: "hint", text: "Type at least two characters. Search for a fabric, for example, to see where it is used – in samples, archive, ideas and production – or for a style to see what is incoming, in production, in sampling and at the idea stage." })); return; }
      const sec = (title, items, rowFn, emptyText) => {
        const s = h("section", { class: "srch-sec" }, h("h3", { class: "sec-title", text: title + " (" + items.length + ")" }));
        if (!items.length) { s.append(h("p", { class: "hint", text: emptyText || "No matches." })); return s; }
        const ul = h("ul", { class: "mini" }, items.slice(0, 40).map(rowFn));
        if (items.length > 40) ul.append(h("li", { class: "sub", text: "… and " + (items.length - 40) + " more. Refine the search." }));
        s.append(ul); return s;
      };
      if (can("bibliotek") || can("kollektion")) {
        const sts = D.styles.filter((s) => hit(q, s._id, s.namn, s.beskrivning, s.leverantor, s.kategori, styleTyg(s), (s.farger || []).join(" "), s.sasong, s.drop, grundOf(s) ? grundOf(s).namn : "", s.referenser, s.kommentar)).sort((a, b) => seasonRank(b.sasong) - seasonRank(a.sasong) || (a.namn || "").localeCompare(b.namn || "", "sv"));
        res.append(sec("Styles and ideas", sts, (s) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openStyle(s._id) }, tag(s._id), h("span", { class: "mini-main" }, h("strong", { text: s.namn + (isGrund(s) ? " (base style)" : "") }), h("span", { class: "sub", text: [s.sasong, s.drop, s.leverantor, styleTyg(s)].filter(Boolean).join(" · ") }), styleSummary(s)), h("span", { class: "mini-side" }, styleStatusPill(s))))));
      }
      if (can("samples")) {
        const xs = D.samples.filter((s) => hit(q, s._id, styleName(s), s.version, tygName(s), s.material, s.farg, s.leverantor, s.kommentar, s.andringar, s.storlek, platsText(s), s.hangare ? "h" + s.hangare : "", seasonOf(s), beslutNorm(s.beslut))).sort((a, b) => isArchived(a) - isArchived(b) || styleName(a).localeCompare(styleName(b), "sv") || versionRank(a.version) - versionRank(b.version));
        res.append(sec("Samples", xs, (x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openSample(x._id) }, tag(x._id), h("span", { class: "mini-main" }, h("strong", { text: styleName(x) + (x.version ? " · " + x.version : "") }), h("span", { class: "sub", text: [fargText(x.farg), tygName(x), x.leverantor, seasonOf(x), platsText(x)].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, statusPill(x.status), beslutNorm(x.beslut) ? chip(beslutNorm(x.beslut), "b-" + slug(beslutNorm(x.beslut))) : null, isArchived(x) ? chip("Arkiv", "b-arkiv") : null)))));
      }
      if (can("tyglager")) {
        const ts = D.tyger.filter((t) => hit(q, t._id, t.namn, t.leverantor, t.kommentar, t.status) || D.lager.some((l) => l.tygId === t._id && hit(q, l.farg, l.plats, l._id))).sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv"));
        res.append(sec("Fabrics", ts, (t) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openTyg(t._id) }, tag(t._id), h("span", { class: "mini-main" }, h("strong", { text: t.namn }), h("span", { class: "sub", text: t.leverantor || "" }), tygSummary(t)), h("span", { class: "mini-side" }, t.status ? h("span", { class: "pill ts-" + slug(t.status), text: t.status }) : null)))));
      }
      if (can("produktion")) {
        const rows = [];
        for (const po of D.po) for (const r of po.rader || []) if (hit(q, po.nr, po._id, po.leverantor, po.sasong, po.drop, r.produkt, r.farg, r.tyg, r.beskrivning, (byId(D.styles, r.styleId) || {}).namn)) rows.push({ po, r });
        rows.sort((a, b) => String(a.po.nr || a.po._id).localeCompare(String(b.po.nr || b.po._id)));
        res.append(sec("Production (PO lines)", rows, (x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openPo(x.po._id) }, h("span", { class: "tag", text: x.po.nr || x.po._id }), h("span", { class: "mini-main" }, h("strong", { text: [x.r.produkt || (byId(D.styles, x.r.styleId) || {}).namn || "Product", x.r.farg].filter(Boolean).join(" · ") }), h("span", { class: "sub", text: [x.po.leverantor, x.po.sasong, x.r.tyg, x.r.antal != null ? x.r.antal + " units" : "", poEta(x.po) ? "ETA " + fmtDate(poEta(x.po)) : ""].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, poStatusPill(x.po))))));
      }
      if (can("ref")) {
        const rs = D.ref.filter((r) => hit(q, r._id, r.plagg, r.styleNamn, r.skickadTill, r.agare, r.tracking, r.kommentar));
        if (rs.length) res.append(sec("Ref garments", rs, (r) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openRef(r._id) }, tag(r._id), h("span", { class: "mini-main" }, h("strong", { text: r.plagg }), h("span", { class: "sub", text: [r.skickadTill, r.styleNamn ? "for " + r.styleNamn : ""].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, h("span", { class: "pill rs-" + slug(r.status || ""), text: r.status || "–" }))))));
      }
    }
    let tmr = 0;
    qIn.addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(render, 120); });
    qIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); render(); } });
    openSheet({ tag: "Search", title: "Search the whole app", sub: "Styles, ideas, samples, archive, fabrics and production", body: [h("div", { class: "field" }, qIn), res], foot: [h("div"), h("div", { class: "foot-right" }, h("button", { class: "btn", type: "button", text: "Close", onclick: closeSheet }))], ctx: { refresh: render }, focus: "f_gq" });
    render();
  }
  $("gsearch").addEventListener("submit", (e) => { e.preventDefault(); openSearch($("gq").value); });
  $("gq").addEventListener("input", () => { if ($("gq").value.trim().length >= 2 && $("sheet").hidden) openSearch($("gq").value); else if (!$("sheet").hidden && $("f_gq")) { $("f_gq").value = $("gq").value; $("f_gq").dispatchEvent(new Event("input")); } });
  document.addEventListener("keydown", (e) => { if (e.key === "/" && !e.target.closest("input, textarea, select") && $("sheet").hidden) { e.preventDefault(); $("gq").focus(); } });

  // ---------- FLAGGOR ----------
  // En flagga = "det här behöver någon titta på nu". Kräver kommentar, går som direktmejl till dem man väljer,
  // och ligger kvar överst i fliken tills någon markerar den som löst.
  const FLAG_PEOPLE = [["elliot", "Elliot"], ["jakob", "Jakob"], ["carl", "Carl"], ["alex", "Alex"], ["oliver", "Oliver"], ["conor", "Conor"]];
  const TAB_OWNER = { bibliotek: ["carl"], design: ["conor", "carl"], samples: ["alex"], ref: ["alex"], kollektion: ["carl"], produktion: ["elliot"], foto: ["oliver"], ecom: ["jakob"], shopify: ["jakob"], coo: ["jakob"], tyglager: ["alex"], leverantorer: ["elliot", "jakob"] };
  const personName = (k) => (FLAG_PEOPLE.find((p) => p[0] === k) || [k, k])[1];
  const myKey = () => { const n = norm(myName); const k = n === "alexander" ? "alex" : n; return FLAG_PEOPLE.some((p) => p[0] === k) ? k : ""; };
  const flagsOpen = (tab) => D.flaggor.filter((f) => f.status !== "Löst" && (!tab || f.tab === tab)).sort((a, b) => String(b.t || "").localeCompare(String(a.t || "")));
  const flagsFor = (typ, ref) => D.flaggor.filter((f) => f.status !== "Löst" && f.typ === typ && f.ref === ref);
  const latePos = () => D.po.map((p) => ({ p, l: poLate(p) })).filter((x) => x.l).sort((a, b) => b.l.dagar - a.l.dagar);
  function openFlagTarget(f) {
    if (f.typ === "sample") openSample(f.ref); else if (f.typ === "po") openPo(f.ref); else if (f.typ === "drop") openDrop(f.ref); else if (f.typ === "handelse") openEvent(f.ref);
    else if (f.typ === "style") { if (f.tab === "design" || designOnly()) openDesign(f.ref); else openStyle(f.ref, null, { full: true }); }
  }
  function notifyReady(id) { try { if (typeof hostedNotifyReady === "function") Promise.resolve(hostedNotifyReady(id)).catch((e) => console.error(e)); } catch (e) { console.error(e); } }
  async function notifyFlag(id) { try { if (typeof hostedNotifyFlag === "function") return await hostedNotifyFlag(id); } catch (e) { console.error(e); } return null; }

  // ---------- @-TAGGNING I KOMMENTARER ----------
  // Skriv @ i en kommentar (Historik på sample, style, PO och lager) så föreslås teamet. Den som taggas får ett
  // direktmejl (bara hostad, /api/omnamn); går det inte kommer taggningen med i mejlet kl. 10.
  // De taggade sparas på loggraden (fältet till); texten sparas precis som den skrevs.
  const NOTE_PH = "Comment – type @ to tag someone (they get an email)";
  const MENTION_ALIAS = { alexander: "alex", calle: "carl", karl: "carl" };
  function mentionKeys(text) {
    const out = [];
    for (const m of String(text || "").matchAll(/@([A-Za-zÅÄÖåäö]+)/g)) { const n = norm(m[1]); const k = MENTION_ALIAS[n] || n; if (FLAG_PEOPLE.some((p) => p[0] === k) && !out.includes(k)) out.push(k); }
    return out;
  }
  async function notifyMention(coll, id, t) { try { if (typeof hostedNotifyMention === "function") return await hostedNotifyMention(coll, id, t); } catch (e) { console.error(e); } return null; }
  function attachMentions(input) {
    let pop = null, list = [], idx = 0, start = -1;
    const close = () => { list = []; if (pop) pop.hidden = true; };
    const pick = (k) => {
      const pos = input.selectionStart == null ? input.value.length : input.selectionStart;
      const before = input.value.slice(0, start) + "@" + personName(k) + " ";
      input.value = before + input.value.slice(pos).replace(/^[A-Za-zÅÄÖåäö]*/, "");
      input.setSelectionRange(before.length, before.length); close(); input.focus();
    };
    const render = () => {
      if (!pop) { pop = h("div", { class: "mention-pop", role: "listbox" }); (input.parentElement || document.body).append(pop); }
      pop.replaceChildren(...list.map((k, i) => h("button", { type: "button", role: "option", class: i === idx ? "on" : "", text: "@" + personName(k), onmousedown: (e) => { e.preventDefault(); pick(k); } })));
      pop.hidden = !list.length;
    };
    input.addEventListener("input", () => {
      const pos = input.selectionStart == null ? input.value.length : input.selectionStart;
      const m = /(^|\s)@([A-Za-zÅÄÖåäö]*)$/.exec(input.value.slice(0, pos));
      if (!m) { close(); return; }
      start = pos - m[2].length - 1; const q = norm(m[2]); const me = myKey();
      list = FLAG_PEOPLE.map((p) => p[0]).filter((k) => k !== me && (norm(personName(k)).startsWith(q) || Object.keys(MENTION_ALIAS).some((a) => MENTION_ALIAS[a] === k && a.startsWith(q))));
      idx = 0; render();
    });
    // capture: körs före fältets egen Enter (som sparar kommentaren) och före Escape som stänger arket
    input.addEventListener("keydown", (e) => {
      if (!list.length || !pop || pop.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length; render(); }
      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); pick(list[idx]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    }, true);
    input.addEventListener("blur", () => setTimeout(close, 150));
    return input;
  }
  async function addComment(coll, cur, input) {
    const t = input.value.trim(); if (!t || !cur || !cur._id) return false;
    const e = logEntry(t); const till = mentionKeys(t).filter((k) => k !== myKey()); if (till.length) e.till = till;
    if (!(await write(coll, cur._id, { logg: (cur.logg || []).concat(e), andrad: e.t }))) return false;
    input.value = "";
    if (till.length) {
      const names = till.map(personName).join(", ");
      const res = await notifyMention(coll, cur._id, e.t);
      toast((res && res.skickat ? "Comment saved – email sent to " + names : "Comment saved – " + names + " will get it in the 10:00 email") + (res && res.info ? " (" + res.info + ")" : ""));
    }
    return true;
  }
  function openFlag(o) {
    const fText = h("textarea", { id: "f_flagtext", rows: 4, placeholder: "What is the problem, and what needs to happen?" });
    const me = myKey(); const pre = (TAB_OWNER[o.tab] || []).filter((k) => k !== me);
    const boxes = FLAG_PEOPLE.filter((p) => p[0] !== me).map(([k, n]) => { const cb = h("input", { type: "checkbox", value: k }); cb.checked = pre.includes(k); return h("label", null, cb, n); });
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("div", { class: "field full" }, h("label", { for: "f_flagtext", text: "Comment (required)" }), fText),
      h("div", { class: "field full" }, h("label", { text: "Email directly to" }), h("div", { class: "checks" }, boxes), h("span", { class: "hint", text: "The flag stays at the top of the tab until someone marks it as resolved." })));
    const back = () => openFlagTarget(o);
    const save = async (btn) => {
      const text = fText.value.trim(); const till = boxes.map((b) => b.querySelector("input")).filter((c) => c.checked).map((c) => c.value);
      if (!text) { toast("Write a comment – a flag without an explanation helps nobody."); fText.focus(); return; }
      if (!till.length) { toast("Choose at least one person to receive the flag."); return; }
      btn.disabled = true;
      const id = "F" + Date.now().toString(36).toUpperCase(); const now = new Date().toISOString();
      const body = { typ: o.typ, ref: o.ref, titel: o.titel, tab: o.tab, text, till, av: myId, avNamn: myName || personName(me) || "", t: now, status: "Öppen" };
      if (!(await create("flaggor", id, body))) { btn.disabled = false; return; }
      if (!byId(D.flaggor, id)) D.flaggor.push(Object.assign({}, body, { _id: id }));
      if (o.after) { try { await o.after(text); } catch (e) { console.error(e); } }
      const res = await notifyFlag(id);
      toast(res && res.skickat ? "Flagged – email sent to " + till.map(personName).join(", ") : "Flagged – " + till.map(personName).join(", ") + " will get it in the 10:00 email");
      closeSheet(); scheduleRefresh();
    };
    openSheet({ tag: "Flag", title: o.titel, sub: "Sent as a direct email and stays at the top of the tab until it is resolved", body: [form],
      foot: [h("div"), h("div", { class: "foot-right" }, h("button", { class: "btn", type: "button", text: "Back", onclick: back }), h("button", { class: "btn primary", type: "button", text: "Flag and email", onclick: (e) => save(e.target) }))], focus: "f_flagtext" });
  }
  async function resolveFlag(f, text) {
    const now = new Date().toISOString();
    if (await write("flaggor", f._id, { status: "Löst", lostAv: myId, lostNamn: myName || "", lostT: now, lostText: text || "" })) { toast("The flag is resolved"); scheduleRefresh(); }
  }
  function flagRow(f) {
    const when = f.t ? fmtDate(String(f.t).slice(0, 10)) : "";
    const acts = h("div", { class: "fa" });
    const reset = () => acts.replaceChildren(h("button", { class: "btn small", type: "button", text: "Open", onclick: () => openFlagTarget(f) }), canWrite && db ? h("button", { class: "btn small primary", type: "button", text: "Resolve flag", onclick: () => ask() }) : null);
    const ask = () => { const i = h("input", { type: "text", placeholder: "What was done? (optional)", style: "min-width:200px" }); acts.replaceChildren(i, h("button", { class: "btn small primary", type: "button", text: "Mark flag as resolved", onclick: () => resolveFlag(f, i.value.trim()) }), h("button", { class: "btn small", type: "button", text: "Cancel", onclick: reset })); i.focus(); };
    reset();
    return h("div", { class: "flagrow" }, h("span", { class: "pill s-Problem", text: "Flag" }), h("div", null, h("div", { class: "ft" }, h("b", { text: f.titel || f.ref }), " – ", f.text || ""), h("div", { class: "fm", text: [f.avNamn ? "flagged by " + f.avNamn : "", when, (f.till || []).length ? "to " + f.till.map(personName).join(", ") : ""].filter(Boolean).join(" · ") })), acts);
  }
  // Försenad PO: flaggan är automatisk. "PO i lager" sätter PO:n som inlevererad (och stylarna på raderna som levererade), och då försvinner flaggan.
  async function markPoInWarehouse(p) {
    const cur = byId(D.po, p._id) || p; const now = new Date().toISOString(); const nr = cur.nr || cur._id;
    if (!(await write("po", cur._id, { status: "Inlevererad", andrad: now, logg: (cur.logg || []).concat(logEntry("Status: " + tv(poStatusNorm(cur.status)) + " → " + tv("Inlevererad") + " (PO in warehouse)")) }))) return;
    for (const r of cur.rader || []) {
      const st = r.styleId ? byId(D.styles, r.styleId) : null; if (!st) continue;
      if (!["Sampling", "Godkänd", "PO lagd", "I produktion"].includes(styleStatusNorm(st.status))) continue;
      const patch = { status: "Levererad", andrad: now, logg: (st.logg || []).concat(logEntry("Updated from PO " + nr + ": status Levererad")) };
      if (await write("styles", st._id, patch)) Object.assign(st, patch);
    }
    toast("PO " + nr + " is in the warehouse"); scheduleRefresh();
  }
  function lateRow(x) {
    const acts = h("div", { class: "fa" });
    const reset = () => acts.replaceChildren(h("button", { class: "btn small", type: "button", text: "Open PO", onclick: () => openPo(x.p._id) }), canWrite && db ? h("button", { class: "btn small", type: "button", text: "Change drop", title: "Move the PO to another drop – it is then measured against that drop's dates", onclick: () => { openPo(x.p._id); setTimeout(() => { const el = $("f_pdrop"); if (el) { el.scrollIntoView({ block: "center" }); el.focus(); } }, 120); } }) : null, canWrite && db ? h("button", { class: "btn small primary", type: "button", text: "PO in warehouse", title: "Marks the PO as delivered – that resolves the flag", onclick: () => ask() }) : null);
    const ask = () => acts.replaceChildren(h("span", { class: "sub", text: "Has the delivery arrived at the warehouse?" }), h("button", { class: "btn small primary", type: "button", text: "Yes, in warehouse", onclick: async (e) => { e.target.disabled = true; await markPoInWarehouse(x.p); } }), h("button", { class: "btn small", type: "button", text: "Cancel", onclick: reset }));
    reset();
    return h("div", { class: "flagrow", dataset: { po: x.p._id } }, h("span", { class: "pill s-Problem", text: "Late" }), h("div", null, h("div", { class: "ft" }, h("b", { text: (x.p.nr || x.p._id) + (x.p.leverantor ? " · " + x.p.leverantor : "") }), " – ", poLateText(x.p, x.l)), h("div", { class: "fm", text: "Automatic flag. Resolve it with \"PO in warehouse\" once the delivery has arrived, or \"Change drop\" if the PO belongs to a later drop – it also clears by itself if the ETA is moved." })), acts);
  }
  function renderFlags() {
    const box = $("flagbox"); if (!box) return;
    const fs = flagsOpen(UI.tab); const late = UI.tab === "produktion" && !designOnly() ? latePos() : [];
    const ready = UI.tab === "produktion" ? readyToOrder() : [];
    if (!fs.length && !late.length && !ready.length) { box.hidden = true; box.replaceChildren(); }
    else if (!fs.length && !late.length) { box.replaceChildren(readyCard(ready)); box.hidden = false; }
    else {
      const n = fs.length + late.length;
      const card = h("section", { class: "card flagbox" }, h("div", { class: "card-head" }, h("h3", { text: "Flagged" }), h("span", { class: "sub", text: n + (n === 1 ? " item" : " items") + " that need resolving. They stay here until the problem is solved." })));
      for (const f of fs) card.append(flagRow(f));
      for (const x of late) card.append(lateRow(x));
      box.replaceChildren(...[card].concat(ready.length ? [readyCard(ready)] : [])); box.hidden = false;
    }
    const perTab = {}; for (const f of flagsOpen()) perTab[f.tab] = (perTab[f.tab] || 0) + 1;
    if (!designOnly() && latePos().length) perTab.produktion = (perTab.produktion || 0) + latePos().length;
    if (readyToOrder().length) perTab.produktion = (perTab.produktion || 0) + readyToOrder().length;
    document.querySelectorAll("#tabs .tab").forEach((b) => { const tn = b.querySelector(".tn"); if (tn) tn.dataset.flags = perTab[b.dataset.tab] ? String(perTab[b.dataset.tab]) : ""; });
    document.querySelectorAll("#areas .area").forEach((b) => { const n = (AREA_TABS[b.dataset.area] || []).filter(tabAllowed).reduce((a, t) => a + (perTab[t] || 0), 0); const el = b.querySelector("b"); if (el) el.dataset.flags = n ? String(n) : ""; });
  }
  // Flaggan syns också på själva saken, med en knapp för att lösa den där man står.
  const flagNote = (typ, ref) => { const fs = flagsFor(typ, ref); return fs.length ? h("div", { class: "flagnote" }, fs.map((f) => h("div", { style: "display:flex;gap:10px;align-items:baseline;justify-content:space-between;flex-wrap:wrap" }, h("span", null, h("b", { text: (f.avNamn ? "Flagged by " + f.avNamn : "Flagged") + ": " }), f.text || ""), canWrite && db ? h("button", { class: "btn small", type: "button", text: "Mark flag as resolved", onclick: async (e) => { const row = e.target.parentElement; e.target.disabled = true; await resolveFlag(f, ""); row.remove(); } }) : null))) : null; };

  // ---------- sheet ----------
  let sheetCtx = null;
  function openSheet(o) {
    if (o.flagRef && o.flagRef.ref) {
      const note = flagNote(o.flagRef.typ, o.flagRef.ref); if (note) o.body = [note].concat(o.body);
      if (canWrite && db && o.foot && o.foot[0]) o.foot[0].append(h("button", { class: "btn small", type: "button", text: "⚑ Flag", title: "Send a flag with a comment – direct email to the people you choose", onclick: () => openFlag(o.flagRef) }));
    }
    $("sheetTag").textContent = tv(o.tag || ""); $("sheetTag").hidden = !o.tag;
    $("sheetTitle").textContent = o.title || "";
    $("sheetSub").textContent = tv(o.sub || ""); $("sheetSub").hidden = !o.sub;
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
      const reset = () => left.replaceChildren(h("button", { class: "btn small danger", type: "button", text: o.del || "Delete", disabled: !o.canDelete, title: o.canDelete ? "Deletes the whole item for everyone – not just the flag" : o.blockText || "Cannot be removed while something is linked to it", onclick: () => ask() }));
      const ask = () => left.replaceChildren(h("span", { class: "confirm" }, h("span", { text: (o.del || "Delete") + " for everyone? This cannot be undone." }), h("button", { class: "btn small danger", type: "button", text: "Yes, delete", onclick: o.onDelete }), h("button", { class: "btn small", type: "button", text: "Keep", onclick: reset })));
      reset();
    }
    const right = h("div", { class: "foot-right" }, h("button", { class: "btn", type: "button", text: "Cancel", onclick: closeSheet }));
    if (o.onSave && canWrite && db) right.append(h("button", { class: "btn primary", type: "button", id: "btnSave", text: o.saveLabel || "Save", onclick: o.onSave }));
    return [left, right];
  }
  const lock = (form) => form.querySelectorAll("input, select, textarea").forEach((x) => (x.disabled = true));

  // ---------- sample sheet ----------
  const S_LABELS = { sasong: "Intended season", markt: "Physically labelled", mattGodkanda: "Measurements approved", mattKommentar: "Measurement comment", styleId: "Style", version: "Version", leverantor: "Supplier", farg: "Colour", tygId: "Tyg", storlek: "Size", prisBelopp: "Price", prisValuta: "Currency", status: "Status", bestalld: "Beställd", ledtid: "Lead time", forvantad: "Expected delivery", mottagen: "Mottagen", tracking: "Tracking", p1Skickad: "Reminder 1", p2Skickad: "Reminder 2", platsTyp: "Location", hangare: "Hängare", platsNotering: "Location note", beslut: "Decision", andringar: "Changes", kommentar: "Comment", utvarderad: "Evaluated" };
  const S_INPUTS = { status: "f_status", mottagen: "f_mottagen", p1Skickad: "f_p1", p2Skickad: "f_p2", beslut: "f_beslut", markt: "f_markt", mattGodkanda: "f_matt" };

  async function createStyleQuick(name, lev) {
    const id = await freshId("styles", D.styles, "ST-", 3);
    const body = { id, namn: name, leverantor: lev, sasong: "", drop: "", typ: "Nyhet", status: "Sampling", klartSenast: null, fotoSenast: null, farger: [], storlekar: [], ean: [], kommentar: "", logg: [logEntry("Style created from a sample")], andrad: new Date().toISOString() };
    if (!(await create("styles", id, body))) return null;
    if (!byId(D.styles, id)) D.styles.push(Object.assign({}, body, { _id: id }));
    return id;
  }
  async function resolveTyg(name, lev) {
    if (!name) return null;
    const hit = D.tyger.find((t) => norm(t.namn) === norm(name));
    if (hit) return hit._id;
    const id = await freshId("fabrics", D.tyger, "T-", 3);
    const body = { id, namn: name, leverantor: lev || "", status: "", aterDatum: null, kommentar: "", andrad: new Date().toISOString() };
    if (!(await create("tyger", id, body))) return null;
    if (!byId(D.tyger, id)) D.tyger.push(Object.assign({}, body, { _id: id }));
    return id;
  }
  async function approveStyleFrom(sample) {
    const x = byId(D.styles, sample.styleId);
    if (x && x.status === "Sampling") {
      await write("styles", x._id, { status: "Godkänd", logg: (x.logg || []).concat(logEntry("Approved via " + sample._id + (sample.version ? " (" + sample.version + ")" : ""))), andrad: new Date().toISOString() });
      toast("The style " + x.namn + " is approved – it is now under Production as ready to order");
    }
  }

  function openSample(id, preset) {
    if (designOnly()) return;
    const isNew = !id;
    let s;
    if (isNew) {
      s = Object.assign({ _id: null, status: "Beställd", bestalld: todayISO(), version: "Proto 1", logg: [] }, preset || {});
      if (s.leverantor && s.ledtid == null) { const sl = levNum(s.leverantor, "sampleLedtid"); if (sl != null) { s.ledtid = sl; s.forvantad = addDays(s.bestalld, sl); } }
    } else { s = byId(D.samples, id); if (!s) { toast("Cannot find " + id + "."); return; } }
    const ro = !canWrite || !db;
    const styleOpts = [["", "– No style –"]].concat(D.styles.slice().sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv")).map((x) => [x._id, x.namn + (x.leverantor ? " · " + x.leverantor : "")]));
    if (!ro) styleOpts.push(["__ny", "+ New style …"]);
    const fStyle = selectEl("f_style", styleOpts, s.styleId || "");
    const fNewStyle = inp("f_newstyle", "", { placeholder: "Name of the new style" });
    const newWrap = field("New style", fNewStyle, { full: true }); newWrap.hidden = true;
    const fVersion = selectEl("f_version", VERSIONS, s.version || "Proto 1");
    const fLev = inp("f_lev", s.leverantor, { list: "dlLev", autocomplete: "off" });
    const fFarg = colourPicker("f_farg", sampleColours(s), ro);
    const fTyg = inp("f_tyg", tygName(s), { list: "dlTyg", autocomplete: "off", placeholder: "e.g. Japan Blue inhouse – Westpoint Canvas 223" });
    const fStorlek = inp("f_storlek", s.storlek, { placeholder: "e.g. M or 50" });
    const fSas = seasonSelect("f_ssas", s.sasong, "– Same as the style –");
    const fPris = inp("f_pris", s.prisBelopp, { type: "number", step: "0.01", min: "0", inputmode: "decimal" });
    const fValuta = selectEl("f_valuta", [["", "–"], "SEK", "EUR", "JPY", "GBP", "USD"], s.prisValuta || "");
    const fStatus = selectEl("f_status", SAMPLE_STATUS, s.status || "Beställd");
    const fBest = inp("f_bestalld", s.bestalld, { type: "date" });
    const fLed = inp("f_ledtid", s.ledtid, { type: "number", min: "0", step: "1" });
    const fForv = inp("f_forvantad", s.forvantad, { type: "date" });
    const fMott = inp("f_mottagen", s.mottagen, { type: "date" });
    const fTrack = inp("f_tracking", s.tracking, { placeholder: "Carrier and tracking number" });
    const fP1 = inp("f_p1", s.p1Skickad, { type: "date" });
    const fP2 = inp("f_p2", s.p2Skickad, { type: "date" });
    const fPlats = selectEl("f_plats", [["", "–"]].concat(PLATSER), s.platsTyp || "");
    const fHang = inp("f_hangare", s.hangare, { inputmode: "numeric", placeholder: "e.g. 12" });
    const fPNot = inp("f_platsnot", s.platsNotering, { placeholder: "Who or where, e.g. Carl is testing" });
    const fBeslut = selectEl("f_beslut", [["", "–"]].concat(BESLUT), s.beslut || "");
    const fMarkt = selectEl("f_markt", [["", "No – not labelled yet"], ["1", "Yes, labelled with ID"]], s.markt ? "1" : "");
    const fMatt = selectEl("f_matt", [["", "– not measured yet"], ["1", "YES – measurements approved"], ["0", "NO – measurements deviate"]], s.mattGodkanda === true ? "1" : s.mattGodkanda === false ? "0" : "");
    const fMattKom = inp("f_mattkom", s.mattKommentar, { placeholder: "e.g. sleeve 2 cm too long, waist ok" });
    const fAndr = area("f_andringar", s.andringar, "What should be corrected for the next round");
    const fKom = area("f_kommentar", s.kommentar);
    const ledHint = h("span", { class: "hint" });
    const hangWrap = field("Hanger / hook no.", fHang);
    const syncLedHint = () => { const n = fLev.value.trim(); const sl = levNum(n, "sampleLedtid"); const a = actualLead(n); ledHint.textContent = n ? "Standard " + (sl != null ? sl + " d" : "saknas") + (a ? " · actual average " + a.avg + " d (" + a.n + ")" : "") : ""; };
    const fillLead = () => { const sl = levNum(fLev.value.trim(), "sampleLedtid"); if (sl != null && !fLed.value) fLed.value = sl; if (!fForv.value && fBest.value && Number(fLed.value) > 0) fForv.value = addDays(fBest.value, Number(fLed.value)); };
    const syncPlats = () => { const isH = fPlats.value === "Hängare" || fPlats.value === "Fotohäng"; fHang.disabled = ro || !isH; hangWrap.classList.toggle("dim", !isH); };
    fStyle.addEventListener("change", () => { newWrap.hidden = fStyle.value !== "__ny"; if (!newWrap.hidden) fNewStyle.focus(); const x = byId(D.styles, fStyle.value); if (x && !fLev.value.trim()) { fLev.value = x.leverantor || ""; syncLedHint(); if (isNew) fillLead(); } });
    fLev.addEventListener("change", () => { syncLedHint(); if (isNew) fillLead(); });
    fLed.addEventListener("change", () => { if (fBest.value && Number(fLed.value) > 0 && !fForv.value) fForv.value = addDays(fBest.value, Number(fLed.value)); });
    fStatus.addEventListener("change", () => { if (fStatus.value === "Mottagen" && !fMott.value) fMott.value = todayISO(); });
    fPlats.addEventListener("change", () => { syncPlats(); if (fPlats.value === "Hängare" || fPlats.value === "Fotohäng") fHang.focus(); });

    const form = h("form", { class: "form", id: "sampleForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("h3", { class: "sec-title full", text: "Product" }),
      field("Style", fStyle, { full: true }), newWrap,
      field("Version", fVersion), field("Supplier", fLev),
      h("div", { class: "field" }, h("label", { for: "f_farg", text: "Colour" }), fFarg.el), field("Size", fStorlek),
      field("Tyg", fTyg, { hint: "Type freely or choose a fabric that already exists." }), field("Intended season", fSas, { hint: "Which collection the sample is aimed at – drives prioritisation" }),
      field("Price", fPris), field("Currency", fValuta),
      h("h3", { class: "sec-title full", text: "Delivery" }),
      field("Status", fStatus), field("Beställd", fBest),
      h("div", { class: "field" }, h("label", { for: "f_ledtid", text: "Lead time (days)" }), fLed, ledHint),
      field("Expected delivery", fForv, { hint: "Empty = TBA" }),
      field("Mottagen", fMott), field("Tracking", fTrack),
      field("Reminder 1 sent", fP1), field("Reminder 2 sent", fP2),
      h("h3", { class: "sec-title full", text: "Where is the sample?" }),
      field("Physically labelled", fMarkt, { hint: "Write the ID on the sample when it arrives" }), field("Location", fPlats), hangWrap,
      field("Note", fPNot, { full: true }),
      h("h3", { class: "sec-title full", text: "Measurements" }),
      field("Measurements approved", fMatt, { hint: "Measure as soon as the sample arrives" }), field("Measurement comment", fMattKom),
      h("h3", { class: "sec-title full", text: "Evaluation" }),
      field("Decision", fBeslut),
      field("Changes for the next round", fAndr, { full: true }),
      field("Comment", fKom, { full: true }));
    if (ro) lock(form);
    syncLedHint(); syncPlats();

    const quick = h("div", { class: "quick" });
    const remind = h("div", { class: "warnline", style: "margin:0" });
    const planBox = h("div", { class: "planline" });
    const imgSec = h("section");
    function renderImages() {
      imgSec.replaceChildren(h("h3", { class: "sec-title", text: "Images" }));
      if (isNew) { imgSec.append(h("p", { class: "hint", text: "Save the sample first, then you can add images. The images are shown to Carl under Collection." })); return; }
      const cur = current() || s;
      const ids = sampleImages(cur);
      if (ids.length) imgSec.append(gallery(ids, { onRemove: ro || !assets ? null : async (id) => { if (!confirm("Remove the image for everyone?")) return; const left = ids.filter((x) => x !== id); if (await write("samples", cur._id, { bilder: left, andrad: new Date().toISOString() })) { try { await assets.delete(id); } catch (e) {} } } }));
      else imgSec.append(h("p", { class: "hint", text: "No images yet. Take a picture of the sample when it arrives – preferably on a bust or hanger, straight from the front." }));
      if (!ro && assets) imgSec.append(imageDrop(async (files) => { imgSec.append(h("p", { class: "hint", id: "imgBusy", text: "Uploading " + files.length + " image(s) …" })); const got = await uploadImages(files); const c2 = current() || cur; if (got.length) await write("samples", c2._id, { bilder: sampleImages(c2).concat(got), andrad: new Date().toISOString(), logg: (c2.logg || []).concat(logEntry(got.length + (got.length === 1 ? " image added" : " images added"))) }); renderImages(); }));
      else if (!ro && !assets) imgSec.append(h("p", { class: "hint", text: "Images can only be uploaded by someone with Editor access to the app." }));
    }
    function renderRemind() {
      const cur = current();
      remind.hidden = true;
      if (!cur) return;
      const bits = [];
      if (!cur.markt) bits.push(cur.status === "Mottagen" || cur.status === "Problem" ? "The sample is not labelled – write " + cur._id + " on it and press \"Labelled with ID\"." : "Label the sample with " + cur._id + " as soon as it arrives.");
      if (cur.status === "Mottagen" && (cur.mattGodkanda == null || cur.mattGodkanda === "")) bits.push("The measurements have not been checked.");
      if (cur.status === "Mottagen" && !sampleImages(cur).length) bits.push("No image yet.");
      if (bits.length) { remind.hidden = false; remind.textContent = bits.join(" "); }
    }
    const logUl = h("ul", { class: "log" });
    const noteIn = attachMentions(inp("f_note", "", { placeholder: NOTE_PH, autocomplete: "off" }));
    noteIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } });
    const noteRow = h("div", { class: "add-note" }, noteIn, h("button", { class: "btn small", type: "button", text: "Add", onclick: () => addNote() }));
    const current = () => (isNew ? null : byId(D.samples, s._id));

    function renderPlanLine() {
      const x = byId(D.styles, (current() || s).styleId);
      if (!x) { planBox.hidden = true; return; }
      planBox.hidden = false;
      const p = plan(x);
      planBox.replaceChildren(lagePill(p), h("span", { text: x.namn + (p.po ? " · PO by " + fmtDate(p.po) + " (" + fmtDays(p.poDays) + ")" : p.note ? " · " + p.note : "") }), h("button", { class: "linkish", type: "button", text: "Open style", onclick: () => openStyle(x._id) }));
    }
    function renderQuick() {
      const cur = current();
      quick.replaceChildren();
      if (!cur || ro) { quick.hidden = true; return; }
      quick.hidden = false;
      const add = (label, fn, primary) => quick.append(h("button", { class: "btn small" + (primary ? " primary" : ""), type: "button", text: label, onclick: fn }));
      if (isWaiting(cur) || cur.status === "Problem") add("Received today", () => quickUpdate(cur, { status: "Mottagen", mottagen: todayISO() }, "Marked received. Enter the hanger below."), true);
      if (cur.status === "Beställd") add("Skickad", () => quickUpdate(cur, { status: "Skickad" }, "Marked shipped"));
      const r = remindDue(cur);
      if (r) add("Reminder " + r + " sent", () => quickUpdate(cur, r === 1 ? { p1Skickad: todayISO() } : { p2Skickad: todayISO() }, "Reminder " + r + " noted"));
      if (cur.status === "Mottagen" && beslutNorm(cur.beslut) !== "Godkänd") add("Approve", async () => { if (await quickUpdate(cur, { beslut: "Godkänd", utvarderad: true }, "Godkänd")) await approveStyleFrom(cur); }, true);
      if (cur.status === "Mottagen" || cur.beslut) add("Ny runda", () => newRound(cur));
      if (isArchived(cur)) add("Pick up again", () => restoreSample(cur), true);
      if (["Mottagen", "Problem"].includes(cur.status) && beslutNorm(cur.beslut) !== "Pausad") add("Pause → archive", () => quickUpdate(cur, { beslut: "Pausad", utvarderad: true }, "Paused – in the Archive"));
      if (["Mottagen", "Problem"].includes(cur.status) && beslutNorm(cur.beslut) !== "Kastad") add("Drop → archive", () => quickUpdate(cur, { beslut: "Kastad", utvarderad: true }, "Dropped – in the Archive"));
      if (cur.status !== "Problem" && cur.status !== "Mottagen") add("Flag problem", () => openFlag({ typ: "sample", ref: cur._id, titel: cur._id + " " + styleName(cur) + (cur.version ? " · " + cur.version : ""), tab: "samples", after: (text) => { const c2 = byId(D.samples, cur._id) || cur; return write("samples", cur._id, { status: "Problem", andrad: new Date().toISOString(), logg: (c2.logg || []).concat(logEntry("Flagged as a problem: " + text)) }); } }));
      if (!cur.markt) add("Labelled with ID", () => quickUpdate(cur, { markt: true }, cur._id + " is labelled"), unmarked(cur));
      if (cur.status === "Mottagen" && (cur.version === "Fotosample" || cur.version === "Produktionssample") && cur.platsTyp !== "Fotohäng") add("Hang on the photo rail", () => quickUpdate(cur, { platsTyp: "Fotohäng" }, "Now on the photo rail – enter the hook no. below"));
      add("Print label", () => openLabels([cur._id]));
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
      const ok = Object.keys(patch).length ? await quickUpdate(cur, patch, "Picked up from the archive") : true;
      if (ok && stx && ["Pausad", "Kastad"].includes(styleStatusNorm(stx.status))) { await write("styles", stx._id, { status: "Sampling", andrad: new Date().toISOString(), logg: (stx.logg || []).concat(logEntry("Picked up from the archive via " + cur._id + " – status Sampling")) }); toast("The sample and the style " + stx.namn + " have been picked up from the archive"); }
    }
    async function newRound(cur) {
      const sl = levNum(cur.leverantor, "sampleLedtid");
      const today = todayISO();
      const nid = await freshId("samples", D.samples, "S", 3);
      const body = { id: nid, styleId: cur.styleId || null, produkt: styleName(cur), version: nextVersion(cur.version), leverantor: cur.leverantor || "", farg: cur.farg || "", tygId: cur.tygId || null, material: cur.material || "", storlek: cur.storlek || "", prisBelopp: null, prisValuta: cur.prisValuta || null, bestalld: today, ledtid: sl, forvantad: sl != null ? addDays(today, sl) : null, status: "Beställd", mottagen: null, tracking: "", p1Skickad: null, p2Skickad: null, kommentar: cur.andringar ? "Changes from " + cur._id + ": " + cur.andringar : "", andringar: "", beslut: "", utvarderad: false, platsTyp: "", hangare: "", platsNotering: "", logg: [logEntry("New round after " + cur._id + (cur.version ? " (" + cur.version + ")" : ""))], andrad: new Date().toISOString() };
      if (!(await create("samples", nid, body))) return;
      const patch = { logg: (cur.logg || []).concat(logEntry("New round ordered: " + nid)), andrad: new Date().toISOString() };
      if (!cur.beslut) { patch.beslut = "Ny runda"; patch.utvarderad = true; }
      await write("samples", cur._id, patch);
      if (!byId(D.samples, nid)) D.samples.push(Object.assign({}, body, { _id: nid }));
      toast(nid + " created as " + body.version);
      openSample(nid);
    }
    async function addNote() { await addComment("samples", current(), noteIn); }
    async function save() {
      const btn = $("btnSave"); if (btn) btn.disabled = true;
      try {
        const lev = fLev.value.trim();
        if (!lev) { toast("Fill in supplier."); fLev.focus(); return; }
        let styleId = fStyle.value;
        if (styleId === "__ny") {
          const nm = fNewStyle.value.trim();
          if (!nm) { toast("Type the name of the new style."); fNewStyle.focus(); return; }
          styleId = await createStyleQuick(nm, lev);
          if (!styleId) return;
        }
        const st = byId(D.styles, styleId);
        const tygId = await resolveTyg(fTyg.value.trim(), lev);
        const o = {
          styleId: styleId || null, produkt: st ? st.namn : (s.produkt || ""), version: fVersion.value, leverantor: lev, farg: fFarg.get().join(", "), farger: fFarg.get(), tygId, storlek: fStorlek.value.trim(), sasong: fSas.value.trim(),
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
          const body = Object.assign({ id: nid, material: "", utvarderad: !!o.beslut, bilder: [], logg: [logEntry("Sample created (" + o.status + ")")], andrad: now }, o);
          if (await create("samples", nid, body)) {
            if (!byId(D.samples, nid)) D.samples.push(Object.assign({}, body, { _id: nid }));
            toast(nid + " saved – label the sample with " + nid + " when it arrives");
            if (o.beslut === "Godkänd") await approveStyleFrom(Object.assign({ _id: nid }, o));
            if (st && isIdea(st)) await write("styles", st._id, { status: "Sampling", andrad: now, logg: (st.logg || []).concat(logEntry("First sample ordered (" + nid + ") – the idea is now in sampling")) });
            openSample(nid);
          }
        } else {
          const cur = current() || s;
          const changes = describeChanges(cur, o, S_LABELS);
          if (!changes.length) { closeSheet(); return; }
          const body = Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) });
          if (await write("samples", cur._id, body)) { toast("Saved"); if (o.beslut === "Godkänd" && cur.beslut !== "Godkänd") await approveStyleFrom(Object.assign({}, cur, o)); closeSheet(); }
        }
      } finally { if (btn) btn.disabled = false; }
    }

    const body = [quick, remind, planBox, imgSec, form];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "History" }), logUl, ro ? null : noteRow));
    openSheet({
      flagRef: isNew ? null : { typ: "sample", ref: s._id, titel: s._id + " " + styleName(s) + (s.version ? " · " + s.version : ""), tab: "samples" },
      tag: isNew ? "New" : s._id,
      title: isNew ? "New sample" : styleName(s) + (s.version ? " · " + s.version : ""),
      sub: isNew ? "" : [s.farg, s.leverantor, platsText(s)].filter(Boolean).join(" · "),
      body,
      foot: footButtons({ del: "Delete sample", onDelete: isNew ? null : async () => { if (await remove("samples", s._id)) { toast("Removed"); closeSheet(); } }, canDelete: true, onSave: save }),
      ctx: { refresh: () => { if (!isNew && !current()) { closeSheet(); return; } renderQuick(); renderRemind(); renderPlanLine(); renderImages(); if (!isNew) renderLogInto(logUl, (current() || s).logg); } },
      focus: isNew ? "f_style" : null
    });
    renderQuick(); renderRemind(); renderPlanLine(); renderImages();
    if (!isNew) renderLogInto(logUl, s.logg);
  }

  // ---------- style sheet ----------
  const ST_LABELS = { shopifyBild: "Shopify image", ecomBilder: "E-com images", ecomPlatDatum: "E-com shoot", kampanjStatus: "Campaign shoot", kampanjDatum: "Campaign shoot date", bildId: "Main image", namn: "Name", leverantor: "Supplier", sasong: "Season", drop: "Drop", typ: "Typ", kategori: "Category", status: "Status", klartSenast: "In stock by", fotoSenast: "Photo sample by", kommentar: "Comment", farger: "Colours", storlekar: "Sizes", beskrivning: "Description", tygId: "Tyg", grund: "Base style", grundId: "Variant of", mattFran: "Measurements from", mattlista: "Measurement list", referenser: "References" };
  function openStyle(id, preset, opts) {
    const isNew = !id;
    // Bibliotek är Carls flik: bara det som rör plagget. Planering, foto, e-com, EAN, Shopify och inköp sköts i sina flikar.
    const lean = UI.tab === "bibliotek" && !(opts && opts.full);
    if (designOnly()) { if (id) openDesign(id); return; }
    const st = isNew ? Object.assign({ _id: null, status: "Sampling", typ: "Nyhet", farger: [], storlekar: [], ean: [], bilder: [], logg: [] }, preset || {}) : byId(D.styles, id);
    if (!st) { toast("Cannot find " + id + "."); return; }
    const ro = !canWrite || !db;
    const current = () => (isNew ? st : byId(D.styles, st._id) || st);
    const fNamn = inp("f_snamn", st.namn);
    const fBesk = area("f_sbesk", st.beskrivning, "What kind of garment is it? Fit, details, feel, what differs from earlier versions …");
    // Samma urval som "Använd mått från": alla styles. Den som väljs blir grundstyle (ingen bock behövs).
    const grundOpts = [["", "– None, own style –"]].concat(D.styles.filter((x) => x._id !== st._id && !(st._id && x.grundId === st._id) && (x._id === st.grundId || styleStatusNorm(x.status) !== "Kastad"))
      .sort((a, b) => (isGrund(b) ? 1 : 0) - (isGrund(a) ? 1 : 0) || (a.namn || "").localeCompare(b.namn || "", "sv") || seasonRank(b.sasong) - seasonRank(a.sasong))
      .map((x) => [x._id, x.namn + (x.sasong ? " · " + x.sasong : "") + (isGrund(x) ? " · base style" : "")]));
    const fGrund = selectEl("f_sgrund", grundOpts, st.grundId || "");
    const fLev = inp("f_slev", st.leverantor, { list: "dlLev", autocomplete: "off" });
    const fTyg = inp("f_styg", styleTyg(st), { list: "dlTyg", autocomplete: "off", placeholder: "e.g. Japan Blue inhouse – Westpoint Canvas 223" });
    const fSas = seasonSelect("f_ssasong", st.sasong);
    const fDrop = dropSelect("f_sdrop", st.drop, fSas);
    const fTyp = selectEl("f_styp", STYLE_TYP, st.typ || "Nyhet");
    const fKat = selectEl("f_skat", [["", "– choose –"]].concat(KATEGORIER), styleKategori(st));
    const fStatus = selectEl("f_sstatus", STYLE_STATUS, styleStatusNorm(st.status));
    const fKlart = inp("f_sklart", st.klartSenast, { type: "date" });
    const fFoto = inp("f_sfoto", st.fotoSenast, { type: "date" });
    const fEcom = selectEl("f_secom", ECOM_STATUS.map((x) => [x, x || "– not planned"]), st.ecomBilder || "");
    const fEcomD = inp("f_secomd", st.ecomPlatDatum, { type: "date" });
    const fKamp = selectEl("f_skamp", KAMP_STATUS.map((x) => [x, x || "– no campaign"]), st.kampanjStatus || "");
    const fKampD = inp("f_skampd", st.kampanjDatum, { type: "date" });
    const fKom = area("f_skom", st.kommentar);
    const fInk = inp("f_sink", st.inkopspris, { type: "number", min: "0", step: "0.01", inputmode: "decimal", placeholder: "per unit" });
    const fInkV = selectEl("f_sinkv", [["", "– currency –"]].concat(CURS.concat(["SEK"]).map((c) => [c, c])), st.inkopsValuta || ((levByName(st.leverantor) || {}).valuta || ""));
    const mattOpts = [["", "– Own measurement list below –"]]
      .concat(D.styles.filter((x) => x._id !== st._id && !["Kastad"].includes(styleStatusNorm(x.status))).sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv")).map((x) => [x._id, x.namn + (x.sasong ? " · " + x.sasong : "") + " (style)"]))
      .concat(D.samples.filter((x) => x.mattGodkanda === true || x.status === "Mottagen").sort((a, b) => styleName(a).localeCompare(styleName(b), "sv")).map((x) => [x._id, styleName(x) + (x.version ? " · " + x.version : "") + " (" + x._id + ")"]));
    const fMattFran = selectEl("f_smattfran", mattOpts, st.mattFran || "");
    const fMatt = area("f_smatt", st.mattlista, "One line per measurement, e.g.\nChest (M) 56\nSleeve length 64\nBack length 72");
    const fRef = area("f_sref", st.referenser, "Reference garments, links, inspiration …");
    const fShop = inp("f_sshop", shopUrl(st), { placeholder: "https://cdn.shopify.com/… or the product page's image URL" });
    const dropHint = h("span", { class: "hint" });
    const syncDropHint = () => { const d = dropOf({ sasong: fSas.value.trim(), drop: fDrop.value.trim() }); dropHint.textContent = fDrop.value.trim() ? (d ? (isISO(d.lansering) ? "Launch " + fmtDate(d.lansering) + " · in stock by " + fmtDate(d.klartSenast) : isISO(d.klartSenast) ? "In stock by " + fmtDate(d.klartSenast) : "The drop has no launch date under Launches yet") : "Not a drop in " + (fSas.value.trim() || "the season") + " – set it up under Collection or Launches") : "Optional. Choose only a season if the drop is not decided."; };
    const grundHint = h("span", { class: "hint" });
    const hasVariants = () => !isNew && D.styles.some((v) => v.grundId === st._id);
    const syncGrund = () => { const g = byId(D.styles, fGrund.value); const own = !!st.grund || hasVariants(); grundHint.textContent = g ? "Variant of " + g.namn + ". Inherits name, category and measurements from it if the fields are empty." : own ? "This style is itself the base style for other styles." : "Choose the garment this is a variant of – the chosen style becomes a base style."; fGrund.disabled = ro || own; if (own) fGrund.value = ""; };
    fGrund.addEventListener("change", () => { let g = byId(D.styles, fGrund.value); const root = g ? grundOf(g) : null; if (root && root._id !== st._id) { toast(g.namn + (g.sasong ? " " + g.sasong : "") + " is already a variant of the base style " + root.namn + " – linking to that instead."); fGrund.value = root._id; g = root; } if (g) { if (!fNamn.value.trim()) fNamn.value = g.namn; if (!fKat.value && g.kategori) fKat.value = g.kategori; if (!fLev.value.trim() && g.leverantor) fLev.value = g.leverantor; if (!fMattFran.value && fMatt.value.trim() === "") fMattFran.value = g._id; } syncGrund(); });
    const form = h("form", { class: "form", id: "styleForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("h3", { class: "sec-title full", text: "Product" }),
      field("Name", fNamn, { full: true }),
      field("Description", fBesk, { full: true }),
      h("div", { class: "field full" }, h("label", { for: "f_sgrund", text: "Base style" }), fGrund, grundHint),
      field("Category", fKat, { hint: "Controls the size scale and budget box" }), field("Supplier", fLev),
      field("Tyg", fTyg, { full: true, hint: "Type freely or choose a fabric that already exists under Stock." }),
      field("Season", fSas), h("div", { class: "field" }, h("label", { for: "f_sdrop", text: "Drop" }), fDrop, dropHint),
      field("Type", fTyp, { hint: "Restock and NOOS do not need a new sample" }), field("Status", fStatus, { hint: "Idea not ready → Ready for design (Conor) → Sample can be ordered (Alex) → Sampling → Approved → PO placed …" }),
      h("h3", { class: "sec-title full", text: "Measurements" }),
      field("Use measurements from", fMattFran, { full: true, hint: "Refer to a garment whose measurements should be used, or write your own measurement list." }),
      hostedMattField(fMatt, fMattFran),
      field("Measurement list", fMatt, { full: true }),
      h("h3", { class: "sec-title full", text: "References" }),
      field("References and links", fRef, { full: true }),
      lean ? null : field("Image from Shopify (URL)", fShop, { full: true, hint: st.shopifyBild ? "Fetched from " + shopTitle(st) + (st.shopifyBild.handle ? " – atemporubato.com/products/" + st.shopifyBild.handle : "") + ". Used when the style has no images of its own; clear the field to remove." : "Paste an image URL from Shopify as a placeholder until there are own images." }),
      ...(lean ? [] : [h("h3", { class: "sec-title full", text: "Planning" }),
      field("In stock by", fKlart, { hint: "Empty = the drop's date is used" }), field("Photo sample by", fFoto, { hint: "Optional" }),
      h("h3", { class: "sec-title full", text: "Photo and e-com" }),
      field("E-com images", fEcom, { hint: "Oliver's status" }), field("E-com shoot, date", fEcomD),
      field("Campaign shoot", fKamp), field("Campaign shoot, date", fKampD)]),
      field("Comment", fKom, { full: true }),
      lean && !isNew ? h("p", { class: "hint full" }, "Planning, photo, e-com, EAN, Shopify and purchasing are handled in their own tabs. ", h("button", { class: "linkish", type: "button", text: "Show the whole style", onclick: () => openStyle(st._id, null, { full: true }) })) : null,
      canSeeMoney() && !lean ? h("h3", { class: "sec-title full", text: "Purchasing" }) : null,
      canSeeMoney() && !lean ? field("Purchase price per unit", fInk, { hint: st.inkopsKalla ? "Source: " + st.inkopsKalla + (st.inkopsDatum ? " " + fmtDate(st.inkopsDatum) : "") : "In the supplier's currency – converted to SEK with the rates under Suppliers" }) : null,
      canSeeMoney() && !lean ? field("Currency", fInkV) : null);
    if (ro) lock(form);
    fSas.addEventListener("change", syncDropHint); fDrop.addEventListener("change", syncDropHint); syncDropHint(); syncGrund();
    const formState = () => ({ _id: st._id, namn: fNamn.value.trim(), beskrivning: fBesk.value.trim(), grund: !!st.grund, grundId: st.grund ? "" : fGrund.value, leverantor: fLev.value.trim(), sasong: fSas.value.trim(), drop: fDrop.value.trim(), typ: fTyp.value, kategori: fKat.value, status: fStatus.value, mattFran: fMattFran.value, mattlista: fMatt.value.trim(), referenser: fRef.value.trim(), shopifyBild: fShop.value.trim() ? (st.shopifyBild && st.shopifyBild.url === fShop.value.trim() ? st.shopifyBild : { url: fShop.value.trim(), titel: "", handle: "", likhet: "manuell", t: new Date().toISOString() }) : null, ecomBilder: fEcom.value, ecomPlatDatum: fEcomD.value || null, kampanjStatus: fKamp.value, kampanjDatum: fKampD.value || null, klartSenast: fKlart.value || null, fotoSenast: fFoto.value || null, kommentar: fKom.value.trim(), inkopspris: canSeeMoney() ? num(fInk.value) : st.inkopspris ?? null, inkopsValuta: canSeeMoney() ? fInkV.value : st.inkopsValuta || "", inkopsKalla: canSeeMoney() && num(fInk.value) !== num(st.inkopspris) ? (num(fInk.value) == null ? "" : myName || "manual") : st.inkopsKalla || "", inkopsDatum: canSeeMoney() && num(fInk.value) !== num(st.inkopspris) ? (num(fInk.value) == null ? "" : todayISO()) : st.inkopsDatum || "" });

    const prodSec = h("section");
    function renderPris() {
      if (isNew || !canSeeMoney()) return null;
      const cur = current(); const info = gm1Info(cur); const shop = shopifyOf(cur._id);
      if (!info && !shop.length) return null;
      const kv = (k, v) => h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v big" }, v));
      return h("div", null, h("h3", { class: "sec-title", text: "Price and margin" }),
        h("div", { class: "kvs" }, kv("Price incl. VAT", info ? fmtSEK(info.pris) + (cur.ecomPrisKalla ? " (" + cur.ecomPrisKalla + ")" : "") : "–"), kv("Net excl. VAT", info ? fmtSEK(info.netto) : "–"), kv("Cost", info && info.kostnad != null ? fmtSEK(info.kostnad) + (info.valuta !== "SEK" ? " (" + fmtCur(info.kostnadValuta, info.valuta) + ")" : "") : "–"), kv("GM1 today", info && info.kostnad != null ? h("span", { class: "pill " + gmClass(info.gm), text: fmtPct(info.gm, 1) }) : "cost missing"), kv("GM1 if " + (info ? info.valuta : "the currency") + " +" + stressPct() + " % against SEK", info && info.kostnad != null && info.valuta !== "SEK" ? h("span", { class: "pill " + gmClass(info.gmStress), text: fmtPct(info.gmStress, 1) }) : "–")),
        shop.length ? h("p", { class: "hint", text: "In Shopify: " + shop.map((p) => p.titel + " " + fmtSEK(p.pris)).join(" · ") }) : null);
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
        prodSec.append(h("h3", { class: "sec-title", text: "Production" }),
          h("div", { class: "kvs" }, kv("Total quantity", String(units)), kv("Per colour", Object.entries(perColor).map(([k, v]) => k + " " + v).join(", ") || "–"), kv("Average/unit", units ? fmtSEK(cost / units) : "–"), kv("Purchase value", fmtSEK(cost))),
          h("div", { class: "vscroll" }, h("table", { class: "prodrows" }, h("thead", null, h("tr", null, ["PO", "Colour", "Quantity", "Fabric/unit", "Unit price", "Cost", "Status", "ETA warehouse"].map((x) => h("th", { text: x })))),
            h("tbody", null, pl.map((x) => { const tr = h("tr", { style: "cursor:pointer", onclick: () => openPo(x.po._id) }, h("td", { class: "mono", text: x.po.nr || x.po._id }), h("td", { text: x.r.farg || "TBA" }), h("td", { class: "num", text: x.r.antal == null ? "?" : String(x.r.antal) }), h("td", { class: "num", text: num(x.r.tygkostnad) != null ? fmtSEK(x.r.tygkostnad) : "–" }), h("td", { class: "num", text: num(x.r.styckpris) != null ? fmtSEK(x.r.styckpris) : "–" }), h("td", { class: "num", text: fmtSEK(lineCost(x.r)) }), h("td", null, poStatusPill(x.po)), h("td", { class: "mono", text: poEta(x.po) ? fmtDate(poEta(x.po)) : "" })); return tr; })))),
          h("p", { class: "hint", text: "Click a row to open the PO. Cost = quantity × (unit price + fabric cost)." }));
        return;
      }
      const rows = Array.isArray(st.produktion) ? st.produktion : [];
      if (!rows.length) return;
      prodSec.append(h("h3", { class: "sec-title", text: "Production" + (st.produktionUppdaterad ? " · from Masterplaner " + fmtDate(st.produktionUppdaterad) : "") }),
        h("div", { class: "vscroll", style: "margin-top:0" }, h("table", { class: "prodrows" }, h("thead", null, h("tr", null, ["PO", "Colour", "Quantity", "Status", "ETA warehouse"].map((x) => h("th", { text: x })))),
          h("tbody", null, rows.map((r) => h("tr", null, h("td", { class: "mono", text: r.po || "" }), h("td", { text: r.farg || "" }), h("td", { class: "mono", text: r.antal == null ? "" : String(r.antal) }), h("td", { text: r.status || "" }), h("td", { class: "mono", text: isISO(r.eta) ? fmtDate(r.eta) : (r.eta || "") })))))));
    }

    const planSec = h("section");
    function renderPlan() {
      const cur = formState(); const p = plan(cur);
      planSec.replaceChildren(h("h3", { class: "sec-title", text: "Timeline" }), h("div", { class: "plan-head" }, lagePill(p), h("span", { class: "plan-note", text: p.note || "" })));
      if (["klar", "skip", "paus"].includes(p.lage) || !p.po) return;
      const rows = [
        ["In stock by" + (p.deadlineFrom === "drop" ? " (from " + cur.sasong + " " + cur.drop + ")" : ""), p.deadline, false, true],
        ["Freight " + p.frakt + " d → ready at the supplier", p.ex, false, true],
        ["Production " + p.prod + " d" + (p.buff ? " + buffer " + p.buff + " d" : "") + " → PO by", p.po, true, true],
        ["Evaluation " + p.utv + " d → sample in by", p.inne, false, (cur.typ || "Nyhet") === "Nyhet"],
        [p.sl != null ? "Sample lead time " + p.sl + " d → sample ordered by" : "Sample lead time missing for the supplier", p.best, false, (cur.typ || "Nyhet") === "Nyhet"]
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
        planSec.append(h("p", { class: ok ? "okline" : "warnline", text: ok ? "A photo sample will be in time for " + fmtDate(cur.fotoSenast) + "." : "No photo sample will be in time for " + fmtDate(cur.fotoSenast) + "." }));
      }
    }
    [fLev, fKlart, fStatus, fTyp, fFoto, fSas, fDrop].forEach((x) => x.addEventListener("change", () => { renderPlan(); renderEanTable(); }));
    fKlart.addEventListener("input", renderPlan);

    const pendingImgs = isNew ? [] : null;
    const ownImgs = bilderSection({ title: "Images and references", ro, pending: pendingImgs, current, hero: () => styleImage(current()), onHero: ro ? null : async (bid) => { await write("styles", current()._id, { bildId: bid, bildAuto: false, andrad: new Date().toISOString() }); },
      empty: "Sketches, reference images and photos of the garment. The first image becomes the main image in Collection and Ideas unless another is chosen.",
      save: (ids, logText) => { const cur = current(); return write("styles", cur._id, { bilder: ids, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry(logText)) }); } });
    const gallerySec = h("section");
    function renderGallery() {
      ownImgs.render();
      gallerySec.replaceChildren();
      if (isNew) return;
      const cur = current();
      const ids = uniq(samplesOfStyle(st._id).flatMap(sampleImages));
      if (!ids.length) return;
      gallerySec.append(h("h3", { class: "sec-title", text: "Images from samples (" + ids.length + ")" }));
      const hero = styleImage(cur);
      gallerySec.append(gallery(ids, { hero, onHero: ro ? null : async (bid) => { await write("styles", cur._id, { bildId: bid, bildAuto: false, andrad: new Date().toISOString() }); } }));
    }
    const varSec = h("section");
    function renderVariants() {
      varSec.replaceChildren();
      if (isNew) return;
      const cur = current();
      const g = grundOf(cur);
      if (g) { varSec.append(h("div", { class: "ideabanner" }, h("span", null, "Variant of the base style ", h("button", { class: "linkish", type: "button", text: g.namn, onclick: () => openStyle(g._id) })), h("span", { class: "sub", text: "· " + variantsOf(g._id).length + (variantsOf(g._id).length === 1 ? " variant in total" : " variants in total") }))); }
      const vs = variantsOf(cur._id);
      if (!isGrund(cur)) { if (!ro && !g) varSec.append(h("button", { class: "btn small", type: "button", text: "+ New variant of " + cur.namn, title: "Makes " + cur.namn + " a base style and creates a variant of it", onclick: () => openStyle(null, { grundId: cur._id, namn: cur.namn, kategori: cur.kategori || "", leverantor: cur.leverantor || "", storlekar: (cur.storlekar || []).slice(), mattFran: cur._id, status: ST_IDE, sasong: UI.bibliotek.season || "" }) })); return; }
      varSec.append(h("h3", { class: "sec-title", text: "Variants (" + vs.length + ")" }));
      if (vs.length) varSec.append(h("ul", { class: "mini" }, vs.map((v) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openStyle(v._id) }, tag(v._id), h("span", { class: "mini-main" }, h("strong", { text: v.namn }), h("span", { class: "sub", text: [v.sasong, v.drop, styleTyg(v), (v.farger || []).join(", ")].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, styleStatusPill(v)))))));
      else varSec.append(h("p", { class: "hint", text: "No variants yet. A variant is the same garment in a new collection, a new fabric or a new colourway." }));
      if (!ro) varSec.append(h("button", { class: "btn small", type: "button", text: "+ New variant of " + cur.namn, onclick: () => openStyle(null, { grundId: cur._id, namn: cur.namn, kategori: cur.kategori || "", leverantor: cur.leverantor || "", storlekar: (cur.storlekar || []).slice(), mattFran: cur._id, status: ST_IDE, sasong: UI.bibliotek.season || "" }) }));
    }
    const samplesSec = h("section");
    function renderSamples() {
      samplesSec.replaceChildren();
      if (isNew) return;
      const xs = samplesOfStyle(st._id);
      const ul = h("ul", { class: "mini" });
      for (const x of xs) {
        const e = x.status === "Mottagen" ? (x.mottagen ? "rec. " + fmtDate(x.mottagen) : "received") : expected(x) ? "expected " + fmtDate(expected(x)) : "TBA";
        ul.append(h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openSample(x._id) }, tag(x._id),
          h("span", { class: "mini-main" }, h("strong", { text: x.version || "–" }), h("span", { class: "sub", text: [x.farg, tygName(x), platsText(x)].filter(Boolean).join(" · ") })),
          h("span", { class: "mini-side" }, statusPill(x.status), beslutNorm(x.beslut) ? chip(beslutNorm(x.beslut), "b-" + slug(beslutNorm(x.beslut))) : null, h("span", { class: "sub mono", text: e })))));
      }
      if (!xs.length) ul.append(h("li", { class: "sub", text: "No samples yet." }));
      samplesSec.append(h("h3", { class: "sec-title", text: "Samples (" + xs.length + ")" }), ul);
      if (!ro) { const last = xs[xs.length - 1]; samplesSec.append(h("button", { class: "btn small", type: "button", text: "+ New sample for the style", onclick: () => openSample(null, { styleId: st._id, leverantor: current().leverantor || "", version: last ? nextVersion(last.version) : "Proto 1", tygId: last ? last.tygId : null }) })); }
      const tygIds = uniq(xs.map((x) => x.tygId));
      const tygChips = tygIds.map((id) => { const tt = byId(D.tyger, id); const s = stockText(id); return chip((tt ? tt.namn : id) + (s ? " · own stock: " + s : "")); });
      const loose = uniq(xs.filter((x) => !x.tygId).map((x) => x.material)).map((m) => chip(m));
      if (tygChips.length || loose.length) samplesSec.append(h("div", { class: "chips" }, h("span", { class: "sub", text: "Fabrics:" }), tygChips, loose));
    }

    const fFarger = inp("f_sfarger", (st.farger || []).join(", "), { placeholder: "e.g. Navy, Green" });
    const fPreset = selectEl("f_spreset", [["", "Choose scale …"]].concat(SIZE_PRESETS.map(([l, v]) => [v, l])), "");
    const fStorl = inp("f_sstorlekar", (st.storlekar || []).join(", "), { placeholder: "e.g. S, M, L, XL" });
    if (ro) [fFarger, fPreset, fStorl].forEach((x) => (x.disabled = true));
    fPreset.addEventListener("change", () => { if (fPreset.value) { fStorl.value = fPreset.value; fPreset.value = ""; renderEanTable(); } });
    fFarger.addEventListener("input", () => renderEanTable());
    fKat.addEventListener("change", () => { if (!fStorl.value.trim()) { const d = defaultSizes(fKat.value); if (d.length) { fStorl.value = d.join(", "); renderEanTable(); } } });
    fStorl.addEventListener("input", () => renderEanTable());
    const eanTable = h("div");
    const eanActions = h("div", { class: "ean-actions" });
    const eanSec = h("section");
    if (isNew) eanSec.append(h("h3", { class: "sec-title", text: "Variants and EAN" }), h("p", { class: "hint", text: "Save the style first." }));
    else eanSec.append(h("h3", { class: "sec-title", text: "Variants and EAN" }), h("div", { class: "form" }, field("Colours", fFarger, { full: true, hint: "Separate with commas, as they should be named in Shopify" }), field("Size scale", fPreset), field("Sizes", fStorl)), eanTable, eanActions);
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
      if (!rows.length) eanTable.append(h("p", { class: "hint", text: "Fill in colours and sizes and the variants are shown here." }));
      else {
        const tb = h("tbody", null, rows.map((r) => h("tr", { class: r.orphan ? "orphan" : null }, h("td", { text: r.v.farg }), h("td", { text: r.v.storlek }), h("td", { class: "mono" }, r.e ? r.e.ean : h("span", { class: "muted", text: "–" }), r.orphan ? h("span", { class: "sub", text: " (no longer in the list)" }) : null))));
        eanTable.append(h("div", { class: "vscroll" }, h("table", { class: "vtable" }, h("thead", null, h("tr", null, h("th", { text: "Colour" }), h("th", { text: "Size" }), h("th", { text: "EAN" }))), tb)));
      }
      eanActions.replaceChildren();
      if (!ro && missing > 0) {
        if (!EAN_OK_STATUS.includes(fStatus.value)) eanActions.append(h("p", { class: "hint", text: "EAN is assigned when the style is Approved." }));
        else eanActions.append(h("button", { class: "btn small primary", type: "button", text: "Assign EAN to " + missing + (missing === 1 ? " variant" : " variants"), onclick: () => confirmAssign(missing) }));
      }
      if (existing.length && downloads) eanActions.append(h("button", { class: "btn small", type: "button", text: "Export CSV", onclick: () => exportStyleEan(cur) }));
      if (existing.length) eanActions.append(h("span", { class: "sub", text: existing.length + " EAN assigned" }));
    }
    function confirmAssign(n) {
      const p = D.pool;
      if (!p) { toast("The EAN range is not set up."); return; }
      const pre = String(p.prefix);
      const first = ean13(pre + String(p.nasta).padStart(12 - pre.length, "0"));
      eanActions.replaceChildren(h("span", { class: "confirm" }, h("span", { text: "Assign " + n + " EAN from " + first + "?" }), h("button", { class: "btn small primary", type: "button", text: "Yes, assign", onclick: doAssign }), h("button", { class: "btn small", type: "button", text: "Cancel", onclick: renderEanTable })));
    }
    async function doAssign() {
      const cur = current();
      const farger = parseList(fFarger.value), storlekar = parseList(fStorl.value);
      const existing = cur.ean || [];
      const have = new Set(existing.map(vkey));
      const missing = variants(farger, storlekar).filter((v) => !have.has(vkey(v)));
      if (!missing.length) { renderEanTable(); return; }
      eanActions.replaceChildren(h("span", { class: "sub", text: "Assigning …" }));
      let codes;
      try { codes = await allocateEan(missing.length); }
      catch (e) {
        const c = e && e.code;
        toast(c === "busy" ? "Someone else is assigning EAN right now. Try again in a few seconds." : c === "empty" ? "The EAN range is not large enough." : c === "nopool" ? "The EAN range is not set up." : "Could not reserve EAN. Try again.");
        renderEanTable(); return;
      }
      const t = new Date().toISOString();
      const added = missing.map((v, i) => ({ farg: v.farg, storlek: v.storlek, ean: codes[i], t, av: myId }));
      const range = codes[0] + (codes.length > 1 ? "–" + codes[codes.length - 1] : "");
      const patch = { farger, storlekar, ean: existing.concat(added), logg: (cur.logg || []).concat(logEntry(added.length + " EAN assigned (" + range + ")")), andrad: t };
      if (fStatus.value !== cur.status) patch.status = fStatus.value;
      const ok = await write("styles", cur._id, patch);
      try { await db.collection("eanLogg").doc("L" + Date.now() + Math.random().toString(36).slice(2, 6)).set({ t, av: myId, styleId: cur._id, styleNamn: cur.namn, antal: codes.length, forsta: codes[0], sista: codes[codes.length - 1], sparad: ok }); } catch (e) {}
      toast(ok ? added.length + " EAN assigned" : "EAN " + range + " were reserved but could not be saved on the style. Note the numbers.");
      if (!ok) renderEanTable();
    }

    const logUl = h("ul", { class: "log" });
    const noteIn = attachMentions(inp("f_snote", "", { placeholder: NOTE_PH, autocomplete: "off" }));
    // ---- Shopify: produktdata och push (hosted-only, ligger utanför artefaktens datamodell) ----
    const sh = (P.hosted().shopify || {})[st._id] || {};
    const fargRaderOf = () => (P.hosted().farger || {})[st._id] || [];
    const SH = D.settings.shopify || {};
    const SIZE_SYS = D.settings.storlekskoder || {};
    const CARE_LINES = ["Wash at 30° and hang to dry.", "Wash at 30° inside out and hang to dry.", "Hand wash cold and dry flat, or dry clean.", "Dry clean only.", "Do not wash or dry clean. Sponge clean with cold water. Re-wax when needed."];
    const SIZE_CHARTS = ["lot-no-2", "officer-s-chino", "pilot-chino", "cotton-and-linen-slacks", "lot-nr-1-denim", "lot-nr-2-denim", "french-pocket-deck-pant", "french-pocket-trouser", "r-shirt", "roper-shirt", "lightweight-roper-shirt", "work-shirt", "fatigue-shirt", "standard-crew-neck-and-v-neck", "standard-sportsman", "cashman", "camelhair-ridge-crew", "button-through-polo", "mercer-jacket", "fireman-s-jacket", "american-hunting-jacket", "tailored-jackets", "belts", "explorers-roll-neck", "funnel-neck", "geelongora-cable-knit", "cashmere-turtleneck", "cashmere-crew-neck", "5-pkt-trouser", "cortina"];
    const COLOUR_FAMILIES = ["black", "navy", "brown", "ecru", "khaki", "grey", "blue", "beige", "camel", "clay", "olive", "persimmon"];
    const pTyp = selectEl("f_sh_typ", [["", "Choose …"]].concat(Object.keys(SH.produkttyper || {})), sh.produkttyp || "");
    const pSys = selectEl("f_sh_sys", [["", "Choose …"], ["alpha", "XS to XXL (01 to 06)"], ["midja", "Waist 30 to 38 (07 to 13)"], ["eu", "44 to 56 (14 to 20)"], ["eu_tailoring", "Tailoring 46 to 54 (21 to 25)"], ["balte", "Belts 80 to 105 (35 to 40)"], ["one", "One size (99)"]], sh.storlekssystem || "");
    const pKod = inp("f_sh_kod", sh.stylekod, { placeholder: "set automatically", disabled: !!sh.stylekod || !canAdmin });
    const pPris = inp("f_sh_pris", sh.rrp_sek, { type: "number", min: "0", step: "1", inputmode: "numeric" });
    const pHs = inp("f_sh_hs", sh.hs_kod, { placeholder: "e.g. 6203493520" });
    const pVikt = inp("f_sh_vikt", sh.vikt_gram, { type: "number", min: "0", step: "10", placeholder: "gram" });
    const pMat = inp("f_sh_mat", sh.sammansattning, { placeholder: "e.g. 100% Cotton" });
    const pMatFam = selectEl("f_sh_matfam", [["", "–"], "Cotton", "Wool", "Cashmere", "Camelhair", "Linen", "Silk", "Leather", "Denim"], sh.material_family || "");
    const pCare = inp("f_sh_care", sh.tvattrad, { list: "dlCare", autocomplete: "off" });
    const pCut = inp("f_sh_cut", sh.cut, { placeholder: "e.g. Straight, Wide, Relaxed" });
    const pFit = inp("f_sh_fit", sh.fit_note, { placeholder: "One line about the fit" });
    const pModel = inp("f_sh_model", sh.model_note, { placeholder: "e.g. Model is 186 cm and wears 48" });
    const pMill = inp("f_sh_mill", sh.fabric_mill);
    const pGsm = inp("f_sh_gsm", sh.fabric_weight, { placeholder: "e.g. 320" });
    const pOrigin = inp("f_sh_origin", sh.fabric_origin, { placeholder: "Where the fabric is woven" });
    const pConstr = inp("f_sh_constr", sh.construction, { placeholder: "e.g. half canvassed" });
    const pFeat = inp("f_sh_feat", sh.features);
    const pChart = inp("f_sh_chart", sh.size_chart, { list: "dlSizeChart", autocomplete: "off", placeholder: "handle, e.g. pilot-chino" });
    const pDesc = area("f_sh_desc", sh.description_en, "Kalle's format: one or two sentences, what it is plus cut and fabric, then how it is worn.");
    if (!$("dlCare")) document.body.append(h("datalist", { id: "dlCare" }, CARE_LINES.map((c) => h("option", { value: c }))), h("datalist", { id: "dlSizeChart" }, SIZE_CHARTS.map((c) => h("option", { value: c }))));
    const shopForm = h("div", { class: "form" },
      field("Product type", pTyp), field("Size system (SKU)", pSys, { hint: "Decides the size code in the SKU" }), field("Style code", pKod, { hint: "Serial number in the SKU, e.g. 1079" }),
      field("Price (RRP, SEK)", pPris), field("HS code", pHs), field("Weight", pVikt),
      field("Material (composition)", pMat), field("Material family", pMatFam), field("Care instructions", pCare, { hint: "Choose one of the six standard lines" }),
      field("Cut", pCut), field("Fit note", pFit), field("Model note", pModel),
      field("Fabric mill", pMill), field("Fabric weight (gsm)", pGsm), field("Fabric origin", pOrigin),
      field("Construction", pConstr), field("Features", pFeat), field("Size table", pChart),
      field("Description (English)", pDesc, { full: true }));
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
      let j; try { j = await res.json(); } catch (e) { j = { error: "The server did not respond as expected (" + res.status + ")." }; }
      return j;
    }
    function renderResult(farg, j) {
      resultBox.replaceChildren(h("h4", { class: "sec-title", text: (j.update ? "Update" : "New product") + ": " + (j.title || farg) }));
      if (j.error && !j.errors) resultBox.append(h("p", { class: "warnline bad", text: j.error }));
      if (j.errors && j.errors.length) resultBox.append(h("ul", { class: "shop-errors" }, j.errors.map((e) => h("li", { text: e }))));
      if (j.warnings && j.warnings.length) resultBox.append(h("ul", { class: "shop-warnings" }, j.warnings.map((e) => h("li", { text: e }))));
      if (j.variants) resultBox.append(h("div", { class: "vscroll" }, h("table", { class: "vtable" }, h("thead", null, h("tr", null, h("th", { text: "Size" }), h("th", { text: "SKU" }), h("th", { text: "EAN" }), h("th", { text: "Price" }))), h("tbody", null, j.variants.map((v) => h("tr", null, h("td", { text: v.size }), h("td", { class: "mono", text: v.sku }), h("td", { class: "mono", text: v.ean || "–" }), h("td", { class: "mono", text: v.price != null ? String(v.price) : "–" })))))));
      if (j.tags) resultBox.append(h("p", { class: "sub", text: "Tags: " + j.tags.join(", ") }));
      if (j.metafields) resultBox.append(h("details", null, h("summary", { class: "sub", text: j.metafields.length + " metafields" }), h("ul", { class: "shop-mf" }, j.metafields.map((m) => h("li", { class: "mono", text: m })))));
      if (j.admin_url) resultBox.append(h("p", { class: "okline" }, "Created as a draft in Shopify. ", h("a", { href: j.admin_url, target: "_blank", rel: "noopener", text: "Open in Shopify admin" })));
      else if (j.errors && !j.errors.length && !ro) resultBox.append(h("button", { class: "btn small primary", type: "button", text: j.update ? "Update in Shopify" : "Create draft in Shopify", onclick: async (e) => { e.target.disabled = true; e.target.textContent = "Sending …"; await saveShopFields(); const r = await callShopify("create", farg); renderResult(farg, r); if (r.admin_url) toast("Created in Shopify"); } }));
    }
    async function saveShopFields() {
      if (isNew || ro) return;
      const { error: e1 } = await P.supabase.from("shopify_styles").upsert(Object.assign({ style_id: st._id }, shopState()));
      if (e1) toast("Could not save the Shopify fields: " + e1.message);
      const rows = Object.entries(fargState).map(([farg, f]) => ({ style_id: st._id, farg, swatch: f.swatch.value && f.swatch.value !== "#888888" ? f.swatch.value : null, colour_family: f.fam.value || null, titel: f.titel.value.trim() || null }));
      if (rows.length) { const { error } = await P.supabase.from("style_farger").upsert(rows, { onConflict: "style_id,farg" }); if (error) toast("Could not save the colour rows: " + error.message); }
    }
    function renderFarger() {
      const cur = current();
      const farger = parseList(fFarger.value);
      const rader = fargRaderOf();
      fargSec.replaceChildren(h("h4", { class: "sec-title", text: "Colours in Shopify" }));
      if (!farger.length) { fargSec.append(h("p", { class: "hint", text: "Fill in colours on the style first." })); return; }
      for (const farg of farger) {
        const r = rader.find((x) => x.farg.toLowerCase() === farg.toLowerCase()) || {};
        const f = fargState[farg] || (fargState[farg] = { swatch: inp("f_sw_" + slug(farg), r.swatch || "#888888", { type: "color" }), fam: selectEl("f_cf_" + slug(farg), [["", "Colour family …"]].concat(COLOUR_FAMILIES.map((c) => [c, c.charAt(0).toUpperCase() + c.slice(1)])), r.colour_family || ""), titel: inp("f_ti_" + slug(farg), r.titel || "", { placeholder: cur.namn + " in " + farg }) });
        if (ro) [f.swatch, f.fam, f.titel].forEach((x) => (x.disabled = true));
        const status = r.shopify_product_id ? h("a", { class: "chip b-godkand", href: "https://admin.shopify.com/store/" + "atemporubato" + "/products/" + r.shopify_product_id, target: "_blank", rel: "noopener", text: (r.shopify_status || "In Shopify") + " · " + (r.shopify_handle || r.shopify_product_id) }) : chip("Not in Shopify");
        fargSec.append(h("div", { class: "farg-rad" }, h("strong", { text: farg }), f.swatch, f.fam, f.titel, status, ro || isNew ? null : h("button", { class: "btn small", type: "button", text: "Preview", onclick: async (e) => { e.target.disabled = true; await saveShopFields(); const j = await callShopify("preview", farg); e.target.disabled = false; renderResult(farg, j); } })));
      }
    }
    fFarger.addEventListener("change", renderFarger);
    const shopSec = h("section", { class: "shop-sec" }, h("h3", { class: "sec-title", text: "Shopify" }), isNew ? h("p", { class: "hint", text: "Save the style first." }) : shopForm, isNew ? null : fargSec, isNew ? null : resultBox);
    if (!isNew) renderFarger();

    const addNote = async () => { if (!isNew) await addComment("styles", current(), noteIn); };
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
        if (!o.namn) { toast("Give the style a name."); fNamn.focus(); return null; }
        const now = new Date().toISOString();
        if (isNew) {
          const nid = await freshId("styles", D.styles, "ST-", 3);
          const body = Object.assign({ id: nid, ean: [], bilder: pendingImgs.slice(), logg: [logEntry(IDEA_STATUS.includes(o.status) ? "Idea created" : "Style created")], andrad: now }, o);
          if (await create("styles", nid, body)) { if (!byId(D.styles, nid)) D.styles.push(Object.assign({}, body, { _id: nid })); toast(nid + " saved"); if (after) return after(nid); openStyle(nid); return nid; }
          return null;
        }
        const cur = current();
        const changes = describeChanges(Object.assign({}, cur, { status: styleStatusNorm(cur.status) }), o, ST_LABELS);
        await saveShopFields();
        if (!changes.length) { if (after) return after(cur._id); closeSheet(); return cur._id; }
        if (await write("styles", cur._id, Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) }))) { if (after) return after(cur._id); toast("Saved"); closeSheet(); return cur._id; }
        return null;
      } finally { if (btn) btn.disabled = false; }
    }
    async function sendToAlex() {
      await save(async (sid) => {
        const cur = byId(D.styles, sid) || current();
        const now = new Date().toISOString();
        if (await write("styles", sid, { status: ST_KANBEST, overlamnad: { till: "Alex", t: now, av: myId }, andrad: now, logg: (cur.logg || []).concat(logEntry("Sent straight to sampling – sample can be ordered")) })) { toast("Now with Alex under Samples › Sample can be ordered"); closeSheet(); }
        return sid;
      });
    }
    async function sendToDesign() {
      await save(async (sid) => {
        const cur = byId(D.styles, sid) || current();
        const now = new Date().toISOString();
        if (await write("styles", sid, { status: ST_DESIGN, overlamnad: { till: "Conor", t: now, av: myId }, andrad: now, logg: (cur.logg || []).concat(logEntry("Sent to Conor for design")) })) { toast("The idea is now with Conor under Design"); closeSheet(); }
        return sid;
      });
    }
    function orderSample() {
      save(async (sid) => { const cur = byId(D.styles, sid) || current(); openSample(null, { styleId: sid, leverantor: cur.leverantor || "", version: "Proto 1", tygId: cur.tygId || null }); return sid; });
    }

    const nSamples = isNew ? 0 : samplesOfStyle(st._id).length;
    const nVariants = isNew ? 0 : variantsOf(st._id).length;
    const body = [varSec, form, ownImgs, planSec, gallerySec, prodSec, samplesSec, eanSec, shopSec];
    if (lean) body.splice(0, body.length, ...body.filter((x, i) => i < 3 || x === gallerySec || x === samplesSec));
    if (!isNew && designSummary(st)) body.splice(Math.min(3, body.length), 0, designSummary(st));
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "History" }), logUl, ro ? null : h("div", { class: "add-note" }, noteIn, h("button", { class: "btn small", type: "button", text: "Add", onclick: addNote }))));
    const foot = footButtons({ del: "Delete style", onDelete: isNew ? null : async () => { if (await remove("styles", st._id)) { toast("Removed"); closeSheet(); } }, canDelete: !nSamples && !(st.ean || []).length && !nVariants, blockText: "The style has samples, EAN or variants linked", onSave: () => save() });
    if (!ro) {
      const s0 = styleStatusNorm(st.status);
      if (s0 === ST_IDE) foot[1].insertBefore(h("button", { class: "btn", type: "button", id: "btnDesign", text: "Send to design (Conor)", title: "The idea is ready to be designed. Conor sees it under Design.", onclick: sendToDesign }), foot[1].lastChild);
      if (s0 === ST_IDE || s0 === ST_DESIGN) foot[1].insertBefore(h("button", { class: "btn", type: "button", id: "btnAlex", text: "Straight to sampling (Alex)", title: "Skips design. Alex can order a sample straight away.", onclick: sendToAlex }), foot[1].lastChild);
      if (s0 === ST_KANBEST) foot[1].insertBefore(h("button", { class: "btn", type: "button", id: "btnSampla", text: "Order sample", onclick: orderSample }), foot[1].lastChild);
    }
    openSheet({
      flagRef: isNew ? null : { typ: "style", ref: st._id, titel: st.namn + (st.sasong ? " · " + st.sasong : ""), tab: ["bibliotek", "kollektion", "produktion", "foto", "ecom"].includes(UI.tab) ? UI.tab : "bibliotek" },
      tag: isNew ? (IDEA_STATUS.includes(st.status) ? "New idea" : "New") : st._id,
      title: isNew ? (IDEA_STATUS.includes(st.status) ? (st.grundId ? "New variant" : "New idea") : "New style") : st.namn,
      sub: isNew ? (st.grundId && byId(D.styles, st.grundId) ? "Variant of " + byId(D.styles, st.grundId).namn : "") : [isGrund(st) ? "Base style" : "", st.leverantor, st.sasong, st.drop].filter(Boolean).join(" · "),
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
    if (designOnly()) return;
    const isNew = !id;
    const t = isNew ? { _id: null, status: "" } : byId(D.tyger, id);
    if (!t) { toast("Cannot find " + id + "."); return; }
    const ro = !canWrite || !db;
    const fNamn = inp("f_tnamn", t.namn, { placeholder: "e.g. Japan Blue inhouse – Westpoint Canvas 223" });
    const fLev = inp("f_tlev", t.leverantor, { list: "dlLev", autocomplete: "off" });
    const fStatus = selectEl("f_tstatus", [["", "–"]].concat(TYG_STATUS), t.status || "");
    const fAter = inp("f_tater", t.aterDatum, { type: "date" });
    const fKom = area("f_tkom", t.kommentar, "E.g. which colours are sold out");
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() }, field("Name", fNamn, { full: true }), field("Supplier / mill", fLev), field("Status", fStatus), field("Back in stock", fAter, { hint: "If the fabric is sold out" }), h("div"), field("Comment", fKom, { full: true }));
    if (ro) lock(form);
    const used = h("section");
    const stock = h("section");
    const pendingImgs = isNew ? [] : null;
    const imgSec = bilderSection({ title: "Fabric images", ro, pending: pendingImgs, current: () => byId(D.tyger, t._id) || t, empty: "Photograph the swatch so everyone can see which fabric it is.", save: (ids) => write("tyger", t._id, { bilder: ids, andrad: new Date().toISOString() }) });
    const renderUsed = () => {
      imgSec.render();
      const xs = isNew ? [] : D.samples.filter((s) => s.tygId === t._id).sort((a, b) => a._id.localeCompare(b._id));
      const sts = isNew ? [] : D.styles.filter((s) => s.tygId === t._id);
      used.replaceChildren(h("h3", { class: "sec-title", text: "Used in (" + (xs.length + sts.length) + ")" }),
        sts.length ? h("ul", { class: "mini" }, sts.map((x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openStyle(x._id) }, tag(x._id), h("span", { class: "mini-main" }, h("strong", { text: x.namn }), h("span", { class: "sub", text: [x.sasong, x.leverantor].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, styleStatusPill(x)))))) : null,
        xs.length ? h("ul", { class: "mini" }, xs.map((x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openSample(x._id) }, tag(x._id), h("span", { class: "mini-main" }, h("strong", { text: styleName(x) }), h("span", { class: "sub", text: [x.version, x.farg].filter(Boolean).join(" · ") })), h("span", { class: "mini-side" }, statusPill(x.status)))))) : null,
        !xs.length && !sts.length ? h("p", { class: "hint", text: "No styles or samples use the fabric yet." }) : null);
      const lots = isNew ? [] : lotsOf(t._id).sort((a, b) => (a.status === "Förbrukad") - (b.status === "Förbrukad") || a._id.localeCompare(b._id));
      stock.replaceChildren(h("h3", { class: "sec-title", text: "Eget lager" + (lots.length ? " · " + (stockText(t._id) || "all used up") : "") }),
        lots.length ? h("ul", { class: "mini" }, lots.map((x) => h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openLager(x._id) }, tag(x._id),
          h("span", { class: "mini-main" }, h("strong", { text: x.plats || "No location" }), h("span", { class: "sub", text: [x.farg, reservedName(x) ? "reserved: " + reservedName(x) : ""].filter(Boolean).join(" · ") })),
          h("span", { class: "mini-side" }, h("span", { class: "pill ls-" + slug(x.status || "x"), text: x.status || "–" }), h("span", { class: "sub mono", text: num(x.meter) != null ? "approx. " + fmtM(x.meter) + " m" : "metres missing" })))))) : h("p", { class: "hint", text: isNew ? "Save the fabric first." : "No own stock registered for the fabric." }),
        !isNew && !ro ? h("button", { class: "btn small", type: "button", text: "+ New batch of the fabric", onclick: () => openLager(null, { tygId: t._id, tygNamn: t.namn }) }) : null);
    };
    renderUsed();
    async function save() {
      const o = { namn: fNamn.value.trim(), leverantor: fLev.value.trim(), status: fStatus.value, aterDatum: fAter.value || null, kommentar: fKom.value.trim() };
      if (!o.namn) { toast("Give the fabric a name."); fNamn.focus(); return; }
      if (D.tyger.some((x) => x._id !== t._id && norm(x.namn) === norm(o.namn))) { toast("There is already a fabric with that name."); return; }
      const now = new Date().toISOString();
      if (isNew) { const nid = await freshId("fabrics", D.tyger, "T-", 3); if (await create("tyger", nid, Object.assign({ id: nid, bilder: pendingImgs.slice(), andrad: now }, o))) { toast(nid + " saved"); closeSheet(); } }
      else if (await write("tyger", t._id, Object.assign({ andrad: now }, o))) { toast("Saved"); closeSheet(); }
    }
    const inUse = !isNew && (D.samples.some((s) => s.tygId === t._id) || lotsOf(t._id).length > 0 || D.styles.some((s) => s.tygId === t._id));
    openSheet({ tag: isNew ? "New" : t._id, title: isNew ? "New fabric" : t.namn, sub: isNew ? "" : t.leverantor || "", body: [form, imgSec, stock, used], foot: footButtons({ del: "Delete fabric", onDelete: isNew ? null : async () => { if (await remove("fabrics", t._id)) { toast("Removed"); closeSheet(); } }, canDelete: !inUse, blockText: "The fabric is used by samples or has stock", onSave: save }), ctx: { refresh: renderUsed }, focus: isNew ? "f_tnamn" : null });
  }

  // ---------- fabric lot sheet ----------
  const L_LABELS = { tygId: "Tyg", farg: "Colour", plats: "Location", status: "Status", inkoptMeter: "Purchased (m)", meter: "Left (m)", bredd: "Width (cm)", prisPerMeter: "Price per metre", prisValuta: "Currency", inkopt: "Purchased", reserveradFor: "Reserved for", kommentar: "Comment", typ: "Typ", tygNamn: "Item", storlek: "Size", inkoptAntal: "Purchased (pcs)", antal: "Left (pcs)", prisPerSt: "Price per pc" };
  function openLager(id, preset) {
    if (designOnly()) return;
    const isNew = !id;
    const l = isNew ? Object.assign({ _id: null, status: "I lager", plats: "", logg: [] }, preset || {}) : byId(D.lager, id);
    if (!l) { toast("Cannot find " + id + "."); return; }
    const ro = !canWrite || !db;
    const current = () => (isNew ? l : byId(D.lager, l._id) || l);
    const initTyg = tygOf(l) ? tygOf(l).namn : (l.tygNamn || "");
    const fTyg = inp("f_ltyg", initTyg, { list: "dlTyg", autocomplete: "off", placeholder: "e.g. Olmetex – C993950" });
    const fFarg = inp("f_lfarg", l.farg, { placeholder: "e.g. col 1780 (Navy)" });
    const fPlats = inp("f_lplats", l.plats, { list: "dlPlats", autocomplete: "off", placeholder: "Supplier or " + EGET_LAGER });
    const fStatus = selectEl("f_lstatus", LAGER_STATUS, l.status || "I lager");
    const fInk = inp("f_link", l.inkoptMeter, { type: "number", min: "0", step: "0.5", inputmode: "decimal" });
    const fKvar = inp("f_lkvar", l.meter, { type: "number", min: "0", step: "0.5", inputmode: "decimal", placeholder: "approximately" });
    const fBredd = inp("f_lbredd", l.bredd, { type: "number", min: "0", step: "1", inputmode: "numeric" });
    const fPris = inp("f_lpris", l.prisPerMeter, { type: "number", min: "0", step: "0.01", inputmode: "decimal" });
    const fVal = selectEl("f_lval", [["", "–"], "SEK", "EUR", "JPY", "GBP", "USD"], l.prisValuta || "");
    const fInkDate = inp("f_linkopt", l.inkopt, { type: "date" });
    const fTyp = selectEl("f_ltyp", [["tyg", "Fabric (metres)"], ["trims", "Trims (quantity)"]], isTrims(l) ? "trims" : "tyg");
    const fStorlek = inp("f_lstorlek", l.storlek, { placeholder: "e.g. 32L" });
    const fInkSt = inp("f_linkst", l.inkoptAntal, { type: "number", min: "0", step: "1", inputmode: "numeric" });
    const fKvarSt = inp("f_lkvarst", l.antal, { type: "number", min: "0", step: "1", inputmode: "numeric", placeholder: "antal" });
    const fPrisSt = inp("f_lprisst", l.prisPerSt, { type: "number", min: "0", step: "0.0001", inputmode: "decimal" });
    fInkSt.addEventListener("change", () => { if (isNew && !fKvarSt.value && fInkSt.value) fKvarSt.value = fInkSt.value; });
    const styleOpts = [["", "– None –"]].concat(D.styles.filter((s) => isActiveStyle(s) || s._id === l.reserveradFor).sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv")).map((s) => [s._id, s.namn + (s.sasong ? " · " + s.sasong : "")]));
    const fRes = selectEl("f_lres", styleOpts, l.reserveradFor || "");
    const fKom = area("f_lkom", l.kommentar, "E.g. what the batch is intended for, or where the metre figure comes from");
    fInk.addEventListener("change", () => { if (isNew && !fKvar.value && fInk.value) fKvar.value = fInk.value; });
    const fArt = field("Tyg", fTyg, { full: true, hint: "Type freely or choose a fabric that already exists." });
    const fsTyg = [h("h3", { class: "sec-title full", text: "Metres" }), field("Purchased (m)", fInk), field("Left (m, approx.)", fKvar, { hint: "Empty = not known yet" }), field("Width (cm)", fBredd), field("Price per metre", fPris)];
    const fsTrims = [h("h3", { class: "sec-title full", text: "Quantity" }), field("Size", fStorlek), field("Purchased (pcs)", fInkSt), field("Left (pcs)", fKvarSt, { hint: "Empty = not known yet" }), field("Price per pc", fPrisSt)];
    const form = h("form", { class: "form", id: "lagerForm", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      field("Type", fTyp), field("Status", fStatus),
      fArt,
      field("Colour / shade", fFarg), field("Located at", fPlats),
      field("Reserved for", fRes), field("Purchase date", fInkDate),
      ...fsTyg, ...fsTrims,
      field("Currency", fVal),
      field("Comment", fKom, { full: true }));
    const syncTyp = () => {
      const t = fTyp.value === "trims";
      fsTyg.forEach((e) => (e.hidden = t));
      fsTrims.forEach((e) => (e.hidden = !t));
      const lab = fArt.querySelector("label"); if (lab) lab.textContent = t ? "Item" : "Tyg";
      const hint = fArt.querySelector(".hint"); if (hint) hint.textContent = t ? "Supplier + item, e.g. Fenili 11072 Corno 4F (button)." : "Type freely or choose a fabric that already exists.";
      fTyg.placeholder = t ? "e.g. Fenili 11072 Corno 4F" : "e.g. Olmetex – C993950";
      if (t) fTyg.removeAttribute("list"); else fTyg.setAttribute("list", "dlTyg");
    };
    fTyp.addEventListener("change", syncTyp); syncTyp();
    if (ro) lock(form);

    const quick = h("div", { class: "quick" });
    const logUl = h("ul", { class: "log" });
    const noteIn = attachMentions(inp("f_lnote", "", { placeholder: NOTE_PH, autocomplete: "off" }));
    noteIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } });
    async function addNote() {
      if (!isNew) await addComment("tyglager", current(), noteIn);
    }
    function renderQuick() {
      const cur = current();
      quick.replaceChildren();
      if (isNew || ro) { quick.hidden = true; return; }
      quick.hidden = false;
      const add = (label, fn, primary) => quick.append(h("button", { class: "btn small" + (primary ? " primary" : ""), type: "button", text: label, onclick: fn }));
      if (cur.status === "I lager") add(isTrims(cur) ? "Adjust quantity" : "Adjust metres", () => adjustMeters(cur), true);
      if (cur.status === "Beställd") add("Delivered", () => quickUpdate(cur, { status: "I lager" }, "Marked as in stock"), true);
      if (cur.status !== "Förbrukad") add("Used up", () => quickUpdate(cur, Object.assign({ status: "Förbrukad", raknad: todayISO() }, isTrims(cur) ? { antal: 0 } : { meter: 0 }), "Marked as used up"));
      if (cur.tygId && byId(D.tyger, cur.tygId)) add("Open fabric", () => openTyg(cur.tygId));
    }
    function adjustMeters(cur) {
      const trm = isTrims(cur), key = trm ? "antal" : "meter", fmtU = (n) => (trm ? fmtSt(n) : fmtM(n) + " m");
      const i = inp("f_ladj", cur[key], { type: "number", min: "0", step: trm ? "1" : "0.5", inputmode: trm ? "numeric" : "decimal", "aria-label": trm ? "New quantity" : "New metres" });
      const row = h("div", { class: "admin-row" }, h("span", { text: trm ? "Left now (pcs):" : "Left now (m):" }), i,
        h("button", { class: "btn small primary", type: "button", text: "Save", onclick: async () => {
          const n = num(i.value); if (n == null || n < 0) { toast(trm ? "Enter a quantity." : "Enter a metre figure."); return; }
          const before = num(cur[key]);
          const patch = { [key]: n, raknad: todayISO() };
          const body = Object.assign({}, patch, { andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry("Left: " + (before == null ? "unknown" : fmtU(before)) + " → " + fmtU(n))) });
          if (await write("tyglager", cur._id, body)) { toast(trm ? "Quantity updated" : "Metres updated"); (trm ? fKvarSt : fKvar).value = n; renderQuick(); }
        } }),
        h("button", { class: "btn small", type: "button", text: "Cancel", onclick: renderQuick }));
      quick.replaceChildren(row); i.focus(); i.select();
    }
    async function quickUpdate(cur, patch, msg) {
      const changes = describeChanges(cur, patch, L_LABELS);
      const body = Object.assign({}, patch, { andrad: new Date().toISOString(), logg: (cur.logg || []).concat(changes.map(logEntry)) });
      const ok = await write("tyglager", cur._id, body);
      if (ok) { toast(msg); if ("status" in patch) fStatus.value = patch.status; if ("meter" in patch) fKvar.value = patch.meter == null ? "" : patch.meter; if ("antal" in patch) fKvarSt.value = patch.antal == null ? "" : patch.antal; }
      return ok;
    }
    async function save() {
      const btn = $("btnSave"); if (btn) btn.disabled = true;
      try {
        const name = fTyg.value.trim(), plats = fPlats.value.trim(), trims = fTyp.value === "trims";
        if (!name) { toast(trims ? "Write which item it is." : "Write which fabric it is."); fTyg.focus(); return; }
        if (!plats) { toast(trims ? "Write where the item is." : "Write where the fabric is."); fPlats.focus(); return; }
        let o;
        if (trims) {
          o = { typ: "trims", tygId: null, tygNamn: name, farg: fFarg.value.trim(), storlek: fStorlek.value.trim(), plats, status: fStatus.value, inkoptAntal: num(fInkSt.value), antal: num(fKvarSt.value), prisPerSt: num(fPrisSt.value), prisValuta: fVal.value || null, inkopt: fInkDate.value || null, reserveradFor: fRes.value || null, kommentar: fKom.value.trim() };
        } else {
          const tygId = await resolveTyg(name, "");
          if (!tygId) return;
          const tt = byId(D.tyger, tygId);
          o = { typ: "tyg", tygId, tygNamn: tt ? tt.namn : name, farg: fFarg.value.trim(), plats, status: fStatus.value, inkoptMeter: num(fInk.value), meter: num(fKvar.value), bredd: num(fBredd.value), prisPerMeter: num(fPris.value), prisValuta: fVal.value || null, inkopt: fInkDate.value || null, reserveradFor: fRes.value || null, kommentar: fKom.value.trim() };
        }
        const q0 = trims ? o.antal : o.meter;
        const now = new Date().toISOString();
        if (isNew) {
          const nid = await freshId("tyglager", D.lager, "TL-", 3);
          const body = Object.assign({ id: nid, raknad: q0 != null ? todayISO() : null, logg: [logEntry("Batch created (" + (trims ? "trims, " : "") + o.status + (q0 != null ? ", " + fmtQty(o, q0) : "") + ")")], andrad: now }, o);
          if (await create("tyglager", nid, body)) { if (!byId(D.lager, nid)) D.lager.push(Object.assign({}, body, { _id: nid })); toast(nid + " saved"); closeSheet(); }
        } else {
          const cur = current();
          const changes = describeChanges(cur, o, L_LABELS);
          if (!changes.length) { closeSheet(); return; }
          const body = Object.assign({}, o, { andrad: now, logg: (cur.logg || []).concat(changes.map(logEntry)) });
          if (num(cur[trims ? "antal" : "meter"]) !== q0) body.raknad = todayISO();
          if (await write("tyglager", cur._id, body)) { toast("Saved"); closeSheet(); }
        }
      } finally { if (btn) btn.disabled = false; }
    }
    const body = [quick, form];
    if (!isNew) body.push(h("section", null, h("h3", { class: "sec-title", text: "History" }), logUl, ro ? null : h("div", { class: "add-note" }, noteIn, h("button", { class: "btn small", type: "button", text: "Add", onclick: addNote }))));
    openSheet({
      tag: isNew ? "New" : l._id,
      title: isNew ? "New batch" : lotName(l) + (l.farg ? " · " + l.farg : "") + (isTrims(l) && l.storlek ? " · " + l.storlek : ""),
      sub: isNew ? "" : [isTrims(l) ? "Trims" : "Tyg", l.plats, lotQty(l) != null ? fmtQty(l, lotQty(l)) + " left" : (isTrims(l) ? "quantity missing" : "metres missing"), l.status].filter(Boolean).join(" · "),
      body,
      foot: footButtons({ del: "Delete stock lot", onDelete: isNew ? null : async () => { if (await remove("tyglager", l._id)) { toast("Removed"); closeSheet(); } }, canDelete: true, onSave: save }),
      ctx: { refresh: () => { if (!isNew && !byId(D.lager, l._id)) { closeSheet(); return; } renderQuick(); if (!isNew) renderLogInto(logUl, current().logg); } },
      focus: isNew ? (preset && preset.tygId ? "f_lplats" : "f_ltyg") : null
    });
    renderQuick();
    if (!isNew) renderLogInto(logUl, l.logg);
  }

  // ---------- supplier sheet ----------
  function openLev(id) {
    if (designOnly()) return;
    const isNew = !id;
    const l = isNew ? { _id: null, typ: "Producent", villkor: [] } : byId(D.lev, id);
    if (!l) { toast("Cannot find the supplier."); return; }
    const ro = !canWrite || !db;
    const fNamn = inp("f_lnamn", l.namn);
    if (!isNew) fNamn.disabled = true;
    const fKod = inp("f_lkod", l.kod, { placeholder: "e.g. JPB" });
    const fTyp = selectEl("f_ltyp", LEV_TYP, l.typ || "Producent");
    const fSl = inp("f_lsample", l.sampleLedtid, { type: "number", min: "0", step: "1" });
    const fProd = inp("f_lprod", l.produktionstid, { type: "number", min: "0", step: "1" });
    const fFrakt = inp("f_lfrakt", l.frakt, { type: "number", min: "0", step: "1", placeholder: "standard" });
    const fBuff = inp("f_lbuff", l.buffert, { type: "number", min: "0", step: "1" });
    const fVal = selectEl("f_lvaluta", [["", "–"], "SEK", "EUR", "JPY", "GBP", "USD"], l.valuta || "");
    const fVs = selectEl("f_lvs", VILLKOR_STATUS, l.villkorStatus || (Array.isArray(l.villkor) && l.villkor.length ? "Bekräftade" : "Okända"));
    const fVt = inp("f_lvt", l.villkorText, { placeholder: "As the supplier wrote it, e.g. 30 % on production, 70 % on delivery" });
    const fRab = inp("f_lrab", l.rabatt, { type: "number", min: "0", step: "0.5", placeholder: "%" });
    const fRabT = inp("f_lrabt", l.rabattText, { placeholder: "e.g. on payment at production" });
    const fKontakt = inp("f_lkontakt", l.kontakt, { placeholder: "Name and email" });
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
        const fD = inp("v_d_" + i, r.dagar, { type: "number", min: "0", step: "1", placeholder: "days" });
        [fA, fV, fD].forEach((x) => { x.disabled = ro; x.addEventListener("change", () => { r.andel = num(fA.value); r.vid = fV.value; r.dagar = num(fD.value) || 0; syncSum(); }); });
        rowsEl.append(h("div", { class: "line" }, h("div", { class: "row two" }, field("Share %", fA), field("Paid", fV), field("+ days", fD)), ro ? null : h("div", { class: "foot" }, h("button", { class: "btn small", type: "button", text: "Remove", onclick: () => { rows.splice(i, 1); renderRows(); } }))));
      });
      if (!ro) rowsEl.append(h("div", { class: "quick" }, h("button", { class: "btn small", type: "button", text: "+ Part payment", onclick: () => { rows.push({ andel: rows.length ? Math.max(0, 100 - rows.reduce((s0, x) => s0 + (num(x.andel) || 0), 0)) : 100, vid: rows.length ? "leverans" : "produktion", dagar: 0 }); renderRows(); } }),
        h("button", { class: "btn small", type: "button", text: "30 days net", onclick: () => { rows.length = 0; rows.push({ andel: 100, vid: "faktura", dagar: 30 }); renderRows(); } }),
        h("button", { class: "btn small", type: "button", text: "60 days net", onclick: () => { rows.length = 0; rows.push({ andel: 100, vid: "faktura", dagar: 60 }); renderRows(); } }),
        h("button", { class: "btn small", type: "button", text: "30 / 70", onclick: () => { rows.length = 0; rows.push({ andel: 30, vid: "produktion", dagar: 0 }, { andel: 70, vid: "leverans", dagar: 0 }); renderRows(); } }),
        h("button", { class: "btn small", type: "button", text: "50 / 50", onclick: () => { rows.length = 0; rows.push({ andel: 50, vid: "produktion", dagar: 0 }, { andel: 50, vid: "leverans", dagar: 0 }); renderRows(); } })));
      syncSum();
    }
    function syncSum() { const sum = rows.reduce((s0, x) => s0 + (num(x.andel) || 0), 0); sumEl.textContent = rows.length ? "Sum " + sum + " %" + (sum !== 100 ? " – should be 100 %" : "") : "No terms entered – the schedule assumes 100 % on delivery."; sumEl.className = rows.length && sum !== 100 ? "late-text" : "sub"; }
    renderRows();
    const form = h("form", { class: "form", autocomplete: "off", onsubmit: (e) => e.preventDefault() },
      h("h3", { class: "sec-title full", text: "Supplier" }),
      field("Name", fNamn, { hint: isNew ? "Write it as it appears on samples and POs" : "The name links samples, styles and POs together" }), field("Code", fKod),
      field("Type", fTyp, { hint: "A manufacturer sews garments; Fabric and Trim are materials" }), field("Currency", fVal, { hint: "The currency you pay in" }),
      field("Contact", fKontakt, { full: true }),
      h("h3", { class: "sec-title full", text: "Lead times" }),
      field("Sample lead time (days)", fSl, { hint: a ? "Actual average " + a.avg + " d (" + a.n + " samples)" : "From order to received sample" }),
      field("Production time (days)", fProd, { hint: "From PO to ready at the supplier" }),
      field("Freight (days)", fFrakt, { hint: "Empty = standard " + (num(D.settings.standardFrakt) ?? 7) + " d" }),
      field("Buffer (days)", fBuff, { hint: "Extra margin if the supplier tends to be late" }),
      h("h3", { class: "sec-title full", text: "Payment terms" }),
      field("Status", fVs), field("Discount %", fRab),
      field("Terms in plain text", fVt, { full: true }),
      field("The discount applies", fRabT, { full: true }),
      h("div", { class: "full" }, h("div", { class: "plan-head" }, h("span", { class: "sec-title", style: "margin:0;border:0;padding:0", text: "Part payments" }), sumEl), rowsEl),
      field("Comment", fKom, { full: true }));
    if (ro) lock(form);
    async function save() {
      const o = { namn: fNamn.value.trim(), kod: fKod.value.trim(), typ: fTyp.value, sampleLedtid: num(fSl.value), produktionstid: num(fProd.value), frakt: num(fFrakt.value), buffert: num(fBuff.value) ?? 0, valuta: fVal.value, kontakt: fKontakt.value.trim(), kommentar: fKom.value.trim(), villkor: rows.filter((r) => num(r.andel)).map((r) => ({ andel: num(r.andel), vid: r.vid || "leverans", dagar: num(r.dagar) || 0 })), villkorStatus: fVs.value, villkorText: fVt.value.trim(), rabatt: num(fRab.value), rabattText: fRabT.value.trim(), andrad: new Date().toISOString() };
      if (!o.namn) { toast("Fill in the name."); return; }
      const sum = o.villkor.reduce((s0, x) => s0 + x.andel, 0);
      if (o.villkor.length && sum !== 100) { toast("The part payments must add up to 100 % (now " + sum + " %)."); return; }
      if (isNew) {
        const nid = slug(o.namn) || "lev-" + Date.now();
        if (byId(D.lev, nid) || levByName(o.namn)) { toast("The supplier already exists."); return; }
        if (await create("leverantorer", nid, o)) { toast("Saved"); closeSheet(); }
      } else { delete o.namn; if (await write("leverantorer", l._id, o)) { toast("Saved"); closeSheet(); } }
    }
    const poSec = h("section");
    if (!isNew) {
      const pos = D.po.filter((p) => norm(p.leverantor) === norm(l.namn) && !PO_DRAFT.includes(poStatusNorm(p.status))).sort((a2, b2) => String(b2.orderDatum || "").localeCompare(String(a2.orderDatum || "")));
      poSec.append(h("h3", { class: "sec-title", text: "POs and payments (" + pos.length + ")" }));
      if (!pos.length) poSec.append(h("p", { class: "hint", text: "No placed POs." }));
      else poSec.append(h("ul", { class: "mini" }, pos.map((p) => { const pl = paymentPlan(p); const unpaid = pl.filter((x) => !x.betald); return h("li", null, h("button", { class: "mini-row", type: "button", onclick: () => openPo(p._id) }, h("span", { class: "tag", text: p.nr || p._id }), h("span", { class: "mini-main" }, h("strong", { text: [p.sasong, p.drop].filter(Boolean).join(" ") + " · " + fmtSEK(poTotal(p)) }), h("span", { class: "sub", text: pl.length ? pl.map((x) => x.typ + " " + fmtTkr(x.belopp) + (x.datum ? " " + fmtDate(x.datum) : "") + (x.betald ? (x.antagenBetald ? " ✔ (assumed)" : " ✔") : "")).join(" · ") : "no payment plan" })), h("span", { class: "mini-side" }, poStatusPill(p), unpaid.length ? h("span", { class: "sub mono", text: "unpaid " + fmtTkr(unpaid.reduce((s0, x) => s0 + x.belopp, 0)) }) : null))); })));
    }
    const inUse = !isNew && (D.samples.some((s0) => norm(s0.leverantor) === norm(l.namn)) || D.styles.some((s0) => norm(s0.leverantor) === norm(l.namn)) || D.po.some((p) => norm(p.leverantor) === norm(l.namn)));
    openSheet({ tag: isNew ? "New" : l.kod || (l.typ || ""), title: isNew ? "New supplier" : l.namn, sub: isNew ? "" : [l.typ || "Producent", l.valuta, termsText(l)].filter(Boolean).join(" · "), body: [form, poSec], foot: footButtons({ del: "Delete supplier", onDelete: isNew ? null : async () => { if (await remove("leverantorer", l._id)) { toast("Removed"); closeSheet(); } }, canDelete: !inUse, blockText: "The supplier is used by samples, styles or POs", onSave: save }), focus: isNew ? "f_lnamn" : null });
  }

  // ---------- exports ----------
  async function saveFile(filename, data) {
    if (!downloads) { toast("Download is not available here."); return false; }
    try { await downloads.save({ filename, data }); return true; }
    catch (e) {
      const c = e && e.code;
      if (c === "declined") return false;
      if (c === "rate_limited") toast("A download is already waiting for a response.");
      else if (["unavailable", "not_granted", "capability_disabled", "capability_removed"].includes(c)) toast("Download is not available here.");
      else toast("The download failed.");
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
    saveFile("Rubato_Samples_" + todayISO() + ".csv", csv(["Sample ID", "Style", "Version", "Supplier", "Colour", "Tyg", "Size", "Price", "Currency", "Beställd", "Lead time (days)", "Expected delivery", "Status", "Mottagen", "Location", "Location note", "Decision", "Style status", "Changes", "Tracking", "R1 sent", "R2 sent", "Season", "Drop", "Comment"], rows));
  }
  function exportLager() {
    const rows = D.lager.slice().sort((a, b) => (a.plats || "").localeCompare(b.plats || "", "sv") || a._id.localeCompare(b._id)).map((l) => [l._id, isTrims(l) ? "Trims" : "Tyg", lotName(l), l.farg, l.storlek, l.plats, l.status, isTrims(l) ? "pcs" : "m", isTrims(l) ? l.inkoptAntal : l.inkoptMeter, isTrims(l) ? l.antal : l.meter, l.bredd, isTrims(l) ? l.prisPerSt : l.prisPerMeter, l.prisValuta, l.inkopt, reservedName(l), l.raknad, l.kommentar]);
    saveFile("Rubato_Lager_" + todayISO() + ".csv", csv(["Batch ID", "Type", "Item", "Colour", "Size", "Located at", "Status", "Unit", "Purchased", "Left", "Width (cm)", "Price per unit", "Currency", "Purchase date", "Reserved for", "Last counted", "Comment"], rows));
  }
  function exportStyleEan(st) {
    saveFile("EAN_" + safeName(st.namn) + ".csv", csv(["Product", "Colour", "Size", "EAN"], (st.ean || []).map((e) => [st.namn, e.farg, e.storlek, e.ean])));
  }
  function exportAllEan() {
    const rows = [];
    for (const s of D.styles) for (const e of s.ean || []) rows.push([s.namn, s._id, s.leverantor, e.farg, e.storlek, e.ean, e.t ? String(e.t).slice(0, 10) : ""]);
    rows.sort((a, b) => String(a[5]).localeCompare(String(b[5])));
    saveFile("Rubato_EAN_" + todayISO() + ".csv", csv(["Product", "Style ID", "Supplier", "Colour", "Size", "EAN", "Assigned"], rows));
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
  const labelItem = (s) => ({ id: s._id, title: styleName(s), lines: [[s.version, s.farg].filter(Boolean).join(" · "), tygName(s), [s.leverantor, platsText(s)].filter(Boolean).join(" · "), s.mottagen ? "Received " + fmtDate(s.mottagen) : s.bestalld ? "Ordered " + fmtDate(s.bestalld) : ""] });
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
    $("lblWhat").textContent = n ? n + (n === 1 ? " label: " : " labels: ") + lblIds.slice().sort().slice(0, 14).join(", ") + (n > 14 ? " …" : "") : "No samples selected. Choose in the list or take all received without a label.";
    $("lblGrid").replaceChildren(...Array.from({ length: 24 }, (_, i) => h("span", { class: i + 1 < start ? "skip" : i + 1 < start + n ? "use" : null })));
    const pages = Math.max(1, Math.ceil((start - 1 + n) / 24));
    $("lblGo").textContent = pages > 1 ? "Download PDF (" + pages + " sheets)" : "Download PDF";
    $("lblGo").disabled = !n || !downloads;
  }
  function closeLabels() { $("lblScrim").hidden = true; $("lblDlg").hidden = true; }
  $("lblStart").addEventListener("change", renderLabelDlg);
  $("lblAll").addEventListener("click", () => { lblIds = unprinted(); renderLabelDlg(); });
  $("lblCancel").addEventListener("click", closeLabels);
  $("lblScrim").addEventListener("click", closeLabels);
  $("lblGo").addEventListener("click", async () => {
    const btn = $("lblGo"); btn.disabled = true; btn.textContent = "Creating PDF …";
    try {
      await loadLibs();
      const items = lblIds.map((id) => byId(D.samples, id)).filter(Boolean).sort((a, b) => a._id.localeCompare(b._id)).map(labelItem);
      const doc = drawLabels(window.jspdf.jsPDF, window.qrcode, items, Number($("lblStart").value || 1), APP_URL);
      const ok = await saveFile("Rubato_sample-etiketter_" + todayISO() + ".pdf", doc.output("blob"));
      if (ok) {
        toast("Label PDF ready");
        if (canWrite) { const today = todayISO(); for (const id of lblIds.slice()) { const s = byId(D.samples, id); if (s && s.etikett !== today) await write("samples", id, { etikett: today }); } }
        selected.clear(); closeLabels(); scheduleRefresh();
      }
    } catch (e) { toast(e && e.message === "load" ? "Could not load the PDF tool. Check the network and try again." : "Could not create the PDF."); }
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
    banner("The app requires you to be signed in to Claude and to have had the page shared with you.");
    loaded.add("samples"); loaded.add("styles"); loaded.add("fabrics"); loaded.add("lager"); loaded.add("drops"); loaded.add("po"); loaded.add("ref"); loaded.add("pool");
    VIEWS[UI.tab].update();
  }
  function subError() { banner("Lost contact with the database. Reload the page."); }
  switchTab(initialTab());
  (async () => {
    let me = null;
    try { me = await P.start(); } catch (e) { console.error(e); banner("Could not read the database: " + (e.message || e)); }
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
      const docs = mapDocs(snap).filter(filter || (() => true));
      if (key === "drops" || key === "po") RAW[key] = docs; else D[key] = docs;
      if (key === "drops" || key === "handelser") deriveDrops();
      if (key === "po" || key === "styles" || key === "lev") derivePo();
      loaded.add(key); scheduleRefresh(); openFromHash(); if (after) after();
    }, subError);
    sub("samples", "samples"); sub("styles", "styles", null, () => { probeExternalImages(); renderDiag(); setTimeout(hostedAutoShopify, 1500); }); sub("tyger", "tyger"); sub("tyglager", "lager"); sub("leverantorer", "lev"); sub("drops", "drops"); sub("po", "po", (p) => !ME.leverantor || norm(p.leverantor) === norm(ME.leverantor)); sub("budget", "budget"); sub("refplagg", "ref"); sub("handelser", "handelser"); sub("flaggor", "flaggor"); sub("shopifypriser", "shopify");
    db.doc("ean/pool").onSnapshot((snap) => { D.pool = snap.exists ? snap.data() : null; loaded.add("pool"); scheduleRefresh(); }, subError);
    db.doc("installningar/app").onSnapshot((snap) => { if (snap.exists) Object.assign(D.settings, snap.data()); deriveDrops(); scheduleRefresh(); }, subError);
    db.collection("eanLogg").orderBy("t", "desc").limit(50).onSnapshot((snap) => { D.logg = snap.docs.map((doc) => Object.assign({}, doc.data(), { _id: doc.id })); scheduleRefresh(); }, subError);
  })();
})();
