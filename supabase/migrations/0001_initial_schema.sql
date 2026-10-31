-- Cufflink schema (spec §10) plus the extra attribute columns the rule
-- engine reads (drape, weight, tailored, delicate) and the bits needed
-- for caching and folder import. RLS on every table: user_id = auth.uid().

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'considering'
    check (status in ('owned','considering','wishlist','passed','exited')),
  confirmed_by_user boolean not null default false,   -- owned only counts when true
  name text not null,
  category text not null,
  subcategory text not null default '',
  colour_name text not null default '',
  colour_family text not null default 'other',
  palette_status text not null default 'neutral',
  reads text[] not null default '{}',
  fabric text not null default 'unknown',
  fabric_detail text,
  finish text not null default 'matte',
  drape text not null default 'soft',
  weight text not null default 'light',
  register text not null default 'elevated-casual',
  sleeve_type text not null default 'none',
  neckline text not null default 'none',
  volume text not null default 'relaxed',
  leg_width text not null default 'none',
  length text not null default 'none',
  tailored boolean not null default false,
  delicate boolean not null default false,
  statement boolean not null default false,
  embellishment text not null default 'none',
  hardware text not null default 'none',
  restrictions jsonb not null default '{}'::jsonb,
  retailer text,
  source_url text,
  price numeric,
  price_currency text,
  price_aed numeric,
  price_paid_aed numeric,
  images text[] not null default '{}',       -- storage paths in the private 'wardrobe' bucket
  notes text,                                -- verbatim, never normalised
  confidence jsonb,
  pass_reason text,
  source text not null default 'check',      -- check | add | seed | import
  seed_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_user_status on public.items (user_id, status);
create unique index items_user_seed_key on public.items (user_id, seed_key) where seed_key is not null;

-- ---------------------------------------------------------------------------
-- evaluations
-- ---------------------------------------------------------------------------
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references public.items(id) on delete cascade,
  input_type text not null check (input_type in ('photo','screenshot','link')),
  verdict text not null check (verdict in ('buy','buy_condition','duplicate','skip')),
  rule_results jsonb not null,               -- [{rule_id, kind, result, reason, item_ids}]
  unlock_count int not null default 0,
  net_new int not null default 0,
  styles_count int,
  outfit_ids uuid[] not null default '{}',
  goes_with jsonb not null default '[]'::jsonb,
  priority_gap jsonb,
  judgement jsonb,                           -- model's reasoning, pairings, outfit names
  grounded boolean not null default true,
  attributes jsonb not null,                 -- snapshot of the confirmed attributes judged
  overrides jsonb not null default '{}'::jsonb,
  image_hash text,
  user_note text,
  model text,
  created_at timestamptz not null default now()
);
create index evaluations_user_created on public.evaluations (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- outfits
-- ---------------------------------------------------------------------------
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_ids uuid[] not null,
  occasion text,
  source text not null check (source in ('generated','confirmed','rejected')),
  name text,
  bag_id uuid,
  jewellery_id uuid,
  notes text,
  created_at timestamptz not null default now()
);
create index outfits_user_source on public.outfits (user_id, source);

-- ---------------------------------------------------------------------------
-- inspirations
-- ---------------------------------------------------------------------------
create table public.inspirations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  image_path text,
  source_url text,
  components jsonb not null default '[]'::jsonb,  -- [{slot, attributes, match, item_id, difference, look_for, unlocks}]
  summary text,
  owned_count int not null default 0,
  user_note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- style_rules
-- ---------------------------------------------------------------------------
create table public.style_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version int not null,
  source_md text not null,
  config jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, version)
);
create unique index style_rules_one_active on public.style_rules (user_id) where active;

-- ---------------------------------------------------------------------------
-- extraction cache (spec §13: cache by image hash, reuse for re-checks)
-- ---------------------------------------------------------------------------
create table public.extraction_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  image_hash text not null,
  kind text not null,                -- garment | inspo
  rules_version int not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, image_hash, kind, rules_version)
);

-- ---------------------------------------------------------------------------
-- imports (phase 2: Wardrobe folder → item-by-item confirmation)
-- ---------------------------------------------------------------------------
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder text not null,
  file_name text not null,
  file_hash text not null,
  image_path text not null,
  attributes jsonb,
  suggested_item_id uuid references public.items(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','attached','created','reference','skipped')),
  resolved_item_id uuid references public.items(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['items','evaluations','outfits','inspirations','style_rules','extraction_cache','imports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: own rows select" on public.%1$I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "%1$s: own rows insert" on public.%1$I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s: own rows update" on public.%1$I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s: own rows delete" on public.%1$I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Private storage bucket. Photos of me and my home: signed URLs only.
-- Path convention (from Groove): {user_id}/{kind}/{timestamp}-{random}.{ext}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('wardrobe', 'wardrobe', false)
on conflict (id) do nothing;

create policy "wardrobe: users upload to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "wardrobe: users read own files"
  on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "wardrobe: users delete own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
