create table if not exists public.reviewers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id text not null,
  title text not null,
  subject text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, reviewer_id)
);

alter table public.reviewers enable row level security;

drop policy if exists "Users can read own reviewers" on public.reviewers;
create policy "Users can read own reviewers"
on public.reviewers
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Users can insert own reviewers" on public.reviewers;
create policy "Users can insert own reviewers"
on public.reviewers
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Users can update own reviewers" on public.reviewers;
create policy "Users can update own reviewers"
on public.reviewers
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own reviewers" on public.reviewers;
create policy "Users can delete own reviewers"
on public.reviewers
for delete
to authenticated
using (auth.uid() = owner_id);

create index if not exists reviewers_owner_updated_idx
on public.reviewers(owner_id, updated_at desc);
