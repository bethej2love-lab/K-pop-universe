// 한국어 조사 자동 선택 회귀 테스트 (2026-09-15)
//
// 배경(사용자 제보): 공유 미리보기 설명이 `${ko}가`로 고정돼 있어서 "종현가 다른 케이팝
// 아이돌들…"처럼 받침 있는 이름에서 문장이 틀렸다. build_group_pages.js의 josa()가 이걸 고른다.
//
// 이 테스트가 지키는 것:
//  ① 한글 받침 판정  ② 숫자·알파벳으로 끝나는 이름(실측 46개)  ③ 와/과의 순서 함정
//  ④ 실제 템플릿이 josa()를 쓰고 있는지(하드코딩된 `}가`가 다시 들어오지 않게)
//
// 실행: node tests/josa.test.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'build_group_pages.js'), 'utf8');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => c ? ok(m) : bad(m);

// 소스에서 헬퍼를 그대로 떼어 와 실행한다(재구현하면 "테스트만 맞는" 상태가 된다)
const from = src.indexOf('const JOSA_READ_AS_WORD');
const to = src.indexOf('\n}', src.indexOf('function josa(')) + 2;
need(from > 0 && to > from, 'build_group_pages.js에서 josa 헬퍼를 찾음');
const { josa, hasFinalConsonant } = new Function(src.slice(from, to) + '; return { josa, hasFinalConsonant };')();

// ── ① 한글 ───────────────────────────────────────────────────────────────────
const hangul = [
  ['종현', '이'], ['태민', '이'], ['민호', '가'], ['아이유', '가'],
  ['샤이니', '가'], ['에스파', '가'], ['우주소녀', '가'], ['블랙핑크', '가'],
  ['세븐틴', '이'], ['펜타곤', '이'], ['있지', '가'], ['키스오브라이프', '가'],
];
let h = true;
for (const [n, want] of hangul) { const got = josa(n, '이/가'); if (got !== want) { h = false; bad(`${n} → "${n}${got}" (기대 "${n}${want}")`); } }
if (h) ok(`한글 받침 판정 ${hangul.length}건`);

// ── ② 숫자·알파벳으로 끝나는 이름 ───────────────────────────────────────────
// 실측(2026-09-15) 그룹·멤버 이름 중 46개가 한글 음절이 아닌 문자로 끝난다.
// 숫자: 0 영·1 일·3 삼·6 육·7 칠·8 팔 → 받침 / 알파벳: l 엘·m 엠·n 엔·r 알 → 받침
// ⚠️ f는 '에프'라 받침이 없다(흔한 착각). s도 '에스'라 없다.
const nonHangul = [
  ['엔시티 127', '이'],   // 칠
  ['2PM', '이'],          // 엠
  ['CL', '이'],           // 엘
  ['BM', '이'],           // 엠
  ['JR', '이'],           // 알
  ['NRG', '가'],          // 지
  ['B.I', '가'],          // 아이 — 끝의 마침표 없음
  ['H.O.T.', '가'],       // 끝 마침표를 떼고 T(티) 판정
  ['S.E.S.', '가'],       // 에스
  ['god', '이'],          // 글자로 안 읽고 "갓"으로 읽는 예외
];
let n2 = true;
for (const [n, want] of nonHangul) { const got = josa(n, '이/가'); if (got !== want) { n2 = false; bad(`${n} → "${n}${got}" (기대 "${n}${want}")`); } }
if (n2) ok(`숫자·알파벳 끝 이름 ${nonHangul.length}건`);

// ── ③ 와/과 순서 함정 ────────────────────────────────────────────────────────
// 이/가·은/는·을/를은 받침 있는 쪽이 앞이지만 **와/과는 반대**다(받침 있으면 '과').
// 인자를 앞/뒤로 해석하게 짰다가 "종현와"가 나왔던 자리다.
need(josa('종현', '와/과') === '과', `받침 있으면 "종현과" (받은 값: 종현${josa('종현', '와/과')})`);
need(josa('아이유', '와/과') === '와', `받침 없으면 "아이유와" (받은 값: 아이유${josa('아이유', '와/과')})`);
need(josa('종현', '과/와') === '과' && josa('아이유', '과/와') === '와', '표기 순서를 뒤집어 불러도 같은 결과');
need(josa('종현', '은/는') === '은' && josa('아이유', '은/는') === '는', '은/는');
need(josa('종현', '을/를') === '을' && josa('아이유', '을/를') === '를', '을/를');
let threw = false;
try { josa('종현', '이/를'); } catch (e) { threw = true; }
need(threw, '모르는 조사쌍은 조용히 넘기지 않고 예외를 던짐');

// ── ④ 템플릿이 실제로 쓰는지 ────────────────────────────────────────────────
// 헬퍼만 있고 템플릿이 예전처럼 `${ko}가`면 아무 의미가 없다.
const hard = src.match(/\}(은|는|이|가|을|를|와|과)[ .,]/g) || [];
need(hard.length === 0, hard.length ? `하드코딩된 조사가 남아 있음: ${hard.join(', ')}` : '템플릿에 하드코딩된 조사 없음');
// `이(가)` 같은 괄호 병기도 막는다 — 같은 문제의 다른 얼굴이다(커버 페이지가 실제로 그랬다:
// "2PM이(가) 커버한 곡 5개"). 읽기도 나쁘고, 이제 제대로 고를 수 있으니 쓸 이유가 없다.
const paren = src.match(/(이\(가\)|은\(는\)|을\(를\)|와\(과\)|가\(이\))/g) || [];
need(paren.length === 0, paren.length ? `괄호 병기 조사가 남아 있음: ${[...new Set(paren)].join(', ')}` : '괄호 병기 조사(이(가) 등) 없음');
need((src.match(/josa\(/g) || []).length >= 4, `josa() 호출 ${(src.match(/josa\(/g) || []).length}곳`);

console.log(pass ? '\n✅ 조사 테스트 통과' : '\n❌ 실패 항목 있음');
process.exit(pass ? 0 : 1);
