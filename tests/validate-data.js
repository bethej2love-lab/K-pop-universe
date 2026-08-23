// 데이터 무결성 검증 스크립트 (2026-08-21 신설)
//
// 왜 만들었나: 이 세션 동안 조용히 쌓인 데이터 문제들(ZB1/앤더블 중복 엔트리, 스피카 연결 공백,
// "솔로" placeholder 오사용, 하이라이트/브브걸 데뷔일 표기 모순 등)이 전부 스키마 검증 없이 사람이
// 우연히 발견해서 고친 것들이었음 — Fable 자문("일류 IT 기업 개발자가 봤다면") 지적 중 "데이터
// 무결성이 사람 기억에 의존한다"를 검증 후 동의해서 만듦. CI는 없지만 "배포 전에 한 번 돌리는" 용도.
//
// 무엇을 잡는가: (1) artists.json 중복 인물(이름+생일 동일), (2) group.ko/groups[].ko가 GROUPS에
// 없는 유령 참조(솔로 placeholder는 예외), (3) 필수 필드(name.ko/group.ko) 누락, (4) groups.json
// 중복 최상위 키(JSON.parse가 조용히 마지막 것만 남기므로 원본 텍스트를 따로 스캔), (5) producedBy
// 유령 참조, (6) connections.json이 참조하는 이름이 ARTISTS에 아예 없는 경우.
// 무엇을 안 잡는가: 동명이인 자체(예: "마크"가 두 명인 것)는 정상 데이터라 에러가 아님 — 그건
// matching.test.js의 몫. 이 스크립트는 순수 구조적 무결성만 본다.
//
// 실행: node tests/validate-data.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const groupsRaw = fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8');
const GROUPS = JSON.parse(groupsRaw);
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const CONNECTIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'connections.json'), 'utf8'));

const issues = []; // {level:'error'|'warn', category, detail}
const add = (level, category, detail) => issues.push({ level, category, detail });

