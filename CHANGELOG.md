# Changelog

Arbetssätt: Elliot utvecklar i artefakten (sandbox). Jakob hostar: artefaktens HTML sparas som
artifact/vN.html, byggs med `node tools/build.mjs artifact/vN.html`, datan exporteras ur artefakten
och importeras med `node tools/import-dokument.js`, och main går live på plm.atemporubato.com.

Versionsnumrering: små ändringar ger punktversion (v9.1, v9.2 …). Nytt heltal (v10) bara vid stora ändringar.

## v10.21 (2026-11-24)

Måtten redigerbara för alla, med automatisk kommentar. Inget nytt fält; måtten sparas som förut i mattlista.
- Stylens ark visar måtten som samma tabell som i Conors design-ark, redigerbar för alla som får redigera: ändra värden, lägg till mått. Ändrade värden markeras gult tills man sparar.
- Textrutan finns kvar bakom knappen "Klistra in eller skriv som text" – klistrar man in från Excel uppdateras tabellen direkt. Butikens måttabeller ("Mått från butiken") fyller också tabellen.
- När måtten ändras skrivs en automatisk kommentar: "Mått ändrade av <namn>: Bröstvidd: 126,5 → 127; …". Den syns under Kommentarer på stylen och i historiken. Gäller både stylens ark och Conors design-ark (där får Carl och Alex dessutom en flagga, som i v10.20).
- Ändrar man i en lista som bara hänvisar till "samma mått som" en annan style blir måtten stylens egna och hänvisningen tas bort, så att originalet inte påverkas.
- Den tidigare loggraden "Måttlista: <hela texten>" ersätts av kommentaren.

## v10.20 (2026-11-24)

Conors design-ark: måtten som tabell, och kommentarer och måttändringar blir flaggor hos Carl och Alex. Inget nytt fält; måtten sparas som förut i mattlista.
- Måtten har en egen sektion under briefen, som tabell: nummer, mått och värde, en kolumn per storlek när måtten finns per storlek. Excel-inklistrade rader, butikens format ("S: Chest 54 · Length 70") och "Bröstvidd (M) 56" läses alla. Rader som inte är mått visas som noteringar ovanför. VERSALER från Excel visas som vanlig text (förkortningar som CB står kvar).
- Har stylen "samma mått som" en annan style och inga egna mått visas den stylens tabell.
- Conor kan ändra värden direkt i tabellen och lägga till mått. Ändrade värden markeras gult. När han sparar skrivs måtten tillbaka till stylens måttlista (vid "samma mått som" blir de stylens egna) och Carl och Alex får en flagga med ändringarna.
- En ny kommentar i "Kommentar till Carl och Alex" blir en flagga hos Carl och Alex.
- Flaggor från design-arket syns i både Idéer (Carl) och Samples (Alex) – nytt fält tabs på flaggan; äldre flaggor med bara tab fungerar som förut.
- Den allmänna kommentarssektionen är borttagen ur design-arket, så det finns bara en kommentarsruta.
- Måttraden i briefen är borttagen (ersatt av tabellen).

## v10.19 (2026-11-24)

Lager: nytt fält "Passar" på varje parti (nytt fält passar; inget befintligt fält ändras).
- Partiet får fältet "Passar" (vilka produkter det kan användas till, t.ex. "Walking Coat, Big Coat").
- I lagerlistan visas det i fetstil som ingress överst i kommentarskolumnen: "Passar: …".
- Sökbart i lagerfliken och med som egen kolumn i CSV-exporten.

## v10.18 (2026-11-24)

Mejl avstängt tills vidare (Elliot 24 nov). Flaggning är kvar, i appen.
- Inga mejl skickas: varken 10-mejlet, flagg-mejl, tagg-mejl eller Ready to order-mejl. Servern skickar bara om MEJL_PA=1 är satt i Vercel; utan den gör alla mejl-endpoints ingenting.
- Flaggor fungerar som förut i appen: kommentar krävs, ligger i Flaggat-rutan överst i fliken tills de är lösta.
- Kommentarer och @-taggar sparas och visas som förut, men utan mejl.
- Texterna i appen lovar inte längre mejl ("Flagga" i stället för "Flagga och mejla", osv.).
- Slås på igen: MEJL_PA = true i appen (artifact) och MEJL_PA=1 i Vercel. Ingen kod är borttagen.

## v10.17 (2026-11-24)

- Ready to order: raden under stylens namn visar stylens kommentar när den finns, annars som förut tidsplanen ("Produktionstid saknas …" osv.).

## Måttabeller ur produktbeskrivningarna (2026-11-23)

Bara servern, artefakten oförändrad (v10.15).
- api/matt.js läser nu även måttabellen i produktbeskrivningen (HTML-tabell) för produkter som saknar size_chart-objekt, t.ex. Tennis Jacket och äldre Nonpareil-plagg. Båda uppläggen tolkas (storlekar som rader eller som kolumner). En post per produktnamn; färgerna delar tabell.
- vercel.json: api/matt.js får köra upp till 30 s (går igenom hela produktkatalogen, svaret sparas i 10 min).

## Butikens måttabeller som måttreferens, historiska bilder (2026-11-23)

