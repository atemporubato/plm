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
            if (ids.length && await write("styles", s._id, { bilder: ids, bildId: ids[0], bildAuto: true, fargBilder, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry("Shopify-bilder hämtade automatiskt: " + per.map((x) => x.titel).join(", "))) })) antal += ids.length;
            continue;
          }
          if (!hit || !hit.url || !(gammal(s) || hit.exakt)) continue;
          if (await write("styles", s._id, { shopifyBild: { url: hit.url, titel: hit.titel, handle: hit.handle, likhet: "samma", auto: true }, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry("Shopify-bild kopplad automatiskt: " + hit.titel)) })) { Object.assign(cur, { shopifyBild: { url: hit.url, titel: hit.titel, handle: hit.handle, likhet: "samma", auto: true } }); hits++; }
        } catch (e) { delete provat[s._id]; }
      }
      try { localStorage.setItem("plmAutoShopify4", JSON.stringify(provat)); } catch (e) {}
      if (antal) toast(antal + " " + "Shopify-bilder hämtade");
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
    const f = inp("f_smattbutik", "", { list: "dlButikMatt", autocomplete: "off", placeholder: "Sök produkt, t.ex. Mercer Jacket" });
    let tabeller = [];
    const ladda = async () => { if (tabeller.length) return; try { tabeller = await hamtaButikMatt(); dl.replaceChildren(...tabeller.map((x) => h("option", { value: x.namn }))); } catch (e) { toast("Kunde inte hämta måttabellerna från Shopify"); } };
    f.addEventListener("focus", ladda);
    f.addEventListener("change", async () => {
      await ladda();
      const x = tabeller.find((y) => norm(y.namn) === norm(f.value)); if (!x) return;
      const text = "Mått från butiken: " + x.namn + " (cm)\n" + x.rader.map((r) => r[0] + ": " + r.slice(1).map((v, i) => (x.kolumner[i] ? x.kolumner[i] + " " : "") + v).join(" · ")).join("\n");
      fMatt.value = fMatt.value.trim() ? fMatt.value.trim() + "\n\n" + text : text;
      fMatt.dispatchEvent(new Event("input", { bubbles: true }));
      fMattFran.value = ""; f.value = "";
      toast("Måttlistan ifylld från " + x.namn);
    });
    return h("div", { class: "field full" }, h("label", { for: "f_smattbutik", text: "Mått från butiken" }), f, dl, h("span", { class: "hint", text: "Alla produkter med måttabell i Shopify, även historiska. Välj en så fylls måttlistan i." }));
  }
