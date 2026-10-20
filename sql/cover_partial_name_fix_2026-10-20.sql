-- 원곡(cover_of) 부분 이름 오인식 정리 — 2026-10-20 Claude Code
-- 원곡자 표기의 일부 낱말만 우리 아티스트 이름과 같아서 엉뚱한 원곡이 붙은 영상 66건의 원곡 태그만 비운다.
-- 예: "(원곡: Bobby Helms)"→아이콘 BOBBY, "Michael Jackson"→갓세븐 잭슨, "Chris Brown"→크리스, "James Arthur"→코르티스 제임스.
-- 수동 확정(cover_manual/tags_manual) 행은 건드리지 않는다. 곡명(cover_of_song)·출연자 태그는 그대로.
-- 판정: admin.js _coverCreditExact/_coverOriginStrict 수정본으로 전수 14,457건 재판정 → 사람이 한 건씩 검토(맞던 15건 제외).
UPDATE yt_channel_videos
SET cover_of_groups='{}', cover_of_members='{}'
WHERE id IN ('_R9Q_q7qQig','1JUtbjA2epA','3gWH95GXvq4','3Z6Zmd5kxU4','4L-Vat0XJDw','5-17hf07URo','59gtBhLPKyE','5jhgGtCZqsk','6BjGP_M5Jj4','6G6c9xs6nEE','78uIpc40jZA','7XY0ND641D8','810hL17Br9Y','8lhKMtBIpM0','8o3qe_MuB4s','9fdvhw0Z4P4','9q-wfIEVyWQ','A-pj1mCbCQY','a4J_Gf6ZD5M','AMfJfMlsCeY','baZzWt619MY','D7XKT7qfYZI','Dl2FX17jY-U','dTj1y2l1XZI','DX99d5pUx-8','E0Wh4loscFo','EdCZf_KRyn8','eiM6LN6zBqQ','F3W_EtJqbI4','Fac2dh_Pseo','fnhMJbdVUek','fRGyNEIYMpE','fVsHtPPP8X8','FVUPcrbe3zQ','G-y6B13lEMU','GWsMJivmpJQ','GyQIpteNn5A','hMDDhHEd0zE','hOR3K72QoKQ','Hqtot8vWLRw','HVgPG127Ylo','IbIV4fOFiIs','IHi9nrHshno','IMPe2BQDVQQ','jBnJnehvRow','kd2_2eDIOyE','kPX5RJ_78UQ','LFjsFmvbgVo','mWt-hqg4UAI','NSIJ9PY9GRs','Oaie7g9i8UQ','pt54K1gcVdg','q9QjFdtY0SM','rzw_kTAuWQg','s-9Y0t9ILTI','S7cS9DWTU2k','T1ZPHrecmaM','tAJhYH_HMhI','uHyEKxvgTsI','VSKss8cHxiY','WOxhxnKXqDQ','woyryaz4aGQ','WvnDzALkf5c','YAgMpg34PVI','YoQHPisK4yw','zwBZyMRFJDU')
  AND coalesce(cover_manual,false)=false AND coalesce(tags_manual,false)=false;

-- 확인: 0이 나오면 반영 완료
SELECT count(*) FROM yt_channel_videos
WHERE id IN ('_R9Q_q7qQig','1JUtbjA2epA','3gWH95GXvq4','3Z6Zmd5kxU4','4L-Vat0XJDw','5-17hf07URo','59gtBhLPKyE','5jhgGtCZqsk','6BjGP_M5Jj4','6G6c9xs6nEE','78uIpc40jZA','7XY0ND641D8','810hL17Br9Y','8lhKMtBIpM0','8o3qe_MuB4s','9fdvhw0Z4P4','9q-wfIEVyWQ','A-pj1mCbCQY','a4J_Gf6ZD5M','AMfJfMlsCeY','baZzWt619MY','D7XKT7qfYZI','Dl2FX17jY-U','dTj1y2l1XZI','DX99d5pUx-8','E0Wh4loscFo','EdCZf_KRyn8','eiM6LN6zBqQ','F3W_EtJqbI4','Fac2dh_Pseo','fnhMJbdVUek','fRGyNEIYMpE','fVsHtPPP8X8','FVUPcrbe3zQ','G-y6B13lEMU','GWsMJivmpJQ','GyQIpteNn5A','hMDDhHEd0zE','hOR3K72QoKQ','Hqtot8vWLRw','HVgPG127Ylo','IbIV4fOFiIs','IHi9nrHshno','IMPe2BQDVQQ','jBnJnehvRow','kd2_2eDIOyE','kPX5RJ_78UQ','LFjsFmvbgVo','mWt-hqg4UAI','NSIJ9PY9GRs','Oaie7g9i8UQ','pt54K1gcVdg','q9QjFdtY0SM','rzw_kTAuWQg','s-9Y0t9ILTI','S7cS9DWTU2k','T1ZPHrecmaM','tAJhYH_HMhI','uHyEKxvgTsI','VSKss8cHxiY','WOxhxnKXqDQ','woyryaz4aGQ','WvnDzALkf5c','YAgMpg34PVI','YoQHPisK4yw','zwBZyMRFJDU')
  AND (cover_of_groups<>'{}' OR cover_of_members<>'{}')
  AND coalesce(cover_manual,false)=false AND coalesce(tags_manual,false)=false;

