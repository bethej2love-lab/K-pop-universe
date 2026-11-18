-- 2026-11-18 Codex 검수(video-sibling-plan-1118.json) 27건 중 확정 정정 — 다른 멤버·다른 가수 직캠이 엉뚱한 멤버로 붙은 것
-- 조건: 지금 값이 검수 때 before와 같고(content_flag NULL·tags_manual=false) 바뀐 적 없을 때만. 백업 표는 RLS로 잠근다(11-18 Supabase 보안 경고 재발 방지).
create table if not exists public.bak_20261118_sibling as
  select id, group_ko, members, content_flag, flag_source, flagged_at from yt_channel_videos
  where id in ('i9IAkVP4MME','zjk6P49h7sw','UhG-LvK6bwM','k75o93jirM4','agSlBfCjtt4','BFrZvSaQV_Q','AwWDIWySAGg','tlS30VRBHg0','JbNwkrJM6d4','1WbNgj667Uc','49DoTnWAUNU','EXVuz_4EISk','5WLsG-OZVE8','usBhzOk9bmg','MhFdNx92VFk','uALvUSiHiDE','g7KXzzjl6Kg','KynjsqxvF3A','dfh0WyODGmA','kkLz9LKK6dc','xJ9UYOivRdw','lLzLpJabpOA','T1Epox5z5d8','xvMAM3UJz8U','88fgEOZnLZ4','0BDx9WqoaiA','-tp0paSxcuk');
alter table public.bak_20261118_sibling enable row level security;
revoke all on public.bak_20261118_sibling from anon, authenticated;

-- ① 다른 가수(솔로 키): 김재환 6 · 재찬(DKZ 출신 솔로 Poster Boy) 3 · 엔플라잉 김재현 1
update yt_channel_videos set group_ko='김재환', members=array['김재환'] where id in ('i9IAkVP4MME','zjk6P49h7sw','UhG-LvK6bwM','k75o93jirM4','agSlBfCjtt4','BFrZvSaQV_Q') and group_ko='데이식스' and members=array['Young K'] and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='재찬', members=array['재찬'] where id in ('AwWDIWySAGg','tlS30VRBHg0','JbNwkrJM6d4') and group_ko='데이식스' and members=array['Young K'] and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='엔플라잉', members=array['김재현'] where id='49DoTnWAUNU' and group_ko='데이식스' and members=array['Young K'] and content_flag is null and tags_manual=false;
-- ② 미등록 가수(더윈드 신재원·코요태 김종민) — 지우지 않고 보류(등록되면 재배정)
update yt_channel_videos set content_flag='보류', flag_source='manual', flagged_at=now() where id in ('1WbNgj667Uc','EXVuz_4EISk') and content_flag is null and tags_manual=false;
-- ③ 같은 그룹 다른 멤버(유닛 문빈&산하의 문빈 직캠 · 팬채널 주인≠촬영 대상)
update yt_channel_videos v set members=x.m from (values
  ('5WLsG-OZVE8',array['문빈'],'윤산하'),('usBhzOk9bmg',array['문빈'],'윤산하'),
  ('MhFdNx92VFk',array['마크'],'쟈니'),('uALvUSiHiDE',array['정우'],'쟈니'),
  ('g7KXzzjl6Kg',array['조슈아'],'에스쿱스'),('KynjsqxvF3A',array['호시'],'원우'),
  ('dfh0WyODGmA',array['장원영'],'이서'),
  ('kkLz9LKK6dc',array['성화'],'윤호'),('xJ9UYOivRdw',array['여상'],'윤호'),('lLzLpJabpOA',array['민기'],'윤호'),
  ('T1Epox5z5d8',array['태민'],'키'),('xvMAM3UJz8U',array['민호'],'키'),
  ('88fgEOZnLZ4',array['동화'],'계훈'),('0BDx9WqoaiA',array['Jun Han'],'가온'),('-tp0paSxcuk',array['세은'],'준민')
) as x(id,m,old) where v.id=x.id and v.members=array[x.old] and v.content_flag is null and v.tags_manual=false;

select id, group_ko, members, content_flag from yt_channel_videos where id in (select id from public.bak_20261118_sibling) order by group_ko, id;
-- 되돌리기: update yt_channel_videos v set group_ko=b.group_ko, members=b.members, content_flag=b.content_flag, flag_source=b.flag_source, flagged_at=b.flagged_at from public.bak_20261118_sibling b where v.id=b.id;
