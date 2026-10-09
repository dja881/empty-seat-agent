-- Supabase's API rejects DELETE without WHERE (pg_safeupdate), even inside functions.
-- scripts/gen-seed.mjs now emits the WHERE clauses; this patches the deployed function.
do $$
declare src text;
begin
  src := pg_get_functiondef('reset_demo'::regproc);
  src := replace(src, 'delete from payments;', 'delete from payments where true;');
  src := replace(src, 'delete from offers;', 'delete from offers where true;');
  execute src;
end $$;
