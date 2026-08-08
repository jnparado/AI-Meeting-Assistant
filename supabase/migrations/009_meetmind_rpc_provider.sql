-- Fix: null value in column "provider" on meetings (join flow fallback insert)

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
  -- meeting_provider enum (google_meet)
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

  -- calendar_provider enum (google)
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

  -- provider as text / unknown enum
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
    starts_at, ends_at, meeting_url, platform, provider
  )
  values (
    p_user_id, p_organization_id, p_external_calendar_id, p_title,
    v_start, v_end, p_meeting_url, 'unknown'::public.meeting_platform, 'google'
  )
  returning id into v_id;

  return v_id;
end;
$$;

notify pgrst, 'reload schema';
