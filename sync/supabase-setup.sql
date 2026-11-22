-- Nauvis Command Center cloud sync schema (Supabase PostgreSQL).
-- Run this ONCE in your own Supabase project via SQL Editor.
-- Never put a service_role/secret API key in the public website.
--
-- Device authentication is automatic Supabase anonymous Auth.
-- A private 64-character recovery key is used once for pairing each device.
-- The public browser NEVER receives the database's provisioning privileges.

create table if not exists public.nauvis_factories (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  singleton smallint not null default 1 unique check (singleton = 1),
  recovery_hash text not null unique,
  snapshot jsonb not null default '{}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nauvis_devices (
  factory_id uuid not null references public.nauvis_factories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null default 'My device',
  paired_at timestamptz not null default now(),
  primary key (factory_id, user_id)
);

create index if not exists nauvis_devices_user_idx on public.nauvis_devices(user_id);

alter table public.nauvis_factories enable row level security;
alter table public.nauvis_devices enable row level security;

-- Neither table has a browser-readable policy. Every operation passes through
-- a narrowly defined RPC function that checks anonymous Auth device identity.
revoke all on table public.nauvis_factories from public, anon, authenticated;
revoke all on table public.nauvis_devices from public, anon, authenticated;

-- Run this function only inside the trusted SQL Editor, as the postgres owner.
-- It returns the recovery key ONCE. Save it in a private password manager or
-- private Craft document whose connection is NOT accessible by the website.
create or replace function public.nauvis_provision()
returns table(factory_id uuid, recovery_key text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  secret text;
  new_id uuid;
begin
  -- Two random v4 UUIDs yield approximately 244 bits of unpredictability.
  secret := replace(pg_catalog.gen_random_uuid()::text, '-', '') ||
            replace(pg_catalog.gen_random_uuid()::text, '-', '');
  insert into public.nauvis_factories (recovery_hash)
  values (pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(secret, 'UTF8')), 'hex'))
  returning id into new_id;
  return query select new_id, secret;
end
$$;

-- Important: revoke the default PUBLIC EXECUTE privilege.
revoke all on function public.nauvis_provision() from public, anon, authenticated;

-- Anonymous Supabase Auth sessions belong to the authenticated Postgres role.
-- This function requires possession of the private recovery key to pair.
create or replace function public.nauvis_pair(p_recovery_key text, p_device_name text default 'My device')
returns table(factory_id uuid, revision bigint, snapshot jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_id uuid;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_recovery_key is null
     or p_recovery_key !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_RECOVERY_KEY';
  end if;

  select f.id into target_id
  from public.nauvis_factories as f
  where f.recovery_hash = pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_recovery_key, 'UTF8')), 'hex'
  );
  if target_id is null then
    raise exception 'INVALID_RECOVERY_KEY';
  end if;

  insert into public.nauvis_devices (factory_id, user_id, device_name)
  values (target_id, current_user_id,
          left(coalesce(nullif(trim(p_device_name), ''), 'My device'), 60))
  on conflict (factory_id, user_id)
  do update set device_name = excluded.device_name;

  return query
    select f.id, f.revision, f.snapshot, f.updated_at
    from public.nauvis_factories f where f.id = target_id;
end
$$;

create or replace function public.nauvis_pull(p_factory_id uuid)
returns table(factory_id uuid, revision bigint, snapshot jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not exists (
       select 1 from public.nauvis_devices d
       where d.factory_id = p_factory_id and d.user_id = auth.uid()
     ) then
    raise exception 'DEVICE_NOT_PAIRED';
  end if;

  return query
    select f.id, f.revision, f.snapshot, f.updated_at
    from public.nauvis_factories f where f.id = p_factory_id;
end
$$;

-- Optimistic concurrency: an old device cannot blindly overwrite a newer save.
-- On REVISION_CONFLICT the app must ask how to resolve the two versions.
create or replace function public.nauvis_push(
  p_factory_id uuid, p_expected_revision bigint, p_snapshot jsonb
)
returns table(revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_revision bigint;
  new_updated_at timestamptz;
begin
  if auth.uid() is null
     or not exists (
       select 1 from public.nauvis_devices d
       where d.factory_id = p_factory_id and d.user_id = auth.uid()
     ) then
    raise exception 'DEVICE_NOT_PAIRED';
  end if;
  if p_snapshot is null or pg_catalog.jsonb_typeof(p_snapshot) <> 'object'
     or pg_catalog.octet_length(p_snapshot::text) > 1048576 then
    raise exception 'INVALID_SNAPSHOT';
  end if;

  update public.nauvis_factories f
  set snapshot = p_snapshot,
      revision = f.revision + 1,
      updated_at = now()
  where f.id = p_factory_id and f.revision = p_expected_revision
  returning f.revision, f.updated_at into new_revision, new_updated_at;

  if not found then
    raise exception 'REVISION_CONFLICT';
  end if;
  return query select new_revision, new_updated_at;
end
$$;

create or replace function public.nauvis_device_list(p_factory_id uuid)
returns table(user_id uuid, device_name text, paired_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not exists (
       select 1 from public.nauvis_devices d
       where d.factory_id = p_factory_id and d.user_id = auth.uid()
     ) then
    raise exception 'DEVICE_NOT_PAIRED';
  end if;
  return query
    select d.user_id, d.device_name, d.paired_at
    from public.nauvis_devices d
    where d.factory_id = p_factory_id order by d.paired_at;
end
$$;

-- A recovery-key holder can revoke a lost device.
create or replace function public.nauvis_revoke_device(
  p_recovery_key text, p_target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_recovery_key is null or p_recovery_key !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_RECOVERY_KEY';
  end if;
  select f.id into target_id from public.nauvis_factories f
  where f.recovery_hash = pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_recovery_key, 'UTF8')), 'hex'
  );
  if target_id is null then raise exception 'INVALID_RECOVERY_KEY'; end if;
  delete from public.nauvis_devices d
  where d.factory_id = target_id and d.user_id = p_target_user_id;
  return found;
end
$$;

revoke all on function public.nauvis_pair(text,text) from public, anon, authenticated;
revoke all on function public.nauvis_pull(uuid) from public, anon, authenticated;
revoke all on function public.nauvis_push(uuid,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.nauvis_device_list(uuid) from public, anon, authenticated;
revoke all on function public.nauvis_revoke_device(text,uuid) from public, anon, authenticated;
grant execute on function public.nauvis_pair(text,text) to authenticated;
grant execute on function public.nauvis_pull(uuid) to authenticated;
grant execute on function public.nauvis_push(uuid,bigint,jsonb) to authenticated;
grant execute on function public.nauvis_device_list(uuid) to authenticated;
grant execute on function public.nauvis_revoke_device(text,uuid) to authenticated;

-- After running the entire schema, run this *separate query* exactly once:
--
-- select * from public.nauvis_provision();
--
-- It returns a RECOVERY KEY. Copy it privately; the key is not retrievable
-- later from the database. Do not post it in chat, GitHub, or screenshots.
