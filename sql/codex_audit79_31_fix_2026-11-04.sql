-- 2026-11-04 Codex 검수79차·31차 확정분 4행(근거: 메인 CHANGELOG 2026-11-02 검수79차·2026-10-30 검수31차, 공식 원본/음원 자료).
-- 79차: 'DOKYUN - LIGHT ON ME' 방송 무대 2건은 블랭키 도균(a1815)의 곡 → 82메이저 김도균이 아니라 블랭키/도균.
--       아이돌라디오 BafcUQNmxpM 설명 #더보이즈 #THEBOYZ #선우 → 선우(엔하이픈)이 아니라 선우(더보이즈). 82메이저 김도균 주인은 유지.
-- 31차: QUWqRV31QQs Marie Claire 'JAY B 월간낚시왕' — 주인은 갓세븐 JAY B(엔하이픈 제이 아님), 진영은 통화 이야기로만 나와 함께한 멤버에서 뺌.
-- 그대로 둔 것: K-jC8IxuRVo(이미 정상), BZTsxYkszdY(갓세븐 진영 정상), E44GUmqcoLc·U8eBWSknuBc(정진영 쪽 — 동명이인 솔로 키 설계 후).
-- 값이 그대로일 때만, 바꾼 행은 수동 잠금. 되돌리기: codex_audit79_31_fix_2026-11-04_undo.sql
create table if not exists public.bak_codex_audit79_31_20261104 as
  select id,group_ko,members,with_members,with_groups,tags_manual,now() backed_at from public.yt_channel_videos
  where id in ('LPQ873womSQ','BlCx_lAES7o','BafcUQNmxpM','QUWqRV31QQs');
alter table public.bak_codex_audit79_31_20261104 enable row level security;
update public.yt_channel_videos set group_ko='블랭키', members=array['도균']::text[], tags_manual=true
where id in ('LPQ873womSQ','BlCx_lAES7o') and group_ko='82메이저' and members=array['김도균']::text[] and coalesce(with_members,'{}'::text[])='{}' and tags_manual=false;
update public.yt_channel_videos set with_members=array['선우(더보이즈)']::text[], tags_manual=true
where id='BafcUQNmxpM' and with_members=array['선우(엔하이픈)']::text[] and tags_manual=false;
update public.yt_channel_videos set group_ko='갓세븐', members=array['JAY B']::text[], with_members='{}', tags_manual=true
where id='QUWqRV31QQs' and group_ko='엔하이픈' and members=array['제이']::text[] and tags_manual=false;
select id,group_ko,members,with_members,tags_manual from public.yt_channel_videos where id in (select id from public.bak_codex_audit79_31_20261104) order by id;
