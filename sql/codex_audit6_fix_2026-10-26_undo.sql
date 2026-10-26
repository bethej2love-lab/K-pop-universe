-- 감사6차 SQL이 실제 변경한 행만 복구. 관리자 역할로 파일 전체 실행.
-- 적용 이후 태그/제목/제외 상태가 바뀐 행이 있으면 전체 중단(후속 수정 덮어쓰기 방지).
-- 백업에 없던 기존 정정 행은 복구하지 않음. 반복 실행은 변경0.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $undo$
DECLARE
  b record; current_state jsonb; actual_state jsonb;
  desired public.yt_channel_videos%ROWTYPE; n_restored integer := 0;
BEGIN
  FOR b IN SELECT * FROM public.ops_codex_audit6_backup_20261026 WHERE undone_at IS NULL ORDER BY video_id FOR UPDATE LOOP
    SELECT to_jsonb(v) INTO current_state FROM public.yt_channel_videos v WHERE v.id=b.video_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Missing video; cannot restore: %',b.video_id; END IF;
    SELECT jsonb_object_agg(k,current_state->k) INTO actual_state FROM jsonb_object_keys(b.after_state) AS keys(k);
    IF actual_state IS DISTINCT FROM b.after_state THEN RAISE EXCEPTION 'Later edit detected; review before undo: %',b.video_id; END IF;
  END LOOP;
  FOR b IN SELECT * FROM public.ops_codex_audit6_backup_20261026 WHERE undone_at IS NULL ORDER BY video_id LOOP
    SELECT * INTO desired FROM jsonb_populate_record(NULL::public.yt_channel_videos,b.before_state);
    UPDATE public.yt_channel_videos SET tags_manual=false WHERE id=b.video_id;
    UPDATE public.yt_channel_videos SET
      group_ko = desired.group_ko,
      members = desired.members,
      with_members = desired.with_members,
      with_groups = desired.with_groups,
      cover_of_groups = desired.cover_of_groups,
      cover_of_members = desired.cover_of_members,
      cover_of_song = desired.cover_of_song,
      content_flag = desired.content_flag,
      flag_source = desired.flag_source,
      flagged_at = desired.flagged_at,
      tags_manual=false, cover_manual=desired.cover_manual
    WHERE id=b.video_id;
    UPDATE public.yt_channel_videos SET tags_manual=desired.tags_manual WHERE id=b.video_id;
    SELECT to_jsonb(v) INTO current_state FROM public.yt_channel_videos v WHERE v.id=b.video_id;
    SELECT jsonb_object_agg(k,current_state->k) INTO actual_state FROM jsonb_object_keys(b.before_state) AS keys(k);
    IF actual_state IS DISTINCT FROM b.before_state THEN RAISE EXCEPTION 'Undo verification failed: %',b.video_id; END IF;
    UPDATE public.ops_codex_audit6_backup_20261026 SET undone_at=transaction_timestamp() WHERE video_id=b.video_id;
    n_restored := n_restored+1;
  END LOOP;
  RAISE NOTICE 'Restored % rows',n_restored;
END
$undo$;
SELECT count(*) FILTER (WHERE undone_at IS NULL) AS not_restored,
       count(*) FILTER (WHERE undone_at IS NOT NULL) AS restored
FROM public.ops_codex_audit6_backup_20261026;
COMMIT;
