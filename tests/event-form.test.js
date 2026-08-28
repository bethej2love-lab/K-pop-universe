// 공연 추가 폼 + 공연장 표준화 회귀 테스트 (2026-08-28 신설)
//
// 왜 만들었나:
// [1] type은 DB의 CHECK 제약이 걸린 컬럼이다. 예전에 수집 스크립트에서 없는 값('쇼케이스')을
//     지어냈다가 SQL이 통째로 튕겼다. 이제 입력 경로가 **둘**(수집 파이프라인 + 손입력 폼)이라
//     한쪽만 고치면 다른 쪽이 조용히 어긋난다. 두 목록이 같은지 여기서 못 박는다.
// [2] 공연장 이름은 한번 갈라지면 되돌리기가 비싸다. '올림픽공원' 153건이 실제로는 체조경기장/
//     올림픽홀/핸드볼경기장 셋이었고, 그대로 뒀으면 장소별 모아보기가 뭉개진 채로 굳었다.
//     정규화가 다시 뭉개지지 않는지(= 여러 홀을 가진 시설명이 홀 없이 남지 않는지) 확인한다.
// [3] 폼은 마크업(index.html)과 로직(admin.js)이 갈라져 있고 id 문자열로만 이어진다.
//     오타 하나면 조용히 죽으므로 양쪽 id 집합을 대조한다.
// [4] 어드민 마크업은 <template> 안에 있어야 한다 — 밖에 두면 읽기 모드/스크린리더에 샌다
//     (2026-08-28 실제 사고, PRINCIPLES.md 참고).
//
// 브라우저 없이 도는 정적 테스트다. 실행: node tests/event-form.test.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const sqlMjs = fs.readFileSync(path.join(ROOT, 'tools', 'kopis_sql.mjs'), 'utf8');

let pass = true;
const fail = m => { pass = false; console.log(`❌ ${m}`); };
const ok = m => console.log(`✅ ${m}`);

// ── 1. type 목록이 수집 파이프라인과 폼에서 같은가 ─────────────────────────────
{
  const fromSql = (sqlMjs.match(/ALLOWED_TYPES\s*=\s*new Set\(\[([^\]]*)\]/) || [, ''])[1]
    .split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const fromForm = (adminJs.match(/_EV_TYPES\s*=\s*\[([^\]]*)\]/) || [, ''])[1]
    .split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  if (!fromSql.length) fail('kopis_sql.mjs에서 ALLOWED_TYPES를 못 찾음');
  else if (!fromForm.length) fail('admin.js에서 _EV_TYPES를 못 찾음');
  else if (fromSql.join('|') !== fromForm.join('|'))
    fail(`type 목록 불일치 — 수집:[${fromSql}] 폼:[${fromForm}] · DB CHECK 제약이 있어서 어긋나면 저장이 튕긴다`);
  else ok(`type 목록 일치 (${fromForm.join(', ')})`);

  // 폼의 <select> 옵션도 같은 값이어야 한다 — 여긴 사람이 실제로 고르는 곳이다.
  const sec = (html.match(/<select id="ev-type"[\s\S]*?<\/select>/) || [''])[0];
  const opts = [...sec.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]).filter(Boolean);
  if (opts.join('|') !== fromForm.join('|'))
    fail(`ev-type <select> 옵션이 _EV_TYPES와 다름 — select:[${opts}] vs [${fromForm}]`);
  else ok('ev-type <select> 옵션도 같은 목록');
}

