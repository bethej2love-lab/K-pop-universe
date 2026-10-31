-- Codex 감사18차 확정분 정정(2026-10-28) — 되돌리기: codex_audit18_fix_2026-10-28_undo.sql (백업 ops_codex_audit18_bak_20261028)
-- ① 게스트 소급에서 잘못 붙은 13행: 로스터 밖 그룹의 같은 이름(BXB 하민·현우, LUCY 신예찬, 아이몬드 아현, 퀸즈아이 나린)·커버 원곡 크레딧(박우진·백예린)
-- ② 원팩트 '꺼져'(본인 곡 FXX OFF의 한글 제목) 30행이 씨스타 효린 원곡으로 잡힌 것 → 원곡 비우고 원곡 잠금
-- ③ 박준희(솔로 a0755) Supernova 5행 — 10-28 정정 때 '무관'으로 숨긴 것을 박준희 솔로로 복원(태그 잠금)
create table if not exists ops_codex_audit18_bak_20261028 as
  select id,group_ko,members,with_members,with_groups,cover_of_members,cover_of_song,cover_manual,content_flag,tags_manual from yt_channel_videos where false;
-- audit35: SQL 복구 전용 백업은 공개 클라이언트 접근을 허용하지 않는다.
alter table public.ops_codex_audit18_bak_20261028 enable row level security;
revoke all on table public.ops_codex_audit18_bak_20261028 from public, anon, authenticated;
-- audit35:end
insert into ops_codex_audit18_bak_20261028
  select id,group_ko,members,with_members,with_groups,cover_of_members,cover_of_song,cover_manual,content_flag,tags_manual from yt_channel_videos
  where (id in ('-jslU5tVgrM','5CCfpnnkBV0','6DW2WRQPPb0','FaoJZUv1-0g','GyQou1z3aic','cIToocIVva0','fWeultLXmjc','fR-UTazKECA','j64iNxjmunA','u_K6h9LGHds','UkGNK8VJ3dM','UiltvNaBKPI','_m74X8nXGhY',
                'HuFEbyEaAWA','5yQMdNJNieo','H_kcA3z-LVc','6p0Yyn5EOD0','qyRP2PCgx3s')
     or (group_ko='원팩트' and cover_of_members @> array['효린(씨스타)'] and cover_of_song='꺼져'))
    and id not in (select id from ops_codex_audit18_bak_20261028);

-- ① 잘못 붙은 게스트만 뺀다(원래 있던 다른 with는 그대로)
with v(id,bad) as (values
  ('-jslU5tVgrM',array['현우(싸이커스)','하민(플레이브)']),('u_K6h9LGHds',array['현우(싸이커스)','하민(플레이브)']),
  ('fWeultLXmjc',array['현우(싸이커스)']),('j64iNxjmunA',array['현우(싸이커스)']),('_m74X8nXGhY',array['현우(싸이커스)']),
  ('UiltvNaBKPI',array['하민(플레이브)']),
  ('5CCfpnnkBV0',array['신예찬(티아이오티)']),('GyQou1z3aic',array['신예찬(티아이오티)']),('fR-UTazKECA',array['신예찬(티아이오티)']),
  ('6DW2WRQPPb0',array['아현(베이비몬스터)']),('FaoJZUv1-0g',array['나린(미야오)']),
  ('UkGNK8VJ3dM',array['박우진(워너원)']),('cIToocIVva0',array['백예린(피프틴앤드)'])
)
update yt_channel_videos y set with_members=array(select x from unnest(y.with_members) x where not (x = any(v.bad)))
from v where v.id=y.id and coalesce(y.tags_manual,false)=false;

-- ② 원팩트 꺼져 — 원곡 비우고 잠금(다시 자동으로 붙지 않게)
update yt_channel_videos set cover_of_members=array_remove(cover_of_members,'효린(씨스타)'),cover_of_song=null,cover_manual=true
where group_ko='원팩트' and cover_of_members @> array['효린(씨스타)'] and cover_of_song='꺼져';

-- ③ 박준희 Supernova — 잠금 행이 있어 false → 수정 → true 3단계(트리거가 태그 칸을 되돌림)
update yt_channel_videos set tags_manual=false where id in ('HuFEbyEaAWA','5yQMdNJNieo','H_kcA3z-LVc','6p0Yyn5EOD0','qyRP2PCgx3s');
update yt_channel_videos set group_ko='박준희',members='{}',with_members='{}',with_groups='{}',content_flag=null
where id in ('HuFEbyEaAWA','5yQMdNJNieo','H_kcA3z-LVc','6p0Yyn5EOD0','qyRP2PCgx3s');
update yt_channel_videos set tags_manual=true where id in ('HuFEbyEaAWA','5yQMdNJNieo','H_kcA3z-LVc','6p0Yyn5EOD0','qyRP2PCgx3s');
