-- 쇼츠(세로) 실측 표식 (2026-08-31)
--
-- 배경: 동기화 시점 세로 판별은 원리적으로 불가능하다(유튜브가 주는 썸네일은 쇼츠도 전부 가로:
-- high 480x360·maxres 1280x720). 원본 세로 비율을 유지하는 건 oardefault.jpg(1080x1920)뿐이라,
-- 영상마다 그 이미지를 실제로 받아봐야 세로인지 알 수 있다(~28만 건). 지금까지 이 실측 스윕은
-- localStorage '커서' 하나로만 재프로브를 피했는데, 커서를 잃거나 처음부터 다시 돌리면 이미 확인한
-- 가로 28만 개를 통째로 다시 확인해야 했다.
--
-- 해결: 행마다 "실측 확인함" 표식을 남긴다. 한 번 확인된 가로는 short_probed_at이 채워져 다음
-- 스윕에서 영구히 제외된다 → 재프로브 0, 밀린 것 다 처리하면 후보가 0이 되어 자연히 끝난다.
-- 커서 방식(단일 포인터)의 견고한 상위호환. 서버 백그라운드 스윕(tools/shorts_promote.mjs)과
-- 브라우저 승격 버튼이 이 컬럼을 공유해 서로의 진행을 이어받는다.
--
-- 이 컬럼은 "봤다"는 표식일 뿐 강등을 뜻하지 않는다 — 세로면 is_short=true도 같이 서고,
-- 가로면 short_probed_at만 채워진다(is_short는 false 유지).

ALTER TABLE yt_channel_videos
  ADD COLUMN IF NOT EXISTS short_probed_at timestamptz;

-- '아직 실측 안 한 가로 후보'만 최신순으로 빠르게 뽑기 위한 부분 인덱스.
-- 스윕이 끝나면(후보 0) 인덱스도 사실상 비어 비용이 없다.
CREATE INDEX IF NOT EXISTS idx_ytv_short_unprobed
  ON yt_channel_videos (published_at DESC)
  WHERE is_short = false AND short_probed_at IS NULL AND tags_manual = false;
