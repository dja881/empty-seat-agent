// Generates supabase/migrations/0002_reset_demo.sql: the reset_demo() function that
// restores Glow Salon's seeded day (merchant, services, customers, today's and
// tomorrow's calendar, free slots, demo clock). Deterministic: same output every run.
//
//   node scripts/gen-seed.mjs

import { writeFileSync } from "node:fs";

const DEMO_DATE = "2026-10-13"; // a Tuesday
const TOMORROW = "2026-10-14";
const M = "glow";

// ---------- deterministic PRNG ----------
let seed = 20261013;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

// ---------- services ----------
const services = [
  { id: "svc_haircut", name: "Haircut", duration: 45, price: 450, floor: 350, discountable: true },
  { id: "svc_spa", name: "Hair spa", duration: 60, price: 1200, floor: 950, discountable: true },
  { id: "svc_beard", name: "Beard trim", duration: 20, price: 200, floor: 150, discountable: true },
  { id: "svc_colour", name: "Colour", duration: 90, price: 2500, floor: null, discountable: false },
];
const byDuration = Object.fromEntries(services.map((s) => [s.duration, s]));

// ---------- customers ----------
// [id, name, type, distance_km, days_since_visit, gap, band, service, spend, response, issuer]
// type: target (due, nearby, occasional), regular, vip, opted_out, far, lapsed, recent
const C = [
  // Due occasional customers: the agent's real audience
  ["c_riya", "Riya Reddy", "target", 1.2, 42, 35, "afternoon", "svc_haircut", 520, 0.75, "HDFC"],
  ["c_aditya", "Aditya Rao", "target", 0.8, 38, 30, "afternoon", "svc_haircut", 480, 0.5, "ICICI"],
  ["c_sneha_k", "Sneha Kulkarni", "target", 2.1, 50, 42, "afternoon", "svc_spa", 1250, 0.45, "HDFC"],
  ["c_imran", "Imran Shaikh", "target", 1.5, 27, 21, "afternoon", "svc_beard", 260, 0.55, null],
  ["c_pooja", "Pooja Menon", "target", 3.0, 47, 40, "afternoon", "svc_haircut", 470, 0.4, "SBI"],
  ["c_karthik", "Karthik Varma", "target", 1.9, 33, 28, "afternoon", "svc_haircut", 450, 0.35, "HDFC"],
  ["c_nisha", "Nisha Agarwal", "target", 2.6, 64, 56, "afternoon", "svc_spa", 1180, 0.5, "Axis"],
  ["c_rahul", "Rahul Desai", "target", 0.6, 30, 25, "evening", "svc_haircut", 450, 0.3, "Kotak"],
  ["c_divya", "Divya Nair", "target", 3.8, 45, 35, "afternoon", "svc_haircut", 500, 0.45, "HDFC"],
  ["c_sameer", "Sameer Khan", "target", 1.1, 24, 21, "afternoon", "svc_beard", 220, 0.4, "ICICI"],
  ["c_ananya", "Ananya Bose", "target", 4.4, 52, 45, "afternoon", "svc_spa", 1300, 0.35, null],
  ["c_vikram", "Vikram Singh", "target", 2.3, 36, 30, "morning", "svc_haircut", 450, 0.3, "SBI"],
  ["c_meera", "Meera Joshi", "target", 5.2, 41, 35, "afternoon", "svc_haircut", 480, 0.25, "HDFC"],
  ["c_arun", "Arun Pillai", "target", 1.7, 29, 24, "evening", "svc_beard", 200, 0.2, null],
  ["c_tanvi", "Tanvi Shah", "target", 6.1, 49, 42, "afternoon", "svc_haircut", 460, 0.3, "Axis"],
  ["c_harsh", "Harsh Gupta", "target", 2.8, 34, 28, "morning", "svc_haircut", 450, 0.15, "ICICI"],
  // Lapsed: due long ago, lower response
  ["c_kavya", "Kavya Iyer", "lapsed", 2.4, 70, 30, "afternoon", "svc_haircut", 450, 0.2, "HDFC"],
  ["c_rohit", "Rohit Malhotra", "lapsed", 3.3, 95, 35, "afternoon", "svc_haircut", 450, 0.1, "SBI"],
  ["c_shalini", "Shalini Rao", "lapsed", 4.0, 120, 45, "afternoon", "svc_spa", 1200, 0.1, null],
  ["c_naveen", "Naveen Kumar", "lapsed", 1.4, 88, 30, "evening", "svc_haircut", 450, 0.15, "Kotak"],
  ["c_preeti", "Preeti Saxena", "lapsed", 2.9, 140, 50, "afternoon", "svc_haircut", 470, 0.05, "HDFC"],
  ["c_sanjay", "Sanjay Patil", "lapsed", 5.5, 110, 40, "morning", "svc_beard", 200, 0.1, null],
  ["c_lavanya", "Lavanya Krishnan", "lapsed", 3.6, 100, 42, "afternoon", "svc_spa", 1150, 0.1, "ICICI"],
  ["c_deepak", "Deepak Choudhary", "lapsed", 2.2, 92, 28, "evening", "svc_haircut", 450, 0.1, "Axis"],
  // Regulars: book at full price anyway, never discounted
  ["c_priyanka", "Priyanka Das", "regular", 1.0, 18, 21, "morning", "svc_haircut", 450, 0.0, "HDFC"],
  ["c_manoj", "Manoj Tiwari", "regular", 0.9, 22, 21, "evening", "svc_beard", 200, 0.0, null],
  ["c_swati", "Swati Bhat", "regular", 1.6, 25, 28, "morning", "svc_spa", 1200, 0.0, "ICICI"],
  ["c_gautam", "Gautam Sen", "regular", 2.0, 20, 21, "evening", "svc_haircut", 450, 0.0, "SBI"],
  ["c_ritu", "Ritu Arora", "regular", 1.3, 30, 28, "morning", "svc_haircut", 480, 0.05, "HDFC"],
  ["c_nikhil", "Nikhil Jain", "regular", 0.7, 14, 14, "evening", "svc_beard", 200, 0.0, "Kotak"],
  ["c_bhavana", "Bhavana Reddy", "regular", 2.5, 26, 28, "morning", "svc_spa", 1250, 0.0, "Axis"],
  ["c_suresh", "Suresh Naidu", "regular", 1.8, 21, 21, "evening", "svc_haircut", 450, 0.0, null],
  ["c_aparna", "Aparna Ghosh", "regular", 3.1, 29, 30, "morning", "svc_haircut", 460, 0.0, "HDFC"],
  ["c_varun", "Varun Kapoor", "regular", 1.2, 16, 14, "evening", "svc_beard", 220, 0.0, "ICICI"],
  ["c_keerthi", "Keerthi Prasad", "regular", 2.7, 24, 28, "morning", "svc_haircut", 450, 0.0, "SBI"],
  ["c_farah", "Farah Siddiqui", "regular", 1.9, 31, 35, "evening", "svc_spa", 1200, 0.05, null],
  ["c_ajay", "Ajay Yadav", "regular", 0.5, 12, 14, "morning", "svc_beard", 200, 0.0, "Axis"],
  ["c_madhu", "Madhuri Rao", "regular", 2.2, 27, 28, "evening", "svc_haircut", 450, 0.0, "HDFC"],
  // VIPs: never discounted
  ["c_anjali_v", "Anjali Verma", "vip", 1.5, 20, 21, "morning", "svc_colour", 3200, 0.0, "HDFC"],
  ["c_raj", "Raj Malhotra", "vip", 2.8, 15, 14, "evening", "svc_spa", 2400, 0.0, "ICICI"],
  ["c_sunita", "Sunita Reddy", "vip", 3.4, 25, 28, "morning", "svc_colour", 2900, 0.0, "Kotak"],
  // Opted out of offers
  ["c_rakesh", "Rakesh Sharma", "opted_out", 1.1, 40, 30, "afternoon", "svc_haircut", 450, 0.0, "SBI"],
  ["c_neha", "Neha Chopra", "opted_out", 2.0, 45, 35, "afternoon", "svc_spa", 1200, 0.0, "HDFC"],
  ["c_abhishek", "Abhishek Roy", "opted_out", 0.9, 33, 28, "afternoon", "svc_beard", 200, 0.0, null],
  // Far away: rarely make a same-day trip
  ["c_sowmya", "Sowmya Iyer", "far", 12.5, 44, 35, "afternoon", "svc_haircut", 450, 0.2, "HDFC"],
  ["c_prakash", "Prakash Reddy", "far", 9.8, 39, 30, "afternoon", "svc_haircut", 450, 0.15, "ICICI"],
  ["c_jyothi", "Jyothi Rani", "far", 14.2, 60, 45, "afternoon", "svc_spa", 1200, 0.1, null],
  ["c_kiran", "Kiran Babu", "far", 11.0, 35, 28, "evening", "svc_beard", 200, 0.1, "SBI"],
  ["c_mohan", "Mohan Lal", "far", 15.0, 50, 40, "afternoon", "svc_haircut", 450, 0.05, "Axis"],
  ["c_geeta", "Geeta Murthy", "far", 8.7, 48, 42, "afternoon", "svc_haircut", 470, 0.2, "HDFC"],
  // Visited recently: not due yet
  ["c_arjun_m", "Arjun Mehta", "recent", 1.4, 6, 28, "afternoon", "svc_haircut", 450, 0.4, "HDFC"],
  ["c_simran", "Simran Kaur", "recent", 2.2, 9, 35, "afternoon", "svc_spa", 1200, 0.35, "ICICI"],
  ["c_vivek", "Vivek Anand", "recent", 0.8, 4, 21, "evening", "svc_beard", 200, 0.3, null],
  ["c_shreya", "Shreya Ghoshal", "recent", 3.5, 11, 42, "afternoon", "svc_haircut", 480, 0.3, "SBI"],
  ["c_amit", "Amit Trivedi", "recent", 1.6, 8, 30, "afternoon", "svc_haircut", 450, 0.25, "Kotak"],
  ["c_lakshmi_p", "Lakshmi Priya", "recent", 2.9, 13, 45, "afternoon", "svc_spa", 1150, 0.3, "HDFC"],
  ["c_yash", "Yash Bhatia", "recent", 1.0, 5, 21, "evening", "svc_beard", 200, 0.2, "Axis"],
  ["c_isha", "Isha Kapoor", "recent", 4.1, 10, 35, "afternoon", "svc_haircut", 460, 0.3, null],
  ["c_rohan", "Rohan Verghese", "recent", 2.4, 7, 28, "morning", "svc_haircut", 450, 0.2, "ICICI"],
  ["c_pallavi", "Pallavi Sinha", "recent", 3.0, 12, 30, "afternoon", "svc_haircut", 450, 0.25, "HDFC"],
];
if (C.length !== 60) throw new Error(`expected 60 customers, got ${C.length}`);

