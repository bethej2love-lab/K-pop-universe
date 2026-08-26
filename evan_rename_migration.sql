-- 2026-08-26 · 에반(희승) → 에반 이름 정리 (admin 세션에서 실행)
--
-- 배경: 희승이 엔하이픈에서 나오며(left 2026.03.10) 활동명이 EVAN이 됐는데,
--       artists.json의 name.ko가 "에반(희승)"처럼 괄호를 이름에 박아넣은 형태였다.
--       우즈(subName "조승연")와 같은 방식으로 name.ko="에반" + subName="희승"으로 분리했다.
--       name.ko는 영상 태깅의 정식 키라, 이미 저장된 태그도 같이 바꿔줘야 한다.
--
-- 실측 영향(2026-08-26, anon 조회 기준):
--   members       ⊃ '에반(희승)'            → 363건 (전부 group_ko='엔하이픈')
--   with_members  ⊃ '에반(희승)(엔하이픈)'  →   2건
--
-- ⚠️ tags_manual=true 행도 여기서는 **같이 바꿔야 한다.** 이건 자동 재태깅이 아니라
--    "같은 사람의 표기 이름"을 옮기는 단순 개명이라, 안 바꾸면 수동으로 맞춰둔 태그만
--    유령 이름으로 남아 카드에서 사라진다. (자동 태깅 코드가 tags_manual을 덮지 않는
--    원칙과는 다른 범주 — 판단이 아니라 문자열 이동이다.)

begin;

-- 1) members 배열 안의 '에반(희승)' → '에반'
update yt_channel_videos
   set members = array_replace(members, '에반(희승)', '에반')
 where members @> array['에반(희승)'];

-- 2) with_members 배열 안의 '에반(희승)(엔하이픈)' → '에반(엔하이픈)'
update yt_channel_videos
   set with_members = array_replace(with_members, '에반(희승)(엔하이픈)', '에반(엔하이픈)')
 where with_members @> array['에반(희승)(엔하이픈)'];

-- 3) 확인 — 셋 다 0이어야 한다
select
  (select count(*) from yt_channel_videos where members      @> array['에반(희승)'])            as 남은_members,
  (select count(*) from yt_channel_videos where with_members @> array['에반(희승)(엔하이픈)'])  as 남은_with_members,
  (select count(*) from yt_channel_videos where members      @> array['에반'])                  as 새이름_members;

commit;

-- ── 부수 테이블(있으면 같이) ────────────────────────────────────────────────────
-- 프로필 사진은 (ko_name, group_ko) 복합키라 ko_name도 같이 옮겨야 한다.
update artist_pics set ko_name = '에반' where ko_name = '에반(희승)';

-- 트로피/콘서트/디스코 등 member_ko를 쓰는 테이블이 있으면 같은 방식으로:
--   update <table> set member_ko = '에반' where member_ko = '에반(희승)';
-- (현재 확인된 것만 위에 적었다 — 실행 후 아래로 잔여를 훑어볼 것)
