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

