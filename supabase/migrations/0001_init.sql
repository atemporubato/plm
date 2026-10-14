-- Rubato PLM, schema 0001
-- Tabellerna speglar Elliots datamodell i Samples-appen (samma fält, snake_case),
-- plus det som behövs för produktion, filer, content och måttlistor.

create extension if not exists pgcrypto;

-- ---------- behörighet ----------
-- Alla med ett atemporubato.com-konto (Google-inloggning) får läsa och skriva.
create or replace function public.ar_rubato()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (auth.jwt() ->> 'email') ilike '%@atemporubato.com'
    or (auth.jwt() -> 'app_metadata' ->> 'rubato') = 'true',
    false);
$$;

create table public.anvandare (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  namn text,
  roll text not null default 'team' check (roll in ('admin','team','las')),
  skapad timestamptz not null default now()
);

create or replace function public.ny_anvandare()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.anvandare (id, email, namn)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.ny_anvandare();

-- ---------- gemensamt ----------
create or replace function public.satt_andrad()
returns trigger language plpgsql as $$
begin new.andrad = now(); return new; end $$;

create table public.installningar (
  nyckel text primary key,
  varde jsonb not null,
  andrad timestamptz not null default now()
);
insert into public.installningar (nyckel, varde) values
  ('app', '{"utvarderingDagar": 7, "standardFrakt": 7, "marginalGul": 14}');

-- Händelselogg för alla poster (ersätter logg-arrayen på varje dokument)
create table public.logg (
  id bigint generated always as identity primary key,
  tabell text not null,
  post_id text not null,
  t timestamptz not null default now(),
  av uuid references public.anvandare(id),
  text text not null
);
create index logg_post on public.logg (tabell, post_id, t desc);

-- ---------- leverantörer ----------
create table public.leverantorer (
  id text primary key,                 -- slug av namnet, som i appen
  namn text not null unique,
  kod text,                            -- t.ex. JPB, EMI, WIL
  sample_ledtid int,                   -- dagar, beställning till mottagen sample
  produktionstid int,                  -- dagar, PO till klart hos leverantör
  frakt int,                           -- dagar, tomt = standard
  buffert int not null default 0,
  valuta text check (valuta in ('SEK','EUR','JPY','GBP','USD') or valuta is null),
  kontakt text,
  kommentar text,
  skapad timestamptz not null default now(),
  andrad timestamptz not null default now()
);

-- ---------- tyger och eget tyglager ----------
create table public.tyger (
  id text primary key,                 -- T-001
  namn text not null unique,
  leverantor text,                     -- väveri eller leverantör, fri text som i appen
  status text check (status in ('OK','Delvis slut','Slut','Utgått') or status is null),
  ater_datum date,
  sammansattning text,                 -- nytt: t.ex. 100% cotton
  artikelnr text,                      -- nytt: väveriets artikelnummer
  vikt_gsm int,                        -- nytt
  kommentar text,
  skapad timestamptz not null default now(),
  andrad timestamptz not null default now()
);

create table public.tyglager (
  id text primary key,                 -- TL-001
  tyg_id text references public.tyger(id),
  tyg_namn text,                       -- fallback när tyg_id saknas
  farg text,
  plats text,
  status text not null default 'I lager' check (status in ('I lager','Beställd','Förbrukad')),
  inkopt_meter numeric,
  meter numeric,                       -- kvar
  raknad date,
  bredd_cm int,
  pris_per_meter numeric,
  pris_valuta text,
  inkopt date,
  reserverad_for text,                 -- style-id, fk sätts nedan
  kommentar text,
  skapad timestamptz not null default now(),
  andrad timestamptz not null default now()
);

