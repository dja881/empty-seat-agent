-- Customer Sneha Kulkarni renamed to Shreya Kulkarni, so she isn't confused with Sneha at the
-- front desk. The id stays c_sneha_k. Patches the already-deployed function and row.
do $$
declare src text;
begin
  src := pg_get_functiondef('reset_demo'::regproc);
  src := replace(src, '''Sneha Kulkarni''', '''Shreya Kulkarni''');
  execute src;
end $$;
update customers set name = 'Shreya Kulkarni' where id = 'c_sneha_k';
