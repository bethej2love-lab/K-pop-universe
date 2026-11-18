-- 2026-11-18 Claude 검수(정적 그룹 페이지 스캔): 제목의 실제 주인으로 재배정 4건
-- 씨엔블루 이정신 ← 아는 외고 '문샤넬 영어 폭격에 정신 못 차리는 조나단' ('정신' 단어 오인) → 피프티피프티 문샤넬
-- 브라운아이드걸스(멤버 없음) ← 헬로비너스 라임 DMC 페스티벌 직캠 → 헬로비너스 라임
-- 레인보우 ← 정용화 '너,나,우리' 라이브(가사 영상, with_members 정용화) → 정용화 솔로 키
-- 영파씨 ← 제이미(Jamie)×가호 듀엣 캐롤(잇츠라이브) → 제이미 솔로 키
create table if not exists public.bak_20261118_scan4 as
  select id, group_ko, members, with_members, with_groups, content_flag from yt_channel_videos where id in ('F3WCSD0gSLU','AZ3qU2lz9Po','fFvNBFFHiLI','3AXe44q--xw');
alter table public.bak_20261118_scan4 enable row level security;
revoke all on public.bak_20261118_scan4 from anon, authenticated;
update yt_channel_videos set group_ko='피프티피프티', members=array['문샤넬'] where id='F3WCSD0gSLU' and group_ko='씨엔블루' and members=array['이정신'] and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='헬로비너스', members=array['라임'] where id='AZ3qU2lz9Po' and group_ko='브라운아이드걸스' and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='정용화', members=array['정용화'], with_members='{}' where id='fFvNBFFHiLI' and group_ko='레인보우' and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='제이미', members=array['제이미'] where id='3AXe44q--xw' and group_ko='영파씨' and content_flag is null and tags_manual=false;
select id, group_ko, members, with_members, content_flag from yt_channel_videos where id in ('F3WCSD0gSLU','AZ3qU2lz9Po','fFvNBFFHiLI','3AXe44q--xw');
-- 되돌리기: update yt_channel_videos v set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups from public.bak_20261118_scan4 b where v.id=b.id;
