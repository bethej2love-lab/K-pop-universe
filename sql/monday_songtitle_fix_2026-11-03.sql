-- 곡명 'Sunday Monday'(에이핑크)가 위클리 출신 먼데이로 붙은 2건 정리 + '먼데이'를 흔한 단어 보호 목록에(해시태그·그룹명 있을 때만 매칭)
UPDATE public.yt_channel_videos SET with_members='{}'
 WHERE id IN ('fo1wUVj1hQ8','liItxgM8EmA') AND with_members=ARRAY['먼데이(먼데이)'] AND tags_manual=false RETURNING id;
INSERT INTO public.name_match_whitelist(name) SELECT '먼데이' WHERE NOT EXISTS (SELECT 1 FROM public.name_match_whitelist WHERE name='먼데이') RETURNING name;
