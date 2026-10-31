-- "Can I wear this?": an outfit I've put together from pieces I own, judged
-- (photo + the pieces I confirmed) with a wear verdict, swaps and accessories.

create table public.wear_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  item_ids uuid[] not null,                  -- the owned pieces I confirmed I'm wearing
  unmatched jsonb not null default '[]'::jsonb, -- pieces in the photo not in my wardrobe
  rule_fails jsonb not null default '[]'::jsonb,
  judgement jsonb,                           -- verdict, advice, swaps, accessories
  user_note text,
  model text,
  created_at timestamptz not null default now()
);
create index wear_checks_user_created on public.wear_checks (user_id, created_at desc);

alter table public.wear_checks enable row level security;
create policy "wear_checks: own rows select" on public.wear_checks for select to authenticated using (user_id = auth.uid());
create policy "wear_checks: own rows insert" on public.wear_checks for insert to authenticated with check (user_id = auth.uid());
create policy "wear_checks: own rows update" on public.wear_checks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "wear_checks: own rows delete" on public.wear_checks for delete to authenticated using (user_id = auth.uid());
