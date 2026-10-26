-- 콘텐츠 감사 6차 확정 26건: 실제 출연자 정정 16 / 미등록 출연자 무관 10.
-- Supabase SQL Editor 관리자 역할로 이 파일 전체를 한 번에 실행.
-- 실행 전 SELECT 미리보기 후 적용. 실패하면 전체 롤백: 부분 적용 없음.
-- 제목 검색/자동 추정 없음. 검증한 영상 ID와 준비 당시 태그가 정확히 맞는 행만 처리.
-- 준비 이후 수정된 행은 덮어쓰지 않고 예외로 중단. 이미 목표 상태면 건너뜀.
-- 원래 태그는 관리자 전용 백업 테이블에 저장. 복구 파일은 같은 이름의 _undo.sql.
-- views/category/source_handle 등은 변경하지 않음. 영상 삭제/새 아티스트 등록 없음.
-- 확인 대상 29건 중 AOA 1soCjDZs-9M/p7czpctf0cY, 아이키 fdDwNU7cvHU는 보류.
-- 원본 근거: 각 https://www.youtube.com/watch?v=<ID> 의 공식 제목/설명.
-- MC 세 명 추가 근거: https://ent.sbs.co.kr/news/article.do?article_id=E10010268189
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE codex_audit6_plan (
  id text PRIMARY KEY, action text NOT NULL, reason text NOT NULL,
  before_state jsonb NOT NULL, after_state jsonb NOT NULL
) ON COMMIT DROP;
INSERT INTO codex_audit6_plan VALUES
-- KBS CoolFM 공식 설명: 미래소년(MIRAE)의 EXO 첫눈 커버
('hIHioYAlU64','retag','KBS CoolFM 공식 설명: 미래소년(MIRAE)의 EXO 첫눈 커버',
 '{"id":"hIHioYAlU64","title":"💫 스젵 노래방 LIVE | 미래소년의 ‘첫눈’ | 원곡 : EXO(엑소) | STATION Z | KBS 230107 방송","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"hIHioYAlU64","title":"💫 스젵 노래방 LIVE | 미래소년의 ‘첫눈’ | 원곡 : EXO(엑소) | STATION Z | KBS 230107 방송","group_ko":"미래소년","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["엑소"],"cover_of_members":[],"cover_of_song":"첫눈","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- THE K-POP MC NAEggUZ 공연 + SBS 공식 2023-03-28 기사로 여상·샤오쥔·형섭 확인
('08vzsuA6r5w','retag','THE K-POP MC NAEggUZ 공연 + SBS 공식 2023-03-28 기사로 여상·샤오쥔·형섭 확인',
 '{"id":"08vzsuA6r5w","title":"MC NAEggUZ, Bloomig Day (MC NAEggUZ, 花요일 (원곡: EXO-CBX (첸백시))) [THE SHOW 230328]","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"08vzsuA6r5w","title":"MC NAEggUZ, Bloomig Day (MC NAEggUZ, 花요일 (원곡: EXO-CBX (첸백시))) [THE SHOW 230328]","group_ko":"에이티즈","members":["여상"],"with_members":["샤오쥔(웨이션브이)","형섭(템페스트)"],"with_groups":["웨이션브이","템페스트"],"cover_of_groups":["엑소"],"cover_of_members":["첸(엑소)","백현(엑소)","시우민(엑소)"],"cover_of_song":"花요일 (Blooming Day)","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- Mnet K-POP TMI SHOW 공식 설명: 김요한의 커버무대 재연
('m3RCLQFeb7E','retag','Mnet K-POP TMI SHOW 공식 설명: 김요한의 커버무대 재연',
 '{"id":"m3RCLQFeb7E","title":"[ENG] [TMI SHOW/4회] ♥사랑해요 김요한♥ 레전드 커버 무대 재연! 김요한의 〈EXO - Love Shot〉#TMISHOW I EP.4 | Mnet 220302 방송","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"m3RCLQFeb7E","title":"[ENG] [TMI SHOW/4회] ♥사랑해요 김요한♥ 레전드 커버 무대 재연! 김요한의 〈EXO - Love Shot〉#TMISHOW I EP.4 | Mnet 220302 방송","group_ko":"위아이","members":["김요한"],"with_members":[],"with_groups":[],"cover_of_groups":["엑소"],"cover_of_members":[],"cover_of_song":"Love Shot","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- THE IDOL × Nikon 원 업로드 제목 료·재희, 설명 #nctwish
('jTYtwkHzBi4','retag','THE IDOL × Nikon 원 업로드 제목 료·재희, 설명 #nctwish',
 '{"id":"jTYtwkHzBi4","title":"엔시티위시 료 재희, 엑소 ''첫 눈'' 커버","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"jTYtwkHzBi4","title":"엔시티위시 료 재희, 엑소 ''첫 눈'' 커버","group_ko":"엔시티 위시","members":["료","재희"],"with_members":[],"with_groups":[],"cover_of_groups":["엑소"],"cover_of_members":[],"cover_of_song":"첫눈","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- M2 공식 설명: 오지구영 보이넥스트도어 편, 리우 커버
('6sMDnNYSSEE','retag','M2 공식 설명: 오지구영 보이넥스트도어 편, 리우 커버',
 '{"id":"6sMDnNYSSEE","title":"EXO ''Cream Soda'' 리우가 말아 주는 청량한 크림 소다 커버 | 오지구영 #shorts","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"6sMDnNYSSEE","title":"EXO ''Cream Soda'' 리우가 말아 주는 청량한 크림 소다 커버 | 오지구영 #shorts","group_ko":"보이넥스트도어","members":["리우"],"with_members":[],"with_groups":[],"cover_of_groups":["엑소"],"cover_of_members":[],"cover_of_song":"Cream Soda","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- ALL THE K-POP Weekly Playlist 공식 설명 2AM 커버
('_zcA8phBv1M','retag','ALL THE K-POP Weekly Playlist 공식 설명 2AM 커버',
 '{"id":"_zcA8phBv1M","title":"[Weekly Playlist] 2am이 부르는 ＜방탄소년단 - Permission to Dance＞ 커버 무대♬ Full ver. l EP.538","group_ko":"방탄소년단","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"_zcA8phBv1M","title":"[Weekly Playlist] 2am이 부르는 ＜방탄소년단 - Permission to Dance＞ 커버 무대♬ Full ver. l EP.538","group_ko":"2AM","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["방탄소년단"],"cover_of_members":[],"cover_of_song":"Permission to Dance","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- KBS CoolFM STATION Z 공식 제목 우아 공연·소녀시대 원곡 구분
('2Rm9E1OWutI','retag','KBS CoolFM STATION Z 공식 제목 우아 공연·소녀시대 원곡 구분',
 '{"id":"2Rm9E1OWutI","title":"💫스젵 노래방 LIVE | 우아(woo!ah!)의 ‘Kissing You’ | 원곡: 소녀시대 | STATION Z | KBS 220618 방송","group_ko":"소녀시대","members":[],"with_members":[],"with_groups":["우아"],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"2Rm9E1OWutI","title":"💫스젵 노래방 LIVE | 우아(woo!ah!)의 ‘Kissing You’ | 원곡: 소녀시대 | STATION Z | KBS 220618 방송","group_ko":"우아","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["소녀시대"],"cover_of_members":[],"cover_of_song":"Kissing You","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- FNCEnt 공식 설명 Cherry Bullet Quest 커버 연습 영상
('QKPE4M1szmU','retag','FNCEnt 공식 설명 Cherry Bullet Quest 커버 연습 영상',
 '{"id":"QKPE4M1szmU","title":"Cherry Bullet - [COVER] 소녀시대 ‘다시 만난 세계’ PRACTICE VIDEO (Live Ver.)","group_ko":"소녀시대","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"QKPE4M1szmU","title":"Cherry Bullet - [COVER] 소녀시대 ‘다시 만난 세계’ PRACTICE VIDEO (Live Ver.)","group_ko":"체리블렛","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["소녀시대"],"cover_of_members":[],"cover_of_song":"다시 만난 세계","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- 1theK 공식 수빈 직캠: WJSN SOOBIN Dance Cover
('VDzOKzQgaao','retag','1theK 공식 수빈 직캠: WJSN SOOBIN Dance Cover',
 '{"id":"VDzOKzQgaao","title":"우주소녀 수빈 미스터 츄 직캠 | WJSN SOOBIN fancam | 에이핑크(Apink) | Mr. Chu | 올라운돌(All Rounder IDOL) | Dance Cover","group_ko":"에이핑크","members":[],"with_members":["수빈(우주소녀)"],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"VDzOKzQgaao","title":"우주소녀 수빈 미스터 츄 직캠 | WJSN SOOBIN fancam | 에이핑크(Apink) | Mr. Chu | 올라운돌(All Rounder IDOL) | Dance Cover","group_ko":"우주소녀","members":["수빈"],"with_members":[],"with_groups":[],"cover_of_groups":["에이핑크"],"cover_of_members":[],"cover_of_song":"Mr. Chu","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- 1theK 공식 루다 직캠: WJSN LUDA Dance Cover, 출연/원곡 뒤바뀜
('RGHDfPDM7t8','retag','1theK 공식 루다 직캠: WJSN LUDA Dance Cover, 출연/원곡 뒤바뀜',
 '{"id":"RGHDfPDM7t8","title":"우주소녀 루다 ''미스터 츄'' 직캠 | WJSN LUDA fancam | 에이핑크(Apink) | Mr. Chu | 올라운돌(All Rounder IDOL) | Dance Cover","group_ko":"에이핑크","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["우주소녀"],"cover_of_members":[],"cover_of_song":"미스터 츄","tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"RGHDfPDM7t8","title":"우주소녀 루다 ''미스터 츄'' 직캠 | WJSN LUDA fancam | 에이핑크(Apink) | Mr. Chu | 올라운돌(All Rounder IDOL) | Dance Cover","group_ko":"우주소녀","members":["루다"],"with_members":[],"with_groups":[],"cover_of_groups":["에이핑크"],"cover_of_members":[],"cover_of_song":"Mr. Chu","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- 1theK 공식 우주소녀 단체 미스터 츄 커버
('pD-3bQTXczA','retag','1theK 공식 우주소녀 단체 미스터 츄 커버',
 '{"id":"pD-3bQTXczA","title":"Butterfly처럼 날아온 우주소녀의 미스터 츄 커버 (feat. 테니스복) | WJSN | 에이핑크(Apink) | Mr. Chu | 올라운돌 | Dance Cover","group_ko":"에이핑크","members":[],"with_members":[],"with_groups":["우주소녀"],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"pD-3bQTXczA","title":"Butterfly처럼 날아온 우주소녀의 미스터 츄 커버 (feat. 테니스복) | WJSN | 에이핑크(Apink) | Mr. Chu | 올라운돌 | Dance Cover","group_ko":"우주소녀","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["에이핑크"],"cover_of_members":[],"cover_of_song":"Mr. Chu","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- ALL THE K-POP 공식 와장찬(Y·장준·주찬) 커버 직캠, 오렌지캬라멜은 원곡
('PFf0E7vKHx0','retag','ALL THE K-POP 공식 와장찬(Y·장준·주찬) 커버 직캠, 오렌지캬라멜은 원곡',
 '{"id":"PFf0E7vKHx0","title":"[주간아 직캠] 골든차일드 ''와장찬(Y, 장준, 주찬)''의 오렌지캬라멜 ＜마법소녀＞ 커버 직캠 Ver. l EP.574","group_ko":"골든차일드","members":["이장준","홍주찬"],"with_members":["레이나(애프터스쿨)","나나(애프터스쿨)","리지(애프터스쿨)"],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"PFf0E7vKHx0","title":"[주간아 직캠] 골든차일드 ''와장찬(Y, 장준, 주찬)''의 오렌지캬라멜 ＜마법소녀＞ 커버 직캠 Ver. l EP.574","group_ko":"골든차일드","members":["Y","이장준","홍주찬"],"with_members":[],"with_groups":[],"cover_of_groups":["애프터스쿨"],"cover_of_members":["레이나(애프터스쿨)","나나(애프터스쿨)","리지(애프터스쿨)"],"cover_of_song":"마법소녀","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- Golden Child 공식 김지범 COVER, Y는 원곡자
('ALRdzrC6Hr0','retag','Golden Child 공식 김지범 COVER, Y는 원곡자',
 '{"id":"ALRdzrC6Hr0","title":"김지범(Golden Child) - ''바람이라면'' COVER (원곡 : Y)","group_ko":"골든차일드","members":["Y","김지범"],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"ALRdzrC6Hr0","title":"김지범(Golden Child) - ''바람이라면'' COVER (원곡 : Y)","group_ko":"골든차일드","members":["김지범"],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":["Y(골든차일드)"],"cover_of_song":"바람이라면","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- MBCkpop 공식 가희 솔로 Its Me; 기존 가희 솔로 저장 형식과 일치시킴
('Y0nHVkxjytE','retag','MBCkpop 공식 가희 솔로 Its Me; 기존 가희 솔로 저장 형식과 일치시킴',
 '{"id":"Y0nHVkxjytE","title":"KAHI - its me, 가희 - 잇츠미, Show Champion 20131030","group_ko":"애프터스쿨","members":[],"with_members":["가희(가희)"],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"Y0nHVkxjytE","title":"KAHI - its me, 가희 - 잇츠미, Show Champion 20131030","group_ko":"가희","members":["가희"],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":true,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- MBCkpop 공식 가희 솔로 Its Me; 나나의 동반 출연으로 연결하지 않음
('jWlJsZMrNs4','retag','MBCkpop 공식 가희 솔로 Its Me; 나나의 동반 출연으로 연결하지 않음',
 '{"id":"jWlJsZMrNs4","title":"Kahi - It''s Me, 가희 - 잇츠미 Music Core 20131012","group_ko":"애프터스쿨","members":[],"with_members":["가희(가희)"],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"jWlJsZMrNs4","title":"Kahi - It''s Me, 가희 - 잇츠미 Music Core 20131012","group_ko":"가희","members":["가희"],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":true,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- KBS CoolFM 공식 TAN 공연·Block B 원곡 구분
('Zc3LS419_sw','retag','KBS CoolFM 공식 TAN 공연·Block B 원곡 구분',
 '{"id":"Zc3LS419_sw","title":"💫스젵 노래방 LIVE | TAN의 ‘YESTERDAY’ | 원곡: Block B | STATION Z | KBS 220709 방송","group_ko":"블락비","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"Zc3LS419_sw","title":"💫스젵 노래방 LIVE | TAN의 ‘YESTERDAY’ | 원곡: Block B | STATION Z | KBS 220709 방송","group_ko":"티에이엔","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["블락비"],"cover_of_members":[],"cover_of_song":"YESTERDAY","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
-- SBS 공식 SMTR25 연습생 커버, SMTR25 미등록; 엑소 공연 아님
('2tkcsLmxhT0','exclude','SBS 공식 SMTR25 연습생 커버, SMTR25 미등록; 엑소 공연 아님',
 '{"id":"2tkcsLmxhT0","title":"‘방송 최초 공개’ SMTR25, SM 연습생 25명의 특별한 ＜EXO - 으르렁＞ 커버 무대★","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"2tkcsLmxhT0","title":"‘방송 최초 공개’ SMTR25, SM 연습생 25명의 특별한 ＜EXO - 으르렁＞ 커버 무대★","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
-- KGMA_OFFICIAL SMTR25 늑대와 미녀 cover; SMTR25 미등록
('WBEX1Zrqw9Q','exclude','KGMA_OFFICIAL SMTR25 늑대와 미녀 cover; SMTR25 미등록',
 '{"id":"WBEX1Zrqw9Q","title":"EXO – 늑대와 미녀 #SMTR25 cover 🐺","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"WBEX1Zrqw9Q","title":"EXO – 늑대와 미녀 #SMTR25 cover 🐺","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
-- Mnet 공식 SM Trainee EXO Cover #SMTR25; SMTR25 미등록
('UC0_t-7Uk5o','exclude','Mnet 공식 SM Trainee EXO Cover #SMTR25; SMTR25 미등록',
 '{"id":"UC0_t-7Uk5o","title":"슴 연습생 엑소 커버 근본 있으시다 | 응답하라 하이스쿨","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"UC0_t-7Uk5o","title":"슴 연습생 엑소 커버 근본 있으시다 | 응답하라 하이스쿨","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
-- MUPLY 설명 Original Music EXO, 숨은 여성 보컬 커버; 가창자 미표기/미등록
('t0Nc7vCXq4Y','exclude','MUPLY 설명 Original Music EXO, 숨은 여성 보컬 커버; 가창자 미표기/미등록',
 '{"id":"t0Nc7vCXq4Y","title":"Tempo(템포) - 엑소(EXO) COVER by 커버리스트","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"t0Nc7vCXq4Y","title":"Tempo(템포) - 엑소(EXO) COVER by 커버리스트","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
-- KUTV 고려대학교 응원단 으르렁 커버, 등록 아티스트 공연 아님
('lrVRMSxj1i8','exclude','KUTV 고려대학교 응원단 으르렁 커버, 등록 아티스트 공연 아님',
 '{"id":"lrVRMSxj1i8","title":"고려대학교 응원단은 진짜 유명한 으르렁임 🐯❤‍🔥 #고려대 #고려대학교 #응원단 #EXO #으르렁 #커버 #고연전 #응원 #응원곡","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"lrVRMSxj1i8","title":"고려대학교 응원단은 진짜 유명한 으르렁임 🐯❤‍🔥 #고려대 #고려대학교 #응원단 #EXO #으르렁 #커버 #고연전 #응원 #응원곡","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
-- IDOL RADIO 공식 2Z Black Swan 커버, 2Z 미등록
('zFcISopPlww','exclude','IDOL RADIO 공식 2Z Black Swan 커버, 2Z 미등록',
 '{"id":"zFcISopPlww","title":"[IDOL RADIO] 200128 2Z(투지) - Black Swan (BTS) cover /아이돌 라디오 직캠","group_ko":"방탄소년단","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"zFcISopPlww","title":"[IDOL RADIO] 200128 2Z(투지) - Black Swan (BTS) cover /아이돌 라디오 직캠","group_ko":"방탄소년단","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
-- 1theK 고막소년단 봄날 커버, 폴킴·김민석·정승환·하현상·BIG Naughty 미등록
('0ppmuiaY1DM','exclude','1theK 고막소년단 봄날 커버, 폴킴·김민석·정승환·하현상·BIG Naughty 미등록',
 '{"id":"0ppmuiaY1DM","title":"BTS _ 봄날 (Spring Day) Cover | 폴킴 김민석 정승환 하현상 BIG Naughty | [고막소년단 Ep.0] GOMAK BOYS","group_ko":"방탄소년단","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"0ppmuiaY1DM","title":"BTS _ 봄날 (Spring Day) Cover | 폴킴 김민석 정승환 하현상 BIG Naughty | [고막소년단 Ep.0] GOMAK BOYS","group_ko":"방탄소년단","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
-- SBS Radio 공식 로시 Butter 커버, 로시 미등록
('XCGQx58v4TI','exclude','SBS Radio 공식 로시 Butter 커버, 로시 미등록',
 '{"id":"XCGQx58v4TI","title":"🎸기타와 함께하는 로시(Rothy)의 버터(Butter)🧈 | 원곡 : BTS (방탄소년단) | 최화정의 파워타임 #shorts","group_ko":"방탄소년단","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"XCGQx58v4TI","title":"🎸기타와 함께하는 로시(Rothy)의 버터(Butter)🧈 | 원곡 : BTS (방탄소년단) | 최화정의 파워타임 #shorts","group_ko":"방탄소년단","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
-- THE K-POP THE IDOL BAND P.O.P FIRE GROUND 경연 무대, 블락비 P.O 공연 아님; P.O.P 미등록
('OJxw-lKkdhI','exclude','THE K-POP THE IDOL BAND P.O.P FIRE GROUND 경연 무대, 블락비 P.O 공연 아님; P.O.P 미등록',
 '{"id":"OJxw-lKkdhI","title":"[THE IDOL BAND / 무대 풀버전] 🎤P.O.P - FIRE GROUND (원곡:오피셜히게단디즘(Official髭男dism))","group_ko":"블락비","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"OJxw-lKkdhI","title":"[THE IDOL BAND / 무대 풀버전] 🎤P.O.P - FIRE GROUND (원곡:오피셜히게단디즘(Official髭男dism))","group_ko":"블락비","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
-- THE K-POP THE IDOL BAND P.O.P FIRE GROUND 경연 무대, 블락비 공연 아님; P.O.P 미등록
('VLjmDsTbA38','exclude','THE K-POP THE IDOL BAND P.O.P FIRE GROUND 경연 무대, 블락비 공연 아님; P.O.P 미등록',
 '{"id":"VLjmDsTbA38","title":"[4회] 🎤P.O.P – FIRE GROUND (원곡:오피셜히게단디즘(Official髭男dism))","group_ko":"블락비","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb,
 '{"id":"VLjmDsTbA38","title":"[4회] 🎤P.O.P – FIRE GROUND (원곡:오피셜히게단디즘(Official髭男dism))","group_ko":"블락비","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb);
UPDATE codex_audit6_plan SET after_state = after_state || jsonb_build_object('flagged_at', transaction_timestamp()) WHERE action = 'exclude';

-- 실행 대상 미리보기. UI는 SQL Editor의 각 결과 탭에서 확인.
SELECT id, action, before_state->>'title' AS title,
       before_state->>'group_ko' AS old_group, after_state->>'group_ko' AS new_group,
       after_state->'members' AS new_members, after_state->'cover_of_groups' AS original_groups,
       after_state->'cover_of_members' AS original_members, reason
FROM codex_audit6_plan ORDER BY action, id;

CREATE TABLE IF NOT EXISTS public.ops_codex_audit6_backup_20261026 (
  video_id text PRIMARY KEY, before_state jsonb NOT NULL, after_state jsonb NOT NULL,
  reason text NOT NULL, applied_at timestamptz NOT NULL, undone_at timestamptz
);
ALTER TABLE public.ops_codex_audit6_backup_20261026 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ops_codex_audit6_backup_20261026 FROM PUBLIC, anon, authenticated;

DO $audit$
DECLARE
  p record; current_state jsonb; actual_state jsonb;
  desired public.yt_channel_videos%ROWTYPE;
  n_changed integer := 0; n_already integer := 0;
BEGIN
  -- 모든 대상의 현재 상태와 잠금을 먼저 확인. 한 건이라도 불일치하면 전체 중단.
  FOR p IN SELECT * FROM codex_audit6_plan ORDER BY id LOOP
    SELECT to_jsonb(v) INTO current_state FROM public.yt_channel_videos v WHERE v.id = p.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Missing audited video: %', p.id; END IF;
    SELECT jsonb_object_agg(k,current_state->k) INTO actual_state FROM jsonb_object_keys(p.before_state) AS keys(k);
    IF (p.action = 'exclude' AND actual_state - 'flagged_at' = p.after_state - 'flagged_at')
       OR (p.action <> 'exclude' AND actual_state = p.after_state) THEN
      n_already := n_already + 1;
    ELSIF actual_state IS DISTINCT FROM p.before_state THEN
      RAISE EXCEPTION 'Audited state changed; review before retry: %', p.id;
    ELSIF EXISTS (SELECT 1 FROM public.ops_codex_audit6_backup_20261026 b WHERE b.video_id=p.id) THEN
      RAISE EXCEPTION 'Existing backup for changed/restored row; review: %', p.id;
    END IF;
  END LOOP;

  FOR p IN SELECT * FROM codex_audit6_plan ORDER BY id LOOP
    SELECT (SELECT jsonb_object_agg(k, to_jsonb(v)->k) FROM jsonb_object_keys(p.before_state) AS keys(k)) INTO actual_state FROM public.yt_channel_videos v WHERE v.id=p.id;
    IF (p.action = 'exclude' AND actual_state - 'flagged_at' = p.after_state - 'flagged_at')
       OR (p.action <> 'exclude' AND actual_state = p.after_state) THEN CONTINUE; END IF;
    INSERT INTO public.ops_codex_audit6_backup_20261026(video_id,before_state,after_state,reason,applied_at)
      VALUES(p.id,actual_state,p.after_state,p.reason,transaction_timestamp());
    SELECT * INTO desired FROM jsonb_populate_record(NULL::public.yt_channel_videos,p.after_state);
    -- 기존 관리자 저장 경로와 동일: 잠금 해제 → 정정 → 수동 확정 잠금.
    UPDATE public.yt_channel_videos SET tags_manual=false WHERE id=p.id;
    UPDATE public.yt_channel_videos SET
      group_ko = desired.group_ko,
      members = desired.members,
      with_members = desired.with_members,
      with_groups = desired.with_groups,
      cover_of_groups = desired.cover_of_groups,
      cover_of_members = desired.cover_of_members,
      cover_of_song = desired.cover_of_song,
      content_flag = desired.content_flag,
      flag_source = desired.flag_source,
      flagged_at = desired.flagged_at,
      tags_manual=false, cover_manual=desired.cover_manual
    WHERE id=p.id;
    UPDATE public.yt_channel_videos SET tags_manual=desired.tags_manual WHERE id=p.id;
    SELECT (SELECT jsonb_object_agg(k, to_jsonb(v)->k) FROM jsonb_object_keys(p.before_state) AS keys(k)) INTO actual_state FROM public.yt_channel_videos v WHERE v.id=p.id;
    IF actual_state IS DISTINCT FROM p.after_state THEN
      RAISE EXCEPTION 'Post-update verification failed (trigger/constraint): %',p.id;
    END IF;
    n_changed := n_changed + 1;
  END LOOP;
  RAISE NOTICE 'Changed %, already correct % (total 26)',n_changed,n_already;
END
$audit$;

-- 정상: target_count=26 / not_correct=0 / manually_excluded=10.
SELECT count(*) AS target_count,
  count(*) FILTER (WHERE CASE WHEN p.action='exclude'
    THEN ((SELECT jsonb_object_agg(k, to_jsonb(v)->k) FROM jsonb_object_keys(p.before_state) AS keys(k)) - 'flagged_at') IS DISTINCT FROM (p.after_state - 'flagged_at')
    ELSE (SELECT jsonb_object_agg(k, to_jsonb(v)->k) FROM jsonb_object_keys(p.before_state) AS keys(k)) IS DISTINCT FROM p.after_state END) AS not_correct,
  count(*) FILTER (WHERE p.action='exclude' AND v.content_flag='무관' AND v.flag_source='manual') AS manually_excluded
FROM codex_audit6_plan p LEFT JOIN public.yt_channel_videos v ON v.id=p.id;
COMMIT;
