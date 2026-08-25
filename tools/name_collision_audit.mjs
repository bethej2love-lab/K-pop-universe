// 동명이인·흔한단어 오태깅 위험 전수 감사 (2026-08-25 신설)
//
// 왜 만들었나: 이 프로젝트에서 반복적으로 터진 오태깅 사고는 거의 전부 "이름이 겹친다"는 한 가지
// 원인에서 나왔는데(동명이인, 흔한 단어, 그룹명==멤버명, 유닛명 충돌), 매번 사용자 제보를 받고 나서야
// 개별 대응해왔음. 새 그룹이 추가될 때마다 위험을 미리 잡아내려고 만든 스캐너.
//
// 원칙: admin.js의 실제 게이트 조건을 그대로 재현해서 "이미 보호되는 것"과 "구멍"을 나눈다.
//   - 자동 게이트: 단일음절 한글 / 라틴 4자 이하 / 흔한 영단어 / 멤버명==실존 그룹명(_atmNameIsGroup)
//   - 수동 목록: _ATM_COMMON_KO_WORDS, _ATM_HASHTAG_ONLY_NAMES, name_match_whitelist(DB),
//               _UNIT_HASHTAG_ONLY_TOKENS, groups.json의 strictSync
// 자동 게이트에 걸리는 건 조용히 넘기고, 수동 목록에만 의존하는 위험만 보고한다.
//
// 실행: node tools/name_collision_audit.mjs            (전체)
//       node tools/name_collision_audit.mjs --new      (최근 추가된 그룹만)
//       node tools/name_collision_audit.mjs --json     (기계용 출력)
//       node tools/name_collision_audit.mjs --group 하이키
//
// ⚠️ DB(name_match_whitelist)는 admin 전용 RLS라 anon 키로는 안 읽힘 — 이 스크립트는 레포 안 파일만
// 보고 판단하므로, DB 화이트리스트로 이미 처리된 이름이 여기 또 뜰 수 있다(그건 어드민 "보호 목록"
// 화면과 대조해서 확인할 것). 반대로 여기서 안 뜨는데 문제가 생기는 경우는 거의 없어야 정상.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const SHARED = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
const ADMIN = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');

const argv = process.argv.slice(2);
const OPT = {
  newOnly: argv.includes('--new'),
  json: argv.includes('--json'),
  group: (() => { const i = argv.indexOf('--group'); return i !== -1 ? argv[i + 1] : null; })(),
};

// ── 실제 코드에서 보호 목록을 파싱해온다(복붙하면 코드와 어긋나므로) ──────────────────
function setFromSource(src, varName) {
  // `const X=new Set([...])` 형태에서 리터럴만 뽑는다
  const m = src.match(new RegExp(varName + '\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)'));
  if (!m) return null;
  return new Set([...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]));
}
const COMMON_KO = setFromSource(ADMIN, '_ATM_COMMON_KO_WORDS');
const COMMON_EN = setFromSource(ADMIN, '_ATM_COMMON_EN_WORDS');
const HASHTAG_ONLY = setFromSource(ADMIN, '_ATM_HASHTAG_ONLY_NAMES');
const UNIT_TOKENS = setFromSource(SHARED, '_UNIT_HASHTAG_ONLY_TOKENS');
for (const [n, v] of Object.entries({ _ATM_COMMON_KO_WORDS: COMMON_KO, _ATM_COMMON_EN_WORDS: COMMON_EN, _ATM_HASHTAG_ONLY_NAMES: HASHTAG_ONLY, _UNIT_HASHTAG_ONLY_TOKENS: UNIT_TOKENS })) {
  if (!v) { console.error(`❌ ${n} 을 소스에서 못 읽었음 — 변수명/형태가 바뀌었는지 확인 필요`); process.exit(2); }
}
const STRICT_SYNC = new Set(Object.entries(GROUPS).filter(([, v]) => v?.strictSync).map(([ko]) => ko));

// ── admin.js의 _atmNameNeedsCtx 재현 ───────────────────────────────────────────
function nameNeedsCtx(t) {
  if (!t) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9.\-'’ ]*$/.test(t)) return false;
  const c = t.replace(/[^A-Za-z0-9]/g, '');
  if (!/[A-Za-z]/.test(c)) return false;
  if (c.length <= 4) return true;
  return COMMON_EN.has(c.toLowerCase());
}
const isSingleSyllable = ko => [...(ko || '')].length === 1;

