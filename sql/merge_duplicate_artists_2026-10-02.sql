-- 2026-10-02 동일인 중복 레코드 6쌍 병합 후속 (artists.json은 이미 병합·커밋됨)
-- 같은 사람이 그룹을 옮기며 레코드가 둘로 쪼개져 있었다(생년월일 일치 + 같은 나무위키/이력).
--   준서(알파드라이브원) ← 김준서(솔로)      이은상(솔로) ← 은상(유나이트)
--   나나(우아) ← 권나연(솔로)                 김주형(데일리디렉션) ← 주형(나인아이)
--   백예빈(솔로) ← 예빈(다이아)               우희(솔로) ← 배우희(솔로)
-- 태그는 이름이 키라, 지워진 이름으로 붙은 태그를 남긴 이름으로 바꾼다.
--   · 이름만 바꾸는 array_replace는 같은 사람이라 tags_manual 행도 같이 바꾼다(수동 판단은 그대로 유지됨).
--   · 영상을 다른 그룹으로 옮기거나 무관 처리하는 건 tags_manual=false 행만.
BEGIN;

-- ① 옛 그룹 영상의 멤버 태그 이름 바꾸기
UPDATE yt_channel_videos SET members = array_replace(members, '은상', '이은상')   WHERE group_ko = '유나이트' AND '은상' = ANY(members);   -- 155
UPDATE yt_channel_videos SET members = array_replace(members, '주형', '김주형')   WHERE group_ko = '나인아이' AND '주형' = ANY(members);   -- 49
UPDATE yt_channel_videos SET members = array_replace(members, '예빈', '백예빈')   WHERE group_ko = '다이아'   AND '예빈' = ANY(members);   -- 42
UPDATE yt_channel_videos SET members = array_replace(members, '권나연', '나나')   WHERE group_ko = '엘즈업'   AND '권나연' = ANY(members); -- 31

-- ② 지워진 솔로 이름(group_ko=본인이름)으로 묶인 영상 옮기기
UPDATE yt_channel_videos SET group_ko = '이은상', members = array_replace(members, '은상', '이은상')
WHERE group_ko = '은상';                                                                              -- 18 (본인 숏츠)
UPDATE yt_channel_videos SET group_ko = '우희', members = array_replace(members, '배우희', '우희')
WHERE group_ko = '배우희';                                                                            -- 1
UPDATE yt_channel_videos SET group_ko = '데일리디렉션', members = ARRAY['김주형']
WHERE group_ko = '김주형' AND tags_manual = false;                                                    -- 2 (DAILY:DIRECTION 숏츠)
UPDATE yt_channel_videos SET group_ko = '우아', members = ARRAY['나나']
WHERE group_ko = '권나연' AND tags_manual = false
  AND id IN ('zD6XOuvz4XE','6KgjQpcJ5Gs','AXMjEQMEkJQ','wvwxLbLzGJo','M21HfHzJkpk','f8JQDqK9ljI','t0dNTaxogK4','nTuaHWnNhIk','Eq2OiONn1So'); -- 9 (우아 나나)
-- 장기하 '너나 나나'(KBS) 6건 — "나나"라는 단어로 잘못 수집. 무관 처리(숨김)
UPDATE yt_channel_videos SET content_flag = COALESCE(content_flag, '무관'),
  flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE group_ko = '권나연' AND tags_manual = false
  AND id IN ('D0gmaRpCA6c','SH9mxhPWaVc','ZTRKmnn9J9E','7FcGoGTXGtg','b6YT4Zl75WQ','YfElmRwdUCI');
-- 김준서(솔로) 6건: 에이엔 준서 직캠 3건은 원래 남의 것, Simply K-Pop 3건은 위아이 시절 본인
UPDATE yt_channel_videos SET group_ko = '에이엔', members = ARRAY['준서']
WHERE group_ko = '김준서' AND tags_manual = false AND id IN ('ZHeNJVybr0c','yME_Dn47Wms','fV8jgzSoPyY');
UPDATE yt_channel_videos SET group_ko = '위아이', members = ARRAY['준서']
WHERE group_ko = '김준서' AND tags_manual = false AND id IN ('aPABj-gE2gA','4TApeaRvbG8','wrySaT_kaUk');

COMMIT;

-- 확인: 전부 0이어야 함(권나연은 무관 처리된 6건만 남는 게 정상)
SELECT group_ko, count(*) FROM yt_channel_videos WHERE group_ko IN ('은상','배우희','김주형','김준서') GROUP BY 1;
SELECT count(*) AS 권나연_남은것_무관제외 FROM yt_channel_videos WHERE group_ko = '권나연' AND content_flag IS DISTINCT FROM '무관';
SELECT count(*) AS 옛이름_태그 FROM yt_channel_videos
WHERE (group_ko='유나이트' AND '은상'=ANY(members)) OR (group_ko='나인아이' AND '주형'=ANY(members))
   OR (group_ko='다이아' AND '예빈'=ANY(members)) OR (group_ko='엘즈업' AND '권나연'=ANY(members));
