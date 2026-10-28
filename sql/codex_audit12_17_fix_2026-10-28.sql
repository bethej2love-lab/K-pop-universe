-- Codex 콘텐츠 감사 12~17차 확정분 정정 (2026-10-28, Claude Code 실행)
-- 근거는 CHANGELOG 각 차수(공식 원본 제목·설명·업로더 확인). 손으로 고친 값이라 tags_manual=true(+원곡 손댄 행은 cover_manual=true).
-- 잠금 행은 트리거가 태그 칸을 되돌리므로 잠금 해제 → 수정 → 다시 잠금 3단계. 되돌리기: sql/codex_audit12_17_fix_2026-10-28_undo.sql
create table if not exists ops_codex_audit1217_bak_20261028 as
  select id,group_ko,members,with_members,with_groups,cover_of_groups,cover_of_members,cover_of_song,content_flag,tags_manual,cover_manual
  from yt_channel_videos where id in (
  '5ktFi9dQRS8','E6NoNjLB3kE','MqsL0x8tB6A','iwV6FIy19mc','h8hsNPHnlOg','VvJIewUm9NI','ZdBSXx4NeLE','CdtyNLhIltI','VNm6cx1bQ-w',
  'ohba7H-LU3k','h0YKWFy3sBk','GyzIExzOTlk','Fio5Y289ydQ','boeq3r3mUTo','QieM1oxUFUI','doSdRpg_I74','QSq45NseYCw','uHEBJ8Ju2WY',
  'G-eEmJsvops','HuFEbyEaAWA','WkFbPhu1ulI','w_vu3JgzCR4','oiF1Fk1er3Y','p0OMHmqqgrc','Qlom91CiSos','wvhwWTl6oJ8','RxIKoRM1hKI',
  'uNvboP95Z8s','iuG8Zvkf-Qk','a__d5ZOKLz8','-E0ty8M8Qgk');
alter table ops_codex_audit1217_bak_20261028 enable row level security;

-- 1단계: 대상 전부 잠금 해제(아래에서 다시 잠근다)
update yt_channel_videos set tags_manual=false, cover_manual=false where id in (select id from ops_codex_audit1217_bak_20261028);

-- 정은지(에이핑크) 직캠이 브브걸 은지로 간 것 — 제목 'EunJi'가 브브걸 은지 영문명에 걸림(17차, 13차 h8hs)
update yt_channel_videos set group_ko='에이핑크', members=array['정은지'] where id in ('5ktFi9dQRS8','E6NoNjLB3kE','MqsL0x8tB6A','iwV6FIy19mc','h8hsNPHnlOg');
-- 요섭 & 은지 'Love Day'(2012, 공식 설명 에이핑크·비스트 재생목록)
update yt_channel_videos set group_ko='에이핑크', members=array['정은지'], with_members=array['양요섭(하이라이트)'] where id='VvJIewUm9NI';
-- 싱터뷰: 정은지·한선화(+배우 이선빈은 동명 아이돌로 연결 안 함)
update yt_channel_videos set group_ko='에이핑크', members=array['정은지'], with_members=array['한선화(시크릿)'] where id='ZdBSXx4NeLE';
-- 채널십오야 헬스클럽: #정은지 #이준영 = 유키스 준
update yt_channel_videos set group_ko='에이핑크', members=array['정은지'], with_members=array['준(유키스)'] where id='CdtyNLhIltI';
-- TMI NEWS SHOW: 라잇썸 나영·유정(브브걸 유정 아님)
update yt_channel_videos set group_ko='라잇썸', members=array['나영','유정'] where id='VNm6cx1bQ-w';
-- 부석순 × GD(지디 실제 동반 출연 — 원본 제목·자막)
update yt_channel_videos set with_members=array['지디(빅뱅)'] where id in ('ohba7H-LU3k','h0YKWFy3sBk','GyzIExzOTlk');
-- 브브걸 단체 무대·출연인데 [은지]만: 단체는 멤버 비움(그룹 전체), 초대석은 스페셜 DJ 미연 함께, '민영&유나' 챌린지는 둘만
update yt_channel_videos set members='{}' where id in ('Fio5Y289ydQ','boeq3r3mUTo');
update yt_channel_videos set members='{}', with_members=array['미연(아이들)'] where id='QieM1oxUFUI';
update yt_channel_videos set members=array['민영','유나'] where id='doSdRpg_I74';
-- 동그란송형준 '동그리키재기': 형준 개인 영상 + 아이브 레이(크래비티 전원 아님)
update yt_channel_videos set members=array['형준'] where id='QSq45NseYCw';
-- 2011 엘르 JYJ: 재중·유천·준수(동방신기 현역 전원 카드로 퍼지던 것)
update yt_channel_videos set members=array['김재중','박유천','김준수'] where id='uHEBJ8Ju2WY';
-- (여자)아이들 리액션캠: 슈퍼노바(초신성) 그룹이 아니라 아이들 영상
update yt_channel_videos set group_ko='아이들', members='{}', with_groups='{}' where id='G-eEmJsvops';
-- JUNHEE 'Supernova': 같은 영상 묶음 4개처럼 무관(우리 아티스트 아님)
update yt_channel_videos set content_flag='무관' where id='HuFEbyEaAWA';
-- 재현 X 이영지 'I Need A Girl': 이영지는 함께 춘 사람이지 원곡자가 아님(원곡 태양)
update yt_channel_videos set with_members=array['이영지(솔로)'], cover_of_members=array['태양(빅뱅)'] where id='WkFbPhu1ulI';
-- NINE.i 민준 'Candy' 커버: 원곡 백현만(엔시티 드림 Candy 잔존 제거)
update yt_channel_videos set cover_of_groups='{}' where id='w_vu3JgzCR4';
-- 지구오락실(디글 공식 #이은지 #미미 #이영지 #안유진): 코미디언 이은지를 브브걸 은지로 붙인 것 → 실제 아이돌 출연자로
update yt_channel_videos set group_ko='오마이걸', members=array['미미'], with_members=array['이영지(솔로)','안유진(아이브)'] where id in ('oiF1Fk1er3Y','p0OMHmqqgrc','Qlom91CiSos','wvhwWTl6oJ8');
-- 주간아이돌 모음: 유정 구간은 아이오아이 최유정(켄 구간과 다른 방송 장면이라 함께 출연으로 묶지 않음, 모음 클립)
update yt_channel_videos set group_ko='아이오아이', members=array['최유정'], content_flag='개별출연' where id='RxIKoRM1hKI';
-- 코미디언 이은지 단독 예능(아이돌 출연 근거 없음) → 무관
update yt_channel_videos set content_flag='무관' where id in ('uNvboP95Z8s','iuG8Zvkf-Qk','a__d5ZOKLz8','-E0ty8M8Qgk');

-- 3단계: 다시 잠금
update yt_channel_videos set tags_manual=true where id in (select id from ops_codex_audit1217_bak_20261028);
update yt_channel_videos set cover_manual=true where id in ('WkFbPhu1ulI','w_vu3JgzCR4');

select id,group_ko,members,with_members,cover_of_groups,cover_of_members,content_flag,tags_manual from yt_channel_videos
  where id in (select id from ops_codex_audit1217_bak_20261028) order by id;
