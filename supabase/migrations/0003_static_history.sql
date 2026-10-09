-- Static synthetic data that Reset never touches:
--   90 days of Glow Salon bookings with walk-ins (for the walk-in forecast)
--   hourly in-store payment counts for ~52 merchants around the salon (area_signals)
--   network benchmarks and one bank-funded offer
-- Randomness is deterministic: h01(key) hashes a key to [0, 1).

create or replace function h01(k text) returns double precision
language sql immutable as $$
  select (('x' || substr(md5(k), 1, 8))::bit(32)::bigint & 2147483647) / 2147483648.0
$$;

-- ---------- 90 days of bookings ----------
-- Booked share by weekday and hour (Fri/Sat busiest, Mon quietest, afternoons soft).
with days as (
  select d::date as day, extract(isodow from d)::int as dow
  from generate_series(date '2026-10-13' - 90, date '2026-10-13' - 1, interval '1 day') d
),
grid as (
  select day, dow, chair, hr
  from days, generate_series(1, 6) chair, generate_series(10, 19) hr
),
booked as (
  select *,
    least(0.95,
      (case when hr < 13 then 0.70 when hr < 17 then 0.35 else 0.65 end)
      * (case dow when 5 then 1.45 when 6 then 1.5 when 7 then 1.2 when 1 then 0.8 else 1.0 end)
    ) as p
  from grid
),
customer_ids as (
  select array_agg(id order by id) ids from customers where merchant_id = 'glow' and not opted_out
)
insert into bookings (merchant_id, customer_id, service_id, chair, start_at, end_at, price, source)
select 'glow',
       ids[1 + floor(h01('c' || day || chair || hr) * array_length(ids, 1))::int],
       'svc_haircut', chair,
       (day + make_time(hr, 0, 0)) at time zone 'Asia/Kolkata',
       (day + make_time(hr, 45, 0)) at time zone 'Asia/Kolkata',
       450, 'crm'
from booked, customer_ids
where h01('b' || day || chair || hr) < p;

-- Walk-ins: expected count per hour, peaking at 4 pm, about double on weekends.
with days as (
  select d::date as day, extract(isodow from d)::int as dow
  from generate_series(date '2026-10-13' - 90, date '2026-10-13' - 1, interval '1 day') d
),
lambda as (
  select day, dow, hr,
    (array[0.5,0.6,0.8,1.0,1.1,1.4,2.6,1.9,1.4,0.7])[hr - 9]
      * (case dow when 6 then 1.8 when 7 then 1.8 when 5 then 1.3 when 1 then 0.8 else 1.0 end) as lam
  from days, generate_series(10, 19) hr
)
insert into bookings (merchant_id, customer_id, service_id, chair, start_at, end_at, price, source)
select 'glow', null,
       case when h01('s' || day || hr || k) < 0.7 then 'svc_haircut' else 'svc_beard' end,
       1 + floor(h01('ch' || day || hr || k) * 6)::int,
       (day + make_time(hr, (floor(h01('m' || day || hr || k) * 4) * 15)::int, 0)) at time zone 'Asia/Kolkata',
       (day + make_time(hr, (floor(h01('m' || day || hr || k) * 4) * 15)::int, 0)) at time zone 'Asia/Kolkata' + interval '45 minutes',
       450, 'walk_in'
from lambda, generate_series(1, 6) k
where h01('w' || day || hr || k) < lam / 6;

-- ---------- area_signals ----------
-- Per-merchant hourly payments by category, times merchant count, times weekday effect.
-- The demo day (Tue 13 Oct) runs about 20% below normal all day, with a ~30% dip at 1 pm;
-- nearby salons run about 25% below (market-wide slowness).
with cats(category, merchants, curve) as (values
  ('cafe',       14, array[6,9,8,6,5,7,8,7,6,5,5,6,5,3,2]::numeric[]),
  ('restaurant', 16, array[1,2,3,4,9,10,5,3,3,4,8,11,10,6,3]),
  ('retail',     12, array[0,1,2,4,5,6,6,6,7,7,8,8,7,4,1]),
  ('salon',      10, array[1,1.5,2,3,3,3,3,2,2,3,3,3,2,1,0]::numeric[])  -- early prepaid bookings and product sales from 8 am
),
days as (
  select d::date as day, extract(isodow from d)::int as dow
  from generate_series(date '2026-10-13' - 90, date '2026-10-13', interval '1 day') d
)
insert into area_signals (area_id, category, date, hour, payment_count, normal_count, merchant_count)
select 'hyd-madhapur', category, day, hr,
  round(
    merchants * curve[hr - 7]
    * (case dow when 5 then 1.25 when 6 then 1.45 when 7 then 1.35 when 1 then 0.85 else 1.0 end)
    * (0.9 + 0.2 * h01('a' || category || day || hr))
    * (case when day = date '2026-10-13' then
         case when category = 'salon' then 0.75
              when hr = 13 then 0.70
              else 0.80 end
       else 1.0 end)
  )::int,
  0, merchants
from cats, days, generate_series(8, 22) hr;

-- normal_count: mean of the previous 8 same-weekday readings for that hour.
update area_signals a set normal_count = coalesce(n.normal, a.payment_count)
from (
  select area_id, category, date, hour,
    round(avg(payment_count) over (
      partition by area_id, category, hour, extract(isodow from date)
      order by date rows between 8 preceding and 1 preceding))::int as normal
  from area_signals
) n
where a.area_id = n.area_id and a.category = n.category and a.date = n.date and a.hour = n.hour;

-- ---------- network benchmarks ----------
insert into network_benchmarks (city, service, day_part, lead_time, fill_rate, median_discount_that_filled, discount_responsiveness, merchant_count)
select 'Hyderabad', s.service, p.day_part, l.lead_time,
  round((s.base * p.f * l.f)::numeric, 2),
  s.disc, round((0.4 + 0.3 * h01(s.service || p.day_part || l.lead_time))::numeric, 2),
  24 + floor(h01('n' || s.service || p.day_part || l.lead_time) * 20)::int
from (values ('Haircut', 0.30, 70), ('Hair spa', 0.24, 180), ('Beard trim', 0.38, 40)) s(service, base, disc),
     (values ('morning', 0.9), ('afternoon', 1.0), ('evening', 1.2)) p(day_part, f),
     (values ('same_day', 1.0), ('next_day', 1.25)) l(lead_time, f);

-- ---------- bank-funded offer ----------
insert into funder_offers (id, funder, card_issuer, max_funded_amount, min_ticket, valid_from, valid_to, categories)
values ('hdfc_50', 'HDFC Bank', 'HDFC', 50, 300, '2026-10-01', '2026-10-31', array['salon', 'spa']);