Bara hostade delar, artefakten oförändrad (v10.15). Ingen data skrivs om i bulk.
- Måttlistan på en style: nytt fält "Mått från butiken" med alla måttabeller i Shopify (metaobjekt size_chart, även för arkiverade produkter och utkast, t.ex. Mercer Jacket). Väljer man en fylls måttlistan i med tabellen. Ny serverfunktion api/matt.js.
- Shopify-bilder: gäller nu alla styles som saknar bild, inte bara NOOS/restock, så historiska (arkiverade) produkter som Tennis Jacket får sin bild. För nyheter krävs att produktnamnet stämmer exakt.
- En färg som heter något annat i butiken (Lot 1: Indigo här, Dark Blue Rinse där) paras ihop när exakt en färg och exakt en aktiv produkt i samma style_group återstår. Styles som bara fick en del av färgerna provas om. Första färgen på stylen blir huvudbild.

## v10.16 (2026-11-23)

Kommentarer är en egen sektion i alla ark, inte en rad i historiken. Inga befintliga fält ändras.
- Sektionen "Kommentarer" finns nu på sample, style, PO, lagerparti, drop, händelse (Lanseringar), tyg, referensplagg, leverantör och i Conors design-ark. Den ligger ovanför historiken, med fältet överst och kommentarerna under.
- Taggning fungerar likadant överallt: skriv @ och förnamn (t.ex. @Carl) så föreslås teamet, och personen får kommentaren som mejl direkt.
- Kommentarer sparas som förut i logg, nu märkta kom: true, och står därför också kvar i historiken. Äldre anteckningar utan märkning syns bara i historiken.
- api/omnamn.js tar emot kommentarer från de nya ställena (refplagg, handelser, drops, tyger, leverantorer), och 10-mejlet fångar taggar på händelser, drops och leverantörer om direktmejlet inte gick.

## v10.15 (2026-11-23)

Miniatyrerna visar en bild per färg, och @-mejl som inte går iväg säger varför. Ingen data skrivs om i bulk.
- Style-kortet: har stylen bilder per färg (fargBilder) är miniatyrerna just de andra färgerna. Annars övriga bilder, men inte Shopify-originalet när det redan finns som kopia (samma bild visades två gånger).
- Automatiska Shopify-bilder: NOOS/restock med flera färger vars enda bild är automatisk (Shopify-kopia eller färgöversikt) får nu en bild per färg, t.ex. Lot 2 → huvudbild + två miniatyrer. Egna uppladdade bilder rörs inte.
- @-taggning: api/omnamn.js svarar med orsaken när inget mejl skickas (ingen PLM-användare för namnet, mejlfel, testläge med NOTISER_TEST_TILL) och appen visar den i meddelandet efter kommentaren.
- Vem är vem (api/_lib/notiser.js): ger namnet ingen träff används förnamnet i e-postadressen; "Kalle" räknas som Carl.

## v10.14 (2026-11-23)

Flera bilder på style-korten och Shopify-bilder per färg. Ingen data skrivs om i bulk.
- Style-kortet (Kollektion, Bibliotek m.fl.): huvudbilden fyller kortet och övriga bilder ligger som små överlappande miniatyrer i nedre högra hörnet (högst tre, sedan "+N"). Ersätter räknaren "N bilder".
- Automatiska Shopify-bilder för NOOS/restock letar nu en produkt per färg på stylen (t.ex. Lot 2 → Lot Nr 2 Denim Indigo/Black/Ecru). Alla hämtas in som stylens bilder, första färgen blir huvudbild (bildAuto, så en manuellt vald bild eller ett sample-foto går före) och kopplingen färg → bild sparas i fargBilder. Flertydiga träffar hoppas över per färg.
- Styles som provades med den gamla sökningen provas om (nytt minne i webbläsaren).

## v10.13 (2026-11-23)

Rollrutorna behåller det som sparas, och filterraden har en höjd. Ingen data ändras.
- Fel rättat i web/platform.js: lyssnare på ett enskilt dokument (behorighet/roller) fick aldrig tillbaka det sparade. Rollmatrisen (t.ex. Extern designer) ritades därför om med de gamla värdena direkt efter "Spara roller", och ändrade rättigheter slog inte igenom förrän sidan laddades om.
- Filterraden: rullistor, sökfält och knappgrupper har samma höjd.

## v10.12 (2026-11-23)

ETA-regel, automatiska Shopify-bilder för NOOS/restock och layoutfixar. Ingen data skrivs om i bulk.
- Regel: ETA lager = ex-factory (bekräftad, annars önskad) + 5 dagar, överallt (PO-kort, tidslinjer, betalningsplan, CSV). ETA-fältet i PO:n är uträknat och går inte att skriva in. Ett äldre sparat ETA-datum används bara när PO:n saknar ex-factory. Leverantörens fraktdagar används inte längre för ETA.
- Regel (bara hostad): NOOS- och restock-styles utan bild får produktbilden från Shopify automatiskt när appen laddas. api/bild.js söker på stylens namn och svarar bara vid säker träff (samma produktnamn före " in <färg>"); annars lämnas stylen orörd. Varje style provas högst en gång i veckan per webbläsare. Kräver SHOPIFY_STORE/SHOPIFY_CLIENT_ID/SHOPIFY_CLIENT_SECRET (samma som api/shopify.js).
- En PO utan leverantör får den ur prefixet i PO-numret (EMI-… = Eminento) när den visas, och sparas så nästa gång PO:n sparas.
- Style-korten: statusetiketten radbryts i stället för att krocka med Nyhet/Restock/NOOS-taggen.
- Sökfältet i sidhuvudet är vänsterställt i linje med första knappen.
- Ingressen överst i Produktion är borta.

