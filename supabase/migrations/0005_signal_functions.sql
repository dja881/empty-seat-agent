-- Read-side helpers for the planner.

-- Average walk-ins per hour on the same weekday over the history window.
create or replace function walkin_profile(p_merchant text, p_date date)
returns table (hour int, avg_walkins numeric) language sql stable security definer set search_path = public as $$
  with days as (
    select count(distinct (start_at at time zone 'Asia/Kolkata')::date) n
    from bookings
    where merchant_id = p_merchant and start_at < (p_date::timestamp at time zone 'Asia/Kolkata')
      and extract(isodow from start_at at time zone 'Asia/Kolkata') = extract(isodow from p_date)
  )
  select extract(hour from start_at at time zone 'Asia/Kolkata')::int,
         round(count(*)::numeric / greatest((select n from days), 1), 2)
  from bookings
  where merchant_id = p_merchant and source = 'walk_in'
    and start_at < (p_date::timestamp at time zone 'Asia/Kolkata')
    and extract(isodow from start_at at time zone 'Asia/Kolkata') = extract(isodow from p_date)
  group by 1 order by 1;
$$;

-- Today's in-store payments vs the same-weekday baseline, for hours already seen.
-- Only categories pooling at least 10 merchants are used.
create or replace function footfall_vs_normal(p_area text, p_date date, p_upto_hour int)
returns table (scope text, ratio numeric, merchants int) language sql stable security definer set search_path = public as $$
  select 'nearby', round(sum(payment_count)::numeric / nullif(sum(normal_count), 0), 3), sum(distinct merchant_count)::int
  from area_signals
  where area_id = p_area and date = p_date and hour <= p_upto_hour and category <> 'salon' and merchant_count >= 10
  union all
  select 'salons', round(sum(payment_count)::numeric / nullif(sum(normal_count), 0), 3), max(merchant_count)
  from area_signals
  where area_id = p_area and date = p_date and hour <= p_upto_hour and category = 'salon' and merchant_count >= 10
  union all
  select 'last_hour', round(sum(payment_count)::numeric / nullif(sum(normal_count), 0), 3), sum(distinct merchant_count)::int
  from area_signals
  where area_id = p_area and date = p_date and hour = p_upto_hour and category <> 'salon' and merchant_count >= 10;
$$;

grant execute on function walkin_profile(text, date) to anon, authenticated, service_role;
grant execute on function footfall_vs_normal(text, date, int) to anon, authenticated, service_role;
