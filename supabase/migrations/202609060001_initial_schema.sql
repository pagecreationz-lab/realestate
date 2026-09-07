create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  roles text[] not null default array['user']::text[]
    check (roles <@ array['user', 'broker', 'admin']::text[] and cardinality(roles) > 0),
  account_type text not null default 'individual' check (account_type in ('individual', 'business')),
  mobile text,
  verification jsonb not null default '{"mobile":false,"identity":false,"business":false,"broker":false}'::jsonb,
  status text not null default 'active' check (status in ('active', 'suspended', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  type text not null,
  purpose text not null check (purpose in ('Buy', 'Rent', 'Resale', 'Joint Venture')),
  seller_type text not null check (seller_type in ('Owner', 'Broker', 'Builder', 'Promoter')),
  seller_id uuid not null references public.users(id) on delete restrict,
  price numeric(16, 2) not null check (price >= 0),
  price_per_sqft numeric(14, 2),
  area_value numeric(14, 2),
  area_unit text not null default 'sq.ft',
  bhk integer,
  bathrooms integer,
  balconies integer,
  facing text,
  construction_status text,
  furnishing text,
  approval_type text,
  rera_number text,
  amenities text[] not null default '{}',
  loan_available boolean not null default false,
  city text not null,
  locality text not null,
  address jsonb not null default '{}'::jsonb,
  media jsonb not null default '{"photos":[],"reels":[]}'::jsonb,
  availability text not null default 'available',
  moderation_status text not null default 'draft'
    check (moderation_status in ('draft', 'pending', 'approved', 'rejected')),
  verified boolean not null default false,
  featured boolean not null default false,
  views integer not null default 0 check (views >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete cascade,
  assigned_to uuid not null references public.users(id) on delete restrict,
  source text not null default 'listing' check (source in ('listing', 'reel', 'requirement')),
  type text not null default 'enquiry' check (type in ('call', 'chat', 'enquiry')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'interested', 'follow-up', 'site-visit-planned', 'site-visit-completed', 'negotiation', 'booked', 'closed')),
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  buyer_id uuid not null references public.users(id) on delete restrict,
  seller_id uuid not null references public.users(id) on delete restrict,
  requested_at timestamptz not null,
  confirmed_at timestamptz,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no-show')),
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_search_idx on public.properties (city, locality, type, purpose, price);
create index if not exists properties_moderation_idx on public.properties (moderation_status, availability, featured, created_at desc);
create index if not exists properties_seller_idx on public.properties (seller_id);
create index if not exists enquiries_property_idx on public.enquiries (property_id);
create index if not exists enquiries_assigned_idx on public.enquiries (assigned_to, status);
create index if not exists site_visits_property_idx on public.site_visits (property_id);
create index if not exists site_visits_seller_idx on public.site_visits (seller_id, status);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties for each row execute function public.set_updated_at();
drop trigger if exists enquiries_set_updated_at on public.enquiries;
create trigger enquiries_set_updated_at before update on public.enquiries for each row execute function public.set_updated_at();
drop trigger if exists site_visits_set_updated_at on public.site_visits;
create trigger site_visits_set_updated_at before update on public.site_visits for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.properties enable row level security;
alter table public.enquiries enable row level security;
alter table public.site_visits enable row level security;

revoke all on table public.users, public.properties, public.enquiries, public.site_visits from anon, authenticated;
grant all on table public.users, public.properties, public.enquiries, public.site_visits to service_role;
