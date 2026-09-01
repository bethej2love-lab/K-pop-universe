// 관리자 홈 "매일 루틴 실행기" ↔ 설정 패널 버튼 대응 회귀 테스트 (2026-08-27)
//
// 왜 만들었나: 루틴의 1번 단계가 설정 패널의 "1. 전체 동기화 (공식 + 외부 채널)" 버튼과 **다른 일을**
// 하고 있었다. 버튼 핸들러는 _ytSyncAll → _ytSyncExtChannels → _ytRefreshViewCounts 셋을 순서대로
// 부르는데, 루틴은 _ytSyncAll 하나만 직접 불렀다. 그래서 루틴만 돌린 날은
//   ① 외부 채널(음방·예능·아이돌주도) 유입이 통째로 빠지고
//   ② 조회수 갱신(이번주 직캠 TOP10이 의존)이 안 돌았다.
// 화면엔 "1. 전체 동기화 ✅"라고 떠서 **다 된 것처럼 보이는** 게 특히 나쁘다.
//
// 이런 드리프트는 눈으로 안 보인다 — 루틴은 "원래 함수를 그대로 호출하니 동작이 갈릴 일 없다"는
// 전제로 짜여 있는데, 실제로는 버튼이 하는 일이 아니라 **안쪽 함수 하나**만 집어올 수 있기 때문이다.
// 그래서 소스에서 양쪽을 직접 뽑아 대조한다. 새 단계를 추가하거나 버튼 핸들러를 고치면 여기가 먼저 빨개진다.
//
// 실행: node tests/routine-parity.test.js

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = true;
const ok = m => console.log(`✅ ${m}`);
const bad = m => { pass = false; console.log(`❌ ${m}`); };
const need = (c, m) => c ? ok(m) : bad(m);

// 여는 중괄호부터 짝이 맞는 닫는 중괄호까지 잘라낸다.
function blockAt(from) {
  let i = src.indexOf('{', from), d = 0;
  if (i < 0) return '';
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); }
  }
  return '';
}

// ── 1) 설정 패널 "전체 동기화" 버튼이 실제로 부르는 함수들 ────────────────────────
// 2026-09-01: 실행 버튼은 전역 락 래퍼 _admExecBind(id, handler, label)로 등록(설정패널 개선 1).
const btnIdx = src.indexOf(`_admExecBind('sp-yt-sync',async()=>{`);
need(btnIdx > 0, "설정 패널 'sp-yt-sync' 핸들러를 찾음");
const btnBody = blockAt(btnIdx);
const btnCalls = [...btnBody.matchAll(/await\s+(_yt[A-Za-z0-9_]+)\s*\(/g)].map(m => m[1]);
need(btnCalls.length >= 3, `버튼이 부르는 동기화 함수 ${btnCalls.length}개: ${btnCalls.join(' → ')}`);

// ── 2) 루틴의 withSync 단계들 ────────────────────────────────────────────────────
const rIdx = src.indexOf('async function _admRunRoutine(');
need(rIdx > 0, '_admRunRoutine을 찾음');
const rBody = blockAt(rIdx);
const wsIdx = rBody.indexOf('if(withSync){');
need(wsIdx > 0, '루틴에 if(withSync){…} 블록이 있음(단계를 조건부로 묶어둠)');
let wsBlock = '';
{ // if(withSync){ … } 블록만 잘라내기
  let i = rBody.indexOf('{', wsIdx), d = 0;
  for (let j = i; j < rBody.length; j++) {
    if (rBody[j] === '{') d++;
    else if (rBody[j] === '}') { d--; if (!d) { wsBlock = rBody.slice(i, j + 1); break; } }
  }
}
const routineSyncFns = [...wsBlock.matchAll(/fn:\s*(_yt[A-Za-z0-9_]+)/g)].map(m => m[1]);

// ── 3) 핵심 계약: 순서까지 똑같아야 한다 ────────────────────────────────────────
need(JSON.stringify(routineSyncFns) === JSON.stringify(btnCalls),
  `루틴 1번 단계 == 버튼 핸들러 (순서 포함)\n     버튼: ${btnCalls.join(' → ')}\n     루틴: ${routineSyncFns.join(' → ')}`);

// 이번 사고에서 실제로 빠져 있던 둘은 이름을 박아 못을 더 확실히 친다
need(routineSyncFns.includes('_ytSyncExtChannels'), '루틴이 외부 채널 동기화를 포함(음방·예능·아이돌주도 유입)');
need(routineSyncFns.includes('_ytRefreshViewCounts'), '루틴이 조회수 갱신을 포함(이번주 직캠 TOP10이 의존)');

// ── 4) 2~4번 단계도 각 패널 버튼과 같은 함수인지 ────────────────────────────────
const routineAllFns = [...rBody.matchAll(/fn:\s*(_yt[A-Za-z0-9_]+)/g)].map(m => m[1]);
const PANEL = [
  ['sp-yt-autotag', '_ytAutoTagMembers', '2. 멤버+콜라보 자동 태깅'],
  ['sp-collabfix-btn', '_ytSweepAmbiguousCollabMistag', '3. 콜라보 오태깅 재검증'],
  ['sp-scan-namecollide-btn', '_ytScanAmbiguousNameGroupMisassignment', '4. 동명이인 그룹 오배정 스캔'],
];
for (const [id, fn, label] of PANEL) {
  const bound = new RegExp(`_admExecBind\\('${id}',\\s*${fn}\\b`).test(src);
  need(bound && routineAllFns.includes(fn), `${label} — 패널 버튼(#${id})과 루틴이 같은 함수(${fn})`);
}

// ── 5) 라벨이 실제 동작과 어긋나지 않는지(사람이 화면에서 읽는 것) ──────────────
// 2026-09-01: 설정패널 개선 5 — 매일 루틴은 홈 원클릭이 있으니 라벨의 "1." 번호는 뺐다(라벨 텍스트만).
need(/id="sp-yt-sync">전체 동기화 \(공식 \+ 외부 채널\)/.test(html),
  '패널 버튼 라벨이 여전히 "공식 + 외부 채널"이라고 약속함');
const stepNames = [...rBody.matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]);
need(stepNames.some(n => /외부 채널/.test(n)),
  `루틴 단계 라벨에도 외부 채널이 드러남 — ${JSON.stringify(stepNames)}`);
need(stepNames.some(n => /조회수/.test(n)), '루틴 단계 라벨에 조회수 갱신이 드러남');

console.log(pass ? '\n✅ 루틴 대응 테스트 통과' : '\n❌ 루틴 대응 테스트 실패');
process.exit(pass ? 0 : 1);
