create table if not exists nauvis_private.revocations(factory_id uuid not null references public.nauvis_factories(id) on delete cascade,user_id uuid not null,device_name text not null,revoked_at timestamptz not null,primary key(factory_id,user_id));
alter table nauvis_private.revocations enable row level security;
revoke all on table nauvis_private.revocations from public,anon,authenticated;
CREATE OR REPLACE FUNCTION nauvis_private.device_control(p_action text, p_factory uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid:=auth.uid(); f public.nauvis_factories%rowtype; inv nauvis_private.invites%rowtype; h text; target uuid; expiry timestamptz;
begin
 if me is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_action='join_code' then
  if coalesce(p_payload->>'code','') !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_OR_EXPIRED_CODE'; end if;
  h:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload->>'code','UTF8')),'hex');
  select i.factory_id into target from nauvis_private.invites i where i.token_hash=h;
  if target is null then raise exception 'INVALID_OR_EXPIRED_CODE'; end if;
  select * into f from public.nauvis_factories x where x.id=target for update;
  select * into inv from nauvis_private.invites i where i.token_hash=h for update;
  if inv.used_at is not null or inv.expires_at<=now() or not exists(select 1 from public.nauvis_devices d where d.factory_id=f.id and d.user_id=inv.creator) then raise exception 'INVALID_OR_EXPIRED_CODE'; end if;
  update nauvis_private.invites i set used_at=now() where i.token_hash=h;
  insert into public.nauvis_devices(factory_id,user_id,device_name) values(f.id,me,left(coalesce(nullif(trim(p_payload->>'name'),''),'My device'),60))
   on conflict on constraint nauvis_devices_pkey do update set device_name=excluded.device_name;
  return jsonb_build_object('factory_id',f.id,'revision',f.revision,'snapshot',f.snapshot,'updated_at',f.updated_at);
 end if;
 select * into f from public.nauvis_factories x where x.id=p_factory for update;
 if not found or not exists(select 1 from public.nauvis_devices d where d.factory_id=p_factory and d.user_id=me) then raise exception 'DEVICE_NOT_PAIRED'; end if;
 case p_action
 when 'devices' then return jsonb_build_object('recovery_enabled',f.recovery_enabled,'recovery_matches',case when p_payload ? 'hash' then f.recovery_enabled and f.recovery_hash=(p_payload->>'hash') else null end,'revoked_devices',(select coalesce(jsonb_agg(jsonb_build_object('name',r.device_name,'revoked_at',r.revoked_at) order by r.revoked_at desc),'[]'::jsonb) from nauvis_private.revocations r where r.factory_id=f.id and not exists(select 1 from public.nauvis_devices d where d.factory_id=f.id and d.user_id=r.user_id)),'devices',(select coalesce(jsonb_agg(jsonb_build_object('id',d.user_id,'name',d.device_name,'current',d.user_id=me,'paired_at',d.paired_at) order by d.paired_at),'[]'::jsonb) from public.nauvis_devices d where d.factory_id=f.id));
 when 'invite' then
  h:=p_payload->>'hash'; if coalesce(h,'') !~ '^[0-9a-f]{64}$' or h=f.recovery_hash then raise exception 'INVALID_HASH'; end if;
  update nauvis_private.invites i set used_at=now() where i.factory_id=f.id and i.creator=me and i.used_at is null;
  expiry:=now()+interval '10 minutes';
  insert into nauvis_private.invites(token_hash,factory_id,creator,expires_at) values(h,f.id,me,expiry);
  return jsonb_build_object('expires_at',expiry);
 when 'recovery_set' then
  h:=p_payload->>'hash'; if coalesce(h,'') !~ '^[0-9a-f]{64}$' or exists(select 1 from nauvis_private.invites i where i.token_hash=h) then raise exception 'INVALID_HASH'; end if;
  update public.nauvis_factories x set recovery_hash=h,recovery_enabled=true where x.id=f.id;
  return jsonb_build_object('recovery_enabled',true);
 when 'recovery_disable' then
  update public.nauvis_factories x set recovery_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.gen_random_uuid()::text||pg_catalog.gen_random_uuid()::text,'UTF8')),'hex'),recovery_enabled=false where x.id=f.id;
  return jsonb_build_object('recovery_enabled',false);
 when 'revoke', 'revoke_others' then
  if p_action='revoke' then
   target:=(p_payload->>'id')::uuid;
   if target is null or target=me then raise exception 'CANNOT_REVOKE_CURRENT_DEVICE'; end if;
  end if;
  with removed as (delete from public.nauvis_devices d where d.factory_id=f.id and d.user_id<>me and (p_action='revoke_others' or d.user_id=target) returning d.user_id,d.device_name)
  insert into nauvis_private.revocations(factory_id,user_id,device_name,revoked_at) select f.id,r.user_id,r.device_name,now() from removed r
  on conflict(factory_id,user_id) do update set device_name=excluded.device_name,revoked_at=excluded.revoked_at;
  if not found and p_action='revoke' then raise exception 'DEVICE_NOT_FOUND'; end if;
  update nauvis_private.invites i set used_at=now() where i.factory_id=f.id and i.used_at is null;
  update public.nauvis_factories x set recovery_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.gen_random_uuid()::text||pg_catalog.gen_random_uuid()::text,'UTF8')),'hex'),recovery_enabled=false where x.id=f.id;
  return jsonb_build_object('recovery_enabled',false);
 else raise exception 'UNKNOWN_ACTION';
 end case;
