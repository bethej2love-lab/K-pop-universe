-- 2026-10-02 김준서(솔로, a1559) = 준서(알파드라이브원, a0348) 동일인 병합 후속
-- artists.json에서 a1559를 a0348로 합쳤다(생년월일 2001.11.20 일치, 원더나인→위아이→알파드라이브원).
-- 솔로 '김준서' 이름으로 모여 있던 영상 6건을 제자리로 옮긴다.
--   ① 에이엔(AEN) 준서 직캠 3건 — 애초에 다른 사람(에이엔 준서)이 잘못 들어온 것
--   ② 아리랑 Simply K-Pop "김준서" 3건(2025) — 위아이 활동 시절 본인
-- tags_manual=true 행은 건드리지 않는다.

UPDATE yt_channel_videos SET group_ko = '에이엔', members = ARRAY['준서']
WHERE group_ko = '김준서' AND tags_manual IS NOT TRUE
  AND id IN ('ZHeNJVybr0c', 'yME_Dn47Wms', 'fV8jgzSoPyY');

UPDATE yt_channel_videos SET group_ko = '위아이', members = ARRAY['준서']
WHERE group_ko = '김준서' AND tags_manual IS NOT TRUE
  AND id IN ('aPABj-gE2gA', '4TApeaRvbG8', 'wrySaT_kaUk');

-- 확인: 0이어야 함
SELECT count(*) FROM yt_channel_videos WHERE group_ko = '김준서';
