-- 로마자 이름 조각·흔한단어 "이유" 오태깅 정리 (2026-09-29)
-- 원인: ① "HAN SEUNG WOO"·"YOON SEO RYEONG"·"PARK HAN BIN"·"LEE JIN HYUK"처럼 **로마자 풀네임 속 한 음절 조각**(han·yoon·jin·jae·jun)이
--         스키즈 한·스테이씨 윤·러블리즈 JIN·데이식스 Jae·세븐틴 준 같은 짧은 영문명 멤버로 잡혔다.
--       ② "~하는 이유"(reason)가 힛지스·에버글로우 멤버 이유로, "in JAPAN"의 in이 스키즈 I.N으로 잡혔다.
-- 코드: admin.js _atmNormalizeRegisteredRomanNames(로마자 런=한 사람, 등록명은 전체 일치만) · _atmStripCommonNounCtx("~는 이유").
-- 대상: 전체 258,675행을 **이전 매처 vs 새 매처**로 차분해 "이전엔 잡혔는데 새로는 안 잡히는" 태그를 뽑고, 설명란 포함 재판정.
--       주인 채널(source_tier idol·fans·grpsub)·수동 편집·이미 플래그된 행은 제외. 행별 검토 완료.
--   · reassign: 제목의 풀네임 주인이 한 명이고 새 매처도 같은 주인을 가리킬 때만 그 주인 키로 옮김(강승윤→위너, 이진혁→업텐션 …)
--   · flag    : 남는 근거가 없음 → 태그 제거 + 무관
--   · drop    : 다른 근거가 남음 → 그 태그만 제거
-- ⚠️ 전부 tags_manual = false 조건.
BEGIN;

-- drop 스트레이키즈 -[아이엔] (169건) 예: [쇼! 음악중심] 스트레이 키즈 -올 인 (Stray Kids -ALL IN) MBC 201128 방송
UPDATE yt_channel_videos SET members = array_remove(members, '아이엔')
WHERE tags_manual = false AND id IN ('_ASZokkeCh0','_G0u2vsZqvk','_HclYiIuxUk','_n7xiIQMucE','_sde6y9KoGQ','06cIgNhDmQQ','06tKUacgd5g','0BJvizuv590','0ExXrjrhNYo','0K2tfEYkMAw','0Q8J6E1P1Pc','11eDNf3IV2U','23JUBUenfOU','2adalp_JdUY','2b297auCCEY','2Ks4QhLIvbs','2qmd6MFHTX8','3-Ugv7pJrB0','3opfskple_k','3rTvMFTEG-Q','4E6DP7kzhQQ','4n9t6E_Utlc','4rs98PrwXX0','51pk_92PwiQ','78x1JMrjlrM','78ZEoWHhrJQ','7B1MiHJKIlo','7W47sAUmDcE','83eU74Ye1Jo','8TuH1C9uLmw','9_B2tO5sR1E','92I7RaTwS_8','9EVsOUqpQB8','9gerQFZUXjc','alkZGnOFw_g','AvbHBrPfJWg','bBeHBpDUT-Q','BByTigHljRo','bG3FOor0rEo','Bj71OwAQYZo','BrBlirxGOTI','brCTFhF5t3I','BV-vWxAAaF4','byf5FHGL_sE','bYU7BMH-31E','C-Qg2Xfkc7Q','c0ZXtL_yKdY','C9_z3klXQ70','cblaeQtDm7M','CikkY99m6bY','cYZ21BYGzws','cZKD5hh2wKE','d-M6MLATPbw','DfosRMbDAVo','dGDGtMUuHaQ','doeO1kly2P8','dR6SXG12_zE','Dw7dDWA6C3k','E1mFBVZ5bXc','E1OjHB0FxuM','EeG5nC1IT_8','eMPLuexlKP4','EY98kNi2eR0','fEoPKUyism0','ffT64TXgylI','fkiwjSUz-L0','fkkVFZv2JjM','fR6zlCMxp0o','fu3dE6iVkQo','fXIZNYdRR9w','fYiPa-6LeBY','fyRhVLEe86A','fYXvUToKOiI','g8U3RmUjfdQ','GBubPWgFefU','gJRVycxNtVI','GKC4z3rGOE8','gPo5sib7SCk','gsMbVs2tcPk','h1li3NlTB0I','hOgVRf6rOcw','hsyicD7DmyM','i46RCr1BbZs','iBRQLR55Kj8','IFE9NBrEQpo','iMpn_B83Zec','iUDJpE1VHN8','j2qXVzk2apg','J5eq8uoIB94','JaTH_bA6szw','jJ9nG1LKWJ0','jJKlFj5_Njw','jVHU6EqRVIM','JWS1s5aMIUk','k3jaVdTQ_70','kmZrsR60qL0','KQ7hD3f8miQ','KrxjaMm3cCY','KS52dtuTr0E','kS9nWkCdNrQ','kSfqsgCLfjY','LPos7ygJx48','lZtliRKWHG0','MEoT8w17Geo','mJ4QBnSfUoc','mul_jw8Luec','Mus2rsaqYq4','n6K_SkfHiW8','nZ6QUYLmOPE','o0Y2irImSrM','pGzNvZrtBcM','pjVIVce-IXM','pkLKnGzHVUE','PoLqrG9OK08','PUUxE7EGP4Q','Q-rvasu0mdE','qas3zL7IHpE','qjkCFYkyPaA','QNPnRUzqPFE','qONImlA1URU','QtDgZqnXCfw','r2N0kvzagAQ','RBbekdvUsHU','RH995jKdGOY','rjUBJeu0dLI','RlLUsd6R5pk','s8Wrf9zOkt0','S9SyrctT6NE','SmFWQl1n1V8','St92TgVTKQ4','SzC8HiTm5es','Te0kj5g84CI','tKO0CVdbjq0','U_vnt1-iapg','u0jZeBEZgwM','uGGYnjeXvwM','uH0_6R554vc','ULJcm3ffYi4','UrUi4mSX1AA','VfA2cEot_0A','vK_XU_IgzBI','vleahABnM7s','vLh_XX4Ubdc','vMt-5XHWQp4','VnDdN1Xh15I','VzGHbB5DOE8','W0MdG7HGVDk','WCpeHyHy5p4','wgIVR5Rb2rY','WjQVeBGCCzA','woiUbL7mjIk','wptPgXvN8B4','wQvbvIJttDc','X7IZNXesuFM','xe98SsxmIgs','Xk7m76WsP9o','XkxuZX_oZvs','xQHxjn9FKDc','XunTUk0vEgU','YfOyJu6a8ZY','YJ-D7jvf0Vk','ym-1TJJs3VI','YV862GCLWQ0','ZAb8fY5L1fc','ZedNJtBU7iU','ZH-EENwMIkg','zpCbA7Dxwcg','ZXMilZ0aD9A','zxyOkkPIuPk');

