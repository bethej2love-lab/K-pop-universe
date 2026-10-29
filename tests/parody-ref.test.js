// 그룹명 빗댐 제목 → 검수 큐 '출연 의심' (2026-10-30 사용자 "50대 코르티스룩 #할명수 #코르티스 — 코르티스는 안 나온다", "개그계 리센느")
// shared.js _parodyRefCue가 실제 DB 제목에서 빗댐만 잡고, 그룹명이 곡명·단어 일부인 경우는 안 잡는지 + 동기화·검수 탭 연결 확인.
// 자동 숨김이 아니라 needs_review만 켠다 — 진짜 출연에도 "○○ 스타일"을 쓰는 일이 있어서.
// 실행: node tests/parody-ref.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const shared = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
const admin = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
let fail = 0;
const need = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail++; };

const s = shared.indexOf('const _PARODY_AFTER');
const e = shared.indexOf('function _parodyRefCueFor');
const body = shared.slice(s, shared.indexOf('\n}', e) + 2);
const ctx = { GROUPS };
vm.runInNewContext(body + ';this.f=_parodyRefCueFor;', ctx);
const f = ctx.f;

// 잡아야 하는 것(실제 DB 제목)
[
  ['50대 코르티스룩 #할명수 #박명수 #코르티스 #코스트코', '코르티스'],
  ['트로트계 리센느 요즘 대세 김용빈 [사장님 귀는 당나귀 귀/Boss in the Mirror] | KBS 방송', '리센느'],
  ['개그계 리센느 등장', '리센느'],
  ['[#일타강사] 수포자여 찐일타강사에게 오라! 수학계 BTS 정승제 #엠뚜루마뚜루', '방탄소년단'],
  ['[FULL] 트롯계 블랙핑크🖤🩷 오유진 | 두시탈출 컬투쇼', '블랙핑크'],
  ['‘강연계의 BTS’ 김창옥, 돌싱포맨 멤버들의 궁금증 해결하러 등장★', '방탄소년단'],
  ['제2의 엔하이픈 될래요 #ILAND2 #아이랜드2', '엔하이픈'],
  ['강호동이 엑소 메이크업 받으면 생기는 일｜아는 형님', '엑소'],
].forEach(([t, g]) => need(!!f(t, g), `잡음: ${t.slice(0, 40)} → ${f(t, g)}`));

// 잡으면 안 되는 것 — 그룹명이 단어의 일부이거나 진짜 그 그룹을 가리키는 말
[
  ['아이브 룩스 캔 킬 무대 최초공개', '아이브'],
  ['NCT DREAM 스타일리스트가 알려주는 아웃도어 코디법', 'NCT DREAM'],
  ['LE SSERAFIM Stage Compilation', '르세라핌'],
  ['[교차편집] 프로미스나인 - Feel Good(SECRET CODE) (fromis_9 StageMix)', '프로미스나인'],
  ['[MPD직캠] 브라운아이드걸스 직캠 신세계 Brown Eyed Girls Fancam', '브라운아이드걸스'],
  ['전세계 BTS 팬들이 열광한 무대', '방탄소년단'],
  ['가요계 블랙핑크 컴백', '블랙핑크'],
  ['코르티스 무대 직캠 #코르티스', '코르티스'],
].forEach(([t, g]) => need(!f(t, g), `안 잡음: ${t.slice(0, 40)}${f(t, g) ? ' → ' + f(t, g) : ''}`));

// 연결: 외부 동기화는 주인 채널·멤버가 잡힌 영상 제외하고 needs_review만, 검수 탭은 배지
need(/const parodyCue=!owner&&!members\.length&&[^\n]*_parodyRefCueFor\(v\.title,match\.primaryGroup\)/.test(admin)
  && /const needsReview=!owner&&\(match\.confidence==='weak'\|\|ambiguous\|\|parodyCue\)/.test(admin), '외부 동기화: 빗댐이면 needs_review(주인 채널·멤버 태깅 제외)');
need(/tab==='review'&&typeof _parodyRefCueFor==='function'/.test(admin), '검수 탭: 출연 의심 배지');

console.log(fail ? `\n❌ ${fail}개 실패` : '\n✅ 빗댐 제목 테스트 통과');
process.exit(fail ? 1 : 0);
