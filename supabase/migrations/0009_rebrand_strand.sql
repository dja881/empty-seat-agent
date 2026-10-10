-- Demo merchant renamed from Glow Salon to Strand & Co. (scripts/gen-seed.mjs emits the new name;
-- this patches the already-deployed function and row).
do $$
declare src text;
begin
  src := pg_get_functiondef('reset_demo'::regproc);
  src := replace(src, '''Glow Salon''', '''Strand & Co.''');
  src := replace(src, '/glow-logo.svg', '/strand-mark.svg');
  execute src;
end $$;
update merchants set name = 'Strand & Co.', logo_url = '/strand-mark.svg' where id = 'glow';
