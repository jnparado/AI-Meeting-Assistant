-- Paste this entire file into Supabase → SQL Editor → Run (once).
-- Fixes "schema cache" / provider errors on Join meeting.
-- Or locally: add SUPABASE_DB_URL to .env.local and run `npm run db:fix`

-- Ensure meetings columns exist (safe if already applied)
alter table public.meetings
  add column if not exists provider text default 'google';

alter table public.meetings
  add column if not exists ends_at timestamptz default (now() + interval '1 hour');

alter table public.meetings
  add column if not exists starts_at timestamptz default now();

update public.meetings set provider = coalesce(provider, 'google') where provider is null;

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
    return v_id;
  exception when others then null;
  end;

  begin
    insert into public.meetings (
      user_id, organization_id, external_calendar_id, title,
      starts_at, ends_at, meeting_url, platform, provider
    )
    values (
      p_user_id, p_organization_id, p_external_calendar_id, p_title,
      v_start, v_end, p_meeting_url,
      'google_meet'::public.meeting_platform,
      'google'::public.calendar_provider
    )
    returning id into v_id;
    return v_id;
  exception when others then null;
  end;

  begin
    insert into public.meetings (
      user_id, organization_id, external_calendar_id, title,
      starts_at, ends_at, meeting_url, provider
    )
    values (
      p_user_id, p_organization_id, p_external_calendar_id, p_title,
      v_start, v_end, p_meeting_url, 'google_meet'
    )
    returning id into v_id;
    return v_id;
  exception when others then null;
  end;

  insert into public.meetings (
    user_id, organization_id, external_calendar_id, title,
    starts_at, ends_at, meeting_url, provider
  )
  values (
    p_user_id, p_organization_id, p_external_calendar_id, p_title,
    v_start, v_end, p_meeting_url, 'google'
  )
  returning id into v_id;

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

create or replace function public.meetmind_prepare_meeting_join(
  p_meeting_id uuid,
  p_meeting_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.meetings
  set meeting_url = p_meeting_url, updated_at = now()
  where id = p_meeting_id;
  begin
    update public.meetings
    set platform = 'google_meet'::public.meeting_platform,
        ai_assistant_enabled = true
    where id = p_meeting_id;
  exception when others then
    update public.meetings set ai_assistant_enabled = true where id = p_meeting_id;
  end;
end;
$$;

grant execute on function public.meetmind_prepare_meeting_join(uuid, text)
  to service_role, authenticated;

create or replace function public.meetmind_ensure_active_subscription(
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (
    organization_id, plan, status, meeting_credits_included, meeting_credits_used
  )
  values (p_organization_id, 'free', 'active', 100, 0)
  on conflict (organization_id) do update
  set
    status = 'active',
    meeting_credits_included = greatest(
      coalesce(public.subscriptions.meeting_credits_included, 0),
      100
    ),
    meeting_credits_used = 0,
    updated_at = now();
exception
  when others then
    update public.subscriptions
    set status = 'active', updated_at = now()
    where organization_id = p_organization_id;
end;
$$;

grant execute on function public.meetmind_ensure_active_subscription(uuid)
  to service_role, authenticated;

create or replace function public.meetmind_consume_meeting_credit(
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions
  set
    meeting_credits_used = coalesce(meeting_credits_used, 0) + 1,
    updated_at = now()
  where organization_id = p_organization_id;
exception when others then null;
end;
$$;

grant execute on function public.meetmind_consume_meeting_credit(uuid)
  to service_role, authenticated;

create or replace function public.meetmind_set_bot_schedule(
  p_bot_id uuid,
  p_external_bot_id text,
  p_provider text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.meeting_bots
  set
    external_bot_id = p_external_bot_id,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('provider', p_provider)
  where id = p_bot_id;
exception when others then
  update public.meeting_bots set external_bot_id = p_external_bot_id where id = p_bot_id;
end;
$$;

grant execute on function public.meetmind_set_bot_schedule(uuid, text, text)
  to service_role, authenticated;

notify pgrst, 'reload schema';

select 'MeetMind join SQL applied — retry Join meeting on your site' as status;
