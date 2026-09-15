// Trend 최신 가중 순서(_recencyWeightedOrder) 단위 테스트 (2026-09-15)
//
// 배경: Trend 선반의 순서는 원래 완전 랜덤(_shuffle)이었다. "순위표처럼 보이지 않게"라는 의도적
// 결정(2026-08-25)이지만, 최신순 기울기가 0이라 방금 올라온 영상이 180번째에 박히는 일이 예사였다
// ("1시간마다 동기화라는데 왜 최신이 아니냐" 제보, 2026-09-15). 그래서 랜덤을 없애지 않고 최신 쪽에
// 무게만 주는 가중 무작위 순열로 바꿨다.
//
// 이 테스트가 지키는 것:
//  ① 순열이다 — 항목이 사라지거나 중복되지 않는다(랜덤 정렬 버그는 화면에선 절대 안 보인다)
//  ② 기울기가 있다 — 최신 코호트가 평균적으로 앞에 온다
//  ③ 그래도 랜덤이다 — 오래된 항목도 상위권에 섞여 나온다(순위표가 되면 설계 의도가 깨진다)
//  ④ 시각이 없는 항목도 버려지지 않는다(published_ts는 전체의 78%가 NULL이다)
//
// 실행: node tests/feed-recency-order.test.js

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => c ? ok(m) : bad(m);

const i = src.indexOf('function _recencyWeightedOrder(');
need(i > 0, '_recencyWeightedOrder를 찾음');
let body = '';
{
  let d = 0, s = src.indexOf('{', i);
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) { body = src.slice(i, j + 1); break; } }
  }
}
need(body.length > 0, '함수 파싱됨');
const order = new Function(`${body}; return _recencyWeightedOrder;`)();

const H = 3600000, now = Date.now();
const mk = (tag, ageH, n) => Array.from({ length: n }, (_, k) => ({ tag, id: `${tag}-${k}`, ts: new Date(now - ageH * H).toISOString() }));
const items = [...mk('fresh', 1, 100), ...mk('mid', 30, 100), ...mk('old', 100, 100)];
const tsOf = v => v.ts;

// ── ① 순열 보존 ──────────────────────────────────────────────────────────────
const once = order([...items], tsOf, 12);
need(once.length === items.length, `길이 보존 ${once.length}/${items.length}`);
need(new Set(once.map(v => v.id)).size === items.length, '중복·유실 없음');

// ── ②③ 200회 돌려 코호트별 평균 순위 ────────────────────────────────────────
const TRIALS = 200;
const sum = { fresh: 0, mid: 0, old: 0 }, cnt = { fresh: 0, mid: 0, old: 0 };
let oldInTop50 = 0;
const leaders = new Set(), top10seen = new Set();
for (let t = 0; t < TRIALS; t++) {
  const out = order([...items], tsOf, 12);
  out.forEach((v, idx) => { sum[v.tag] += idx; cnt[v.tag]++; });
  oldInTop50 += out.slice(0, 50).filter(v => v.tag === 'old').length;
  leaders.add(out[0].id);                          // 매번 누가 1등인가
  out.slice(0, 10).forEach(v => top10seen.add(v.id)); // 상위 10에 얼굴을 비춘 항목들
}
const mean = k => sum[k] / cnt[k];
console.log(`   평균 순위 — 1시간전 ${mean('fresh').toFixed(1)} · 30시간전 ${mean('mid').toFixed(1)} · 100시간전 ${mean('old').toFixed(1)} (0이 맨 앞)`);
need(mean('fresh') < mean('mid'), '최신(1h)이 중간(30h)보다 앞');
need(mean('mid') < mean('old'), '중간(30h)이 오래된 것(100h)보다 앞');
// 완전 랜덤이면 평균이 셋 다 149.5로 같다. 기울기가 실제로 생겼는지 최소폭으로 확인한다.
need(mean('old') - mean('fresh') > 40, `기울기 충분 (앞뒤 차이 ${(mean('old') - mean('fresh')).toFixed(1)}칸)`);

// ③ 순위표가 되면 안 된다. 기울기가 있다고 해서 **매번 같은 화면**이면 설계 의도(2026-08-25
//    "순위표처럼 보이지 않게")가 깨진다. 같은 코호트 안에서는 누가 앞설지가 매번 달라져야 한다.
//    ⚠️ "최신이 가끔 맨 뒤로 간다"로는 못 잰다 — 뒤에 더 오래된 항목이 200개나 있으면 당연히 안 간다.
//       그건 무작위성의 부재가 아니라 기울기의 존재다(처음에 이걸로 재려다 틀렸다).
const oldTopAvg = oldInTop50 / TRIALS;
need(oldTopAvg >= 1, `오래된 항목도 상위 50에 평균 ${oldTopAvg.toFixed(1)}개 — 기울기가 벽이 아님`);
need(leaders.size >= 20, `1등이 ${leaders.size}가지로 갈림 (고정 순위가 아님)`);
need(top10seen.size >= 50, `상위 10에 얼굴을 비춘 항목이 ${top10seen.size}가지 — 첫 화면이 매번 다름`);

// ── ④ 시각이 없는 항목 ───────────────────────────────────────────────────────
// published_ts는 전체 454,856행 중 355,239행(78%)이 NULL이다. 최근 7일분은 대부분 채워져 있지만,
// 창 안에 섞여 들어온 옛 행이 **조용히 사라지면** 선반 개수가 줄어든 채로 아무도 모른다.
const withNulls = [...mk('fresh', 1, 10), ...Array.from({ length: 10 }, (_, k) => ({ tag: 'nots', id: `n-${k}`, ts: null }))];
const outN = order([...withNulls], tsOf, 12);
need(outN.length === 20, `시각 없는 항목도 유실 없음 (${outN.length}/20)`);
need(outN.slice(0, 10).filter(v => v.tag === 'fresh').length >= 6, '시각 없는 항목은 대체로 뒤쪽(최소 가중치)');

// ── ⑤ 호출부가 실제로 이걸 쓰는지 ────────────────────────────────────────────
// 함수만 있고 _buildFeedTrend가 예전 _shuffle을 그대로 부르면 아무 의미가 없다.
const tIdx = src.indexOf('async function _buildFeedTrend(');
let tBody = '';
{
  let d = 0, s = src.indexOf('{', tIdx);
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) { tBody = src.slice(s, j + 1); break; } }
  }
}
need(/_recencyWeightedOrder\(/.test(tBody), 'Trend 선반이 최신 가중 순서를 사용');
need(!/_shuffle\(/.test(tBody), 'Trend 선반에 완전 셔플(_shuffle)이 남아 있지 않음');
// 정렬 키와 NULL 처리 — 둘 중 하나만 틀려도 "최신이 안 뜬다"가 그대로 재발한다.
need(/\.order\('published_ts',\{ascending:false,nullsFirst:false\}\)/.test(src),
  'Trend 쿼리가 published_ts 내림차순 + nullsFirst:false로 정렬');

console.log(pass ? '\n✅ 최신 가중 순서 테스트 통과' : '\n❌ 실패 항목 있음');
process.exit(pass ? 0 : 1);
