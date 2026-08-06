-- Profile + org columns from 002/003 when migrations were skipped.

alter table public.profiles
  add column if not exists default_organization_id uuid references public.organizations (id);

alter table public.organizations
  add column if not exists default_bot_name text;

alter table public.subscriptions
  add column if not exists meeting_credits_included integer not null default 100,
  add column if not exists meeting_credits_used integer not null default 0;

alter table public.meeting_bots
  add column if not exists bot_name text;
