-- 운영에서 자동 실행 금지: 감사35 전의 공개 클라이언트 권한/RLS 상태로 돌아가므로 의도적 롤백에만 사용.
-- 백업 행에는 손대지 않는다. 후속 정책/권한 변경이 있으면 전체 중단.
DO $undo_backup_protection$
DECLARE backup_name text; backup_oid oid;
BEGIN
 PERFORM set_config('lock_timeout','3s',true);
 FOREACH backup_name IN ARRAY ARRAY['ops_guest_backfill_bak_20261028','ops_codex_audit18_bak_20261028'] LOOP
  SELECT c.oid INTO backup_oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname=backup_name AND c.relkind='r' AND pg_get_userbyid(c.relowner)='postgres';
  IF backup_oid IS NULL THEN RAISE EXCEPTION 'Missing/unexpected backup owner: %',backup_name; END IF;
  EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',backup_name);
  IF (SELECT relforcerowsecurity OR pg_get_userbyid(relowner)<>'postgres' FROM pg_class WHERE oid=backup_oid) THEN RAISE EXCEPTION 'Later owner/FORCE RLS state: %',backup_name; END IF;
  IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=backup_oid) OR
     EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=backup_oid AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL) THEN
   RAISE EXCEPTION 'Later policy/column privileges on %',backup_name;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=backup_oid) AND
     (SELECT bool_and(has_table_privilege(r,backup_oid,p)) FROM (VALUES ('anon'),('authenticated')) roles(r) CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) privs(p)) THEN CONTINUE; END IF;
  IF has_table_privilege('anon',backup_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege('authenticated',backup_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
   RAISE EXCEPTION 'Later client permissions on %',backup_name;
  END IF;
  EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated',backup_name);
  EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY',backup_name);
 END LOOP;
END
$undo_backup_protection$;
