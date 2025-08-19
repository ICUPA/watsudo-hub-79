-- Enable PostGIS if not enabled
create extension if not exists postgis;

-- Conversations (one per wa_id/phone)
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  current_step text default 'MAIN_MENU',
  conversation_data jsonb default '{}'::jsonb,
  last_activity_at timestamptz default now()
);

-- Logs (store all inbound/outbound/payloads)
create table if not exists public.whatsapp_logs (
  id bigserial primary key,
  direction text check (direction in ('in','out')),
  message_type text,
  phone_number text,
  message_content text,
  message_id text,
  payload jsonb,
  metadata jsonb,
  status text,
  created_at timestamptz default now()
);

-- Flow submissions (audit)
create table if not exists public.flow_submissions (
  id bigserial primary key,
  wa_id text,
  kind text,
  payload jsonb,
  created_at timestamptz default now()
);

-- QR defaults (per user) for quick re-use
create table if not exists public.qr_defaults (
  wa_id text primary key,
  default_type text check (default_type in ('phone','code')),
  momo_phone text,
  momo_code text,
  updated_at timestamptz default now()
);

-- Driver locations (for nearby)
create table if not exists public.driver_locations (
  driver_id uuid default gen_random_uuid() primary key,
  wa_id text,
  wa_name text,
  rating numeric default 5,
  geom geography(point,4326),
  updated_at timestamptz default now()
);

-- Insurance leads (very simple)
create table if not exists public.insurance_leads (
  id uuid primary key default gen_random_uuid(),
  phone_number text,
  state jsonb,
  status text default 'new',
  created_at timestamptz default now()
);

-- Helper function for nearby drivers
create or replace function public.list_nearby_drivers(lat double precision, lon double precision, radius_m integer, limit_n integer)
returns table (
  driver_id uuid,
  wa_name text,
  rating numeric,
  distance_km numeric,
  eta_minutes integer
) language sql stable as $$
  select
    d.driver_id,
    coalesce(d.wa_name,'Driver') as wa_name,
    coalesce(d.rating,5) as rating,
    round(ST_DistanceSphere(d.geom::geometry, ST_MakePoint(lon, lat)) / 1000.0, 2) as distance_km,
    ceil( (ST_DistanceSphere(d.geom::geometry, ST_MakePoint(lon, lat)) / 1000.0) / 30 * 60 )::int as eta_minutes -- assume 30km/h
  from driver_locations d
  where ST_DWithin(d.geom, ST_MakePoint(lon, lat)::geography, radius_m)
  order by distance_km asc
  limit limit_n;
$$;

-- Storage bucket (public) for future assets if needed
insert into storage.buckets (id, name, public)
values ('qr', 'qr', true)
on conflict (id) do nothing;