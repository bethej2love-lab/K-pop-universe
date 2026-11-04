-- 2026-11-04 수동 잠금 행 본인/게스트 칸 역전 14건 맞바꾸기(Codex 검수125·128·129차 + 같은 형태 전수). 사람은 그대로, 칸만.
-- 예: Et2rkOvDphU 있지 members 홍은채 / with 예지(있지) → members 예지 / with 홍은채(르세라핌). 잠금 3단계(false→수정→true). 되돌리기: role_swap_2026-11-04_undo.sql
create table if not exists public.bak_role_swap_20261104 (id text primary key, members text[], with_members text[], backed_at timestamptz default now());
alter table public.bak_role_swap_20261104 enable row level security;
insert into public.bak_role_swap_20261104(id,members,with_members) select id,members,with_members from public.yt_channel_videos where id in ('vWRwu9PIBMo','cYIK6Z_Dzqs','A7jh8GFAT2k','L8BkzFkfH-Y','Xv3J2OjAMb4','PJcnVt9kUEw','7diCafGuqfM','Et2rkOvDphU','0GR9Yhjo76o','d5bh8wY1j18','5z86CN7ON1o','uhrjctmaCdE','NANREMeKf88','_5MLbbeW4DE') on conflict (id) do nothing;
create temp table sw(id text,old_m text[],old_w text[],new_m text[],new_w text[]);
insert into sw values
('vWRwu9PIBMo',ARRAY['홍은채']::text[],ARRAY['규진(엔믹스)']::text[],ARRAY['규진']::text[],ARRAY['홍은채(르세라핌)']::text[]),
('cYIK6Z_Dzqs',ARRAY['홍은채']::text[],ARRAY['규진(엔믹스)']::text[],ARRAY['규진']::text[],ARRAY['홍은채(르세라핌)']::text[]),
('A7jh8GFAT2k',ARRAY['형준']::text[],ARRAY['샤오쥔(웨이션브이)','정세비(이즈나)']::text[],ARRAY['샤오쥔']::text[],ARRAY['정세비(이즈나)','형준(크래비티)']::text[]),
('L8BkzFkfH-Y',ARRAY['형준']::text[],ARRAY['샤오쥔(웨이션브이)','정세비(이즈나)']::text[],ARRAY['샤오쥔']::text[],ARRAY['정세비(이즈나)','형준(크래비티)']::text[]),
('Xv3J2OjAMb4',ARRAY['형준']::text[],ARRAY['샤오쥔(웨이션브이)','정세비(이즈나)']::text[],ARRAY['샤오쥔']::text[],ARRAY['정세비(이즈나)','형준(크래비티)']::text[]),
('PJcnVt9kUEw',ARRAY['정환']::text[],ARRAY['료(엔시티 위시)']::text[],ARRAY['료']::text[],ARRAY['정환(트레저)']::text[]),
('7diCafGuqfM',ARRAY['형준']::text[],ARRAY['샤오쥔(웨이션브이)','정세비(이즈나)']::text[],ARRAY['샤오쥔']::text[],ARRAY['정세비(이즈나)','형준(크래비티)']::text[]),
('Et2rkOvDphU',ARRAY['홍은채']::text[],ARRAY['예지(있지)']::text[],ARRAY['예지']::text[],ARRAY['홍은채(르세라핌)']::text[]),
('0GR9Yhjo76o',ARRAY['형준']::text[],ARRAY['샤오쥔(웨이션브이)','정세비(이즈나)']::text[],ARRAY['샤오쥔']::text[],ARRAY['정세비(이즈나)','형준(크래비티)']::text[]),
('d5bh8wY1j18',ARRAY['형준']::text[],ARRAY['샤오쥔(웨이션브이)','정세비(이즈나)']::text[],ARRAY['샤오쥔']::text[],ARRAY['정세비(이즈나)','형준(크래비티)']::text[]),
('5z86CN7ON1o',ARRAY['형준']::text[],ARRAY['샤오쥔(웨이션브이)','정세비(이즈나)']::text[],ARRAY['샤오쥔']::text[],ARRAY['정세비(이즈나)','형준(크래비티)']::text[]),
('uhrjctmaCdE',ARRAY['홍은채']::text[],ARRAY['이서(아이브)']::text[],ARRAY['이서']::text[],ARRAY['홍은채(르세라핌)']::text[]),
('NANREMeKf88',ARRAY['박우진']::text[],ARRAY['코토네(트리플에스)']::text[],ARRAY['코토네']::text[],ARRAY['박우진(에이비식스)']::text[]),
('_5MLbbeW4DE',ARRAY['홍은채']::text[],ARRAY['휴닝바히에(케플러)']::text[],ARRAY['휴닝바히에']::text[],ARRAY['홍은채(르세라핌)']::text[]);
update public.yt_channel_videos t set tags_manual=false from sw where t.id=sw.id and t.tags_manual=true and t.members=sw.old_m and coalesce(t.with_members,'{}'::text[])=sw.old_w;
update public.yt_channel_videos t set members=sw.new_m, with_members=sw.new_w from sw where t.id=sw.id and t.tags_manual=false and t.members=sw.old_m and coalesce(t.with_members,'{}'::text[])=sw.old_w;
update public.yt_channel_videos t set tags_manual=true from sw where t.id=sw.id;
select t.id,t.members,t.with_members,t.tags_manual from public.yt_channel_videos t join sw using(id) order by t.id;
