-- 2026-11-04 사용자 원칙 "숨김은 범죄 연루 멤버 콘텐츠만" — 그룹 자체 채널(source_handle=group_ko) 영상 중 사유 기록 없는(flag_source null/auto) 숨김 해제.
-- 실제 목록: 스키즈 한 출연 53(투키즈룸·SKZ VLOG HAN 등)·비비지 엄지 27·더보이즈 뉴 2·하이라이트 윤두준 3·아이브 'JANGWONYOUNG x HapaKristin'·스테이씨·엔하이픈·제베원 등 — 범죄 연루 인물 이름 없음.
-- 사람이 직접 숨긴 manual 5건(TBS CDTV 무대 4·올아워즈 1)은 그대로(사용자 확인 대기). 다른 채널 숨김 2,2xx건은 대부분 엉뚱한 그룹 오태깅이라 이번 범위 밖.
create table if not exists public.bak_unhide_own_20261104 as
  select id,content_flag,flag_source,flagged_at,now() backed_at from public.yt_channel_videos
  where content_flag='hidden' and source_handle=group_ko and coalesce(flag_source,'')<>'manual';
alter table public.bak_unhide_own_20261104 enable row level security;
update public.yt_channel_videos t set content_flag=null, flag_source=null, flagged_at=null
from public.bak_unhide_own_20261104 b where t.id=b.id and t.content_flag='hidden'
  and not (lower(t.title) ~ '(seungri|태일|taeil|himchan|종훈|jonghun|용준형|yong ?jun ?hyu?n?g|승리|힘찬|정준영)');
select (select count(*) from public.bak_unhide_own_20261104) backed,
       (select count(*) from public.yt_channel_videos t join public.bak_unhide_own_20261104 b using(id) where t.content_flag is null) unhidden;
-- 되돌리기: update yt_channel_videos t set content_flag=b.content_flag,flag_source=b.flag_source,flagged_at=b.flagged_at from bak_unhide_own_20261104 b where t.id=b.id;
