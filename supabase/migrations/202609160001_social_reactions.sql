create table if not exists public.property_reactions (
 user_id uuid not null references public.users(id) on delete cascade,
 property_id uuid not null references public.properties(id) on delete cascade,
 kind text not null check (kind in ('like','save')),
 created_at timestamptz not null default now(),
 primary key (user_id, property_id, kind)
);
alter table public.property_reactions enable row level security;
revoke all on public.property_reactions from anon, authenticated;
grant all on public.property_reactions to service_role;
create index if not exists property_reactions_property_idx on public.property_reactions(property_id,kind);