-- ---------- styles ----------
create table public.styles (
  id text primary key,                 -- ST-001
  namn text not null,
  leverantor text,
  sasong text,                         -- SS27
  "drop" text,                         -- Drop 1
  typ text not null default 'Nyhet' check (typ in ('Nyhet','Restock','NOOS')),
  status text not null default 'Sampling' check (status in ('Sampling','Godkänd','PO lagd','Levererad','Skippad')),
  klart_senast date,                   -- i lager senast
  foto_senast date,
  farger text[] not null default '{}',
  storlekar text[] not null default '{}',
  kommentar text,
  -- nytt: produktdata som följer med till Shopify
  kategori text,
  sammansattning text,
  ursprungsland text,
  hs_kod text,
  tvattrad text,
  vikt_gram int,
  rrp_sek numeric,
  description_sv text,
  description_en text,
  shopify_product_id bigint,
  skapad timestamptz not null default now(),
  andrad timestamptz not null default now()
);
alter table public.tyglager add constraint tyglager_reserverad_fk foreign key (reserverad_for) references public.styles(id) on delete set null;

-- Varianter: en rad per färg och storlek. Ersätter ean-arrayen på stylen.
create table public.varianter (
  id bigint generated always as identity primary key,
  style_id text not null references public.styles(id) on delete cascade,
  farg text not null,
  storlek text not null,
  ean text unique check (ean ~ '^\d{13}$'),
  sku text,
  shopify_variant_id bigint,
  tilldelad timestamptz,
  av uuid references public.anvandare(id),
  unique (style_id, farg, storlek)
);

-- ---------- samples ----------
create table public.samples (
  id text primary key,                 -- S001
  style_id text references public.styles(id) on delete set null,
  produkt text,                        -- namn när style saknas
  version text,                        -- Proto 1 ... Fotosample, Produktionssample, Storleksset
  leverantor text,
  farg text,
  tyg_id text references public.tyger(id) on delete set null,
  material text,
  storlek text,
  pris_belopp numeric,
  pris_valuta text,
  status text not null default 'Beställd' check (status in ('Beställd','Skickad','Mottagen','Problem','Returnerad')),
  bestalld date,
  ledtid int,
  forvantad date,
  mottagen date,
  tracking text,
  p1_skickad date,
  p2_skickad date,
  plats_typ text,
  hangare text,
  plats_notering text,
  beslut text check (beslut in ('Godkänd','Ny runda','Underkänd') or beslut is null or beslut = ''),
  utvarderad boolean not null default false,
  andringar text,
  kommentar text,
  etikett date,                        -- senast utskriven etikett
  skapad timestamptz not null default now(),
  andrad timestamptz not null default now()
);
create index samples_style on public.samples (style_id);

-- ---------- måttlistor (nytt) ----------
create table public.matt (
  id bigint generated always as identity primary key,
  sample_id text not null references public.samples(id) on delete cascade,
  storlek text,
  punkt text not null,                 -- t.ex. Bröstvidd, Ärmlängd
  spec numeric,
  uppmatt numeric,
  tolerans numeric,
  kommentar text
);

-- ---------- EAN ----------
create table public.ean_pool (
  id text primary key default 'gs1',
  prefix text not null,
  nasta int not null,
  slut int not null,
  kommentar text,
  andrad timestamptz not null default now()
);
create table public.ean_anvanda (
  ean text primary key check (ean ~ '^\d{13}$'),
  kalla text not null default 'shopify',  -- shopify, app, manuell
  produkt text,
  variant text,
  sku text,
  shopify_variant_id bigint,
  registrerad timestamptz not null default now()
);

-- Tilldelning med radlås, hoppar över allt som redan finns i Shopify.
create or replace function public.tilldela_ean(p_antal int)
returns text[] language plpgsql security definer set search_path = public as $$
declare p record; n int; ut text[] := '{}'; kod text; bas text; s int := 0; i int; summa int;
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
    if not exists (select 1 from public.ean_anvanda where ean = kod) and not exists (select 1 from public.varianter where ean = kod) then
      ut := ut || kod;
      insert into public.ean_anvanda (ean, kalla) values (kod, 'app');
    end if;
    n := n + 1;
  end loop;
  update public.ean_pool set nasta = n, andrad = now() where id = 'gs1';
  return ut;
end $$;

