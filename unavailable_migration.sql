-- 삭제·비공개 영상 감지 (2026-09-04, Fable 아카이브 운영 설계 T8)
--
-- 배경: 이 서비스는 영상을 소유하지 않는다. 보존할 수 있는 건 메타데이터와 **"존재했다는 기록"**뿐이다.
-- 그런데 지금까지 유튜브에서 삭제·비공개된 영상을 알아채는 장치가 하나도 없어서(소스 전수 검색 0건),
-- 카드에 죽은 임베드가 그대로 떴다.
--
-- 감지 비용은 **0에 가깝다** — 조회수 순환 갱신(_ytRotateViewCountRefresh)이 이미
-- `chunk.filter(id=>!returned.has(id))`로 "요청했는데 응답에 없는 id"를 계산하고 있었다.
-- 그걸 버리지 않고 여기 적어둘 뿐이다. 추가 API 쿼터가 들지 않는다.
--
-- ⚠️ 행을 지우지 않는다. 삭제된 영상도 "언제 사라졌는가"가 아카이브의 기록이다.
-- ⚠️ 되살아나면(비공개 해제·지역 차단 해제) 다음 순환에서 응답에 다시 잡히고 코드가 null로 되돌린다.
--    그래서 이 값은 "마지막으로 확인했을 때 없었다"는 뜻이지 영구 삭제 선언이 아니다.
-- ⚠️ 첫 관측 시각을 유지한다 — 이미 값이 있으면 코드가 덮어쓰지 않는다(사라진 시점이 흐려지지 않게).

ALTER TABLE yt_channel_videos
  ADD COLUMN IF NOT EXISTS unavailable_at timestamptz;

-- "사라진 것만" 뽑는 쿼리(홈 카드·검수 목록)를 위한 부분 인덱스.
-- 대부분의 행은 null이라 인덱스가 아주 작다.
CREATE INDEX IF NOT EXISTS idx_ytv_unavailable
  ON yt_channel_videos (unavailable_at DESC)
  WHERE unavailable_at IS NOT NULL;

-- 확인용:
--   select count(*) from yt_channel_videos where unavailable_at is not null;
--   select id, title, group_ko, unavailable_at from yt_channel_videos
--     where unavailable_at is not null order by unavailable_at desc limit 20;
--
-- 실행 후 "조회수 순환 갱신"을 한 번 돌리면 그 배치(기본 2만 건)부터 감지가 쌓인다.
-- 전체 39만 건을 한 바퀴 도는 데는 순환 갱신 ~20회가 필요하다(월 1회 기준이면 시간이 걸린다).
