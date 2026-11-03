-- 판단 보류였던 6건을 검색으로 확인해 정정(수동 잠금)
UPDATE public.yt_channel_videos SET group_ko='휘브', members=ARRAY['김준민'], with_members='{}' WHERE id='54psj6hzhsI' AND tags_manual=false; -- 에스콰이어 휘브 김준민 포토북 'JUNMINE'
UPDATE public.yt_channel_videos SET group_ko='워너원', members=ARRAY['박지훈'], with_members='{}' WHERE id='aNWXM2k-rWI' AND tags_manual=false; -- KBS 드라마 멀푸봄(박지훈·배인혁) 출연진 라디오
UPDATE public.yt_channel_videos SET group_ko='비투비', members=ARRAY['이민혁'], with_members='{}' WHERE id='TUXNZxzregQ' AND tags_manual=false; -- 보이즈 플래닛 4번째 스타 마스터 = 비투비 이민혁(OSEN)
UPDATE public.yt_channel_videos SET members=ARRAY['셔누','형원'] WHERE id='5Y3PFO858jc' AND tags_manual=false; -- 셔누X형원 유닛 수트댄스, 몬엑 민혁 아님
UPDATE public.yt_channel_videos SET tags_manual=true WHERE id IN ('54psj6hzhsI','aNWXM2k-rWI','TUXNZxzregQ','5Y3PFO858jc');
UPDATE public.yt_channel_videos SET content_flag='무관', flag_source='manual', flagged_at=now() WHERE id='GqGCVGEmyC4' AND content_flag IS NULL; -- 배우 김지훈(투어스 지훈 아님)
SELECT id, group_ko, members, with_members, content_flag, tags_manual FROM public.yt_channel_videos WHERE id IN ('54psj6hzhsI','aNWXM2k-rWI','TUXNZxzregQ','5Y3PFO858jc','GqGCVGEmyC4');
