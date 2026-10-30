-- '호우'(폭우·감탄사·드라마 인물)가 god 유닛 호우(손호영·김태우)로 잡힌 것 정정 (2026-10-30, Codex 검수25차 후속)
-- 진짜 호우 영상 5건(Bz9XEdTnV7E, G8Oqec5-8YU, ePhxElpWk0I, 57dY6zQ3DDs, -aePOArR2qA)은 그대로 둔다. 1UFYiyX0p1Y는 이미 보류라 제외.
create table if not exists _bak_hoow_god_20261030 as
  select id,group_ko,members,with_members,with_groups,tags_manual,content_flag,flag_source,flagged_at from yt_channel_videos
  where id in ('DizntQpN_wE','0Lx0NriNYWk','9BMPXHSQW70','xXiJIrUV77U','98lhOLApk_Y','XHseaOdy4bs','yZlejnvlqAw','xL_5D7lbaYQ');
alter table _bak_hoow_god_20261030 enable row level security;

-- 진짜 호우 라이브인데 레인보우로 배정돼 있던 것 → god 손호영·김태우
update yt_channel_videos set group_ko='god', members=array['손호영','김태우'], with_members=array[]::text[], tags_manual=true, needs_review=false
  where id='DizntQpN_wE' and coalesce(tags_manual,false)=false;
-- 세븐틴 13명 얼빡직캠 합본: '호우 주의'로 붙은 god 두 명 제거 + 빠진 준 추가(공식 설명 챕터 10:27 준)
update yt_channel_videos set members=array_append(members,'준'), with_members=array[]::text[], tags_manual=true, needs_review=false
  where id='0Lx0NriNYWk' and coalesce(tags_manual,false)=false and not ('준'=any(members));
-- 바다(S.E.S.) '국지성 호우' 라이브 → S.E.S. 바다 (기존 바다(BADA) 영상과 같은 관례)
update yt_channel_videos set group_ko='S.E.S.', members=array['바다'], tags_manual=true, needs_review=false
  where id in ('9BMPXHSQW70','xXiJIrUV77U') and group_ko='god' and coalesce(tags_manual,false)=false;
-- 주간아이돌 투어스 회차("호우~ Yeah!") → 투어스
update yt_channel_videos set group_ko='투어스', members=array[]::text[], tags_manual=true, needs_review=false
  where id='98lhOLApk_Y' and group_ko='god' and coalesce(tags_manual,false)=false;
-- god과 무관(드라마 넘버스 인물 '호우' 2건, 출처 불명 "???: 호우~" 1건) → 무관
update yt_channel_videos set content_flag='무관', flag_source='manual', flagged_at=now(), needs_review=false
  where id in ('yZlejnvlqAw','xL_5D7lbaYQ','XHseaOdy4bs') and group_ko='god' and coalesce(tags_manual,false)=false;

select id,group_ko,members,with_members,content_flag,tags_manual from yt_channel_videos
  where id in ('DizntQpN_wE','0Lx0NriNYWk','9BMPXHSQW70','xXiJIrUV77U','98lhOLApk_Y','XHseaOdy4bs','yZlejnvlqAw','xL_5D7lbaYQ');
