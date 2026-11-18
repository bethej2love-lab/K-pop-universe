// 재생 화면 "이 영상에 나온 아티스트"의 멤버 해석(_resolveMem)을 app.js 실제 코드로 검증한다.
// 2026-11-19 사용자 제보: 태양·민니·형원·연준처럼 **밴드 소속인데 솔로 영상 group_ko가 본인 이름**인 경우,
// _ytGroupKoFor가 밴드명(빅뱅·아이들…)을 돌려줘 _inG(그룹 일치)가 전혀 안 맞아 artist가 null → 앵커·출연자 줄이
// 통째로 사라졌다. 수정: 그 경우 이름으로 풀어 준다(등록 그룹 맥락에선 기존대로 — 엉뚱한 동명이인 유입 방지).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const src = require('../tools/index_source.cjs').readIndexSource();
const artists = JSON.parse(fs.readFileSync(path.join(root, 'artists.json'), 'utf8'));
const groups = JSON.parse(fs.readFileSync(path.join(root, 'groups.json'), 'utf8'));

// shared.js의 진짜 _ytGroupKoFor 로드(ARTISTS/GROUPS 전역 참조)
const sctx = { GROUPS: groups, ARTISTS: artists };
vm.createContext(sctx);
vm.runInContext(fs.readFileSync(path.join(root, 'shared.js'), 'utf8') + ';this.y=_ytGroupKoFor;', sctx);
const _ytGroupKoFor = sctx.y;

// app.js에서 _inG + _resolveMem 블록을 그대로 꺼내 실행(되돌리면 이 테스트가 깨진다)
const a = src.indexOf('const _inG=a=>a.group.ko===groupKo');
const b = src.indexOf('return cs.find(x=>x.nameKeyOwner)||cs[0]||null;', a);
const e = src.indexOf('};', b) + 2;
assert(a >= 0 && b > a && e > b, '_inG/_resolveMem 경계 확인');
const block = src.slice(a, e);
const make = groupKo => new Function('ARTISTS', 'GROUPS', '_ytGroupKoFor', 'groupKo',
  block + '\nreturn _resolveMem;')(artists, groups, _ytGroupKoFor, groupKo);

let failed = 0;
const check = (label, fn) => { try { fn(); console.log('PASS ' + label); } catch (e) { failed++; console.error('FAIL ' + label + ': ' + e.message); } };

// ① 밴드 소속 멤버의 솔로 영상(group_ko=본인 이름) — 이름으로 풀려 artist가 잡혀야 한다(예전엔 null → 줄 사라짐)
for (const [nm, id] of [['태양', 'a0200'], ['민니', 'a0116'], ['형원', 'a0402'], ['연준', 'a0127']]) {
  check(`밴드 멤버 솔로 ${nm}(group_ko=${nm})가 해석된다`, () => {
    const a = artists.find(x => x.id === id);
    assert(a && a.name.ko === nm, `아티스트 데이터 존재: ${nm}/${id}`);
    assert(groups[nm] === undefined, `${nm}은 등록 그룹이 아니다(솔로 키 전제)`);
    const r = make(nm)(nm);
    assert(r && r.id === id, `해석 결과 ${id} (받음: ${r && r.id})`);
  });
}

// ② group.ko='솔로'라 _ytGroupKoFor가 이미 이름을 돌려주는 경우는 그대로(회귀 아님)
for (const [nm, id] of [['이영지', 'a1038'], ['청하', 'a0313']]) {
  check(`솔로키 아티스트 ${nm}도 계속 해석된다`, () => {
    const r = make(nm)(nm);
    assert(r && r.id === id, `해석 결과 ${id} (받음: ${r && r.id})`);
  });
}

// ③ 등록 그룹 맥락에서는 _inG로만 — 엉뚱한 그룹 이름으로 조회하면 null(동명이인·타 그룹 유입 방지)
check('등록 그룹 맥락에서 소속 아닌 멤버는 null', () => {
  assert.equal(make('방탄소년단')('민니'), null, '민니는 방탄 소속이 아니다');
});
check('등록 그룹 맥락에서 소속 멤버는 정상 해석', () => {
  const r = make('아이들')('민니');
  assert(r && r.id === 'a0116', '민니/아이들 정상');
});

console.log(failed ? `\n${failed} FAILED` : '\n✅ lb 출연자 해석: 밴드 멤버 솔로도 이름으로 풀리고, 등록 그룹 동명이인은 막힌다');
if (failed) process.exitCode = 1;
