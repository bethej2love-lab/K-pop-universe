-- 영상 ↔ 곡 연결 칸(2026-10-16). 루틴 10단계(_ytSweepSongLinks)가 채우고, 앱의 "곡 → 영상"이 이 칸으로 찾는다.
-- 값 예: {'아이브:lovedive','아이브:해야'} — '<영상 주인 group_ko>:<곡 기본형>'(shared.js _songBase)
alter table public.yt_channel_videos add column if not exists song_keys text[];
create index if not exists idx_ytv_song_keys on public.yt_channel_videos using gin (song_keys);
