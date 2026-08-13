-- Minimal fix for "Failed to create bot" / missing user_id on meeting_bots.
-- Paste into Supabase → SQL Editor → Run (takes ~2 seconds).
-- Full fix (RPCs + subscriptions): supabase/RUN_IN_SQL_EDITOR.sql

do $$ begin
  create type public.bot_status as enum (
    'scheduled', 'joining', 'waiting_room', 'joined', 'recording',
    'meeting_ended', 'processing', 'completed', 'failed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

alter table public.meeting_bots
  add column if not exists user_id uuid references public.profiles (id) on delete cascade;

alter table public.meeting_bots
  add column if not exists meeting_id uuid references public.meetings (id) on delete cascade;

alter table public.meeting_bots
  add column if not exists bot_name text;

alter table public.meeting_bots
  add column if not exists scheduled_for timestamptz not null default now();

alter table public.meeting_bots
  add column if not exists external_bot_id text;

alter table public.meeting_bots
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.meeting_bots
  add column if not exists failure_reason text;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meeting_bots' and column_name = 'status'
  ) then
    alter table public.meeting_bots
      add column status public.bot_status not null default 'scheduled';
  end if;
end $$;

update public.meeting_bots b
set user_id = m.user_id
from public.meetings m
where b.meeting_id = m.id and b.user_id is null;

notify pgrst, 'reload schema';

select 'meeting_bots patched — retry Join meeting' as status;
