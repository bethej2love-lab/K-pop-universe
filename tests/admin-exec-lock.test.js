// 설정 패널 실행 버튼 전역 락 회귀 테스트 (2026-09-01, 설정패널 개선 1·2·8)
//
// 배경(사용자 제보): 전체 동기화(수십 분) 도는 중에 재태깅·청소 버튼을 눌러 같은 행에 쓰기가
// 겹칠 수 있었다. 각 버튼이 자기 자신만 disabled 할 뿐 전역 락이 없었기 때문. 이제 실행 계열
// 버튼은 전부 _admExecBind 래퍼로 등록해 하나의 _admBusy 락을 공유하고, 끝나면 finally로 푼다.
//
// 이 테스트가 지키는 것: (1) 락 인프라가 존재하고 finally로 반드시 풀린다 (2) 실행 버튼이 raw
// addEventListener로 직접 등록돼 락을 우회하지 않는다 (3) 데일리 루틴도 락을 존중한다.
//
// 실행: node tests/admin-exec-lock.test.js

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
let pass = true;
const ok = m => console.log(`✅ ${m}`);
const bad = m => { pass = false; console.log(`❌ ${m}`); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── ① 락 인프라 ──────────────────────────────────────────────────────────────
need(/function _admExecBind\(id,handler,label,opts\)\{/.test(src), '_admExecBind 래퍼 정의됨');
need(/let _admBusy=null/.test(src), '_admBusy 락 상태 변수');
need(/function _admIsBusy\(\)\{return !!_admBusy\|\|_admRoutineRunning===true;\}/.test(src),
  '_admIsBusy가 실행 락 + 데일리 루틴 둘 다 확인');
const bindBody = (src.match(/function _admExecBind\(id,handler,label,opts\)\{[\s\S]*?\n\}/) || [''])[0];
need(/if\(_admIsBusy\(\)\)\{/.test(bindBody), '  · 실행 중이면 두 번째 작업 차단');
need(/finally\{_admExecLockOff\(id,ok\);\}/.test(bindBody), '  · finally로 락 반드시 해제(예외 나도)');
need(/opts\.selfRestop&&id===_admBusyId/.test(bindBody),
  '  · selfRestop 버튼(쇼츠 승격)은 실행 중 재클릭=중단 통과');

// ── ② 실행 버튼이 전부 래퍼로 등록됐는가(raw addEventListener로 락 우회 금지) ──────────
const EXEC_IDS = ['sp-yt-sync','sp-yt-viewcount-btn','sp-yt-allviewcount-btn','sp-yt-rotateviewcount-btn',
  'sp-yt-backfill-btn','sp-yt-backfill-priority-btn','sp-yt-manual-add-btn','sp-yt-manual-batch-add-btn',
  'sp-yt-autotag','sp-detect-btn','sp-collabfix-btn','sp-scan-namecollide-btn','sp-yt-retag-all',
  'sp-mistagfix-btn','sp-fancamfix-btn','sp-membersfix-btn','sp-catfix-btn','sp-shortspromote-btn',
  'sp-cover-v2-btn','sp-debutgate-btn','sp-dualtag-btn','sp-cover-clean-btn','sp-yt-sweep-banned',
  'sp-yt-sweep-junk','sp-hidden-rejudge-btn','sp-canon-btn','sp-lockfill-btn','sp-yt-undo-bulk-btn'];
const boundVia = EXEC_IDS.filter(id => src.includes(`_admExecBind('${id}'`));
need(boundVia.length === EXEC_IDS.length,
  `실행 버튼 ${EXEC_IDS.length}개 전부 _admExecBind로 등록 — 누락 ${EXEC_IDS.length - boundVia.length}건${boundVia.length<EXEC_IDS.length?': '+EXEC_IDS.filter(id=>!boundVia.includes(id)).join(','):''}`);
const rawExec = EXEC_IDS.filter(id => src.includes(`getElementById('${id}')?.addEventListener('click'`));
need(rawExec.length === 0,
  `실행 버튼이 raw addEventListener로 락을 우회하지 않음 — 발견 ${rawExec.length}건${rawExec.length?': '+rawExec.join(','):''}`);

// ── ③ 데일리 루틴도 실행 락을 존중 ────────────────────────────────────────────
need(/if\(_admRoutineRunning\)return;\s*\n\s*if\(_admBusy\)\{alert/.test(src),
  '데일리 루틴 시작 시 실행 버튼이 도는 중이면 막음');

// ── ④ 중단(설정패널 개선 3): _admAbort 플래그 + 진행바 중단 버튼 + retag-all 루프가 확인 ────
need(/,_admAbort=false;/.test(src), '_admAbort 중단 플래그 선언');
need(/_admAbort=false;/.test(bindBody) || /_admBusyLabel=label;_admAbort=false;/.test(src),
  '실행 시작 시 _admAbort 리셋');
need(/aeb-stop/.test(src), '중단 가능 작업엔 진행바에 "✕ 중단" 버튼');
need(/_admExecBind\('sp-yt-retag-all',_ytRetagAllIncludingTagged,'멤버\+콜라보 재태깅',\{abortable:true\}\)/.test(src),
  '재태깅 전체는 abortable로 등록');
const retag = (src.match(/async function _ytRetagAllIncludingTagged\(\)\{[\s\S]*?\n\}/) || [''])[0];
need(/if\(_admAbort\)\{/.test(retag), '재태깅 전체 그룹 루프가 _admAbort 확인해 중단');

// ── ⑤ (전체) 버튼 규칙(설정패널 개선 4): 확인 + 스냅샷 되돌리기 ───────────────────────
// 재태깅 전체가 유일하게 확인창·스냅샷 둘 다 없던 이상치였다 → 둘 다 붙인다.
need(/멤버\+콜라보 재태깅 \(전체\)/.test(retag) && /_confirmDialog\(/.test(retag),
  '재태깅 전체에 확인창 추가');
need(/_snapshotBeforeBulk\('멤버\+콜라보 재태깅\(전체\)'/.test(retag),
  '재태깅 전체에 스냅샷 되돌리기 추가');
// 나머지 (전체) 3개는 확인창을 추가하되, 데일리 루틴이 부를 땐 skip해야 루틴이 안 멈춘다.
for (const [fn, tag] of [['_ytSweepAmbiguousCollabMistag','콜라보'],['_ytSweepMembersMistag','자체 멤버'],['_ytSweepCategoryMistag','카테고리']]) {
  const body = (src.match(new RegExp(`async function ${fn}\\([\\s\\S]*?\\n\\}\\n`)) || [''])[0];
  need(/!_admRoutineRunning&&typeof _confirmDialog==='function'/.test(body),
    `${tag} 재검증(전체)에 확인창 + 루틴 중 skip 가드`);
}

// ── ⑥ 죽은 코드 제거 ──────────────────────────────────────────────────────────
need(!/sp-wonkok-btn/.test(src), '죽은 sp-wonkok-btn 핸들러 제거됨');

console.log(pass ? '\n✅ 실행 버튼 전역 락 테스트 통과' : '\n❌ 실행 버튼 전역 락 테스트 실패');
process.exit(pass ? 0 : 1);
