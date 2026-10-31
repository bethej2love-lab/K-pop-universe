-- 다른 그룹 게스트 소급(2026-10-28) — 제목 파서 게스트 단계(admin.js _m2ParseTitle)를 기존 영상 24.7만 개(해시태그/콜라보 표시 있는 제목)에 돌려
-- 빠진 게스트만 with_members에 **추가**(기존 값 삭제 없음). tags_manual=true·무관 행 제외, 이미 있는 이름 제외. 2차: 함께 표시는 없지만 그 사람 그룹명이 같이 적힌 것(25건, 전부 검토).
-- 되돌리기: guest_backfill_2026-10-28b_undo.sql (백업 ops_guest_backfill_bak_20261028)
create table if not exists ops_guest_backfill_bak_20261028 as select id,with_members from yt_channel_videos where false;
-- audit35: SQL 복구 전용 백업은 공개 클라이언트 접근을 허용하지 않는다.
alter table public.ops_guest_backfill_bak_20261028 enable row level security;
revoke all on table public.ops_guest_backfill_bak_20261028 from public, anon, authenticated;
-- audit35:end
with v(id,adds) as (values
('1FTnvXhb8Sk',array['전민욱(클로즈유어아이즈)']::text[]),
('1ozpxnDvX-A',array['위연정(영파씨)']::text[]),
('1ICIn_CS9C8',array['전민욱(클로즈유어아이즈)']::text[]),
('5D7f5BXr-E8',array['김규래(판타지보이즈)']::text[]),
('6u4YBDYqPn8',array['전효성(시크릿)']::text[]),
('BCB2pYh49To',array['필릭스(스트레이키즈)']::text[]),
('KohxaWdzCK0',array['전민욱(클로즈유어아이즈)']::text[]),
('KiTXwjGALOs',array['송승호(클로즈유어아이즈)']::text[]),
('KXI5zNI4540',array['서은광(비투비)']::text[]),
('bQuCww60JWE',array['로렌스(엔싸인)']::text[]),
('bmAvmrj2cY8',array['송승호(클로즈유어아이즈)']::text[]),
('cTrVaSftukU',array['타쿠마(루네이트)']::text[]),
('dHX8pKC9fA0',array['이한빈(판타지보이즈)']::text[]),
('fTNZ-nTRhq4',array['하기와(하츠웨이브)']::text[]),
('kaS3ywGRph4',array['장여준(클로즈유어아이즈)']::text[]),
('mJ3XYhGxuJY',array['데니안(god)']::text[]),
('n4JZZWg0WgI',array['홍성민(판타지보이즈)']::text[]),
('oD3SfgGMuR8',array['서이(하이키)']::text[]),
('pF2roUWPz0U',array['유회승(엔플라잉)']::text[]),
('pG6UhrwBc8I',array['카즈타(엔싸인)']::text[]),
('qrhpQMmj6mE',array['김규래(판타지보이즈)']::text[]),
('uqdyiA6p04Y',array['전민욱(클로즈유어아이즈)']::text[]),
('uunvy4vOae4',array['지아나(영파씨)']::text[]),
('vHtpBQHVu28',array['전민욱(클로즈유어아이즈)']::text[]),
('MYzKXqq9GbA',array['장여준(클로즈유어아이즈)']::text[])
), bk as (
  insert into ops_guest_backfill_bak_20261028
  select y.id,y.with_members from yt_channel_videos y join v on v.id=y.id
  where coalesce(y.tags_manual,false)=false and not exists (select 1 from ops_guest_backfill_bak_20261028 b where b.id=y.id)
  returning id
)
update yt_channel_videos y
set with_members=coalesce(y.with_members,'{}')||array(select x from unnest(v.adds) x where not (x = any(coalesce(y.with_members,'{}'))))
from v
where v.id=y.id and coalesce(y.tags_manual,false)=false and coalesce(y.content_flag,'')<>'무관'
  and not (coalesce(y.with_members,'{}') @> v.adds);
