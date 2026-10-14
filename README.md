# Rubato PLM

Intern app för samples, styles, tyger, tyglager, leverantörer, EAN och (kommande) produktion, filer och content.
Frontend: vanilla JS (Elliots ursprungliga app), datalager i `web/platform.js` mot Supabase.

## Köra lokalt

    cd ~/Developer/plm
    npm start

Öppna http://localhost:3000 och logga in med Microsoft-kontot.

## Struktur

- `web/` – appen. `index.html` (markup och CSS), `app.js` (vyer, formulär, tidsplan, etiketter), `platform.js` (Supabase: auth, läsning, skrivning, realtime), `config.js` (URL och publik nyckel, ofarlig att checka in).
- `supabase/migrations/` – databasschemat, numrerat. Körs med `node tools/db.mjs supabase/migrations/<fil>.sql`.
- `tools/` – script som körs på Mac minin med `.env` (aldrig i frontend): `db.mjs` (kör SQL), `import-ean.mjs` (läser in Shopifys EAN från Developer/files/ean-export).
- `.env` – hemligheter, gitignorerad.

## Behörighet

Bara konton på atemporubato.com kan läsa och skriva (row level security i databasen).
Rollen `admin` i tabellen `anvandare` låser upp EAN-administration. Sätts manuellt:

    update anvandare set roll = 'admin' where email = 'jakob@atemporubato.com';

## Importer som gjorts (oktober 2026)

- `tools/import-ean.mjs`: Shopifys 1 493 EAN till `ean_anvanda`, poolen startar på 92501 (GS1:s lista räknar 90001 till 92500 som upptagna).
- `tools/import-masterplaner.js`: 40 PO och 102 rader från Rubato_Masterplaner (flikarna Produktion och SS27), data i `tools/data/masterplaner_po.json`.
- `tools/import-elliot.js`: hela databasen ur Elliots Samples-artefakt (58 samples, 39 styles, 34 tyger, 2 tygpartier, 8 leverantörer), data i `tools/data/elliot-export-2026-10-14.json`.

Scripten körs med `node tools/<fil>` från repots rot; `.env` läses automatiskt. De är idempotenta (upsert), men import-elliot lägger till loggrader varje gång.

## Shopify-push

`api/shopify.js` är en serverless-funktion på Vercel. Den verifierar användarens Supabase-session (bara atemporubato.com), läser style, varianter, färgrad, leverantör och inställningar, bygger en `productSet`-payload och skapar produkten som utkast (en produkt per färg). SKU = stylekod-färgindex-storlekskod. Färgsyskon (colour_siblings, other_colors) uppdateras på alla produkter i stylen.

Miljövariabler i Vercel (Settings, Environment Variables): SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY.

Inställningar i tabellen `installningar`: `storlekskoder` (storlek till SKU-kod per system), `shopify` (produkttyper med Shopify-kategori och taggar, standardvikter, vendor), `stylekod_nasta` (nästa lediga stylekod).

Lokalt: `node devserver.js` (kräver .env) serverar både appen och /api/shopify på port 3000.
