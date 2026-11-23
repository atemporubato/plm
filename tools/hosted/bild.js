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
    let provat = {}; try { provat = JSON.parse(localStorage.getItem("plmAutoShopify") || "{}"); } catch (e) {}
    const nu = Date.now(), vecka = 7 * 864e5;
    const todo = D.styles.filter((s) => ["NOOS", "Restock"].includes(s.typ) && s.namn && !s.shopifyBild && !s.bildId && !docImages(s).length && !(provat[s._id] && nu - provat[s._id] < vecka)).slice(0, 40);
    if (!todo.length) return;
    autoShopifyKor = true;
    let hits = 0;
    try {
      const { data: { session } } = await P.supabase.auth.getSession();
      for (const s of todo) {
        provat[s._id] = nu;
        try {
          const res = await fetch("/api/bild", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (session ? session.access_token : "") }, body: JSON.stringify({ sok: s.namn, farger: s.farger || [] }) });
          if (!res.ok) { delete provat[s._id]; continue; }
          const hit = (await res.json()).hit;
          if (!hit || !hit.url) continue;
          const cur = byId(D.styles, s._id) || s;
          if (cur.shopifyBild || cur.bildId || docImages(cur).length) continue;
          if (await write("styles", s._id, { shopifyBild: { url: hit.url, titel: hit.titel, handle: hit.handle, likhet: "samma", auto: true }, andrad: new Date().toISOString(), logg: (cur.logg || []).concat(logEntry("Shopify-bild kopplad automatiskt: " + hit.titel)) })) { Object.assign(cur, { shopifyBild: { url: hit.url, titel: hit.titel, handle: hit.handle, likhet: "samma", auto: true } }); hits++; }
        } catch (e) { delete provat[s._id]; }
      }
      try { localStorage.setItem("plmAutoShopify", JSON.stringify(provat)); } catch (e) {}
      if (hits) await importShopifyImages();
    } finally { autoShopifyKor = false; }
  }