end $function$;

CREATE OR REPLACE FUNCTION public.nauvis_pair(p_recovery_key text, p_device_name text DEFAULT 'My device'::text)
 RETURNS TABLE(factory_id uuid, revision bigint, snapshot jsonb, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  where f.recovery_enabled and f.recovery_hash = pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_recovery_key, 'UTF8')), 'hex'
  ) for update;
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
$function$;

CREATE OR REPLACE FUNCTION public.nauvis_push(p_factory_id uuid, p_expected_revision bigint, p_snapshot jsonb)
 RETURNS TABLE(revision bigint, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  new_revision bigint;
  new_updated_at timestamptz;
begin
  perform 1 from public.nauvis_factories f where f.id=p_factory_id for update;
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
$function$;

CREATE OR REPLACE FUNCTION public.nauvis_revoke_device(p_recovery_key text, p_target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_recovery_key is null or p_recovery_key !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_RECOVERY_KEY';
  end if;
  select f.id into target_id from public.nauvis_factories f
  where f.recovery_enabled and f.recovery_hash = pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_recovery_key, 'UTF8')), 'hex'
  ) for update;
  if target_id is null then raise exception 'INVALID_RECOVERY_KEY'; end if;
  with removed as (delete from public.nauvis_devices d where d.factory_id=target_id and d.user_id=p_target_user_id returning d.user_id,d.device_name)
  insert into nauvis_private.revocations(factory_id,user_id,device_name,revoked_at) select target_id,r.user_id,r.device_name,now() from removed r on conflict(factory_id,user_id) do update set device_name=excluded.device_name,revoked_at=excluded.revoked_at;
  if not found then return false; end if;
  update nauvis_private.invites i set used_at=now() where i.factory_id=target_id and i.used_at is null;
  update public.nauvis_factories f set recovery_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.gen_random_uuid()::text||pg_catalog.gen_random_uuid()::text,'UTF8')),'hex'),recovery_enabled=false where f.id=target_id;
  return true;
end
$function$;

CREATE OR REPLACE FUNCTION public.nauvis_unpair(p_factory_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform 1 from public.nauvis_factories f where f.id=p_factory_id for update;
  update nauvis_private.invites i set used_at=now() where i.factory_id=p_factory_id and i.creator=auth.uid() and i.used_at is null;
  delete from public.nauvis_devices d
  where d.factory_id = p_factory_id and d.user_id = auth.uid();
  return found;
end
$function$;

notify pgrst,'reload schema';
