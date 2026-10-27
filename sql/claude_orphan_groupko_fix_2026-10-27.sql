-- 등록 안 된 group_ko(옛 그룹 키·유닛명·채널 주인 오입력)로 저장돼 카드에 안 뜨던 영상 정정 (2026-10-27, Claude Code 직접 실행)
-- 옛 키: 브브걸(브레이브걸스)→브브걸, 슈퍼노바(초신성)→슈퍼노바, JX(JYJ)/JX→동방신기(유닛은 행성 없음 — shared.js _PROJECT_UNITS),
-- 부석순→세븐틴(호시·도겸·승관), 송형준(크래비티 형준 개인 채널 donggeul_shj 주인 오입력)→크래비티/형준.
-- 되돌리기: claude_orphan_groupko_undo_2026-10-27.sql (백업 ops_claude_orphan_20261027)
CREATE TABLE IF NOT EXISTS ops_claude_orphan_20261027 AS SELECT now() AS backed_up_at, v.* FROM yt_channel_videos v WHERE false;
ALTER TABLE ops_claude_orphan_20261027 ENABLE ROW LEVEL SECURITY;
INSERT INTO ops_claude_orphan_20261027
  SELECT now(), v.* FROM yt_channel_videos v
  WHERE v.group_ko IN ('브브걸(브레이브걸스)','슈퍼노바(초신성)','JX(JYJ)','JX','부석순','송형준')
    AND NOT EXISTS (SELECT 1 FROM ops_claude_orphan_20261027 b WHERE b.id = v.id);

-- 수동잠금 행은 트리거가 members를 막으므로 group_ko만 바꾸는 건 잠금과 무관하게 적용(그룹 키 이름 정정일 뿐)
UPDATE yt_channel_videos SET group_ko = '브브걸' WHERE group_ko = '브브걸(브레이브걸스)';
UPDATE yt_channel_videos SET group_ko = '슈퍼노바' WHERE group_ko = '슈퍼노바(초신성)';
UPDATE yt_channel_videos SET group_ko = '동방신기' WHERE group_ko IN ('JX(JYJ)','JX');
UPDATE yt_channel_videos SET group_ko = '세븐틴',
  members = CASE WHEN members = '{}' OR members IS NULL THEN ARRAY['호시','도겸','승관'] ELSE members END
WHERE group_ko = '부석순';
UPDATE ext_channels SET owner_gko = '크래비티', owner_mko = '형준' WHERE handle = 'donggeul_shj' AND owner_gko = '송형준';
UPDATE yt_channel_videos SET group_ko = '크래비티',
  members = ARRAY(SELECT DISTINCT unnest(array_replace(members, '송형준', '형준') || ARRAY['형준']))
WHERE group_ko = '송형준';

SELECT (SELECT count(*) FROM ops_claude_orphan_20261027) backed_up,
  (SELECT count(*) FROM yt_channel_videos WHERE group_ko IN ('브브걸(브레이브걸스)','슈퍼노바(초신성)','JX(JYJ)','JX','부석순','송형준')) left_orphan,
  (SELECT owner_gko||'/'||owner_mko FROM ext_channels WHERE handle='donggeul_shj') shj_owner;
