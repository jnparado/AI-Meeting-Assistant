-- If meetings.provider uses enum meeting_provider (google_meet, zoom, teams),
-- not calendar_provider (google, microsoft). Safe to run on any project.

do $$ begin
  create type public.meeting_provider as enum (
    'google_meet',
    'zoom',
    'teams',
    'unknown'
  );
exception
  when duplicate_object then null;
end $$;

-- Optional aliases if app or old rows used calendar names
alter type public.meeting_provider add value if not exists 'google';
alter type public.meeting_provider add value if not exists 'microsoft';
