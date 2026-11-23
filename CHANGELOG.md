# Changelog

Arbetssätt: Elliot utvecklar i artefakten (sandbox). Jakob hostar: artefaktens HTML sparas som
artifact/vN.html, byggs med `node tools/build.mjs artifact/vN.html`, datan exporteras ur artefakten
och importeras med `node tools/import-dokument.js`, och main går live på plm.atemporubato.com.

Versionsnumrering: små ändringar ger punktversion (v9.1, v9.2 …). Nytt heltal (v10) bara vid stora ändringar.

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