// 한글 흔한 단어 사전 — 이 프로젝트에서 실제로 사고가 났거나 날 만한 계열만 모음.
// (국어사전 전체를 넣으면 고유명사 이름이 대량 오탐되므로, 노래 제목·가사·예능 자막에 평문으로 자주
//  나오는 단어 위주로 좁게 유지한다. 새 사고가 나면 여기에 추가.)
const KO_COMMON_DICT = new Set([
  '베이비', '하루', '하늘', '바다', '봄', '여름', '가을', '겨울', '별', '사랑', '달', '천사', '하트', '메이',
  '나비', '구름', '햇살', '보석', '다이아', '루비', '진주', '단비', '소나기', '무지개', '노을', '새벽',
  '아침', '저녁', '바람', '눈물', '미소', '행복', '기쁨', '소원', '희망', '자유', '평화', '기적',
  '여신', '요정', '공주', '왕자', '여왕', '천재', '보스', '리더', '캡틴', '에이스', '스타', '퀸',
  '초코', '캔디', '사탕', '꿀', '레몬', '체리', '딸기', '복숭아', '수박', '사과',
  '토끼', '고양이', '강아지', '사자', '호랑이', '여우', '곰', '용', '학',
  '첫사랑', '이별', '고백', '설렘', '추억', '약속', '비밀', '운명', '영원',
  '엄마', '아빠', '언니', '오빠', '누나', '동생', '친구', '선배', '후배',
  '가위', '바위', '보', '하나', '둘', '셋', '다섯', '열',
]);

// ── 데이터 정리 ────────────────────────────────────────────────────────────────
const groupsOf = a => (a.groups || [a.group]).map(g => g?.ko).filter(Boolean);
const roster = ARTISTS.filter(a => a?.name?.ko);

// 사람 단위 식별(겸임을 동명이인으로 오인하지 않게) — 아티스트 객체 자체가 사람 1명
const byKoName = new Map();
for (const a of roster) {
  if (!byKoName.has(a.name.ko)) byKoName.set(a.name.ko, []);
  byKoName.get(a.name.ko).push(a);
}

// ── 최근 추가된 그룹 판별 ──────────────────────────────────────────────────────
// groups.json은 한 줄에 다 들어있는 게 아니라 커밋마다 통째로 바뀌므로, git으로 "이전 버전에 없던 키"를
// 뽑는다. HEAD~N 과 비교(기본 25커밋 — 대략 최근 며칠).
function recentlyAddedGroups(back = 25) {
  try {
    const old = execSync(`git show HEAD~${back}:groups.json`, { cwd: ROOT, maxBuffer: 1 << 28, encoding: 'utf8' });
    const oldKeys = new Set(Object.keys(JSON.parse(old)));
    return Object.keys(GROUPS).filter(k => !oldKeys.has(k));
  } catch (e) {
    return null; // git 없음/히스토리 짧음
  }
}
// 데뷔일 기준 보조(그룹이 오래전에 추가됐어도 데뷔가 최근이면 같이 본다)
function recentDebutGroups(months = 18) {
  const now = new Date('2026-08-25');
  return Object.entries(GROUPS).filter(([, v]) => {
    if (!v?.debut) return false;
    const d = new Date(String(v.debut).replace(/\./g, '-'));
    if (isNaN(d)) return false;
    return (now - d) / (1000 * 60 * 60 * 24 * 30.4) <= months;
  }).map(([k]) => k);
}

// ── 검사 ──────────────────────────────────────────────────────────────────────
const findings = [];
const add = (kind, sev, gko, name, detail) => findings.push({ kind, sev, gko, name, detail });

