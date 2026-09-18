-- Apply after the creator-platform migration. Existing accounts are preserved.
alter table public.users add column if not exists account_category text not null default 'customer'
 check(account_category in ('customer','dealer','broker','builder','admin'));
alter table public.users add column if not exists business_profile jsonb not null default '{}'::jsonb;
alter table public.users add column if not exists admin_notes text not null default '';
alter table public.users add column if not exists profile_version integer not null default 0;
update public.users set account_category=case when 'admin'=any(roles) then 'admin' when 'broker'=any(roles) then 'broker' else 'customer' end
where profile_version=0 and account_category='customer';

create table if not exists public.admin_account_changes (
 id uuid primary key default gen_random_uuid(), admin_id uuid not null references public.users(id),
 user_id uuid not null references public.users(id), reason text not null,
 before_data jsonb not null, after_data jsonb not null, created_at timestamptz not null default now()
);
alter table public.admin_account_changes enable row level security;
revoke all on public.admin_account_changes from anon,authenticated;
grant all on public.admin_account_changes to service_role;

create or replace function public.admin_update_account(p_admin uuid,p_user uuid,p_version integer,p_changes jsonb,p_reason text)
returns void language plpgsql set search_path=public as $$
declare v_before users%rowtype; v_after users%rowtype; v_roles text[]; v_status text; v_category text;
begin
 -- Serialize privilege changes so concurrent edits cannot remove the final active admin.
 perform pg_advisory_xact_lock(18092026);
 if not exists(select 1 from users where id=p_admin and status='active' and 'admin'=any(roles)) then raise exception 'Super admin required'; end if;
 select * into v_before from users where id=p_user for update;
 if not found then raise exception 'Account not found'; end if;
 if v_before.profile_version<>p_version then raise exception 'Account changed since you opened it. Reload before saving.'; end if;
 if length(trim(p_reason))<5 then raise exception 'A reason is required'; end if;
 select array_agg(value) into v_roles from jsonb_array_elements_text(p_changes->'roles');
 v_status=p_changes->>'status'; v_category=p_changes->>'account_category';
 if v_roles is null or cardinality(v_roles)=0 or not(v_roles <@ array['user','broker','admin']) then raise exception 'Invalid roles'; end if;
 if v_status not in ('active','suspended','blocked') then raise exception 'Invalid status'; end if;
 if (v_category='admin') is distinct from ('admin'=any(v_roles)) then raise exception 'Admin category and access must match'; end if;
 if p_user=p_admin and (v_status<>'active' or not('admin'=any(v_roles))) then raise exception 'You cannot disable your own admin access'; end if;
 if 'admin'=any(v_before.roles) and v_before.status='active' and (v_status<>'active' or not('admin'=any(v_roles)))
 and not exists(select 1 from users where id<>p_user and status='active' and 'admin'=any(roles)) then raise exception 'At least one active super admin must remain'; end if;
 update users set name=p_changes->>'name', email=lower(p_changes->>'email'),mobile=nullif(p_changes->>'mobile',''),
  status=v_status,roles=v_roles,account_category=v_category,
  account_type=case when v_category='customer' then 'individual' else 'business' end,
  business_profile=p_changes->'business_profile',verification=p_changes->'verification',admin_notes=p_changes->>'admin_notes',
  profile_version=profile_version+1,updated_at=now() where id=p_user returning * into v_after;
 insert into admin_account_changes(admin_id,user_id,reason,before_data,after_data)
 values(p_admin,p_user,p_reason,to_jsonb(v_before)-'password_hash',to_jsonb(v_after)-'password_hash');
end $$;
revoke all on function public.admin_update_account(uuid,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_update_account(uuid,uuid,integer,jsonb,text) to service_role;
notify pgrst, 'reload schema';
