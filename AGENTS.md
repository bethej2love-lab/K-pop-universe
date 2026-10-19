# AGENTS.md — Codex 등 다른 코딩 에이전트 진입 안내

이 저장소는 Claude Code와 Codex가 같이 작업한다(2026-10-19~). 인수인계는 전부 **CHANGELOG.md**로 한다.

## 시작할 때
1. `git fetch origin` 후 최신 main 위에서 시작(로컬 `git status`만 믿지 말 것 — CHANGELOG 사용 규칙 참고)
2. **CHANGELOG.md**의 "사용 규칙" + 최근 날짜 섹션 + "⏳ 덜 된 일" 먼저 읽기
3. **PRINCIPLES.md** 읽기

## 작업할 때
- 큰 작업은 시작 시 CHANGELOG에 `[진행중]` 한 줄을 먼저 남기고 push — 다른 에이전트와 같은 파일 동시 수정 방지
- 세션 제목은 `## 날짜 (Codex — 주제)` 형식
- 사용자는 비개발자, 한국어 반말로 짧고 쉽게 답한다

## 커밋 전 필수
- `node tests/syntax.test.js` — index.html 인라인 스크립트 문법(사이트가 아예 안 뜨는 사고 방지)
- 데이터(JSON) 일괄 수정 후 `git diff <파일> | grep "^-"`로 의도치 않게 지워진 줄이 없는지 확인, 원본 들여쓰기 유지
- 캐시버스터(`?v=`, `CACHE_VERSION`, `_ADMIN_JS_VER`)는 손대지 않는다 — GitHub Action이 자동 갱신

## 끝날 때
- CHANGELOG에 한 줄씩 `[완료]`/`[이슈]` + `[파일명]` 태그, 남은 일은 "⏳ 덜 된 일"에 **명령·파일·판단 기준**까지
