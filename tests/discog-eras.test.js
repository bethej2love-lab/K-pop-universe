// 디스코 활동기 묶음(_discogEras) 회귀 테스트 (2026-10-13 신설)
//
// 배경: 디스코를 정규/미니로 한 줄씩 늘어놓으니 `GREENGREEN_playextended`·`THIS IS FOR DELUXE` 같은 판을
// 억지로 분류해야 했다(사용자: "하나하나 나열하기 너무 애매함"). 그래서 한 활동기(앨범 + 그 판 + 선공개 싱글)를
// 커버가 겹친 한 장으로 접는다. 사용자 원칙: "수동 지정할 일이 거의 없게 자동을 잘 짜는 게 맞다" — 그래서
// 자동 규칙의 실측 사례를 여기 고정한다. 규칙을 바꿀 땐 이 목록이 다 초록인지 + 전수 차분을 같이 볼 것.
//
// 실행: node tests/discog-eras.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const src = require('../tools/index_source.cjs').readIndexSource();
const groups = require(path.join(ROOT, 'groups.json'));
const artists = require(path.join(ROOT, 'artists.json'));

function slice(name) {
  const i0 = src.indexOf('function ' + name + '(');
  if (i0 < 0) throw new Error('선언을 못 찾음: ' + name);
  let i = src.indexOf('{', i0), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(i0, i);
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(['_discogPhonKey', '_discogEditionKey', '_discogAlbumId', '_discogEras'].map(slice).join('\n') + '\nthis.E=_discogEras;this.ID=_discogAlbumId;', ctx);

let pass = 0, fail = 0;
const ok = m => { pass++; console.log(`✅ ${m}`); };
const bad = m => { fail++; console.log(`❌ ${m}`); };
// 화면 기본 목록과 같은 필터(OST·피처링·일본판·변형판 제외)
const visible = a => a.isMain && a.type !== 'OST' && !a.feat && a.region !== 'jp' && !a.variant;
const discOf = owner => {
  if (groups[owner]) return groups[owner].discography || [];
  const a = artists.find(x => `${x.name.ko}|${x.group && x.group.ko}` === owner);
  return (a && a.discography) || [];
};
function eraOf(owner, ov) {
  const list = discOf(owner).filter(visible);
  const r = ctx.E(list, ov);
  const find = t => list.find(a => a.title === t);
  return { list, r, find, same: (t1, t2) => { const a = find(t1), b = find(t2); return a && b && r.eraOf.get(a) === r.eraOf.get(b); } };
}
function together(owner, titles, why) {
  const e = eraOf(owner);
  const missing = titles.filter(t => !e.find(t));
  if (missing.length) { bad(`${owner}: 데이터에 없음 ${missing.join(', ')} (데이터가 바뀌었으면 사례를 갱신할 것)`); return; }
  titles.slice(1).every(t => e.same(titles[0], t)) ? ok(`${owner}: ${titles.join(' + ')} 한 활동기 — ${why}`) : bad(`${owner}: ${titles.join(' + ')}가 갈라짐 — ${why}`);
}
function apart(owner, t1, t2, why) {
  const e = eraOf(owner);
  if (!e.find(t1) || !e.find(t2)) { bad(`${owner}: 데이터에 없음 ${t1} / ${t2}`); return; }
  !e.same(t1, t2) ? ok(`${owner}: ${t1} ≠ ${t2} — ${why}`) : bad(`${owner}: ${t1}와 ${t2}가 묶임 — ${why}`);
}

// ── 선공개 싱글(싱글 곡이 120일 안 앨범 트랙에 있음) ──
together('코르티스', ['REDRED', 'GREENGREEN', 'GREENGREEN_playextended'], '이름이 다른 선공개 + 확장판(사용자 지적 사례)');
together('클로즈유어아이즈', ['Open Your Eyes', '256th Note'], '선공개 싱글');
together('아이브', ['CRUSH', 'ALIVE'], '선공개 싱글');
together('에스파', ['Supernova', 'Armageddon'], '선공개 싱글');
// 괄호 안 표기로 한/영이 갈린 트랙
together('원위', ['線 : The Wake', '面 : Unknown Atlas'], "싱글 'Neverland' ↔ 앨범 '우리들은 행방불명 (Neverland)'");
// 영문 싱글 ↔ 한글 음차 트랙(발음 뼈대) — 수동 지정 없이 자동으로 잡혀야 한다(사용자: "왜 수동 지정해야 해?")
together('이펙스', ['Picasso', 'EPEX 3rd Album 소화(韶華) 3장 : 낭만 청춘'], "싱글 'Picasso' ↔ 앨범 트랙 '피카소'");
together('보이넥스트도어', ['ddok ddok ddok', 'HOME'], "싱글 'ddok ddok ddok' ↔ 앨범 트랙 '똑똑똑'");
// ── 판 ──
together('트와이스', ['STRATEGY', 'Strategy 2.0'], "'2.0' 판");
together('제이홉|방탄소년단', ['Jack In The Box', 'Jack In The Box (HOPE Edition)'], '판 표시가 있으면 1년 뒤라도 같은 앨범');

// ── 묶으면 안 되는 것 ──
apart('투모로우바이투게더', '별의 장: TOGETHER', '별의 장: SANCTUARY', '콜론 시리즈는 앨범마다 활동기가 따로');
apart('엔하이픈', 'THE SIN : VANISH', 'THE SIN : BLISS', '콜론 시리즈는 묶지 않음');
{
  const e = eraOf('비원에이포');
  const hw = e.list.filter(a => a.title === 'HELLO! WM');
  hw.length === 2 && e.r.eraOf.get(hw[0]) !== e.r.eraOf.get(hw[1]) ? ok('비원에이포: HELLO! WM 2018 ≠ 2020 — 판 표시 없이 제목만 같은 반년 넘게 떨어진 발매는 별개') : bad('비원에이포: HELLO! WM 두 발매가 묶임(또는 데이터 변경)');
}
// ── 이름 ──
{
  const e = eraOf('트와이스');
  const a = e.find('With YOU-th');
  const era = a && e.r.eras.get(e.r.eraOf.get(a));
  era && era.label === 'With YOU-th' ? ok("트와이스: 'With YOU-th' 이름 유지 — 'with' 피처링 표기로 오인해 지우던 버그") : bad(`트와이스: With YOU-th 라벨이 '${era && era.label}'`);
}
{
  const e = eraOf('코르티스');
  const era = e.r.eras.get(e.r.eraOf.get(e.find('GREENGREEN')));
  era && era.lead.title === 'GREENGREEN' ? ok('코르티스: 대표는 원본 판 GREENGREEN(트랙 더 많은 _playextended가 아님)') : bad(`코르티스: 대표가 ${era && era.lead.title}`);
}
// ── 수동 지정(어드민) ──
{
  const base = eraOf('코르티스');
  const red = base.find('REDRED'), gg = base.find('GREENGREEN'), motion = base.find('MOTION (feat. Juicy J)');
  const ov1 = new Map([[ctx.ID(red), '']]);
  const e1 = eraOf('코르티스', ov1);
  e1.r.eraOf.get(e1.find('REDRED')) !== e1.r.eraOf.get(e1.find('GREENGREEN')) ? ok("수동 지정 '' → 강제 단독") : bad('수동 단독 지정이 안 먹음');
  const ov2 = new Map([[ctx.ID(motion), ctx.ID(gg)]]);
  const e2 = eraOf('코르티스', ov2);
  e2.same('MOTION (feat. Juicy J)', 'GREENGREEN') ? ok('수동 지정 → 다른 활동기에 붙이기') : bad('수동 붙이기가 안 먹음');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
