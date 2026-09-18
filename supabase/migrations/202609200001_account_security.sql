begin;
alter table public.users add column if not exists profile_version integer not null default 0;
create or replace function public.account_update_profile(p_user uuid,p_name text,p_mobile text)
returns void language plpgsql set search_path=public as $$
begin
 if length(trim(p_name)) not between 2 and 120 or (p_mobile<>'' and p_mobile !~ '^\+?[0-9]{7,15}$') then raise exception 'Invalid profile'; end if;
 update users set name=trim(p_name),mobile=nullif(p_mobile,''),
 verification=case when coalesce(mobile,'')<>p_mobile then coalesce(verification,'{}'::jsonb)||'{"mobile":false}'::jsonb else verification end,
 profile_version=profile_version+1,updated_at=now() where id=p_user and status='active';
 if not found then raise exception 'Account is not active'; end if;
end $$;
revoke all on function public.account_update_profile(uuid,text,text) from public,anon,authenticated;
grant execute on function public.account_update_profile(uuid,text,text) to service_role;
create table if not exists public.account_password_resets (
 user_id uuid primary key references public.users(id) on delete cascade,
 token_hash text not null, password_hash_at_issue text not null,
 expires_at timestamptz not null, requested_at timestamptz not null default now()
);
alter table public.account_password_resets enable row level security;
revoke all on public.account_password_resets from public,anon,authenticated;
grant all on public.account_password_resets to service_role;
create or replace function public.account_issue_reset(p_user uuid,p_token text)
returns boolean language plpgsql set search_path=public as $$
declare u users%rowtype;
begin
 select * into u from users where id=p_user for update;
 if not found or u.status<>'active' or not('user'=any(u.roles)) or u.roles && array['admin','broker'] then return false; end if;
 if exists(select 1 from account_password_resets where user_id=p_user and requested_at>now()-interval '5 minutes') then return false; end if;
 insert into account_password_resets(user_id,token_hash,password_hash_at_issue,expires_at,requested_at)
 values(p_user,p_token,u.password_hash,now()+interval '20 minutes',now())
 on conflict(user_id) do update set token_hash=excluded.token_hash,password_hash_at_issue=excluded.password_hash_at_issue,expires_at=excluded.expires_at,requested_at=excluded.requested_at;
 return true;
end $$;
create or replace function public.account_consume_reset(p_user uuid,p_token text,p_password text)
returns boolean language plpgsql set search_path=public as $$
declare u users%rowtype;
begin
 select * into u from users where id=p_user for update;
 if not found or u.status<>'active' or not('user'=any(u.roles)) or u.roles && array['admin','broker'] then return false; end if;
 delete from account_password_resets where user_id=p_user and token_hash=p_token and expires_at>now() and password_hash_at_issue=u.password_hash;
 if not found then return false; end if;
 update users set password_hash=p_password,updated_at=now() where id=p_user;
 return true;
end $$;
revoke all on function public.account_issue_reset(uuid,text),public.account_consume_reset(uuid,text,text) from public,anon,authenticated;
grant execute on function public.account_issue_reset(uuid,text),public.account_consume_reset(uuid,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
