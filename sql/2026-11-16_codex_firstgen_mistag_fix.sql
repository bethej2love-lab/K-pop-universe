-- 2026-11-16 Codex 1세대 검수 + 11-15 일괄 복원으로 풀린 보류 복구 (1차: 사람·그룹이 아예 틀린 것)
-- 제목을 건별로 읽고 판정. 보류는 flag_source='manual'. 되돌리기: 2026-11-16_codex_firstgen_mistag_fix_undo.sql
-- BEGIN 없음(실행기 규칙). tags_manual=true 행은 건드리지 않는다.

create table if not exists bak_20261116_codex_firstgen as
select id, group_ko, members, with_members, with_groups, cover_of_groups, cover_of_members, cover_of_song,
       content_flag, flag_source, tags_manual, now() as backed_at
from yt_channel_videos
where id in (
  'ETTSbMlrXgo','q5_Cc_ojnLs','2eucdlikIEA','evczkOZuEvI','hydm1fLgzgc','ITnXtOGkY0g','tuC1cAmFJgc','6HsQ71GqQ_4',
  'Che5W0sfd_I','QcJNco9ZwKA','K_IjsKt95ZQ','jz_EOGNfrlE','wiuNPaqO9jY','zSzEhculRno','GpxwGLPOnzA',
  '1vJ1Pu3Iz74','ceu1Nr33-N8','DioSGKFxowU','LRQnxKM1JZg','MXeY8eiY2yM','2uhr__Hm5cA','OgU09781xNI','QsH10p4W_Gc',
  'akg79xgLK7s','Y0r50JJ9eqY','Zu6n2mYnQN0','6itY9tdrrMI','j_lTRnEWQ4M',
  '-VcBdC1MKN0','7DN_6iVx_yY','fUik1XcjRzo','gKkkIFc0Xtg','JL9Yd6Y6Izs','xUxDTKMwfEE','b0U1iaWUkks','NHjAmpTq5rc','NpfWPEITt7A','pErTpOtvI-I','EVqYP9EoaP0',
  'pIUXq-Djv7U','uBSPIVIse_E','bphJ-QUVeDM','uMUSh1PKyNY',
  '1zCdxqV4Bgg','knuwkAtfcrI','L4caZSePKxc','lLqznjJgKic','uV_KegZklE0','onKSGKgCN3A','Xo7rWg2tRMY',
  'CIM3OMes67w','hmcUXzmshsg','KPB8tRDYb_4','lh1LBszMDOY','i50V0iLHJWg','yB_to6Gd6r4','Jz4dOAS-hAs','zfhPjMq6ROQ',
  'OiblIYkbBUQ','bMQeDbDlWfw','X40kcKvIAkY','b6z74h1gAxY'
)
or (group_ko='샤크라' and members @> array['이니'] and content_flag is null);
alter table bak_20261116_codex_firstgen enable row level security;

