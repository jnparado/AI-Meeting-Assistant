-- Fix: "Subscription is not active. Upgrade to schedule AI assistants."
-- Sets status to active + credits for every org (or one user email below).

begin;

alter table public.subscriptions
  add column if not exists meeting_credits_included integer not null default 100,
  add column if not exists meeting_credits_used integer not null default 0;

-- Optional: only this login
-- \set target_email 'you@example.com'

update public.subscriptions s
set
  status = 'active',
  plan = coalesce(nullif(s.plan, ''), 'pro'),
  meeting_credits_included = greatest(coalesce(s.meeting_credits_included, 0), 100),
  meeting_credits_used = 0,
  updated_at = now()
where s.status is null
   or lower(s.status::text) not in ('trialing', 'active');

-- Orgs with no subscription row at all
insert into public.subscriptions (
  organization_id,
  plan,
  status,
  meeting_credits_included,
  meeting_credits_used
)
select
  o.id,
  'pro',
  'active',
  100,
  0
from public.organizations o
where not exists (
  select 1 from public.subscriptions s where s.organization_id = o.id
);

commit;

-- Check your account:
-- select u.email, s.status, s.meeting_credits_included, s.meeting_credits_used
-- from auth.users u
-- join public.organization_members m on m.user_id = u.id
-- join public.subscriptions s on s.organization_id = m.organization_id
-- where u.email = 'YOUR_EMAIL';
