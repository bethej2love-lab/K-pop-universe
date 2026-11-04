-- 2026-11-04 자동 태깅 행(남은 10)의 명단 밖 본인 멤버 정리(잠금 행과 같은 규칙, 정리 후 잠금) 10행 — 새 규칙(근거 있는 한정 정정·백업·3단계·재잠금, 메모리 feedback_never_overwrite_manual_tags 예외).
-- 규칙: 같은 사람 다른 표기는 정식 이름(권나연→나나·은상→이은상·에반(희승)→에반·우즈(조승연)→우즈) / 이미 with에 있으면 members에서만 뺌 / 제외 인물(김가람) 뺌
--       / 제목에 그 사람·그룹이 나오고 후보 1명이면 이름(그룹)으로 옮김 / 누군지 불명이면 빼기만 / 비면 제목 해시태그의 본인 멤버만 채움
--       / 자체 채널이 아니고 본인 멤버가 다 빠지고 옮길 출연자 1명·제목에 원래 주인 없음 → 주인을 그 사람 그룹으로(댄싱위드더스타 문희준 13→H.O.T., 노태현 직캠 3→핫샷, 소년판타지 홍성민 4→판타지보이즈, 박재범&률→롱샷).
--       SF9 공식 'Mute is Off' 챌린지 3건은 주인 SF9 유지(게스트만 with). 그대로: 애프터스쿨 마마돌 직캠 JJtECn57Ks8. 되돌리기: auto_outsider_fix2_2026-11-04_undo.sql
create table if not exists public.bak_auto_outsider2_20261104 as select id,group_ko,members,with_members,tags_manual,now() backed_at from public.yt_channel_videos where id in ('4q34Z0Zyw9M','FjnHGJtM_aQ','7Zp12EXMUxo','q4R3jBXDi_Y','mNr-ZUDA2YI','PudolBMq-ZY','_WRsjY7VsKs','3JUTF4vfKwg','hc5VQ2Zz5I0','LGq7A3C-lo8');
alter table public.bak_auto_outsider2_20261104 enable row level security;
create temp table lp(id text,g0 text,m0 text[],w0 text[],g1 text,m1 text[],w1 text[]);
insert into lp values
('4q34Z0Zyw9M','엔시티 위시',ARRAY['수빈','시온','사쿠야']::text[],'{}'::text[],'엔시티 위시',ARRAY['시온','사쿠야']::text[],'{}'::text[]),
('FjnHGJtM_aQ','제로베이스원',ARRAY['니콜라스','마키']::text[],'{}'::text[],'제로베이스원','{}'::text[],ARRAY['니콜라스(앤팀)','마키(앤팀)']::text[]),
('7Zp12EXMUxo','몬스타엑스',ARRAY['방찬','현진']::text[],ARRAY['방찬(스트레이키즈)']::text[],'몬스타엑스','{}'::text[],ARRAY['방찬(스트레이키즈)','현진(스트레이키즈)']::text[]),
('q4R3jBXDi_Y','피원하모니',ARRAY['현진']::text[],'{}'::text[],'피원하모니','{}'::text[],ARRAY['현진(루셈블)']::text[]),
('mNr-ZUDA2YI','피원하모니',ARRAY['민재']::text[],'{}'::text[],'피원하모니','{}'::text[],ARRAY['민재(싸이커스)']::text[]),
('PudolBMq-ZY','피원하모니',ARRAY['나나']::text[],'{}'::text[],'피원하모니','{}'::text[],ARRAY['나나(유니스)']::text[]),
('_WRsjY7VsKs','피원하모니',ARRAY['세은','헌터']::text[],'{}'::text[],'피원하모니','{}'::text[],ARRAY['세은(싸이커스)','헌터(싸이커스)']::text[]),
('3JUTF4vfKwg','피원하모니',ARRAY['소희']::text[],'{}'::text[],'피원하모니','{}'::text[],ARRAY['소희(라이즈)']::text[]),
('hc5VQ2Zz5I0','피원하모니',ARRAY['의주']::text[],'{}'::text[],'피원하모니','{}'::text[],ARRAY['의주(앤팀)']::text[]),
('LGq7A3C-lo8','픽시',ARRAY['이의']::text[],'{}'::text[],'픽시','{}'::text[],'{}'::text[]);
update public.yt_channel_videos t set tags_manual=false from lp where t.id=lp.id and t.tags_manual=true and t.group_ko=lp.g0 and t.members=lp.m0 and coalesce(t.with_members,'{}'::text[])=lp.w0;
update public.yt_channel_videos t set group_ko=lp.g1, members=lp.m1, with_members=lp.w1 from lp where t.id=lp.id and t.tags_manual=false and t.group_ko=lp.g0 and t.members=lp.m0 and coalesce(t.with_members,'{}'::text[])=lp.w0;
update public.yt_channel_videos t set tags_manual=true from lp where t.id=lp.id;
select count(*) total, count(*) filter (where t.members is distinct from b.members or t.with_members is distinct from b.with_members or t.group_ko is distinct from b.group_ko) changed, count(*) filter (where t.tags_manual) locked from public.bak_auto_outsider2_20261104 b join public.yt_channel_videos t using(id);
