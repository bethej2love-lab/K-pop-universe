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

## 2026-08-15

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

