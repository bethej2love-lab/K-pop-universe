# CONCERT_TOUR_GROUPING.md — 공연 목록을 투어 단위로 묶고 토글 (2026-09-05)

> 데이터 세션 요청. 구현은 index.html이라 **기능 세션에서** 진행 권장.
> 배경: 위키 투어 대량수집으로 kpop_events가 738→3,217건. 한 그룹이 수백 회차(엑소 189·갓세븐 251·
> 데이식스 193). 지금 `_renderConcertRow`는 **공연 1건=1줄**이라 카드가 수백 줄로 뒤덮인다.

## 사용자 요구
- 같은 투어의 여러 회차를 **하나로 묶어** 보여주고, **토글(클릭)하면 개별 회차**가 펼쳐지게.
- 예) "Born Pink World Tour · 67회 (2022–2023)" 한 줄 → 누르면 도시·날짜·공연장 목록.

## 구현 위치
`_renderConcertRow(containerId, events)` (index.html ~20005). 지금 `upcoming`/`past`를 각각
`items.forEach(ev => _makeConcertItem(ev))`로 1줄씩 그린다. 여기를 **투어 그룹핑**으로 바꾼다.

## 스펙
1. **그룹핑 키 = `ev.title`**(투어명). 위키 수집분은 title이 투어명(Born Pink World Tour 등),
   같은 투어의 모든 회차가 같은 title·같은 groups를 가진다. KOPIS 단발성 공연은 title이 제각각이라
   자연히 1건짜리 그룹이 됨.
2. `upcoming`/`past` 각 섹션 안에서 title로 묶는다. 묶음 결과:
   - **회차 1건** → 지금처럼 `_makeConcertItem(ev)` 그대로(투어 아님, 팬미팅·단독 등).
   - **회차 2건 이상** → **투어 헤더 줄** 하나: `🎤 {title} · {n}회 · {최소연도}–{최대연도}` + chevron.
     클릭하면 그 아래 회차들(`_makeConcertItem` 각각, 날짜순)을 펼침/접음(아코디언).
3. 정렬: 투어 묶음은 그 투어의 **대표일자**(예정=가장 이른 날, 지난=가장 늦은 날) 기준으로 기존
   정렬 규칙에 얹는다. 기존 "예정 전부 / 지난 3개 head + 더보기"의 카운트는 **투어 묶음 단위**로 셈
   (지난 투어 3개까지 head, 나머지 접기) — 회차가 아니라 투어 개수 기준이라야 안 뒤덮인다.
4. 회차 아이템(`_makeConcertItem`)에 **도시/국가**가 보이면 좋다(해외투어라 도시가 핵심). 지금 표시
   필드 확인해서 city·country 없으면 추가.
5. 포스터: 투어 헤더에 `poster_url`(투어 대표 1장, 데이터 세션이 채움) 썸네일을 붙이면 카드가 화려해짐(선택).

## 데이터 상태(준비됨)
- kpop_events: title=투어명, groups=[그룹ko], date_start/date_end, venue, city, country 채워짐.
- 포스터: KOPIS/멜론분 722건 기존 + 위키 투어분은 데이터 세션이 `tools/tour_posters.mjs`로 채우는 중.
- ⚠️ 같은 투어라도 **국가별 leg 이름이 title에 없음** — title은 투어명 하나라 그룹핑에 문제없음.
