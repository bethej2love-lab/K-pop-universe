-- 2026-11-12 Codex 11-12 검수: 아이오아이 임나영(a0312)에 라잇썸 나영(a0917)의 방송사 직캠이 혼입.
-- 대상: 제목에 '라잇썸 나영'/'LIGHTSUM NAYOUNG'이 있는데 group_ko='아이오아이'로 저장된 29개(Codex 확인 18 + 같은 유형 11).
--   전부 SBS/MBC/ALL THE K-POP 방송사 공식 직캠, 제목이 라잇썸 나영을 명시(Codex oEmbed 대조). 1개(oZhifACSLeI)는 최유정까지 붙어 있었다(라잇썸 유정과 혼동).
-- 전부 tags_manual=true → 헌법 예외(근거 있는 한정 정정): 백업 → 정정 → 재잠금(tags_manual 그대로 true). 원본·조회수 등 다른 칸은 그대로.
-- 되돌리기: sql/2026-11-12_lightsum_nayoung_fix_undo.sql
create table if not exists public._bak_lightsum_nayoung_20261112 as
  select id, group_ko, members, with_members, song_keys, tags_manual from yt_channel_videos
  where (title ilike '%라잇썸 나영%' or title ilike '%LIGHTSUM NAYOUNG%') and group_ko = '아이오아이';
alter table public._bak_lightsum_nayoung_20261112 enable row level security;
update yt_channel_videos t set tags_manual = false
  from _bak_lightsum_nayoung_20261112 b where t.id = b.id;
update yt_channel_videos t set group_ko = '라잇썸', members = array['나영'], song_keys = null
  from _bak_lightsum_nayoung_20261112 b where t.id = b.id;
update yt_channel_videos t set tags_manual = true
  from _bak_lightsum_nayoung_20261112 b where t.id = b.id and b.tags_manual is true;
select (select count(*) from _bak_lightsum_nayoung_20261112) backed_up,
       (select count(*) from yt_channel_videos t join _bak_lightsum_nayoung_20261112 b using(id) where t.group_ko='라잇썸' and t.members=array['나영'] and t.tags_manual) fixed_locked;
