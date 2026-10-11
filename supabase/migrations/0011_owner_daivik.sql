-- Salon owner renamed from Priya to Daivik (scripts/gen-seed.mjs emits the new name;
-- this patches the already-deployed function and row).
do $$
declare src text;
begin
  src := pg_get_functiondef('reset_demo'::regproc);
  src := replace(src, '''Strand & Co.'', ''Priya''', '''Strand & Co.'', ''Daivik''');
  execute src;
end $$;
update merchants set owner_name = 'Daivik' where id = 'glow';
