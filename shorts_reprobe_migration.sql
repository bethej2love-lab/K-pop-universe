-- 쇼츠 실측 표식 리셋 — 판별기 교체에 따른 전량 재검사 (2026-09-14)
--
-- 배경: 기존 판별은 oardefault.jpg(원본비율 썸네일) 한 장에 전부를 걸었는데, 유튜브가 요즘 쇼츠에
-- 이 이미지를 안 주는 경우가 많다(404). 그런데 옛 코드는 404를 "가로 확정"으로 읽고 short_probed_at
-- 까지 찍어버렸다 — 한 번 놓치면 다음 스윕 후보에서 영구히 빠진다.
--
-- 실측(2026-09-14, "가로로 확정됨" 행을 youtube.com/shorts/<id> HEAD로 재검사):
--     2021 5% · 2022 5% · 2023 3% · 2024 15% · 2025 3% · 2026 13%
--     최근 유입분 표본 300~400건에서는 19~20%
--   놓친 표본을 직접 열어 확인한 결과 전부 1080x1920 / 2160x3840 세로였고 oardefault는 전부 404.
--   → 이미 "확정"된 약 29만 건 중 대략 2만 건이 세로인데 가로로 박혀 있다.
--
-- 그래서 이 스윕은 "밀린 것 처리"가 아니라 **재검사**가 필요하다. 표식만 지우면 tools/shorts_promote.mjs
-- (새 판별기)가 그 행들을 후보로 다시 집어 올린다. 부분 인덱스 idx_ytv_short_unprobed가 그대로 커버한다.
--
-- ⚠️ is_short=true인 행은 건드리지 않는다 — 세로 판정은 오탐 방향이 아니었고(oardefault가 세로라고
--    말했으면 실제로 세로다), 괜히 지우면 이미 맞는 29만 건 중 16만 건을 헛되이 다시 훑는다.
-- ⚠️ tags_manual=true(사람이 손으로 만진 행)는 스윕이 어차피 제외하므로 여기서도 제외한다.
--
-- 소요: 재검사 대상 약 29만 건, 새 판별기 실측 처리량 80~87건/초(CONC=200) → 60~90분.
--   GitHub Actions 워크플로(.github/workflows/shorts-promote.yml)가 6시간마다 이어서 돌므로
--   한 번에 안 끝나도 다음 실행이 남은 것부터 이어받는다(표식이 진행 상황 그 자체라 커서가 필요 없다).

UPDATE yt_channel_videos
   SET short_probed_at = NULL
 WHERE is_short = false
   AND tags_manual = false
   AND short_probed_at IS NOT NULL;

-- 확인용 — 실행 후 후보 수가 29만 대로 올라와 있어야 한다.
-- SELECT count(*) FROM yt_channel_videos
--  WHERE is_short = false AND tags_manual = false AND short_probed_at IS NULL;
