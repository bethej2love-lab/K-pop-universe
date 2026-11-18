-- 2026-11-18 Codex 검수: 공개 직캠의 동명이인 4건(제목으로 건별 확인)
-- 빌리 수현 ← 유키스 수현 'The Soju Fairy' 2건 → 유키스 수현으로 재배정
-- 승민 키(스트레이키즈 승민 모음에 노출) ← 유니(uni) 김승민 'DIVE' → 무관(미등록 가수)
-- 카리나 키(에스파 카리나 모음에 노출) ← 방과후설렘 참가자 2학년 카리나 → 무관
create table if not exists public.bak_20261118_foreign_fancam as
  select id, group_ko, members, content_flag, flag_source, flagged_at from yt_channel_videos where id in ('F3ojx5js_Qk','aj4sYjVyac4','P84g7HYvh3k','SL5ckwlWUG4');
alter table public.bak_20261118_foreign_fancam enable row level security;
revoke all on public.bak_20261118_foreign_fancam from anon, authenticated;
update yt_channel_videos set group_ko='유키스', members=array['수현'] where id in ('F3ojx5js_Qk','aj4sYjVyac4') and group_ko='빌리' and members=array['수현'] and content_flag is null and tags_manual=false;
update yt_channel_videos set content_flag='무관', flag_source='manual', flagged_at=now() where id in ('P84g7HYvh3k','SL5ckwlWUG4') and content_flag is null and tags_manual=false;
select id, group_ko, members, content_flag from yt_channel_videos where id in ('F3ojx5js_Qk','aj4sYjVyac4','P84g7HYvh3k','SL5ckwlWUG4');
-- 되돌리기: update yt_channel_videos v set group_ko=b.group_ko, members=b.members, content_flag=b.content_flag, flag_source=b.flag_source, flagged_at=b.flagged_at from public.bak_20261118_foreign_fancam b where v.id=b.id;