const vipIds = C.filter((c) => c[2] === "vip").map((c) => c[0]);

// ---------- today's calendar ----------
// Free blocks per chair (the empty time). Everything else between 10:00 and 20:00 is booked.
// Designed for: ~26.5 free chair-hours, 32 slot units, ~55% full, most free time 1-5 pm,
// two chairs free at 4 pm (Riya and her sister), a 5 pm block on chair 6 to hold for walk-ins.
const FREE_TODAY = {
  1: [["13:00", "17:00"], ["19:15", "20:00"]],
  2: [["11:00", "11:30"], ["12:45", "16:30"]],
  3: [["10:00", "10:45"], ["13:30", "17:30"]],
  4: [["11:15", "11:45"], ["14:00", "17:00"], ["18:30", "19:15"]],
  5: [["12:30", "17:00"]],
  6: [["10:00", "10:30"], ["14:30", "18:00"]],
};
// Tomorrow (Wednesday): busier mornings, an open 3:30 pm haircut slot for Kavya's assistant.
const FREE_TOMORROW = {
  1: [["14:00", "16:00"]],
  2: [["15:30", "17:00"]],
  3: [["13:00", "14:30"]],
  4: [["16:00", "17:30"]],
  5: [["12:00", "13:00"]],
  6: [["14:30", "15:30"]],
};

