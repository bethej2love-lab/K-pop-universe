// 유닛 개인캠·옛 활동명·호우 회귀 테스트 (2026-10-30, Codex 검수25차 개인캠 86건 후속)
//  ① 개인캠 표시(직캠·Focused·FaceCam…)가 있는 유닛 영상은 이름 난 한 사람만 — 유닛 전원 확장 금지
//     (도겸X승관·호시X우지·프로젝트 그룹 UNB 포함, 유닛 명단 밖 같은 그룹 멤버(msnz 박소현)도 그 사람만)
//  ② 그룹별 매칭 전용 이름(groups[].matchNames) — 오마이걸 비니=유빈, 구구단 혜연=조아람·미나=강미나, 유앤비 필독=오광석,
//     프리스틴 나영=임나영. 이 이름들은 그 그룹 문맥에서만(비니=모자라 전역 별칭 금지)
//  ③ 유닛 단체 영상은 여전히 전원(유닛 명단 보정: 세미나에 미나, PRISTIN V에 나영)
//  ④ '호우'(폭우·감탄사)는 god 유닛 호우가 아니다 — HOOW·HoooW 표기만
// 실행: node tests/unit-indivcam.test.js
const { _m2ParseTitle } = require('../tools/matcher_harness.cjs');
let fail = 0;
const mem = (t, g, d) => { const m = _m2ParseTitle(t, undefined, undefined, d); return m && m.membersByGroup ? (m.membersByGroup[g] || []) : null; };
const eq = (t, g, want, d) => {
  const got = mem(t, g, d);
  const ok = got && JSON.stringify([...got].sort()) === JSON.stringify([...want].sort());
  console.log((ok ? '✅ ' : '❌ ') + t.slice(0, 60) + ' → ' + JSON.stringify(got));
  if (!ok) fail++;
};

// ① 개인캠
eq("[페이스캠4K] 도겸X승관 (SEVENTEEN) 도겸 'Blue' (DK X SEUNGKWAN DK FaceCam) @SBS Inkigayo 260118", '세븐틴', ['도겸']);
eq("[페이스캠4K] 도겸X승관 (SEVENTEEN) 승관 'Blue' (DK X SEUNGKWAN SEUNGKWAN FaceCam) @SBS Inkigayo 260118", '세븐틴', ['승관']);
eq("[얼빡직캠 4K] 호시X우지 우지 'STUPID IDIOT' (HxW WOOZI Facecam) @뮤직뱅크(Music Bank) 250314", '세븐틴', ['우지']);
eq("[페이스캠4K] 트리플에스 미소녀즈 박소현 'Christmas Alone' (tripleS msnz Park SoHyun FaceCam)", '트리플에스', ['박소현']);
eq("[얼빡직캠 4K] 트리플에스 미소녀즈 카에데 'Christmas Alone' (tripleS msnz Kaede Facecam)", '트리플에스', ['카에데']);
eq('[예능연구소 직캠] 유앤비 감각 필독 Focused @쇼!음악중심_20180428 Feeling UNB FeelDog', '유앤비', ['오광석']);
eq('[예능연구소 직캠] 유앤비 감각 찬 Focused @쇼!음악중심_20180428 Feeling UNB CHAN', '유앤비', ['강유찬']);
eq('[예능연구소 직캠] 구구단 오구오구 아이스 츄 혜연 Focused @쇼!음악중심_20170812 ICE CHU gugudan', '구구단', ['조아람']);
eq('[예능연구소 직캠] 구구단 세미나 루비 하트 미나 Focused @쇼!음악중심_20180714 Ruby Heart gugudan SEMINA', '구구단', ['강미나']);
eq('[예능연구소 직캠] 프리스틴 브이 네 멋대로 나영 Focused @쇼!음악중심_20180602 Get It PRISTIN V', '프리스틴', ['임나영']);
eq("[MPD직캠] 오마이걸 반하나 비니 직캠 '바나나 알러지 원숭이' (OHMYGIRL BANHANA BINNIE FanCam)", '오마이걸', ['유빈']);
// ② 매칭 전용 이름
eq("[입덕직캠] 오마이걸 비니 직캠 4K ‘Dolphin’ (OH MY GIRL BINNIE FanCam)", '오마이걸', ['유빈']);
eq('[상극사이] 오마이걸(OH MY GIRL) 효정 X 비니 [THE SHOW 210518]', '오마이걸', ['효정', '유빈']);
{ const m = _m2ParseTitle('겨울 비니 코디 추천 니트 모자 하울'); const has = m && Object.values(m.membersByGroup || {}).flat().includes('유빈');
  console.log((!has ? '✅ ' : '❌ ') + '그룹명 없는 "비니"(모자)는 유빈 아님'); if (has) fail++; }
