-- 2026-11-04 Codex 검수145차: 공식 제목에 명시된 게스트가 출연 칸에 없던 자동 태깅 2행.
-- 9tBXHqpY5jw [2024 MBC 가요대제전] YUNA X KARINA X SULLYOON → 에스파 카리나 + 유나(있지)·설윤(엔믹스)  (있지 유나 대표곡에 같은 영상이 연결돼 있음)
-- jmed2pwkAyU 'dyd w/ CHOI SAN & JONGHO @ATEEZofficial' → 라이즈 + 산(에이티즈)·종호(에이티즈). 라이즈 본인 멤버는 제목에 없어 비워 둠.
-- 값이 그대로일 때만, 수동 잠금. 되돌리기: update ... set tags_manual=false; update ... set with_members='{}' where id in (...); (둘 다 원래 with 빈값·잠금 없음)
update public.yt_channel_videos set with_members=array['유나(있지)','설윤(엔믹스)']::text[], tags_manual=true
where id='9tBXHqpY5jw' and coalesce(with_members,'{}'::text[])='{}' and tags_manual=false;
update public.yt_channel_videos set with_members=array['산(에이티즈)','종호(에이티즈)']::text[], tags_manual=true
where id='jmed2pwkAyU' and coalesce(with_members,'{}'::text[])='{}' and tags_manual=false;
select id,group_ko,members,with_members,tags_manual from public.yt_channel_videos where id in ('9tBXHqpY5jw','jmed2pwkAyU');
