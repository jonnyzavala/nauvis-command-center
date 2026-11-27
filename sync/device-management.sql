-- Additive device management. Existing pairing, snapshots and revisions stay intact.
create schema if not exists nauvis_private;
revoke all on schema nauvis_private from public,anon,authenticated;
grant usage on schema nauvis_private to authenticated;
create table if not exists nauvis_private.invites (
 token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
 factory_id uuid not null references public.nauvis_factories(id) on delete cascade,
 creator uuid not null,
 expires_at timestamptz not null,
 used_at timestamptz
);
alter table nauvis_private.invites enable row level security;
revoke all on table nauvis_private.invites from public,anon,authenticated;
alter table public.nauvis_factories add column if not exists recovery_enabled boolean not null default true;
create or replace function nauvis_private.device_control(p_action text,p_factory uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
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
 when 'devices' then return jsonb_build_object('recovery_enabled',f.recovery_enabled,'devices',(select coalesce(jsonb_agg(jsonb_build_object('id',d.user_id,'name',d.device_name,'current',d.user_id=me,'paired_at',d.paired_at) order by d.paired_at),'[]'::jsonb) from public.nauvis_devices d where d.factory_id=f.id));
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
 when 'revoke' then
  target:=(p_payload->>'id')::uuid;
  if target is null or target=me then raise exception 'CANNOT_REVOKE_CURRENT_DEVICE'; end if;
  delete from public.nauvis_devices d where d.factory_id=f.id and d.user_id=target;
  if not found then raise exception 'DEVICE_NOT_FOUND'; end if;
  update nauvis_private.invites i set used_at=now() where i.factory_id=f.id and i.used_at is null;
  update public.nauvis_factories x set recovery_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.gen_random_uuid()::text||pg_catalog.gen_random_uuid()::text,'UTF8')),'hex'),recovery_enabled=false where x.id=f.id;
  return jsonb_build_object('recovery_enabled',false);
 else raise exception 'UNKNOWN_ACTION';
 end case;
end $$;
revoke all on function nauvis_private.device_control(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function nauvis_private.device_control(text,uuid,jsonb) to authenticated;
create or replace function public.nauvis_device_control(p_action text,p_factory uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select nauvis_private.device_control(p_action,p_factory,p_payload) $$;
revoke all on function public.nauvis_device_control(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.nauvis_device_control(text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
