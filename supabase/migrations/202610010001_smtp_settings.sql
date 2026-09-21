begin;
alter table public.email_verification_settings
 add column smtp_host text not null default '',
 add column smtp_port integer not null default 587 check(smtp_port between 1 and 65535),
 add column smtp_security text not null default 'starttls' check(smtp_security in ('starttls','tls')),
 add column smtp_username text not null default '',
 add column smtp_password_enc text not null default '';
-- Existing RLS and service-role-only grants also protect SMTP credentials.
notify pgrst,'reload schema';
commit;
