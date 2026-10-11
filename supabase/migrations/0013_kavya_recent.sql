-- Kavya Iyer visited 20 days ago (was 70), so she isn't due and gets no offer today.
-- Patches the already-deployed function and row.
do $$
declare src text;
begin
  src := pg_get_functiondef('reset_demo'::regproc);
  src := replace(src, '''Kavya Iyer'',''+91 98480 12192'',2.4,(''2026-10-13 12:00+05:30''::timestamptz - interval ''70 days'')',
                      '''Kavya Iyer'',''+91 98480 12192'',2.4,(''2026-10-13 12:00+05:30''::timestamptz - interval ''20 days'')');
  execute src;
end $$;
update customers set last_visit_at = '2026-10-13 12:00+05:30'::timestamptz - interval '20 days' where id = 'c_kavya';
