-- Codex 콘텐츠 감사 10·11차 확정분 + 같은 유형 확장(윤지성 20·트렌드지 카멜레온 42) 정정 (2026-10-27, Claude Code 직접 실행)
-- 원칙(10-26 감사345와 동일): 출연자가 유니버스에 없으면 무관, 있으면 실제 출연자·원곡으로 재배정 후 tags_manual=true.
-- 제외: 수동잠금(6F8rhnuhLjg,-64vS7m-qUc,q6YptOGuAps,RhQhmyVKHd4,-l5rrycEzwE)·보류/미확정(acGjVx1xoGY,KtZJR1wD8mc,fdDwNU7cvHU,L0YXTMcM5iE,VrDK49b7o38,DVOzjxtYTPk,2_6LHOtns2g,rzHoN3LiNNE,bHQTUk7xgGw)
-- 되돌리기: sql/claude_audit10_11_undo_2026-10-27.sql (백업 표 ops_claude_fix_20261027)

CREATE TABLE IF NOT EXISTS ops_claude_fix_20261027 AS
  SELECT now() AS backed_up_at, v.* FROM yt_channel_videos v WHERE false;
ALTER TABLE ops_claude_fix_20261027 ENABLE ROW LEVEL SECURITY; -- 정책 없음 = 공개 키로 못 읽음

CREATE TEMP TABLE _ids AS
  SELECT id FROM yt_channel_videos WHERE id IN (
    'wE9Du--2ch8','B5I8Ph4Yq_0','oD6S502HLSE','WsQQRsjWxPQ','cmiH3S586t4','TNzE8h54EqA','9Nc98NLknSs','JCoVtBMfiY4','uRMgs6o60Ck','FYMemblZQXw',
    'gduuajhODOU','SteRn4oKv1I','9D3KN_q8bn8','6OZ8cc0VgRU','fAjObia8PXY','JPF2NtFQttM','iDhojTXq-Gk','qSWG39_aff8','joLl4G6FdvA',
    'LKsZiDs2f_A','eJf5MZChBrM','Zno3a72Irb4','9KqVNX24tHg','tGS618rsi08','RwKy9EFOc6s','P2YWw6G6eXE','hKOcDpDGl6U','eh9KySo77xI','q4hPlMcVUO4')
  UNION SELECT id FROM yt_channel_videos WHERE cover_of_song = '카멜레온' AND group_ko = '트렌드지' AND cover_of_groups = '{헬로비너스}'
  UNION SELECT id FROM yt_channel_videos WHERE title ILIKE '%윤지성%' AND group_ko = '엔시티 드림' AND members = '{지성}' AND with_members = '{윤지성(워너원)}' AND content_flag IS NULL AND tags_manual = false;

INSERT INTO ops_claude_fix_20261027
  SELECT now(), v.* FROM yt_channel_videos v WHERE v.id IN (SELECT id FROM _ids)
  AND NOT EXISTS (SELECT 1 FROM ops_claude_fix_20261027 b WHERE b.id = v.id);

-- ① 출연자 미등록·브랜드/스태프 오인식·음악 커버 아님 → 무관
UPDATE yt_channel_videos SET content_flag = '무관', flag_source = 'manual', flagged_at = now(), needs_review = false
WHERE tags_manual = false AND id IN ('wE9Du--2ch8','B5I8Ph4Yq_0','oD6S502HLSE','WsQQRsjWxPQ','cmiH3S586t4','TNzE8h54EqA','9Nc98NLknSs','JCoVtBMfiY4','uRMgs6o60Ck','FYMemblZQXw');

-- ② 실제 출연자 재배정 + 원곡 분리 (모두 수동잠금 false였던 행)
UPDATE yt_channel_videos v SET
  group_ko = x.g, members = x.m, with_members = x.wm, with_groups = x.wg,
  cover_of_groups = x.cg, cover_of_members = x.cm, cover_of_song = x.cs,
  tags_manual = true, cover_manual = true, needs_review = false
