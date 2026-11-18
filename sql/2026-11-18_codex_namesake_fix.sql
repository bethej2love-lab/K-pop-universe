-- 2026-11-18 Codex 검수: 아나운서·감독·성대모사·일상어·동명이인 오태깅 23건 (제목으로 건별 확인함)
-- 카라 강지영 ← JTBC 아나운서 강지영 13 · 젝스키스 강성훈 ← e스포츠 감독 · 레인보우 조현영 ← 현영 성대모사 · 핑클 성유리 ← 성대모사
-- 신화 ← '10연패 신화'·'맨발 신화'·'2002 신화' · 시크릿 ← 농구선수 이정현 'SECRET BOX' · 슈가 박수진 ← 동명이인 가수(현 조하) OST MV · 슈가 황정음 ← 닮은꼴 성대모사
-- → 무관(manual). 단 N4cf0ShisUo(아는 형님, 김희철 실제 출연)는 무관 대신 슈퍼주니어 희철로 재배정.
create table if not exists public.bak_20261118_namesake as
  select id, group_ko, members, content_flag, flag_source, flagged_at from yt_channel_videos where id in
  ('4aFARd4E-ik','bwQC6T-kimc','C2NQkiUmGt8','CcJKNtiSAqg','cCnNF1TrgfQ','DGhgL5CBcY0','K9C3cViEivA','kJ7TC0lZNMA','KNCrMyDWKz8','N4cf0ShisUo','qBP7kuZ515c','qjBLlgJkWWE','TzGSypeLiX8','VbLAzlO0lOg',
   'uY2kl_2v1Hw','qCD1vVlcA6k','WusCHBk1DBo','c8knPHE6JUU','eMOC6VSrr04','NkkXDEDcSco','N-MHP61FsE0','49GW_YDG0k8','qMpBZa-gNrI');
alter table public.bak_20261118_namesake enable row level security;
revoke all on public.bak_20261118_namesake from anon, authenticated;

update yt_channel_videos set content_flag='무관', flag_source='manual', flagged_at=now()
where id in ('4aFARd4E-ik','bwQC6T-kimc','C2NQkiUmGt8','CcJKNtiSAqg','cCnNF1TrgfQ','DGhgL5CBcY0','K9C3cViEivA','kJ7TC0lZNMA','KNCrMyDWKz8','qBP7kuZ515c','qjBLlgJkWWE','TzGSypeLiX8','VbLAzlO0lOg',
   'uY2kl_2v1Hw','qCD1vVlcA6k','WusCHBk1DBo','c8knPHE6JUU','eMOC6VSrr04','NkkXDEDcSco','N-MHP61FsE0','49GW_YDG0k8','qMpBZa-gNrI')
  and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='슈퍼주니어', members=array['희철'] where id='N4cf0ShisUo' and group_ko='카라' and members=array['강지영'] and content_flag is null and tags_manual=false;

select content_flag, group_ko, count(*) from yt_channel_videos where id in (select id from public.bak_20261118_namesake) group by 1,2 order by 1,2;
-- 되돌리기: update yt_channel_videos v set group_ko=b.group_ko, members=b.members, content_flag=b.content_flag, flag_source=b.flag_source, flagged_at=b.flagged_at from public.bak_20261118_namesake b where v.id=b.id;
