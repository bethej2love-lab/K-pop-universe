// 즐겨찾기 신작 선반의 비율별 최애 위계 (2026-09-21)
//
// 규칙(사용자 결정): 가로와 쇼츠의 기준이 **다르다**.
//   · 가로(16:9) → 최애와 관련된 **그룹**의 영상이면 전체폭. 최애가 멤버라도 그 소속 그룹 영상 전체가
//     대상이다(그룹 단위 콘텐츠엔 개별 멤버 태그가 잘 안 붙어서, 태깅된 것만 크게 하면 거의 안 걸린다).
//   · 쇼츠(9:16) → 그 **멤버가 직접 태깅**된 것만 전체폭. 쇼츠는 2열에서도 이미 커서 같은 기준을 쓰면
//     화면이 통째로 쇼츠 하나가 되는 일이 잦다.
// 두 기준이 한 글자 차이라 회귀하기 쉬워서 순수 함수로 고정한다.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => c ? ok(m) : bad(m);

const start = src.indexOf('function _feedBiasMatchers(');
need(start > 0, '_feedBiasMatchers 함수를 찾음');
const end = src.indexOf('\n}', start);
const body = src.slice(start, end + 2);

function load(bias) {
  return new Function('myProfile', `${body}; return _feedBiasMatchers();`)({ bias });
}
const vid = (groupKo, memberKos) => ({ groupKo, memberKos: memberKos || [] });

// ── 1) 최애가 멤버일 때 ─────────────────────────────────────────────────────
{
  const m = load([{ type: 'member', ko: '카리나', groupKo: '에스파' }]);
  need(!!m, '최애가 있으면 판정자를 돌려줌');
  need(m.wide(vid('에스파', [])) === true, '[가로] 최애 멤버의 소속 그룹 영상 → 전체폭 (멤버 태그가 없어도)');
  need(m.wide(vid('에스파', ['윈터'])) === true, '[가로] 같은 그룹이면 다른 멤버가 태깅돼 있어도 전체폭');
  need(m.wide(vid('뉴진스', [])) === false, '[가로] 무관한 그룹은 전체폭 아님');
  need(m.short(vid('에스파', [])) === false, '[쇼츠] 같은 그룹이어도 그 멤버 태깅이 없으면 2열');
  need(m.short(vid('에스파', ['윈터'])) === false, '[쇼츠] 다른 멤버만 태깅됐으면 2열');
  need(m.short(vid('에스파', ['카리나', '윈터'])) === true, '[쇼츠] 최애 멤버가 태깅됐으면 전체폭');
}

// ── 2) 최애가 그룹일 때 ─────────────────────────────────────────────────────
// 쇼츠는 "멤버 태깅"이 기준이므로, 그룹만 최애로 정하면 쇼츠는 커지지 않는다(의도된 절제).
{
  const m = load([{ type: 'group', ko: '에스파' }]);
  need(m.wide(vid('에스파', [])) === true, '[가로] 최애 그룹 영상 → 전체폭');
  need(m.short(vid('에스파', ['카리나'])) === false, '[쇼츠] 그룹만 최애면 쇼츠는 2열 유지');
}

// ── 3) 동명이인 ─────────────────────────────────────────────────────────────
// memberKos는 **이름만** 담긴다(하니·유나 등 동명이인이 실제로 있다). bias의 groupKo로 갈라야 한다.
{
  const m = load([{ type: 'member', ko: '하니', groupKo: '뉴진스' }]);
  need(m.short(vid('뉴진스', ['하니'])) === true, '[동명이인] 뉴진스 하니 영상은 전체폭');
  need(m.short(vid('EXID', ['하니'])) === false, '[동명이인] EXID 하니 영상은 전체폭 아님');
  need(m.wide(vid('EXID', [])) === false, '[동명이인] 다른 그룹은 가로도 전체폭 아님');
}

// ── 4) 최애 미지정 ──────────────────────────────────────────────────────────
// null을 줘야 호출부가 위계를 아예 안 걸고 기존 자연 배치(wideProb 0.22)로 돌아간다.
{
  need(load([]) === null, '최애가 없으면 null — 기존 자연 배치로 폴백');
  need(load([{ type: 'member' }]) === null, 'ko 없는 쓰레기 항목만 있으면 null');
}

// ── 5) 호출부 배선 ──────────────────────────────────────────────────────────
// 판정자를 비율로 갈라 _packRows의 isBig 하나로 넘기는 부분.
need(/_songIsShort\(song\)\?_bias\.short\(song\):_bias\.wide\(song\)/.test(src), '호출부가 비율로 갈라 판정자를 고른다');
need(/wideProb:_isBias\?0:0\.22/.test(src), '최애를 정했으면 일반 카드의 확률 전체폭은 끈다(위계 유지)');

console.log(pass ? '\n✅ 최애 위계 배치 테스트 통과' : '\n💥 최애 위계 배치 테스트 실패');
process.exit(pass ? 0 : 1);
