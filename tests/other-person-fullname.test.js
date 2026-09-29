// "등록 이름 + 한국 성씨 = 다른 사람 풀네임" + 협찬 크레딧 제거 회귀 테스트 (2026-09-29)
//
// 사용자 제보 2건:
//  ① "제임스 안 (James An)"(가수 제임스 안) 외부 채널 영상 8건이 코르티스 제임스로 역추론됐다.
//  ② "THE FIRST TAKE powered by ASAHI SUPER DRY"(맥주 협찬) 4건이 트레저 아사히로 잡혔다.
// 둘 다 _atmStripCommonNounCtx(전 매처 공용 전처리)에서 막는다. 진짜 영상이 같이 죽지 않는지도 고정한다.
// 실행: node tests/other-person-fullname.test.js

const path = require('path');
const ROOT = path.join(__dirname, '..');
const { _m2ParseTitle } = require(path.join(ROOT, 'tools/matcher_harness.cjs'));

let pass = true;
const has = (r, gko, mem) => {
  if (!r) return false;
  const s = JSON.stringify(r);
  return s.includes(`"${gko}"`) && (!mem || s.includes(`"${mem}"`));
};
const expect = (title, gko, mem, want) => {
  const r = _m2ParseTitle(title, undefined, false);
  const got = has(r, gko, mem);
  const ok = got === want;
  if (!ok) pass = false;
  console.log(`${ok ? '✅' : '❌'} ${want ? '잡혀야' : '안 잡혀야'} ${gko}${mem ? ' ' + mem : ''} ← ${title}${ok ? '' : `\n    결과: ${JSON.stringify(r)}`}`);
};

// ── ① 제임스 안 — 다른 사람 ──
expect('제임스 안 (James An) - Sasha | K-Pop Live Session | The Archive', '코르티스', '제임스', false);
expect('James An(제임스 안) - Blue Ink, Hypocrite, A Streetcar Named Desire l HIJACK LIVE', '코르티스', '제임스', false);
expect('The Rehearsal with James An (제임스안)', '코르티스', '제임스', false);
// 진짜 코르티스 제임스는 그대로
expect("[안방1열 직캠4K] 코르티스 제임스 'REDRED' (CORTIS JAMES FanCam) @SBS Inkigayo 260510", '코르티스', '제임스', true);
expect('[UNFILTERED CAM] CORTIS JAMES(제임스) \'REDRED\' 4K | STUDIO CHOOM ORIGINAL', '코르티스', '제임스', true);
// "JAMES GO" — go는 영어 낱말이라 풀네임으로 보지 않는다
expect('CORTIS JAMES GO! FanCam', '코르티스', '제임스', true);
// "○○ 편 |"(에피소드) — 편은 성씨 목록에 있지만 일상어라 풀네임으로 보지 않는다
expect('[주간아이돌] 에스파 카리나 편 | 주간아이돌', '에스파', '카리나', true);
// 중국계 멤버 실명 표기 — Jackson Wang은 갓세븐 잭슨 본인(wang은 성 로마자 목록에서 뺐다)
expect('Jackson Wang  X Fendiman', '갓세븐', '잭슨', true);
// 한국 이름 로마자는 규칙 대상이 아니다 — 트레저 재혁 직캠의 "YOON JAE HYUK"
expect("[안방1열 직캠4K] 트레저 윤재혁 'MY TREASURE' (TREASURE YOON JAE HYUK FanCam)", '트레저', '재혁', true);
// 서양식 이름 + 성 = 다른 사람(현재 오태깅 사례)
expect('Eric Nam, Paradise (에릭남, 파라다이스) [THE SHOW 200811] UHD', '더보이즈', '에릭', false);
expect('바비킴(Bobby Kim) - 골목길(An alley) & 고래의 꿈', '아이콘', 'BOBBY', false);
// 그룹명이 같이 있으면 풀네임 표기여도 본인(NCT 마크 = 이민형)
expect('NCT 127 MARK LEE Fact Check FanCam', '엔시티 127', '마크', true);

// ── ② 협찬 크레딧 ──
expect('白石麻衣 × 絢香 - にじいろ / THE FIRST TAKE powered by ASAHI SUPER DRY', '트레저', null, false);
expect('石崎ひゅーい - 花束 / THE FIRST TAKE powered by ASAHI SUPER DRY', '트레저', null, false);
// 진짜 아사히는 그대로
expect('#HELLOchallenge (YOON JAE HYUK & ASAHI ver.) #TREASURE', '트레저', null, true);

console.log(pass ? '\n🎉 다른 사람 풀네임·협찬 크레딧 테스트 통과' : '\n❌ 다른 사람 풀네임·협찬 크레딧 테스트 실패');
process.exit(pass ? 0 : 1);
