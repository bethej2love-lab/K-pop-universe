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

## 2026-08-18

- [완료][artists.json] 에이핑크 김남주 인스타그램 링크 수정 — kimnamjoo_official → sarangdungy(사용자 제보).
- [완료][artists.json] 에이핑크 손나은 탈퇴 반영 — active:true→false, left:"2022.04.08" 추가(웹검색으로 확인, IST엔터테인먼트가 2022-04-08 발표·5인 체제 전환). 같은 그룹 홍유경(2013 탈퇴) 기존 표기 패턴 그대로 따름 — co 필드는 안 건드림(현재 값이 전원 공통 표기라 탈퇴 시점 소속사와 무관).
- [진행중][index.html][kpop_universe.css] "내 우주 카드" 공유 이미지 기능 1차 구현 — 공유 기능 강화 논의 끝에, 새 카드 템플릿을 따로 디자인하는 대신 이미 있는 3D 씬(글로우/듄 컬러링/별밭)을 실제로 캡처해서 쓰는 방식 채택("아름다움"을 새로 만들 필요 없이 앱 본체 미학 재사용). 마이페이지 FAVORITES 섹션에 "✦ 내 우주 카드 만들기" 버튼 신설 — favMode(내 우주 모드)가 켜져서 궤도가 안정된(phase==='active') 상태에서만 동작, 그 라이브 상태를 라이브 카메라는 안 건드리고 임시 카메라로 한 번 더 렌더해서 캡처. `_renderMyUniverseSnapshotDataURL()`(1080×1350 오프스크린 WebGL 캡처, renderer.setSize→render→toDataURL→즉시 원복이 전부 동기라 화면 깜빡임 없음 확인) → `_buildMyUniverseCardDataURL()`(2D 캔버스에 딥네이비+내 별색 틴트 배경 합성 + 발광 타이포로 "{닉네임}의 우주"/"K·POP UNIVERSE" 워터마크) 2단계 파이프라인. 미리보기 모달(#uc-card-overlay)에서 저장(다운로드)/공유(Web Share Level 2, `navigator.canShare({files})`로 이미지 파일 직접 공유 — 미지원 브라우저는 다운로드+토스트로 폴백) 가능. 헤드리스로 실제 이미지를 저장해서 육안 검증하다가 발견 — 화각 안에 즐겨찾기 안 한 다른 그룹 행성이 우연히 걸려서 "남의 우주"처럼 보이는 문제 발견, 캡처 순간만 궤도 밖 행성(bubbleMeshes 중 orbit에 없는 것)을 숨겼다가 즉시 복원하는 방식으로 수정. i18n(T.ko/T.en) 정식 반영. **아직 실제 즐겨찾기 데이터로는 미검증** — 테스트는 헤드리스에서 즐겨찾기 상태를 흉내낸 것이라 실제 서비스에서 그룹 여러 개 + 멤버 동반 별들까지 있을 때 구도가 어떻게 나오는지 사용자가 실사용으로 확인 필요. 다음 단계(같은 렌더러에 파라미터만 바꿔 기념일 카드로 확장)는 이 확인 이후 진행.
- [완료][admin.js][kpop_universe.css][index.html] 영상 관리 패널 정리 — ①버튼 CSS 통일: `#vm-normal-btn`("선택-정상")·`#vm-coverclear-btn`("선택-원곡제외")에 CSS 규칙 자체가 없어서(vm-toolbar 안 다른 버튼들은 다 있는데 이 둘만 브라우저 기본 버튼 스타일로 표시되고 있었음) `#vm-indiv-btn`("선택-개별")과 동일한 블루 스타일 적용해 통일. ②검색 결과 줄에 그룹만 보이던 걸 멤버/콜라보/원곡 태깅 정보까지 한 줄로 요약해 보여주도록 `_vmTagsLine()` 신설(members→"멤버:", with_members+with_groups→"함께:", cover_of_members+cover_of_groups→"원곡:", 값 있는 항목만 " · "로 구분) — `.vm-item` 렌더에 `.vm-tags` 줄 추가, 이 정보를 안 담고 있던 4개 조회 쿼리(전체 탭 3자+ ilike/1~2자 avsCache/검수 탭/무관·숨김 탭)에 전부 필드 추가해서 어느 경로로 들어와도 빠짐없이 보이게 함. 썸네일 화질은 그대로 유지(변경 요청 없었음, mqdefault 그대로). 헤드리스로 가짜 데이터 주입 후 렌더 검증 — 태그 줄 정상 조합("멤버: 지수, 로제 · 함께: 카리나(에스파), 에스파 · 원곡: 아이유(솔로)"), 태그 없는 영상은 줄 자체가 안 생김(조건부 렌더 확인), 버튼 5개 computed style 전부 일치, 콘솔 에러 0건. `_ADMIN_JS_VER` 2026-08-18a→2026-08-18b.
- [완료][index.html][sw.js] CDN 스크립트(three.js/OrbitControls/CSS2DRenderer/supabase-js) 로드 실패 시 로딩 화면 영구 멈춤 수정 — fable이 별도 헤드리스 감사(가오픈 전 점검)로 발견+패치한 걸 검토 후 반영. three.js가 최상위에서 바로 `new THREE.Scene()`을 실행하는 구조라 CDN 차단(회사망/광고차단/CDN 순단)이면 로딩 화면("Here is Our K-Pop Universe..!")에서 에러 안내도 재시도 버튼도 없이 영원히 멈췄음(JSON fetch 쪽엔 이미 재시도가 있었지만 스크립트 로드는 그보다 앞단이라 해당 안 됨). 2중 방어 추가 — ①원본 CDN(cdnjs/jsdelivr) 실패 시 제3 CDN(unpkg)에서 한 번 더 로드 시도(`document.write` 동기 로드로 순서 보장), ②그래도 실패하면 메인 스크립트 최상단 KPU_LIB_GUARD가 기존 "우주를 불러오지 못했어요" 화면과 같은 UI(에러 문구+다시 시도 버튼, KO/EN 자동)로 전환하고 실행 중단 + GA `cdn_load_error` 이벤트 기록. fable이 준 패치 파일(index2.html)이 이 세션에서 그 사이 커밋된 다른 수정 2건(애니버서리 순서 재배열, admin.js 캐시버스팅)이 반영 안 된 시점 스냅샷이라 통째로 덮어쓰지 않고 새로 추가된 가드 블록만 diff로 골라내 현재 index.html에 이식 — 헤드리스로 diff 검증(그 두 수정 외 divergence 없음 확인). sw.js CACHE_VERSION v3→v4(index.html 변경이라 재방문 유저 캐시 무효화 필요). 미검증 1건(fable 보고) — "원본 CDN만 죽고 unpkg는 살아있는" 중간 시나리오는 배포 후 개발자도구에서 cdnjs 요청만 차단해 별도 확인 필요.
- [완료][index.html] admin.js 캐시버스팅 누락 버그 수정 — "HTML 엔티티 정리" 타임아웃을 admin.js에서 고쳤는데(위 항목) GitHub 재업로드까지 했다는데도 사용자가 계속 같은 타임아웃을 겪는다고 제보. 원인 확인 — `_loadAdminScript()`가 `s.src='admin.js'`로 쿼리 파라미터 없이 로드하고 있어서, 브라우저 디스크캐시나 GitHub Pages 앞단 CDN(Fastly)이 재배포 이후에도 옛 admin.js를 계속 서빙할 수 있는 구조였음(코드 자체 재검증 결과 admin.js 최신 파일엔 이미 고친 순수 페이지네이션 방식이 정상 들어있음 — 배포 코드 문제가 아니라 캐시 문제로 결론). `_ADMIN_JS_VER` 문자열 신설해 `admin.js?v=버전`으로 로드하도록 변경 — sw.js의 CACHE_VERSION과 같은 방식으로, admin.js 내용을 바꿀 때마다 이 버전 문자열도 같이 올려야 함(PRINCIPLES.md에 추가 필요).
- [완료][mc_history.json] 6대 음악방송(엠카운트다운/뮤직뱅크/인기가요/음악중심/쇼챔피언/더쇼) MC(엠씨) 역대 계보 데이터 신설 — `{show, memberKo, groupKo, start, end}` 스키마의 독립 JSON 파일, groups/artists/connections.json과 같은 급의 정적 데이터. 각 방송 나무위키 페이지를 fork로 전수 조사한 원본(방송별 기수/이름/재임기간)을 실제 DB 멤버명(artists.json)과 매칭 — 이름만으로 유일하게 매칭되는 케이스, 괄호 힌트(그룹명/영문명)로 동명이인 중 좁혀지는 케이스, 그래도 남는 동명이인은 그룹 데뷔연도/해체연도로 후보를 걸러내는 자동 로직까지 적용해 255건 확정(비아이돌·매칭불가 이름은 전부 제외). 자동 로직으로도 안 풀리는 예외 몇 건은 수동 처리 — 소희(2007 원더걸스·2024 라이즈로 동명이인이 실제 두 명), 김규빈(제로베이스원 vs 앤더블 — 앤더블 데뷔일이 해당 MC 임기 시작보다 늦어 시간상 불가능하다고 판단해 제로베이스원으로 확정), 나나(WOOAH — 매칭 로직이 멤버 영문명만 보고 그룹 영문명 힌트를 못 읽던 버그를 수동 확인으로 우회), 쇼챔피언 4대 도영·재현(NCT 정식 데뷔 전 MC 발탁 — 사용자가 실제로 있었던 일이라 확인해줌, 통상적인 데뷔연도 필터로는 걸러졌을 케이스), 뮤직뱅크 14대 지성(배우 지성이라 비아이돌로 제외, 사용자 확인). 아직 안 한 것 — 이 데이터를 이용한 영상 자동 태깅 개선(MC 진행 클립 vs 무대 클립 구분)과 멤버카드 MC 경력 노출(표기 방식 미정)은 둘 다 향후 과제로 남겨둠, 이번엔 데이터 파일만 신설.
- [완료][admin.js] "HTML 엔티티 깨진 제목/설명 정리(일회용)" 버튼이 "조회 실패: canceling statement due to statement timeout"로 계속 실패하던 버그 수정 — 서버에 `title.ilike.%&#%` 등 OR로 묶은 게 원인이었음. `%&#%`가 2글자 패턴이라 pg_trgm 인덱스가 트라이그램을 못 뽑아 인덱스를 못 타고(3글자 미만은 인덱스 가속 자체가 안 됨), description은 애초에 트라이그램 인덱스가 없어서, OR 조건 중 하나라도 인덱스를 못 타면 전체 테이블(실측 353,910행)을 순차스캔하게 됨 — 바로 위 "전체 영상 검색(admin)" 기능이 예전에 겪었던 "원곡" 스캔 타임아웃과 똑같은 원인. 그때 고친 방식 그대로 재사용 — 서버 필터 없이 순수 id 페이지네이션(1000개씩)으로 전량 가져와 클라이언트에서 엔티티 여부 판별. 실측으로 1페이지(1000행) 0.33초 확인 — 전체 훑는 데 몇 분 걸리겠지만 타임아웃 없이 끝까지 돎.
- [완료][index.html] 탐험 패널 "Today's Anniversary" 줄 순서 변경 — 그룹 데뷔 N주년이 멤버 생일보다 앞(왼쪽)에 오도록 `_buildFeedAnniversaries` 안 debut/bday 두 forEach 블록 순서를 맞바꿈(_appendAnnivStripItem이 매번 list 끝에 이어붙이는 방식이라 호출 순서=화면 순서). 사용자 확인 — 이 기능(Today's Anniversary)엔 그룹 데뷔주년/멤버생일 두 종류만 있고 다른 기념일 로직 없음(마이페이지 즐겨찾기 "기념일 아카이브"는 별개 기능, 거긴 연결 기념일까지 3종류).
- [완료][index.html] "주간 직캠 TOP 20" → "주간 개인 직캠 TOP 20"(EN: Weekly Solo Fancam TOP 20)로 개편 — 그룹 전체 무대/포메이션 영상 말고 개인 직캠만 노출되게 필터 추가. `_buildFeedWeeklyTopCams` 쿼리에 `members` 필드 추가해서 `(v.members||[]).length===1`(정확히 한 명만 태깅) 조건을 기존 `_FANCAM_TITLE_RE` 제목 필터에 AND로 결합. 실제 DB 샘플 조회로 검증 — K-Choreo/MIX직캠(그룹 전체 포메이션)은 members가 빈 배열, 진짜 개인 직캠은 그 한 명만 담겨있는 패턴 확인 후 적용. 최근 7일 실데이터로도 필터 적용 후 53개 후보(그룹당 3개 캡 적용 후) 확보 — 카드 유지에 필요한 최소 3개는 여유 있게 통과. **이 세션부터 index.html이 유일한 정식 파일**이라 별도 동기화 단계 없이 여기서 바로 끝(아래 구조변경 항목 참고).
- [완료][index.html][kpop_universe.html][manifest.json][sw.js][PRINCIPLES.md] **구조 변경: index.html이 유일한 정식 앱 파일이 됨.** 원래 index.html은 kpop_universe.html의 수동 복사본이라 매번 동기화해야 했고 실제로 몇 번 깜빡해서 옛 버전이 노출된 사고가 있었음(오늘 세션에도 2건 발견+수정) — 사용자가 "수동 복사 대신 kpop_universe.html이 index.html로 리다이렉트하게 하자"고 제안했는데, 확인해보니 sitemap.xml·og:url이 전부 루트(index.html)를 정식 URL로 선언해놔서 그 방향대로 하면 대부분 트래픽(검색·공유 유입)이 매번 이중 리다이렉트를 겪고 SEO에도 불리했음. manifest.json의 start_url이 `./kpop_universe.html`로 별도 지정돼있던 게 두 파일이 각자 존재해야 했던 진짜 이유였음을 발견 — 이걸 `./`로 바꿔서 kpop_universe.html을 더 이상 필요 없게 만들고, **반대 방향**으로 kpop_universe.html을 `location.replace('./')`하는 얇은 리다이렉트 파일로 전환(옛 PWA 바로가기/북마크 하위호환용). sw.js도 같이 손봐야 했음 — 오프라인 캐시 폴백 대상이 하드코딩으로 `./kpop_universe.html`이었던 걸 `./`로 변경, PRECACHE_URLS에 `./`·`./index.html` 추가, CACHE_VERSION v2→v3. 헤드리스 크롬으로 실제 리다이렉트 체인(kpop_universe.html 접속 → `/`로 이동 → 앱 정상 로드, GROUPS 249개·콘솔 에러 0건) 검증 완료. **앞으로 코드 작업은 항상 index.html에 할 것 — kpop_universe.html은 절대 직접 수정 금지**(PRINCIPLES.md에 명시).
- [완료][kpop_universe.html] 모바일에서 행성(구체)이 가끔 일시적으로 세로로 찌부/늘어나 보이는 버그 수정 — three.js camera/renderer resize 핸들러가 디바운스 없이 매 resize 이벤트마다 즉시 window.innerWidth/innerHeight로 camera.aspect를 갱신하고 있었음. 모바일(특히 iOS Safari)은 주소창 접힘/펼침·화면회전 도중 resize가 짧은 간격으로 여러 번 발생하는데 그 사이 너비/높이가 순간적으로 안 맞는 값을 보고할 수 있어(2026-08-18, 사용자 제보), 이미 검색창 리사이즈에 쓰던 것과 같은 디바운스(150ms) 패턴 적용. 헤드리스 크롬으로 CDP Emulation.setDeviceMetricsOverride를 30ms 간격 3연타(390×700→390×760→390×800)로 흔들어 실제 주소창 접힘과 유사한 지터를 재현+검증 — 디바운스 중엔 camera.aspect가 중간값 없이 이전 값 그대로 유지되다가 마지막 안정된 크기(390×800)로만 한 번에 갱신되는 것 확인.
- [완료][admin.js][kpop_universe.html] 영상 제목/설명에 "&#39;" 등 HTML 엔티티 그대로 노출되던 버그 수정 — YouTube API가 title/description을 종종 HTML 이스케이프해서 내려주는데(어퍼스트로피→&#39;, &→&amp; 등) 동기화 코드가 그대로 저장, 화면은 안전하게 textContent로만 찍다 보니 엔티티 텍스트 자체가 그대로 보였음. `_decodeHtmlEntities()`(textarea innerHTML→value 트릭, 모든 named/numeric 엔티티 커버) 신설해 동기화 3개 캡처 지점(채널 훑기 `_ytFetchNewVideos`/과거 백필 search API/URL 수동추가)에 전부 적용. 기존에 이미 오염된 채로 저장된 행 정리용으로 "HTML 엔티티 깨진 제목/설명 정리(일회용)" 버튼 신설(tags_manual 행 보호, title_norm도 같이 재계산). 헤드리스 브라우저로 디코딩 로직 자체는 검증 완료(정상 "&" 포함 제목은 안 건드림 확인) — 실제 DB 백필 실행은 관리자가 버튼 눌러야 함.
- [완료][kpop_universe.html] 구글 로그인 "한 번에 안 되고 다시 시도해야 됨" 제보 — 원인 두 가지 발견해 수정. ①buildUniverse()의 최초 데이터 로드(groups/artists/connections.json fetch)에 타임아웃/재시도가 전혀 없어서, 구글 인증 화면 갔다 리디렉트로 돌아오는 순간(모바일에서 특히)처럼 네트워크가 잠깐 불안정한 때와 겹치면 그대로 throw → "우주를 불러오지 못했어요" 화면 — 카드그리드 로딩에 이미 쓰던 조용한 자동재시도(`_withTimeout` factory+retries, 8초×3회)를 여기도 적용. ②createClient()의 detectSessionInUrl이 URL의 `?code=`를 세션으로 교환하는 게 비동기(Supabase 토큰엔드포인트 왕복)라, 리디렉트 직후 곧바로 `getSession()`을 부르면 아직 교환 전이라 예전 익명 세션이 잡히는 레이스 — "구글 로그인 콜백은 감지됐지만 세션이 익명 상태로 남음" 경고가 뜨던 게 바로 이 증상. 짧게(350ms×최대6회) 재확인하는 루프 추가. 헤드리스 크롬으로 정상 로딩 경로 회귀 없음 확인(GROUPS 249개 정상 로드, 콘솔 에러 0건) — 단 실제 구글 OAuth 리디렉트 레이스 자체는 이 환경에서 재현/검증 불가.
- [완료][kpop_universe.html] 디스코그래피 영어모드 "N집" 서수 처리 — 위 재정정 직후 사용자가 "Full 2집"처럼 "집"이 번역 안 된 채 남는 걸 발견, 영어 모드에서만 서수+타입 순서로 재배치("정규 2집"→"2nd Full", "미니 5집"→"5th Mini"). `_ordinal(n)` 헬퍼 신설(11/12/13 예외 포함 표준 서수 접미사 로직), 정규식으로 "N집" 패턴 파싱 후 재조합. 한국어 모드는 그대로 유지("Mini 5집"처럼 Mini만 원래 영단어라 안 어색함).
- [완료][kpop_universe.html] 디스코그래피 앨범 타입 표기 재정정 — 오늘 먼저 "미니"→"EP" 통일 요청받아 처리했는데(위 항목 참고) 사용자가 번복, "EP"→"Mini"가 맞다고 정정 + "정규"도 언어별 전환 신규 요청. 최종 규칙: All/Mini/Single은 Single·All처럼 언어 무관 항상 영문(탭 세그먼트 라벨용 `_discogBucketLabel()` 신설로 기존 정적 객체 `_DISCOG_BUCKET_LABEL` 대체), "정규"만 한국어 모드에선 원문 유지·영어 모드에서만 "Full". `_discogTypeLabel()`도 같은 규칙으로 수정 — 원본 데이터에 "미니 N집" 말고 단독 "EP" 문자열도 있어서(`_discogBucket`의 `/^(미니|EP)/` 버킷 판정과 동일 패턴 적용) 같이 안 잡았으면 "EP" 문구가 남을 뻔한 걸 검증 중 발견해 수정.
- [진행중][kpop_universe.html] 그룹/멤버 카드 무한스크롤 "점세개 안 뜸" 재발 — 8/14에 두 차례(releaseLock 뷰포트 재확인 + 4개 컨테이너 scroll 리스너 보완) 고쳤는데도 사용자가 계속 재발 제보. 로컬에 헤드리스 크롬(CDP, playwright 없이 Node 24 내장 WebSocket/fetch로 직접 구현)으로 실제 재현 시도 — 두 기존 수정 모두 코드상 정상 존재 확인, 스크롤 시뮬레이션으로도 재현 실패(여러 페이지 정상 연속 로드됨). 기존 두 수정의 근본 원인 설명(iOS Safari fixed-position 컨테이너에서 IntersectionObserver 재발화 누락)이 특정 브라우저 엔진 이슈라 Windows Chrome 환경에서 애초에 재현이 안 될 가능성 높음. 어느 이벤트(intersect/scroll)에도 의존하지 않는 3중 안전망으로 setInterval(700ms) 폴링 추가 — moreWrap 위치를 주기적으로 직접 재확인해서 tryLoadMore 호출(hasMore/appendLock으로 이미 막혀있어 평소엔 no-op). 추가하면서 카드 닫힌 뒤에도 이 폴링이 계속 도는 잠재 문제 발견(closeCards가 컨트롤러 상태/리스너를 안 지움 — 기존 scroll 리스너도 같은 결함 있었으나 실제 스크롤이 일어나야만 발화해서 안 드러났던 것) — offsetParent 체크로 카드 닫히면 폴링이 조용히 멈추도록 보완, 헤드리스로 재검증(열림 상태 스크롤 시 정상 페이지네이션, 닫은 뒤 3.5초간 요청 0건) 완료. 사용자가 "여전히 발생"이라 아직 [진행중]으로 남김 — 실제 발생 기기/브라우저 확인 필요.
- [진행중][kpop_universe.html] 위 무한스크롤 건 후속 — 사용자 확인 결과 데스크톱 사파리·모바일 사파리 둘 다에서 발생(안드로이드는 미확인). Windows Chrome으론 재현이 안 되고 실제 발생 환경(사파리)을 테스트할 방법이 없어서, 추측 대신 실측하기로 함 — `tryLoadMore(ko,source)`에 트리거 출처(observer/scroll/poll/releaseLock) 태그 추가해 `_gaEvent('infscroll_trigger',{source})`로 GA에 남김. 이제 실사용 데이터가 쌓이면 IntersectionObserver가 실전에서 얼마나 자주 놓치는지, poll(3중 안전망)이 실제로 얼마나 자주 구제하는지 확인 가능. (구현 중 스스로 발견: scroll 리스너 등록을 인라인 화살표 함수로 바꾸면서 _cleanupScroll의 removeEventListener 대상이 어긋나는 실수를 커밋 전에 잡아 별도 참조로 수정.)
- [완료][kpop_universe.html] 탐험 패널 "Today's Anniversary" 줄 가로 스크롤 안 되던 버그 수정 — #feed-anniv에 .hscroll-drag 클래스+_enableDragScroll 누락(다른 스트립엔 다 있었는데 여기만 빠짐, #feed-overlay가 메인 &lt;script&gt;보다 뒤에 있는 정적 HTML이라 스크립트 최상단에서 바로 바인딩하면 안 돼서 _buildFeedAnniversaries() 안에서 지연 바인딩). 근본 원인은 더 넓은 문제였음 — 모바일 카드 바텀시트 스와이프-닫기(_wireSheetSwipe)와 탐험 패널 스와이프-닫기(_wireFeedSwipeDismiss) 둘 다 .hscroll-drag 영역 제외 로직이 없어서, 콘텐츠가 맨 위일 때 가로 스크롤 시도가 세로 방향 손떨림만으로도 시트 닫기/펼치기로 오인식되던 상태였음(#tt의 멤버 스와이프 제외 로직엔 있었는데 이 둘엔 없었음). 두 함수 모두에 같은 제외 체크 추가 — 이제 .hscroll-drag 붙은 줄(카테고리 칩·태그 줄·디스코그라피 스트립·기념일 스트립 등)은 모바일 바텀시트/탐험 패널 안 어디에 있든 좌우 스크롤이 세로 제스처에 안 뺏김.
- [완료][kpop_universe.html] 디스코그래피 앨범 타입 표기 "미니"→"EP" 통일 — groups.json 원본 type 값("미니"/"미니 1집"~"미니 8집")은 안 건드리고(멜론 스크래핑 진행 중이라 동시수정 위험) `_discogTypeLabel()` 신설해 표시 단계에서만 치환(그룹카드 디스코그래피 스트립 배지+상세 팝업 2곳 적용). "미니 5집"→"EP 5집"처럼 뒤에 "집" 붙는 건 그대로 유지("정규 N집"과 같은 패턴이라 안 건드림).
- [완료][kpop_universe.html][kpop_universe.css][admin.js] 어드민 CSS 통일 + 신규 버튼 2종 — ①어드민 팝업 패널(vm/hnn/gp/fbv) 스타일 감사 결과 vm-panel이 가장 오래돼서 배경색·radius·shadow·헤더 폰트굵기·탭 스타일(개별 테두리 필박스)이 나머지 3개(hnn/gp/fbv, 공유 배경+무테두리 세그먼트 방식)랑 어긋나 있던 것 확인 후 값 전체를 gp/fbv 기준으로 맞춤(overflow:hidden 누락도 같이 보완). fbv-close도 지난 세션에 만들 때 살짝 다르게 넣었던 걸 gp-close 기준으로 재수정. HTML/JS(탭 전환 바인딩)는 안 건드리고 CSS 값만 교체. ②영상관리패널에 "선택-정상" 버튼 신설 — 기존 vm-apply-btn은 탭마다 동작이 고정(전체탭은 무관처리만 가능)이라 이미 플래그 섞인 항목들을 한번에 정상으로 되돌릴 방법이 없었음, vm-indiv-btn과 동일 패턴으로 추가. ③그룹/멤버 카드 영상 그리드에 어드민 전용 "전체선택" 버튼 신설 — state.allVids(현재 탭/검색 기준으로 로드된 목록, 필터 바뀔 때마다 리셋되는 값이라 항상 "지금 노출된 것"과 일치) 전체를 한 번에 _selIds에 담음. vm-toolbar/.gc-ch-hd에 flex-wrap:wrap 추가해 버튼 늘어나도 자동 줄바꿈되게 함.
- [완료][index.html] index.html이 kpop_universe.html과 2군데 어긋나 있던 것 발견+동기화 — 8/12 리액션 키 구분자 버그수정(스페이스→null byte)이 index.html엔 반영 안 됨. index.html은 항상 kpop_universe.html과 byte-for-byte 동일해야 함(PRINCIPLES.md에 경고 추가). 이번 세션 작업 끝나고 다시 전체 동기화 완료.
- [완료][kpop_universe.html][index.html] 영어모드(EN) 미번역 텍스트 전수 수정 — 사용자 제보(설정 "N세대" 버튼, 소속사명)로 시작해 전체 감사 후 우선순위대로 전부 수정: ①탐험 피드 카드 제목/부제(포맷모아보기·세대별직캠·주간TOP20·연도별TOP100·데뷔연도모아보기) ②앱 로드 실패 화면 ③피드백 폼 전체(data-i18n 신규 부여) ④컬렉션 관리(새로만들기/이름수정/삭제/공개전환/한줄평/영상개수, `_colVidCountText` 헬퍼 신설) ⑤다중선택 버튼("선택"/"취소"/"N개 선택됨", `_selCountText` 헬퍼 신설) ⑥공유링크 복사 토스트 ⑦기타(가족 라벨·기타앨범포함·즐겨찾기 전체보기·다른아티스트의 커버·콘서트 예매정보/다녀왔어요/한줄후기·음방1위 트로피·N명이 좋아해요·X계정 연결 alert). `applyLang()`에 `data-i18n-title` 속성 신규 지원 추가(title 툴팁용, 기존 data-i18n/data-i18n-ph와 동일 패턴). 설정 "N세대" 버튼은 아이콘이 같은 버튼에 섞여있어 `_updateGenButtonsLang()` 별도 함수로 처리, 이 과정에서 `_openGenInfo` let 선언이 파일 뒷부분에 있어 초기 `applyLang()` 호출 시 TDZ ReferenceError 나던 것 발견해 앞으로 옮겨 수정. 관리자 전용 UI(어드민 검수센터·연결카드 태깅 등)는 의도적으로 미번역 유지.
- [완료][kpop_universe.html][index.html] 소속사(agency) 영문 표기 정확도 개선 — 기존엔 "…엔터테인먼트"→"Ent." 단순 접미사 치환뿐이라 순수 한글 브랜드명(스윙·큐브·젤리피쉬 등)은 여전히 한글로 남았음. groups.json의 147개 소속사명 중 한글 포함 110개 전체를 나무위키/웹검색으로 실제 공식 영문 표기 확인해 `_AGENCY_EN` 매핑 테이블로 추가(`_dispAgency`가 테이블 우선 조회, 없으면 기존 접미사 치환으로 폴백). 판타지오(Fantagio, "Fantasio" 아님)·플레디스(Pledis)·웨이크원(WAKEONE)처럼 음차 추측과 실제 표기가 다른 사례 다수 확인. `포켓돌스튜디오 / 엠이오` 1건은 영문 자료 확인 못해 추정치로 남김(코드에 UNVERIFIED 표시).
- [완료][kpop_universe.html] 신규 유저 프로필(별) 첫 생성 시 기본 컬렉션 "Bookmarks" 자동 생성 — 별도 북마크 버튼이 없어 컬렉션이 그 역할을 대신하는데, 유저가 직접 만들어야만 시작할 수 있던 문제. saveProfile()에서 `_isNewProfile&&!collections.length` 조건일 때만 생성(기존 유저 소급 미적용, 익명 상태에서 이미 만든 컬렉션 있으면 건너뜀). 이름은 언어 설정 무관 고정 "Bookmarks"(사용자 결정)
- [완료][kpop_universe.html][kpop_universe.css][admin.js] 피드백 조회 패널 신설 — 기존엔 사용자가 보낸 피드백이 `feedback` 테이블에 저장만 되고 관리자가 볼 UI가 없었음. 설정 패널 어드민 섹션에 "피드백 보기" 버튼 추가, 그룹 우선순위 패널(gp-)과 같은 톤으로 카테고리별 탭(전체/버그/제안/기타)+목록+삭제 기능만 구현(읽음 상태 추적은 없음, 처리 끝나면 삭제로 정리하는 방식). `feedback` 테이블에 `id`·`created_at` 컬럼 있다고 가정하고 짰으니 실제 스키마와 다르면 확인 필요.

## 2026-08-15

- [완료][kpop_universe.html][kpop_universe.css] 몰입형 쇼츠 모드 UI 항상 표시 — 닫기·리액션·툴바 아이콘 기본 숨김(lb-ui-hidden) 제거, 탭-캡(탭→UI토글) 기능 제거
- [완료][kpop_universe.html] 탐험 버튼으로 새 카드 열릴 때 스크롤 위치 초기화 버그 수정 — display:none 중 scrollTop=0이 Safari에서 무시되던 문제, display:block 직후 재설정으로 보완(openMobSheet 첫 오픈 + 스택 푸시 2곳)
- [완료][kpop_universe.html][kpop_universe.css] 라이트박스 쇼츠 모드 UI 정리 — ① 닫기 버튼 아이콘 항상 chevron(↓)으로 통일(✕ 제거, 모드 무관하게 동일); ② 줄 세개 버튼(lb-shorts-list-btn) 완전 제거; ③ rotate 버튼 양방향 토글로 통합 — 세로(쇼츠)→가로(browse), 가로→세로(shorts) 자유 전환; _lbSwitchToShorts() 신설
- [완료][groups.json][artists.json] 그룹 추가: 아이칠린(ICHILLIN', 2021, KM엔터, 걸그룹 7인), 엔싸인(n.SSign, 2023, nCH엔터, 보이그룹 7인, 청춘스타 출신)
- [완료][kpop_universe.html] 동기화 무관 키워드 추가 — 스프링피버·유뷰녀 킬러 (_JUNK_TITLE_KEYWORDS_GLOBAL)
- [완료][kpop_universe.html] 빈 탭 숨김 존재 체크 쿼리 버그 수정 — cover는 category='cover' 대신 title_norm ilike(cover·커버·원곡) + content_formats 체크로 수정, variety에 제목 키워드(라디오스타·아는형님 등) 추가, show에 content_formats.cs.{show} 추가 → buildBaseQuery 실제 필터와 일치

## 2026-08-14

- [완료][kpop_universe.html] live·cover 탭 content_formats 크로스탭 지원 — content_formats에 'live'/'cover' 수동 태깅 시 해당 탭에 복수 노출; _pickFeaturedVidFromDB·buildBaseQuery·patchItem 3곳 동기화
- [완료][kpop_universe.html] 빈 탭 자동 숨김 — 카드 오픈 시 all 탭 제외 각 탭에 limit(1) 병렬 존재 확인, 영상 없으면 탭 제거·현재 필터가 해당 탭이면 all로 리셋; fan 탭은 기존 별도 처리 유지
- [완료][kpop_universe.html] 무한스크롤 점 세개 재발화 누락 보완 — scroll 리스너를 mob-card-stack-inner·mob-sheet-inner·side-panel·member-panel 4곳에 추가(IntersectionObserver가 iOS Safari 등에서 fixed 컨테이너 안에서 재발화 놓치는 경우 대비); 이전 releaseLock 뷰포트 체크와 병행
- [완료][kpop_universe.html] 모바일 카드 내 영상 스크롤 감도 상향 — _wireSlowScroll factor 0.85→0.92, coast decay 0.87→0.90 (한 번 터치에 더 긴 거리 스크롤+관성 여운 증가)
- [완료][kpop_universe.html] 멤버 카드 콘서트 분리 — 그룹 멤버는 멤버명 기반 솔로 이벤트만(_loadMemberConcertRow 신설), 솔로 아티스트는 기존대로; DB에 groups=['멤버명'] 추가 즉시 자동 표시
- [완료][kpop_universe.html] Cover 탭 제외 키워드 추가 — 무빙 커버·moving cover·original contents (대표영상쿼리·목록쿼리·patchItem 3곳 동기화)
- [완료][kpop_universe.html] 예능 탭 제목 키워드 분류 추가 — 라디오스타·아는형님·아는 형님·놀라운토요일·전참시 (buildBaseQuery 2곳+patchItem 3곳 동기화, patchItem에서 content_formats 체크도 누락분 추가)
- [완료][kpop_universe.css][kpop_universe.html] Collections 헤더에 인라인 컬렉션 수 표시 — "Collections · n개" 형식, cnt 스팬 별도 스타일(letter-spacing·uppercase 해제, 약간 연하게)
- [완료][kpop_universe.css] 콘서트 표시줄 폰트 11.5px→10.5px 축소, padding-top 10px→7px 축소 / gc-collection-row margin-top 9→7px·padding-top 10→8px 조정(아래 선 간격 감소)
- [완료][kpop_universe.css] 틱톡↔나무위키 아이콘 간격 보정 재수정 — 이전 -3px는 방향이 반대(gap 증가), -11px로 교체해 시각적으로 다른 아이콘 쌍과 균등하게 맞춤
- [완료][kpop_universe.css][kpop_universe.html] 대표(featured) 쇼츠 표시 크기 확대 — 42% 폭 제한 제거, 2열 전체 폭으로 9:16 비율 최대 크기 표시 / 버튼 위치 오버라이드 제거(기본값으로 복귀)
- [완료][kpop_universe.html] Shorts 탭 그리드에 간헐적 와이드 쇼츠 추가 — _groupGcVids에 widenSomeShorts 파라미터, 10% 확률로 단독 2열 폭 카드 삽입(normal 영상과 동일한 방식)

- [완료][kpop_universe.html] 무한스크롤 점 세개 안 나오는 버그 수정 — appendLock 해제 시점에 moreWrap이 이미 뷰포트 안이면 IntersectionObserver가 재발화 안 하던 문제, releaseLock에서 직접 viewport 체크 후 tryLoadMore 호출로 보완
- [완료][kpop_universe.html] Live 탭에 제목 기반 예외 추가 — '리무진서비스'/'리무진 서비스' 포함 영상 category 무관하게 live 탭으로 포함 (buildBaseQuery·_pickFeaturedVidFromDB·patchItem 3곳 동기화)
- [완료][kpop_universe.html][admin.js] variety/show 탭 분류를 category 단일값 → content_formats 배열 기반으로 전환 — 동기화 시 tier 자동 태깅, 수동 저장 시 기존 코너명 태그 보존하며 장르 태그만 교체, 쿼리는 category OR content_formats OR 병행(기존 레거시 행 누락 방지)
- [완료][kpop_universe.html] 어드민 영상 포맷 편집 select에 예능·드라마/영화 옵션 추가
- [완료][kpop_universe.html] Cover 탭 제외 키워드 추가 — discover/recovery/undercover 및 한글판(디스커버·리커버·언더커버) 3곳(대표영상쿼리·목록쿼리·클라이언트 필터) 동기화
- [완료][kpop_universe.css] 멤버 이름 레이블(10명 이하 그룹 웹) 폰트 9.5px→8.5px 축소, 투명도 0.55→0.82로 높이고 text-shadow를 group-label과 동일한 currentColor 이중 글로우 방식으로 변경
- [완료][kpop_universe.html] Cover 탭 제외 키워드 추가 — original ver / cover story / 커버 촬영 / uncover / choom original / the original (목록쿼리·대표영상쿼리·patchItem 클라이언트 필터 3곳 동기화)
- [완료][admin.js] 영상 태그 저장 후 그리드 갱신 딜레이 500ms → 100ms (단일/일괄 저장 모두)
- [완료][kpop_universe.html] 어드민 계정 GPU 렌더링 15fps로 제한 — 일반 유저는 30fps 유지, 로그인 전/일반 계정은 그대로
- [완료][kpop_universe.html][kpop_universe.css] 공개 컬렉션 칩에 삭제 버튼(×) 추가 — mine인 칩에만 hover 시 표시, 클릭 시 confirm 후 `public_collections` + 로컬에서 동시 삭제
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

