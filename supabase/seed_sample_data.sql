-- MeetMind: sample INSERTs for all public tables
-- Run in Supabase Dashboard → SQL Editor (uses service role; bypasses RLS).
--
-- Before running:
--   1. Apply migrations 001 → 004 (and 003 for bot credits).
--   2. Have at least one user in auth.users (e.g. npm run seed:test-user → demo@meetmind.test).
--
-- To target a different user, change v_user_email below.

begin;

-- Patches when 002/003 were not applied (safe to re-run)
alter table public.organizations
  add column if not exists default_bot_name text;

alter table public.subscriptions
  add column if not exists meeting_credits_included integer not null default 100,
  add column if not exists meeting_credits_used integer not null default 0;

alter table public.profiles
  add column if not exists default_organization_id uuid references public.organizations (id);

do $$
declare
  v_user_email text := 'demo@meetmind.test';
  v_user_id uuid;
  v_org_id uuid := 'a0000000-0000-4000-8000-000000000001';
  v_member_id uuid := 'a0000000-0000-4000-8000-000000000002';
  v_sub_id uuid := 'a0000000-0000-4000-8000-000000000003';
  v_cal_id uuid := 'b0000000-0000-4000-8000-000000000001';
  v_meeting_id uuid := 'b0000000-0000-4000-8000-000000000002';
  v_bot_id uuid := 'c0000000-0000-4000-8000-000000000001';
  v_transcript_id uuid := 'c0000000-0000-4000-8000-000000000002';
  v_summary_id uuid := 'c0000000-0000-4000-8000-000000000003';
  v_followup_id uuid := 'c0000000-0000-4000-8000-000000000004';
  v_starts timestamptz := date_trunc('hour', now()) + interval '1 day';
  v_ends timestamptz := v_starts + interval '45 minutes';
begin
  select id into v_user_id
  from auth.users
  where email = v_user_email
  limit 1;

  if v_user_id is null then
    raise exception 'No auth user for %. Sign up or run seed:test-user first.', v_user_email;
  end if;

  -- organizations (before profiles.default_organization_id FK)
  insert into public.organizations (id, name, slug, default_bot_name)
  values (
    v_org_id,
    'Acme Demo Workspace',
    'acme-demo-' || substr(v_user_id::text, 1, 8),
    'MeetMind AI Notetaker'
  )
  on conflict (id) do update
  set
    name = excluded.name,
    default_bot_name = excluded.default_bot_name,
    updated_at = now();

  -- profiles (usually created by handle_new_user trigger)
  insert into public.profiles (id, full_name, default_organization_id)
  values (v_user_id, 'Demo User', v_org_id)
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    default_organization_id = excluded.default_organization_id,
    updated_at = now();

  -- organization_members
  insert into public.organization_members (id, organization_id, user_id, role)
  values (v_member_id, v_org_id, v_user_id, 'owner')
  on conflict (organization_id, user_id) do update
  set role = excluded.role;

  -- subscriptions
  insert into public.subscriptions (
    id,
    organization_id,
    plan,
    status,
    seats,
    meeting_credits_included,
    meeting_credits_used,
    current_period_end
  )
  values (
    v_sub_id,
    v_org_id,
    'pro',
    'active',
    10,
    100,
    1,
    now() + interval '30 days'
  )
  on conflict (organization_id) do update
  set
    plan = excluded.plan,
    status = excluded.status,
    meeting_credits_included = excluded.meeting_credits_included,
    meeting_credits_used = excluded.meeting_credits_used,
    updated_at = now();

  -- organization_integrations
  insert into public.organization_integrations (
    organization_id,
    follow_up_email,
    follow_up_slack,
    notification_email
  )
  values (v_org_id, true, false, v_user_email)
  on conflict (organization_id) do update
  set notification_email = excluded.notification_email;

  -- user_integrations
  insert into public.user_integrations (
    user_id,
    follow_up_email,
    notification_email
  )
  values (v_user_id, true, v_user_email)
  on conflict (user_id) do update
  set notification_email = excluded.notification_email;

  -- calendar_connections (tokens are placeholders — replace after real OAuth)
  insert into public.calendar_connections (
    id,
    user_id,
    organization_id,
    provider,
    provider_account_id,
    access_token,
    refresh_token,
    calendar_id,
    scopes
  )
  values (
    v_cal_id,
    v_user_id,
    v_org_id,
    'google',
    'google-demo-account',
    'encrypted:demo-access-token',
    'encrypted:demo-refresh-token',
    'primary',
    array['https://www.googleapis.com/auth/calendar.readonly']
  )
  on conflict (user_id, organization_id, provider) do update
  set calendar_id = excluded.calendar_id;

  -- meetings
  insert into public.meetings (
    id,
    user_id,
    organization_id,
    external_calendar_id,
    calendar_connection_id,
    title,
    description,
    starts_at,
    ends_at,
    meeting_url,
    platform,
    provider,
    organizer_email,
    attendees,
    ai_assistant_enabled,
    raw_event
  )
  values (
    v_meeting_id,
    v_user_id,
    v_org_id,
    'google:sample-event-001',
    v_cal_id,
    'Product sync (sample)',
    'Sample meeting row for dashboard and bot flow',
    v_starts,
    v_ends,
    'https://meet.google.com/kvn-chcf-zsg',
    'google_meet',
    'google',
    v_user_email,
    jsonb_build_array(
      jsonb_build_object('email', v_user_email, 'name', 'Demo User'),
      jsonb_build_object('email', 'teammate@example.com', 'name', 'Teammate')
    ),
    true,
    jsonb_build_object('source', 'seed_sample_data.sql')
  )
  on conflict (organization_id, external_calendar_id) do update
  set
    title = excluded.title,
    meeting_url = excluded.meeting_url,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    provider = excluded.provider,
    updated_at = now();

  -- meeting_bots (status enum after migration 003)
  insert into public.meeting_bots (
    id,
    meeting_id,
    user_id,
    status,
    external_bot_id,
    scheduled_for,
    bot_name,
    metadata
  )
  values (
    v_bot_id,
    v_meeting_id,
    v_user_id,
    'scheduled',
    'sim_sample_bot_001',
    v_starts - interval '2 minutes',
    'MeetMind AI Notetaker',
    jsonb_build_object('provider', 'simulation', 'seed', true)
  )
  on conflict (id) do update
  set
    status = excluded.status,
    bot_name = excluded.bot_name,
    updated_at = now();

  -- transcripts
  insert into public.transcripts (
    id,
    meeting_id,
    user_id,
    full_text,
    segments,
    participant_events
  )
  values (
    v_transcript_id,
    v_meeting_id,
    v_user_id,
    'Demo User: Welcome everyone.' || E'\n' || 'Teammate: Thanks for joining.',
    jsonb_build_array(
      jsonb_build_object('speaker', 'Demo User', 'text', 'Welcome everyone.', 'startMs', 0),
      jsonb_build_object('speaker', 'Teammate', 'text', 'Thanks for joining.', 'startMs', 3200)
    ),
    jsonb_build_array(
      jsonb_build_object('event', 'join', 'name', 'MeetMind AI Notetaker', 'at', v_starts)
    )
  )
  on conflict (meeting_id) do update
  set full_text = excluded.full_text;

  -- meeting_summaries
  insert into public.meeting_summaries (
    id,
    meeting_id,
    user_id,
    summary,
    decisions,
    action_items,
    key_topics
  )
  values (
    v_summary_id,
    v_meeting_id,
    v_user_id,
    'Team aligned on Q3 priorities and next steps for the AI notetaker pilot.',
    jsonb_build_array('Ship join-now flow', 'Enable Recall in staging'),
    jsonb_build_array(
      jsonb_build_object('task', 'Add RECALL_API_KEY', 'owner', 'Demo User', 'due', '2026-08-15'),
      jsonb_build_object('task', 'Run ngrok for webhooks', 'owner', 'DevOps')
    ),
    jsonb_build_array('roadmap', 'Recall integration', 'credits')
  )
  on conflict (meeting_id) do update
  set summary = excluded.summary;

  -- follow_up_jobs
  insert into public.follow_up_jobs (
    id,
    meeting_id,
    user_id,
    channel,
    status,
    payload
  )
  values (
    v_followup_id,
    v_meeting_id,
    v_user_id,
    'email',
    'pending',
    jsonb_build_object(
      'to', v_user_email,
      'subject', 'Summary: Product sync (sample)',
      'preview', 'Team aligned on Q3 priorities…'
    )
  )
  on conflict (id) do nothing;

  raise notice 'Sample data seeded for user % (org %, meeting %)', v_user_id, v_org_id, v_meeting_id;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Standalone INSERT templates (replace UUIDs / emails before running)