-- 대상 목록
--   _R9Q_q7qQig  아이콘  | 코르티스 | ‘루돌프즈’ CORTIS - Jingle Bell Rock (원곡: Bobby Helms)♬
--   1JUtbjA2epA  크리스(솔로)  | 영파씨 | [👠HEELS CHOREO] 영파씨 (YOUNG POSSE) YEONJUNG - Summer Too Hot (원곡: Chris Brown)
--   3gWH95GXvq4  방탄소년단,히카루(케플러),정희철(제국의아이들)  | 케플러 | [THE IDOL BAND / 무대 풀버전] 🎤OFFWHITE - First Love (원곡: 宇多田ヒカル(우타다 히카루))
--   3Z6Zmd5kxU4  나인뮤지스,현아(솔로)  | 트렌드지 | [COVER] TRENDZ(트렌드지) 라엘 - 'LIKE WATER (Feat. 로꼬, 현아)' (원곡 : 잠비노)
--   4L-Vat0XJDw  쟈니(엔시티 127)  | 원어스 | [US RECORD] Johnny Orlando - Last Christmas (Cover by 환웅)
--   5-17hf07URo  비비(힛지스),이홍기(에프티아일랜드)  | 트리플에스 | [SONG] High Lover (Mixtape) by NaKyoung (Original : BIBI)
--   59gtBhLPKyE  갓세븐  | 클로즈유어아이즈 | CLOSE YOUR EYES 'Dangerous' (Original Song by Michael Jackson) Dance Practice | ACON 2026
--   5jhgGtCZqsk  크리스(솔로)  | 영파씨 | [👠HEELS CHOREO] 영파씨 (YOUNG POSSE) YEONJUNG -  Dream (원곡:  Chris Brown)
--   6BjGP_M5Jj4  아이즈원,김민주(솔로)  | 김민주 | [예능연구소 4K] 김민주 직캠 '산책 (원곡: 쿨)' (KIM MINJU FanCam) @Show!MusicCore 210814
--   6G6c9xs6nEE  갓세븐  | 에이티즈 | ATEEZ(에이티즈) BY. HONGJOONG #8 (Fin.) - Beat It (Original. Michael Jackson)
--   78uIpc40jZA  앳하트  | 키스오브라이프 | Fujii Kaze - Michi Teyu Ku (Covered by BELLE) | KISS OF LIFE Japan Debut Tour [Lucky Day]
--   7XY0ND641D8  크리스(솔로)  | 다크비 | 'Chris Brown - Wall 2 Wall' Cover by DKB
--   810hL17Br9Y  캣츠아이  | 아이칠린 | [Special CHILLIN'] ‘Me Too - Megan Trainor’ covered by ICHILLIN’ | 🩷HAPPY ICHILLIN’ DAY🩷
--   8lhKMtBIpM0  비투비,아이들  | 비투비 | [STAR ZOOM IN] BTOB(비투비)_난 알아요 (원곡 - 서태지와 아이들) 170411 EP.23
--   8o3qe_MuB4s  아이콘  | 코르티스 | CORTIS(루돌프즈 코르티스) - Jingle Bell Rock (원곡: Bobby Helms) @SBS GayoDaejeon
--   9fdvhw0Z4P4  히카루(케플러),정희철(제국의아이들)  | 케플러 | [10회] 🎤OFFWHITE - First Love (원곡: 宇多田ヒカル(우타다 히카루))
--   9q-wfIEVyWQ  걸셋  | 빅스 | VIXX (빅스) - 'HAVANA (원곡: Camila Cabello)' [2018 뮤직뱅크 in 칠레 /2018 MUSIC BANK IN CHILE ] |KB
--   A-pj1mCbCQY  쟈니(엔시티 127)  | 앰퍼샌드원 | Johnny Orlando - Last Christmas Covered by 앰퍼샌드원 (AMPERS&ONE)
--   a4J_Gf6ZD5M  아이콘  | 케플러 | [HOOK CLIP] What You Won't Do For Love (원곡: Bobby Caldwell) - Kep1er #김채현
--   AMfJfMlsCeY  유라(걸스데이)  | 에스파 | [LIVE] aespa 카리나 - 수영해 (Virus Edit) (원곡: 유라 (youra)) | 우쥬레코드 에스파 카리나 편
--   baZzWt619MY  쟈니(엔시티 127)  | 앰퍼샌드원 | Johnny Orlando - Last Christmas Covered by 앰퍼샌드원 (AMPERS&ONE)
--   D7XKT7qfYZI  갓세븐  | 에이티즈 | ATEEZ(에이티즈) BY. HONGJOONG #8 (Fin.) - Beat It (Original. Michael Jackson) #Shorts
--   Dl2FX17jY-U  위아이  | 동키즈 | [DKZ] 韋禮安 Weibird Wei - 女孩 소녀 (DKZ ver.) | VOCAL COVER
--   dTj1y2l1XZI  화사(마마무)  | 크레용팝 | [선공개] 화사 & 헨리 - 'Always Remember Us This Way' (원곡: Lady Gaga) [나라는 가수 / Moving voices] | K
--   DX99d5pUx-8  베이비돈크라이  | 원어스 | [US RECORD] Justin Bieber & benny blanco - Lonely (Acoustic) (Cover by RAVN)
--   E0Wh4loscFo  앤톤(라이즈)  | 이수진 | 한수진 (Soojin Han) - Slavonic Dance No. 2 (원곡: Antonín Dvořák)  | K-Pop Live Session | #dail
--   EdCZf_KRyn8  올데이프로젝트  | 유하 | 쿨룩 LIVE ▷유하 'Like A Star' [원곡: Corinne Bailey Rae] /[강한나의 볼륨을 높여요] ｜KBS 210226 방송
--   eiM6LN6zBqQ  유주(솔로)  | 여자친구 | [909 직캠 4K] 유주 세로캠 '첫눈처럼 너에게 가겠다 (원곡 : 에일리)' (YUJU FanCam) | @JTBC K-909 221001
--   F3W_EtJqbI4  정은지(에이핑크)  | 유니티 | [에스페로] Espero - ‘One Call Away’ Cover (Acapella ver.)  (원곡: Charlie Puth) #Shorts
--   Fac2dh_Pseo  걸셋  | 크랙시 | Shawn Mendes, Camila Cabello – Señorita Cover by WishGirls SWAN
--   fnhMJbdVUek  아르테미스  | 이달의소녀 | [DALPLY] 이달의 소녀 하슬 "Christmas Carol Medley" COVER
--   fRGyNEIYMpE  제임스(코르티스)  | 김상우 | [COVER by B] 김상우 – Say You Won't Let Go (Original Song by James Arthur)
--   fVsHtPPP8X8  크리스(솔로)  | 펜타곤 | Chris Brown 'No Guidance' by PENTAGON KINO(키노) l [COVERS] (4K)
--   FVUPcrbe3zQ  걸셋  | 프로미스나인 | 프로미스나인 (fromis_9) 'flaylist' 'Shawn Mendes, Camila Cabello - Señorita' cover by 지원X서연
--   G-y6B13lEMU  크리스(솔로)  | 영파씨 | [👠HEELS CHOREO] 영파씨 (YOUNG POSSE) YEONJUNG - Summer Too Hot (원곡: Chris Brown)
--   GWsMJivmpJQ  걸셋  | 엑스원 | [LAB X] Shawn Mendes, Camila Cabello - Señorita (COVER by X1 이은상)
--   GyQIpteNn5A  리지(솔로)  | 뉴진스 | [By Jeans] 'Lizzy McAlpine - ceilings' Cover by HAERIN | NewJeans
--   hMDDhHEd0zE  갓세븐  | 에이티즈 | ATEEZ(에이티즈) BY. HONGJOONG #3 – Black or White (Original. Michael Jackson)
--   hOR3K72QoKQ  캣츠아이  | 엠씨엔디 | [PLAY MUSIC GROUND] #MCND Alan Walker x Benjamin Ingrosso - Man On The MoonㅣCOVER
--   Hqtot8vWLRw  앰퍼샌드원  | 다크비 | 'Brian Puspos - Temporary' Cover by HEECHAN
--   HVgPG127Ylo  아이브  | 업텐션 | [SUNYOUL’IVE] Mariah Carey - All I Want for Christmas Is You [Cover by 업텐션 선율 (UP10TION SU
--   IbIV4fOFiIs  나하은(언차일드)  | 베리베리 | VERIVERY 계현&연호 - '열애중' (원곡: 벤/하은)
--   IHi9nrHshno  카라  | 드림캐쳐 | [Special Clip] Dreamcatcher(드림캐쳐) 수아 X CLC(씨엘씨) 승연 'Tadow' Cover
--   IMPe2BQDVQQ  네이즈  | 유니스 | 원곡자 윤하 앞에서 윤기 & 턴이 부르는 '스무살 어느 날' | 우쥬레코드
--   jBnJnehvRow  픽시  | 블랙핑크 | [IDOL RADIO] 200612 해시태그 다정&애지 - So Hot (BLACKPINK Remix ver.) (cover)/아이돌 라디오 직캠
--   kd2_2eDIOyE  캔디샵  | 있지 | ITZY LIA "Issues (Julia Michaels)" COVER
--   kPX5RJ_78UQ  원필(데이식스),이홍기(에프티아일랜드)  | 데이식스 | [쇼챔피언 가을 秋억 여행] WONPIL - HeeJae (원필(DAY6) - 희재(원곡 : 성시경)) l Show Champion l EP.450
--   LFjsFmvbgVo  제임스(코르티스)  | 베리베리 | VERIVERY l 민찬 - Say You Won't Let Go (원곡: James Arthur) (Produced by MINCHAN)
--   mWt-hqg4UAI  아이유(솔로)  | 비비지 | #엄지 #UMJI '비밀의 화원' (아이유(IU)) (원곡:이상은) Cover #Shorts
--   NSIJ9PY9GRs  유주(솔로)  | 여자친구 | [909 직캠 4K] 유주 풀캠 '첫눈처럼 너에게 가겠다 (원곡 : 에일리)' (YUJU FullCam) | @JTBC K-909 221001
--   Oaie7g9i8UQ  유주(솔로)  | 여자친구 | [909 포커스캠 4K] 유주 직캠 '첫눈처럼 너에게 가겠다 (원곡 : 에일리)' (YUJU FanCam) | @JTBC K-909 221001
--   pt54K1gcVdg  올데이프로젝트  | 여자친구 | [Cover] GFRIEND UMJI(엄지) - Put Your Records On (원곡:Corinne Bailey Rae)
--   q9QjFdtY0SM  걸셋  | 오마이걸 | [밈PD | MimPD] Shawn Mendes, Camila Cabello - Señorita(Cover)_YOOA(유시아)Feat.MIMI
--   rzw_kTAuWQg  이은상(솔로)  | 시크릿 | 🙈말랑콩떡뽀짝졸귀🙈 이은상이 부르는 애즈원(As One) - 2월29일 LIVE [4K] ㅣLEE EUN SANG | 시크릿커버 (SECRET COVER) |
--   s-9Y0t9ILTI  라임라잇  | 메이딘 | 사건의 지평선 Event Horizon - Cover By LimeLight Suhye
--   S7cS9DWTU2k  나하은(언차일드)  | 배너 | ‘하은’ - 비오는 날 뭐해 Cover by VANNER(배너) - 태환(Tae Hwan)
--   T1ZPHrecmaM  쟈니(엔시티 127)  | 퍼플키스 | Johnny Stimson ‘Flower’ Cover by. 나고은 #퍼플키스 #PURPLE_KISS
--   tAJhYH_HMhI  걸셋  | 프로미스나인 | 프로미스나인 (fromis_9) 'flaylist' 'Camila Cabello - Liar' cover by 서연
--   uHyEKxvgTsI  갓세븐  | 에이티즈 | 2021 BEYOND ASFㅣ홍중(ATEEZ) - Black or White (Original. Michael Jackson)
--   VSKss8cHxiY  아이브  | 업텐션 | [SUNYOUL’IVE] Tones And I - Dance Monkey [Cover by 업텐션 선율 (UP10TION SUNYOUL)]
--   WOxhxnKXqDQ  H.O.T.  | 트와이스 | 미나 X 류필립 X 정서주 – 환희 (원곡 : 정수라) | 피크닉라이브 소풍 | EP.135
--   woyryaz4aGQ  아이브  | 업텐션 | [SUNYOUL’IVE] Peder Elias - Loving You Girl [Cover by 업텐션 선율 (UP10TION SUNYOUL)]
--   WvnDzALkf5c  아이브  | 케플러 | [🟣REK] Cover by YUJINㅣ‘현아 - Bubble Pop!’
--   YAgMpg34PVI  유니스,방윤하(유니스),혜성(배너)  | 소디엑 | 규민(GYUMIN) "ほうき星(혜성)" Cover (원곡 : 윤하)
--   YoQHPisK4yw  나인뮤지스,현아(솔로)  | 트렌드지 | 'LIKE WATER (Feat. 로꼬, 현아)' (원곡 : 잠비노) ra.L verse #TRENDZ #트렌드지 #ra_L
--   zwBZyMRFJDU  캣츠아이  | 엠씨엔디 | [PLAY MUSIC GROUND] #MCND Alan Walker x Benjamin Ingrosso - Man On The MoonㅣCOVERㅣPractice
