-- 2026-10-15 세븐어스 멤버 이름 정정: 헤재→희재, 이레←이래 (등록 오기 — 나무위키·kprofiles·영상 제목 20건 "희재"·팬덤명 희아라)
-- 태그 키만 바꾸는 것(판정 변경 아님)이라 관리자 잠금 행(tags_manual=true)도 같이 바꾸고 잠금은 그대로 되돌린다
-- (잠금 행은 트리거 때문에 앱처럼 해제→수정→재잠금 두 단계). 통째로 실행. 대상: members 25·with_members 4 내외.
CREATE TEMP TABLE _sevenus_rn AS
SELECT id, tags_manual FROM yt_channel_videos
WHERE (group_ko = '세븐어스' AND (members && ARRAY['헤재','이래']::text[]))
   OR (with_members && ARRAY['헤재(세븐어스)','이래(세븐어스)']::text[])
   OR (cover_of_members && ARRAY['헤재(세븐어스)','이래(세븐어스)']::text[]);

UPDATE yt_channel_videos v SET
  members = array_replace(array_replace(v.members, '헤재', '희재'), '이래', '이레'),
  with_members = array_replace(array_replace(v.with_members, '헤재(세븐어스)', '희재(세븐어스)'), '이래(세븐어스)', '이레(세븐어스)'),
  cover_of_members = array_replace(array_replace(v.cover_of_members, '헤재(세븐어스)', '희재(세븐어스)'), '이래(세븐어스)', '이레(세븐어스)'),
  tags_manual = false
FROM _sevenus_rn r WHERE v.id = r.id;

UPDATE yt_channel_videos v SET tags_manual = true
FROM _sevenus_rn r WHERE v.id = r.id AND r.tags_manual = true;

SELECT count(*) AS 바뀐_행, count(*) FILTER (WHERE tags_manual) AS 잠금_행 FROM _sevenus_rn;
