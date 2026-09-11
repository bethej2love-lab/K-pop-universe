-- music_show_wins: 중복 방지 + 관리자 쓰기 정책 (2026-09-11)
--
-- 배경: 음악방송 1위를 매일 루틴에서 자동 수집하게 되면서(admin.js `_ytSweepMusicShowWins`)
-- 이 테이블이 **처음으로 앱에서 INSERT 대상**이 됐다. 그전까지는 SQL 에디터 전용이었다.
--
-- 실측(2026-09-11, anon publishable 키):
--   · 읽기: music_show_wins 2,626행 / melon_yearly_top100 799행 / spotify_streaming_milestones 455행 — 정상 공개
--   · 익명 쓰기: 세 테이블 모두 빈 INSERT가 42501(RLS 차단) — **이미 잠겨 있다**
-- 즉 보안 쪽은 손댈 게 없다. 문제는 반대쪽이다: 익명이 막힌 건 확인했지만 **관리자(authenticated +
-- admin 이메일)가 INSERT할 수 있는 정책이 있는지는 확인되지 않았다**. select 정책만 있고 insert
-- 정책이 없으면 수집 버튼이 0건 저장으로 조용히 끝난다(admin_bulk_snapshots 전례, 2026-08-22).
--
-- ✅ 확인 완료(2026-09-11) — **쓰기 정책은 이미 있다. 추가할 게 없다.** 실제 pg_policies:
--     · "music_show_wins 전체 읽기 허용"  SELECT / {public} / using(true)
--     · "music_show_wins 관리자만 쓰기"    ALL    / {public} /
--        using·with_check = (current_setting('request.jwt.claims', true) IS NULL
--                            OR (auth.jwt() ->> 'email') = 'bethej2love@gmail.com')
--   ALL이라 INSERT·DELETE가 다 덮인다 → 수집 버튼도 되돌리기 버튼도 관리자 세션에서 그대로 동작한다.
--   anon 키는 JWT 클레임이 항상 실려 있어 앞의 IS NULL 가지에 걸리지 않는다(그래서 42501로 막힘 — 실측 일치).
--   ⚠️ 그러므로 **정책을 새로 만들지 말 것.** 이름만 다른 중복 정책이 쌓인다.
--
-- 남은 건 아래 1번(유니크 인덱스)뿐이다.

-- ── 1) 중복 방지 — 이것만 실행하면 된다 ────────────────────────────────────────
-- 같은 (방송·날짜·그룹·멤버)는 한 번의 수상이다. 지금까지 유니크 제약이 **PK(id)뿐**이라
-- tools/wiki_music_wins.mjs의 `ON CONFLICT DO NOTHING`은 걸릴 제약이 없어 사실상 no-op였다.
-- (실측: 지금 중복 0건 — 스크립트가 코드에서 dedup해온 덕분이지 DB가 막아준 게 아니다. 그래서
--  중복 0건인 지금이 인덱스를 걸 수 있는 시점이다. 중복이 있으면 이 문장이 에러로 알려준다.)
-- member_ko가 NULL이면 유니크 비교에서 빠지므로 coalesce로 빈 문자열을 씌운다.
create unique index if not exists music_show_wins_uniq
  on public.music_show_wins (show, win_date, group_ko, (coalesce(member_ko, '')));


-- ── 2) 실행 뒤 확인 ─────────────────────────────────────────────────────────────
-- (1) 인덱스가 생겼는지:
--       select indexname from pg_indexes where tablename = 'music_show_wins';
--     → music_show_wins_pkey + music_show_wins_uniq 두 개가 나오면 된 것.
-- (2) 관리자로 로그인한 브라우저에서 "🏆 음악방송 1위 수집" 버튼 → 진행 문구가 "N건 추가"로
--     끝나는지 확인. "0건 저장됨 — 쓰기 권한(RLS) 확인 필요"가 뜨면 위 정책이 바뀐 것이므로 재진단.
--
-- 참고: 이 인덱스가 생기면 tools/wiki_music_wins.mjs의 `ON CONFLICT DO NOTHING`도 비로소 실제로
-- 동작한다(그전엔 걸릴 유니크 제약이 PK뿐이라 아무것도 막지 못했다).