## Shopify-bilder via servern (2026-11-23)

"Hämta Shopify-bilder" fungerar även när webbläsaren inte får läsa bilden. Artefakten oförändrad (v10.11), ingen data ändras.
- Ny serverfunktion api/bild.js: hämtar bilden åt den inloggade. Bara Rubatos Shopify-adresser (cdn.shopify.com, atemporubato.com, *.myshopify.com). Är adressen en produktsida används sidans huvudbild.
- tools/hosted/bild.js + tools/build.mjs: appen provar först direkt, annars via /api/bild. Felmeddelandet säger nu vad som gick fel per style i stället för att skylla på säkerhetsregler (det gällde bara i Claude-artefakten).

## v10.11 (2026-11-23)

Färre PO-lägen och renare PO-kort. Ingen data skrivs om: äldre statusar läses om när de visas.
- Lägena Inskickad och I produktion är borta. Kvar: Placeholder, PO bekräftad, Skickad, Inlevererad, Problem, Avbruten. POs som har Inskickad eller I produktion sparat visas och räknas som PO bekräftad (och sparas så nästa gång PO:n sparas).
- Följden: gruppen "Inskickade" och rutan "Inskickat" överst i Produktion är borta, liksom filterknapparna. En PO som tidigare var Inskickad räknas nu som beställd (bundna pengar). Problem ligger under Beställda.
- Stegmarkeringen (de fyllda rutorna) på PO-kortet är borta.
- Förskott som förfallit antas betalda för bekräftade POs (tidigare först vid I produktion); går att bocka ur som förut.
- Notismejlet om "PO submitted" (api/_lib/notiser.js) skickas inte längre eftersom läget inte kan väljas.

## v10.10 (2026-11-23)

Enklare PO-formulär. Ingen data ändras, sparade fält på befintliga POs ligger kvar.
- PO-nr sätts automatiskt: leverantörens prefix, säsong och nästa löpnummer. Följer med när leverantör eller säsong byts, tills någon skriver ett eget.
- Tidplan på en ny PO har bara Orderdatum och Önskad ex-factory (tidigare Planerad ex-factory). Produktionstid räknas ut ur de två och går inte att skriva in. Bekräftad ex-factory, ETA lager och Önskad leverans visas först när PO:n är sparad.
- Valuta är en rullista: SEK, JPY, EUR, GBP, USD. På en ny PO föreslås leverantörens valuta.
- Tygstatus: "Hos fabrik" (engelska: Fabric already at producer) ligger först och är förvalt på en ny PO.
- Produkter på PO:n: en ruta per storlek (skala XS–XXL eller 44–58, annars stylens egna storlekar) och antalet summeras automatiskt. En hel rad kan klistras in ("1 3 12 10 4"). Beskrivning, Tyg/enhet, Fotosample och Kostnad per rad är borta ur formuläret; totalen står kvar under raderna. Tyg och Styckpris är kvar.
- Raden sparar bara storlekar med antal, så EAN delas inte ut till storlekar som inte beställs. PO-filen sorterar storlekskolumnerna i skalans ordning.

## Ikon (2026-11-23)

Rubato-loggan som ikon i stället för den tomma globen. Ingen data ändras, artefakten oförändrad.
- favicon.png/.ico, apple-touch-icon.png (vit bakgrund) och icon-512.png i web/, gjorda ur web/mail/logo.png.
- tools/build.mjs (och web/index.html) länkar ikonerna och sätter og:title/og:image så länkförhandsvisningar visar loggan.

## v10.9 (2026-11-23)

Renare PO-kort, prioritet bort, bilddiagnos-rutan bort. Ingen data ändras.
- PO-kortet i Produktion visar inte längre kommentaren. Kvar är det väsentliga: Nyhet/Restock/NOOS (ur raderna), säsong och drop, ETA lager, ex-factory, tygstatus och total. Kommentaren står kvar i PO:n och syns om man håller muspekaren över kortets rubrik.
- Prioritet är borttagen ur gränssnittet: fältet i PO:n, etiketten på kortet och kolumnen i CSV-exporten. Värdet ligger kvar orört i datan.
- Rutan "Bilddiagnos" (bilder direkt från Shopify) visas inte längre. Knappen "Hämta Shopify-bilder" uppe till höger finns kvar.
- "Restock" visas som "Re-stock" överallt i den engelska versionen.

## v10.8 (2026-11-23)

Drop på en PO går att ändra av alla som får redigera – behövs för att lösa "Försenad" när PO:n hör till en annan drop (t.ex. en restock). Nytt fält dropEgen på PO; inget befintligt fält ändras och PO:er utan eget val fungerar som förut.
- Drop-fältet på PO:n var låst så fort stylarna hade en drop. Nu är det en rullista: "Följer stylarna: <drop>" (som förut), säsongens drops och "Ingen drop".
- Väljer man en annan drop gäller den för PO:n och går före stylarnas drop (dropEgen). Rutan "Flytta även stylarna till <drop>" flyttar stylarna på PO:n också – då ändras droppen överallt (Kollektion, tidsplan, Lanseringar). Rutan är förvald när alla rader är nyheter och urbockad när PO:n har restock-rader.
- "Ingen drop" som eget val betyder att PO:n inte räknas mot någon drop.
- Försenad-raden i Flaggat har knappen "Byt drop", som öppnar PO:n med drop-fältet i fokus.
- Mejlen (10-mejlet, försenad PO, flyttad lansering) följer samma regel.

