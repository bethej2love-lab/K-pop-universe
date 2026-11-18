-- 2026-11-18 Claude 검수(정적 페이지 스캔 2: 제목에 본인·그룹명이 없는 카드 270개 직접 판독) — 동명이인/타인 8건 → 무관
-- god 박준형 ← 투빅(2BiC) 준형 MV | 데일리디렉션 임지환 ×2 ← 순순희 지환(윤지환) MV | 클릭비 김태형 ← 폴킴(본명 김태형) MV
-- 뉴비트 조윤후 ← 윤후(윤민수 아들) '좋을텐데' | 우당탕탕소녀단 구한나(2004년생) ← 2006 Music Core 가수 Hanna 'Luxury'
-- 히스토리 장이정 ← 세븐데이즈 출신 가수 이정×하동균 '같이 사랑했는데' | H.O.T. 이재원 ← '스탭입니다 대표와의 식사(명한&재원)' (이명한 대표 채널 스태프)
create table if not exists public.bak_20261118_scan2 as
  select id, group_ko, members, content_flag, flag_source, flagged_at from yt_channel_videos where id in ('4jY3cD7TlyQ','jjsSoaVnGEY','0MBU7Bf7jps','GMzCpzCUhF4','Kx0QiFrygPs','GUKuVJF1r5I','hU4S8E5s-Tk','RrQm2a4Yvlc');
alter table public.bak_20261118_scan2 enable row level security;
revoke all on public.bak_20261118_scan2 from anon, authenticated;
update yt_channel_videos set content_flag='무관', flag_source='manual', flagged_at=now() where id in ('4jY3cD7TlyQ','jjsSoaVnGEY','0MBU7Bf7jps','GMzCpzCUhF4','Kx0QiFrygPs','GUKuVJF1r5I','hU4S8E5s-Tk','RrQm2a4Yvlc') and content_flag is null and tags_manual=false;
select id, group_ko, members, content_flag from yt_channel_videos where id in ('4jY3cD7TlyQ','jjsSoaVnGEY','0MBU7Bf7jps','GMzCpzCUhF4','Kx0QiFrygPs','GUKuVJF1r5I','hU4S8E5s-Tk','RrQm2a4Yvlc');
-- 되돌리기: update yt_channel_videos v set content_flag=b.content_flag, flag_source=b.flag_source, flagged_at=b.flagged_at from public.bak_20261118_scan2 b where v.id=b.id;
