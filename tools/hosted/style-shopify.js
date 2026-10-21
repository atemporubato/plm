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
