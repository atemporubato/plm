# Rubato PLM

Intern app för produktutvecklingen: samples, kollektion, produktion, foto, e-com, tyglager, leverantörer, EAN och Shopify-push.

## Arbetssätt

Princip: artefakten är kod, appen är data. Elliot utvecklar koden i Claude-artefakten (sandbox). All riktig data (samples, styles, PO, EAN, leverantörer) läggs in och ändras i den hostade appen på plm.atemporubato.com. Jakob hostar: varje ny version av artefakten läggs som `artifact/vN.html`, byggs och går live. Se CHANGELOG.md.

1. Spara artefaktens HTML som `artifact/vN.html` (Artifact-verktyget i Claude Code läser den).
2. `node tools/build.mjs artifact/vN.html` skriver `web/index.html` och `web/app.js`. Bygget byter ut Claude-plattformen mot `web/platform.js` (Supabase) och lägger på inloggning samt de hosted-only delarna i `tools/hosted/`. Varje byte är en exakt strängmatchning; har artefakten ändrat något stoppar bygget med ett meddelande om vad som behöver uppdateras.
3. Ingen dataimport i normalfallet (artefaktens data är testdata). Undantag görs bara medvetet: exportera (fångas i Chrome när artefakten är öppen) till `tools/data/elliot-export-<datum>.json` och kör `node tools/import-dokument.js <fil>`, som skriver över de dokument som finns i exporten.
4. Commit och push till main, Vercel deployar.

## Struktur

- `web/` appen. `index.html` och `app.js` är byggda (ändra inte för hand), `platform.js` datalagret, `config.js` publik nyckel.
- `api/shopify.js` serverless-funktion för Shopify-push (Vercel). Miljövariabler: SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY.
- `api/flagga.js` direktmejl när någon flaggar något i appen (samma Microsoft-nycklar som notismejlet).
- `api/omnamn.js` direktmejl till den som @-taggas i en kommentar (Historik på sample, style, PO och lager). Samma Microsoft-nycklar.
- `api/redo.js` direktmejl till Elliot när en style blir godkänd och är redo att beställa (samma Microsoft-nycklar).
- Språk: källan är på svenska, appen byggs på engelska. `node tools/build.mjs artifact/vN.html` kör `tools/i18n.mjs` sist och översätter enligt `tools/en.json`; `--sv` ger svensk bygge. Kräver `npm install` (acorn).
- `api/notiser.js` dagligt notismejl kl. 10 (Vercel cron). Miljövariabler: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MAIL_FROM, CRON_SECRET, valfri NOTISER_TEST_TILL. Admin kan förhandsvisa: /api/notiser?preview=jakob&token=<Supabase-token>.
- `artifact/` Elliots versioner.
- `tools/` build.mjs, hosted/ (Shopify-sektion, Shopify-flik, CSS), db.mjs (kör SQL), import-dokument.js, import-ean.mjs, data/.
- `supabase/migrations/` numrerade schemaändringar, körs med `node tools/db.mjs <fil>`.
- `devserver.js` lokal server för app och API: `node devserver.js`, http://localhost:3000.

## Databasen

- `dokument` (collection, id, data jsonb): artefaktens alla collections (samples, styles, po, drops, budget, refplagg, tyger, tyglager, leverantorer, eanLogg).
- `ean_pool`, `ean_anvanda`, funktionen `tilldela_ean`: EAN-serien, delas ut med radlås och hoppar över Shopify-nummer.
- `installningar`: app (artefaktens inställningar), storlekskoder, shopify, stylekod_nasta.
- `shopify_styles`, `style_farger`: hosted-only produktdata och Shopify-koppling per style och färg.
- `anvandare`: roll admin/team. Bara atemporubato.com-konton (RLS).
- Storage-bucket `bilder` (publik): bilder och bilagor, objektnamn = artefaktens asset-id.
