-- 채널 주인 입력 오타로 없는 그룹에 저장된 영상 정정 (2026-10-27, Claude Code 직접 실행)
-- ① 효연 개인 채널 Hyo_LevelUp 주인이 '호연'으로 입력 → 영상 57건 group_ko='호연'(없는 그룹)
-- ② 세븐틴 우지 팬채널 vobo_woozi 영상 135건 group_ko='우지ㅇ'(예전 입력 오타 흔적, 채널 등록은 이미 세븐틴/우지)
-- ③ A.C.E 서브채널 e1az7C6XmME 'NewJeans - GODS (Covered by A.C.E)'가 뉴진스로 저장 → 에이스 + 뉴진스 원곡
-- 되돌리기: claude_owner_typo_undo_2026-10-27.sql (백업 ops_claude_owner_20261027)
CREATE TABLE IF NOT EXISTS ops_claude_owner_20261027 AS SELECT now() AS backed_up_at, v.* FROM yt_channel_videos v WHERE false;
ALTER TABLE ops_claude_owner_20261027 ENABLE ROW LEVEL SECURITY;
INSERT INTO ops_claude_owner_20261027
  SELECT now(), v.* FROM yt_channel_videos v
  WHERE (v.group_ko IN ('호연','우지ㅇ') OR v.id = 'e1az7C6XmME')
    AND NOT EXISTS (SELECT 1 FROM ops_claude_owner_20261027 b WHERE b.id = v.id);

UPDATE ext_channels SET owner_gko = '소녀시대', owner_mko = '효연' WHERE handle = 'Hyo_LevelUp' AND owner_gko = '호연';

UPDATE yt_channel_videos SET group_ko = '소녀시대',
  members = ARRAY(SELECT DISTINCT unnest(array_replace(members, '호연', '효연') || ARRAY['효연']))
WHERE group_ko = '호연' AND tags_manual = false;

UPDATE yt_channel_videos SET group_ko = '세븐틴',
  members = CASE WHEN members = '{}' OR members IS NULL THEN ARRAY['우지'] ELSE array_replace(members, '우지ㅇ', '우지') END
WHERE group_ko = '우지ㅇ' AND tags_manual = false;

UPDATE yt_channel_videos SET group_ko = '에이스', members = '{}', with_groups = '{}', with_members = '{}',
  cover_of_groups = ARRAY['뉴진스'], cover_of_song = COALESCE(cover_of_song, 'GODS'), tags_manual = true, cover_manual = true
WHERE id = 'e1az7C6XmME' AND tags_manual = false;

SELECT (SELECT count(*) FROM ops_claude_owner_20261027) backed_up,
  (SELECT count(*) FROM yt_channel_videos WHERE group_ko IN ('호연','우지ㅇ')) left_typo,
  (SELECT owner_gko||'/'||owner_mko FROM ext_channels WHERE handle='Hyo_LevelUp') hyo_owner,
  (SELECT group_ko FROM yt_channel_videos WHERE id='e1az7C6XmME') ace;