// A. 동명이인 — 서로 다른 사람이 같은 한글 이름
// ⚠️ 심각도 기준(2026-08-25 실측 후 재조정): 로스터에 2명 이상 등록돼 있으면 런타임의 nameToGroups
// dedup이 "그 이름만으로의 역추론"을 통째로 버리므로 대부분 안전하다. 그래서 단순 동명이인은 info로
// 두고, dedup이 못 받쳐주는 조합만 올린다:
//   - 흔한 단어까지 겸함 → 사람이 아니라 가사/자막에 걸리므로 dedup이 애초에 발동 안 함
//   - 3명 이상 → 로스터에 아직 없는 4번째 동명이인이 있을 확률이 높고, 그 경우 dedup이 안 걸림
//     (실제 사고: 체리블렛 메이가 로스터에 없어 리센느 메이로 쏠림)
for (const [name, people] of byKoName) {
  if (people.length < 2) continue;
  const gkos = people.map(p => groupsOf(p).join('/'));
  const protectedBy = [];
  if (isSingleSyllable(name)) protectedBy.push('단일음절(자동)');
  if (COMMON_KO.has(name)) protectedBy.push('_ATM_COMMON_KO_WORDS');
  if (HASHTAG_ONLY.has(name)) protectedBy.push('_ATM_HASHTAG_ONLY_NAMES');
  if (GROUPS[name] && !STRICT_SYNC.has(name)) protectedBy.push('_atmNameIsGroup(자동)');
  if (people.every(p => nameNeedsCtx(p.name.en || ''))) protectedBy.push('라틴 게이트(자동, 영문명만)');
  const alsoCommon = KO_COMMON_DICT.has(name);
  const sev = protectedBy.length ? 'ok' : alsoCommon ? 'high' : people.length >= 3 ? 'warn' : 'info';
  add('동명이인', sev, gkos.join(' ↔ '), name,
    `${people.length}명` + (protectedBy.length ? ` · 보호: ${protectedBy.join(', ')}`
      : alsoCommon ? ' · 흔한 단어까지 겸함 → dedup이 안 받쳐줌'
        : people.length >= 3 ? ' · 3명 이상 — 미등록 동명이인이 더 있으면 dedup 무력화'
          : ' · nameToGroups dedup이 커버'));
}

// A2. _atmNameIsGroup 과잉 게이트 — 충돌 상대가 strictSync 그룹이면 게이트가 불필요한 손실
for (const [name, people] of byKoName) {
  if (!GROUPS[name] || !STRICT_SYNC.has(name)) continue;
  for (const p of people) {
    if (groupsOf(p).includes(name)) continue;
    add('과잉 게이트', 'warn', groupsOf(p).join('/'), name,
      `충돌 상대 그룹 "${name}"(${GROUPS[name].en})은 strictSync라 제목 매칭 대상이 아님 — 게이트해도 막을 모호함이 없고 정당한 태깅만 잃음`);
  }
}

// B. 흔한 한글 단어 이름
for (const [name, people] of byKoName) {
  if (!KO_COMMON_DICT.has(name)) continue;
  if (COMMON_KO.has(name)) { add('흔한단어(한글)', 'ok', groupsOf(people[0]).join('/'), name, '이미 _ATM_COMMON_KO_WORDS에 있음'); continue; }
  if (isSingleSyllable(name)) { add('흔한단어(한글)', 'ok', groupsOf(people[0]).join('/'), name, '단일음절 자동 게이트'); continue; }
  add('흔한단어(한글)', 'high', people.map(p => groupsOf(p).join('/')).join(' ↔ '), name,
    `흔한 단어인데 _ATM_COMMON_KO_WORDS에 없음 — 제목 평문에 걸려 역추론될 수 있음`);
}

// C. 멤버명이 다른 그룹명의 부분문자열 (베이비 ⊂ 베이비몬스터 계열)
for (const [name, people] of byKoName) {
  if ([...name].length < 2) continue;
  const inGroups = Object.keys(GROUPS).filter(g => g !== name && g.includes(name));
  if (!inGroups.length) continue;
  const guarded = COMMON_KO.has(name) || HASHTAG_ONLY.has(name) || GROUPS[name];
  add('그룹명에 포함됨', guarded ? 'ok' : 'warn', people.map(p => groupsOf(p).join('/')).join(' ↔ '), name,
    `그룹명 ${inGroups.join(', ')} 안에 이 이름이 통째로 들어있음` + (guarded ? ' · 보호됨' : ' · 보호 없음'));
}

// D. 멤버명 == 실존 그룹명 (자동 게이트 확인용 — 구멍이면 심각)
for (const [name, people] of byKoName) {
  if (!GROUPS[name]) continue;
  const others = people.filter(p => !groupsOf(p).includes(name));
  if (!others.length) continue;
  add('그룹명==멤버명', 'ok', others.map(p => groupsOf(p).join('/')).join(' ↔ '), name,
    `그룹 "${name}"과 동명 · _atmNameIsGroup 자동 게이트가 커버(2026-08-24 신설)`);
}

