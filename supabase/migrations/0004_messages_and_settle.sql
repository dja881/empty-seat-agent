-- Chat thread, offer timing, and payment settlement.

-- The WhatsApp-style thread between the salon (agent or front desk) and a customer.
create table messages (
  id uuid primary key default gen_random_uuid(),
  merchant_id text not null references merchants(id),
  customer_id text not null references customers(id),
  sender text not null check (sender in ('salon', 'customer', 'front_desk', 'system')),
  body text not null,
  payload jsonb not null default '{}',   -- links: [{offer_id, label}], call button, etc.
  created_at timestamptz not null default now()
);
create index messages_thread on messages (customer_id, created_at);
alter table messages enable row level security;
create policy "public read" on messages for select to anon, authenticated using (true);
alter publication supabase_realtime add table messages, payments;

-- An offer is for a specific time on a specific chair, inside a free block.
alter table offers add column chair smallint;
alter table offers add column start_at timestamptz;
alter table offers add column end_at timestamptz;
alter table offers add column price_steps int not null default 0;

-- Unsold blocks show as "offered" while any open offer overlaps them, else "released".
create or replace function refresh_offered(p_merchant text)
returns void language sql security definer set search_path = public as $$
  update slots s set state = case when exists (
      select 1 from offers o
      where o.chair = s.chair and o.status in ('sent', 'link_sent')
        and o.start_at < s.end_at and o.end_at > s.start_at
    ) then 'offered' else 'released' end
  where s.merchant_id = p_merchant and s.state in ('released', 'offered');
$$;

-- First confirmed payment wins. Locks the free block, carves the paid time out of it,
-- cancels every other open offer that overlaps, and books the customer.
-- Returns 'paid', 'taken' (slot gone: caller refunds) or 'duplicate'.
create or replace function settle_offer(
  p_offer uuid, p_order text, p_payment text, p_amount int, p_funded int, p_simulated boolean
) returns text language plpgsql security definer set search_path = public as $$
declare
  o offers%rowtype;
  s slots%rowtype;
  who text;
begin
  if p_payment is not null and exists (select 1 from payments where razorpay_payment_id = p_payment) then
    return 'duplicate';
  end if;

  select * into o from offers where id = p_offer for update;
  if not found then return 'taken'; end if;
  if o.status = 'paid' then return 'duplicate'; end if;

  select * into s from slots
  where merchant_id = (select merchant_id from slots where id = o.slot_id)
    and chair = o.chair and start_at <= o.start_at and end_at >= o.end_at
    and state in ('free', 'held', 'released', 'offered')
  order by start_at limit 1
  for update;

  if not found then
    insert into payments (offer_id, razorpay_order_id, razorpay_payment_id, amount, status, captured_at)
    values (o.id, coalesce(p_order, 'sim'), p_payment, p_amount, 'refund_pending', now());
    update offers set status = 'cancelled' where id = o.id;
    return 'taken';
  end if;

  who := coalesce(o.guest_name, (select name from customers where id = o.customer_id));

  -- carve: keep the open time before and after the paid booking
  if o.start_at - s.start_at >= interval '20 minutes' then
    insert into slots (merchant_id, chair, start_at, end_at, state, walk_in_prob, fill_anyway_prob)
    values (s.merchant_id, s.chair, s.start_at, o.start_at, s.state, s.walk_in_prob, s.fill_anyway_prob);
  end if;
  if s.end_at - o.end_at >= interval '20 minutes' then
    insert into slots (merchant_id, chair, start_at, end_at, state, walk_in_prob, fill_anyway_prob)
    values (s.merchant_id, s.chair, o.end_at, s.end_at, s.state, s.walk_in_prob, s.fill_anyway_prob);
  end if;
  -- sold_price is what the salon receives: customer payment plus any bank-funded amount
  update slots set start_at = o.start_at, end_at = o.end_at, state = 'paid',
    sold_to = who, sold_price = p_amount + p_funded
  where id = s.id;

  insert into payments (offer_id, razorpay_order_id, razorpay_payment_id, amount, status, captured_at)
  values (o.id, coalesce(p_order, 'sim_' || o.id), coalesce(p_payment, 'sim_' || o.id),
          p_amount, case when p_simulated then 'simulated' else 'captured' end, now());

  update offers set status = 'paid', funded_amount = p_funded, merchant_net = p_amount + p_funded,
    funder = case when p_funded > 0 then funder else null end
  where id = o.id;

  update offers set status = 'cancelled'
  where id <> o.id and chair = o.chair and status in ('sent', 'link_sent')
    and start_at < o.end_at and end_at > o.start_at;

  insert into bookings (merchant_id, customer_id, guest_name, service_id, chair, start_at, end_at, price, source)
  values (s.merchant_id, o.customer_id, o.guest_name, o.service_id, o.chair, o.start_at, o.end_at,
          p_amount + p_funded, 'agent');

  insert into events (merchant_id, type, payload)
  values (s.merchant_id, 'paid', jsonb_build_object(
    'offer_id', o.id, 'customer', who, 'amount', p_amount, 'funded', p_funded,
    'chair', o.chair, 'start_at', o.start_at, 'simulated', p_simulated));

  perform refresh_offered(s.merchant_id);
  return 'paid';
end $$;

revoke all on function settle_offer(uuid, text, text, int, int, boolean) from public;
revoke all on function refresh_offered(text) from public;
grant execute on function settle_offer(uuid, text, text, int, int, boolean) to service_role;
grant execute on function refresh_offered(text) to service_role;

-- Reset also clears the chat.
create or replace function reset_demo_all() returns void language plpgsql security definer set search_path = public as $$
begin
  delete from messages where merchant_id = 'glow';
  perform reset_demo();
end $$;
grant execute on function reset_demo_all() to anon, authenticated, service_role;
