-- 오태깅 순위표 첫 발견 4건 정리 (2026-09-28) — 전부 tags_manual = false
-- ①앤팀 케이: "#K-pop"의 K ②빅뱅 지디·태양: "Good Boy" 챌린지 해시태그가 유닛 별명으로 ③소녀시대 태티서: "'Twinkle' (태티서)" 원곡 표기
-- ④드림캐쳐 지유·수아·유현: 동명 신인 그룹 UAU. 고친 매처로 재판정해 그 사람이 더는 안 나오는 행만.
BEGIN;

-- 멤버 태그 · 아이돌 없음(8) → 제거 + 무관
UPDATE yt_channel_videos SET members = array_remove(members, '케이'), content_flag = COALESCE(content_flag,'무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END, flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END WHERE tags_manual = false AND id IN ('qjwAnIb_434','ZIbZSf4yJeM','cqBVa9Rl0y0','RTbkezpu2uU','DcyMYVFXPyM','7PupN4OHukQ','ALWuxhVEgC4','Im-Qx6PZUvA');

-- 멤버 태그 · 로스터 밖 그룹(신인 UAU 등)(25) → 제거 + 보류(검수 큐)
UPDATE yt_channel_videos SET members = array_remove(members, '지디'), content_flag = COALESCE(content_flag,'보류'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END, flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END, needs_review = true WHERE tags_manual = false AND id IN ('');
UPDATE yt_channel_videos SET members = array_remove(members, '지유'), content_flag = COALESCE(content_flag,'보류'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END, flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END, needs_review = true WHERE tags_manual = false AND id IN ('yrLQNSjTujg','dAFMFwzPbgA','Y3I0KqNfS84','kWaOxLagCDg','UvmYRccqed4','2FLTl0k1Ffg','1R7sZudtl1U','hs2ca2qMzh0');
UPDATE yt_channel_videos SET members = array_remove(members, '수아'), content_flag = COALESCE(content_flag,'보류'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END, flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END, needs_review = true WHERE tags_manual = false AND id IN ('dAFMFwzPbgA','Y3I0KqNfS84','N7iMCLDw5IA','kWaOxLagCDg','UvmYRccqed4','2FLTl0k1Ffg','EJiSxIfibBg','hs2ca2qMzh0');
UPDATE yt_channel_videos SET members = array_remove(members, '유현'), content_flag = COALESCE(content_flag,'보류'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END, flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END, needs_review = true WHERE tags_manual = false AND id IN ('dAFMFwzPbgA','Y3I0KqNfS84','kWaOxLagCDg','UvmYRccqed4','2FLTl0k1Ffg','52pemI-0biA','UFgSHRMM6Qc','hs2ca2qMzh0');

-- (다른 그룹 판정 1건 — 놀라운토요일 "태연의 한 마디"는 진짜 출연이라 제외)

-- 게스트 태그(60) → 제거
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '지디(빅뱅)') WHERE tags_manual = false AND id IN ('QAaMx3uze5E','yjmtCvtPKDo','kzfB1hiwyS0','cxDIZm-zc7w','ZUXXoLy3h1M','uapkjmtfpvk','RM9W39IoEGc','JGeKSc7Fsug','lnTA2DudjlA','LvN9xyXeTaY','j9-S1bGix-g','WBKEnEaCdaA','G-26n0v2BVQ','rzb6FPyIVVk');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '태양(빅뱅)') WHERE tags_manual = false AND id IN ('QAaMx3uze5E','yjmtCvtPKDo','kzfB1hiwyS0','cxDIZm-zc7w','ZUXXoLy3h1M','uapkjmtfpvk','RM9W39IoEGc','JGeKSc7Fsug','lnTA2DudjlA','LvN9xyXeTaY','j9-S1bGix-g','WBKEnEaCdaA','G-26n0v2BVQ','rzb6FPyIVVk');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '태연(소녀시대)') WHERE tags_manual = false AND id IN ('-DfjZJXV7SM','tNr-XAEO3Jg');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '티파니(소녀시대)') WHERE tags_manual = false AND id IN ('-DfjZJXV7SM','tNr-XAEO3Jg');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '서현(소녀시대)') WHERE tags_manual = false AND id IN ('-DfjZJXV7SM','tNr-XAEO3Jg');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '지유(드림캐쳐)') WHERE tags_manual = false AND id IN ('uDkpNufPK0M','gdI01yughGk','9UMj22MW5iQ','VzMzPq82Vg4','LlvdUqph13g','0s4k3K6cn2s','2-PQYMrGVtY','4TzdRgSpoJw','Z6NXyGed6nQ');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '수아(드림캐쳐)') WHERE tags_manual = false AND id IN ('uDkpNufPK0M','gdI01yughGk','9UMj22MW5iQ','VzMzPq82Vg4','LlvdUqph13g','0s4k3K6cn2s','2-PQYMrGVtY','4TzdRgSpoJw','Z6NXyGed6nQ');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '유현(드림캐쳐)') WHERE tags_manual = false AND id IN ('uDkpNufPK0M','gdI01yughGk','VzMzPq82Vg4','LlvdUqph13g','0s4k3K6cn2s','2-PQYMrGVtY','4TzdRgSpoJw','Z6NXyGed6nQ');

COMMIT;
