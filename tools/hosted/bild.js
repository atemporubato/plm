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
