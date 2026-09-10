// 멤버 카드 "Only" 필터가 솔로 키(group_ko=본인 이름)를 함께 보는지 (2026-09-10 신설)
//
// 이 프로젝트는 그룹을 떠난 뒤/솔로 활동 영상을 group_ko=본인 이름으로 저장한다(우즈·청하·원호·마시로·
// 태연·전소미…). 일반 멤버 뷰는 그 절을 갖고 있었는데 **Only 분기에만 빠져 있어서**, Only를 누르면
// 솔로 영상이 통째로 사라졌다(사용자 제보). 실측: 우즈 0→48, 청하 0→320, 원호 10→108, 전소미 157→363.
//
// ⚠️ group_ko는 이름만 들고 있어 누구 것인지 구분이 안 된다. 그래서 **같은 이름이 둘 이상 등록돼 있으면
//    끌어오지 않는다**(_soloKeyUsable) — group_ko='현진'은 다른 현진의 솔로 싱글이고 '지수'·'수빈'도 같다.
//    반대로 '유진'(S.E.S.)·'하늘'(키스오브라이프)은 등록이 1명뿐이라 본인 것이 맞다.
//
// 실행: node tests/only-solo-key.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));

function extractByBraces(re, label) {
  const m = re.exec(src);
  if (!m) throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  let i = src.indexOf('{', m.index), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}
const _soloKeyUsable = new Function('ARTISTS',
  extractByBraces(/^function _soloKeyUsable\(/m, '_soloKeyUsable') + '\nreturn _soloKeyUsable;')(ARTISTS);

let fail = 0;
const check = (label, got, want) => { if (got !== want) { fail++; console.log(`  ✗ ${label}: 기대 ${want} / 실제 ${got}`); } };

console.log('1) 이름이 유일하면 솔로 키를 끌어온다 — 실제로 group_ko=본인이름 행이 있는 사람들');
['우즈', '청하', '마시로', '원호', '태연', '전소미', '승한', '아이유', '유진', '하늘']
  .forEach(n => check(`${n} 솔로 키 허용`, _soloKeyUsable(n), true));

console.log('2) 동명이인이면 끌어오지 않는다 — group_ko가 이름만 들고 있어 구분 불가');
['현진', '지수', '수빈', '마크', '재현', '리노']
  .forEach(n => check(`${n} 솔로 키 차단`, _soloKeyUsable(n), false));

console.log('3) 빈 입력 방어');
check('null', _soloKeyUsable(null), false);
check('빈 문자열', _soloKeyUsable(''), false);
check('미등록 이름', _soloKeyUsable('존재하지않는이름'), false);

// 가드가 실제로 일하는지 — 등록 이름 중 중복이 충분히 있어야 이 테스트가 의미를 가진다.
const cnt = {};
ARTISTS.forEach(a => { const n = a && a.name && a.name.ko; if (n) cnt[n] = (cnt[n] || 0) + 1; });
const dup = Object.values(cnt).filter(n => n > 1).length;
console.log(`4) 가드가 실제로 일하는가 — 중복 이름 ${dup}개`);
if (dup < 10) { fail++; console.log('  ✗ 중복 이름이 너무 적어 이 가드가 무의미해 보임(데이터 확인 필요)'); }

console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과 (20건)');
process.exit(fail ? 1 : 0);
