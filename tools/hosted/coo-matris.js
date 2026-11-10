  // ---------- COO: matrisvy (hosted-only) ----------
  // Kritisk linje per drop och per event. Rader = föräldrar (hor_till tom, matris satt), kolumner = mallens faser
  // (installningar "planeringsmallar"), celler = barnen (hor_till = förälderns id, fas = kolumnens fas).
  // Elliots COO-vy ligger orörd som läget "Lista".
  const MX_SECTIONS = [["drop", "Drops", "Ny drop"], ["pr", "PR-träffar", "Ny PR-träff"], ["in_residence", "In Residence", "Nytt In Residence"], ["massa", "Mässor", "Ny mässa"], ["invigning", "Lokaler", "Ny invigning"]];
  const MX_PARENT_FAS = { drop: "lansering" };
  const MX_DROP_LABELS = ["Drop 1", "Drop 2", "Drop 3", "Tailoring", "Coats"];
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
  const mxLedtid = (o) => { o = Number(o) || 0; if (o === 0) return "dag 0"; const a = Math.abs(o); const t = a % 7 === 0 ? a / 7 + " v" : a + " d"; return t + (o < 0 ? " före" : " efter"); };
  const mxShort = (iso) => { if (!isISO(iso)) return ""; const [, m, d] = iso.split("-").map(Number); return d + " " + MONTHS[m - 1]; };
  const mxIsTbd = (e) => /^TBD\s/i.test(e.titel || "");
  const mxState = (e) => (e.status === "Inställd" ? "installd" : e.status === "Klar" ? "klar" : isISO(e.datum) && e.datum < todayISO() ? "sen" : e.status === "Pågår" ? "pagar" : "planerad");
  const MX_STATE_LABEL = { planerad: "Planerad", pagar: "Pågår", klar: "Klar", sen: "Försenad", installd: "Inställd" };
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
    return h("button", { "data-id": e._id, class: "mx-cell" + (krock(e) ? " krock" : "") + (dim ? " dim" : "") + (s === "installd" ? " installd" : ""), type: "button", title: e.titel + " · " + MX_STATE_LABEL[s] + (krock(e) ? " · fler händelser samma dag" : ""), onclick: () => openEvent(e._id) },
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
    const body = Object.assign({ id, logg: [logEntry("Skapad från mallen (" + row.namn + ", " + mxLedtid(row.offset_dagar) + ")")], andrad: new Date().toISOString() }, mxChildBody(p, row, p.matris, etikett));
    if (await mxCreate(id, body)) { toast(id + " skapad"); scheduleRefresh(); }
  }

  function mxNewFromTemplate(matris, label) {
    const mall = mxMallar()[matris] || [];
    if (!mall.length) { toast("Mallen \"" + matris + "\" saknas i inställningarna."); return; }
    const isDrop = matris === "drop";
    const pfas = mxParentFas(matris);
    const prow = mall.find((r) => r.fas === pfas) || { fas: pfas, ansvarig: "Jakob", bana: "" };
    const fNamn = inp("f_mxnamn", "", { placeholder: isDrop ? "t.ex. SS27 Drop 3" : "t.ex. London PR Drop 3" });
    const fSas = inp("f_mxsas", MXS.sasong || "", { list: "dlSeason", autocomplete: "off", placeholder: "t.ex. SS27" });
    const fDropSel = selectEl("f_mxdrop", [["", isDrop ? "Välj …" : "– ingen –"]].concat(MX_DROP_LABELS.map((x) => [x, x])).concat([["__annat", "Annat …"]]), "");
    const fDropAnnat = inp("f_mxdropannat", "", { placeholder: "Egen etikett" }); fDropAnnat.hidden = true;
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
      field("Namn", fNamn, { full: true }), field("Säsong", fSas),
      field(isDrop ? "Drop-etikett" : "Drop (valfritt)", h("div", { style: "display:grid;gap:6px" }, fDropSel, fDropAnnat)),
      field(isDrop ? "Lanseringsdatum" : "Datum", fDatum), isDrop ? h("div") : field("Slut (om flera dagar)", fSlut));
    async function save(btn) {
      const etikett = fDropSel.value === "__annat" ? fDropAnnat.value.trim() : fDropSel.value;
      const namn = fNamn.value.trim();
      if (!namn) { toast("Ge den ett namn."); fNamn.focus(); return; }
      if (!isISO(fDatum.value)) { toast("Sätt ett datum."); fDatum.focus(); return; }
      if (isDrop && !etikett) { toast("Välj drop-etikett."); fDropSel.focus(); return; }
      if (btn) btn.disabled = true;
      try {
        const now = new Date().toISOString();
        const pid = await mxNextId();
        const datum = fDatum.value;
        const slut = !isDrop && isISO(fSlut.value) && fSlut.value >= datum ? fSlut.value : datum;
        const parent = { id: pid, titel: namn, typ: isDrop ? "drop" : (matris === "invigning" ? "lokaler" : "massor"), datum, slut, sasong: fSas.value.trim(), drop: etikett, agare: mxFirstName(prow.ansvarig) || "Jakob", ansvarig: prow.ansvarig || "Jakob", bana: prow.bana || "", status: "Planerad", kommentar: "", poId: null, styleId: null, hor_till: null, fas: pfas, offset_dagar: 0, matris, logg: [logEntry("Skapad från mallen " + label)], andrad: now };
        if (!(await mxCreate(pid, parent))) return;
        const p = Object.assign({}, parent, { _id: pid });
        let n = 1;
        for (const row of mall) {
          if (row.fas === pfas) continue;
          const id = await mxNextId();
          const body = Object.assign({ id, logg: [logEntry("Skapad från mallen " + label + " (" + mxLedtid(row.offset_dagar) + ")")], andrad: now }, mxChildBody(p, row, matris, isDrop ? etikett : mxStripTbd(namn)));
          if (await mxCreate(id, body)) n++;
        }
        toast(n + " händelser skapade (" + pid + ")");
        mxIsOpen(pid);
        closeSheet(); scheduleRefresh();
      } finally { if (btn) btn.disabled = false; }
    }
    const saveBtn = h("button", { class: "btn primary", type: "button", text: "Skapa från mallen", onclick: (ev) => save(ev.target) });
    openSheet({ tag: "Ny", title: label, sub: mall.length + " händelser enligt mallen", body: [form, h("section", null, h("h3", { class: "sec-title", text: "Mallen" }), preview)], foot: [h("button", { class: "btn", type: "button", text: "Avbryt", onclick: closeSheet }), saveBtn], focus: "f_mxnamn" });
  }

  function mxPoPanel(p) {
    const pos = D.po.filter((po) => norm(po.sasong) === norm(p.sasong) && norm(po.drop) === norm(p.drop) && p.drop);
    if (!p.drop) return h("p", { class: "sub", text: "Ingen drop-etikett på lanseringen, så inga PO:er kan matchas." });
    if (!pos.length) return h("p", { class: "sub", text: "Inga PO:er med säsong " + (p.sasong || "–") + " och drop " + p.drop + "." });
    const t = h("table", { class: "ledger mx-po" });
    t.append(h("thead", null, h("tr", null, ...["PO", "Leverantör", "Status", "Önskad leverans", "Planerad ex", "ETA lager", "Fotosample"].map((x) => h("th", { text: x })))));
    const tb = h("tbody");
    for (const po of pos.sort((a, b) => String(a.nr || a._id).localeCompare(String(b.nr || b._id), "sv"))) {
      const eta = typeof poEta === "function" ? poEta(po) : po.etaLager;
      tb.append(h("tr", { class: "mx-po-row" },
        h("td", null, h("button", { class: "linklike", type: "button", text: po.nr || po._id, onclick: () => { closeSheet(); switchTab("produktion"); openPo(po._id); } })),
        h("td", { text: po.leverantor || "" }), h("td", null, h("span", { class: "chip", text: poStatusNorm(po.status) || "" })),
        h("td", { class: "mono", text: fmtDate(po.leveransOnskad) }), h("td", { class: "mono", text: fmtDate(po.planeradEx) || (isISO(po.bekraftadEx) ? "bekr. " + fmtDate(po.bekraftadEx) : "") }),
        h("td", { class: "mono", text: fmtDate(eta) }), h("td", { text: po.fotosample || "" })));
      const rader = (po.rader || []).filter((r) => r.produkt || r.styleId);
      if (rader.length) {
        const list = h("div", { class: "mx-prod" }, ...rader.map((r) => {
          const st = r.styleId ? byId(D.styles, r.styleId) : null;
          const ps = r.perStorlek ? Object.values(r.perStorlek).reduce((a, x) => a + (num(x) || 0), 0) : 0;
          const antal = ps || num(r.antal) || 0;
          return h("span", { class: "mx-prod-item" }, h("span", { text: (st && st.namn) || r.produkt || r.styleId }), h("span", { class: "sub", text: " · " + (fargText(r.farg) || r.farg || "TBA") + " · " + antal + " st" }));
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
      p.matris === "drop" ? h("section", null, h("h3", { class: "sec-title", text: "PO:er och produkter · " + [p.sasong, p.drop].filter(Boolean).join(" ") }), mxPoPanel(p)) : null,
      others.length ? h("section", null, h("h3", { class: "sec-title", text: "Utanför mallen" }), h("div", { class: "mx-others" }, ...others.map((k) => h("button", { class: "btn small", type: "button", text: k.titel + " · " + mxShort(k.datum), onclick: () => openEvent(k._id) })))) : null,
      h("section", null, h("h3", { class: "sec-title", text: "Kommentar" }), p.kommentar ? h("p", { class: "mx-kom", text: p.kommentar }) : h("p", { class: "sub", text: "Ingen kommentar." })),
      h("section", null, h("h3", { class: "sec-title", text: "Historik" }), logUl));
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
    if (!mall.length) return h("section", { class: "mx-sec" }, head, h("p", { class: "sub", text: "Mallen saknas i inställningarna (planeringsmallar." + matris + ")." }));
    const t = h("table", { class: "mx" });
    t.append(h("thead", null, h("tr", null, h("th", { class: "mx-rowh", text: matris === "drop" ? "Drop" : "Event" }), ...mall.map((r) => h("th", { class: r.fas === pfas ? "mx-parentcol" : null }, h("span", { text: r.namn }), h("span", { class: "sub", text: mxLedtid(r.offset_dagar) }))))));
    const tb = h("tbody");
    if (!rows.length) tb.append(h("tr", null, h("td", { colspan: String(cols.length + 1), class: "sub", text: "Inget att visa med valda filter." })));
    for (const p of rows) {
      const kids = model.kids.get(p._id) || [];
      const open = mxIsOpen(p._id);
      const tbd = mxIsTbd(p);
      const tr = h("tr", { class: "mx-row" + (tbd ? " tbd" : "") + (open ? " open" : "") });
      tr.append(h("th", { class: "mx-rowh", scope: "row" },
        h("button", { class: "mx-name", type: "button", "aria-expanded": String(open), onclick: () => { mxToggle(p._id); MatrisView.update(); } }, h("span", { class: "mx-caret", text: open ? "▾" : "▸" }), h("span", { text: p.titel })),
        h("span", { class: "sub", text: [mxShort(p.datum), p.sasong, p.drop].filter(Boolean).join(" · ") })));
      for (const r of mall) {
        const td = h("td");
        if (r.fas === pfas) td.append(mxCell(p, model.krock, MXS.ansvarig && !mxHasPerson(p, MXS.ansvarig)));
        else {
          const ks = kids.filter((k) => k.fas === r.fas).sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
          if (ks.length) ks.forEach((k) => td.append(mxCell(k, model.krock, MXS.ansvarig && !mxHasPerson(k, MXS.ansvarig))));
          else if (!ro) td.append(h("button", { class: "mx-add", type: "button", title: "Skapa \"" + r.namn + "\" från mallen (" + mxLedtid(r.offset_dagar) + ")", text: "+", onclick: () => mxAddChild(p, r) }));
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
      h("h3", { class: "sec-title", text: "Min vecka" + (who ? " · " + who : "") }),
      xs.length ? h("ul", null, ...xs.map((e) => h("li", null, h("button", { class: "linklike", type: "button", onclick: () => openEvent(e._id) }, h("i", { class: "mx-dot " + mxState(e) }), h("span", { class: "mono", text: mxShort(e.datum) }), " ", e.titel))))
        : h("p", { class: "sub", text: "Inget på " + (who || "någon") + " de kommande 7 dagarna." }));
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
      const sSel = selectEl("f_mxsas_f", [["", "Alla säsonger"]].concat(seasons.map((x) => [x, x])), MXS.sasong);
      sSel.addEventListener("change", () => { MXS.sasong = sSel.value; mxSave(); this.update(); });
      const aSel = selectEl("f_mxansv_f", [["", "Alla ansvariga"]].concat(people.map((x) => [x, x])), MXS.ansvarig);
      aSel.addEventListener("change", () => { MXS.ansvarig = aSel.value; mxSave(); this.update(); });
      const tbdBox = h("input", { type: "checkbox", checked: MXS.tbd, onchange: () => { MXS.tbd = tbdBox.checked; mxSave(); this.update(); } });
      const tbd = h("label", { class: "checkline" }, tbdBox, "Visa TBD");
      const legend = h("span", { class: "mx-legend" }, ...["planerad", "pagar", "klar", "sen"].map((s) => h("span", null, h("i", { class: "mx-dot " + s }), MX_STATE_LABEL[s])), h("span", null, h("i", { class: "mx-krockbox" }), "Samma dag"));
      this.bar.replaceChildren(sSel, aSel, tbd, legend);
      this.body.replaceChildren(mxWeek(), ...MX_SECTIONS.map(([m, l, n]) => mxMatrix(m, l, n, model)));
    }
  };

  const CooMatrisView = {
    mount(root) {
      this.seg = h("div", { class: "seg mx-seg", role: "group", "aria-label": "Vy" });
      this.btns = [["matris", "Matris"], ["lista", "Lista"]].map(([v, l]) => { const b = h("button", { type: "button", text: l, onclick: () => { if (MXS.vy === v) return; MXS.vy = v; mxSave(); this.remount(); } }); b.dataset.v = v; return b; });
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
        const ok = await write("handelser", x.k._id, { datum: x.nd, slut: x.ns, andrad: new Date().toISOString(), logg: (fresh.logg || []).concat(logEntry("Flyttad med lanseringen från " + fmtDate(x.k.datum) + " till " + fmtDate(x.nd))) });
        if (ok) n++;
      }
      toast(n + " faser flyttade"); closeSheet(); scheduleRefresh();
    };
    openSheet({ tag: "Flytta", title: "Flytta alla faser med?", sub: e.titel + ": " + fmtDate(e.datum) + " → " + fmtDate(o.datum),
      body: [h("p", { text: "Varje fas får lanseringens nya datum plus sin ledtid från mallen. Nej flyttar bara " + (e.matris === "drop" ? "lanseringen" : "eventet") + "." }), list],
      foot: [h("button", { class: "btn", type: "button", text: "Nej, bara " + (e.matris === "drop" ? "lanseringen" : "eventet"), onclick: closeSheet }), h("button", { class: "btn primary", type: "button", text: "Ja, flytta " + plan.length + " faser", onclick: (ev) => doMove(ev.target) })] });
  }

