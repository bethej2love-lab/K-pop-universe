-- Supabase "Disk IO Budget 소진" 경고 대응 인덱스(2026-10-21) — pg_stat_statements 상위 쿼리 기준.
-- ⚠️ Supabase SQL 편집기는 전체를 트랜잭션으로 감싸므로 CONCURRENTLY를 못 쓴다(쓰면 오류). 55만 행이라 각 수 초~수십 초, 그동안 쓰기만 잠깐 대기.
-- 8위(평균 19.6초): 커버 표시가 있는 행만 모으는 부분 인덱스 — 발견 탭 커버곡 선반 후보 집계·tools/build_cover_groups.mjs
create index if not exists idx_ytv_has_cover on public.yt_channel_videos (id) where cover_of_groups <> '{}' or cover_of_members <> '{}';
-- 12위(@> 평균 5.5초)·8위: 커버 원곡 멤버/그룹 포함 검색(카드 "다른 아티스트의 커버" 등)
create index if not exists idx_ytv_cover_of_members on public.yt_channel_videos using gin (cover_of_members);
create index if not exists idx_ytv_cover_of_groups on public.yt_channel_videos using gin (cover_of_groups);
-- 4위(평균 8.3초·1,166회): created_at > 기준선 (관리자 "새로 들어온"·루틴 증분)
create index if not exists idx_ytv_created_at on public.yt_channel_videos (created_at);
analyze public.yt_channel_videos;
