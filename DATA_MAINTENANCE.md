# DATA_MAINTENANCE.md — 데이터 정기 업데이트 방안

> K-POP UNIVERSE의 기본정보·디스코그래피를 어떻게 최신으로 유지할지 정리(2026-09-03).
> 핵심 원칙: **원본(groups.json·artists.json)만 사람이/툴이 고치고, 파생물(slim·disco/·tracks_index)은
> `build_slim_data.mjs`로 재생성**. 데이터 소스는 나무위키(기본정보, 동명이인 안전)와 멜론(디스코).

---

## 1. 데이터 종류별 성격
| 종류 | 변동 빈도 | 소스 | 채우는 법 |
|---|---|---|---|
| 멤버 생일·국적·나무위키 링크 | 낮음(신인 데뷔 시) | 나무위키 인포박스 | 감사 → 서브에이전트 namu 조회 |
| 그룹 팬덤·SNS 링크 | 낮음 | 나무위키 | 위와 동일 |
| **디스코그래피(신보)** | **높음(수시)** | 멜론 | melon 파이프라인 |
| 해체(disbanded) 표기 | 낮음 | 나무위키 | 수시 보강 |
| 영상 태깅 | 상시 | — | 별도 캠페인([[project_mistag_rootout_campaign]]) |

## 2. 도구
- `tools/data_completeness_audit.mjs` — **기본정보 완성도 감사(읽기 전용)**. 빈 필드(생일·국적·팬덤·SNS)와
  오래된 디스코를 뽑아 `~/Downloads/data_audit/gap_*.json` 3종 생성. 정기 실행의 출발점.
- `tools/melon_solo_audit.mjs` → `result.json`(그룹 melon aid 매핑) — 디스코 파이프라인 1단계.
- `tools/group_disco_audit.mjs` — 디스코 내부정합/나무위키 대조(읽기 전용).
- `tools/group_disco_fill.mjs [--apply] [--groups A,B]` — 나무위키에 있는데 json에 없는 정규/미니를
  멜론에서 커버·트랙까지 채움. 번호충돌 시 그 그룹 통째 스킵(안전).
- `tools/build_slim_data.mjs` — 원본 수정 후 **반드시** 실행(slim·disco/·tracks_index 재생성).

## 3. 정기 루틴(권장 주기)

### A. 기본정보 — 월 1회
```
node tools/data_completeness_audit.mjs          # gap_member_basic / gap_group_basic 생성
# → 각 gap을 서브에이전트에 주고 namu WebFetch로 값 회수(빈 필드만, 동명이인 안전)
# → 원본 수정 → node tools/build_slim_data.mjs → 커밋
```
2026-09-03 1차 완료: 생일 12·국적 12·팬덤 14 채움. 남은 미확보는 **나무위키 링크 자체가 잘못된 것**
(영파씨 COLD/OTB/XXL은 노래문서로 연결, 이니는 404) → 링크부터 고쳐야 함.

### B. 디스코그래피 — 컴백 시즌 후 또는 월 1회
```
node tools/melon_solo_audit.mjs                 # result.json (전 그룹 melon aid)
node tools/group_disco_fill.mjs                 # 드라이런 — 추가 제안 검토
node tools/group_disco_fill.mjs --apply         # 반영
node tools/build_slim_data.mjs                  # 파생물 재생성
```
⚠️ 멜론은 한국 지역 기반이라 해외 CI(GitHub Actions)에서 막힐 수 있음 → **로컬/회사에서 실행**.

### C. 해체 표기 보강 — 수시
감사의 "신보 점검 후보" 상위는 대부분 **해체·비활동인데 `disbanded`가 안 찍힌 그룹**(H.O.T.·SS501·
미쓰에이·에프엑스 등)이다. 이 플래그가 없으면 (a)감사 노이즈 (b)활동 로직 오판이 생긴다. 나무위키
"해체" 여부로 일괄 보강하면 감사 정확도가 오른다.

## 4. 자동화 판단
- **완전 자동(CI cron)**: 멜론·나무위키 스크래핑이 지역/봇차단에 취약해 신뢰도 낮음 → 비권장.
- **권장 = 반자동**: 감사(자동, 안전) + 채우기(서브에이전트 조력, 사람이 커밋). 감사 툴이 갭을 JSON으로
  뱉으므로, 채우기는 "gap 파일 → namu 조회 → 빈 필드만 반영"이 반복 가능한 레시피가 된다.
- 원한다면 감사만 월 1회 자동 실행(cron)해서 갭 리포트를 남기고, 채우기는 그때그때 지시.