-- reassign 에이프릴 -[이나은] → 에이핑크 (1건) 예: 주간아이돌 - (episode-192) Son naeun's hot body!! (손나은 S라인)
UPDATE yt_channel_videos SET group_ko = '에이핑크',
  members = ARRAY['손나은']::text[]
WHERE tags_manual = false AND id IN ('_cdcjl12x2s');

-- flag 에버글로우 -[이유] (59건) 예: 이미도가 영화 '싱글 인 서울'에서 임수정 언니 역할을 뺏고 싶은 이유ㅋㅋㅋ💕 / [이은지의 가요광장] I
UPDATE yt_channel_videos SET members = array_remove(members, '이유'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('_JgLUwcQcVk','-y3J1ikR9kU','0uNzCL6HfZw','3oa1sXCA-3A','3waEMZSS8BY','4fEFfbohwvw','5vni31aNaJU','96eQB_ShUEQ','AQuAwZDGcuQ','ARkoclq46ak','BDERCKRog5c','bKKCJRedoEw','caIJrUMbenc','CIpiODnKcak','DT_zAKlPZeQ','e1rR5N9YcnE','elQrdl4V3aI','EOpgydgNh-0','F2FeCsgx5H8','fltZ3t05I6A','Fw58frO7tEs','g5dIjY4nHiM','gt6aba50voE','guZ3iyon6Ug','hBWgdM5P2js','hjevo3o726U','hQeQ8Gqs33c','HUnRcSf_1zs','HvoBDECMvUM','il4qoSkZXjk','IuNyINC-QTc','iyjjtFQXjQs','j_UwwyZS6-U','jWQJLC_tn44','lC6XcJJKOhM','leAZSdfKJ_U','lFblOv4K8Yc','lKQOcc7Hi9I','mN1Ji91XmwA','oO_X2cHM_Jc','oOW5c9jUmyM','pPDGL1hxnUs','RI1DCD23REw','u5dPMx93V7U','UsFYdX8DGps','uYoXcpFU-js','uzOTR6Ydrjo','vPKPHXQUGVI','WU5s6thfclM','X_pyXXl1igY','x5_AuOOgGzo','X5EMnsN9ucI','XDTaLOGXdaM','XHK5IlUztD0','xZbsZJ85O8w','xzZ0cy3fph4','Ytw4GXueSSU','z9DG0aCV9uY','zge225RK7zA');

-- reassign 튜넥스 -[제온] → 아이오아이 (3건) 예: [릴레이댄스] 전소미(JEON SOMI) - Fast Forward (4K)
UPDATE yt_channel_videos SET group_ko = '아이오아이',
  members = ARRAY['전소미']::text[]
WHERE tags_manual = false AND id IN ('_LBa7CkEd5Q','daLgG5_HpFA','k-LBQJordqc');

-- flag 아이브 -[안유진] (2건) 예: 손유진(Sohn Yujin) "Spicy" ♬ Full ver. | 걸스 온 파이어
UPDATE yt_channel_videos SET members = array_remove(members, '안유진'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('_zwS6ZXtDaQ','gqPxIPErlGw');

-- reassign 스테이씨 -[윤] → 위너 (13건) 예: [DAZED FILM] Dazed x WINNER 'Seung Yoon Kang'
UPDATE yt_channel_videos SET group_ko = '위너',
  members = ARRAY['강승윤']::text[]
WHERE tags_manual = false AND id IN ('-a15VCl8FGY','AHNJ6uLBxOw','aIvAGtLFzEg','cHKN-RfnbHs','dctOT31Lc_Y','eCt9bCT0ePk','iUoYAjif3GE','ohtnsg7CpjM','oYLeUxyqJ_Q','RDL4JrMDvGA','RxXDQYe9Cmg','Wcj7TF25elI','ZF1_t89_Grc');

-- flag 세븐틴 -[준] (52건) 예: BOUNCE - 이준영 (LEE JUN YOUNG) [뮤직뱅크/Music Bank] | KBS 250926 
UPDATE yt_channel_videos SET members = array_remove(members, '준'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('-ER64xt59Hs','0Iy-T0e2QIc','0Uc11e5Vdcw','3ILL4fMchzM','3m-fUhJoryM','3Zif19EjJwM','4WmhsbRkjgw','5v5hmB2nUg0','6eP9xtnndj0','6uhxj38EbWA','7Q6jn5LGggM','A-I7o9YDAzk','cFkYIDFvxmM','CiI_UZgdv4E','dRbcTIbq-6g','edbVFjZ70ow','EhPKerFd4xI','EitWNqcxDXY','fGBpZ1O2zBs','frLm-MCzwrw','GC6mNIq6F6c','H1ZoxCcS75Q','hf2FtR7kT80','HhRzeDTfr-Y','hpP0d85VrEQ','HyUNcaWRllU','j7EUApTymmk','jypc3vjnYq0','KFpXeEA9lno','kfQQPFZWEZA','n1WD6mC_fFg','nanXF9tzrak','NhYIlR79hcs','o5W8_xmGiAw','OYMJXtLc7Gc','p3NoVV7_Slo','pWEUycVxK8A','r3P-Yb_MCTU','rQ9oNT6Z4X0','SAKJNhDqHJE','spvennh1AZY','t3-C6aG2U4A','TF8Te85LNYE','tLCEpjg5TTo','tmZssQKI754','u7RjAM94N_w','Vqiv8N0cens','XiHoggyA-80','XpOQktQoDnI','xVt0pLIiRz8','z5EHl99FmPw','ZrQWFB3v9v8');

-- reassign 에버글로우 -[이유] → 이븐 (1건) 예: 케이타 엉덩이 이러는 이유 아시는 분 (Feat. 메인즈) | 릴레이댄스
UPDATE yt_channel_videos SET group_ko = '이븐',
  members = ARRAY['케이타']::text[]
WHERE tags_manual = false AND id IN ('-h_hO9030cE');

-- flag 러블리즈 -[JIN] (31건) 예: Kang Jin - DDaeng Beol, 강진 - 땡벌, Beautiful Concert 20130107
UPDATE yt_channel_videos SET members = array_remove(members, 'JIN'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('-KlARnL5O14','6i-wZ-vIqtE','946a-5MUOfU','ap4iusImmOs','B5dTY9ToFVo','c-ouU-eUOUI','c0Z2gZaIS_Q','cFZaPt00dVs','eMTeB51kuw8','eT1BcPE40Co','g_kUGEBXafw','g5Qz1JvqKLk','g8yONiNpjm8','GbSkoXrH5uo','hrp3FjQTkhs','IhO02Hs7O38','ix0cJsr4RnU','jGY3xIrSyx8','KUV2BGtaLl4','N_ubcOfX2M0','oT8b1GPKgNA','PJ9qGkqQ7Mc','qJJTFYaRwAA','QZ7lI3gyloE','SyFcsEASKp4','tbBctLlVM1Q','UBn0JQJNDDs','uURtgrg6E6M','V6Ils-u8jDY','Z8mp5q1nRJk','ZnxgRgRoTMc');

-- flag 스트레이키즈 -[한] (8건) 예: 한동근(Han Dong Geun) - 안 될 사랑(Undoable) [세로라이브]
UPDATE yt_channel_videos SET members = array_remove(members, '한'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('-XTr1yYQkm4','AbWrmpJpg3o','afkNpQJDL5E','CCy-A-6LIxQ','F1NqJfLx4zU','fjCPtqcwzNA','fY_oCNwCbK0','SHPyphxf0_0');

-- flag 원더걸스 -[예은(예은)] (2건) 예: AHN YEEUN, KAKOTOPIA [THE SHOW, Fancam, 200303] 60P
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '예은(예은)'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('-zs7vnosx9g','T3OIoKilcHo');

-- flag 데이식스 -[이제이(앨리스)] (1건) 예: Lee Jae Won (이재원) - Once again | Show! MusicCore | MBC241102
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '이제이(앨리스)'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('05ssDNou9XM');

-- drop 스테이씨 -[윤] (24건) 예: YOON SANHA (윤산하) - IDK ME | Show! MusicCore | MBC260530방송
UPDATE yt_channel_videos SET members = array_remove(members, '윤')
WHERE tags_manual = false AND id IN ('0DThr053Fp4','0PR--tJ77Pc','18_m3SZNh0w','3ujCXVIeKXE','6dxqNzB_1Pw','7HdTPKR_2rI','8JH4f_xqJRs','9Eb1S1V8B4k','9mh34gLmRnA','9QXQ9wWMJ-w','bfpIrdhsoPk','DLyRYwSDg3Q','do69oi0dKjo','GkN-RSAKoYA','goQX1Xo6348','JgAxyOA_Tpk','KQro_4o4xX0','nUrFS_jiEFI','NV2dJ7wS8gw','OOLcyuNq4BU','R-q5eAb0XXs','sTdlp9esT3g','zIvYoftQgjw','ZtCKk-BiduI');

-- reassign 워너원 -[박우진] → 스트레이키즈 (3건) 예: [플리캠 4K] KIM WOOJIN 'Ready Now' (김우진 직캠) I Simply K-Pop EP.4
UPDATE yt_channel_videos SET group_ko = '스트레이키즈',
  members = ARRAY['김우진']::text[]
WHERE tags_manual = false AND id IN ('0TAOhIH1YJk','wS3WGAl0Gis','XikfgYXv_xg');

-- drop 세븐틴 -[준] (3건) 예: Talk to You - 연준 (YEON JUN) [뮤직뱅크/Music Bank] | KBS 251107 방
UPDATE yt_channel_videos SET members = array_remove(members, '준')
WHERE tags_manual = false AND id IN ('1C1_s1oZK5k','CmpBCwM7kis','g3qsuy5u-SU');

-- flag 블락비 -[박경] (4건) 예: [HA:RT ATTACK] Open Heart with Musician Jo Jung-chi, Jung So
UPDATE yt_channel_videos SET members = array_remove(members, '박경'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('1wVrHQdoXU4','9hKW7oZTWCY','UgTbo0NF6pQ','vAq5qy5wlYc');

-- reassign 데이식스 -[Jae] → 더보이즈 (1건) 예: [KCON JAPAN] Hweseung+IN SEONG+HYUN JAE+BO MIN - Love In The
UPDATE yt_channel_videos SET group_ko = '더보이즈',
  members = ARRAY['현재']::text[]
WHERE tags_manual = false AND id IN ('22s34FCDgsY');

-- flag 스테이씨 -[윤] (34건) 예: Chae Yoon(채윤) - Nail(못) | Show! MusicCore | MBC220723방송
UPDATE yt_channel_videos SET members = array_remove(members, '윤'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('2EXvIs2JenU','4nsT-F4Xq8k','5cNigaX-tCs','8WhQQ1DptwE','A4sNocRGKWk','bRL0dGmixPc','bZcqVFJig4o','C8KRXrTm5Mo','cPuEiKvzTBs','eeGzVQ4VmPo','Fb957SziGe8','G3DXrpoKXU4','Hr9DHBC1ebo','hsN9Mpue0Dw','ILHxVktNV20','JKmeW9vNW8s','JwyarRhnw_E','LMVahujDbOs','O0VCYHIP3QA','oUK-9-oJInE','ovDctrqKVuU','pLJKnm3ibf8','qAcXy6Q7DLM','qYC29eBAB04','RFJkNF-CypU','rKTWmtwjaOk','Sl7JExpa5J4','VOSFF21Hxl4','VV3fXoo6oUc','W63lIKxCIoY','WB5F7zFHmHE','xmJUjqcqXdM','xrs6ZuGCqzw','ynSabkmu50Y');

-- flag 워너원 -[박지훈] (5건) 예: [Music Access] 신지훈 (SHIN JIHOON)'s Singin' Live '벚꽃 퍼레이드 (Ch
UPDATE yt_channel_videos SET members = array_remove(members, '박지훈'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('3M5jo0SegVA','bbUE0TdDQtg','KA7fldFUt9M','mbZtKPLnwKk','T1fRpOxlZ_g');

-- drop 데이식스 -[Jae] (25건) 예: Jae seong, Wonderful [THE SHOW 190402]
UPDATE yt_channel_videos SET members = array_remove(members, 'Jae')
WHERE tags_manual = false AND id IN ('3XTYvYe2C3s','49DoTnWAUNU','5WqzM6l8i7o','8tEUKEeOwe4','a4As9UKZK7g','agSlBfCjtt4','BFrZvSaQV_Q','C_5whY66Usg','Dh5RVaGjR2U','EeBhbQ2yUFc','EoJgWmCPDbs','f878BfeSRrM','hM5JY6Q8fFo','i9IAkVP4MME','JdEGvw8Y-EY','k75o93jirM4','pHBtW4d51PM','ry4rt2s2MI8','SEC9ArIGkbA','TaAGCQ4lNFE','UhG-LvK6bwM','vEJMj27ysAc','XwVx8hFJFF4','ZityogiOIfY','zjk6P49h7sw');

-- reassign 러블리즈 -[JIN] → 이의진 (5건) 예: Eui Jin, Insomnia [THE SHOW 190709-Premiere]
UPDATE yt_channel_videos SET group_ko = '이의진',
  members = ARRAY[]::text[]
WHERE tags_manual = false AND id IN ('3ZrpmRXP6UE','7iYt3YhU4_c','iWtw8v1q-H0','rSarjNbn9bs','ZooSj6593UY');

-- drop 엑소 -[디오] (7건) 예: [EXCLUSIVE] How do EXO shoot their music stage? (ENG)
UPDATE yt_channel_videos SET members = array_remove(members, '디오')
WHERE tags_manual = false AND id IN ('46DUBZa9XWU','aVqXr05eQOU','ECz7MfGQ8S4','FxR7DUC3efM','jo7of4A3da8','TnOYAeHVii8','uwpVs8gqsyg');

-- flag 엔믹스 -[배이] (9건) 예: '우리들의 블루스'부터 '슬의생'까지 미공개 사진 잔뜩 풀고간 배현성(Bae Hyeon seong) 폴꾸zi
UPDATE yt_channel_videos SET members = array_remove(members, '배이'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('4ETy3OdWNvc','brlth0eiD88','CsQlccdyGPA','jO4fdyrxUzY','jRttEa96zbs','LkJVZmrDvDs','tEynaM4XZu8','w_H-leqOHY8','YBvUlnVeI2g');

-- drop 라이즈 -[한빈(템페스트)] (1건) 예: TAESAN X SUNG HANBIN X ANTON (태산 X 성한빈 X 앤톤) - Jingle Bell @
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '한빈(템페스트)')
WHERE tags_manual = false AND id IN ('5-M5H_JnOcc');

-- reassign 러블리즈 -[JIN] → 업텐션 (3건) 예: [LEE JIN HYUK - Crack] #엠카운트다운 EP.769 | Mnet 220908 방송
UPDATE yt_channel_videos SET group_ko = '업텐션',
  members = ARRAY['이진혁']::text[]
WHERE tags_manual = false AND id IN ('5bkTB1C8sX8','8Qw4FEBmttc','WpweNYRe1VY');

-- flag 러블리즈 -[서지수] (3건) 예: [Hot Beat] 임지수 (LIM JISOO)'s Singin' Live 'Monologue'
UPDATE yt_channel_videos SET members = array_remove(members, '서지수'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('5cNMCL9FpxI','gCQBwvJVkYY','W-Q2DNDxavo');

-- drop 투애니원 -[산다라박] (15건) 예: PARK BOM - YOU AND I M/V
UPDATE yt_channel_videos SET members = array_remove(members, '산다라박')
WHERE tags_manual = false AND id IN ('64VZUNTmGQM','9q82fx2Ud_4','clt9TRFL9Vg','Gxxb4jxKcEs','jkf3NeVI2-s','KUvD_CXYVn4','q7R1Man5HGI','QDNCEXhQITc','qIGY5O95Hqw','t-FuWdfhesM','UiIiiQOsows','vRLcZEqZs_s','WVMKvuUVjwM','ypit0NcNV-8','ZQs_EfOKX_Q');

-- flag 르세라핌 -[홍은채] (2건) 예: [6회/페이스캠] 포에버 | #이은채 #LEE EUNCHAE ♬WHATEVA  - 포에버 #레벨 스테이션 #
UPDATE yt_channel_videos SET members = array_remove(members, '홍은채'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('6LBue3Okz8g','VtMN1T4rAJo');

-- flag 엑스원 -[우석(펜타곤)] (5건) 예: 우석이(KIM WOOSEOK)의 단독 화보 현장, 살-짝 공개합니다♥ ｜싱터뷰
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '우석(펜타곤)'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('6p2ZMpGbYCw','eXcVzCtttK0','Oj2pP_aqo9Y','Qt0H3c2apdU','WOX0xk0Ngy4');

-- flag 네이즈 -[김건] (1건) 예: [UNFILTERED CAM] Win-plash KIM GEON WOO(김건우) 'Whiplash' 4K |
UPDATE yt_channel_videos SET members = array_remove(members, '김건'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('7-vxXHj3uGY');

-- flag 데이식스 -[Jae] (20건) 예: [COSMOPOLITAN] Son Yeon jae_OCT 2012
UPDATE yt_channel_videos SET members = array_remove(members, 'Jae'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('7JhPPq3eFeM','8PqxIg1gQTU','Akn5TFWbkDs','AVaWNSGDKhI','Bw6Isu_eyEw','E6YCTRP1rhM','eyL6cOnUnJ4','F_1F5Ma7SsU','fJEaMbJqqo8','Ksf6JGj-_co','Lg0M9JKCLbs','LSYlaNfbj0s','m7oLUKfS_Rw','MhZu7S4zYB0','NthlSgLz29g','Q7pAV66-ZLQ','R5lY2aNIH9U','R6dhBCuFq_U','SHhIKrI9fcU','xWjiz7ZrHkA');

-- flag 튜넥스 -[제온] (5건) 예: [BOYS PLANET] 박스 안에 숨겨진 놀라운 비밀?! '수상한 히든박스' | 전우석 (JEON WOO 
UPDATE yt_channel_videos SET members = array_remove(members, '제온'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('7T8XTyq8ROw','Hr3eknDuR6E','LV2TdHR6nOw','T8GY0h0IOfU','ZC1Sjo3kWV8');

-- drop 온리원오프 -[윤(스테이씨)] (1건) 예: [LIVE] SIMPLY K-POP CON-TOUR (📍INDONESIA) | YOON JI SUNG, S
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '윤(스테이씨)')
WHERE tags_manual = false AND id IN ('82SuWC-H0FY');

-- reassign 러블리즈 -[JIN] → 아이브 (1건) 예: [스타★봐야지] ★파워인싸★ 울 안댕댕(AN YU JIN)한텐 벽이 느껴져..♥ 완벽( ͡~ ͜ʖ ͡°)｜아
UPDATE yt_channel_videos SET group_ko = '아이브',
  members = ARRAY['안유진']::text[]
WHERE tags_manual = false AND id IN ('8J4qF72OTCE');

-- drop 엔믹스 -[배이] (7건) 예: [안방1열 풀캠4K] 배진영 'Round&Round' (BAE JIN YOUNG FullCam) @SBS I
UPDATE yt_channel_videos SET members = array_remove(members, '배이')
WHERE tags_manual = false AND id IN ('8km-_k_Nyl0','EmTZKdpZdsI','nb91t7pLYj8','qrPoIc1CdKo','UfV6fos1ITY','Wlx-4dwfN6Q','wo4czXqVUHc');

-- flag 엔믹스 -[배이,배인(저스트비)] (1건) 예: “현대家 더비는 질 수가 없죠!” 배우 배인혁의 '마리 리뷰 클럽' | MARIE RE:VIEW CLUB w
UPDATE yt_channel_videos SET members = array_remove(members, '배이'),
  with_members = array_remove(with_members, '배인(저스트비)'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('8Yy0rBN_4c0');

-- drop 트레저 -[예담(원팩트)] (9건) 예: BANG YEDAM, O-HE (방예담, O-HE) [THE SHOW 240903]
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '예담(원팩트)')
WHERE tags_manual = false AND id IN ('9eUd9f_cD4I','HwgO-XIgt5s','KqRL6dW93Og','oh2_iQBvjrg','oyq9WXVUHok','pMsC6J16c5s','SVhFoUouAIA','svqUT5_DdXw','zZy9s_S0tmo');

-- reassign 스테이씨 -[윤] → 투애니원 (1건) 예: [투표하세요] 희망Song 캠페인 - 희망멘토 윤도현, 산다라박, 유재환 (WISH Song Campaign
UPDATE yt_channel_videos SET group_ko = '투애니원',
  members = ARRAY['산다라박']::text[]
WHERE tags_manual = false AND id IN ('9Qvz8OYcONg');

-- flag 앤팀 -[조] (8건) 예: 🦁그리핀도르 조정석(Jo Jung-suk) VS 슬리데린 정경호(Jung Kyung-ho)🐍 내 마음 속
UPDATE yt_channel_videos SET members = array_remove(members, '조'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('A_d_2_e16_k','FAujsdFBMDY','H3erscP8jEg','kkfnCIOPPb0','N0ZLsqBcfQs','RXJw0eetnDM','UNCJNurDJPQ','xQzLS6gEWu8');

-- reassign 엔믹스 -[배이] → 워너원 (2건) 예: 돌고 돌아 배진영 | Round&Round – 배진영 (BAE JIN YOUNG)
UPDATE yt_channel_videos SET group_ko = '워너원',
  members = ARRAY['배진영']::text[]
WHERE tags_manual = false AND id IN ('AQrV5W_HhF0','jJ0nYFfcnD8');

-- drop 앤팀 -[조] (4건) 예: shout out to #JO mama #andTEAM #NICHOLAS
UPDATE yt_channel_videos SET members = array_remove(members, '조')
WHERE tags_manual = false AND id IN ('AuXcV0j8t_Q','RyI880srjUU','ucwNjimiyXU','wjdHCa3gb5I');

-- reassign 세븐틴 -[준] → 티아이오티 (3건) 예: [BOYS PLANET] 금준현 KUM JUN HYEON｜미션별 직캠 모음 (feat. 스타 크리에이터님의 
UPDATE yt_channel_videos SET group_ko = '티아이오티',
  members = ARRAY['금준현']::text[]
WHERE tags_manual = false AND id IN ('aYPxSb-jgmQ','fYOvJvsON1A','MVU5SDvjUkw');

-- reassign 세븐틴 -[준] → 클로즈유어아이즈 (2건) 예: [BOYS PLANET] 장여준 JANG YEO JUN I K그룹 @타임어택 1분 자기소개 [EN/CN/JP
UPDATE yt_channel_videos SET group_ko = '클로즈유어아이즈',
  members = ARRAY['장여준']::text[]
WHERE tags_manual = false AND id IN ('BcC3LL3HuTo','UzpEwJJHn6w');

-- drop 헬로비너스 -[유영] (1건) 예: 주간아이돌 - (Weeklyidol EP.78) Hello Venus Yoon-jo and Yoo-young
UPDATE yt_channel_videos SET members = array_remove(members, '유영')
WHERE tags_manual = false AND id IN ('bMT2IulMGqI');

-- reassign 아이즈원 -[이채연] → 아이오아이 (1건) 예: (Weekly Idol EP.255) PRODUCE 101 Main Ending heroine 'Jung C
UPDATE yt_channel_videos SET group_ko = '아이오아이',
  members = ARRAY['정채연']::text[]
WHERE tags_manual = false AND id IN ('C45piRCgQag');

-- flag 블랙핑크 -[지수] (3건) 예: LEE JISOO - MISMATCH / THE FIRST TAKE
UPDATE yt_channel_videos SET members = array_remove(members, '지수'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('cvnqZ3IDFpc','K2quL_v3Lqc','M37VaMZ_Wcw');

-- flag 샤크라 -[은] (3건) 예: Dancing with the stars ep01-Park Eun Ji 댄싱위드더스타 시즌1 - 박은지
UPDATE yt_channel_videos SET members = array_remove(members, '은'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('d7B328VkoU0','TmwOhmbvflw','zKY_PPq8sYA');

-- flag 방탄소년단 -[진] (3건) 예: [6회/세로직캠/4K] 포에버 | #진현주 #JIN HYEONJU ♬WHATEVA  - 포에버 #레벨 스테이
UPDATE yt_channel_videos SET members = array_remove(members, '진'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('dx0U3c7xQ-Y','jEu_-aE2pLg','uTYfbzT_n6Q');

-- reassign 에버글로우 -[이유] → 앰퍼샌드원 (1건) 예: 브라이언 차의 경보음🚨이 이유 없이 울리던 이유👻 [뚜루깔깔] #라스 #shorts
UPDATE yt_channel_videos SET group_ko = '앰퍼샌드원',
  members = ARRAY['브라이언']::text[]
WHERE tags_manual = false AND id IN ('e5vSF_XMUkM');

-- reassign 러블리즈 -[JIN] → 아이콘 (2건) 예: [Video Star EP.115] Kim Jin Hwan, "I was so scared..."
UPDATE yt_channel_videos SET group_ko = '아이콘',
  members = ARRAY['김진환']::text[]
WHERE tags_manual = false AND id IN ('eb8i6lesTro','HTJ1P2fnVBE');

-- reassign 데이식스 -[Jae] → 비투비 (2건) 예: 《NEW MC》육성재(Yook Sung Jae) - I do(아이두) @인기가요 Inkigayo 201509
UPDATE yt_channel_videos SET group_ko = '비투비',
  members = ARRAY['육성재']::text[]
WHERE tags_manual = false AND id IN ('eCrp3iFfQDc','Mv1WkTBk26o');

-- flag 아이오아이 -[김도연] (1건) 예: 전도연과 우리, 감각을 찾아 연대하다. / JEON DOYEON and ‘DAZED’. We unite as
UPDATE yt_channel_videos SET members = array_remove(members, '김도연'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('eflWQnrLk8k');

-- flag 구구단 -[조아람(조아람)] (1건) 예: 최혜연(Choi Hyeyeon) "언제라도 어디에서라도" ♬ Full ver. | 걸스 온 파이어
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '조아람(조아람)'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('fqzG_XaNVdg');

-- drop 스트레이키즈 -[한] (4건) 예: [세로댄스] 김동한 KIM DONG HAN - SUNSET (4K)
UPDATE yt_channel_videos SET members = array_remove(members, '한')
WHERE tags_manual = false AND id IN ('Gs8bdJx6R54','N7EsF3KgE_w','nLEBXKJQgRo','ZyE7UH1DwVU');

-- flag 미쓰에이 -[민] (2건) 예: Shin min ah in Paris
UPDATE yt_channel_videos SET members = array_remove(members, '민'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('ivUmJ1JJH_o','kA8V9z-XWVw');

-- drop 블락비 -[박경] (1건) 예: 음악중심 - Kim Kyung-rok(feat. P.O. of Block B) - It's not big d
UPDATE yt_channel_videos SET members = array_remove(members, '박경')
WHERE tags_manual = false AND id IN ('jXCYJtscsDU');

-- drop 스트레이키즈 -[한,안유진(아이브),최유진(케플러)] (2건) 예: [페이스캠4K] MC 스페셜 한유진 '첫 사랑니' (MC Special Stage HAN YUJIN 'Rum
UPDATE yt_channel_videos SET members = array_remove(members, '한'),
  with_members = array_remove(array_remove(with_members, '안유진(아이브)'), '최유진(케플러)')
WHERE tags_manual = false AND id IN ('lvkdxjctno4','UMoGZgXGnMQ');

-- flag 러블리즈 -[정예인] (1건) 예: 손영서, 조예인, 최아임(Son Yeongseo, Cho Yein, Choi Aim) "The Night" 
UPDATE yt_channel_videos SET members = array_remove(members, '정예인'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('MrAHrlPdgQw');

-- flag 스테이씨 -[윤,윤서(배드빌런)] (2건) 예: YOON SEO RYEONG (윤서령) - Sad Gayageum (슬픈 가야금) | SBS 250330 방
UPDATE yt_channel_videos SET members = array_remove(members, '윤'),
  with_members = array_remove(with_members, '윤서(배드빌런)'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('MRW9JFUqAko','ZAoI0FmKbp8');

-- flag 배드빌런 -[윤서] (1건) 예: AIreport VOL.2 | Open Heart with Singer-songwriter Yoon Seo-
UPDATE yt_channel_videos SET members = array_remove(members, '윤서'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('OIqdH8il1UU');

-- reassign 에버글로우 -[이유] → 2PM (1건) 예: 박재범 - Why 비트가 세 번 바뀌는 이유
UPDATE yt_channel_videos SET group_ko = '2PM',
  members = ARRAY['박재범']::text[]
WHERE tags_manual = false AND id IN ('PviYtovloXU');

-- reassign 러블리즈 -[JIN] → 여진 (1건) 예: [2022 MAMA] Red Carpet with YEO JIN GOO | Mnet 221130 방송
UPDATE yt_channel_videos SET group_ko = '여진',
  members = ARRAY[]::text[]
WHERE tags_manual = false AND id IN ('RGGn60qpS5k');

-- drop 하츠투하츠 -[예온] (1건) 예: DJ put it back on #Hearts2Hearts #하츠투하츠 #H2H
UPDATE yt_channel_videos SET members = array_remove(members, '예온')
WHERE tags_manual = false AND id IN ('rRN6-L5hutY');

-- flag 방탄소년단 -[지민] (1건) 예: ARA4CUT | 짱스트비는 네컷사진📸 찍을 때도 화보를 찍어 .. #GEONU #Bain #LIM JIM
UPDATE yt_channel_videos SET members = array_remove(members, '지민'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('Sj4pxjXRREU');

-- flag 워너원 -[박우진] (1건) 예: Yeon WooJin 연우진다움
UPDATE yt_channel_videos SET members = array_remove(members, '박우진'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('Vhu8tr9c_SA');

-- flag 트와이스 -[미나] (1건) 예: #마리가간다 끌레드뽀 보떼 ’더 세럼 II‘ 런칭 기념 이벤트에 함께한 브랜드 앰버서더 신민아(Shin Mi
UPDATE yt_channel_videos SET members = array_remove(members, '미나'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('VuXqNheEo5k');

-- flag 판타지보이즈 -[강민서,김민서(B.D.U)] (1건) 예: 윤민서(Yoon Minseo) "ELEVEN" ♬ Full ver. | 걸스 온 파이어
UPDATE yt_channel_videos SET members = array_remove(members, '강민서'),
  with_members = array_remove(with_members, '김민서(B.D.U)'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('wJQNUDgMnvg');

-- reassign 스트레이키즈 -[한] → 카라 (1건) 예: '너무 사랑스러워' 한승연, 점점 더 예뻐지고 작아지는 얼굴 #Han Seung-yeon [디패짤]
UPDATE yt_channel_videos SET group_ko = '카라',
  members = ARRAY['한승연']::text[]
WHERE tags_manual = false AND id IN ('XWuP7GEjKyk');

-- 순찰 B 발견: 누에라 판(en Fan) ← "FAN CAM"·"FAN PICK CAM", 올아워즈 온(en On) ← "Life goes on"·"We on Fire", 배우 현빈 화보(올아워즈 현빈·온으로) (17건)
-- 그룹명·한글 이름·해시태그가 제목·설명 어디에도 없는 것만. "ON:N"(온의 표기) 2건은 본인이라 제외.
UPDATE yt_channel_videos SET members = array_remove(array_remove(array_remove(members, '판'), '온'), '현빈'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND group_ko IN ('누에라','올아워즈') AND id IN ('RlNIZBJWA4c','Tf0o9V3rCzk','VVDE31bZk18','7SDQyezGgBg','23rcRLEnV-Y','iFUL0I6Xr6o','jfXstcUinLk','NEatERGSEzo','MZvQYXcmR8Q','qz96-3pQlBI','Gp0_tMMoPk4','kR0wXmBnjHg','ap5Ma96SdRw','Rm-4Eb0xEcc','pe23lyLDFP4','nwfFjdka3Yk','QYwtpAntyYo');

-- 한승우 솔로 48건·도한세 3건 — group_ko=스트레이키즈(멤버 한)로 잘못 들어가 대부분 숨김(flag_source 없음)돼 있던 것.
-- 본인 솔로 키로 옮기고, 이 사유로 숨겨진 것(flag_source NULL인 hidden)은 다시 보이게 한다. 개별출연·보류 등 다른 플래그는 유지.
UPDATE yt_channel_videos SET group_ko = '한승우', members = '{}'::text[], with_members = array_remove(with_members, '한승우(빅톤)'),
  content_flag = CASE WHEN content_flag = 'hidden' AND flag_source IS NULL THEN NULL ELSE content_flag END
WHERE tags_manual = false AND group_ko = '스트레이키즈' AND title_norm ILIKE '%한승우%';
UPDATE yt_channel_videos SET group_ko = '도한세', members = '{}'::text[], with_members = array_remove(with_members, '도한세(빅톤)'),
  content_flag = CASE WHEN content_flag = 'hidden' AND flag_source IS NULL THEN NULL ELSE content_flag END
WHERE tags_manual = false AND group_ko = '스트레이키즈' AND title_norm ILIKE '%도한세%';

COMMIT;
