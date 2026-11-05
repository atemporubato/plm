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
js = rep(js, 'const imgUrl = (id) => (/^https?:\\/\\//.test(String(id)) ? String(id) : "/_blob/" + id);', 'const imgUrl = (id) => (/^https?:\\/\\//.test(String(id)) ? String(id) : P.assets.url(id));');
js = rep(js, '    if (t === "ean" && downloads) add("Exportera alla EAN", exportAllEan);\n', '    if (t === "ean" && downloads) add("Exportera alla EAN", exportAllEan);\n    a.append(h("button", { class: "btn", type: "button", text: "Logga ut", title: P.user.email(), onclick: P.signOut }));\n');
// Boot: artefaktens boot-block behålls, bara plattformsraderna byts (inloggning via Supabase).
js = rep(js, '    if (!window.claude || typeof window.claude.use !== "function") { showUnavailable(); return; }\n    const [d, u, dl, as] = await Promise.all([window.claude.use("db"), window.claude.use("user"), window.claude.use("downloads"), window.claude.use("assets")]);\n    db = d; user = u; downloads = dl; assets = as;\n    if (!db) { showUnavailable(); return; }\n',
  '    let me = null;\n    try { me = await P.start(); } catch (e) { console.error(e); banner("Kunde inte läsa databasen: " + (e.message || e)); }\n    if (!me) { showLogin(); return; }\n    $("login").hidden = true;\n    db = P.db; user = P.user; downloads = P.downloads; assets = P.assets;\n');
js = rep(js, '  function showUnavailable() {', '  function showLogin() { $("login").hidden = false; $("loginBtn").addEventListener("click", () => { $("loginBtn").disabled = true; P.signIn(); }); }\n  function showUnavailable() {');
if (!js.includes('db.doc("installningar/app").onSnapshot')) throw new Error("installningar/app-prenumerationen hittades inte i boot-blocket.");


// ---- hostad inloggning: texter som nämner Claude-konton ----
js = rep(js, 'text: "Vem ser vad. Alla loggar in med sitt eget Claude-konto; här styr du vilken roll de får i appen och vilka flikar rollen ser. Bjud in nya personer via Dela-menyn uppe till höger: Contributor för att kunna redigera, Editor för att även kunna hantera användare. Personer utanför Rubatos Claude-organisation kan bara läsa."',
  'text: "Vem ser vad. Alla loggar in med sitt Rubato-konto (Microsoft) och dyker upp här efter första besöket; här styr du vilken roll de får i appen och vilka flikar rollen ser. Admin (kan hantera användare) sätts i databasen av Jakob."');
js = rep(js, 'text: "Bara Editor/ägare kan hantera användare."', 'text: "Bara admin kan hantera användare."');
js = rep(js, '"Du har läsbehörighet. Be Elliot om Contributor-behörighet för att uppdatera."', '"Du har läsbehörighet. Be Elliot om en roll som får redigera."');

// ---- hosted-only: Shopify-sektion på stylen och Shopify-flik ----
js = rep(js, '    const addNote = async () => { const t = noteIn.value.trim(); const cur = current(); if (!t || isNew) return; if (await write("styles", cur._id,', hosted("style-shopify.js") + '\n    const addNote = async () => { const t = noteIn.value.trim(); const cur = current(); if (!t || isNew) return; if (await write("styles", cur._id,');
js = rep(js, '    const body = [varSec, form, ownImgs, planSec, gallerySec, prodSec, samplesSec, eanSec];', '    const body = [varSec, form, ownImgs, planSec, gallerySec, prodSec, samplesSec, eanSec, shopSec];');
js = rep(js, 'renderVariants(); renderPlan(); renderGallery(); renderProd(); renderSamples(); renderEanTable(); if (!isNew) renderLogInto(logUl, current().logg); }', 'renderVariants(); renderPlan(); renderGallery(); renderProd(); renderSamples(); renderEanTable(); if (!isNew) { renderFarger(); renderLogInto(logUl, current().logg); } }');
js = rep(js, '        const changes = describeChanges(cur, o, ST_LABELS);\n        if (!changes.length) {', '        const changes = describeChanges(cur, o, ST_LABELS);\n        await saveShopFields();\n        if (!changes.length) {');
js = rep(js, '  // ---------- tabs ----------', hosted("shopify-tab.js") + '  // ---------- tabs ----------');
js = rep(js, 'ecom: EcomView, coo: CooView, tyglager: LagerView', 'ecom: EcomView, shopify: ShopifyView, coo: CooView, tyglager: LagerView');
js = rep(js, '    ecom: { view: null, season: "", q: "", touched: false },\n', '    ecom: { view: null, season: "", q: "", touched: false },\n    shopify: { view: null, status: "ej", q: "", lev: "", season: "", alla: false },\n');
js = rep(js, '["ecom", "E-com"], ["coo", "COO"]', '["ecom", "E-com"], ["shopify", "Shopify"], ["coo", "COO"]');
js = rep(js, 'const NEW_TABS = ["coo"];', 'const NEW_TABS = ["coo", "shopify"];');
js = rep(js, '    set("c_ean",', '    set("c_shopify", shopRows().filter((r) => !r.pushed && !r.saknar.length).length);\n    set("c_ean",');

// ---- HTML ----
markup = rep(markup, '<button class="tab" role="tab" type="button" data-tab="ecom">', '<button class="tab" role="tab" type="button" data-tab="shopify"><span class="tn">Shopify <span class="c" id="c_shopify"></span></span><span class="who">Jakob</span></button>\n    <button class="tab" role="tab" type="button" data-tab="ecom">');
// Shopify-fliken ska ligga efter E-com: flytta knappen
{
  const btn = markup.match(/<button class="tab" role="tab" type="button" data-tab="shopify">.*?<\/button>\n    /s)[0];
  markup = markup.replace(btn, "");
  markup = rep(markup, '<button class="tab" role="tab" type="button" data-tab="coo">', btn + '<button class="tab" role="tab" type="button" data-tab="coo">');
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
