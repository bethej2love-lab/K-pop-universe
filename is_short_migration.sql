-- short를 "형식 플래그"로 직교화 (2026-08-27)
--
-- 배경: category가 단일값이라 short가 장르(live/variety/show/cover/mv)와 상호배타였다. 세로 직캠을
-- 쇼츠로 승격하면 라이브 탭에서 사라지고, 반대로 장르를 지키면 9:16으로 안 그려졌다. 이미
-- content_formats(배열)로 장르는 직교화돼 있었고, 남은 건 short 하나였다.
--
-- 왜 content_formats에 'short'를 넣지 않았나:
--   1) admin.js의 태그 저장(_vidTagSave)이 content_formats의 장르 태그를 통째로 재계산·교체한다 —
--      거기 섞여 있으면 관리자가 태그 한 번 만질 때마다 'short'가 조용히 날아간다.
--   2) get_content_formats RPC로 뽑는 "콘텐츠별 보기" 목록에 short가 장르인 척 끼어든다.
--   3) 불리언은 부분 인덱스가 싸고, "형식 플래그"라는 의미도 그대로 드러난다.
--
-- ⚠️ 실행 순서: 이 SQL을 **먼저** 돌리고 나서 코드를 배포할 것. 반대로 하면 is_short 컬럼이 없는
--    상태로 select가 나가서 PostgREST가 400을 뱉고 카드 조회가 전부 죽는다.
--    (읽기 쪽엔 `is_short===true || category==='short'` 폴백이 있어서, SQL만 먼저 돌아간 상태로
--     구버전 코드가 잠깐 도는 건 무해하다.)

-- 1) 플래그 컬럼. Postgres 11+는 default 있는 컬럼 추가에 테이블 재작성을 안 하므로 37만 행이어도 즉시.
ALTER TABLE yt_channel_videos
  ADD COLUMN IF NOT EXISTS is_short boolean NOT NULL DEFAULT false;

-- 2) 기존 category='short' 행(약 84,286건)을 플래그로 승계.
--    category 값은 여기서 건드리지 않는다 — 장르 재추론은 관리자 패널의
--    "🔀 쇼츠 category→장르 재추론 (일회용)" 버튼에서 스냅샷을 남기며 따로 처리한다.
UPDATE yt_channel_videos SET is_short = true WHERE category = 'short' AND is_short = false;

-- 3) Shorts 탭 조회용 부분 인덱스. 쇼츠는 전체의 ~23%(84k/372k)라 부분 인덱스가 확실히 이득이고,
--    실제 쿼리가 group_ko 필터 + published_at 정렬이라 같은 형태로 복합 구성한다.
--    ⚠️ predicate(WHERE is_short)를 바꾸면 index.html의 .eq('is_short',true) 쪽도 같이 고칠 것 —
--       조건 형태가 다르면 플래너가 이 인덱스를 안 쓴다.
CREATE INDEX IF NOT EXISTS idx_ytv_is_short_group_published
  ON yt_channel_videos (group_ko, published_at DESC) WHERE is_short;

-- 4) 승격 스윕이 "아직 쇼츠 아닌 행"을 id 오름차순으로 훑을 때 쓰는 인덱스.
--    (tags_manual=false AND is_short=false AND id > cursor ORDER BY id)
CREATE INDEX IF NOT EXISTS idx_ytv_not_short_id
  ON yt_channel_videos (id) WHERE NOT is_short AND NOT tags_manual;

-- 새 인덱스를 플래너가 실제로 고려하게 통계 갱신
ANALYZE yt_channel_videos;
