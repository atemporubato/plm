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
