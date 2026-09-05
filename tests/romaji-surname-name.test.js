// 붙여쓴 "성(로마자)+이름" 영문 토큰 매칭 회귀 (2026-09-05 신설)
//
// 아이브 공식채널 제목 "jangwonyoung anyujin"처럼 성+이름을 붙여 쓴 로마자 토큰이 멤버로 안 잡히던
// 버그(사용자 제보). name.en이 given-only(Yujin/Wonyoung)라, 앞에 성(an/jang)이 붙으면 경계가 깨져
// tokens.includes(given)가 실패했다. m.ko 첫 글자(성)의 로마자 변형으로 "성+이름"을 정확 일치 검사해 보강.
//
// 실행: node tests/romaji-surname-name.test.js

const path = require('path');
const { load } = require(path.join(__dirname, '..', 'tools', 'm2_harness.js'));
const M = load();
const { _atmMatchesMember, _atmTokenize, ARTISTS } = M;

let fail = 0;
const ck = (c, m) => { console.log((c ? '✓ ' : '✗ 실패: ') + m); if (!c) fail++; };
const find = ko => ARTISTS.find(a => a.group && a.group.ko === '아이브' && a.name.ko === ko);
const mk = a => ({ ko: a.name.ko, en: a.name.en, aliases: a.matchAliases });
const wy = mk(find('장원영')), yj = mk(find('안유진')), ga = mk(find('가을'));
const hit = (m, title) => _atmMatchesMember(m, title, _atmTokenize(title), '아이브');

console.log('\n── 붙여쓴 성+이름 로마자 매칭 ──');
// 핵심: 붙여쓴 형태(예전엔 실패)
ck(hit(wy, 'IVE ON jangwonyoung dance practice'), 'jangwonyoung → 장원영');
ck(hit(yj, 'IVE anyujin behind cut'), 'anyujin → 안유진');
// 기존에 되던 것도 여전히(회귀 방지)
ck(hit(wy, 'jang wonyoung solo stage'), '공백형 "jang wonyoung" → 장원영(기존 유지)');
ck(hit(wy, 'wonyoung fancam'), '이름만 "wonyoung" → 장원영(기존 유지)');
// 오탐 방지
ck(!hit(ga, 'jangwonyoung anyujin only'), '가을은 안 걸림(오탐 없음)');
ck(!hit(yj, 'some random unrelated english title'), '무관 제목엔 안유진 안 걸림');

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 붙여쓴 성+이름 매칭 하네스 통과');
process.exit(fail ? 1 : 0);
