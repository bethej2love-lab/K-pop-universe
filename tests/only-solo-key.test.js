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
const src = require('../tools/index_source.cjs').readIndexSource();
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
// 2026-10-19: 규칙이 "이름이 유일한가(참/거짓)"에서 "카드 문맥(이름+그룹)으로 사람을 정해 그 사람의 이름 키(없으면 null)"로 바뀌었다.
//   동명이인이라도 이름 키의 주인(artists.json nameKeyOwner — tools/name_key_owner.mjs)이면 이름, 주인 아닌 솔로는 '이름#id', 나머지는 null.
//   shared.js(_ytGroupKoFor·_nameKeyOk·_artistGroups)를 같이 싣는다.
const vm = require('vm');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const ctx = { ARTISTS, GROUPS }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8'), ctx);
vm.runInContext(extractByBraces(/^function _soloNameKeyOf\(/m, '_soloNameKeyOf') + '\n' + extractByBraces(/^function _soloKeyUsable\(/m, '_soloKeyUsable') + '\nthis.f=_soloKeyUsable;', ctx);
const _soloKeyUsable = ctx.f;

let fail = 0;
const check = (label, got, want) => { if (got !== want) { fail++; console.log(`  ✗ ${label}: 기대 ${want} / 실제 ${got}`); } };

console.log('1) 이름이 유일하면 그 이름이 키 — 실제로 group_ko=본인이름 행이 있는 사람들');
['우즈', '청하', '마시로', '원호', '태연', '전소미', '승한', '아이유', '유진', '하늘']
  .forEach(n => check(`${n} 솔로 키`, _soloKeyUsable(n), n));

console.log('2) 동명이인인데 카드 문맥이 없으면 끌어오지 않는다');
['현진', '지수', '수빈', '마크', '재현', '리노']
  .forEach(n => check(`${n} 솔로 키 차단`, _soloKeyUsable(n), null));

console.log('3) 동명이인 — 이름 키 주인만 이름, 주인 아닌 솔로는 이름#id, 주인 아닌 그룹 멤버는 없음(2026-10-19)');
check('샤이니 태민(주인)', _soloKeyUsable('태민', '샤이니'), '태민');
check('하이파이유니콘 태민', _soloKeyUsable('태민', '하이파이유니콘'), null);
check('포미닛 현아(주인)', _soloKeyUsable('현아', '포미닛'), '현아');
check('나인뮤지스 현아', _soloKeyUsable('현아', '나인뮤지스'), '현아#a1401');
check('여자친구 유주(주인)', _soloKeyUsable('유주', '여자친구'), '유주');
check('체리블렛 유주', _soloKeyUsable('유주', '체리블렛'), '유주#a1475');

console.log('4) 빈 입력 방어');
check('null', _soloKeyUsable(null), null);
check('빈 문자열', _soloKeyUsable(''), null);
check('미등록 이름', _soloKeyUsable('존재하지않는이름'), null);

// 가드가 실제로 일하는지 — 등록 이름 중 중복이 충분히 있어야 이 테스트가 의미를 가진다.
const cnt = {};
ARTISTS.forEach(a => { const n = a && a.name && a.name.ko; if (n) cnt[n] = (cnt[n] || 0) + 1; });
const dup = Object.values(cnt).filter(n => n > 1).length;
console.log(`5) 가드가 실제로 일하는가 — 중복 이름 ${dup}개`);
if (dup < 10) { fail++; console.log('  ✗ 중복 이름이 너무 적어 이 가드가 무의미해 보임(데이터 확인 필요)'); }

console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
