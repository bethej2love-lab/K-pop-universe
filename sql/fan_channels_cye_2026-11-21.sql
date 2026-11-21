-- 클로즈유어아이즈 팬 채널 등록 후보 (2026-11-21, 클라우드 세션 — **미실행**)
-- 사용자 제보: 이번 팬콘(11.20~22) 영상이 유튜브 팬 채널에 이미 올라와 있는데 우리 등록 채널(8곳)엔 '푸딩'(puddingjjang)만 있어 한 건만 들어왔다.
-- 찾은 방법: node tools/fan_channel_candidates.mjs 클로즈유어아이즈 "클유아 팬콘" "CLOSE YOUR EYES FANCON 261120" --alias=클유아
-- 아래는 그 결과에서 **이 그룹 직캠·팬콘 영상을 올린 개인 채널**만 추린 것. 여러 그룹을 찍는 채널(은하마루·잡덕의왕), 해외 투어 관객 영상, 위버스 라이브 자막 채널, 시상식·방송사 채널은 뺐다.
-- ⚠️ 가능하면 어드민 화면의 채널 등록으로 넣을 것(등록 뒤 첫 동기화까지 같이 돈다). SQL로 넣을 땐 채널을 한 번 열어 보고 실행. BEGIN 없음.
-- 사용자가 본 '팽삼식'은 검색 결과에서 핸들을 못 찾았다 — 유튜브에서 채널 주소를 확인해 추가.

insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('nunnu_ishere','https://www.youtube.com/@nunnu_ishere','송눈누','fans','클로즈유어아이즈') on conflict (handle) do nothing;          -- 261120 팬콘 7건
insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('말랑아보카도','https://www.youtube.com/@말랑아보카도','아보카도','fans','클로즈유어아이즈') on conflict (handle) do nothing;        -- 팬콘 DAY1 4K, 쇼챔 미니팬미팅
insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('H1NO1202','https://www.youtube.com/@H1NO1202','日の','fans','클로즈유어아이즈') on conflict (handle) do nothing;                  -- 켄신 직캠(팬콘)
insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('langlanghae_','https://www.youtube.com/@langlanghae_','랑랑해','fans','클로즈유어아이즈') on conflict (handle) do nothing;        -- 사용자 스크린샷의 채널
insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('comeinlikeawave','https://www.youtube.com/@comeinlikeawave','dot..','fans','클로즈유어아이즈') on conflict (handle) do nothing;   -- 서경배 직캠(팬콘)
insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('ilovekongal','https://www.youtube.com/@ilovekongal','alkong','fans','클로즈유어아이즈') on conflict (handle) do nothing;          -- 송승호 직캠(팬콘 DAY1)
insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('2jaesss','https://www.youtube.com/@2jaesss','2jae.ss','fans','클로즈유어아이즈') on conflict (handle) do nothing;                -- 261121 팬콘
insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('929berry','https://www.youtube.com/@929berry','Berry.','fans','클로즈유어아이즈') on conflict (handle) do nothing;               -- 서경배 직캠(TMA)
insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('cye_archive','https://www.youtube.com/@cye_archive','FOLDER','fans','클로즈유어아이즈') on conflict (handle) do nothing;          -- 콘서트 풀영상 아카이브
insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('cye_songseungho','https://www.youtube.com/@cye_songseungho','seungchacco','fans','클로즈유어아이즈') on conflict (handle) do nothing; -- 송승호 위주

-- 확인: select handle,name from public.ext_channels where owner_gko='클로즈유어아이즈' and tier='fans' order by created_at desc;
-- 되돌리기: delete from public.ext_channels where handle in ('nunnu_ishere','말랑아보카도','H1NO1202','langlanghae_','comeinlikeawave','ilovekongal','2jaesss','929berry','cye_archive','cye_songseungho');
