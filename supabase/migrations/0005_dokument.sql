-- 0005: generisk dokumentlagring (v1 av det hostade PLM:et)
-- Artefakten jobbar med collections av JSON-dokument. I stället för en tabell per collection med
-- fasta kolumner lagras varje dokument som jsonb, så att nya versioner av artefakten kan hostas utan
-- schemaändringar. Hosted-only data (Shopify-fält, färgrader) ligger i egna tabeller vid sidan av.

create table if not exists public.dokument (
  collection text not null,
  id text not null,
  data jsonb not null default '{}',
  skapad timestamptz not null default now(),
  andrad timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists dokument_collection on public.dokument (collection);
alter table public.dokument enable row level security;
create policy dokument_las on public.dokument for select to authenticated using (public.ar_rubato());
create policy dokument_skriv on public.dokument for all to authenticated using (public.ar_rubato()) with check (public.ar_rubato());
alter publication supabase_realtime add table public.dokument;
create trigger dokument_andrad before update on public.dokument for each row execute function public.satt_andrad();

-- Delvis uppdatering: slår ihop patchen med befintlig data (som artefaktens doc.update)
create or replace function public.dok_update(p_collection text, p_id text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.ar_rubato() then raise exception 'Ingen behörighet'; end if;
  update public.dokument set data = data || p_patch where collection = p_collection and id = p_id returning data into r;
  if r is null then raise exception 'Dokumentet % / % finns inte', p_collection, p_id; end if;
  return r;
end $$;

-- Hosted-only: Shopify-produktdata per style (artefakten känner inte till de här fälten)
create table if not exists public.shopify_styles (
  style_id text primary key,
  stylekod text,
  produkttyp text,
  storlekssystem text,
  rrp_sek numeric,
  hs_kod text,
  vikt_gram int,
  sammansattning text,
  material_family text,
  tvattrad text,
  "cut" text,
  fit_note text,
  model_note text,
  fabric_mill text,
  fabric_weight text,
  fabric_origin text,
  construction text,
  features text,
  size_chart text,
  description_en text,
  andrad timestamptz not null default now()
);
alter table public.shopify_styles enable row level security;
create policy shopify_styles_las on public.shopify_styles for select to authenticated using (public.ar_rubato());
create policy shopify_styles_skriv on public.shopify_styles for all to authenticated using (public.ar_rubato()) with check (public.ar_rubato());
alter publication supabase_realtime add table public.shopify_styles;
create trigger shopify_styles_andrad before update on public.shopify_styles for each row execute function public.satt_andrad();

-- Färgrader: varianternas Shopify-koppling lagras som jsonb per färg {storlek: {sku, variant_id}}
alter table public.style_farger add column if not exists varianter jsonb;
alter table public.style_farger drop constraint if exists style_farger_style_id_fkey;
alter table public.style_farger drop constraint if exists style_farger_pushad_av_fkey;

-- Leverantörernas MID flyttar in i dokumentet (artefaktens leverantörsformulär visar dem inte, men
-- pushen läser dem därifrån). Migreringsscriptet kopierar värdena.

-- Bilder och bilagor: publik bucket, objektnamn = artefaktens asset-id
insert into storage.buckets (id, name, public) values ('bilder', 'bilder', true) on conflict do nothing;
create policy bilder_las on storage.objects for select using (bucket_id = 'bilder');
create policy bilder_skriv on storage.objects for all to authenticated using (bucket_id = 'bilder' and public.ar_rubato()) with check (bucket_id = 'bilder' and public.ar_rubato());

-- De typade tabellerna från version 0 tas bort; datan importeras om från artefakten
drop table if exists public.matt, public.filer, public.content, public.po_rader, public.po, public.varianter, public.samples, public.tyglager, public.tyger, public.styles, public.leverantorer, public.logg cascade;

-- tilldela_ean utan referens till varianter-tabellen
create or replace function public.tilldela_ean(p_antal int)
returns text[] language plpgsql security definer set search_path = public as $$
declare p record; n int; ut text[] := '{}'; kod text; bas text; i int; summa int;
begin
  if not public.ar_rubato() then raise exception 'Ingen behörighet'; end if;
  select * into p from public.ean_pool where id = 'gs1' for update;
  if p is null then raise exception 'EAN-serien är inte inställd'; end if;
  n := p.nasta;
  while array_length(ut, 1) is null or array_length(ut, 1) < p_antal loop
    if n > p.slut then raise exception 'EAN-serien räcker inte till'; end if;
    bas := p.prefix || lpad(n::text, 12 - length(p.prefix), '0');
    summa := 0;
    for i in 1..12 loop summa := summa + (substr(bas, i, 1)::int) * (case when i % 2 = 0 then 3 else 1 end); end loop;
    kod := bas || ((10 - (summa % 10)) % 10)::text;
    if not exists (select 1 from public.ean_anvanda where ean = kod) then
      ut := ut || kod;
      insert into public.ean_anvanda (ean, kalla) values (kod, 'app');
    end if;
    n := n + 1;
  end loop;
  update public.ean_pool set nasta = n, andrad = now() where id = 'gs1';
  return ut;
end $$;
