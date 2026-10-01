// 크레딧 키(이름\0그룹[\0id]) — 수집기·빌더·앱이 같은 규칙인가 (2026-10-02 신설)
//
// 왜: 무소속 솔로엔 같은 이름이 실재한다(소희 3명·레나·현아·유주·가은·윤조·조아·키오 2명씩). 크레딧 키가
// "이름\0솔로"뿐이면 둘이 한 칸을 공유해 남의 작사·작곡이 섞인다. 그래서 (이름, 그룹)이 겹치면 id를 붙인다.
// 이 규칙은 세 군데에 있다 — tools/melon_credits.mjs(저장) · tools/build_written_songs.mjs(creditKey) · index.html(_creditKey).
// 하나만 어긋나도 증상은 에러가 아니라 **그 사람 곡이 조용히 비는 것**이다(디스코 파일키 동명이인 사고와 같은 꼴).
//
// 확인:
//  ① 앱의 _creditKey를 index.html에서 꺼내 실제로 실행 → 전 아티스트에 대해 이 테스트의 규칙과 같은 키
//  ② artist_credits.json · written_songs.json 의 모든 키가 **정확히 한 명**을 가리킨다(옛 평키로 저장된 동명이인 없음)
// 실행: node tests/credit-key-parity.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const ARTISTS = rd('artists.json');
let fail = 0;
const ok = m => console.log(`✅ ${m}`);
const bad = m => { fail++; console.log(`❌ ${m}`); };

// 기준 규칙
const cnt = {};
ARTISTS.forEach(a => { if (a.name && a.group) { const k = a.name.ko + '\u0000' + a.group.ko; cnt[k] = (cnt[k] || 0) + 1; } });
const ref = a => { const k = a.name.ko + '\u0000' + a.group.ko; return cnt[k] > 1 && a.id ? k + '\u0000' + a.id : k; };

// ① 앱 함수를 꺼내 실행
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/let _creditDup=null;\s*function _creditKey\(a\)\{[\s\S]*?\n\}/);
if (!m) bad('index.html에서 _creditKey를 못 찾음(이름이 바뀌었으면 이 테스트도 같이 고칠 것)');
else {
  const appKey = new Function('ARTISTS', m[0] + '\nreturn _creditKey;')(ARTISTS);
  const diff = ARTISTS.filter(a => a.name && a.group && appKey(a) !== ref(a));
  if (diff.length) bad(`앱 키가 기준과 다름 ${diff.length}명 — 예: ${diff.slice(0, 5).map(a => a.name.ko + '/' + a.group.ko).join(', ')}`);
  else ok(`앱 _creditKey = 기준 규칙 (${ARTISTS.length}명, 동명이인 키 ${Object.values(cnt).filter(n => n > 1).length}종)`);
}

// ② 파일의 키가 정확히 한 명을 가리킨다
const byKey = new Map();
ARTISTS.forEach(a => { if (a.name && a.group) { const k = ref(a); byKey.set(k, (byKey.get(k) || 0) + 1); } });
for (const f of ['artist_credits.json', 'written_songs.json']) {
  const keys = Object.keys(rd(f));
  const orphan = keys.filter(k => !byKey.has(k));
  const shared = keys.filter(k => byKey.get(k) > 1);
  // 동명이인인데 id 없는 평키로 저장된 것 — 둘 중 누구 건지 모른다
  const plainDup = keys.filter(k => cnt[k] > 1);
  if (shared.length || plainDup.length) bad(`${f}: 여러 명이 공유하는 키 ${shared.length + plainDup.length}개 — ${[...shared, ...plainDup].slice(0, 5).map(k => k.split('\u0000').join('/')).join(', ')}`);
  else ok(`${f}: 키 ${keys.length}개 모두 한 명만 가리킴`);
  // 로스터에서 사라진 사람(개명·삭제)의 키는 경고만 — 데이터 정리 대상이지 키 규칙 위반은 아니다
  if (orphan.length) console.log(`⚠️  ${f}: 로스터에 없는 키 ${orphan.length}개 (예: ${orphan.slice(0, 5).map(k => k.split('\u0000').join('/')).join(', ')})`);
}

console.log(fail ? `\n${fail}개 실패` : '\n✅ 크레딧 키 패리티 통과');
process.exit(fail ? 1 : 0);
