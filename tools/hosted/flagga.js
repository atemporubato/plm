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
  // Ref-plagg: hämtar ordrar taggade #reference i Shopify. Appen skapar ref-plaggen själv (importRefs).
  async function hostedRefShopify() {
    const { data: { session } } = await P.supabase.auth.getSession();
    const res = await fetch("/api/ref", { headers: { Authorization: "Bearer " + (session ? session.access_token : "") } });
    if (!res.ok) return { error: "HTTP " + res.status };
    return res.json();
  }
  // Emballage: ordrarna som påsar och kartonger räknas av mot. Appen räknar och skriver själv (syncPackaging).
  async function hostedPackShopify(since) {
    const { data: { session } } = await P.supabase.auth.getSession();
    const res = await fetch("/api/pack?since=" + encodeURIComponent(since), { headers: { Authorization: "Bearer " + (session ? session.access_token : "") } });
    if (!res.ok) { let msg = "HTTP " + res.status; try { msg = (await res.json()).error || msg; } catch (e) {} return { error: msg }; }
    return res.json();
  }
