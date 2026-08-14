# CHANGELOG

여러 기기(회사/집 컴퓨터, 노트북)와 여러 Claude Code 세션이 공동으로 작업하는 프로젝트라, 세션 간 인수인계용으로 쓰는 로그.

## 사용 규칙
- 날짜별 역순(최신이 위), 같은 날 여러 세션 작업 가능
- `[완료]` `[진행중]` `[이슈]` `[보류]` 태그로 상태 표시
- 파일 수정 항목은 `[파일명]` 태그 추가 — 다른 세션이 충돌 여부 판단용
- 한 줄로 짧게, "뭘 했는지" 위주(자세한 이유/배경은 코드 주석에 있음)
- 새 세션 시작할 때: PRINCIPLES.md + 이 파일 최근 항목 먼저 읽고 시작할 것
- 작업 끝날 때마다 그 세션이 직접 이 파일에 한 줄씩 추가할 것

---

## 2026-08-14

- [완료][kpop_universe.html] 어드민 로그인 시 본인이 만든 공개 컬렉션 안 보이는 버그 수정 — `_loadCollectionRow`의 `pub` 필터를 `owner_id !== uid` → `!mineIds.has(r.id)`로 변경; 자기 uid 공개 컬렉션이 `user_data`에 없으면 mine/pub 양쪽에서 제외되던 문제

- [완료][kpop_universe.css][kpop_universe.html] 멤버 카드 소속 그룹 폰트 조정 — 유닛은 메인 그룹(12px)보다 1pt 작게(11px), 영어 텍스트는 추가 1pt 감소(그룹 11px·유닛 10px), `tg-en` 클래스로 한글 미포함 텍스트 자동 감지
- [완료][kpop_universe.html] WHO'S YOUR BIAS? 검색창 디자인 수정 — 위치 아래로(top 58→76px), 보라빛 제거·더 투명한 물방울 느낌(배경 0.06, blur saturate 140%, border 0.5px, 그림자 축소, border-radius 28px)
- [완료][kpop_universe.html] 탭바 위 떠있던 `#search-wrap` 자동오픈(신규 유저 모바일) 제거 — 중복 검색창이었음
- [완료][kpop_universe.html] "WHO'S YOUR BIAS?" 검색창 개편 — 비로그인 모바일에만 표시, 버튼이 아닌 바로 열린 입력창으로 변경, 탐험·별표 탭 클릭 시 / 검색결과 선택 시 자동 숨김
- [완료][admin.js] admin.js 전체 코드 검토 (파일 수정 없음) — 매칭 예외 목록 하드코딩 증식·`_m2ParseTitle` 복잡도 누적·sweep 함수 중복·two-step tags_manual 저장 취약점 등 개선 포인트 정리해 보고
- [완료] CHANGELOG.md 신설 — 오늘부터 세션마다 기록 습관화
- [완료][admin.js] 어드민 영상관리 검색: 결과 제한 200→1000개로 상향, 1~2글자 검색 대소문자 구분되던 버그 수정(_titleNorm 정규화 누락)
- [완료][kpop_universe.html] 재생 모드 업로드일 표시 — 탐험 피드 스포트라이트 카드 5종에 published_at 누락되어 있던 것 수정
- [완료][groups.json] disbanded 그룹 41개 전수 해체연도/날짜 리서치+반영 (39개 날짜 채움, 이달의소녀·카드는 "해체 아님" 확인되어 플래그 해제)
- [완료][kpop_universe.html] 영상 동기화 시 해체 그룹의 해체일 이후 영상은 수집 안 하도록 컷오프 로직 추가(`_disbandCutoffDate`)
- [완료][groups.json][artists.json] 그룹 추가: 배틀(2006, 배틀신화 출신), 스피카(2012~2017)
- [완료][kpop_universe.html] 해체 그룹·탈퇴 멤버의 소속사(agency) 표기 흐리게 처리(`.tag-chip-past`)
- [완료][groups.json][kpop_universe.html] JX(JYJ) 그룹 행성 제거 → 동방신기 소속 유닛으로 전환 — 전원 active:false인데 disbanded 아니라 행성에 별 없던 버그 처리
- [완료][groups.json] 서바이벌쇼 24개 전수조사 — projectShow 태그 11개 그룹 신규 추가(I-LAND→엔하이픈 등)
- [완료][kpop_universe.html] 온보딩 "Who's Your Bias?" 검색바 — 반투명·페이드인·텍스트 글로우, 최초 1회 타자 입력 모션 추가
- [완료][kpop_universe.html] 멤버 카드 그룹칩 줄(#tg-row) 웹 휠/드래그 스크롤 안 되던 버그 수정 — `_enableDragScroll` 미연결이 원인
- [완료][kpop_universe.html] _PROJECT_UNITS 68개 서브유닛 일괄 추가 (EXO-CBX·SC, 인피니트H·F, BTOB-BLUE·4U, VIXX LR, JJ Project, Jus2, NU'EST W, 이달의소녀 3종, MISAMO, 3RACHA 등 총 68개)
- [완료][artists.json] soloDiscography 추가: 빅스 전원·앰버·레이·디오(엑소)·아이즈원 4명·이찬혁 등
- [완료][artists.json] 나무위키 링크 45명 신규 추가 (라이즈·아이브·빅스·엔시티 드림·에프엑스·엑소 등)
- [완료][artists.json] 인스타그램 링크 추가 — 트리플에스 7명·사쿠라(르세라핌)·리센느 4명 등; 베이비몬스터/보이넥스트도어/엔하이픈/트레저 등 소속사 정책상 없음 확인
- [완료][artists.json] 제로베이스원 누락 멤버 4명 추가 (장하오·리키·김규빈·한유진) — artists.json 총 1,585명

## 2026-08-09~13

- [완료][artists.json] unitDiscography 필드 신설 — groups.json 246개 그룹 전수 서브유닛 조사·80개+ 유닛 멤버별 개별 적용 (NCT U는 앨범별 참여 멤버 분리)
- [완료][artists.json] soloDiscography 대량 추가 (슈퍼주니어 전원·씨스타·애프터스쿨·샤이니 키 등 총 80+명)
- [완료][kpop_universe.html] _PROJECT_UNITS 3개 추가 (아이린&슬기, SM THE BALLAD, NCT U)

