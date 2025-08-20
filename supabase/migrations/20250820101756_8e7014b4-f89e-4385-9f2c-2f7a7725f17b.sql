-- ========== USERS ==========
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wa_id text unique,                        -- "2507..." digits only
  anon_code text unique,                    -- e.g., 6-digit displayed to others
  momo_phone text,                          -- default collection number (normalized)
  language text default 'en',
  notify boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_users_wa_id on users(wa_id);
alter table users enable row level security;

-- ========== DICTIONARIES ==========
create table if not exists basket_types (
  id serial primary key,
  key text unique,
  label text,
  enabled boolean default true,
  "order" int default 0
);
insert into basket_types (key,label,"order") values
  ('personal','Personal',1),
  ('savings','Savings',2)
on conflict (key) do nothing;

create table if not exists period_options (
  id serial primary key,
  key text unique,
  label text,
  cron_hint text,
  enabled boolean default true,
  "order" int default 0
);
insert into period_options (key,label,"order") values
  ('weekly','Weekly',1), ('monthly','Monthly',2), ('other','Other',3)
on conflict (key) do nothing;

-- ========== BASKETS ==========
create table if not exists baskets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references users(id) on delete cascade,
  name text not null,
  type_id int references basket_types(id),
  period_id int references period_options(id),
  collector_momo text,                      -- phone or short code (normalized)
  status text check (status in ('private','public')) default 'private',
  token text unique,                        -- used in deep link
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_baskets_creator on baskets(creator_id);
create index if not exists idx_baskets_token on baskets(token);
alter table baskets enable row level security;

create table if not exists visibility_requests (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid references baskets(id) on delete cascade,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  decided_by uuid references users(id),
  note text,
  created_at timestamptz default now(),
  decided_at timestamptz
);
create index if not exists idx_visreq_basket on visibility_requests(basket_id);
alter table visibility_requests enable row level security;

create table if not exists basket_members (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid references baskets(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  anon_code_cached text,
  joined_at timestamptz default now(),
  unique (basket_id, user_id)
);
create index if not exists idx_members_basket on basket_members(basket_id);
alter table basket_members enable row level security;

create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid references baskets(id) on delete cascade,
  contributor_user_id uuid references users(id),
  anon_code text,                            -- if no user_id, store anon
  amount numeric(12,2) not null check (amount > 0),
  note text,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  created_at timestamptz default now(),
  decided_at timestamptz,
  decided_by uuid references users(id)
);
create index if not exists idx_contrib_basket on contributions(basket_id);
create index if not exists idx_contrib_status on contributions(status);
alter table contributions enable row level security;

-- Totals view (fast enough; or denormalize)
create or replace view basket_totals as
select
  b.id as basket_id,
  coalesce(sum(case when c.status='approved' then c.amount else 0 end),0) as total_approved,
  count(*) filter (where c.status='approved') as contributions_count
from baskets b
left join contributions c on c.basket_id=b.id
group by b.id;

-- ========== REMINDERS ==========
create table if not exists reminder_subscriptions (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid references baskets(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  frequency text,                         -- 'weekly'|'monthly'|'custom'
  enabled boolean default true,
  created_at timestamptz default now(),
  unique (basket_id,user_id)
);
alter table reminder_subscriptions enable row level security;

-- ========== ADMIN QUEUE (moderation, approvals) ==========
create table if not exists admin_queue (
  id uuid primary key default gen_random_uuid(),
  kind text,                              -- 'visibility_request','contribution_pending','insurance_quote','claim','report','driver_onboard'
  ref_id uuid,                            -- points to the entity
  basket_id uuid,
  user_id uuid,
  payload jsonb,
  status text default 'pending',
  created_at timestamptz default now()
);
create index if not exists idx_admin_queue_status on admin_queue(status);

-- ========== MESSAGE TEMPLATES (copy/strings) ==========
create table if not exists message_templates (
  id serial primary key,
  key text unique,
  text text,
  locale text default 'en'
);
insert into message_templates (key,text) values
  ('basket_warning','Only contribute to people you trust. Verify with the creator.'),
  ('thank_you','Thank you! Your contribution has been recorded.')
on conflict (key) do nothing;

-- ========== MOBILITY / INSURANCE Minimal ==========
create table if not exists insurance_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  plate text,
  incident_date date,
  description text,
  docs jsonb,                             -- file ids/links
  status text default 'pending',
  created_at timestamptz default now()
);
alter table insurance_claims enable row level security;