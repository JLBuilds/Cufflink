-- My notes on looks, verdicts and outfits, kept verbatim. Recent notes are
-- fed back into the AI prompts so its reads and judgements learn my eye.

create table public.style_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('inspo','verdict','outfit','item')),
  ref_id uuid,                 -- the inspiration / evaluation / item it's about
  slot text,                   -- inspo component (top, shoes…) when it's about one piece
  context text,                -- short label for the prompt, e.g. look title + piece name
  note text not null,
  created_at timestamptz not null default now()
);
create index style_notes_user_created on public.style_notes (user_id, created_at desc);
create index style_notes_ref on public.style_notes (ref_id);

alter table public.style_notes enable row level security;
create policy "style_notes: own rows select" on public.style_notes for select to authenticated using (user_id = auth.uid());
create policy "style_notes: own rows insert" on public.style_notes for insert to authenticated with check (user_id = auth.uid());
create policy "style_notes: own rows update" on public.style_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "style_notes: own rows delete" on public.style_notes for delete to authenticated using (user_id = auth.uid());
