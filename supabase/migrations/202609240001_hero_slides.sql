begin;
create table if not exists public.hero_slides (
 id uuid primary key default gen_random_uuid(), title text not null,description text not null default '',
 image_url text not null default '',link_url text not null default '/',button_text text not null default 'Explore',
 sort_order integer not null default 0,active boolean not null default true
);
alter table public.hero_slides enable row level security;
revoke all on public.hero_slides from public,anon,authenticated;
grant all on public.hero_slides to service_role;
insert into public.hero_slides(id,title,description,link_url,button_text,sort_order) values
 ('77777777-7777-4777-8777-777777777771','Every home has a story.','Discover spaces, meet their creators and find your next chapter.','/','Explore homes',0),
 ('77777777-7777-4777-8777-777777777772','Bring your space to life.','Connect with local businesses and share the work you love.','/login/user','Join the community',1)
on conflict(id) do nothing;
notify pgrst, 'reload schema';
commit;