-- ---------------------------------------------------------------------------

/*
-- 1) profiles
insert into public.profiles (id, full_name, default_organization_id)
values ('<auth.users.id>', 'Jane Doe', '<organizations.id>');

-- 2) organizations
insert into public.organizations (id, name, slug, default_bot_name)
values (gen_random_uuid(), 'My Company', 'my-company-abc12345', 'MeetMind AI Notetaker');

-- 3) organization_members
insert into public.organization_members (organization_id, user_id, role)
values ('<org_id>', '<user_id>', 'owner');

-- 4) subscriptions
insert into public.subscriptions (organization_id, plan, status, meeting_credits_included, meeting_credits_used)
values ('<org_id>', 'free', 'trialing', 100, 0);

-- 5) organization_integrations
insert into public.organization_integrations (organization_id, notification_email)
values ('<org_id>', 'you@example.com');

-- 6) user_integrations
insert into public.user_integrations (user_id, notification_email)
values ('<user_id>', 'you@example.com');

-- 7) calendar_connections
insert into public.calendar_connections (
  user_id, organization_id, provider, provider_account_id, access_token, calendar_id
) values (
  '<user_id>', '<org_id>', 'google', 'acct-1', 'encrypted-token', 'primary'
);

-- 8) meetings
insert into public.meetings (
  user_id, organization_id, external_calendar_id, title,
  starts_at, ends_at, meeting_url, platform, provider
) values (
  '<user_id>', '<org_id>', 'google:event-123', 'Weekly standup',
  now() + interval '1 day', now() + interval '1 day 30 minutes',
  'https://meet.google.com/abc-defg-hij', 'google_meet', 'google'
);

-- 9) meeting_bots
insert into public.meeting_bots (
  meeting_id, user_id, status, scheduled_for, bot_name
) values (
  '<meeting_id>', '<user_id>', 'scheduled', now() + interval '1 day', 'MeetMind AI Notetaker'
);

-- 10) transcripts
insert into public.transcripts (meeting_id, user_id, full_text, segments)
values ('<meeting_id>', '<user_id>', 'Hello world.', '[]'::jsonb);

-- 11) meeting_summaries
insert into public.meeting_summaries (meeting_id, user_id, summary)
values ('<meeting_id>', '<user_id>', 'Short summary text.');

-- 12) follow_up_jobs
insert into public.follow_up_jobs (meeting_id, user_id, channel, status, payload)
values ('<meeting_id>', '<user_id>', 'email', 'pending', '{}'::jsonb);
*/

-- Quick check after seed:
-- select 'profiles' as t, count(*) from public.profiles
-- union all select 'organizations', count(*) from public.organizations
-- union all select 'meetings', count(*) from public.meetings
-- union all select 'meeting_bots', count(*) from public.meeting_bots;
