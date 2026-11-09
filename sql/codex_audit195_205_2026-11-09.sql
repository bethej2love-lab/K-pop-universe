-- Codex 검수 195·203·205차 마무리(2026-11-09 Claude Code). 백업 _bak_audit195_205_20261109
create table if not exists public._bak_audit195_205_20261109 as select * from public.yt_channel_videos where id in ('b-n6mzRER8E','YXRJTwpLRRo','FlvEwwoLDEY','sDozPLuQYjQ','B0dioR-isJc','fneFZbbVNsI');
alter table public._bak_audit195_205_20261109 enable row level security;
-- 203차: 루나가 크리스탈을 언급한 라디오 → 출연은 루나(크리스탈은 인용 언급)
update public.yt_channel_videos set members=array['루나']::text[] where id='b-n6mzRER8E' and group_ko='에프엑스';
-- 205차: 루나 솔로 데뷔 무대(oEmbed 401 = 외부 재생 막힘, 삭제 아님) → 루나 본인 태그
update public.yt_channel_videos set members=array['루나']::text[] where id='YXRJTwpLRRo' and group_ko='에프엑스';
-- 195차: tvN 예능 '온앤오프' 디글 클립 — 하하·이승윤·이혜성 무관, 소유 → 소유
update public.yt_channel_videos set content_flag='무관' where id in ('FlvEwwoLDEY','sDozPLuQYjQ','B0dioR-isJc') and group_ko='온앤오프' and content_flag is null;
update public.yt_channel_videos set group_ko='소유', members=array['소유']::text[] where id='fneFZbbVNsI' and group_ko='온앤오프';
update public.yt_channel_videos set tags_manual=true where id in ('b-n6mzRER8E','YXRJTwpLRRo','FlvEwwoLDEY','sDozPLuQYjQ','B0dioR-isJc','fneFZbbVNsI');
select id,group_ko,members,content_flag,tags_manual from public.yt_channel_videos where id in ('b-n6mzRER8E','YXRJTwpLRRo','FlvEwwoLDEY','sDozPLuQYjQ','B0dioR-isJc','fneFZbbVNsI');
