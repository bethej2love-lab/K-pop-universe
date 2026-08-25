// 정적 자산 캐시버스터 자동 갱신 (2026-08-25 신설)
//
// 왜 만들었나: `index.html`의 `kpop_universe.css?v=`·`shared.js?v=`·`_ADMIN_JS_VER`와 `sw.js`의
// `CACHE_VERSION`을 전부 손으로 올리고 있었는데, 2026-08-24에 실제로 빠뜨려서 폰이 "새 마크업 + 옛
// CSS"를 그려 화면이 통째로 깨졌다. 그 뒤 하루 작업하는 동안만 이 값들을 12번 손으로 올렸다 —
// 사람 규율로는 반드시 또 빠진다는 게 확인돼서 파일 내용 해시로 자동화한다.
//
// 규칙: 버전 문자열 = `<YYYYMMDD>-<내용해시8>`. 날짜는 사람이 읽기 위한 것이고 실제 무효화는 해시가
// 한다(같은 날 여러 번 배포해도 내용이 바뀌면 값이 바뀜, 내용이 같으면 그대로라 불필요한 재다운로드
// 없음). `CACHE_VERSION`은 세 파일 전부를 합쳐 해시한다 — 서비스워커 캐시는 앱 셸 전체가 대상이므로.
//
// ⚠️ 패턴을 하나라도 못 찾으면 **조용히 넘어가지 않고 실패**한다. 조용히 실패하면 자동화가 있는 줄
//    알고 방심하다가 원래 사고를 그대로 다시 겪게 되므로, 여기서만큼은 시끄럽게 죽는 게 맞다.
//
// 실행: node tools/bump_cache_version.mjs [--check]
//   --check: 파일을 고치지 않고 갱신이 필요한지만 보고(종료코드 1 = 갱신 필요). 로컬에서 확인용.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const hash8 = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
// 날짜는 UTC 기준 — Action이 UTC로 돌고, 로컬에서 돌렸을 때와 값이 갈리면 무의미한 diff가 생긴다.
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const cssSrc = read('kpop_universe.css');
const sharedSrc = read('shared.js');
const adminSrc = read('admin.js');
let indexSrc = read('index.html');
let swSrc = read('sw.js');

const ver = s => `${today}-${hash8(s)}`;
// 해시 입력에서 "버전 문자열 자리"만 지운다(값이 아니라 자리를 지우는 것 — 위 CACHE_VERSION 주석 참고)
const stripVersions = s => s
  .replace(/(kpop_universe\.css\?v=)[^"]*/g, '$1@')
  .replace(/(shared\.js\?v=)[^"]*/g, '$1@')
  .replace(/(const _ADMIN_JS_VER=')[^']*/g, '$1@');
const targets = [
  // [파일, 찾을 정규식, 새 값 만들기, 설명]
  ['index.html', /(<link rel="stylesheet" href="kpop_universe\.css\?v=)([^"]*)(">)/,
    ver(cssSrc), 'kpop_universe.css?v='],
  ['index.html', /(<script src="shared\.js\?v=)([^"]*)(">)/,
    ver(sharedSrc), 'shared.js?v='],
  ['index.html', /(const _ADMIN_JS_VER=')([^']*)(';)/,
    ver(adminSrc), '_ADMIN_JS_VER'],
  // ⚠️ CACHE_VERSION은 index.html까지 해시에 넣는데(서비스워커 캐시 대상은 앱 셸 전체),
  // index.html 안에는 방금 우리가 바꾼 `?v=`/_ADMIN_JS_VER 값이 들어있다. 그대로 해시하면
  // "값을 바꿈 → 해시가 바뀜 → 다음 실행에서 또 바뀜"으로 **멱등이 깨져** Action이 매번 새 커밋을
  // 만든다(실제로 처음 짰을 때 그렇게 됐음). 버전 문자열 자리를 고정 placeholder로 지운 뒤 해시한다.
  ['sw.js', /(const CACHE_VERSION=')([^']*)(';)/,
    'kpu-' + ver(cssSrc + sharedSrc + adminSrc + stripVersions(indexSrc)), 'CACHE_VERSION'],
];

const changes = [];
for (const [file, re, next, label] of targets) {
  const src = file === 'sw.js' ? swSrc : indexSrc;
  const m = src.match(re);
  if (!m) {
    console.error(`❌ 패턴을 못 찾음: ${label} (${file})`);
    console.error('   index.html/sw.js가 리팩터링됐을 수 있음 — tools/bump_cache_version.mjs의 정규식을 갱신할 것.');
    process.exit(2);
  }
  if (m[2] === next) continue;
  changes.push({ file, label, from: m[2], to: next });
  const replaced = src.replace(re, `$1${next}$3`);
  if (file === 'sw.js') swSrc = replaced; else indexSrc = replaced;
}

if (!changes.length) {
  console.log('✅ 캐시버스터 최신 — 갱신 불필요');
  process.exit(0);
}
changes.forEach(c => console.log(`  ${c.label}: ${c.from} → ${c.to}`));
if (CHECK_ONLY) {
  console.log(`\n⚠️ 갱신 필요 ${changes.length}건 (--check 모드라 파일은 안 고침)`);
  process.exit(1);
}
fs.writeFileSync(path.join(ROOT, 'index.html'), indexSrc);
fs.writeFileSync(path.join(ROOT, 'sw.js'), swSrc);
console.log(`\n✅ ${changes.length}건 갱신 완료`);
