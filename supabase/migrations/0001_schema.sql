-- Empty Seat Agent: schema
-- Eleven tables from the PRD data model, plus demo_state for the demo clock,
-- mode (demo/live) and simulator progress.
-- Money is stored in whole rupees. Times are timestamptz; the salon runs on IST.

create extension if not exists pgcrypto;

create table merchants (
  id text primary key,
  name text not null,
  owner_name text not null,
  city text not null,
  area_id text not null,
  stylists text[] not null,                 -- chair n = stylists[n]
  opens_at time not null default '10:00',
  closes_at time not null default '20:00',
  max_discount int not null,                -- rupees off list price, per slot
  allowed_offers text[] not null,           -- pay_now, friend, pass
  never_discount_services text[] not null default '{}',
  vip_customer_ids text[] not null default '{}',
  daily_message_cap int not null,
  quiet_hours_start time not null,
  quiet_hours_end time not null,
  approval_mode text not null check (approval_mode in ('ask_first', 'auto_run')),
  front_desk_name text not null,
  front_desk_phone text not null,
  logo_url text
);

-- Floor price and discountable live here, not on merchants: floors are per service.
create table services (
  id text primary key,
  merchant_id text not null references merchants(id),
  name text not null,
  duration_min int not null,
  price int not null,
  floor_price int,
  discountable boolean not null default true
);

create table customers (
  id text primary key,
  merchant_id text not null references merchants(id),
  name text not null,
  phone text not null,
  distance_km numeric(4,1) not null,
  last_visit_at timestamptz,
  usual_gap_days int not null,
  usual_time_band text not null check (usual_time_band in ('morning', 'afternoon', 'evening')),
  usual_service_id text references services(id),
  avg_spend int not null,
  past_offer_response numeric(3,2) not null default 0,   -- share of past offers accepted, 0..1
  card_issuer text,
  is_regular boolean not null default false,             -- books at full price anyway
  opted_out boolean not null default false
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  merchant_id text not null references merchants(id),
  customer_id text references customers(id),             -- null for walk-ins and guests
  guest_name text,
  service_id text not null references services(id),
  chair smallint not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  price int,
  source text not null check (source in ('crm', 'walk_in', 'agent', 'front_desk'))
);
create index bookings_merchant_start on bookings (merchant_id, start_at);

-- Free blocks of any length per chair. The planner splits them into offers.
create table slots (
  id uuid primary key default gen_random_uuid(),
  merchant_id text not null references merchants(id),
  chair smallint not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  state text not null default 'free'
    check (state in ('free', 'held', 'released', 'offered', 'paid', 'cancelled')),
  walk_in_prob numeric(3,2),
  fill_anyway_prob numeric(3,2),
  parent_slot_id uuid references slots(id),               -- set when a block is split
  sold_to text,                                           -- display name once paid
  sold_price int
);
create index slots_merchant_start on slots (merchant_id, start_at);

create table offers (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references slots(id),
  customer_id text references customers(id),
  guest_name text,                                        -- bring-a-friend guest
  group_id uuid,                                          -- links friend offers
  service_id text not null references services(id),
  wave int not null default 1,
  offer_type text not null check (offer_type in ('pay_now', 'friend', 'pass', 'bank_funded')),
  list_price int not null,
  price int not null,                                     -- what the customer pays
  funded_amount int not null default 0,                   -- paid by the funder
  merchant_net int not null,                              -- price + funded_amount
  funder text,
  status text not null default 'sent'
    check (status in ('draft', 'sent', 'link_sent', 'paid', 'cancelled', 'expired', 'declined')),
  razorpay_order_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index offers_slot on offers (slot_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id),
  razorpay_order_id text not null,
  razorpay_payment_id text unique,
  amount int not null,
  status text not null,                                   -- captured, refunded
  captured_at timestamptz
);

create table events (
  id uuid primary key default gen_random_uuid(),
  merchant_id text not null references merchants(id),
  type text not null,  -- plan_proposed, plan_edited, offer_sent, reply, paid, walk_in, footfall_alert, call_me, front_desk_booked, report, ...
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_merchant_created on events (merchant_id, created_at);

-- Synthetic network data: hourly in-store payment counts, aggregated by category.
create table area_signals (
  area_id text not null,
  category text not null,
  date date not null,
  hour smallint not null,
  payment_count int not null,
  normal_count int not null,     -- same weekday and hour baseline
  merchant_count int not null,   -- used only if >= 10
  primary key (area_id, category, date, hour)
);

create table network_benchmarks (
  city text not null,
  service text not null,
  day_part text not null,
  lead_time text not null,
  fill_rate numeric(3,2) not null,
  median_discount_that_filled int not null,
  discount_responsiveness numeric(3,2) not null,
  merchant_count int not null,
  primary key (city, service, day_part, lead_time)
);

create table funder_offers (
  id text primary key,
  funder text not null,
  card_issuer text not null,
  max_funded_amount int not null,
  min_ticket int not null,
  valid_from date not null,
  valid_to date not null,
  categories text[] not null
);

create table demo_state (
  merchant_id text primary key references merchants(id),
  demo_date date not null,
  clock_at timestamptz not null,             -- simulated "now"
  mode text not null default 'demo' check (mode in ('demo', 'live')),
  scripted boolean not null default false,   -- scripted switch for agent steps
  sim_step int not null default 0,
  plan jsonb,                                -- today's proposed/approved plan
  updated_at timestamptz not null default now()
);

-- Demo data is public and read-only to the browser; all writes go through
-- server routes using the service role key.
do $$
declare t text;
begin
  foreach t in array array['merchants','services','customers','bookings','slots','offers',
                           'payments','events','area_signals','network_benchmarks',
                           'funder_offers','demo_state']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

alter publication supabase_realtime add table slots, offers, bookings, events, demo_state, merchants;
