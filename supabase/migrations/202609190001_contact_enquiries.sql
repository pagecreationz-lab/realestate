-- Requires the creator-platform migration. Contact details are private.
begin;
create table if not exists public.creator_contact_enquiries (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.creator_posts(id) on delete cascade,
 user_id uuid not null references public.users(id),
 role text not null check(role in ('dealer','broker','buyer')),
 name text not null check(length(name) between 2 and 120),
 mobile text not null check(mobile ~ '^\+?[0-9]{7,15}$'),
 home_loan boolean not null default false,
 site_visit boolean not null default false,
 created_at timestamptz not null default now(),
 unique(post_id,user_id)
);
alter table public.creator_contact_enquiries enable row level security;
revoke all on public.creator_contact_enquiries from public,anon,authenticated;
grant all on public.creator_contact_enquiries to service_role;
notify pgrst, 'reload schema';
commit;
