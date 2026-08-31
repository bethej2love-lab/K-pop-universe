-- 제이미(박지민) 이름 정리 (2026-08-31)
--
-- artists.json은 이미 반영됨: name.ko '제이미(박지민)' → '제이미', subName '박지민' 추가.
-- (활동명은 '제이미', 실명 '박지민'은 카드에 작게 병기 + 검색 별칭. 괄호 박힌 이름은 이 한 명뿐이었음.)
-- DB에 기존 '제이미(박지민)'으로 태깅된 행도 같이 갱신해야 카드/검색에서 안 붕 뜬다.
-- array_replace는 대상 원소가 없으면 no-op이라 재실행해도 안전(idempotent).

-- 1) 자체 채널/그룹 전체 영상의 members 배열 (실측 10건)
UPDATE yt_channel_videos
  SET members = array_replace(members, '제이미(박지민)', '제이미')
  WHERE members @> ARRAY['제이미(박지민)'];

-- 2) 다른 채널 게스트 콜라보 with_members — "이름(그룹)" 포맷 (실측 4건)
UPDATE yt_channel_videos
  SET with_members = array_replace(with_members, '제이미(박지민)(피프틴앤드)', '제이미(피프틴앤드)')
  WHERE with_members @> ARRAY['제이미(박지민)(피프틴앤드)'];

-- 3) 원곡자 태깅 cover_of_members (실측 1건)
UPDATE yt_channel_videos
  SET cover_of_members = array_replace(cover_of_members, '제이미(박지민)(피프틴앤드)', '제이미(피프틴앤드)')
  WHERE cover_of_members @> ARRAY['제이미(박지민)(피프틴앤드)'];

-- 4) 잘못 등록된 채널 — 제이미를 "소속 없는 솔로(owner_gko=제이미)"가 아니라 피프틴앤드 멤버로 연결.
--    owner_mko는 이미 '제이미'라 그대로 맞고, owner_gko만 바로잡는다.
UPDATE ext_channels
  SET owner_gko = '피프틴앤드'
  WHERE handle = 'OfficialJamie';

-- 확인용(실행 후 0건이어야 함):
--   SELECT count(*) FROM yt_channel_videos WHERE members @> ARRAY['제이미(박지민)']
--     OR with_members @> ARRAY['제이미(박지민)(피프틴앤드)'] OR cover_of_members @> ARRAY['제이미(박지민)(피프틴앤드)'];
--   SELECT handle, owner_mko, owner_gko FROM ext_channels WHERE handle='OfficialJamie';  -- owner_gko='피프틴앤드'
