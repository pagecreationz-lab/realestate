begin;
create table if not exists public.broker_packages (
 id integer primary key check(id between 1 and 3),name text not null,
 description text not null default '',price_paise bigint check(price_paise>=0),
 duration_days integer not null default 30 check(duration_days between 1 and 3650),
 features jsonb not null default '[]'::jsonb,updated_at timestamptz not null default now()
);
insert into public.broker_packages(id,name,description) values
 (1,'Basic','Package details are managed by the super admin.'),
 (2,'Professional','Package details are managed by the super admin.'),
 (3,'Premium','Package details are managed by the super admin.') on conflict(id) do nothing;
alter table public.broker_packages enable row level security;
revoke all on public.broker_packages from public,anon,authenticated;
grant select,update on public.broker_packages to service_role;
notify pgrst, 'reload schema';
commit;
