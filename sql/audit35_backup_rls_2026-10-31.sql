-- 감사35: 관리자 SQL 복구용 백업 두 개만 보호. 앱 원본/운영 영상/백업 내용 변경 없음.
-- RLS만으로 TRUNCATE를 차단할 수 없으므로 클라이언트 테이블 권한도 회수한다.
-- postgres/기존 service_role 권한은 유지. 예상 밖 소유자/정책/컬럼 권한이면 전체 중단.
DO $protect_backups$
DECLARE
 backup_name text; backup_oid oid; prior_digest text; after_digest text;
BEGIN
 PERFORM set_config('lock_timeout','3s',true);
 PERFORM set_config('statement_timeout','15s',true);
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls) THEN
  RAISE EXCEPTION 'Expected service_role BYPASSRLS; review restoration access';
 END IF;
 FOREACH backup_name IN ARRAY ARRAY['ops_guest_backfill_bak_20261028','ops_codex_audit18_bak_20261028'] LOOP
  SELECT c.oid INTO backup_oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname=backup_name AND c.relkind='r' AND pg_get_userbyid(c.relowner)='postgres';
  IF backup_oid IS NULL THEN RAISE EXCEPTION 'Missing/unexpected backup owner: %',backup_name; END IF;
  EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',backup_name);
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=backup_oid)<>'postgres' THEN RAISE EXCEPTION 'Backup owner changed: %',backup_name; END IF;
  IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=backup_oid) OR
     EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=backup_oid AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL) THEN
   RAISE EXCEPTION 'Custom policy/column privilege on %, review before protection',backup_name;
  END IF;
  EXECUTE format($q$SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY id,to_jsonb(t)::text),'')) FROM public.%I t$q$,backup_name) INTO prior_digest;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',backup_name);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',backup_name);
  EXECUTE format($q$SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY id,to_jsonb(t)::text),'')) FROM public.%I t$q$,backup_name) INTO after_digest;
  IF prior_digest IS DISTINCT FROM after_digest THEN RAISE EXCEPTION 'Backup data changed: %',backup_name; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=backup_oid) OR
     has_table_privilege('anon',backup_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     has_table_privilege('authenticated',backup_oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
   RAISE EXCEPTION 'Client privileges remain on %',backup_name;
  END IF;
 END LOOP;
END
$protect_backups$;