## v10.7 (2026-11-23)

- Försenad PO i Flaggat-rutan har fått knappen "PO i lager". Den frågar "Är leveransen inne i lagret?" och sätter sedan PO:n som Inlevererad, med rad i historiken. Stylarna på PO:ns rader blir Levererad, på samma sätt som när statusen ändras i PO-arket. Därmed försvinner den automatiska flaggan.
- Texten på raden säger hur flaggan löses: med "PO i lager", eller av sig själv när ETA flyttas.

## v10.6 (2026-11-23)

Tydligare knappar, så att radera inte förväxlas med att ta bort en flagga. Bara texter – inget i data eller beteende ändras.
- Knappen längst ner till vänster i arket hette "Ta bort" och raderar hela posten. Den heter nu vad den gör: "Radera sample", "Radera style", "Radera PO", "Radera drop" osv., och frågan lyder "… för alla? Går inte att ångra." med svaren "Ja, radera" och "Behåll".
- Flaggan löses med "Lös flaggan" i Flaggat-rutan och "Markera flaggan som löst" på själva saken (hette "Löst" och "Markera löst").

## v10.5 (2026-11-23)

Tagga folk i kommentarer, med direktmejl. Ingen dataimport och ingen schemaändring: inga fält tas bort eller skrivs om.
- Kommentarsfältet under Historik finns på sample, style, lager och nu även PO. Skriver man @ föreslås teamet (Elliot, Jakob, Carl, Alex, Oliver, Conor); välj med pilarna och Enter/Tab eller klicka. Alexander/Calle/Karl fungerar också.
- Den som taggas får ett direktmejl via `api/omnamn.js` (samma Microsoft-nycklar som övriga mejl). Servern läser loggraden själv, räknar ut vilka som taggats ur texten, skickar bara om den som skrev kommentaren anropar, och aldrig till den som skrev. Markeringen sparas i dokument (collection "_notiser", id "omn-<coll>-<id>-<tid>") – själva dokumentet skrivs aldrig från servern.
- Går mejlet inte att skicka kommer taggningen med i mejlet kl. 10 (ny regel för loggrader med @namn sedan förra körningen; redan mejlade hoppas över). 10-mejlet läser nu även tyglager.
- Loggraden får fältet till (de taggade) och Historik visar "taggade Jakob, Alex".
- `NOTISER_TEST_TILL` gäller även de här mejlen.

## v10.4 (2026-11-23)

Färger på samples, Redo att beställa som Flaggat, luftigare rullistor. Ingen dataimport; inga fält tas bort eller skrivs om.
- Färg på en sample väljs i en rullista med de 15 vanligaste färgerna i Shopify (räknat på produkttitlar i hela katalogen: Navy, Black, Brown, Cream, White, Natural, Ecru, Khaki, Dark Brown, Indigo, Charcoal, Beige, Tobacco, Pink, Olive). "Annan färg …" ger fritext, så leverantörens egna färgnamn går fortfarande att skriva.
- En sample kan ha flera färger: "+ Lägg till färg" ger en rullista till. Det är en och samma sample (ett ID, en ruta), precis som en PO med flera rader. Färgerna sparas i nya fältet farger; farg finns kvar och innehåller färgerna med komma emellan, så äldre samples, sök, etiketter och export fungerar som förut. Äldre samples läses som en färg och skrivs inte om förrän de sparas.
- Ersätter v10.3:s "en sample per färg" (kommaseparerat) och knappen "Samma i fler färger".
- Färgkort på samples: listan och de grupperade raderna visar färgprickar i plaggets färg (samma som på PO-korten). I grupperade rader betyder streckad ram att samplen inte är mottagen än och röd ram problem.
- Färg på PO-rader föreslår samma 15 färger (fritext som förut).
- "Redo att beställa" ligger nu som en ruta i samma form som Flaggat överst i Produktion och räknas in i flaggsiffran på fliken. Den ligger kvar tills PO:n är inskickad.
- Direktmejl till Elliot när en style blir godkänd (ny endpoint /api/redo). Högst ett mejl per style, inget mejl om Elliot själv godkände, och 10-mejlet upprepar inte samma sak. Markeringen sparas i dokument (collection "_notiser", id "redo-<style>") – stylen skrivs aldrig från servern. Kräver samma Microsoft-nycklar i Vercel som övriga mejl.
- Rullistor har egen pil med luft till kanten och mer marginal till vänster.

## v10.3 (2026-11-23)

