-- Knee Forward cloud backup. Run in the Supabase SQL editor.
-- Magic-link auth only. The allowlist is the single address compared in hook_before_user_created.
-- Never put the service-role key in the client. Health-adjacent rows are limited to auth.uid() = user_id.
-- Do not put symptom text in any email or push payload. Session notes stay in the database only.

create extension if not exists pgcrypto;

-- Reject every other address before a user row or magic link is created.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  email text := lower(coalesce(event->'user'->>'email', ''));
begin
  if email <> 'whman63@gmail.com' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'This email is not invited.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  affected_knee text not null,
  rehab_stage text not null,
  current_phase_id text not null,
  planned_surgery_date date,
  time_zone text,
  goal_label text not null default '',
  onboarding_complete boolean not null default false,
  weight_goal_kg numeric,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.user_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  episode_id text not null,
  plan_exercise_ids text[] not null,
  doses jsonb not null,
  plan_clinician_confirmed boolean not null default false,
  reminder_time text not null,
  reminder_days integer[] not null,
  reminder_dismissed_on date,
  schedule_overrides jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id text not null,
  completed_at timestamptz not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.session_sets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  exercise_id text not null,
  set_index integer not null,
  reps integer,
  load_kg numeric,
  completed boolean not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id text not null,
  session_id text,
  recorded_at timestamptz not null,
  pain_before integer,
  pain_after integer,
  swelling_before text,
  swelling_after text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.weight_entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_on date not null,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 500),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.push_subscriptions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.exercise_catalog (
  id text primary key,
  name text not null
);

create table if not exists public.routine_templates (
  id text primary key,
  name text not null
);

alter table public.profiles enable row level security;
alter table public.user_plans enable row level security;
alter table public.sessions enable row level security;
alter table public.session_sets enable row level security;
alter table public.check_ins enable row level security;
alter table public.weight_entries enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.exercise_catalog enable row level security;
alter table public.routine_templates enable row level security;

alter table public.profiles force row level security;
alter table public.user_plans force row level security;
alter table public.sessions force row level security;
alter table public.session_sets force row level security;
alter table public.check_ins force row level security;
alter table public.weight_entries force row level security;
alter table public.push_subscriptions force row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own plan" on public.user_plans
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sessions and check-ins are append-only for clients. Deletes go through delete_my_cloud_data.
create policy "read own sessions" on public.sessions
  for select to authenticated
  using (auth.uid() = user_id);
create policy "insert own sessions" on public.sessions
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "read own sets" on public.session_sets
  for select to authenticated
  using (auth.uid() = user_id);
create policy "insert own sets" on public.session_sets
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "read own check-ins" on public.check_ins
  for select to authenticated
  using (auth.uid() = user_id);
create policy "insert own check-ins" on public.check_ins
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "own weight entries" on public.weight_entries
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "read exercise catalog" on public.exercise_catalog
  for select to anon, authenticated
  using (true);
create policy "read routine templates" on public.routine_templates
  for select to anon, authenticated
  using (true);

create or replace function public.delete_my_cloud_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.session_sets where user_id = auth.uid();
  delete from public.sessions where user_id = auth.uid();
  delete from public.check_ins where user_id = auth.uid();
  delete from public.weight_entries where user_id = auth.uid();
  delete from public.user_plans where user_id = auth.uid();
  delete from public.push_subscriptions where user_id = auth.uid();
  delete from public.profiles where user_id = auth.uid();
end;
$$;

revoke all on function public.delete_my_cloud_data() from public, anon;
grant execute on function public.delete_my_cloud_data() to authenticated;
