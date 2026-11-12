-- 2026-11-12 Codex 검수 — 소녀시대-효리수(효연·유리·수영) 유닛 무대가 members 빈 채로 있어 태연·티파니 등 유닛 밖 멤버 카드에 '그룹 전체'로 떴다.
-- 제목에 효리수/HRS가 있는 유닛 무대·비하인드 9개만 세 명으로. 소녀시대 무대 모음(_iXZ1sOw__U)·태티서와 같이 나온 vRzmqe4Zcqg는 그대로. 모두 tags_manual=false.
create table if not exists _bak_hrs_members_20261112 as
  select id, members from yt_channel_videos
   where id in ('uP4SF0iGrUc','UgUzB9oRyyI','Pv1LP1VcBHo','EMGD964xC48','X6bqHuDxW44','jfA0dRSXK2o','tA9xm2VaXEs','ydVhAUeO8mU','ThtGT-oSSqA');
update yt_channel_videos set members='{효연,유리,수영}'
 where id in ('uP4SF0iGrUc','UgUzB9oRyyI','Pv1LP1VcBHo','EMGD964xC48','X6bqHuDxW44','jfA0dRSXK2o','tA9xm2VaXEs','ydVhAUeO8mU','ThtGT-oSSqA')
   and group_ko='소녀시대' and members='{}' and tags_manual is not true;
-- 되돌리기: update yt_channel_videos t set members=b.members from _bak_hrs_members_20261112 b where t.id=b.id;
select count(*) fixed from yt_channel_videos where id in ('uP4SF0iGrUc','UgUzB9oRyyI','Pv1LP1VcBHo','EMGD964xC48','X6bqHuDxW44','jfA0dRSXK2o','tA9xm2VaXEs','ydVhAUeO8mU','ThtGT-oSSqA') and members='{효연,유리,수영}';