// ── 2. 공연장 정규화 ─────────────────────────────────────────────────────────
(async () => {
  const venue = await import('file://' + path.join(ROOT, 'tools', 'kopis_venue.mjs').replace(/\\/g, '/'));
  const { canonical } = venue;

  const cases = [
    // 목록 API가 뭉뚱그린 시설 → 상세 API의 홀까지 살려야 한다
    ['올림픽공원 (티켓링크 라이브 아레나 (핸드볼경기장))', '올림픽공원 핸드볼경기장'],
    ['올림픽공원 (체조경기장)', '올림픽공원 체조경기장'],
    ['잠실종합운동장 (실내체육관)', '잠실종합운동장 실내체육관'],
    // 괄호가 둘 연달아 나오는 형식 — 처음에 여기서 파서가 깨져 'KBS스포츠월드 아레나) (KBS아레나'가 나왔다
    ['KBS스포츠월드(아레나) (KBS아레나)', 'KBS스포츠월드 아레나'],
    ['벡스코 (BEXCO) (오디토리움)', '벡스코 오디토리움'],
    // 옛이름/로마자 별칭은 홀이 아니다
    ['예스24 라이브홀 (구. 악스코리아)', '예스24 라이브홀'],
    ['벡스코 (BEXCO)', '벡스코'],
    ['블루스퀘어 (마스터카드홀 (구. SOL트래블홀))', '블루스퀘어 마스터카드홀'],
    ['고척스카이돔', '고척스카이돔'],
  ];
  let bad = 0;
  for (const [inp, want] of cases) {
    const got = canonical(inp);
    if (got !== want) { bad++; fail(`정규화: "${inp}" → "${got}" (기대 "${want}")`); }
  }
  if (!bad) ok(`공연장 정규화 ${cases.length}건 통과`);

  // 사전이 실제로 홀 단위까지 쪼개졌는지 — 여러 홀을 가진 시설이 홀 없이 통째로 남으면 실패.
  const dictPath = path.join(ROOT, 'tools', 'venues.json');
  if (fs.existsSync(dictPath)) {
    const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
    const names = new Set(dict.map(v => v.name));
    const MULTI_HALL = ['올림픽공원', '잠실종합운동장', 'KBS스포츠월드'];
    const vague = MULTI_HALL.filter(f => names.has(f));
    if (vague.length) fail(`홀이 여럿인 시설이 통째로 남아있음: ${vague.join(', ')} — 장소별 모아보기가 뭉개진다`);
    else ok(`표준 공연장 사전 ${dict.length}곳 — 복합 시설이 홀 단위로 쪼개져 있음`);
    const dup = dict.map(v => v.name).filter((n, i, a) => a.indexOf(n) !== i);
    if (dup.length) fail(`사전에 중복 이름: ${dup.slice(0, 3).join(', ')}`);
  } else {
    console.log('⚠️  tools/venues.json 없음 — `node tools/kopis_venue.mjs dict` 먼저 (사전 검증 스킵)');
  }

  // ── 3. 마크업 id ↔ admin.js 참조 id 대조 ───────────────────────────────────
  const tplBlocks = [...html.matchAll(/<template class="adm-tpl"[\s\S]*?<\/template>/g)].map(m => m[0]);
  const evTpl = tplBlocks.find(b => b.includes('id="ev-overlay"'));
  if (!evTpl) {
    fail('#ev-overlay가 <template class="adm-tpl"> 안에 없음 — 읽기 모드/스크린리더에 어드민 텍스트가 샌다');
  } else {
    ok('#ev-overlay가 <template> 안에 있음 (읽기 모드 노출 차단)');
    const markupIds = new Set([...evTpl.matchAll(/\bid="(ev-[a-z0-9-]+)"/g)].map(m => m[1]));
    // admin.js가 _evEl('...')/getElementById('...')로 부르는 ev-* id 전부
    const usedIds = new Set([...adminJs.matchAll(/_evEl\('(ev-[a-z0-9-]+)'\)/g)].map(m => m[1]));
    const missing = [...usedIds].filter(id => !markupIds.has(id));
    if (missing.length) fail(`admin.js가 부르는데 마크업에 없는 id: ${missing.join(', ')} — 조용히 아무 동작도 안 한다`);
    else ok(`admin.js ↔ 마크업 id 대조 통과 (참조 ${usedIds.size}개 / 마크업 ${markupIds.size}개)`);
  }

  // 설정 패널의 여는 버튼도 <template> 안에 있어야 하고, 핸들러가 그 id를 봐야 한다.
  const hasBtn = tplBlocks.some(b => b.includes('id="sp-ev-btn"'));
  if (!hasBtn) fail('sp-ev-btn(공연 추가 버튼)이 어드민 <template> 밖에 있음');
  else if (!adminJs.includes("_evEl('sp-ev-btn')")) fail('admin.js에 sp-ev-btn 핸들러가 없음 — 버튼이 아무 반응도 안 한다');
  else ok('공연 추가 버튼 — <template> 안 + 핸들러 연결됨');

  // ── 4. 저장 경로가 tags_manual 같은 다른 테이블을 안 건드리는지(범위 확인) ──
  const evBlock = adminJs.slice(adminJs.indexOf('async function _evSave'));
  const tables = [...evBlock.slice(0, 3000).matchAll(/from\('([a-z_]+)'\)/g)].map(m => m[1]);
  const foreign = [...new Set(tables)].filter(t => t !== 'kpop_events');
  if (foreign.length) fail(`_evSave가 kpop_events 외 테이블을 건드림: ${foreign.join(', ')}`);
  else ok('_evSave는 kpop_events만 건드림');

  console.log(pass ? '\n🎉 공연 폼 테스트 전부 통과' : '\n💥 공연 폼 테스트 실패');
  process.exit(pass ? 0 : 1);
})();
