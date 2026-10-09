-- Stamp every event with the demo clock so the activity feed shows story time.
alter table events add column clock_at timestamptz;
create or replace function stamp_event_clock() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.clock_at is null then
    select clock_at into new.clock_at from demo_state where merchant_id = new.merchant_id;
  end if;
  return new;
end $$;
create trigger events_clock before insert on events for each row execute function stamp_event_clock();