// E. 그룹명 자체가 흔한 단어인데 strictSync가 아님
for (const gko of Object.keys(GROUPS)) {
  if (STRICT_SYNC.has(gko)) continue;
  // ⚠️ 여기선 _atmNameNeedsCtx(길이 기준)를 쓰면 안 된다 — 그건 "멤버 이름 역추론" 게이트고, BTS·EXO·
  // IVE·ITZY 같은 짧지만 고유한 약칭까지 전부 잡아 58건 오탐이 났음(2026-08-25). 그룹명 매칭은 별도
  // 경로(단어 경계 매칭)라, 진짜 위험은 "짧다"가 아니라 "사전에 있는 흔한 단어냐"다.
  const en = (GROUPS[gko]?.en || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  const koCommon = KO_COMMON_DICT.has(gko);
  const enCommon = en.length >= 3 && COMMON_EN.has(en);
  if (!koCommon && !enCommon) continue;
  add('그룹명 흔한단어', koCommon ? 'high' : 'warn', gko, gko,
    (koCommon ? `한글 그룹명이 흔한 단어` : `영문명 "${GROUPS[gko].en}"이 흔한 영단어`) + ` · strictSync 아님 → 외부채널 제목 매칭에 노출`);
}

// F. 유닛/프로젝트명 토큰 충돌 — shared.js _PROJECT_UNITS 의 names 가 흔한 단어인가
{
  const m = SHARED.match(/_PROJECT_UNITS\s*=\s*\{([\s\S]*?)\n\};/);
  if (m) {
    const names = [...m[1].matchAll(/names\s*:\s*\[([^\]]*)\]/g)]
      .flatMap(x => [...x[1].matchAll(/['"]([^'"]+)['"]/g)].map(y => y[1]));
    for (const n of new Set(names)) {
      if (UNIT_TOKENS.has(n)) continue;
      const risky = nameNeedsCtx(n) || KO_COMMON_DICT.has(n) || [...n].length === 1;
      if (risky) add('유닛명 충돌', 'warn', '(유닛)', n, '짧거나 흔한 토큰인데 _UNIT_HASHTAG_ONLY_TOKENS에 없음');
    }
  }
}

// ── 출력 ──────────────────────────────────────────────────────────────────────
const newGroups = recentlyAddedGroups();
const recentDebut = new Set(recentDebutGroups());
const focus = OPT.group ? new Set([OPT.group])
  : OPT.newOnly ? new Set([...(newGroups || []), ...recentDebut])
    : null;
const inFocus = f => !focus || [...focus].some(g => (f.gko || '').includes(g) || f.name === g);

// info = "런타임 dedup이 커버하는 평범한 동명이인" — 96건이나 돼서 기본 출력에선 숫자만 보여준다.
// 전체 목록이 필요하면 --all (동명이인 그룹 오배정 스캔 버튼 돌릴 대상 뽑을 때 등).
const showInfo = argv.includes('--all');
const shown = findings.filter(f => f.sev !== 'ok' && (showInfo || f.sev !== 'info')).filter(inFocus);
const okCount = findings.filter(f => f.sev === 'ok').length;
const infoCount = findings.filter(f => f.sev === 'info').length;

if (OPT.json) {
  console.log(JSON.stringify({ newGroups, recentDebut: [...recentDebut], findings: shown, okCount }, null, 2));
  process.exit(0);
}

const SEV = { high: '[높음]', warn: '[주의]', info: '[참고]' };
console.log(`\n동명이인·흔한단어 오염 감사 — 그룹 ${Object.keys(GROUPS).length} / 인원 ${roster.length}`);
if (newGroups) console.log(`최근 25커밋 내 새로 추가된 그룹: ${newGroups.length ? newGroups.join(', ') : '없음'}`);
console.log(`최근 18개월 내 데뷔 그룹: ${recentDebut.size}팀`);
console.log(`이미 보호되고 있는 항목: ${okCount}건 (자동 게이트 또는 보호 목록)\n`);

const byKind = {};
for (const f of shown) (byKind[f.kind] ||= []).push(f);
const order = ['흔한단어(한글)', '동명이인', '과잉 게이트', '그룹명 흔한단어', '그룹명에 포함됨', '유닛명 충돌'];
for (const kind of order) {
  const list = (byKind[kind] || []).sort((a, b) => (a.sev === 'high' ? -1 : 1) - (b.sev === 'high' ? -1 : 1));
  if (!list.length) continue;
  console.log(`── ${kind} (${list.length}) ${'─'.repeat(Math.max(0, 50 - kind.length))}`);
  for (const f of list) console.log(`  ${SEV[f.sev]} ${f.name}  [${f.gko}]\n       ${f.detail}`);
  console.log('');
}
const high = shown.filter(f => f.sev === 'high').length;
console.log(`합계: 🔴 ${high}건 / 🟡 ${shown.length - high}건${focus ? ' (필터 적용됨)' : ''}`);
