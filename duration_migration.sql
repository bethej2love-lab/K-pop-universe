-- 영상 재생시간(초) 컬럼 — 2026-09-10
--
-- 왜 필요한가: "쇼츠"를 우리 데이터에서 판별할 방법이 지금은 is_short 하나뿐인데, 그건
-- _probeIsPortrait가 유튜브 oardefault.jpg(원본 비율 썸네일)의 **세로 여부만** 보고 붙이는
-- 플래그라 **길이를 전혀 안 본다**. 그래서 "세로면 쇼츠"라는 근사가 되고, 실측하면 틀린다:
--
--   세로(is_short=true) + 제목상 개인 직캠 173건 중 표본 45건을 실제로 재보니
--     · 90초 이하 32건 — 진짜 짧은 클립(챌린지 직캠 Ver. 13~25초, 선공개 42초, 워터밤 46초)
--     · 90초 초과 13건 — 정상 직캠인데 세로일 뿐([쇼챔1분직캠] 1분46초~2분19초,
--                        NiziU 「Too Bad」 FanCam 7명 전원 2분47~48초)
--
-- 즉 세로를 통째로 빼면 정상 직캠 29%를 같이 버린다. 사용자 기준은 "1분 내외 짧은 영상 = 쇼츠"라
-- 길이로 잘라야 맞다(임계 90초 — 위 실측에서 클립 최대 46초, 정상 직캠 최소 1분46초로 사이가 넓다).
--
-- 채우는 법: 별도 백필 버튼이 없다. 동기화가 이미 videos.list를 호출하고 있고 **part를 더 얹어도
-- 쿼터는 호출당 1로 그대로**라, contentDetails를 같이 받아 저장하게 해뒀다(published_ts와 동일한 수법).
--   · 신규/최근분 → "전체 동기화"에 얹힌 조회수 갱신이 자동으로 채움
--   · 기존 전체분 → 어드민의 "전체 조회수 갱신"을 한 번 돌리면 채워짐
-- 컬럼이 없어도 코드는 안 깨진다(있는지 먼저 프로브하고, 없으면 예전처럼 is_short로 폴백).
--
-- 실행: Supabase 대시보드 > SQL Editor에 붙여넣고 Run.

alter table yt_channel_videos add column if not exists duration_sec integer;

comment on column yt_channel_videos.duration_sec is
  '영상 길이(초). YouTube videos.list contentDetails.duration(ISO8601)을 초로 변환해 저장. '
  'null이면 아직 안 채워진 것 — 그 경우 코드는 is_short(세로 여부)로 폴백한다.';
