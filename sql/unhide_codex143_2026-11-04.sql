-- 2026-11-04 Codex 검수143차 숨김 2행 해제. 사용자: "숨김 처리는 범죄자 된 멤버들 콘텐츠 처리나 하는 거" — 두 영상은 해당 없음.
-- 1QV4sZnPgXE [#2024MAMA] RIIZE - 영웅 (원곡：NCT 127): 주인도 엔시티 127로 잘못 → 라이즈 주인 + 원곡 엔시티 127, 잠금.
-- XGIAMH69y4M 엄지 - 'Lemon' (米津玄師) Cover: 숨김만 해제(원곡 요네즈 켄시 미등록이라 원곡 칸은 비움).
-- 엄지 '비밀의 화원'(QbGatr39KHA)은 제목이 "(아이유(IU)) (원곡:이상은) Cover" — 아이유 버전 커버라 원곡 아이유 그대로(사용자 결정).
create table if not exists public.bak_unhide143_20261104 as
  select id,group_ko,members,with_groups,cover_of_groups,content_flag,flag_source,flagged_at,tags_manual,now() backed_at from public.yt_channel_videos where id in ('1QV4sZnPgXE','XGIAMH69y4M');
alter table public.bak_unhide143_20261104 enable row level security;
update public.yt_channel_videos set group_ko='라이즈', with_groups='{}', cover_of_groups=array['엔시티 127']::text[], content_flag=null, flag_source=null, flagged_at=null, tags_manual=true
where id='1QV4sZnPgXE' and content_flag='hidden' and group_ko='엔시티 127' and tags_manual=false;
update public.yt_channel_videos set content_flag=null, flag_source=null, flagged_at=null
where id='XGIAMH69y4M' and content_flag='hidden' and tags_manual=false;
select id,group_ko,members,with_groups,cover_of_groups,content_flag,tags_manual from public.yt_channel_videos where id in ('1QV4sZnPgXE','XGIAMH69y4M');
-- 되돌리기: update yt_channel_videos t set tags_manual=false from bak_unhide143_20261104 b where t.id=b.id; update yt_channel_videos t set group_ko=b.group_ko,with_groups=b.with_groups,cover_of_groups=b.cover_of_groups,content_flag=b.content_flag,flag_source=b.flag_source,flagged_at=b.flagged_at from bak_unhide143_20261104 b where t.id=b.id;
