alter table public.ean_pool add column if not exists shopify_hogsta text;
update public.ean_pool set shopify_hogsta = (select max(ean) from public.ean_anvanda where kalla = 'shopify') where id = 'gs1';
