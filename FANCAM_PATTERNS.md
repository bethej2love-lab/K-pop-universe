# 음악방송 직캠 제목 패턴 카탈로그 (2026-08-29)

`_fancamParseTitle`(admin.js)이 인식하는 구조와, 각 방송사/채널이 실제로 쓰는 제목 틀. 매칭 로직을 손볼 때
이 파일과 `tools/fancam_pattern_probe.js`(시뮬)·`tests/matching.test.js`(회귀)를 같이 본다.

## 공통 구조

```
[태그] 출연자구간 '곡명' (영문 괄호구간) | 방송·날짜 보일러플레이트
```

| 구간 | 내용 | 매칭에서의 취급 |
|---|---|---|
| 태그 `[…]` | 프로그램/코너명 (`MPD직캠`, `안방1열 직캠4K` …) | 방송 식별에만 사용, 매칭 안 함 |
| 출연자 구간 | `그룹명 [멤버명] [직캠/세로캠/풀캠/4K …]` | **primary 그룹 = 여기서 먼저 나온 그룹**. 그룹 토큰 바로 뒤 나머지 = 멤버 후보(정확 대조, 단일음절 허용) |
| 곡명 구간 | `'곡명'` / `"곡명"` / 쇼챔·잇츠라이브는 ` - 곡명` | **매칭 전에 통째로 제거** (그룹·유닛·멤버명과 겹치는 오태깅의 주 원인) |
| 영문 괄호 | `(그룹EN 멤버EN FanCam)` | 출연자 구간의 보조 근거(영문 멤버 접미 일치 등) |
| 보일러플레이트 | `@MusicBank 230414`, `l Show Champion l EP.474` | 무시 |

## 방송사별 실제 포맷

**KBS 뮤직뱅크** (@KBSKpop)
- `[뮤뱅 원픽캠 4K] 아이브 장원영 'I AM' (IVE JANG WONYOUNG FanCam) | @MusicBank 230414`
- `[뮤직뱅크 직캠] 방탄소년단 뷔 'Dynamite' (BTS V FanCam) | @MusicBank 200904`
- `[K-Choreo 8K] 아이브 직캠 'I AM' (IVE Choreography) @MusicBank 230414` (단체)

**MBC 쇼! 음악중심** (@MBCkpop)
- `[예능연구소 4K] 아이브 장원영 직캠 'I AM' (IVE JANG WONYOUNG FanCam) @쇼!음악중심_230415`
- `[예능연구소] 아이브 장원영 'I AM' 4K 세로캠 (IVE JANG WONYOUNG FanCam) | @MBC 쇼! 음악중심 230415`
- `[#음중직캠] …` (해시태그 접두 변형)

**Mnet 엠카운트다운** (@M2MPD)
- `[MPD직캠] 아이브 장원영 직캠 4K 'I AM' (IVE JANG WONYOUNG FanCam) | @MCOUNTDOWN_2023.4.13`
- `[#MPD직캠] … 세로 직캠 4K …` / `[MPD직캠] 아이브 직캠 4K 'I AM' (IVE FanCam)` (단체)

**SBS 인기가요** (@SBSKPOP)
- `[안방1열 직캠4K] 아이브 장원영 'I AM' (IVE JANG WONYOUNG FanCam) @SBS Inkigayo 230416`
- `[안방1열 풀캠4K] 있지(ITZY) 'WANNABE' 풀캠 (ITZY Full Cam)│@SBS Inkigayo_2020.3.15` (단체·그룹(EN) 표기)
- `[안방1열 페이스캠4K] …`, `[안방1열 원픽캠4K] …`

**MBC M 쇼챔피언** (@ALLTHEKPOP) — 따옴표 대신 대시
- `[쇼챔직캠 4K] 아이브 장원영 - I AM (IVE JANG WONYOUNG) l Show Champion l EP.474 l 230419`

**SBS M 더쇼**
- `[THE SHOW 직캠] 아이브 장원영 'I AM' 4K 직캠 (IVE JANG WONYOUNG FanCam) | 더쇼 230418`

**잇츠라이브 it's Live** (@its_live) — 그룹(EN) - 곡명, 직캠 단어 없음
- `[it's Live] 아이브(IVE) - After LIKE` / `[it's KPOP LIVE 잇츠라이브] 아이유(IU) - Love wins all`

**딩고 킬링보이스** (@dingo_music) — 대괄호 태그 없음
- `아이브(IVE)의 킬링보이스를 라이브로! – I AM, LOVE DIVE, After LIKE | 딩고뮤직 | Dingo Music`
- 솔로는 `이무진(Lee Mujin)의 킬링보이스를 라이브로! – …` (ARTISTS에 없는 가수는 기존처럼 미매칭)

**기타 `[…직캠/팬캠/풀캠/세로캠/보이스캠/FanCam…]`** — 태그 안에 이 단어가 있으면 같은 구조로 취급
(팬캠 채널·페스티벌 직캠). 태그가 `[릴레이댄스]`·`[BE ORIGINAL]`처럼 직캠 단어가 없으면 구조로 보지 않고
기존 경로.

## 시뮬로 확인된 오태깅 유형과 처리

| # | 증상 | 예 | 처리 |
|---|---|---|---|
| ① | 곡명이 그룹/유닛명과 겹쳐 primary·with를 뺏음 | 에이티즈 'Treasure'→트레저, 위클리 'After School'→애프터스쿨, 파우 'Boyfriend'→보이프렌드, 티오원 'BOOM POW'→파우, 마마무 단체('마마무+' 유닛) | 곡명 구간 제거 + primary를 출연자 구간 순서로 |
| ② | 곡명 안 멤버명이 출연자로 | 샤이니 'Key of Secret'→키, 영파씨 'XXL' | 곡명 구간 제거 |
| ③ | 멤버명 = 다른 그룹명 | 다이아 유니스→group_ko 유니스 | 멤버 자리 토큰과 같은 그룹 버림 |
| ④ | 단일음절 멤버 누락 | 방탄소년단 뷔, 더보이즈 큐, 인피니트 엘, 빅스 엔, 골든차일드 Y | 그룹 토큰 바로 뒤 정확 대조(단일음절 허용) |
| ⑤ | strictSync 그룹 직캠 skip/유출 | 시크릿·레인보우·god·스피드·배틀·슈가; "god 손호영"→베리베리 호영 | 출연자 구간 선두면 인정(멤버 등록명과 같은 토큰은 제외) |

시뮬 재실행: `node tools/fancam_pattern_probe.js` (전 로스터×실제 곡명×17포맷). 남는 항목은 시뮬 날짜(2026)
기준 탈퇴 게이트·스텔라 재사용 컷오프·유앤비/B.D.U 유닛 확장 등 의도된 동작이다.

## 알려진 한계
- 로테이션 유닛 단체 직캠(`엔시티 유 직캠 'Baggy Jeans'`)은 이름이 없으면 null — 자체채널이면 group_ko는 채널로 정해지므로 유실은 없음.
- 그룹 직캠인데 멤버 여러 명을 나열한 제목(`아이브 장원영 안유진 …`)은 정확 대조가 안 되고 기존 느슨한 매칭에 의존.
- 실제 DB 제목은 여기 없는 변형이 있을 수 있음 — "②-1 음악방송 직캠 재검증" 실행 시 콘솔 표본에서 구조 미인식 사례를 보고 `_FANCAM_SHOW_PATTERNS`에 추가.