Från Alex: samples i flera färger, och godkända styles ska synas i Produktion. Ingen dataimport, inga fält ändras.
- Ny sample i flera färger: skriv färgerna med komma emellan ("Navy, Khaki, Ecru") så skapas en sample per färg med eget ID och i övrigt samma uppgifter.
- "Samma i fler färger" på en befintlig sample: öppnar en ny sample med style, version, leverantör, tyg, storlek, säsong, pris, datum och tracking ifyllda – bara färgen är tom.
- Produktion har en ruta "Redo att beställa" överst: godkända styles som inte har någon lagd PO (placeholder räknas inte som lagd). Per style: säsong/drop, leverantör, "PO senast" ur tidsplanen, "Skapa PO" (leverantör, säsong och en rad per färg ifyllda) och "Öppna <placeholder>" om stylen redan ligger på en preliminär PO. Stylen försvinner ur rutan när PO:n är inskickad.
- När en sample godkänns säger systemet nu att stylen ligger under Produktion som redo att beställa.

## v10.2 (2026-11-23)

Produktion: tydligare skillnad mellan beställt och preliminärt. Bara utseende – status och data är desamma.
- PO:erna delas upp under rubriker med antal och summa: Beställda (PO bekräftad, I produktion, Skickad), Inskickade (Inskickad, Problem), Preliminära (Placeholder), och under "Alla" även Inlevererade och Avbrutna.
- Korten ser olika ut per grupp: svart vänsterkant (beställd), grå vänsterkant (inskickad), streckad ram och grå text (preliminär).
- Etiketten säger vad läget betyder ("Inskickad · väntar på bekräftelse") och varje PO har en stegmätare Placeholder → Inskickad → Bekräftad → I produktion → Skickad → Inlevererad.
- Rutorna överst visar summorna för de tre grupperna i stället för Öppna POs / Väntar på bekräftelse / Försenade / Lagt. Försenade ligger i Flaggat-rutan sedan v10.

## v10.1 (2026-11-23)

- Området Produkt har undertexten "From idea to drop".
- "RYC" finns som förslag på drop-namn (Kollektion och matrisen i Lanseringar). Själva droppen läggs upp i appen: säsong SS27, namn RYC.
- En flagga kan lösas direkt på saken den gäller ("Markera löst" i den röda raden överst i arket), inte bara i rutan överst i fliken.

## v10 (2026-11-23)

