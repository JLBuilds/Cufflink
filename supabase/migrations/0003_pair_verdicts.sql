-- Stylist vetting: the AI's yes/no on whether two pieces go together,
-- judged from their photos against my palette, proportions and notes.
-- Outfits containing a "no" pair are never generated.

create table public.pair_verdicts (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_a uuid not null references public.items(id) on delete cascade,   -- item_a < item_b
  item_b uuid not null references public.items(id) on delete cascade,
  ok boolean not null,
  reason text not null,
  source text not null default 'ai' check (source in ('ai','me')),        -- 'me' = my own override, never re-vetted
  created_at timestamptz not null default now(),
  primary key (user_id, item_a, item_b)
);

alter table public.pair_verdicts enable row level security;
create policy "pair_verdicts: own rows select" on public.pair_verdicts for select to authenticated using (user_id = auth.uid());
create policy "pair_verdicts: own rows insert" on public.pair_verdicts for insert to authenticated with check (user_id = auth.uid());
create policy "pair_verdicts: own rows update" on public.pair_verdicts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "pair_verdicts: own rows delete" on public.pair_verdicts for delete to authenticated using (user_id = auth.uid());
