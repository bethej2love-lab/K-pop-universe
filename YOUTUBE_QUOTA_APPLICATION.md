# YouTube Data API 쿼터 증량 신청 준비 (2026-09-17)

신청 폼: **https://support.google.com/youtube/contact/yt_api_form**
(YouTube API Services - Audit and Quota Extension Form. 최초 감사·추가 증량 모두 이 폼.
 실패 시 이의신청은 `yt_api_appeals`, 프로젝트 소유권 변경은 `yt_api_change_of_control_form`)

---

## 0. 먼저 알아야 할 것 — 기본 쿼터 구조가 바뀌었다

공식 문서(Quota and Compliance Audits) 기준 **기본 할당은 세 개의 별도 주머니**다:

| 주머니 | 한도 |
|---|---|
| `search.list` | **하루 100콜** (별도) |
| `videos.insert` | 하루 100콜 (별도) |
| 그 외 모든 엔드포인트 합계 | **하루 10,000 유닛** |

우리가 쓰는 `playlistItems.list`·`videos.list`는 세 번째 주머니다. 즉 **증량 신청의 대상은
"10,000 유닛" 쪽**이고, 과거 백필에 쓰던 `search.list`는 이제 이 지갑을 갉아먹지 않는다
(대신 하루 100콜이라는 자체 상한이 있다 — admin.js 8537행이 유일한 사용처).

---

## 1. 신청 전 반드시 맞춰야 하는 것 — 30일 저장 정책

YouTube 개발자 정책 **III.E.4**: 저장한 API 데이터는 **30일 안에 삭제하거나 갱신**해야 한다.

2026년에 생긴 예외(Additional policies for derived metrics and data storage): 감사를 통과하고
**용도를 "Analytics & Reporting"으로 신청해 승인**받은 개발자는 **조회수·좋아요·구독자수 같은
통계 지표를 최대 36개월** 저장할 수 있다.

> ⚠️ **제목은 예외가 아니다.** 같은 문서가 못박는다 —
> *"Other content like video titles, creator names, and comment text still must follow the 30-day policy."*

### 우리 상태 (2026-09-17 기준)

| 저장 데이터 | 갱신 주기 | 정책 |
|---|---|---|
| `view_count` (조회수) | 약 24일 (순환 갱신 2만/일 ÷ 471,192행) | 36개월 예외 신청 대상 |
| `title` / `title_norm` | 약 24일 ← **이번에 고침** | 30일 규칙 적용 ✅ |
| `duration_sec` / `was_live` | 약 24일 | 30일 규칙 적용 ✅ |
| 삭제·비공개 영상 | `unavailable_at`으로 감지 후 화면에서 제외 | ✅ |

**고치기 전까지 제목은 최초 수집 때 한 번 받고 영영 갱신되지 않았다** — 정책 위반 상태였다.
`videos.list`는 part를 더 얹어도 호출당 1유닛이라 `snippet`을 추가하는 데 **추가 비용 0**.
(admin.js `_ytRotateViewCountRefresh`, tests/yt-quota-budget.test.js가 회귀를 막는다)

---

## 2. 신청서에 쓸 내용 (초안)

