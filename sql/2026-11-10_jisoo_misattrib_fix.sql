-- 블랙핑크 지수 영상이 러블리즈 서지수로 오태깅(2026-11-10 사용자 — 'ADDICTED' 인기가요 직캠이 주간 직캠 차트 1위인데 러블리즈로 뜸).
-- 두 사람 영문명이 둘 다 'Jisoo'라 제목에 그룹명 없이 "지수 / JISOO"만 있으면 서지수로 잡혔다. 제목 근거로 확인된 블랙핑크 지수 11행 + HANA(미등록 그룹) 지수 2행.
-- 백업 _bak_jisoo_fix_20261110, 되돌리기 sql/2026-11-10_jisoo_misattrib_fix_undo.sql. 러블리즈 채널 자체 영상 6행(챌린지·VLOG)은 서지수 맞음 → 그대로.
create table if not exists public._bak_jisoo_fix_20261110 as
  select id,group_ko,members,with_members,with_groups,tags_manual,content_flag from public.yt_channel_videos
  where id in ('PCQCeOmDkHI','VysCULEzWuA','UJICDtZmU4E','-UW9PIVNBL4','wQKAOx_rvuw','kn2d9n4P89k','fT-QJaKEyfc','5m5DpNHmAWE','uM_7CqCkIEo','xQLZ5XSXoRk','-2KUJYHbigc','yomDGDCVkiE','w5I_ygSq2CI');
alter table public._bak_jisoo_fix_20261110 enable row level security;
update public.yt_channel_videos set group_ko='블랙핑크',members=array['지수'],with_members='{}',with_groups='{}',tags_manual=true
  where id in ('PCQCeOmDkHI','VysCULEzWuA','UJICDtZmU4E','-UW9PIVNBL4','wQKAOx_rvuw','kn2d9n4P89k','fT-QJaKEyfc','5m5DpNHmAWE','uM_7CqCkIEo','xQLZ5XSXoRk','-2KUJYHbigc')
  and group_ko='러블리즈';
-- HANA(우리 우주 미등록 그룹)의 지수 — 서지수 아님. 소속 판단 불가 → 보류(화면 비노출), 멤버 비움
update public.yt_channel_videos set members='{}',content_flag='보류',tags_manual=true
  where id in ('yomDGDCVkiE','w5I_ygSq2CI') and group_ko='러블리즈';
select id,group_ko,members,content_flag,tags_manual from public.yt_channel_videos where id in (select id from public._bak_jisoo_fix_20261110) order by group_ko;
