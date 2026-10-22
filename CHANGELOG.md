# Changelog

Arbetssätt: Elliot utvecklar i artefakten (sandbox). Jakob hostar: artefaktens HTML sparas som
artifact/vN.html, byggs med `node tools/build.mjs artifact/vN.html`, datan exporteras ur artefakten
och importeras med `node tools/import-dokument.js`, och main går live på plm.atemporubato.com.

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
