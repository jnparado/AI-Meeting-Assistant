-- Repair public.meetings when the table exists but is missing columns from 001/002.
-- Safe to run multiple times. Run in Supabase SQL Editor if "join now" reports schema cache errors.

do $$ begin
  create type public.calendar_provider as enum ('google', 'microsoft');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.meeting_platform as enum (
    'google_meet',
    'zoom',
    'teams',
    'unknown'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.meetings
  add column if not exists user_id uuid references public.profiles (id) on delete cascade;

alter table public.meetings
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.meetings
  add column if not exists external_calendar_id text not null default 'legacy:pending';

alter table public.meetings
  add column if not exists calendar_connection_id uuid references public.calendar_connections (id) on delete set null;

alter table public.meetings
  add column if not exists title text not null default 'Meeting';

alter table public.meetings
  add column if not exists description text;

alter table public.meetings
  add column if not exists starts_at timestamptz not null default now();

alter table public.meetings
  add column if not exists ends_at timestamptz not null default (now() + interval '1 hour');

alter table public.meetings
  add column if not exists meeting_url text;

alter table public.meetings
  add column if not exists platform public.meeting_platform not null default 'unknown';

alter table public.meetings
  add column if not exists provider public.calendar_provider not null default 'google';

alter table public.meetings
  alter column provider set default 'google';

update public.meetings
set provider = 'google'
where provider is null;

alter table public.meetings
  add column if not exists organizer_email text;

alter table public.meetings
  add column if not exists attendees jsonb not null default '[]'::jsonb;

alter table public.meetings
  add column if not exists ai_assistant_enabled boolean not null default false;

alter table public.meetings
  add column if not exists raw_event jsonb;

alter table public.meetings
  add column if not exists created_at timestamptz not null default now();

alter table public.meetings
  add column if not exists updated_at timestamptz not null default now();

-- Optional: backfill nulls on older partial rows
update public.meetings
set
  external_calendar_id = coalesce(nullif(external_calendar_id, ''), 'legacy:' || id::text),
  starts_at = coalesce(starts_at, now()),
  ends_at = coalesce(ends_at, coalesce(starts_at, now()) + interval '1 hour'),
  title = coalesce(nullif(title, ''), 'Meeting')
where
  external_calendar_id is null
  or external_calendar_id = ''
  or starts_at is null
  or ends_at is null
  or title is null
  or title = '';
