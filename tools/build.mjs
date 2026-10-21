// Bygger den hostade appen från en version av Elliots artefakt.
//   node tools/build.mjs artifact/v1.html
// Läser artefaktens HTML, byter ut Claude-plattformen (window.claude.use) mot web/platform.js,
// lägger på inloggning, utloggning och de hosted-only delarna i tools/hosted/, och skriver
// web/index.html + web/app.js. Varje byte är en exakt strängmatchning som måste träffa precis en
// gång, så att en ny artefaktversion som ändrat något stoppar bygget i stället för att tyst bli fel.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(process.argv[2] || join(ROOT, "artifact", "v1.html"), "utf8");
const hosted = (f) => readFileSync(join(ROOT, "tools", "hosted", f), "utf8");

function rep(s, old, neu, count = 1) {
  const n = s.split(old).length - 1;
  if (n !== count) throw new Error(`Bygget stoppat: väntade ${count} träff(ar) på "${old.slice(0, 80)}" men hittade ${n}. Artefakten har ändrats, uppdatera tools/build.mjs.`);
  return s.split(old).join(neu);
}

// ---- dela upp artefakten ----
const scriptStart = src.indexOf("<script>\n(() => {");
if (scriptStart < 0) throw new Error("Hittar inte appens script.");
const headStart = src.indexOf("<link rel=\"preconnect\"");
const body = src.slice(headStart >= 0 && headStart < scriptStart ? headStart : src.indexOf("<style>"), scriptStart);
let js = src.slice(scriptStart + "<script>\n".length, src.lastIndexOf("</script>"));
const styleEnd = body.indexOf("</style>") + "</style>".length;
let head = body.slice(0, styleEnd);
let markup = body.slice(styleEnd);

// ---- JS: plattformsbyte ----
js = rep(js, '(() => {\n  "use strict";', 'import * as P from "./platform.js";\n(() => {\n  "use strict";');
js = js.replace(/const APP_URL = "https:\/\/claude\.ai\/artifact\/[^"]+";/, 'const APP_URL = location.origin + location.pathname;');
if (!js.includes("const APP_URL = location.origin")) throw new Error("APP_URL hittades inte.");
{ const a = js.indexOf("  async function allocateEan(n) {"); const b = js.indexOf("\n  }\n", a) + 4; if (a < 0) throw new Error("allocateEan saknas"); js = js.slice(0, a) + "  const allocateEan = (n) => P.allocateEan(n);\n" + js.slice(b); }
js = rep(js, 'const imgUrl = (id) => "/_blob/" + id;', 'const imgUrl = (id) => P.assets.url(id);');
js = rep(js, '    if (t === "ean" && downloads) add("Exportera alla EAN", exportAllEan);\n', '    if (t === "ean" && downloads) add("Exportera alla EAN", exportAllEan);\n    a.append(h("button", { class: "btn", type: "button", text: "Logga ut", title: P.user.email(), onclick: P.signOut }));\n');
{
  const a = js.indexOf("  // ---------- boot ----------"); const b = js.lastIndexOf("})();");
  if (a < 0 || b < 0) throw new Error("boot-blocket saknas");
  const old = js.slice(a, b);
  const subs = old.match(/sub\("[a-zA-Z]+", "[a-zA-Z]+"\);/g) || [];
  const extraSubs = (old.match(/^    db\.(doc|collection)\(.*$/gm) || []).map((l) => l + "\n").join("");
  if (!extraSubs.includes("installningar/app")) throw new Error("installningar/app-prenumerationen hittades inte i boot-blocket.");
  const boot = `  // ---------- boot (hostad) ----------
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
    ${subs.join(" ")}${extraSubs}  })();
`;
  js = js.slice(0, a) + boot + js.slice(b);
}

// ---- hosted-only: Shopify-sektion på stylen och Shopify-flik ----
js = rep(js, '    const addNote = async () => { const t = noteIn.value.trim(); const cur = current(); if (!t || isNew) return; if (await write("styles", cur._id,', hosted("style-shopify.js") + '\n    const addNote = async () => { const t = noteIn.value.trim(); const cur = current(); if (!t || isNew) return; if (await write("styles", cur._id,');
js = rep(js, '    const body = [form, planSec, gallerySec, prodSec, samplesSec, eanSec];', '    const body = [form, planSec, gallerySec, prodSec, samplesSec, eanSec, shopSec];');
js = rep(js, 'renderPlan(); renderGallery(); renderProd(); renderSamples(); renderEanTable(); if (!isNew) renderLogInto(logUl, current().logg); }', 'renderPlan(); renderGallery(); renderProd(); renderSamples(); renderEanTable(); if (!isNew) { renderFarger(); renderLogInto(logUl, current().logg); } }');
js = rep(js, '          const changes = describeChanges(cur, o, ST_LABELS);\n          if (!changes.length) { closeSheet(); return; }', '          const changes = describeChanges(cur, o, ST_LABELS);\n          await saveShopFields();\n          if (!changes.length) { closeSheet(); return; }');
js = rep(js, '  // ---------- tabs ----------', hosted("shopify-tab.js") + '  // ---------- tabs ----------');
js = rep(js, 'const VIEWS = { samples: SamplesView, ref: RefView, kollektion: KollView, produktion: ProdView, foto: FotoView, ecom: EcomView, tyglager: LagerView, leverantorer: LevView, ean: EanView }', 'const VIEWS = { samples: SamplesView, ref: RefView, kollektion: KollView, produktion: ProdView, foto: FotoView, ecom: EcomView, shopify: ShopifyView, tyglager: LagerView, leverantorer: LevView, ean: EanView }');
js = rep(js, '    ecom: { view: null, season: "", q: "" },\n', '    ecom: { view: null, season: "", q: "" },\n    shopify: { view: null, status: "ej", q: "", lev: "", season: "", alla: false },\n');
js = rep(js, '    set("c_ean",', '    set("c_shopify", shopRows().filter((r) => !r.pushed && !r.saknar.length).length);\n    set("c_ean",');

// ---- HTML ----
markup = rep(markup, '<button class="tab" role="tab" type="button" data-tab="ecom">', '<button class="tab" role="tab" type="button" data-tab="shopify"><span class="tn">Shopify <span class="c" id="c_shopify"></span></span><span class="who">Jakob</span></button>\n    <button class="tab" role="tab" type="button" data-tab="ecom">');
// Shopify-fliken ska ligga efter E-com: flytta knappen
{
  const btn = markup.match(/<button class="tab" role="tab" type="button" data-tab="shopify">.*?<\/button>\n    /s)[0];
  markup = markup.replace(btn, "");
  markup = rep(markup, '<button class="tab" role="tab" type="button" data-tab="tyglager">', btn + '<button class="tab" role="tab" type="button" data-tab="tyglager">');
}
const login = `
<div class="login" id="login" hidden>
  <div class="login-card">
    <h1>Rubato <em>PLM</em></h1>
    <p>Samples, kollektion, produktion, foto och EAN. Logga in med ditt Rubato-konto.</p>
    <button class="btn primary" id="loginBtn" type="button">Logga in med Microsoft</button>
  </div>
</div>
`;
head = rep(head, "</style>", hosted("hosted.css") + "\n</style>");
const html = `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Rubato PLM</title>
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
${head}
</head>
<body>
${login}${markup}
<script type="module" src="./app.js"></script>
</body>
</html>
`;
writeFileSync(join(ROOT, "web", "index.html"), html);
writeFileSync(join(ROOT, "web", "app.js"), js);
console.log("Byggt web/index.html (" + html.length + " tecken) och web/app.js (" + js.length + " tecken).");
