// Läser Shopify-exporten (Developer/files/ean-export) in i ean_pool och ean_anvanda.
import { readFile } from 'node:fs/promises';
import { client } from './db.mjs';
const rows = JSON.parse(await readFile(process.env.HOME + '/mnt/files/ean-export/shopify_varianter_ean.json', 'utf8'));
const c = client(); await c.connect();
await c.query(`insert into ean_pool (id, prefix, nasta, slut, kommentar) values ('gs1','7340241',91529,99999,'Importerad från Shopify 2026-10-14. Löpnummer 90001 till 91528 i bruk, 35 luckor återanvänds inte.') on conflict (id) do update set prefix=excluded.prefix, nasta=excluded.nasta, slut=excluded.slut, kommentar=excluded.kommentar`);
let n = 0;
for (const r of rows) {
  if (!/^\d{13}$/.test(r.barcode)) continue;
  await c.query(`insert into ean_anvanda (ean, kalla, produkt, variant, sku, shopify_variant_id) values ($1,'shopify',$2,$3,$4,$5) on conflict (ean) do update set produkt=excluded.produkt, variant=excluded.variant, sku=excluded.sku, shopify_variant_id=excluded.shopify_variant_id`, [r.barcode, r.product, r.variant, r.sku, r.variantId]);
  n++;
}
const { rows: [p] } = await c.query('select count(*)::int as n, max(ean) as max from ean_anvanda');
console.log('ean_anvanda:', p.n, 'max', p.max);
await c.end();
