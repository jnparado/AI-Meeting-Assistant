-- If join still fails after 004, your project may never have run 001–003.
-- Run those files in order in the SQL Editor, or paste this minimal bootstrap
-- ONLY when tables like meeting_bots do not exist yet.

-- Hint: In Supabase Table Editor, if you see meetings but no meeting_bots row,
-- run: 001_initial.sql, 002_organizations.sql, 003_bot_scheduling.sql

select
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'meeting_bots'
  ) as meeting_bots_exists,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'organizations'
  ) as organizations_exists;