### 서비스 개요
- **이름**: K-POP UNIVERSE (https://kpop-universe.kr)
- **성격**: K팝 그룹·아티스트를 3D 우주 지도로 탐색하는 **비상업 팬 아카이브**. 광고·유료화 없음.
- **규모**: 그룹 268팀 · 아티스트 1,731명 · 영상 메타데이터 471,192건
- **개인정보 처리방침**: https://kpop-universe.kr/privacy.html (이용약관 /terms.html)

### 쓰는 엔드포인트와 용도
| 엔드포인트 | 용도 | 호출 패턴 |
|---|---|---|
| `playlistItems.list` | 등록된 공식 채널 222개의 신규 업로드 수집 | 채널당 1콜, 체크포인트 기반 증분 |
| `videos.list` | 조회수·재생시간·생방송 여부·제목 갱신 (50개 묶음) | 하루 약 470콜 |
| `search.list` | 과거 영상 백필 전용, 평시 경로에 없음 | 거의 사용 안 함 |

### 왜 증량이 필요한가 (핵심 논거)
현재 하루 10,000 유닛 중 자동화가 약 9,018을 쓴다:
- 신규 업로드 폴링: 채널 222개 × 최대 27회/일
- 저장 데이터 30일 갱신 의무 이행: 471,192건을 24일 주기로 순환 (하루 400유닛)

**즉 증량 요청분의 대부분은 "정책이 요구하는 30일 갱신"을 지키기 위한 것**이다.
영상이 계속 늘어나므로(최근 90일 29,379건 유입, 하루 약 326건) 현재 한도로는
갱신 주기가 30일을 넘기게 된다. → 이 논거를 전면에 세울 것.

### 데이터 취급 (폼이 반드시 묻는 항목)
- **저장 위치**: Supabase(PostgreSQL), 비공개 테이블 + RLS. 공개 읽기만 허용.
- **저장 항목**: 영상 id, 제목, 썸네일 URL, 게시일, 조회수, 재생시간, 채널 핸들.
- **갱신/삭제**: 전 행이 약 24일 주기로 순환 갱신. API 응답에서 사라진 영상은 `unavailable_at`으로
  표시하고 사용자 화면에서 제외.
- **사용자 인증(OAuth)**: **없음.** 공개 데이터만 API 키로 읽는다. 따라서 사용자별 Authorized Data,
  동의 철회 처리 대상이 없다.
- **재배포·다운로드 제공**: 없음. 영상은 YouTube 임베드 플레이어로만 재생.

### 용도 선택
폼의 **Section 5: Use Cases, API Integration, and Feature Implementation** →
**"Analytics & Reporting"** 을 선택해야 조회수 36개월 저장 예외(derived metrics)가 같이 적용된다.

---

## 3. 흔한 탈락 사유와 우리 대응

| 탈락 사유 | 우리 상태 |
|---|---|
| 용도 설명이 모호함 | 위 개요·엔드포인트별 용도로 구체화 |
| 개인정보 처리방침 없음 | /privacy.html 있음 |
| 스크래핑처럼 보이는 자동화 | 공식 API만 사용, 채널 화이트리스트 기반, 증분 수집 |
| 대량 다운로드 도구로 보임 | 다운로드 기능 없음, 임베드 재생만 |
| 경쟁 분석·데이터 재판매 | 비상업 팬 아카이브, 재배포 없음 |
| 30일 저장 정책 위반 | 24일 순환으로 충족 (제목 포함) |

---

## 4. 절차와 기간

1. 위 폼 제출 → YouTube API Services 팀이 이메일로 연락
2. 추가 질문·전체 감사가 붙을 수 있음
3. **심사 기간 보장 없음.** 보통 수 주, 길면 수 개월 사례도 보고됨

> ⚠️ **유료 증량은 없다.** 쿼터를 돈으로 살 수 없고,
> **Google Cloud 프로젝트를 여러 개 만들어 무료 쿼터를 합치는 건 약관 위반**이다.

현재 사용량은 Google API Console의 **Quotas** 페이지에서 확인.

---

## 5. 제출 전 체크리스트

- [ ] 이 저장소의 `perf(quota)` 커밋 배포 확인 (제목 30일 갱신이 실제로 돌고 있어야 함)
- [ ] 순환 갱신이 하루 1회 자동 실행되는지 루틴 로그로 확인(8단계)
- [ ] Google API Console에서 프로젝트 번호 확보
- [x] /privacy.html에 "4-2. YouTube API 서비스 이용" 절 추가 완료 (YouTube 약관·Google 개인정보처리방침 링크 포함)
- [ ] 폼에서 용도를 **Analytics & Reporting**으로 선택