-- ---------- produktion (nytt, från Rubato_Masterplaner) ----------
create table public.po (
  id text primary key,                 -- JPB-SS27-1
  leverantor text not null,
  sasong text,
  "drop" text,
  prioritet text check (prioritet in ('Hög','Medel','Låg') or prioritet is null),
  status text not null default 'Planerad' check (status in ('Planerad','To order','Ordering','PO bekräftad','Tyg beställt','I produktion','Skickad','Inlevererad','Bevaka','Problem','Avbruten')),
  tygstatus text,
  order_bekraftad date,
  planerad_ex_factory date,
  bekraftad_ex_factory date,
  eta_lager date,
  inlevererad date,
  valuta text default 'SEK',
  forskott_belopp numeric,
  forskott_betald date,
  slutbetalning_belopp numeric,
  slutbetalning_betald date,
  frakt_sek numeric,
  tull_sek numeric,
  kommentar text,
  skapad timestamptz not null default now(),
  andrad timestamptz not null default now()
);

create table public.po_rader (
  id bigint generated always as identity primary key,
  po_id text not null references public.po(id) on delete cascade,
  style_id text references public.styles(id) on delete set null,
  produkt text,                        -- fri text innan style finns
  typ text check (typ in ('Nyhet','Restock','NOOS') or typ is null),
  farg text,
  tyg text,
  antal int,                           -- totalt, summeras från storlekar när de finns
  antal_per_storlek jsonb,             -- {"S": 10, "M": 20}
  tygkostnad_per_enhet numeric,
  styckpris_cmt numeric,
  fotosample text,                     -- Finns, Finns size M, ...
  fotosample_forvantad date,
  kommentar text
);
create index po_rader_po on public.po_rader (po_id);

-- ---------- filer (nytt): tech packs, drawings, mönster, lab dips ----------
create table public.filer (
  id bigint generated always as identity primary key,
  style_id text references public.styles(id) on delete cascade,
  sample_id text references public.samples(id) on delete cascade,
  typ text not null check (typ in ('Tech pack','Drawing','Mönster','Lab dip','Foto','Annat')),
  namn text not null,
  storage_path text,                   -- Supabase Storage, bucket "filer"
  extern_url text,                     -- t.ex. Drive-länk för mönsterkonstruktören
  version int not null default 1,
  av uuid references public.anvandare(id),
  uppladdad timestamptz not null default now()
);

-- ---------- content (nytt): foto och text per style ----------
create table public.content (
  style_id text primary key references public.styles(id) on delete cascade,
  produktfoto text not null default 'Saknas' check (produktfoto in ('Saknas','Delvis','Finns')),
  fotosample_id text references public.samples(id) on delete set null,
  bildbehov text[] not null default '{}',   -- Packshot, On model, Detalj, Video, Flat lay
  fotodatum date,
  text_status text not null default 'Ej påbörjad' check (text_status in ('Ej påbörjad','Skriven','Faktagranskad','Översatt','Klar')),
  size_chart boolean not null default false,
  kommentar text,
  andrad timestamptz not null default now()
);

-- ---------- triggers ----------
do $$ declare t text; begin
  foreach t in array array['leverantorer','tyger','tyglager','styles','samples','po','content'] loop
    execute format('create trigger %I_andrad before update on public.%I for each row execute function public.satt_andrad()', t, t);
  end loop;
end $$;

-- ---------- RLS ----------
do $$ declare t text; begin
  foreach t in array array['anvandare','installningar','logg','leverantorer','tyger','tyglager','styles','varianter','samples','matt','ean_pool','ean_anvanda','po','po_rader','filer','content'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_las on public.%I for select to authenticated using (public.ar_rubato())', t, t);
    execute format('create policy %I_skriv on public.%I for all to authenticated using (public.ar_rubato()) with check (public.ar_rubato())', t, t);
  end loop;
end $$;

-- ---------- realtime ----------
do $$ declare t text; begin
  foreach t in array array['leverantorer','tyger','tyglager','styles','varianter','samples','ean_pool','po','po_rader','filer','content','logg'] loop
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end $$;

-- ---------- storage ----------
insert into storage.buckets (id, name, public) values ('filer', 'filer', false) on conflict do nothing;
create policy filer_las on storage.objects for select to authenticated using (bucket_id = 'filer' and public.ar_rubato());
create policy filer_skriv on storage.objects for all to authenticated using (bucket_id = 'filer' and public.ar_rubato()) with check (bucket_id = 'filer' and public.ar_rubato());
