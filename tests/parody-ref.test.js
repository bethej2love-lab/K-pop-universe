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

// ── 남이 따라 해 본 영상(자기 선언) → 보류(2026-11-19) ──
{
  const s2 = shared.indexOf('const _PARODY_SELF_RE'), e2 = shared.indexOf('function _parodySelfCueFor');
  const ctx2 = { GROUPS };
  vm.runInNewContext(shared.slice(s2, shared.indexOf('\n}', e2) + 2) + ';this.f=_parodySelfCueFor;', ctx2);
  const g = ctx2.f;
  [
    ['짭시리 쓰까르티스와 Cortis - RED RED MMA Ver. 패러디 해봤습니다 🔥', '코르티스'],
    ['아이브 안무 따라해봤습니다 (일반인 커버)', '아이브'],
    ['에스파 Whiplash 패러디를 해봤다', '에스파'],
    ['직장인이 블랙핑크 성대모사 해봄', '블랙핑크'],
    ['짭르세라핌 등장 ㅋㅋ #르세라핌', '르세라핌'],
    ['BTS 흉내 해보기 챌린지', '방탄소년단'],
  ].forEach(([t, k]) => need(!!g(t, k), `따라 해 본 영상 잡음: ${t.slice(0, 36)} → ${g(t, k)}`));
  [
    ['세븐틴이 직접 패러디 해봤습니다', '세븐틴'],            // 그룹이 주어 = 본인들
    ['SEVENTEEN이 패러디 해봤습니다', '세븐틴'],
    ['코르티스 REDRED 무대 직캠 #코르티스', '코르티스'],
    ['아이브 따라와 (Follow Me) 무대', '아이브'],              // '따라'만 있고 '해봤' 없음
    ['르세라핌 패러디 장인 등장｜SNL 코리아', '르세라핌'],     // 자기 선언 아님 — 기존 '출연 의심'(검수만) 몫
    ['짭짤한 간식 먹방 with 에스파', '에스파'],                // 짭짤 = 2글자 미만 뒤따름 규칙에 안 걸려야
    ['에스파 커버 해봤습니다', '에스파'],                      // 커버는 원곡 태깅 몫
  ].forEach(([t, k]) => need(!g(t, k), `안 잡음: ${t.slice(0, 36)}${g(t, k) ? ' → ' + g(t, k) : ''}`));
  need(/const parodySelf=!owner&&!members\.length&&tier!=='fans'&&tier!=='official'&&tier!=='grpsub'&&[^\n]*_parodySelfCueFor\(v\.title,match\.primaryGroup\)/.test(admin)
    && /\(held\|\|parodySelf\|\|mentionOnly\)\?_flagPatch\('보류','auto',\{needs_review:true\}\)/.test(admin), '외부 동기화: 따라 해 본 영상은 보류+검수(주인·팬채널·멤버 태깅 제외)');
}

// ── 그 그룹이 나오지 않고 얘기만 나오는 영상 → 보류(2026-11-21 사용자: A2O LITE 두 건을 손으로 무관 처리) ──
{
  const s3 = shared.indexOf('const _MENTION_AFTER'), e3 = shared.indexOf('\n// ── 음방 회차 묶기');
  const ctx3 = { GROUPS };
  vm.runInNewContext(shared.slice(s3, e3) + ';this.a=_mentionOnlyCueFor;this.b=_featJokeCueFor;', ctx3);
  const a = ctx3.a, b = ctx3.b;
  // ① 후기형 — 그룹이 목적어, 다른 사람이 주어
  [
    ['A2O LITE 만나고 현타 온 영미 DJ #MBCRADIO #Mhz #므흐즈 #두시의데이트 #안영미 #snl #분장', 'A2O LITE'],
    ['아이브 만나고 온 썰 푼다', '아이브'],
    ['에스파 만난 뒤 충격 받은 아저씨', '에스파'],
    ['ILLIT 만나고 성덕 된 조나단', '아일릿'],
    ['뉴진스 영접하고 기절한 팬', '뉴진스'],
  ].forEach(([t, k]) => need(!!a(t, k), `후기형 잡음: ${t.slice(0, 36)} → ${a(t, k)}`));
  [
    ['팬들 만나고 온 아이브 퇴근길', '아이브'],                // 그룹이 주어
    ['아이브 보고 싶다 #IVE', '아이브'],
    ['아이브를 만나고 싶어', '아이브'],
    ['코르티스 만나고 왔어요! 팬싸 후기', '코르티스'],           // '왔어요'는 뒤에 다른 사람이 안 붙는 꼴 — 넓히지 않는다
    ['코르티스 무대 직캠 #코르티스', '코르티스'],
  ].forEach(([t, k]) => need(!a(t, k), `후기형 안 잡음: ${t.slice(0, 36)}${a(t, k) ? ' → ' + a(t, k) : ''}`));
  // ② 농담 feat — 제목 전체가 "짧은 말 (feat. …)"이고 이름이 괄호 안에만
  [
    ['아저찡 (feat.A2O LITE 아이찡)', 'A2O LITE', ['아이찡']],
    ['밥 먹자 (feat. 르세라핌 카즈하) #shorts', '르세라핌', ['카즈하']],
  ].forEach(([t, k, m]) => need(!!b(t, k, m), `농담 feat 잡음: ${t.slice(0, 36)} → ${b(t, k, m)}`));
  [
    ['에스파 Supernova (feat. 카리나)', '에스파', ['카리나']],            // 괄호 앞에 그룹 표기 = 그 그룹의 곡
    ['[MPD직캠] 아이브 직캠 (feat. 장원영)', '아이브', ['장원영']],
    ['아이브 장원영이랑 밥 먹는 날 (feat. 수다) 풀버전 공개합니다 여러분', '아이브', ['장원영']],
    ['Whiplash 무대', '에스파', []],
  ].forEach(([t, k, m]) => need(!b(t, k, m), `농담 feat 안 잡음: ${t.slice(0, 36)}${b(t, k, m) ? ' → ' + b(t, k, m) : ''}`));
  // 연결: 농담 feat는 예능·출연·잡지 채널에서만(음악 채널의 "곡명 (feat. 가수)"는 진짜 참여), 주인·팬·공식 채널 제외
  need(/const _extNoSelf=!owner&&tier!=='fans'&&tier!=='official'&&tier!=='grpsub';/.test(admin)
    && /\(tier==='variety'\|\|tier==='appear'\|\|tier==='magazine'\)&&typeof _featJokeCueFor==='function'/.test(admin), '외부 동기화: 얘기만 나오는 영상은 보류+검수, 농담 feat는 예능 계열 채널만');
}

console.log(fail ? `\n❌ ${fail}개 실패` : '\n✅ 빗댐 제목 테스트 통과');
process.exit(fail ? 1 : 0);