// ── 1. artists.json 중복 인물(이름+생일 동일) ──────────────────────
{
  const seen = new Map(); // "이름|생일" -> count
  ARTISTS.forEach(a => {
    if (!a.bday) return; // 생일 없으면 비교 기준이 약해 스킵(오탐 방지)
    const key = `${a.name && a.name.ko}|${a.bday}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  seen.forEach((count, key) => {
    if (count > 1) add('error', '중복 인물(이름+생일 동일)', `${key} — ${count}건`);
  });
}

// ── 2. group.ko / groups[].ko 유령 참조 ──────────────────────
// "솔로"는 GROUPS에 없는 게 정상인 공유 placeholder(그 자체가 이미 확립된 관례) — 유일한 예외.
{
  ARTISTS.forEach(a => {
    const gko = a.group && a.group.ko;
    if (gko && gko !== '솔로' && !GROUPS[gko]) {
      add('error', 'group.ko 유령 참조', `${a.name && a.name.ko}(${gko}) — GROUPS에 없음`);
    }
    // groups[]는 항상 자신의 group을 0번째로 포함하는 관례라(예: 빛새온 group.ko="솔로" → groups[0]도
    // "솔로"), 여기도 group.ko와 동일하게 "솔로"는 예외(2026-08-21, 실제 데이터로 확인 후 수정 — 빛새온/
    // 김민서(B.D.U) 오탐이었음).
    (a.groups || []).forEach(g => {
      if (g.ko && g.ko !== '솔로' && !GROUPS[g.ko]) {
        add('error', 'groups[].ko 유령 참조', `${a.name && a.name.ko} — groups[]의 "${g.ko}"가 GROUPS에 없음`);
      }
    });
  });
}

// ── 3. 필수 필드 누락 ──────────────────────
{
  ARTISTS.forEach((a, i) => {
    if (!a.name || !a.name.ko) add('error', '필수 필드 누락', `artists.json[${i}] — name.ko 없음`);
    if (!a.group || !a.group.ko) add('error', '필수 필드 누락', `${a.name && a.name.ko || '(이름 없음)'} — group.ko 없음`);
  });
}

// ── 4. groups.json 중복 최상위 키 ──────────────────────
// JSON.parse는 중복 키가 있어도 에러 없이 마지막 값만 조용히 남긴다 — 앞의 데이터가 통째로
// 유실되는데 아무 신호가 없으므로, 파싱 전 원본 텍스트에서 최상위 depth의 키만 따로 센다.
{
  let depth = 0;
  const topKeyRe = /^\s*"((?:[^"\\]|\\.)*)"\s*:/;
  const counts = new Map();
  const lines = groupsRaw.split('\n');
  for (const line of lines) {
    for (const ch of line) {
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') depth--;
    }
    if (depth === 1) {
      const m = topKeyRe.exec(line);
      if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }
  }
  counts.forEach((count, key) => {
    if (count > 1) add('error', 'groups.json 중복 최상위 키', `"${key}" — ${count}번 등장(마지막 것만 실제로 살아남음)`);
  });
}

// ── 5. producedBy 유령 참조 ──────────────────────
{
  Object.entries(GROUPS).forEach(([gko, info]) => {
    (info.producedBy || []).forEach(entry => {
      if (entry.artist && entry.ko) {
        const found = ARTISTS.some(a => a.name.ko === entry.ko && (!entry.group || entry.group === a.group.ko));
        if (!found) add('warn', 'producedBy 유령 참조', `${gko} — producedBy "${entry.ko}"${entry.group ? `(${entry.group})` : ''}가 ARTISTS에 없음`);
      }
    });
  });
}

// ── 6. connections.json이 참조하는 이름이 ARTISTS에 아예 없음 ──────────────────────
// 동명이인(예: "마크")은 정상 — 이름 자체가 ARTISTS 어디에도 없는 완전한 유령 참조만 잡는다.
// 성범죄 등으로 퇴출돼 의도적으로 ARTISTS에서 제외한 인물(index.html의 _BANNED_VIDEO_NAMES_GLOBAL/
// SCOPED와 같은 정책)이나 공식 데뷔 전 탈퇴해 애초에 등록 대상이 아니었던 인물은 "없는 게 정상"이라
// 여기서 계속 경고로 뜨면 실제 버그와 구분이 안 됨 — 알려진 제외 인물은 화이트리스트로 걸러낸다
// (2026-08-21, 사용자 확인 — 이종현(씨엔블루)/태일(NCT 전 멤버)/김가람(르세라핌, 공식 데뷔 전 탈퇴)).
const _KNOWN_EXCLUDED_PEOPLE = new Set(['이종현', '태일', '김가람', '승리', '크리스', '힘찬', '종훈']);
{
  const allNames = new Set(ARTISTS.map(a => a.name.ko));
  const missing = new Map(); // name -> count
  CONNECTIONS.forEach(c => {
    [c.a, c.b].forEach(n => {
      if (n && !allNames.has(n) && !_KNOWN_EXCLUDED_PEOPLE.has(n)) missing.set(n, (missing.get(n) || 0) + 1);
    });
  });
  missing.forEach((count, name) => add('warn', 'connections.json 유령 참조', `"${name}" — ARTISTS에 없는데 연결 ${count}건에서 참조됨`));
}

// ── 7. 그룹명 ↔ 타 그룹 멤버명 충돌 (오태깅 유발 — 스텔라→하츠투하츠, 슈가→방탄 사례로 발견, 2026-08-23) ──
// 그룹명(ko/en)이 다른 그룹 멤버의 이름(ko/en)과 같으면, 그 멤버 언급이 그룹으로 오매칭돼 대량 오태깅됨.
// strictSync 지정한 그룹은 제목 매칭에서 빠지므로(=처리됨) 경고 대상에서 제외. 새 충돌은 검토 후 strictSync.
const _memNameIdx = new Map(); // UPPER(name) -> Set(group.ko)
ARTISTS.forEach(a => {
  [a.name && a.name.ko, a.name && a.name.en].forEach(nm => {
    if (!nm) return;
    const u = nm.toUpperCase();
    if (!_memNameIdx.has(u)) _memNameIdx.set(u, new Set());
    _memNameIdx.get(u).add(a.group && a.group.ko);
  });
});
Object.entries(GROUPS).forEach(([gko, info]) => {
  if (info.strictSync) return; // 이미 처리된 그룹은 건너뜀
  [gko, info.en].forEach(form => {
    if (!form) return;
    const others = _memNameIdx.get(form.toUpperCase());
    if (!others) return;
    const otherGroups = [...others].filter(x => x && x !== gko);
    if (otherGroups.length) add('warn', '그룹명↔멤버명 충돌(오태깅 위험)', `그룹 "${gko}"(=${form}) ↔ ${otherGroups.join(', ')}의 동명 멤버 — strictSync 검토 필요`);
  });
});

// ── 리포트 ──────────────────────
const byCategory = new Map();
issues.forEach(iss => {
  if (!byCategory.has(iss.category)) byCategory.set(iss.category, []);
  byCategory.get(iss.category).push(iss);
});
let errorCount = 0, warnCount = 0;
byCategory.forEach((list, category) => {
  const level = list[0].level;
  if (level === 'error') errorCount += list.length; else warnCount += list.length;
  console.log(`\n${level === 'error' ? '❌' : '⚠️ '} ${category} (${list.length}건)`);
  list.slice(0, 20).forEach(iss => console.log(`   ${iss.detail}`));
  if (list.length > 20) console.log(`   … 외 ${list.length - 20}건 더`);
});
if (!issues.length) console.log('✅ 문제 없음');
console.log(`\n총 ${errorCount}개 오류, ${warnCount}개 경고`);
process.exit(errorCount ? 1 : 0);
