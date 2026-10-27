// 붙여 쓴 해시태그 게스트 + "곡 w/ #게스트" 쇼츠 챌린지 회귀 (2026-10-27)
//
// 사용자 제보: 크래비티 공식 쇼츠 "더 뜨겁게 Drive me louder w/ #LEECHAEYEON"에 이채연이 함께한 멤버로 안 붙고, 챌린지인데 '기타'로 저장됨.
// ① 매처가 해시태그 한 덩어리를 등록명과 대조하지 않았다 — "#LEECHAEYEON"(성+이름, 등록 영문은 'Chaeyeon')·"#JunHan"(등록명 'Jun Han').
//    _atmNormalizeRegisteredRomanNames가 그 등록명을 제목 끝에 덧붙인다. 그룹 해시태그는 일부러 안 푼다(이름만 쓴 게스트가 빠짐 — 함수 주석).
// ② _ytClassify 챌린지 판정이 '챌린지/CHALLENGE' 글자만 봤다 — 쇼츠 "곡 w/ #게스트"도 챌린지(표본 60/60).
//
// 실행: node tests/hashtag-compact-guest.test.js

const fs = require('fs'), path = require('path'), vm = require('vm');
const H = require('../tools/matcher_harness.cjs');

let pass = true;
const ck = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) pass = false; };
const has = (r, g, m) => !!r && (r.membersByGroup[g] || []).includes(m);

const T = 'Drive me louder w/ ';
ck(has(H._m2ParseTitle(T + '#LEECHAEYEON', '크래비티', false), '이채연', '이채연'), '#LEECHAEYEON → 이채연(성 로마자+등록 영문 Chaeyeon)');
ck(has(H._m2ParseTitle(T + '#XdinaryHeroes #JunHan', '크래비티', false), '엑스디너리 히어로즈', 'Jun Han'), "#JunHan → Jun Han(띄어 쓴 등록명)");
ck(has(H._m2ParseTitle(T + '#DAILYDIRECTION #LEEWONWOO', '크래비티', false), '데일리디렉션', '이원우'), '#LEEWONWOO → 데일리디렉션 이원우');
ck(has(H._m2ParseTitle(T + '#SUNGHANBIN', '크래비티', false), '제로베이스원', '성한빈'), '#SUNGHANBIN → 제로베이스원 성한빈');
// 한글(리노)을 덧붙이면 두 글자 이름이 모호해져 영문 풀네임으로 잡던 리노까지 빠졌다 — 영문 등록명 그대로 붙인다
ck(has(H._m2ParseTitle('What food did Lee Know have on the plane? #straykids #leeknow #dispatch', '스트레이키즈', false), '스트레이키즈', '리노'), '#leeknow 덧붙임이 기존 리노를 지우지 않음');
// 등록자와 안 맞는 붙여 쓴 로마자는 아무것도 안 붙인다
ck(!H._m2ParseTitle('Drive me louder w/ #LEEMOONSHINE', undefined, false), '등록 안 된 성+이름(#LEEMOONSHINE)은 매칭 없음');

const js = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const s = js.indexOf('const _YT_PRERECORDED_RE='), e = js.indexOf('// ── 세부 콘텐츠 포맷 태깅 (content_formats)');
const ctx = {}; vm.createContext(ctx); vm.runInContext(js.slice(s, e) + ';this._ytClassify=_ytClassify;', ctx);
ck(ctx._ytClassify('더 뜨겁게 Drive me louder w/ #LEECHAEYEON', { isShort: true }) === 'challenge', '쇼츠 "곡 w/ #게스트" → challenge');
ck(ctx._ytClassify('#HOTLINE ❤️‍🔥📞 w/ #MIU #ME_I @official_me_i_ #MASHIRO', { isShort: true }) === 'challenge', '쇼츠 "#곡 w/ #게스트 @계정" → challenge');
ck(ctx._ytClassify('Vlog w/ #LEECHAEYEON', { isShort: false }) === 'other', '가로 영상의 w/ #는 그대로 기타(쇼츠만)');
ck(ctx._ytClassify('NEW/ #shorts', { isShort: true }) !== 'challenge', '"NEW/ #"처럼 W로 끝나는 낱말은 챌린지 아님');

console.log(pass ? '\n✅ 붙여 쓴 해시태그 게스트·쇼츠 챌린지 테스트 통과' : '\n❌ 실패 있음');
process.exit(pass ? 0 : 1);
