-- Apply once in the Supabase SQL Editor for this app's project.
-- Requires the existing 202609290001_email_verification migration.
-- Invalidates pending legacy email links; affected users can request an OTP.
-- Existing accounts, passwords and verification status are preserved.
begin;
alter table public.account_email_verifications add column attempts integer not null default 0;
-- Invalidate outstanding link tokens when switching to OTP.
delete from public.account_email_verifications;
create or replace function public.account_issue_verification(p_user uuid,p_token text)
returns boolean language plpgsql set search_path=public as $$
declare u users%rowtype;
begin
 select * into u from users where id=p_user for update;
 if not found or u.status<>'active' or not coalesce(u.verification @> '{"email_required":true,"email":false}'::jsonb,false) then return false; end if;
 if exists(select 1 from account_email_verifications where user_id=p_user and requested_at>now()-interval '5 minutes') then return false; end if;
 insert into account_email_verifications(user_id,email,token_hash,requested_at,expires_at,attempts)
 values(p_user,u.email,p_token,now(),now()+interval '10 minutes',0)
 on conflict(user_id) do update set email=excluded.email,token_hash=excluded.token_hash,requested_at=excluded.requested_at,expires_at=excluded.expires_at,attempts=0;
 return true;
end $$;
create or replace function public.account_consume_verification(p_user uuid,p_token text)
returns boolean language sql set search_path=public as $$ select false $$;
create or replace function public.account_consume_email_otp(p_email text,p_token text)
returns boolean language plpgsql set search_path=public as $$
declare u users%rowtype; v account_email_verifications%rowtype;
begin
 select * into u from users where email=p_email for update;
 if not found or u.status<>'active' or not coalesce(u.verification @> '{"email_required":true,"email":false}'::jsonb,false) then return false; end if;
 select * into v from account_email_verifications where user_id=u.id for update;
 if not found or v.email<>u.email or v.expires_at<=now() or v.attempts>=5 then return false; end if;
 if v.token_hash<>p_token then
  update account_email_verifications set attempts=attempts+1 where user_id=u.id;
  return false;
 end if;
 delete from account_email_verifications where user_id=u.id;
 update users set verification=coalesce(verification,'{}'::jsonb)||'{"email":true}'::jsonb,updated_at=now() where id=u.id;
 return true;
end $$;
revoke all on function public.account_consume_email_otp(text,text) from public,anon,authenticated;
grant execute on function public.account_consume_email_otp(text,text) to service_role;
notify pgrst,'reload schema';

alter table public.email_verification_settings
 add column smtp_host text not null default '',
 add column smtp_port integer not null default 587 check(smtp_port between 1 and 65535),
 add column smtp_security text not null default 'starttls' check(smtp_security in ('starttls','tls')),
 add column smtp_username text not null default '',
 add column smtp_password_enc text not null default '';
-- Existing RLS and service-role-only grants also protect SMTP credentials.
notify pgrst,'reload schema';

commit;

