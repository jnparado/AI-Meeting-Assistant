-- Multi-tenant organizations, subscriptions, org-scoped data, encrypted calendar tokens

create type public.org_role as enum ('owner', 'admin', 'member');
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.subscriptions (
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

create table public.organization_integrations (
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

alter table public.profiles
  add column if not exists default_organization_id uuid references public.organizations (id);

alter table public.calendar_connections
  add column if not exists organization_id uuid references public.organizations (id),
  add column if not exists calendar_id text;

alter table public.meetings
  add column if not exists organization_id uuid references public.organizations (id);

-- Re-key meetings per organization
alter table public.meetings drop constraint if exists meetings_user_id_external_calendar_id_key;

alter table public.meetings
  add constraint meetings_organization_external_unique
  unique (organization_id, external_calendar_id);

alter table public.calendar_connections drop constraint if exists calendar_connections_user_id_provider_key;

alter table public.calendar_connections
  add constraint calendar_connections_user_org_provider_unique
  unique (user_id, organization_id, provider);

create index if not exists organization_members_user_idx
  on public.organization_members (user_id);

create index if not exists meetings_org_starts_at_idx
  on public.meetings (organization_id, starts_at);

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

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.organization_integrations enable row level security;

create policy "organizations member read" on public.organizations
  for select using (public.is_org_member(id));

create policy "organizations owner update" on public.organizations
  for update using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy "organization_members read own orgs" on public.organization_members
  for select using (public.is_org_member(organization_id));

create policy "subscriptions member read" on public.subscriptions
  for select using (public.is_org_member(organization_id));

create policy "organization_integrations member manage" on public.organization_integrations
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "meetings own row" on public.meetings;
create policy "meetings org member" on public.meetings
  for all using (
    auth.uid() = user_id
    or (organization_id is not null and public.is_org_member(organization_id))
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists "calendar_connections own row" on public.calendar_connections;
create policy "calendar_connections own row" on public.calendar_connections
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_integrations own row" on public.user_integrations;
create policy "user_integrations own row" on public.user_integrations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "meeting_bots own row" on public.meeting_bots;
create policy "meeting_bots org member" on public.meeting_bots
  for all using (
    auth.uid() = user_id
    or exists (
      select 1 from public.meetings mt
      where mt.id = meeting_id
        and mt.organization_id is not null
        and public.is_org_member(mt.organization_id)
    )
  )
  with check (auth.uid() = user_id);

drop policy if exists "transcripts own row" on public.transcripts;
create policy "transcripts org member" on public.transcripts
  for all using (
    auth.uid() = user_id
    or exists (
      select 1 from public.meetings mt
      where mt.id = meeting_id
        and public.is_org_member(mt.organization_id)
    )
  )
  with check (auth.uid() = user_id);

drop policy if exists "meeting_summaries own row" on public.meeting_summaries;
create policy "meeting_summaries org member" on public.meeting_summaries
  for all using (
    auth.uid() = user_id
    or exists (
      select 1 from public.meetings mt
      where mt.id = meeting_id
        and public.is_org_member(mt.organization_id)
    )
  )
  with check (auth.uid() = user_id);

drop policy if exists "follow_up_jobs own row" on public.follow_up_jobs;
create policy "follow_up_jobs org member" on public.follow_up_jobs
  for all using (
    auth.uid() = user_id
    or exists (
      select 1 from public.meetings mt
      where mt.id = meeting_id
        and public.is_org_member(mt.organization_id)
    )
  )
  with check (auth.uid() = user_id);

create or replace function public.slugify_org_name(input text, user_id uuid)
returns text
language plpgsql
as $$
declare
  base text;
begin
  base := lower(regexp_replace(coalesce(nullif(trim(input), ''), 'workspace'), '[^a-z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  if base = '' then
    base := 'workspace';
  end if;
  return base || '-' || substr(user_id::text, 1, 8);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  org_name text;
  org_slug text;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;

  org_name := coalesce(
    nullif(new.raw_user_meta_data->>'organization_name', ''),
    split_part(new.email, '@', 2),
    'My company'
  );
  org_slug := public.slugify_org_name(org_name, new.id);

  insert into public.organizations (name, slug)
  values (org_name, org_slug)
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (org_id, new.id, 'owner');

  insert into public.subscriptions (organization_id)
  values (org_id);

  insert into public.organization_integrations (organization_id, notification_email)
  values (org_id, new.email);

  insert into public.user_integrations (user_id, notification_email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;

  update public.profiles
  set default_organization_id = org_id
  where id = new.id;

  return new;
end;
$$;

do $$
declare
  profile_row record;
  org_id uuid;
  org_name text;
begin
  for profile_row in
    select p.id, u.email, p.full_name
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.default_organization_id is null
  loop
    org_name := coalesce(
      nullif(profile_row.full_name, ''),
      split_part(profile_row.email, '@', 2),
      'My company'
    );
    insert into public.organizations (name, slug)
    values (org_name, public.slugify_org_name(org_name, profile_row.id))
    returning id into org_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (org_id, profile_row.id, 'owner');

    insert into public.subscriptions (organization_id) values (org_id);

    insert into public.organization_integrations (organization_id, notification_email)
    values (org_id, profile_row.email);

    update public.profiles set default_organization_id = org_id where id = profile_row.id;

    update public.meetings set organization_id = org_id
    where user_id = profile_row.id and organization_id is null;
  end loop;
end $$;
