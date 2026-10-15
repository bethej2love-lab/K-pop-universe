-- 소연((여자)아이들) 음방 1위 song_title 확인 및 한글 수정
-- 1. 현재 저장된 값 확인
SELECT show, win_date, song_title, group_ko, member_ko
FROM music_show_wins
WHERE group_ko = '(여자)아이들'
  AND member_ko = '소연'
ORDER BY win_date DESC
LIMIT 20;

-- 2. 영어로 저장된 것 확인 (퇴사할게여 영어 제목은 다양할 수 있음)
-- 위 결과에서 song_title이 영어면 아래 UPDATE 실행

-- 3. 한글로 수정 (실제 영어 제목 확인 후 WHERE 조건 맞게 고칠 것)
-- UPDATE music_show_wins
-- SET song_title = '퇴사할게여'
-- WHERE group_ko = '(여자)아이들'
--   AND member_ko = '소연'
--   AND song_title ILIKE '%resign%';   -- 또는 실제 확인한 영어 제목
