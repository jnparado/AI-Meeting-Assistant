-- Fix: "No organization found for user"
-- Run in Supabase → SQL Editor (service role; bypasses RLS).
--
-- Creates missing org tables (002) if needed, then workspace rows per user.
-- Safe to re-run. Set v_only_email inside the DO block for one account.

begin;

-- ---------------------------------------------------------------------------
-- Bootstrap types + tables from 002 when migrations were not applied
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.org_role as enum ('owner', 'admin', 'member');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_status as enum (
    'trialing',
    'active',
    'past_due',
    'canceled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan text not null default 'free',
  status public.subscription_status not null default 'trialing',
  seats integer not null default 5,
  current_period_end timestamptz,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.organization_integrations (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  follow_up_email boolean not null default true,
  follow_up_slack boolean not null default false,
  follow_up_crm boolean not null default false,
  slack_webhook_url text,
  crm_provider text,
  crm_access_token text,
  notification_email text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_integrations (
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

alter table public.organizations
  add column if not exists default_bot_name text;

alter table public.profiles
  add column if not exists default_organization_id uuid references public.organizations (id);

alter table public.subscriptions
  add column if not exists meeting_credits_included integer not null default 100,
  add column if not exists meeting_credits_used integer not null default 0;

-- ---------------------------------------------------------------------------
-- Create workspace per auth user without organization_members row
-- ---------------------------------------------------------------------------

do $$
declare
  v_only_email text := null; -- e.g. 'you@example.com'
  r record;
  v_org_id uuid;
  v_slug text;
  v_name text;
begin
  for r in
    select
      u.id as user_id,
      u.email,
      coalesce(nullif(trim(p.full_name), ''), 'User') as full_name
    from auth.users u
    left join public.profiles p on p.id = u.id
    where not exists (
      select 1
      from public.organization_members m
      where m.user_id = u.id
    )
      and (v_only_email is null or u.email = v_only_email)
  loop
    v_name := coalesce(
      nullif(split_part(r.email, '@', 2), ''),
      r.full_name,
      'My workspace'
    );
    v_slug := lower(regexp_replace(v_name, '[^a-z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    if v_slug = '' then
      v_slug := 'workspace';
    end if;
    v_slug := v_slug || '-' || substr(r.user_id::text, 1, 8);

    insert into public.organizations (name, slug, default_bot_name)
    values (v_name, v_slug, 'MeetMind AI Notetaker')
    returning id into v_org_id;

    insert into public.profiles (id, full_name, default_organization_id)
    values (r.user_id, r.full_name, v_org_id)
    on conflict (id) do update
    set
      default_organization_id = v_org_id,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();

    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, r.user_id, 'owner');

    insert into public.subscriptions (
      organization_id,
      plan,
      status,
      meeting_credits_included,
      meeting_credits_used
    )
    values (v_org_id, 'free', 'trialing', 100, 0)
    on conflict (organization_id) do nothing;

    insert into public.organization_integrations (
      organization_id,
      notification_email
    )
    values (v_org_id, r.email)
    on conflict (organization_id) do nothing;

    insert into public.user_integrations (user_id, notification_email)
    values (r.user_id, r.email)
    on conflict (user_id) do nothing;

    raise notice 'Workspace % created for % (%)', v_org_id, r.email, r.user_id;
  end loop;
end $$;

update public.profiles p
set default_organization_id = m.organization_id
from (
  select distinct on (user_id) user_id, organization_id
  from public.organization_members
  order by user_id, created_at
) m
where p.id = m.user_id
  and p.default_organization_id is null;

-- RLS: allow users to read their own membership (optional if app uses service role)
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
  );
$$;

alter table public.organization_members enable row level security;
alter table public.organizations enable row level security;

drop policy if exists "organization_members read self" on public.organization_members;
create policy "organization_members read self" on public.organization_members
  for select using (user_id = auth.uid());

drop policy if exists "organizations member read" on public.organizations;
create policy "organizations member read" on public.organizations
  for select using (public.is_org_member(id));

commit;

-- Verify:
-- select u.email, o.name, o.id, m.role
-- from auth.users u
-- join public.organization_members m on m.user_id = u.id
-- join public.organizations o on o.id = m.organization_id;
