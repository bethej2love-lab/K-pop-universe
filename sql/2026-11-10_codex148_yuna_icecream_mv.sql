-- Codex 148차: 유나 Ice Cream 공식 MV(x0FwbTiD3iA)가 yt_channel_videos에 없어 앨범 영상 목록에서 빠짐(2026-11-10 처리).
-- oEmbed 200 · JYP Entertainment 업로드 · 2026-03-23 공개 확인. 한 행만 추가(채널 재수집 안 함), 확인된 태그라 tags_manual=true.
insert into public.yt_channel_videos (id,group_ko,title,thumb,published_at,published_ts,category,members,with_members,with_groups,content_formats,tags_manual,title_norm,source_handle,source_tier,is_short,cover_of_members,cover_of_groups,song_keys,needs_review)
values ('x0FwbTiD3iA','있지','YUNA “Ice Cream” M/V','https://i.ytimg.com/vi/x0FwbTiD3iA/mqdefault.jpg','2026-03-23','2026-03-23 08:58:06+00','mv',array['유나'],'{}','{}','{}',true,'yuna “ice cream” m/v','JYPEntertainment','music',false,'{}','{}',array['있지:icecream'],false)
on conflict (id) do nothing;
select id,group_ko,members,category,song_keys,tags_manual from public.yt_channel_videos where id='x0FwbTiD3iA';