Ny navigering, nytt idéflöde med Design-flik, flaggor och hela systemet på engelska. Ingen dataimport och ingen schemaändring: inga fält tas bort eller skrivs om.
- Tre områden: Produkt (PLM-flödet, numrerat: Idéer → Design → Samples → Kollektion → Produktion → Foto → E-com), Planering (Lanseringar, Leverantörer) och Register (Lager, Ref-plagg, Shopify, Användare). Bibliotek heter Idéer och COO heter Lanseringar; länkarna (#coo, #bibliotek …) är oförändrade.
- Idéflödet: status "Idé ej redo för design" → "Idé redo att designa" (Conor) → "Sample kan beställas" (Alex) → Sampling. Carl väljer på idén: "Skicka till design" eller "Direkt till sampling". Äldre status läses som de nya ("Produktidé" = ej redo, "Idé under utveckling" = sample kan beställas) och skrivs om först när stylen sparas nästa gång.
- Design-flik för Conor: lista "Att designa" och "Designade", och ett nedskalat ark med brief från Carl (beskrivning, kategori, säsong, tyg, storlekar, mått, referenser, bilder), uppladdning av design, länk och kommentar, samt "Design klar – skicka till sampling". Designen sparas på stylen (fältet design) och visas för Carl och Alex.
- Ny roll "Extern designer" (formgivare): ser bara Design-fliken; sök, övriga flikar och ark är dolda i appen. OBS: det är en spärr i gränssnittet, inte i databasen (Elliots val 23 nov).
- Flaggor (collection "flaggor"): knappen "⚑ Flagga" på sample, style, PO, drop och händelse. Kommentar krävs, den som flaggar väljer mottagare (flikens ägare förvald). Flaggan ligger i en ruta överst i fliken tills någon markerar den som löst. "Flagga problem" på en sample använder samma dialog och sätter status Problem.
- Direktmejl för flaggor: `api/flagga.js` skickar via Microsoft Graph direkt när flaggan skapas (samma miljövariabler som notismejlet). Går det inte att skicka kommer flaggan med i mejlet kl. 10.
- Försenad leverans: en PO vars ETA lager ligger efter droppens "I lager senast" får etiketten "Problem · försenad", syns i Flaggat-rutan i Produktion och ger notis till alla i mejlet kl. 10. Räknas fram, sparas inte, och försvinner när ETA ändras eller PO:n är inlevererad.
- Notismejlet: nya rader för idé till Conor, sample kan beställas (Alex), design klar (Carl), flaggor och lösta flaggor. Conor får notiser men räknas inte in i "alla". Mejlen är på engelska.
- Engelska: källan (artifact/vN.html, tools/hosted) är fortfarande på svenska. `tools/i18n.mjs` byter text till engelska enligt `tools/en.json` som sista steg i `tools/build.mjs` (hoppa över med --sv; bygget stoppas om en text saknar översättning). Värden som sparas i databasen (status, kategori, plats …) byts aldrig, de visas bara på engelska. Sandlådan byggs med `node tools/i18n.mjs artifact artifact/vN.html ut.html`.
- Roller sparas med flikVersion 3 så att Design-fliken läggs till för roller som sparats tidigare.

## v9.3 (2026-11-19)

Drop och säsong sätts på ett ställe och gäller överallt. Ingen dataimport och ingen schemaändring: inga fält tas bort eller skrivs om, allt nedan räknas fram vid visning.
- Drop-register: dokumenten i "drops" plus Jakobs drop-rader i COO (händelser med matris "drop", samma säsong + drop). En COO-rad utan drop-dokument syns ändå som drop överallt; dokumentet skapas först när någon som får redigera öppnar droppen.
- Lanseringen ägs av COO-raden. I Kollektion visas datumet låst med länken "Ändra där". Finns ingen COO-rad gäller droppens eget lanseringsdatum som förut.
- "I lager senast" = lansering minus 5 dagar (installningar app.lagerMarginal, standard 5) om droppen inte har ett eget datum. Befintliga egna datum ligger kvar och gäller före; drop-rutan säger till om ett eget datum ligger efter lanseringen.
- Säsong och drop väljs i rullistor ur registret på style, PO, sample och COO-händelse. Drop är frivilligt (bara säsong går bra). Ett värde som inte finns i registret visas kvar som eget alternativ tills någon väljer om.
- PO:ns drop följer stylarna på raderna (samma säsong som PO:n), flera drops visas som "Drop 1 + Drop 2". Har ingen style en drop gäller PO:ns eget fält, som ligger kvar orört i datan.
- Flyttas lanseringen i COO visas direkt vad det gör med leveranserna (nytt "i lager senast", vilka PO som inte hinner), och notis 14 i mejlet kl. 10 säger samma sak. Hinner någon PO inte går den även till Elliot och Alex.
- Bibliotek (Carls flik): stylen visar bara produkt, grundstyle, tyg, säsong/drop, mått, referenser, kommentar, bilder och samples. Planering/Tidsplan, Foto och e-com, Varianter och EAN, Shopify, Produktion och Inköp visas när stylen öppnas från övriga flikar, eller via "Visa hela stylen".
- Matrisen i COO: PO-panelen matchar på härledd drop, drop-raden visar "i lager senast", och "Ny drop" väljer säsong ur lista.
- `api/notiser.js` läser även händelser; ögonblicksbilden av drops nycklas på säsong + namn.

## v9.2 (2026-11-19)

Dagligt mejl kl. 10 med notiser (spec: claude/notiser-spec-v9.2.md i projektet RUBATO PLM) samt två buggfixar i appen (bilder, grundstyle). Ingen dataimport, ingen schemaändring.
- `api/notiser.js` körs av Vercel cron (08:00 och 09:00 UTC – skickar första körningen efter 10:00 svensk tid, en gång per dag). Mejl bara till den som har minst en notis, med "Att göra" och "Att känna till" och länkar rakt in i PLM.
- Reglerna ligger i `api/_lib/notiser.js` (A–D och 1–25 utom 21, som kräver ett fält för fotosample-storlek på PO). Ingen får notis om sin egen ändring (sista loggraden).
- Tillståndet (förra körningens ögonblicksbild och skickade påminnelser) sparas i dokument, collection "_notiser", id "state". Första körningen sparar bara en baslinje.
- Logga och typsnitt för mejlet ligger i web/mail/.
- Miljövariabler: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MAIL_FROM (Microsoft Graph, Mail.Send), CRON_SECRET. Valfri NOTISER_TEST_TILL skickar alla mejl till en adress med ämnet "[TEST → namn]". Saknas Microsoft-nycklarna skickas inget och tillståndet står still.
- Bilder: drag and drop fungerar var som helst i bildsektionen/rutan (en fil som släpps bredvid öppnas inte längre av webbläsaren), och även på tomma bildrutor i Bibliotek. HEIC/HEIF från iPhone läses (heic-to 1.6.7 laddas vid behov) och görs om till JPG; alla bildformat webbläsaren kan läsa tas emot, skalas till högst 1600 px på längsta sidan utan beskärning, och genomskinliga skärmdumpar får vit bakgrund. Filer som inte är bilder ger ett tydligt meddelande.
- Grundstyle: fältet "Grundstyle" på en style listar alla styles (samma urval som "Använd mått från"). Den style som väljs blir grundstyle – bocken "Detta är en grundstyle" och knappen "+ Ny grundstyle" är borttagna. Befintliga grundstyles (fältet grund) och kopplingar (grundId) ligger kvar orörda; ingen datamigrering.

## v9.1 (2026-11-12)

Endast kodändring, ingen dataimport.
- Färgkort i Produktion justerade enligt Elliot: Shale mörkgrå, Brown mörkbrun (Dark Brown ännu mörkare), Birch driftwood (brunare beige), Earth kaffefärgad.

## v9 (2026-11-12)

Elliots artefakt per 12 november 2026 (v8 + färg i färgchips). Endast kodändring, ingen dataimport och ingen schemaändring.
- Produktion: pricken i varje färgchip på PO-korten visar färgen i namnet (Navy mörkblå, Indigo/Denim blå, Light Blue Chambray ljusblå, Ecru/Cream benvit, Khaki/Olive oliv, Brown/Clay/Camel brun, Beige/Birch/Marble sand, Black svart, Signal Red/Persimmon röd m.fl., även svenska och italienska namn). Okända färger behåller den grå pricken.

## v8 (2026-11-12)

Elliots artefakt per 12 november 2026 (v6 + Lager-ändringen). Endast kodändring, ingen dataimport och ingen schemaändring: partierna ligger kvar i collection "tyglager".
- Fliken Tyglager heter Lager och rymmer både tyg och trims (knappar, dragkedjor, etiketter …). Nytt filter Tyg / Trims / Tyg + trims.
- Tyg räknas i meter som förut, trims i antal (st). Nya fält på trimspartier: typ ("trims"), storlek, inkoptAntal, antal, prisPerSt. Artikelnamnet ligger i tygNamn (tygId tomt). Partier utan typ räknas som tyg.
- "+ Nytt parti" börjar med Typ (Tyg/Trims); trims är förvalt när filtret står på Trims. "Justera antal", "Förbrukat" och historiken räknar i rätt enhet.
- Strippen visar meter tyg och antal trims separat; "Saknar mängd" räknar båda.
- CSV-exporten heter Rubato_Lager med kolumnerna Typ, Storlek och Enhet.

## v7 (2026-11-10)

Matrisvy i COO-fliken enligt scope 10 nov 2026. Hostad modul (tools/hosted/coo-matris.js) ovanpå Elliots artefakt v6. Ingen datamigrering: matrisen läser fälten hor_till, fas, offset_dagar, ansvarig, bana och matris på händelserna och mallarna i installningar "planeringsmallar".

- COO har två lägen: Matris (standard) och Lista (Elliots vy, oförändrad).
- Fem matriser: Drops, PR-träffar, In Residence, Mässor och Lokaler. Rader är föräldrar (matris satt, hor_till tom), sorterade på datum. Kolumner är mallens faser i mallens ordning, med namn och ledtid ("4 v före"). Föräldern själv ligger i sin kolumn (Lansering respektive Event), markerad.
- Cell: datum, statusprick (Planerad grå, Pågår gul, Klar grön, Försenad röd; försenad räknas vid visning), ansvarig. Tom cell har "+" som skapar fasen från mallen. Klick öppnar samma redigeringspanel som listan.
- Röd kant när två eller fler händelser i matriserna ligger samma dag. Rader vars titel börjar med "TBD " visas dämpade.
- Rullgardin per rad: för drops alla PO:er med samma säsong och drop (PO-nr, leverantör, status, önskad leverans, planerad ex, ETA lager, fotosample) och produkterna per PO med antal. Klick på PO-nr öppnar PO:n i Produktion. Därunder kommentar och historik. Utfällda rader sparas i webbläsaren per användare.
- Flytta lansering: ändras datumet på en förälder frågar appen "Flytta alla faser med?". Ja ger varje fas datum = nytt datum + fasens offset_dagar och loggraden "Flyttad med lanseringen från X till Y". Slutdatum följer med när startdatum ändras.
- "Ny drop" och "Nytt event" skapar föräldern och en händelse per rad i mallen (titel "TBD " + fasnamn + etikett), med nästa lediga H-nummer.
- Filter: säsong, ansvarig (övriga celler tonas ner) och Visa TBD. "Min vecka" visar ansvarigs (eller din egen) öppna händelser de kommande 7 dagarna.
- Redigeringspanelen har fått fältet "Ansvarig för fasen".
- Mobil: matriserna scrollar sidledes i egen ruta, sidan blir inte bredare.
- Plattform: namnuppslag i historiken hoppar över loggrader som inte har ett användar-id (t.ex. av "claude"), vilket gav 400-fel i konsolen.

Acceptans testad mot riktig data (teständringarna återställda efteråt): 43 av 44 händelser i rätt matris och cell (H005 Tillträde Söder Mälarstrand 21 har ingen matris i datan och visas därför bara i listan), H002 visar 6 PO:er, flytt av H002 till 4 mar flyttade H037, H015, H016, H038, H017 och H018 med samma avstånd och loggrad, Ny drop 2027-05-20 skapade 8 händelser med rätt datum, krocken 25 feb (H002 och H019) markeras.

## v6.1 (2026-11-09)

Rättning i den hostade appen, ingen ny artefaktversion och ingen dataimport.
- Färgchipsen i Samples (och Produktion) visades trasiga hostat: texten låg ovanpå varandra i små runda prickar. Orsaken var att den hostade Shopify-CSS:en hade en egen regel för klassen .swatch som skrev över Elliots färgchips från v5. Den hostade klassen heter nu .sh-swatch, och chipsen ser ut som i artefakten.

## v6 (2026-11-05)

Elliots artefakt per 5 november 2026, sen eftermiddag. Endast stiländring, ingen dataimport.
- Produktion: PO-korten har fasta kolumnbredder så att rubriker och kolumner ligger i linje kort för kort; färgchips får plats på bredden.

## v5 (2026-11-05)

Elliots artefakt per 5 november 2026, eftermiddag. Endast kodändring, ingen dataimport.
- Samples: status "Problem" i listan är klickbar och visar vad problemet är (kommentar, ändringar, leverantör, datum) utan att öppna hela samplen, med knapparna "Öppna sample" och "Problemet löst → Beställd". Färgchips med problem markeras röda.
- Produktion: PO-radernas färger visas som chips med antal i stället för text.

## v4 (2026-11-05)

Elliots artefakt per 5 november 2026. Stor uppdatering, endast kodändring, ingen dataimport.

Nytt i appen (från artefakten):
- Bibliotek: alla styles och produktidéer på ett ställe, även innan en sample är beställd. Idé med beskrivning, tyg, mått och bilder som skickas till Alex. Grundstyle (t.ex. Roper Shirt) återanvänds i flera kollektioner.
- COO: vad som lanseras när, månad för månad, per drop med produkter och läge (levererat, foto, i Shopify). Mässor och andra händelser (ny samling "handelser") i samma flöde, tidslinje och lista.
- Användare: roller (Admin, Team, Designer, Junior, Extern partner, Producent, Ingen åtkomst) som styr vilka flikar man ser och om man får redigera. Rollerna kan ändras per flik. Nya personer dyker upp i listan efter sitt första besök.
- Style: varianter (färg x storlek), egna bilder på stylen, bilder från Shopify för aktiva produkter.
- E-com: pris hämtas från Shopify (samling "shopifypriser") och prismarginaler per aktiv produkt med valutarisk, bara för roller som ser kostnader.
- EAN-fliken är dold; EAN hanteras från stylen och COO.

Hostat:
- Inloggning med Microsoft som tidigare. Admin (kan hantera användare) styrs av rollen i databastabellen anvandare: Jakob och Elliot är admin. Alla andra Rubato-konton får rollen Team tills Elliot ändrar den under Användare.
- Rollen Producent (leverantörsinloggning som bara ser sina PO) går inte att använda ännu, eftersom bara @atemporubato.com-konton kan logga in.
- Shopify-fliken ligger kvar efter E-com och ingår i rollsystemet (visas för Admin och Team).
- Bygget: boot-blocket tas nu från artefakten och bara plattformsraderna byts, så kommande versioner kräver färre anpassningar.

## v3 (2026-10-22)

Elliots artefakt per 22 oktober 2026. Endast kodändring, ingen dataimport.
- E-com: bruttomarginal (GM1) visas under priset, räknad på pris exkl. moms mot vägd styckkostnad (styckpris + tygkostnad) från PO-raderna. Grönt vid 75 % eller mer, gult 70 till 75 %, rött under 70 %. Saknas kostnad på PO visas "GM1: kostnad saknas på PO".
- E-com: leveransdatum tas i första hand från PO:ns önskade leveransdatum, annars leverantörens ETA, med källan utskriven ("enligt PO" eller "ETA lager"). Utkast-PO räknas inte.
- E-com: kolumnen E-com-foto visar fotodatum med dagar kvar; lägestile heter "Levereras inom 30 d (PO)".
- Prisfältet markerar att priset anges inkl. moms.

## v2 (2026-10-21)

Elliots artefakt per 21 oktober 2026, eftermiddag. Endast kodändring, ingen dataimport.
- E-com: checklistpunkten "Collection/SEO" heter nu "Taggar/Collections" (fältet ecomSeo oförändrat, inga data påverkas).

## v1 (2026-10-21)

Elliots artefakt per 21 oktober 2026, hostad. Ersätter version 0 (den första porten från 14 oktober).

Nytt i appen (från artefakten):
- Flikar med ansvarig: Samples (Alex), Ref-plagg (Alex), Kollektion (Carl), Produktion (Elliot), Foto (Oliver), E-com (Jakob), Tyglager (Alex), Leverantörer och EAN (Jakob/Elliot).
- Kollektion: drops per säsong med lansering och "i lager senast", budgetram per kategori (SS27: 4,2 MSEK), styles med kategori.
- Produktion: PO med rader (produkt, färg, antal, styckpris, tygkostnad), betalningsplan, PO-fil enligt Rubatos mall med bilagor, koppling PO till style.
- Samples: fysiskt märkt, mått godkända, bilder på samples, fler lägesbildstiles (omärkta, ej mätta).
- Foto: fotosample-status och e-com-bilder per style.
- E-com: lanseringschecklista per style (i Shopify, beskrivning, pris, storleksguide, newsletter).
- Ref-plagg: referensplagg som skickas till leverantörer, med tracking och retur.
- Bilder och bilagor på samples, styles och PO.

Nytt i hostingen:
- Generisk dokumentlagring i Supabase (tabellen dokument), så att nya artefaktversioner kan hostas utan schemaändringar.
- Bygg- och importscript (tools/build.mjs, tools/import-dokument.js) som gör om en artefaktversion till den hostade appen.
- Bilder och bilagor i Supabase Storage (bucket bilder).
- Hosted-only: Shopify-sektion på stylen (produktdata, färger, förhandsgranskning, push som utkast) och Shopify-fliken med urval och batch-push. Pushen sätter e-com-checken "I Shopify" på stylen.

Data:
- All data importerad från artefakten 21 okt 2026: 79 styles, 64 samples, 41 PO, 5 drops, 1 budget, 34 tyger, 2 tygpartier, 8 leverantörer.
- EAN-poolen är hostad (prefix 7340241, nästa löpnummer 92501, 1 493 Shopify-nummer spärrade).
- Känt: de sju PO-PDF:erna som bifogats i artefakten (EMI-SS27-2 till -6 med flera) kunde inte hämtas ut ur Claudes fillagring och behöver laddas upp igen i den hostade appen.

## v0 (2026-10-14)

Första porten av Samples-artefakten till Supabase och Vercel, med Microsoft-inloggning, produktionsflik från Rubato_Masterplaner och Shopify-push.
