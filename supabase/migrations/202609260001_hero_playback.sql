begin;
create table if not exists public.hero_settings (
 id integer primary key check(id=1),
 mode text not null default 'single' check(mode in ('single','autoplay')),
 interval_seconds integer not null default 6 check(interval_seconds between 3 and 60),
 selected_slide_id uuid references public.hero_slides(id) on delete set null
);
insert into public.hero_settings(id) values(1) on conflict do nothing;
alter table public.hero_settings enable row level security;
revoke all on public.hero_settings from public,anon,authenticated;
grant all on public.hero_settings to service_role;
notify pgrst, 'reload schema';
commit;
