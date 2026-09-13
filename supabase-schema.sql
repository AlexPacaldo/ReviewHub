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

grant select, insert, update, delete on public.reviewers to authenticated;

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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can read profiles" on public.profiles;
create policy "Users can read profiles"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create index if not exists profiles_email_idx
on public.profiles(lower(email));

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table public.friendships enable row level security;

grant select, insert, update, delete on public.friendships to authenticated;

drop policy if exists "Users can read own friendships" on public.friendships;
create policy "Users can read own friendships"
on public.friendships
for select
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users can send friend requests" on public.friendships;
create policy "Users can send friend requests"
on public.friendships
for insert
to authenticated
with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists "Users can accept friend requests" on public.friendships;
create policy "Users can accept friend requests"
on public.friendships
for update
to authenticated
using (auth.uid() = addressee_id)
with check (auth.uid() = addressee_id and status = 'accepted');

drop policy if exists "Users can remove own friendships" on public.friendships;
create policy "Users can remove own friendships"
on public.friendships
for delete
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id);

create index if not exists friendships_requester_idx
on public.friendships(requester_id, status);

create index if not exists friendships_addressee_idx
on public.friendships(addressee_id, status);

create table if not exists public.reviewer_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id text not null,
  title text not null,
  subject text not null,
  data jsonb not null,
  message text,
  created_at timestamptz not null default now(),
  check (owner_id <> recipient_id)
);

alter table public.reviewer_shares enable row level security;

grant select, insert, delete on public.reviewer_shares to authenticated;

drop policy if exists "Users can read sent or received shares" on public.reviewer_shares;
create policy "Users can read sent or received shares"
on public.reviewer_shares
for select
to authenticated
using (auth.uid() = owner_id or auth.uid() = recipient_id);

drop policy if exists "Users can send reviewer shares" on public.reviewer_shares;
create policy "Users can send reviewer shares"
on public.reviewer_shares
for insert
to authenticated
with check (
  auth.uid() = owner_id
  and exists (
    select 1
    from public.friendships
    where status = 'accepted'
      and (
        (requester_id = auth.uid() and addressee_id = recipient_id)
        or (addressee_id = auth.uid() and requester_id = recipient_id)
      )
  )
);

drop policy if exists "Users can delete own reviewer shares" on public.reviewer_shares;
create policy "Users can delete own reviewer shares"
on public.reviewer_shares
for delete
to authenticated
using (auth.uid() = owner_id or auth.uid() = recipient_id);

create index if not exists reviewer_shares_recipient_idx
on public.reviewer_shares(recipient_id, created_at desc);

create index if not exists reviewer_shares_owner_idx
on public.reviewer_shares(owner_id, created_at desc);
