-- Mirrors the change in scripts/gen-seed.mjs (Riya's past offer response 0.6 -> 0.75)
-- without re-sending the whole generated function. A fresh setup gets it from 0002 directly.
do $$
declare src text;
begin
  src := pg_get_functiondef('reset_demo'::regproc);
  src := replace(src, '''svc_haircut'',520,0.6,''HDFC''', '''svc_haircut'',520,0.75,''HDFC''');
  execute src;
end $$;
