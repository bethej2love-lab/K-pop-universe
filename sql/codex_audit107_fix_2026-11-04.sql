-- 2026-11-04 Codex 검수107차(91·94·96·98차 미결) 정정 12행. 공식 원본 근거는 Codex audit87 worktree CHANGELOG 91/94/96/98차.
-- ① 보아 원곡 오연결 8행(실제 원곡: 告五人 唯一·Michael Jackson Beat It·Selena Amor Prohibido·카더가든 나무·Kvsh Better — 모두 미등록)
--    → 원곡 칸 비움 + cover_manual 잠금(지금 원곡 해석기는 신화·양요섭 같은 다른 동명곡을 붙일 수 있어 자동 재판정을 막는다). 출연자 태그는 그대로.
-- ② 주인 그룹 오저장 3행(곡명 Fifty-Fifty·일반어 히스토리·몬스타엑스 근거 없음) → 공식 타임라인의 실제 공연자로, 개별출연(auto) 해제, 수동 잠금.
-- ③ zMvkMk-ni8c 퀸덤퍼즐 "안녕 난 위클리 수진이야"(0:01) → 위클리 이수진(수동 잠금 행 — 3단계).
-- 값이 그대로일 때만 바꾼다. 되돌리기: codex_audit107_fix_2026-11-04_undo.sql
create table if not exists public.bak_codex_audit107_20261104 as
  select id,group_ko,members,with_members,with_groups,cover_of_members,cover_of_groups,cover_of_song,content_flag,flag_source,tags_manual,cover_manual,now() backed_at
  from public.yt_channel_videos where id in ('gy5Qg9VCypg','0kp1xGwpLQo','FPEvfOd9t_U','TY-STuJ_VoU','z8Enakt9Nd4','i0igZPLE6A8','xBrU-lc1-O8','gu57J_KXkbg','48pzMGEe09Y','NK2Mwo16sQU','oa-jahF5U2A','zMvkMk-ni8c');
alter table public.bak_codex_audit107_20261104 enable row level security;

update public.yt_channel_videos set cover_of_members='{}', cover_of_groups='{}', cover_of_song=null, cover_manual=true
where id in ('gy5Qg9VCypg','0kp1xGwpLQo','FPEvfOd9t_U','TY-STuJ_VoU','z8Enakt9Nd4','i0igZPLE6A8','xBrU-lc1-O8','gu57J_KXkbg')
  and cover_of_members=array['보아(솔로)']::text[] and tags_manual=false;

update public.yt_channel_videos set group_ko='BAE173', with_groups='{}', content_flag=null, flag_source=null, tags_manual=true
where id='48pzMGEe09Y' and group_ko='피프티피프티' and with_groups=array['BAE173']::text[] and tags_manual=false;
update public.yt_channel_videos set group_ko='에스파', with_groups='{}', content_flag=null, flag_source=null, tags_manual=true
where id='NK2Mwo16sQU' and group_ko='히스토리' and with_groups=array['에스파']::text[] and tags_manual=false;
update public.yt_channel_videos set group_ko='인피니트', members=array['김성규']::text[], with_members='{}', content_flag=null, flag_source=null, tags_manual=true
where id='oa-jahF5U2A' and group_ko='몬스타엑스' and with_members=array['김성규(인피니트)']::text[] and tags_manual=false;

update public.yt_channel_videos set tags_manual=false where id='zMvkMk-ni8c' and group_ko='아이들' and members=array['수진']::text[] and tags_manual=true;
update public.yt_channel_videos set group_ko='위클리', members=array['이수진']::text[] where id='zMvkMk-ni8c' and group_ko='아이들' and tags_manual=false;
update public.yt_channel_videos set tags_manual=true where id='zMvkMk-ni8c';

select id,group_ko,members,with_members,with_groups,cover_of_members,cover_of_song,content_flag,tags_manual,cover_manual from public.yt_channel_videos
where id in (select id from public.bak_codex_audit107_20261104) order by id;
