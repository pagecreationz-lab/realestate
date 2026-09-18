begin;
create table if not exists public.creator_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.creator_posts(id) on delete cascade,
 user_id uuid not null references public.users(id),
 body text not null check(length(trim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists creator_comments_post_idx on public.creator_comments(post_id,created_at);
create index if not exists creator_comments_user_idx on public.creator_comments(user_id,created_at);
alter table public.creator_comments enable row level security;
revoke all on public.creator_comments from public,anon,authenticated;
grant all on public.creator_comments to service_role;
notify pgrst, 'reload schema';
commit;