const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function bookedWindows(free) {
  const out = []; let cur = toMin("10:00");
  for (const [s, e] of free) { if (toMin(s) > cur) out.push([cur, toMin(s)]); cur = toMin(e); }
  if (cur < toMin("20:00")) out.push([cur, toMin("20:00")]);
  return out;
}

// Exact-ish fill of a booked window with service durations. Any leftover (<20 min) is put
// after the first booking so it never touches a free block.
// Weighted random draws (a realistic mix: mostly haircuts), retried until the window
// fills with under 20 minutes left over.
const WEIGHTED = [45, 45, 45, 45, 45, 60, 60, 60, 90, 20];
function fillWindow(len) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const items = []; let rem = len;
    while (rem >= 20) {
      const fits = WEIGHTED.filter((d) => d <= rem);
      const d = fits[Math.floor(rand() * fits.length)];
      items.push(d); rem -= d;
    }
    if (rem === 0 || (rem < 20 && items.length >= 2)) return { items, gap: rem };
  }
  throw new Error(`cannot fill ${len}`);
}

// Pre-booked customers: regulars, VIPs, recent visitors and far-away customers, no one twice
// in a day. Overflow goes to phone bookings not yet in the CRM (guest names).
const bookingPool = C.filter((c) => ["regular", "vip", "recent", "far"].includes(c[2])).map((c) => c[0]);
const GUESTS = ["Sana Mirza", "Kunal Bajaj", "Ishaan Reddy", "Neelima Rao", "Tarun Goud", "Fatima Begum",
  "Chaitanya K", "Revathi S", "Pavan Kalyan", "Hema Latha", "Siddharth M", "Uma Devi", "Zoya Ali", "Bharat Kumar",
  "Aisha Khan", "Venkat Rao", "Divya Teja", "Rajesh Goud", "Swapna Reddy", "Manish Agarwal", "Sravani P",
  "Harini V", "Nitin Jain", "Asha Kiran", "Vamsi Krishna", "Lalitha Devi", "Sunil Varma", "Meghana R"];

