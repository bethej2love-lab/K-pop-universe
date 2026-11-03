-- Codex 78차: KBS 'No Fear' 한빈 직캠은 템페스트 한빈(설명 #TEMPEST #HANBIN)인데 제로베이스원 성한빈으로 저장 → 주인공 정정.
-- 템페스트 공식 "Real me, Kim Tae Rae"에 붙은 김태래(제로베이스원)는 같은 이름 다른 사람 → 제거. 둘 다 수동 확정으로 잠금.
UPDATE public.yt_channel_videos SET group_ko='템페스트', members=ARRAY['한빈'], with_members='{}'
 WHERE id='wUucroH65dE' AND group_ko='제로베이스원' AND tags_manual=false RETURNING id;
UPDATE public.yt_channel_videos SET with_members='{}'
 WHERE id='HuNz3xubpqo' AND with_members=ARRAY['김태래(제로베이스원)'] AND tags_manual=false RETURNING id;
UPDATE public.yt_channel_videos SET tags_manual=true WHERE id IN ('wUucroH65dE','HuNz3xubpqo') RETURNING id, group_ko, members, with_members, tags_manual;
