begin;
alter table public.hero_slides add column if not exists media_type text not null default 'image' check(media_type in ('image','video'));
-- Public marketing assets, not private user-post uploads. Upload tickets are issued only to admins.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hero-media','hero-media',true,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
notify pgrst, 'reload schema';
commit;
