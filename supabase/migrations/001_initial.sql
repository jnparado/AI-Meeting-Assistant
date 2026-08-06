-- Meeting AI Assistant schema

create type public.calendar_provider as enum ('google', 'microsoft');
create type public.meeting_platform as enum ('google_meet', 'zoom', 'teams', 'unknown');
create type public.bot_status as enum (
  'scheduled',
  'joining',
  'waiting_for_host',
  'in_waiting_room',
  'recording',
  'processing',
  'completed',
  'failed',
  'cancelled'
);
create type public.follow_up_channel as enum ('email', 'slack', 'crm');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider public.calendar_provider not null,
  provider_account_id text not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.user_integrations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  follow_up_email boolean not null default true,
  follow_up_slack boolean not null default false,
  follow_up_crm boolean not null default false,
  slack_webhook_url text,
  crm_provider text,
  crm_access_token text,
  notification_email text,
  updated_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  external_calendar_id text not null,
  calendar_connection_id uuid references public.calendar_connections (id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  meeting_url text,
  platform public.meeting_platform not null default 'unknown',
  organizer_email text,
  attendees jsonb not null default '[]'::jsonb,
  ai_assistant_enabled boolean not null default false,
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_calendar_id)
);

create table public.meeting_bots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.bot_status not null default 'scheduled',
  external_bot_id text,
  scheduled_for timestamptz not null,
  joined_at timestamptz,
  recording_started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  full_text text not null default '',
  segments jsonb not null default '[]'::jsonb,
  participant_events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  summary text not null,
  decisions jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  key_topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.follow_up_jobs (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel public.follow_up_channel not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index meetings_user_starts_at_idx on public.meetings (user_id, starts_at);
create index meeting_bots_scheduled_for_idx on public.meeting_bots (scheduled_for) where status = 'scheduled';

alter table public.profiles enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.user_integrations enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_bots enable row level security;
alter table public.transcripts enable row level security;
alter table public.meeting_summaries enable row level security;
alter table public.follow_up_jobs enable row level security;

create policy "profiles own row" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "calendar_connections own row" on public.calendar_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_integrations own row" on public.user_integrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "meetings own row" on public.meetings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "meeting_bots own row" on public.meeting_bots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transcripts own row" on public.transcripts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "meeting_summaries own row" on public.meeting_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "follow_up_jobs own row" on public.follow_up_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_integrations (user_id, notification_email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