function calendar(date, freeMap) {
  const rows = [];
  const pool = [...bookingPool].sort(() => rand() - 0.5);
  const guests = [...GUESTS];
  for (const chair of Object.keys(freeMap).map(Number)) {
    for (const [ws, we] of bookedWindows(freeMap[chair])) {
      const { items, gap } = fillWindow(we - ws);
      let t = ws;
      items.forEach((d, i) => {
        const svc = byDuration[d];
        const customer = pool.shift() ?? null;
        rows.push({ chair, start: toTime(t), end: toTime(t + d), svc: svc.id, price: svc.price,
          customer, guest: customer ? null : guests.shift() ?? "Phone booking" });
        t += d;
        if (i === 0) t += gap;
      });
    }
  }
  return rows;
}

const today = calendar(DEMO_DATE, FREE_TODAY);
const tomorrow = calendar(TOMORROW, FREE_TOMORROW);

// ---------- stats (printed, so the design can be checked) ----------
const unitsFor = (min) => (min < 20 ? 0 : min < 40 ? 1 : Math.floor((min + 10) / 50));
let freeMin = 0, units = 0;
for (const blocks of Object.values(FREE_TODAY)) for (const [s, e] of blocks) { freeMin += toMin(e) - toMin(s); units += unitsFor(toMin(e) - toMin(s)); }
console.log(`today: ${today.length} bookings, free ${freeMin} min (${(freeMin / 60).toFixed(1)} h), ${units} slot units, ${(100 - (freeMin / 3600) * 100).toFixed(1)}% full`);

// ---------- SQL ----------
const q = (v) => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const daysAgo = (n) => `('${DEMO_DATE} 12:00+05:30'::timestamptz - interval '${n} days')`;

const customerValues = C.map(([id, name, type, dist, ago, gap, band, svc, spend, resp, issuer], i) =>
  `(${q(id)},'${M}',${q(name)},'+91 98480 ${String(10000 + i * 137).slice(-5)}',${dist},${daysAgo(ago)},${gap},${q(band)},${q(svc)},${spend},${resp},${q(issuer)},${type === "regular" || type === "vip"},${type === "opted_out"})`
).join(",\n    ");

const bookingValues = (date, rows) => rows.map((r) =>
  `('${M}',${q(r.customer)},${q(r.guest)},${q(r.svc)},${r.chair},'${date} ${r.start}+05:30','${date} ${r.end}+05:30',${r.price},'crm')`
).join(",\n    ");

