-- 0004: fält för Shopify-push

alter table public.styles
  add column if not exists stylekod text,                 -- 4-siffrigt löpnummer i SKU, t.ex. 1079
  add column if not exists produkttyp text,               -- Shopify productType
  add column if not exists size_chart text,               -- handle på size_chart-metaobjekt
  add column if not exists "cut" text,
  add column if not exists fit_note text,
  add column if not exists model_note text,
  add column if not exists material_family text,
  add column if not exists fabric_mill text,
  add column if not exists fabric_weight text,
  add column if not exists fabric_origin text,
  add column if not exists construction text,
  add column if not exists features text,
  add column if not exists storlekssystem text;           -- vilken storlekskodserie SKU använder: alpha, midja, eu, eu_tailoring, balte, one

alter table public.styles drop constraint if exists styles_typ_check;
alter table public.styles add constraint styles_typ_check check (typ in ('Nyhet','Restock','NOOS'));

-- En rad per färg: titel, swatch, färgfamilj och Shopify-koppling
create table if not exists public.style_farger (
  id bigint generated always as identity primary key,
  style_id text not null references public.styles(id) on delete cascade,
  farg text not null,                                     -- som i varianter.farg
  fargindex int,                                          -- 1, 2, 3 ... -> 001 i SKU
  titel text,                                             -- "Fireman's Jacket in Deep", tom = namn + " in " + farg
  swatch text,                                            -- hex
  colour_family text,                                     -- handle: navy, brown ...
  shopify_product_id bigint,
  shopify_handle text,
  shopify_status text,                                    -- DRAFT, ACTIVE, ARCHIVED
  pushad timestamptz,
  pushad_av uuid references public.anvandare(id),
  unique (style_id, farg)
);
alter table public.style_farger enable row level security;
create policy style_farger_las on public.style_farger for select to authenticated using (public.ar_rubato());
create policy style_farger_skriv on public.style_farger for all to authenticated using (public.ar_rubato()) with check (public.ar_rubato());
alter publication supabase_realtime add table public.style_farger;

-- Leverantör: tillverkar-ID för tull och ursprungsland
alter table public.leverantorer
  add column if not exists land text,                     -- ISO-2, t.ex. JP
  add column if not exists mid_code text,
  add column if not exists mid_name text,
  add column if not exists mid_address text;

update public.leverantorer set land = 'JP', mid_code = 'JPEMI18TOK', mid_name = 'Eminento Inc.', mid_address = '9-18 Kobuna-Cho, Nihonbashi, Chuo-ku, Tokyo, 103-0024, JAPAN|' where namn = 'Eminento' and mid_code is null;
update public.leverantorer set land = 'JP', mid_code = 'JPJAPBLU4047OKA', mid_name = 'JAPAN BLUE Co.,Ltd - COLLECT', mid_address = '4047-8, Kojima-ajino, Kurashiki, Okayama 711-0913, Japan' where namn = 'Japan Blue' and mid_code is null;
update public.leverantorer set land = 'GB', mid_code = 'GBWILLOC28HAW', mid_name = 'William Lockie & Co Ltd', mid_address = '26-28 Drumlanrig Square, Hawick, Scottish Borders, TD9 OAW, UNITED KINGDOM' where namn = 'Lockie' and mid_code is null;
update public.leverantorer set land = 'IT', mid_code = 'ITDAMVUO1VER', mid_name = 'Damiano Vuono s.a.s', mid_address = 'Cascina Malora, 1 - 21029 Vergiate (VA), Italy' where namn = 'Vuono' and mid_code is null;
update public.leverantorer set land = 'IT', mid_code = 'ITSANTRI10FIR', mid_name = 'Santa Trinita di Nicolò Greco', mid_address = 'Via Etruria 10/E, 50026 San Casciano Val di Pesa, FIRENZE, Italy' where namn = 'Santa Trinita' and mid_code is null;
update public.leverantorer set land = 'IT' where namn in ('Carrara', 'New Esse') and land is null;
update public.leverantorer set land = 'ES' where namn = 'Ibera' and land is null;

-- Storlekskoder i SKU, som de används i Shopify idag
insert into public.installningar (nyckel, varde) values ('storlekskoder', '{
  "alpha": {"XS":"01","S":"02","M":"03","L":"04","XL":"05","XXL":"06"},
  "midja": {"30":"07","31":"08","32":"09","33":"10","34":"11","36":"12","38":"13"},
  "eu": {"44":"14","46":"15","48":"16","50":"17","52":"18","54":"19","56":"20"},
  "eu_tailoring": {"46":"21","48":"22","50":"23","52":"24","54":"25"},
  "balte": {"80":"35","85":"36","90":"37","95":"38","100":"39","105":"40"},
  "one": {"One size":"99"}
}') on conflict (nyckel) do nothing;

-- Produkttyper, kategorier och taggar
insert into public.installningar (nyckel, varde) values ('shopify', '{
  "produkttyper": {
    "Outerwear": {"kategori": "gid://shopify/TaxonomyCategory/aa-1-10-2", "taggar": ["Outerwear", "Jackets"]},
    "Knitwear":  {"kategori": "gid://shopify/TaxonomyCategory/aa-1-13-12", "taggar": ["Knitwear"]},
    "Shirts":    {"kategori": "gid://shopify/TaxonomyCategory/aa-1-13-7", "taggar": ["Shirts"]},
    "Trousers":  {"kategori": "gid://shopify/TaxonomyCategory/aa-1-12", "taggar": ["Trousers"]},
    "Tailoring": {"kategori": "gid://shopify/TaxonomyCategory/aa-1-10-2-11", "taggar": ["Tailoring"]},
    "T-shirt":   {"kategori": "gid://shopify/TaxonomyCategory/aa-1-13-8", "taggar": ["T-shirt"]},
    "Jerseys":   {"kategori": "gid://shopify/TaxonomyCategory/aa-1-13-12", "taggar": ["Jerseys"]},
    "Accessories": {"kategori": "gid://shopify/TaxonomyCategory/aa-2-6", "taggar": ["Accessories"]},
    "Footwear":  {"kategori": "gid://shopify/TaxonomyCategory/aa-8", "taggar": ["Footwear"]}
  },
  "vendor": "Rubato",
  "standardvikt_kg": {"Outerwear": 1, "Knitwear": 0.4, "Shirts": 0.3, "Trousers": 1, "Tailoring": 1.2, "T-shirt": 0.2, "Jerseys": 0.3, "Accessories": 0.3, "Footwear": 0.8}
}') on conflict (nyckel) do nothing;
