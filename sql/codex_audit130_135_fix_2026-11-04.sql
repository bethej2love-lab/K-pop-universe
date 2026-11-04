-- 2026-11-04 Codex 130·135차 마무리(잠금 3단계). 백업은 bak_locked_outsider_20261104(같은 날 앞 단계)에 이미 있음.
-- 다크비 룬 'Turning Point (Prod. 주헌(몬스타엑스))' 직캠 3: 몬스타엑스는 제작 크레딧 → 주인 다크비/[룬].
-- 크래비티 공식 'Love_or_Die' 챌린지 PCVL7EcIHko: 제목 #ICHILLIN #아이칠린 #CHOWON #초원 → 게스트 초원(아이칠린).
update public.yt_channel_videos set tags_manual=false where id in ('33jexOsuAUE','cCzu2_YuyGI','zXhNojkOcrg','PCVL7EcIHko') and tags_manual=true;
update public.yt_channel_videos set group_ko='다크비', members=array['룬']::text[], with_members='{}'
where id in ('33jexOsuAUE','cCzu2_YuyGI','zXhNojkOcrg') and group_ko='몬스타엑스' and with_members=array['룬(다크비)']::text[];
update public.yt_channel_videos set with_members=array['초원(아이칠린)']::text[] where id='PCVL7EcIHko' and group_ko='크래비티' and coalesce(with_members,'{}'::text[])='{}';
update public.yt_channel_videos set tags_manual=true where id in ('33jexOsuAUE','cCzu2_YuyGI','zXhNojkOcrg','PCVL7EcIHko');
select id,group_ko,members,with_members,tags_manual from public.yt_channel_videos where id in ('33jexOsuAUE','cCzu2_YuyGI','zXhNojkOcrg','PCVL7EcIHko');