// ③ 유닛 단체는 전원
eq("[MPD직캠] 프리스틴 V 직캠 '네 멋대로(Get It)' (PRISTIN V FanCam) | @MCOUNTDOWN_2018.6.7", '프리스틴', ['임나영', '로아', '은우', '레나', '주결경']);
eq('(Interview) Interview with DK X SEUNGKWAN [Music Bank] | KBS WORLD TV 260109', '세븐틴', ['도겸', '승관']);
// ④ 호우
{ const m = _m2ParseTitle('[4K] 둘이 뭉침 호우 주의☔️ 13명이 뭉치면 WOW 주의💎 SEVENTEEN 레전드 얼빡직캠 몰아보기');
  const god = m && (m.membersByGroup || {}).god; console.log((!god ? '✅ ' : '❌ ') + "'호우 주의'에 god 없음 → " + JSON.stringify(god || null)); if (god) fail++; }
{ const m = _m2ParseTitle('[LIVE] 바다(BADA) - 국지성 호우(localized heavy rain) | 두시탈출 컬투쇼');
  const god = m && (m.membersByGroup || {}).god; console.log((!god ? '✅ ' : '❌ ') + "'국지성 호우'에 god 없음"); if (god) fail++; }
eq('호우(god 손호영&김태우) HoooW - 친구는 이제 끝내기로 해ㅣ세로라이브', 'god', ['손호영', '김태우']);
eq('[IDOL RADIO] 191223 Hooow: 호우 ★메들리 댄스★ /아이돌 라디오 직캠', 'god', ['손호영', '김태우']);

// ⑤ 짝 표기 개인캠(2026-10-30 Codex 검수27차) — 다시 쓴 한 명만, 듀오 직캠은 둘 다
eq("[MPD직캠] 셔누X형원 형원 직캠 4K 'Do You Love Me' (SHOWNU X HYUNGWON HYUNGWON FanCam) | @MCOUNTDOWN", '몬스타엑스', ['형원']);
eq("[페이스캠4K] 웨이션브이-쿤&샤오쥔 쿤 'Back To You' (WayV-KUN&XIAOJUN KUN FaceCam)│@SBS Inkigayo", '웨이션브이', ['쿤']);
eq("[K-Fancam] 정한X조슈아 세븐틴 정한 직캠 '12 o'clock' (JEONGHAN X JOSHUA JEONGHAN Fancam)@뮤직뱅크", '세븐틴', ['정한']);
eq("[MPD직캠] 셔누X형원 직캠 4K 'Do You Love Me' (SHOWNU X HYUNGWON FanCam) | @MCOUNTDOWN", '몬스타엑스', ['셔누', '형원']);
// ⑥ 이름 데이터(2026-10-30 Codex 검수27차) — 퍼플키스 SWAN=수안(박지은 아님), NOWADAYS=나우즈, 라↗️디오≠디오, '알고 보니'≠보니
eq("[K-Fancam] 퍼플키스 수안 직캠 'BBB' (PURPLE KISS SWAN Fancam) @뮤직뱅크(Music Bank) 240322", '퍼플키스', ['수안'], '2024-03-22');
eq("[UNFILTERED CAM] NOWADAYS HYEONBIN(현빈) 'OoWee' 4K | STUDIO CHOOM ORIGINAL", '나우즈', ['현빈']);
{ const m = _m2ParseTitle('🌱쮜디💚 그는 이미 완벽한 라↗️디오 디제이였다 NCT 지성 비하인드 | 친한친구 방송반');
  const d = m && (m.membersByGroup || {})['엑소']; console.log((!d ? '✅ ' : '❌ ') + "'라↗️디오'에 엑소 디오 없음"); if (d) fail++; }
{ const m = _m2ParseTitle('[FULL] 연기 천재인 줄 알았는데 알고 보니 예능 천재');
  const d = m && (m.membersByGroup || {})['드림노트']; console.log((!d ? '✅ ' : '❌ ') + "'알고 보니'에 드림노트 보니 없음"); if (d) fail++; }

console.log(fail ? `\n❌ ${fail}개 실패` : '\n✅ 유닛 개인캠·옛 활동명·호우 테스트 통과');
process.exit(fail ? 1 : 0);