-- ① 보류(manual): 등록 아티스트와 무관한 동명이인·일반어
--   바다 솔로 키=이바다 2 · 베이비복스=별개 2기 Re.V 5 + 꽃잠프로젝트 김이지 1 · 슈가 박수진=평론가2·변호사1·동명 가수1
--   신화=일반어 2 + 영화 배역 '앤디' 1 · 젝스키스 장수원=도시 수원 4 · 쥬얼리=장신구 2 · 클릭비=배우 김태형·유연석 2
--   핑클=배구선수·숏박스 이진 2 + 유니버스 티켓 참가자 커버 2 · god=태우&재희 1 + 개그맨 박준형 11
--   H.O.T.=일반어 강타 2 + 배우 이재원 2 · S.E.S. 바다=SUNYO 곡·BEBE 바다·댄서 바다·MAX·치즈·걸스플래닛 7
--   S.E.S. 유진=배우 이유진·솔로지옥 정유진 3·H-Eugene·ARTBEAT v 6 · SS501 박정민=배우 박정민 2
update yt_channel_videos set content_flag='보류', flag_source='manual'
where tags_manual is not true and content_flag is null and id in (
  'ETTSbMlrXgo','q5_Cc_ojnLs','2eucdlikIEA','evczkOZuEvI','hydm1fLgzgc','ITnXtOGkY0g','tuC1cAmFJgc','6HsQ71GqQ_4',
  'Che5W0sfd_I','QcJNco9ZwKA','K_IjsKt95ZQ','jz_EOGNfrlE','wiuNPaqO9jY','zSzEhculRno','GpxwGLPOnzA',
  '1vJ1Pu3Iz74','ceu1Nr33-N8','DioSGKFxowU','LRQnxKM1JZg','MXeY8eiY2yM','2uhr__Hm5cA','OgU09781xNI','QsH10p4W_Gc',
  'akg79xgLK7s','Y0r50JJ9eqY','Zu6n2mYnQN0','6itY9tdrrMI','j_lTRnEWQ4M',
  '-VcBdC1MKN0','7DN_6iVx_yY','fUik1XcjRzo','gKkkIFc0Xtg','JL9Yd6Y6Izs','xUxDTKMwfEE','b0U1iaWUkks','NHjAmpTq5rc','NpfWPEITt7A','pErTpOtvI-I','EVqYP9EoaP0',
  'pIUXq-Djv7U','uBSPIVIse_E','bphJ-QUVeDM','uMUSh1PKyNY',
  '1zCdxqV4Bgg','knuwkAtfcrI','L4caZSePKxc','lLqznjJgKic','uV_KegZklE0','onKSGKgCN3A','Xo7rWg2tRMY',
  'CIM3OMes67w','hmcUXzmshsg','KPB8tRDYb_4','lh1LBszMDOY','i50V0iLHJWg','yB_to6Gd6r4','Jz4dOAS-hAs','zfhPjMq6ROQ'
);

-- ② 샤크라 '이니' = 일본 그룹 INI(미등록) + 인도네시아어 "hari ini" 1건 — 제목 전수 확인, 풀려 있던 것만 보류
update yt_channel_videos set content_flag='보류', flag_source='manual'
where tags_manual is not true and content_flag is null
  and id in (select id from bak_20261116_codex_firstgen where group_ko='샤크라' and members @> array['이니']);

-- ③ 제 주인에게 옮김(등록된 아티스트의 정상 영상)
update yt_channel_videos set group_ko='아이유', members=array['아이유']
 where id='OiblIYkbBUQ' and group_ko='쥬얼리' and tags_manual is not true;               -- 디스패치 아이유 현장("jewelry"는 비유)
update yt_channel_videos set group_ko='아이브', members=array['안유진']
 where id='bMQeDbDlWfw' and group_ko='S.E.S.' and tags_manual is not true;               -- PEPSIxSTARSHIP YUJIN = 안유진
update yt_channel_videos set group_ko='아이브', members=array['안유진','이서']
 where id='X40kcKvIAkY' and group_ko='S.E.S.' and tags_manual is not true;               -- 아이돌라디오 유진&이서 LOVE DIVE
update yt_channel_videos set group_ko='오마이걸', members='{}', with_groups=array['온앤오프']
 where id='b6z74h1gAxY' and group_ko='S.E.S.' and tags_manual is not true;               -- 로드투킹덤 "텐션의 바다" 오마이걸·온앤오프

select 'backup' k, count(*) n from bak_20261116_codex_firstgen
union all select 'held_now', count(*) from yt_channel_videos where id in (select id from bak_20261116_codex_firstgen) and content_flag='보류' and flag_source='manual'
union all select 'moved', count(*) from yt_channel_videos where id in ('OiblIYkbBUQ','bMQeDbDlWfw','X40kcKvIAkY','b6z74h1gAxY') and group_ko in ('아이유','아이브','오마이걸');

-- ④ (추가) 사용자 제보 — 슈퍼주니어 성민 Show 페이지: 티아라 효민 'Nice Body'(feat. SPEED 성민) 2건이 슈퍼주니어 성민으로 붙어 있었음 → 티아라 효민
--    되돌리기: update yt_channel_videos set group_ko='슈퍼주니어', members=array['성민'] where id in ('pk0uJaZ0DCM','tjaHF4uBDCA');
update yt_channel_videos set group_ko='티아라', members=array['효민']
 where id in ('pk0uJaZ0DCM','tjaHF4uBDCA') and group_ko='슈퍼주니어' and tags_manual is not true;
