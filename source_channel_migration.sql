-- 영상 출처 채널 기록 컬럼 (2026-08-25)
--
-- 왜: 오태깅의 상당수가 "이 영상이 어느 채널서 왔는지"를 저장 안 해서 생긴다. 예) 혜리 채널의
-- "혜리's club" 영상은 오너가 혜리(걸스데이)인데, 제목만 보고 하츠투하츠/스텔라로 오추론됨. 음악
-- 서바이벌 프로그램 채널의 영상도 "그룹 콘텐츠"로 잘못 끌려옴. 동기화 시점엔 채널·타입(tier)을 이미
-- 알고 있으므로, 그걸 각 행에 남겨두면 버튼/청소가 "오너 채널 영상은 안 건드림", "서바이벌 채널은
-- 보수적으로" 처럼 채널 맥락으로 판단할 수 있다 — 그룹별 하드코딩 로직 없이 클래스 전체를 해결.
--
-- Supabase SQL 에디터에서 1회 실행. 추가 컬럼이라 안전(기존 데이터·동작 영향 없음). 실행 후에 동기화
-- 코드가 이 컬럼을 채우기 시작하고, 기존 372k 행은 별도의 "출처 채널 백필" 도구로 소급 기록한다.
--   • source_handle: 영상을 가져온 채널 식별자(외부채널 handle, 공식그룹은 그룹 키)
--   • source_tier  : 채널 타입 — idol(아이돌 자체/오너 있음) · fans(팬채널) · music(음악방송/직캠) ·
--                    show · variety · magazine · survival 등. 'official'=공식 그룹 자체 채널.

alter table yt_channel_videos add column if not exists source_handle text;
alter table yt_channel_videos add column if not exists source_tier   text;

-- 채널 타입으로 거르는 쿼리(오너채널 제외/서바이벌만 등)가 인덱스를 타게
create index if not exists idx_ytcv_source_tier on yt_channel_videos (source_tier);
