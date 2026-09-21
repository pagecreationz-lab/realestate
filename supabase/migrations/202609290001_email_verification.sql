begin;
create table if not exists public.email_verification_settings (
 id integer primary key check(id=1),sender text not null default '',site_url text not null default '',
 updated_by uuid references public.users(id),updated_at timestamptz not null default now()
);
insert into public.email_verification_settings(id) values(1) on conflict do nothing;
create table if not exists public.account_email_verifications (
 user_id uuid primary key references public.users(id) on delete cascade,
 email text not null,token_hash text not null,requested_at timestamptz not null,expires_at timestamptz not null
);
alter table public.email_verification_settings enable row level security;
alter table public.account_email_verifications enable row level security;
revoke all on public.email_verification_settings,public.account_email_verifications from public,anon,authenticated;
grant all on public.email_verification_settings,public.account_email_verifications to service_role;
create or replace function public.account_issue_verification(p_user uuid,p_token text)
returns boolean language plpgsql set search_path=public as $$
declare u users%rowtype;
begin
 select * into u from users where id=p_user for update;
 if not found or u.status<>'active' or not coalesce(u.verification @> '{"email_required":true,"email":false}'::jsonb,false) then return false; end if;
 if exists(select 1 from account_email_verifications where user_id=p_user and requested_at>now()-interval '5 minutes') then return false; end if;
 insert into account_email_verifications values(p_user,u.email,p_token,now(),now()+interval '30 minutes')
 on conflict(user_id) do update set email=excluded.email,token_hash=excluded.token_hash,requested_at=excluded.requested_at,expires_at=excluded.expires_at;
 return true;
end $$;
create or replace function public.account_consume_verification(p_user uuid,p_token text)
returns boolean language plpgsql set search_path=public as $$
declare u users%rowtype;
begin
 select * into u from users where id=p_user for update;
 if not found or u.status<>'active' then return false; end if;
 delete from account_email_verifications where user_id=p_user and email=u.email and token_hash=p_token and expires_at>now();
 if not found then return false; end if;
 update users set verification=coalesce(verification,'{}'::jsonb)||'{"email":true}'::jsonb,updated_at=now() where id=p_user;
 return true;
end $$;
revoke all on function public.account_issue_verification(uuid,text),public.account_consume_verification(uuid,text) from public,anon,authenticated;
grant execute on function public.account_issue_verification(uuid,text),public.account_consume_verification(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
