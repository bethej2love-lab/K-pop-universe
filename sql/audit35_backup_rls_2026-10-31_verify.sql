-- 읽기 전용. 두 행 모두 rls=true, policies=0, *_client_privilege=false.
SELECT c.relname,c.relrowsecurity AS rls,(SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS anon_client_privilege,
 has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS auth_client_privilege,
 has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS service_privilege
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND c.relname IN ('ops_guest_backfill_bak_20261028','ops_codex_audit18_bak_20261028') ORDER BY c.relname;
SELECT 'guest' AS backup,count(*),md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY id,to_jsonb(t)::text),'')) AS digest
 FROM public.ops_guest_backfill_bak_20261028 t
UNION ALL SELECT 'audit18',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY id,to_jsonb(t)::text),''))
 FROM public.ops_codex_audit18_bak_20261028 t;
