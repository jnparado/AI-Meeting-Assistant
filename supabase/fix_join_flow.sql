-- One-shot fix for "Join meeting" / schema cache errors.
-- Paste entire file into Supabase → SQL Editor → Run.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.org_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum (
    'trialing', 'active', 'past_due', 'canceled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.calendar_provider as enum ('google', 'microsoft');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.meeting_platform as enum (
    'google_meet', 'zoom', 'teams', 'unknown'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.meeting_provider as enum (
    'google_meet', 'zoom', 'teams', 'unknown'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bot_status as enum (
    'scheduled',
    'joining',
    'waiting_room',
    'joined',
    'recording',
    'meeting_ended',
    'processing',
    'completed',
    'failed',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Core tables (minimal if missing)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations
  add column if not exists default_bot_name text;

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan text not null default 'free',
  status public.subscription_status not null default 'active',
  seats integer not null default 5,
  current_period_end timestamptz,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

alter table public.subscriptions
  add column if not exists meeting_credits_included integer not null default 100,
  add column if not exists meeting_credits_used integer not null default 0;

alter table public.profiles
  add column if not exists default_organization_id uuid references public.organizations (id);

-- ---------------------------------------------------------------------------
-- meetings
-- ---------------------------------------------------------------------------

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id),
  external_calendar_id text not null default 'legacy:pending',
  calendar_connection_id uuid,
  title text not null default 'Meeting',
  description text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '1 hour'),
  meeting_url text,
  platform public.meeting_platform not null default 'unknown',
  organizer_email text,
  attendees jsonb not null default '[]'::jsonb,
  ai_assistant_enabled boolean not null default false,
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meetings add column if not exists user_id uuid references public.profiles (id) on delete cascade;
alter table public.meetings add column if not exists organization_id uuid references public.organizations (id);
alter table public.meetings add column if not exists external_calendar_id text not null default 'legacy:pending';
alter table public.meetings add column if not exists title text not null default 'Meeting';
alter table public.meetings add column if not exists description text;
alter table public.meetings add column if not exists starts_at timestamptz not null default now();
alter table public.meetings add column if not exists ends_at timestamptz not null default (now() + interval '1 hour');
alter table public.meetings add column if not exists meeting_url text;
alter table public.meetings add column if not exists platform public.meeting_platform not null default 'unknown';
alter table public.meetings add column if not exists organizer_email text;
alter table public.meetings add column if not exists attendees jsonb not null default '[]'::jsonb;
alter table public.meetings add column if not exists ai_assistant_enabled boolean not null default false;
alter table public.meetings add column if not exists raw_event jsonb;
alter table public.meetings add column if not exists created_at timestamptz not null default now();
alter table public.meetings add column if not exists updated_at timestamptz not null default now();

-- provider: meeting_provider OR calendar_provider (only add if missing)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meetings' and column_name = 'provider'
  ) then
    alter table public.meetings
      add column provider public.meeting_provider not null default 'google_meet';
  end if;
end $$;

alter table public.meetings drop constraint if exists meetings_user_id_external_calendar_id_key;
alter table public.meetings drop constraint if exists meetings_organization_external_unique;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'meetings_organization_external_unique'
  ) then
    alter table public.meetings
      add constraint meetings_organization_external_unique
      unique (organization_id, external_calendar_id);
  end if;
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- meeting_bots
-- ---------------------------------------------------------------------------

create table if not exists public.meeting_bots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.bot_status not null default 'scheduled',
  external_bot_id text,
  scheduled_for timestamptz not null default now(),
  joined_at timestamptz,
  recording_started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  bot_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meeting_bots add column if not exists bot_name text;
alter table public.meeting_bots add column if not exists scheduled_for timestamptz not null default now();
alter table public.meeting_bots add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Workspace for every auth user (org + active subscription)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_org_id uuid;
  v_slug text;
  v_name text;
begin
  for r in
    select u.id as user_id, u.email, coalesce(p.full_name, 'User') as full_name
    from auth.users u
    left join public.profiles p on p.id = u.id
  loop
    insert into public.profiles (id, full_name)
    values (r.user_id, r.full_name)
    on conflict (id) do nothing;

    if not exists (
      select 1 from public.organization_members m where m.user_id = r.user_id
    ) then
      v_name := coalesce(nullif(split_part(r.email, '@', 2), ''), 'My workspace');
      v_slug := lower(regexp_replace(v_name, '[^a-z0-9]+', '-', 'g'));
      v_slug := trim(both '-' from coalesce(nullif(v_slug, ''), 'workspace'))
        || '-' || substr(r.user_id::text, 1, 8);

      insert into public.organizations (name, slug, default_bot_name)
      values (v_name, v_slug, 'MeetMind AI Notetaker')
      returning id into v_org_id;

      insert into public.organization_members (organization_id, user_id, role)
      values (v_org_id, r.user_id, 'owner');

      insert into public.subscriptions (
        organization_id, plan, status, meeting_credits_included, meeting_credits_used
      )
      values (v_org_id, 'free', 'active', 100, 0)
      on conflict (organization_id) do update
      set status = 'active', meeting_credits_included = 100, meeting_credits_used = 0;

      update public.profiles
      set default_organization_id = v_org_id
      where id = r.user_id;
    end if;
  end loop;
end $$;

update public.subscriptions
set status = 'active',
    meeting_credits_included = greatest(meeting_credits_included, 100),
    meeting_credits_used = 0
where lower(status::text) not in ('trialing', 'active');

-- RPC helpers (also in migrations/008_meetmind_rpc.sql)
create or replace function public.meetmind_create_adhoc_meeting(
  p_user_id uuid,
  p_organization_id uuid,
  p_meeting_url text,
  p_external_calendar_id text,
  p_title text default 'Live Google Meet'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_start timestamptz := now();
  v_end timestamptz := v_start + interval '1 hour';
begin
  begin
    insert into public.meetings (
      user_id, organization_id, external_calendar_id, title,
      starts_at, ends_at, meeting_url, platform, provider
    )
    values (
      p_user_id, p_organization_id, p_external_calendar_id, p_title,
      v_start, v_end, p_meeting_url,
      'google_meet'::public.meeting_platform,
      'google_meet'::public.meeting_provider
    )
    returning id into v_id;
  exception
    when others then
      insert into public.meetings (
        user_id, organization_id, external_calendar_id, title,
        starts_at, ends_at, meeting_url
      )
      values (
        p_user_id, p_organization_id, p_external_calendar_id, p_title,
        v_start, v_end, p_meeting_url
      )
      returning id into v_id;
  end;
  return v_id;
end;
$$;

grant execute on function public.meetmind_create_adhoc_meeting(uuid, uuid, text, text, text)
  to service_role, authenticated;

create or replace function public.meetmind_insert_meeting_bot(
  p_meeting_id uuid,
  p_user_id uuid,
  p_bot_name text,
  p_status text default 'joining'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.meeting_bots (
    meeting_id, user_id, status, scheduled_for, bot_name
  )
  values (
    p_meeting_id, p_user_id, p_status::public.bot_status, now(), p_bot_name
  )
  returning id into v_id;
  return v_id;
exception
  when others then
    insert into public.meeting_bots (meeting_id, user_id, scheduled_for, bot_name)
    values (p_meeting_id, p_user_id, now(), p_bot_name)
    returning id into v_id;
    return v_id;
end;
$$;

grant execute on function public.meetmind_insert_meeting_bot(uuid, uuid, text, text)
  to service_role, authenticated;

notify pgrst, 'reload schema';

select 'fix_join_flow.sql finished — retry Join meeting in the app' as result;