FROM (VALUES
  ('gduuajhODOU','방탄소년단','{알엠,진}'::text[],'{}'::text[],'{}'::text[],'{}'::text[],'{}'::text[],NULL),
  ('SteRn4oKv1I','앤팀','{니콜라스,유마}','{}','{}','{방탄소년단}','{}','작은 것들을 위한 시 (Boy With Luv) (Feat. Halsey)'),
  ('9D3KN_q8bn8','BAE173','{}','{}','{}','{방탄소년단,엑소,몬스타엑스}','{}',NULL),
  ('6OZ8cc0VgRU','러블리즈','{이미주}','{}','{}','{방탄소년단}','{}','Butter'),
  ('fAjObia8PXY','저스트비','{}','{}','{}','{방탄소년단}','{}',NULL),
  ('JPF2NtFQttM','미야오','{}','{}','{}','{방탄소년단}','{}','Dynamite'),
  ('iDhojTXq-Gk','앰퍼샌드원','{최지호,김승모}','{}','{}','{갓세븐}','{}','하지하지마 (Stop stop it)'),
  ('qSWG39_aff8','갓세븐','{진영}','{}','{}','{}','{}',NULL),
  ('joLl4G6FdvA','아이딧','{}','{}','{}','{}','{}',NULL),
  ('LKsZiDs2f_A','키스오브라이프','{벨}','{}','{}','{레드벨벳}','{}','Psycho'),
  ('eJf5MZChBrM','리센느','{}','{}','{}','{레드벨벳}','{}','행복 (Happiness)'),
  ('Zno3a72Irb4','스테이씨','{윤,재이,수민,시은,아이사,세은}','{}','{}','{블랙핑크,레드벨벳}','{선미(솔로),청하(솔로)}',NULL),
  ('9KqVNX24tHg','BAE173','{제이민,무진,준서,영서}','{}','{}','{엔시티 드림}','{}','We Go Up'),
  ('tGS618rsi08','미래소년','{}','{}','{}','{엔시티 드림}','{}','오르골 (Life Is Still Going On)'),
  ('RwKy9EFOc6s','엔시티 위시','{}','{}','{}','{엔시티 드림}','{태용(엔시티 127)}','TAP'),
  ('P2YWw6G6eXE','시그니처','{}','{}','{}','{엔시티 드림}','{}','Candy'),
  ('hKOcDpDGl6U','엔싸인','{}','{}','{}','{엔시티 드림}','{}','ISTJ'),
  ('eh9KySo77xI','크래비티','{성민,형준}','{}','{}','{엔시티 드림,하이라이트}','{}',NULL),
  ('q4hPlMcVUO4','넥스지','{}','{}','{}','{스트레이키즈}','{}','특')
) AS x(id,g,m,wm,wg,cg,cm,cs)
WHERE v.id = x.id AND v.tags_manual = false;

-- ③ 트렌드지 카멜레온 챌린지 = 트렌드지 자기 곡(Chameleon) — 헬로비너스 동명곡 원곡 연결 제거 (출연 태그는 정상이라 그대로)
UPDATE yt_channel_videos SET cover_of_groups = '{}', cover_of_members = '{}', cover_of_song = NULL, cover_manual = true
WHERE cover_of_song = '카멜레온' AND group_ko = '트렌드지' AND cover_of_groups = '{헬로비너스}';

-- ④ 윤지성 솔로 무대가 엔시티 드림 지성으로 역전된 것 → 워너원 윤지성(기존 79건과 같은 저장 방식)
UPDATE yt_channel_videos SET group_ko = '워너원', members = '{윤지성}', with_members = '{}', tags_manual = true, needs_review = false
WHERE title ILIKE '%윤지성%' AND group_ko = '엔시티 드림' AND members = '{지성}' AND with_members = '{윤지성(워너원)}' AND content_flag IS NULL AND tags_manual = false;

-- 확인
SELECT
  (SELECT count(*) FROM ops_claude_fix_20261027) AS backed_up,
  (SELECT count(*) FROM yt_channel_videos WHERE id IN ('wE9Du--2ch8','B5I8Ph4Yq_0','oD6S502HLSE','WsQQRsjWxPQ','cmiH3S586t4','TNzE8h54EqA','9Nc98NLknSs','JCoVtBMfiY4','uRMgs6o60Ck','FYMemblZQXw') AND content_flag = '무관') AS junked_of_10,
  (SELECT count(*) FROM yt_channel_videos WHERE id IN ('gduuajhODOU','SteRn4oKv1I','9D3KN_q8bn8','6OZ8cc0VgRU','fAjObia8PXY','JPF2NtFQttM','iDhojTXq-Gk','qSWG39_aff8','joLl4G6FdvA','LKsZiDs2f_A','eJf5MZChBrM','Zno3a72Irb4','9KqVNX24tHg','tGS618rsi08','RwKy9EFOc6s','P2YWw6G6eXE','hKOcDpDGl6U','eh9KySo77xI','q4hPlMcVUO4') AND tags_manual) AS reassigned_of_19,
  (SELECT count(*) FROM yt_channel_videos WHERE cover_of_song = '카멜레온' AND cover_of_groups = '{헬로비너스}') AS chameleon_left,
  (SELECT count(*) FROM yt_channel_videos WHERE title ILIKE '%윤지성%' AND group_ko = '엔시티 드림' AND members = '{지성}' AND content_flag IS NULL) AS jisung_left;
