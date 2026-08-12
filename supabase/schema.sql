-- Rink Streak — Phase 2 schema (accounts + personal stats).
-- Run this in the Supabase SQL editor (or `supabase db push`). Idempotent-ish:
-- safe to re-run; uses IF NOT EXISTS / CREATE OR REPLACE where possible.
--
-- Phase 2 is OWNER-ONLY (personal stats). Public-read for leaderboards/public
-- profiles is deliberately deferred to Phase 3, when writes also go
-- server-authoritative (clients can fabricate streaks). Do not open these up
-- without that.

-- ---------------------------------------------------------------- profiles --
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text,
  favourite_team text,                       -- NHL team code, e.g. 'TOR' (nullable)
  created_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: owner read" on public.profiles;
create policy "profiles: owner read"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: owner upsert" on public.profiles;
create policy "profiles: owner upsert"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles: owner update" on public.profiles;
create policy "profiles: owner update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------- runs --
-- One row per completed run. Drives games-played + average, and seeds `best`.
-- `seed` is stored so a run can be replayed/verified later (Phase 3/6).
create table if not exists public.runs (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  team_code     text not null,
  mode          text not null,               -- 'casual' | 'hardcore'
  era_id        text not null,               -- 'all' | 'pre1970' | '1990s' | ...
  seed          bigint,
  streak        int  not null,
  ended_reason  text,                         -- 'wrong' | 'timeout'
  created_at    timestamptz not null default now()
);

create index if not exists runs_user_team_idx on public.runs (user_id, team_code);

alter table public.runs enable row level security;

drop policy if exists "runs: owner read" on public.runs;
create policy "runs: owner read"
  on public.runs for select
  using (auth.uid() = user_id);

drop policy if exists "runs: owner insert" on public.runs;
create policy "runs: owner insert"
  on public.runs for insert
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------ best_streaks --
-- Authoritative best per (user, team, mode, era). Upserted to MAX on run end,
-- and the target of the first-sign-in localStorage import (so importing a best
-- never inflates games-played / average, which come from `runs`).
create table if not exists public.best_streaks (
  user_id     uuid not null references auth.users (id) on delete cascade,
  team_code   text not null,
  mode        text not null,
  era_id      text not null,
  streak      int  not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, team_code, mode, era_id)
);

alter table public.best_streaks enable row level security;

drop policy if exists "best: owner read" on public.best_streaks;
create policy "best: owner read"
  on public.best_streaks for select
  using (auth.uid() = user_id);

drop policy if exists "best: owner insert" on public.best_streaks;
create policy "best: owner insert"
  on public.best_streaks for insert
  with check (auth.uid() = user_id);

drop policy if exists "best: owner update" on public.best_streaks;
create policy "best: owner update"
  on public.best_streaks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