const sql = `-- GENERATED by scripts/gen-seed.mjs. Do not edit by hand.
-- reset_demo(): restores Glow Salon's seeded day. Called by the Reset demo button.
-- Static history (90 days of bookings, area_signals, benchmarks, funder offers) is in 0003.

create or replace function rebuild_slots(p_merchant text, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare
  open_at timestamptz;
  close_at timestamptz;
begin
  select (p_date + m.opens_at) at time zone 'Asia/Kolkata', (p_date + m.closes_at) at time zone 'Asia/Kolkata'
    into open_at, close_at from merchants m where m.id = p_merchant;

  delete from slots where merchant_id = p_merchant
    and start_at >= open_at and start_at < close_at;

  -- Gaps between bookings on each chair, including before the first and after the last.
  insert into slots (merchant_id, chair, start_at, end_at, state)
  select p_merchant, chair, gap_start, gap_end, 'free'
  from (
    select c.chair,
           coalesce(lag(b.end_at) over w, open_at) as gap_start,
           b.start_at as gap_end
    from generate_series(1, 6) as c(chair)
    left join lateral (
      select start_at, end_at from bookings
      where merchant_id = p_merchant and chair = c.chair and start_at >= open_at and start_at < close_at
      union all select close_at, close_at
    ) b on true
    window w as (partition by c.chair order by b.start_at)
  ) g
  where gap_end - gap_start >= interval '20 minutes';
end $$;

create or replace function reset_demo()
returns void language plpgsql security definer set search_path = public as $$
declare
  d date := '${DEMO_DATE}';
begin
  delete from payments;
  delete from offers;
  delete from events where merchant_id = '${M}';
  delete from slots where merchant_id = '${M}';
  delete from demo_state where merchant_id = '${M}';
  delete from bookings where merchant_id = '${M}' and start_at >= (d::timestamp at time zone 'Asia/Kolkata');

  insert into merchants (id, name, owner_name, city, area_id, stylists, opens_at, closes_at, max_discount,
    allowed_offers, never_discount_services, vip_customer_ids, daily_message_cap, quiet_hours_start,
    quiet_hours_end, approval_mode, front_desk_name, front_desk_phone, logo_url)
  values ('${M}', 'Glow Salon', 'Priya', 'Hyderabad', 'hyd-madhapur',
    array['Anjali','Ravi','Meena','Farhan','Lakshmi','Arjun'], '10:00', '20:00', 200,
    array['pay_now','friend','pass'], array['svc_colour'], array[${vipIds.map(q).join(",")}], 60, '21:00', '09:00',
    'ask_first', 'Sneha', '+91 98480 55555', '/glow-logo.svg')
  on conflict (id) do update set name = excluded.name, owner_name = excluded.owner_name, city = excluded.city,
    area_id = excluded.area_id, stylists = excluded.stylists, opens_at = excluded.opens_at,
    closes_at = excluded.closes_at, max_discount = excluded.max_discount, allowed_offers = excluded.allowed_offers,
    never_discount_services = excluded.never_discount_services, vip_customer_ids = excluded.vip_customer_ids,
    daily_message_cap = excluded.daily_message_cap, quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end, approval_mode = excluded.approval_mode,
    front_desk_name = excluded.front_desk_name, front_desk_phone = excluded.front_desk_phone,
    logo_url = excluded.logo_url;

  insert into services (id, merchant_id, name, duration_min, price, floor_price, discountable) values
    ${services.map((s) => `(${q(s.id)},'${M}',${q(s.name)},${s.duration},${s.price},${q(s.floor)},${s.discountable})`).join(",\n    ")}
  on conflict (id) do update set name = excluded.name, duration_min = excluded.duration_min, price = excluded.price,
    floor_price = excluded.floor_price, discountable = excluded.discountable;

  insert into customers (id, merchant_id, name, phone, distance_km, last_visit_at, usual_gap_days, usual_time_band,
    usual_service_id, avg_spend, past_offer_response, card_issuer, is_regular, opted_out) values
    ${customerValues}
  on conflict (id) do update set name = excluded.name, phone = excluded.phone, distance_km = excluded.distance_km,
    last_visit_at = excluded.last_visit_at, usual_gap_days = excluded.usual_gap_days,
    usual_time_band = excluded.usual_time_band, usual_service_id = excluded.usual_service_id,
    avg_spend = excluded.avg_spend, past_offer_response = excluded.past_offer_response,
    card_issuer = excluded.card_issuer, is_regular = excluded.is_regular, opted_out = excluded.opted_out;

  insert into bookings (merchant_id, customer_id, guest_name, service_id, chair, start_at, end_at, price, source) values
    ${bookingValues(DEMO_DATE, today)},
    ${bookingValues(TOMORROW, tomorrow)};

  perform rebuild_slots('${M}', d);
  perform rebuild_slots('${M}', d + 1);

  insert into demo_state (merchant_id, demo_date, clock_at, mode, scripted, sim_step, plan)
  values ('${M}', d, (d + time '09:00') at time zone 'Asia/Kolkata', 'demo', false, 0, null);
end $$;

revoke all on function reset_demo() from public;
revoke all on function rebuild_slots(text, date) from public;
grant execute on function reset_demo() to anon, authenticated, service_role;
grant execute on function rebuild_slots(text, date) to service_role;

select reset_demo();
`;

writeFileSync(new URL("../supabase/migrations/0002_reset_demo.sql", import.meta.url), sql);
console.log("wrote supabase/migrations/0002_reset_demo.sql");
