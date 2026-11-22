-- NAUVIS pairing fix for: column reference "factory_id" is ambiguous
-- Safe to run after the original schema. Replaces only nauvis_pair().
-- Keeps existing factory, devices, snapshots, revision and recovery key unchanged.
-- Run in Supabase SQL Editor as the project database owner.

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
  -- Use the named primary-key constraint: RETURNS TABLE declares a PL/pgSQL
  -- output variable named factory_id, making ON CONFLICT (factory_id, ...) ambiguous.
  on conflict on constraint nauvis_devices_pkey
  do update set device_name = excluded.device_name;

  return query
    select f.id, f.revision, f.snapshot, f.updated_at
    from public.nauvis_factories f where f.id = target_id;
end
$$;

-- Restrict this privileged function to authenticated device sessions.
revoke all on function public.nauvis_pair(text,text) from public, anon, authenticated;
grant execute on function public.nauvis_pair(text,text) to authenticated;
