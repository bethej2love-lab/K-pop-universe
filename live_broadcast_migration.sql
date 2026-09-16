-- 생방송 여부(was_live) 컬럼 — 2026-09-16
--
-- 왜 필요한가: 탐험 "오리지널 콘텐츠" 선반(아이돌 개인 채널)에서 **라이브 방송 아카이브**를 빼려는데,
-- "제목에 live / 라이브가 있으면 제외"는 실측에서 완전히 깨지는 규칙이다.
--
--   source_tier='idol' & is_short=false 1,116건 중 제목에 'live' 포함 70건을 전부 훑어보니:
--     · 거의 전부가 **퍼포먼스 영상** — 백예린 "Turn on that Blue Vinyl Live", 로제 "Live Studio Cover",
--       효린 "[I'm LIVE]" 시리즈, 제니 "Official Live Performance Video", "LIVE CLIP" 계열
--     · 진짜 생방송은 소수 — "CHUNG HA Digital Single [México] Countdown Live"(3,030초=50분) 정도
--   '라이브' 포함 12건도 "[연습실 리얼 라이브]", "무반주 라이브", "신곡 최초 라이브"처럼 대부분 퍼포먼스.
--
-- 즉 키워드로 자르면 선반의 알짜를 통째로 버린다. 그래서 유튜브가 알려주는 사실을 쓴다:
-- videos.list 응답에 liveStreamingDetails 객체가 있으면 그 영상은 생방송(또는 프리미어)이었다.
--
-- ⚠️ 프리미어 공개에도 붙는다. 그래서 이 컬럼만으로 자르지 않고, 앱에서 **길이 20분 이상**만
--    "라이브 아카이브"로 본다(index.html의 _isLiveArchive / _LIVE_ARCHIVE_MIN_SEC). 프리미어는 곡
--    길이(3~5분)이고 생방송 아카이브는 20분을 넘는다. 그래서 duration_migration.sql도 같이 필요하다.
--
-- 채우는 법: 별도 백필 버튼 없음. 쿼터 추가 비용도 0이다(videos.list는 part를 더 얹어도 호출당 1).
--   · 신규/최근 14일분 → "전체 동기화"에 얹힌 조회수 갱신이 자동으로 채움
--   · 기존 전체분      → 어드민 "조회수 순환 갱신"을 누를 때마다 2만 건씩 채워짐(전체 한 바퀴 ~23회).
--                        같은 호출에서 duration_sec도 같이 채운다.
-- 컬럼이 없어도 코드는 안 깨진다(있는지 먼저 프로브하고, 없으면 선반이 예전 그대로 동작).
--
-- 실행: Supabase 대시보드 > SQL Editor에 붙여넣고 Run.

alter table yt_channel_videos add column if not exists was_live boolean;

comment on column yt_channel_videos.was_live is
  '생방송(또는 프리미어)이었던 영상. YouTube videos.list 응답에 liveStreamingDetails가 있으면 true. '
  'null이면 아직 확인 안 한 것. ⚠️ 프리미어에도 붙으므로 단독으로 "라이브 방송"으로 쓰지 말고 '
  'duration_sec >= 1200(20분)과 함께 볼 것 — index.html _isLiveArchive 참고.';
