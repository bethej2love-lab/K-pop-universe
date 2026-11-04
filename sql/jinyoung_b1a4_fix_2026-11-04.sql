-- 2026-11-04 Codex 검수30·31차: 싱글즈 공식 쇼츠 2건(향수·메시지)은 같은 본편 cPvjY6KSBy4 '스위트홈3 박찬영 역 진영' = 정진영(a0715, B1A4 출신).
-- 갓세븐 진영(a0601)이 아니다. 정진영 탈퇴 후 영상 11건과 같은 규칙(group_ko=비원에이포, members=[진영] — 본인 태그 행은 탈퇴일 컷오프를 안 받는다)으로 옮기고 잠금.
create table if not exists public.bak_jinyoung_20261104 as
  select id,group_ko,members,with_members,tags_manual,now() backed_at from public.yt_channel_videos where id in ('E44GUmqcoLc','U8eBWSknuBc');
alter table public.bak_jinyoung_20261104 enable row level security;
update public.yt_channel_videos set group_ko='비원에이포', members=array['진영']::text[], tags_manual=true
where id in ('E44GUmqcoLc','U8eBWSknuBc') and group_ko='갓세븐' and members=array['진영']::text[] and tags_manual=false;
select id,group_ko,members,tags_manual from public.yt_channel_videos where id in ('E44GUmqcoLc','U8eBWSknuBc');
-- 되돌리기: update yt_channel_videos t set tags_manual=false from bak_jinyoung_20261104 b where t.id=b.id; update yt_channel_videos t set group_ko=b.group_ko,members=b.members from bak_jinyoung_20261104 b where t.id=b.id; (tags_manual은 원래 false)
