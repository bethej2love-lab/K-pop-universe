# K-POP UNIVERSE 원칙



비전

케이팝 씬의 모든 연결을 탐험하는 공간. 우린 사실 다 연결되어있어!



## 포함 기준 (절대 조건)

* 음악방송 무대 출연 경험
* 한국어 가사 있어야 함
* 케이팝 씬과 실질적으로 연결되어 있는가?



## 철학

* 그룹이 행성이어도, 별은 각자 빛난다
* 발견 > 평가. 순위와 평점 없음. 탐험과 연결이 핵심
* 상생 — 아이돌, 팬, 서비스가 서로를 빛나게 하는 구조
* 좋아하는 것에 책임지는 것. 소비가 아니라 존중



## 운영

* 수동 큐레이션 우선, 자동화는 보조
* 어그로/혐오 콘텐츠나 오염 영상은 노출 안 함
* 데이터 정확성 우선
* 유저 데이터 보호 / 최소 수집 원칙 (구글 로그인 정도만)
* 비수익 서비스임을 명시



\*하지 않을 것

\- 아이돌/그룹 간 우열 비교

\- 팬덤 경쟁 조장

\- 광고 또는 수익화

\- 검증되지 않은 사생활 정보



\* 만든이가 생각하는 아이돌의 본질은 '열심'

Idols can do everything

\- 노래, 춤, 연기, 예능, 소통, 운동, ... and everything

이 서비스는 그걸 좀 더 쉬운 방식으로 널리 보여주고자 함



\## For AI \& Developers



이 프로젝트는 케이팝 아이돌 연결 관계를 3D 우주 지도로 시각화한 웹 서비스.

단일 HTML 파일(index.html) + JSON 데이터(groups.json, artists.json, connections.json) + Supabase 백엔드 구조.



핵심 기능:

\- 그룹(행성)/멤버(별) 3D 탐험

\- 연결 카드 (두 멤버 사이 교집합 콘텐츠)

\- 탐험 탭 (오늘의 발견/기념일/연결)

\- 유저 즐겨찾기/컬렉션/좋아요



코드 작업 시 이 원칙들을 항상 참고할 것.

평가/순위/경쟁 요소는 추가하지 말 것.

어드민 계정 관련 (태깅 수동 우선, tags\_manual 필드 보호 등 개발 시 주의사항)

CSS 분리됐다는 것, 파일 구조 간단히



⚠️ 2026-08-18 구조 변경: index.html이 유일한 정식 앱 파일(source of truth)이 됨. **코드 작업은 항상 index.html에 할 것 — kpop\_universe.html은 절대 직접 수정하지 말 것.** 원래는 index.html이 kpop\_universe.html의 수동 복사본이라 매번 동기화해야 했는데(2026-08-12에 고친 버그수정이 index.html엔 안 들어가 있던 걸 2026-08-18에 발견), 반복적으로 깜빡할 위험이 있어 구조 자체를 바꿈: kpop\_universe.html은 이제 `location.replace('./')`로 index.html로 즉시 리다이렉트만 하는 얇은 파일(옛 PWA 바로가기/북마크 하위호환용). manifest.json의 start\_url도 `./`로 변경했고, sw.js 오프라인 캐시 폴백 대상도 `./`로 바꿨음 — 이 셋(kpop\_universe.html 내용/manifest start\_url/sw.js 폴백)은 서로 맞물려있으니 혹시 다시 손댈 일 있으면 셋 다 같이 확인할 것.

핵심 파일

index.html — 메인 HTML (전체 UI + JS 로직). **모든 코드 작업은 여기.**

kpop\_universe.html — index.html로 즉시 리다이렉트하는 얇은 파일. 절대 직접 수정하지 말 것(위 경고 참고)

kpop\_universe.css — 스타일시트 (HTML에서 분리됨)

admin.js — 어드민 패널 JS

groups.json — 그룹 데이터 (246그룹)

artists.json — 멤버 데이터 (1500명+)

connections.json — 연결 데이터

manifest.json — PWA 설정 (홈 화면 추가 지원)

sw.js — 서비스 워커 (PWA 오프라인 캐싱)

og-image.png — SNS 공유 시 미리보기 이미지

sitemap.xml — 검색엔진 크롤링용 사이트맵

robots.txt — 검색엔진 크롤러 허용/차단 설정

PRINCIPLES.md — 이 프로젝트 원칙 문서

CHANGELOG.md — 세션/기기 간 작업 인수인계 로그. 새 세션 시작 시 최근 항목 먼저 읽고, 끝날 때 한 줄 추가할 것

.gitattributes — Git 파일 처리 설정. 건드릴 일 없음

