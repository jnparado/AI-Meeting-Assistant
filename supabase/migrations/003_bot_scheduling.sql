-- Bot scheduling: status lifecycle, credits, bot display name

alter table public.subscriptions
  add column if not exists meeting_credits_included integer not null default 100,
  add column if not exists meeting_credits_used integer not null default 0;

alter table public.meeting_bots
  add column if not exists bot_name text;

alter table public.organizations
  add column if not exists default_bot_name text;

create type public.bot_status_v2 as enum (
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

alter table public.meeting_bots alter column status drop default;

alter table public.meeting_bots
  alter column status type public.bot_status_v2
  using (
    case status::text
      when 'waiting_for_host' then 'waiting_room'
      when 'in_waiting_room' then 'waiting_room'
      else status::text
    end
  )::public.bot_status_v2;

alter table public.meeting_bots
  alter column status set default 'scheduled';

drop type public.bot_status;
alter type public.bot_status_v2 rename to bot_status;
