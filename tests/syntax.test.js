// 부팅 차단 문법오류 가드 — 브라우저 없이 도는 최후방어선 (2026-09-14)
//
// 왜 생겼나: 2026-09-14에 index.html의 인라인 스크립트에 `const _LIVE_EXCLUDE`를 **중복 선언**하는
// 편집이 들어갔다. const 재선언은 SyntaxError고, 앱 부팅 코드가 전부 그 <script> 블록 안에 있어서
// 블록이 통째로 죽었다 → **사이트가 로딩 화면에서 안 넘어감**(사용자 제보: "here is our kpop universe
// 텍스트만 보이고 넘어가질 않음"). 배포된 채로 발견됐다.
//
// ⚠️ 문제는 "실수를 했다"가 아니라 **아무도 안 보고 있었다**는 것이다. 그때 상황:
//   · admin.js는 `node --check`로 검사했지만 **index.html의 인라인 JS는 검사 대상이 아니었다.**
//   · CI(data-and-tests.yml)는 tests/*.test.js를 다 돌렸고 전부 초록이었다 — 인라인 JS 문법을
//     보는 테스트가 **하나도 없었기 때문**이다.
//   · 유일하게 잡을 수 있는 tests/smoke.test.js는 헤드리스 크롬이 필요해 **CI에서 skip**된다.
//   → 즉 "사이트가 아예 안 뜨는" 등급의 오류가 CI를 그냥 통과하는 구조였다. 이 테스트가 그 구멍이다.
//
// 이 테스트는 브라우저도 네트워크도 안 쓴다(파싱만) → CI skip 목록에 **절대 넣지 말 것**.
// 실제 렌더링·런타임 오류는 여전히 smoke.test.js 몫이다. 여기선 "파싱조차 안 되는" 것만 막는다.
//
// 실행: node tests/syntax.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };

// ── 1. HTML 파일들의 인라인 <script> ────────────────────────────────────────
// src= 가 있는 건 외부 파일이라 내용이 없다(아래 2번에서 파일 자체를 검사).
// type이 있으면 application/json·text/template 같은 비-JS 블록일 수 있어 module/javascript만 본다.
const HTML_FILES = ['index.html', 'kpop_universe.html', 'privacy.html', 'terms.html'];
const INLINE_RE = /<script([^>]*)>([\s\S]*?)<\/script>/g;

for (const rel of HTML_FILES) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue; // 선택적 파일(kpop_universe.html 등)은 없으면 건너뜀
  const html = fs.readFileSync(file, 'utf8');
  let m, count = 0, failed = 0;
  while ((m = INLINE_RE.exec(html))) {
    const attrs = m[1], code = m[2];
    if (/\bsrc=/.test(attrs)) continue;
    const type = (attrs.match(/\btype\s*=\s*["']([^"']+)["']/) || [, ''])[1].toLowerCase();
    if (type && !/^(module|text\/javascript|application\/javascript)$/.test(type)) continue;
    count++;
    // 스크립트 시작 줄 — 실패했을 때 어디를 볼지 바로 알려준다
    const line = html.slice(0, m.index).split('\n').length;
    try {
      // module은 최상위 import/export가 있을 수 있어 파서 모드를 맞춰준다
      new vm.Script(code, { filename: `${rel}:${line}`, ...(type === 'module' ? { importModuleDynamically: () => {} } : {}) });
    } catch (e) {
      failed++;
      bad(`${rel} 인라인 script (${rel}:${line} 부터) 문법오류 — ${e.message}`);
    }
  }
  if (!failed) ok(`${rel} — 인라인 script ${count}개 전부 파싱 성공`);
}

// ── 2. 외부 JS 파일 ─────────────────────────────────────────────────────────
// admin.js는 클래식 스크립트(모듈 아님)라 그대로 파싱된다. sw.js도 부팅에 영향을 주므로 같이 본다.
for (const rel of ['admin.js', 'shared.js', 'sw.js']) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  try {
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: rel });
    ok(`${rel} — 파싱 성공`);
  } catch (e) {
    bad(`${rel} 문법오류 — ${e.message}`);
  }
}

// ── 3. 같은 스코프 안 중복 선언(이번 사고의 정확한 모양) ────────────────────
// 위 1번이 이미 잡지만, 잡혔을 때 **무엇이 중복인지**를 바로 말해주려고 따로 센다.
// index.html의 큰 인라인 블록은 전역 스코프라, 최상위 `const _X=` / `let _X=`가 두 번 나오면 곧 죽음이다.
// ⚠️ 들여쓰기 없는(= 최상위) 선언만 본다. 함수 안의 같은 이름은 정상이다.
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const seen = new Map();
  const dups = [];
  html.split('\n').forEach((l, i) => {
    const m = l.match(/^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/); // 줄 맨 앞 = 최상위
    if (!m) return;
    const name = m[1];
    if (seen.has(name)) dups.push(`${name} (index.html:${seen.get(name)} 와 :${i + 1})`);
    else seen.set(name, i + 1);
  });
  if (dups.length) bad(`index.html 최상위 const/let 중복 선언 ${dups.length}건 — ${dups.join(' · ')}`);
  else ok(`index.html 최상위 const/let 중복 선언 없음 (${seen.size}개 확인)`);
}

console.log(pass ? '\n✅ 문법 가드 통과' : '\n❌ 문법 가드 실패 — 이대로 배포하면 사이트가 안 뜹니다');
process.exit(pass ? 0 : 1);
