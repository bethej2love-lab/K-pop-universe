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
  // ⚠️ warn이 아니라 **error**다(2026-09-03 승격). 이건 "위험 신호"가 아니라 **명백히 틀린 데이터**다 —
  // 참조된 이름이 어디에도 없으면 그 연결선은 그냥 안 그려진다. 그런데 warn이라 exit 0이었고, CI가
  // 초록으로 통과하는 동안 "Yoona" 6건이 몇 주째 방치됐다(소녀시대 윤아를 영문으로 잘못 저장한 것).
  // 같이 발견된 "제이미(박지민)" 1건은 **개명 잔재**였다 — 이름을 키로 쓰는 구조의 대가가 데이터에
  // 그대로 남은 사례(jamie_rename_migration.sql 참고).
  //
  // 이 파일의 나머지 경고(동명이인 위험·그룹명↔멤버명 충돌 등)는 **정상 데이터에 대한 주의 환기**라
  // warn이 맞다. 승격 기준은 "고칠 게 명확히 있는가" — 유령 참조는 있고, 동명이인은 없다.
  // 새 검사를 추가할 때도 이 기준으로 level을 고를 것.
  missing.forEach((count, name) => add('error', 'connections.json 유령 참조', `"${name}" — ARTISTS에 없는데 연결 ${count}건에서 참조됨 (이름 오타·개명 잔재·미등록 인물)`));
}

// ── 6-b. 솔로 전향자(group.ko가 실존 그룹이 아님) 구조 검사 (2026-09-03 신설) ──
// 이 사람들의 영상은 group_ko가 **본인 이름**으로 저장된다(_ytGroupKoFor). 옛 그룹 시절 영상과의 경계는
// groups[] 항목의 `left`로만 정해지므로, 그 날짜가 없거나 형식이 틀리면 **재귀속이 조용히 안 걸린다.**
// 고칠 게 명확하므로 error(승격 기준은 항목 6 주석 참고). 새 필드를 만들지 않고 기존 구조를 검사한다.
{
  ARTISTS.forEach(a => {
    const gko = a.group && a.group.ko;
    if (!gko || GROUPS[gko]) return;              // 실존 그룹 소속이면 대상 아님
    const nm = (a.name && a.name.ko) || '(이름없음)';
    if (a.died) add('error', '솔로 구조 오류', `${nm} — 사망자가 솔로 전향자로 표시돼 있음`);
    // ⚠️ `left`가 없는 소속은 **오류가 아니라 겸임**이다 — 솔로로 활동하면서 그룹에도 현재 소속인
    //    경우(빛새온·김민서 = 솔로 + B.D.U). 그런 영상은 그룹 콘텐츠가 맞으므로 재귀속하지 않는 게
    //    정답이고 `_soloReattribGko`가 이미 그렇게 동작한다. 처음엔 이걸 error로 잡았다가 되물렸다
    //    (2026-09-03) — "겸임도 있고 아예 탈퇴도 있지"라는 지적이 정확했다.
    //    검사할 건 "탈퇴일이 있는데 형식이 틀린 것"뿐이다. 형식이 틀리면 경계를 못 그어 조용히 누락된다.
    // ⚠️ 연도만/연·월만 적힌 탈퇴일은 **오류가 아니다**(2026-09-04 정정). 이 프로젝트의 관례는
    //    "연도만 알면 그 해 마지막 날까지 인정"이고 shared.js의 `_leftCutoffDate`가 그렇게 해석한다
    //    (2026-09-02 확장). 검사기만 그 확장을 모른 채 YYYY.MM.DD만 통과시켜서, 327명 재귀속(2026-09-03)
    //    직후부터 오류 55건으로 CI가 계속 빨갰다. 진짜 문제는 형식이 아니라 **해석이 두 곳에서 갈린 것**
    //    이었고(admin=그 해 끝, 화면=그 해 시작) 그건 shared.js로 합쳐서 해결했다.
    //    이제 검사할 건 "해석 자체가 불가능한 형식"뿐이고, 정밀도가 낮은 건 warn으로만 남긴다.
    (a.groups || []).filter(g => g && g.ko && GROUPS[g.ko] && g.left).forEach(g => {
      const s = String(g.left).trim();
      if (!/^\d{4}(\.\d{1,2}){0,2}$/.test(s))
        add('error', '솔로 구조 오류', `${nm} — 옛 소속 "${g.ko}"의 탈퇴일 "${g.left}" 해석 불가(YYYY / YYYY.MM / YYYY.MM.DD 중 하나여야 함)`);
      else if (!/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(s))
        add('warn', '탈퇴일 정밀도', `${nm} — 옛 소속 "${g.ko}"의 탈퇴일이 "${g.left}"(일 단위 아님) · 그 ${/^\d{4}$/.test(s) ? '해' : '달'} 마지막 날까지 소속으로 인정됨`);
    });
    // groups[]가 아예 없으면 옛 소속 이력이 사라진 것 — 아이유처럼 원래 그룹이 없던 솔로는 정상이라 warn.
    if (!a.groups) add('warn', '솔로 이력 확인', `${nm} — groups[]가 없어 옛 소속 이력이 없음(원래 솔로면 정상)`);
  });
  // ⚠️ soloSince는 2026-09-03에 도입했다가 같은 날 걷어냈다(기존 groups[]+left로 파생 가능해 중복이었음).
  // 되살아나면 두 곳이 서로 다른 명단을 보게 되므로 여기서 막는다.
  ARTISTS.forEach(a => {
    if (a.soloSince !== undefined)
      add('error', 'soloSince 잔존', `${(a.name && a.name.ko) || '?'} — 폐기된 필드. group.ko='솔로' + groups[]의 left로 표현할 것`);
  });
}

// ── 6-c. 날짜 표기 통일 (2026-09-03 신설) ───────────────────────────────────
// 이 프로젝트의 규약: **데이터는 점(YYYY.MM.DD), 파싱할 때 대시로 바꾼다.** 실제로 날짜를 Date로 넘기는
// 모든 자리가 이미 `.replace(/\./g,'-')`를 하고 있어서(index.html·tools 전수 확인) 점이 정본이다.
// 대시로 섞이면 ①`localeCompare` 문자열 정렬이 어긋나고('-'(0x2D) < '.'(0x2E)라 같은 해에서 대시가 항상
// 먼저 온다) ②replace를 빠뜨린 새 코드가 조용히 다르게 동작한다. 2026-09-03에 unit/soloDiscography의
// 680건(멜론 vs 애플뮤직 출처 차이)을 점으로 통일했고, 여기서 재발을 막는다.
//
// ⚠️ **정밀도는 강제하지 않는다.** `disbanded`는 YYYY / YYYY.MM / true(해체는 했으나 날짜 미상)를
//    모두 허용한다 — 없는 정보를 만들어내면 안 되고, build_slim_data.mjs가 이미 이 3형식을
//    endDate/endPrecision('year'/'month'/'day'/'unknown')으로 정규화해 소비한다(사용자 결정 ⓑ).
{
  const DOT_FULL = /^\d{4}\.\d{2}\.\d{2}$/;
  const DOT_ANY = /^\d{4}(\.\d{2}(\.\d{2})?)?$/;   // YYYY | YYYY.MM | YYYY.MM.DD
  const bad = (lvl, cat, detail) => add(lvl, cat, detail);

  Object.entries(GROUPS).forEach(([ko, g]) => {
    if (g.disbanded === undefined) return;
    if (g.disbanded === true) return;              // 날짜 미상 — 허용(ⓑ)
    if (typeof g.disbanded !== 'string' || !DOT_ANY.test(g.disbanded))
      bad('error', '날짜 표기 오류', `그룹 "${ko}".disbanded = ${JSON.stringify(g.disbanded)} — YYYY[.MM[.DD]] 또는 true`);
    if (typeof g.debut === 'string' && g.debut && !DOT_ANY.test(g.debut))
      bad('error', '날짜 표기 오류', `그룹 "${ko}".debut = ${JSON.stringify(g.debut)} — YYYY[.MM[.DD]]`);
    });
  Object.entries(GROUPS).forEach(([ko, g]) => (g.discography || []).forEach(al => {
    if (al.releaseDate && !DOT_FULL.test(al.releaseDate))
      bad('error', '날짜 표기 오류', `그룹 "${ko}" 앨범 "${al.title}".releaseDate = ${JSON.stringify(al.releaseDate)} — YYYY.MM.DD(점)`);
  }));

  ARTISTS.forEach(a => {
    const nm = (a.name && a.name.ko) || '?';
    // left는 탈퇴 컷오프·솔로 재귀속 경계로 쓰이므로 **일(day)까지** 있어야 제 역할을 한다.
    // 형식 자체가 깨진 건 error, 정밀도만 부족한 건 warn(데이터를 모를 수 있으니 막지는 않음).
    const chkLeft = (v, where) => {
      if (!v) return;
      if (typeof v !== 'string' || !DOT_ANY.test(v))
        bad('error', '날짜 표기 오류', `${nm} ${where}.left = ${JSON.stringify(v)} — YYYY.MM.DD(점)`);
      else if (!DOT_FULL.test(v))
        bad('warn', '날짜 정밀도 부족', `${nm} ${where}.left = "${v}" — 일까지 없으면 탈퇴 컷오프·솔로 재귀속 경계가 안 잡힘`);
    };
    chkLeft(a.left, '');
    (a.groups || []).forEach(g => g && chkLeft(g.left, `(${g.ko})`));
    ['unitDiscography', 'soloDiscography'].forEach(k => (a[k] || []).forEach(u => (u.albums || []).forEach(al => {
      if (al.releaseDate && !DOT_FULL.test(al.releaseDate))
        bad('error', '날짜 표기 오류', `${nm} ${k} "${al.title}".releaseDate = ${JSON.stringify(al.releaseDate)} — YYYY.MM.DD(점)`);
    })));
  });
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

// ── N. 새로 추가/최근 데뷔한 그룹의 이름 충돌 위험 ──────────────────
// 이름 충돌(동명이인·흔한단어·그룹명==멤버명·유닛토큰)은 이 프로젝트 오태깅 사고의 사실상 유일한
// 원인인데, 매번 사용자 제보를 받고 나서야 개별 대응해왔음(2026-08-25 전수 감사에서 확인).
// 판정 로직은 tools/name_collision_audit.mjs 한 곳에만 두고 여기선 위임만 한다 — 로직을 복붙하면
// admin.js의 실제 게이트와 어긋나는 순간 이 검사가 거짓 안심을 주게 되므로.
// 대상은 --new(최근 커밋에서 새로 생긴 그룹 + 최근 18개월 데뷔)로 한정 — 전체는 기존 위험까지
// 다 뜨니까 배포 게이트로는 부적합하고, 전수 점검은 도구를 직접 돌린다.
{
  const { execFileSync } = require('child_process');
  try {
    const out = execFileSync(process.execPath,
      [path.join(ROOT, 'tools', 'name_collision_audit.mjs'), '--new', '--json'],
      { encoding: 'utf8', maxBuffer: 1 << 26 });
    const r = JSON.parse(out);
    for (const f of (r.findings || [])) {
      add(f.sev === 'high' ? 'warn' : 'warn', `새 그룹 이름 충돌 위험(${f.kind})`,
        `${f.name} [${f.gko}] — ${f.detail}`);
    }
  } catch (e) {
    add('warn', '이름 충돌 검사 실행 실패', `tools/name_collision_audit.mjs — ${String(e.message).split('\n')[0].slice(0, 120)}`);
  }
}

// ── 8. 집계용 파생 필드(coKey/coParent/natCodes/endDate)와 그 원본 (2026-09-02) ──────────
// slim 빌드가 만드는 파생 필드는 시각화 집계의 근거라, 원본이 흔들리면 그림이 통째로 틀린다.
// 여기선 "원본이 파생을 만들 수 있는 상태인가"를 본다 — 표기가 두 갈래로 갈리거나(SM/SM엔터테인먼트),
// 슬래시 순서가 뒤집히거나(SM / Label V), ISO가 아닌 국적 코드가 들어오면 잡는다.
{
  const coCount = {};
  const addCo = v => { if (v) coCount[String(v).trim()] = (coCount[String(v).trim()] || 0) + 1; };
  Object.keys(GROUPS).forEach(k => addCo(GROUPS[k].co));
  ARTISTS.forEach(a => addCo(a.co));
  // 같은 회사가 두 표기로 갈리면 coKey는 같아도 co가 화면에서 따로 논다
  const norm = s => String(s).replace(/\s+/g, '').replace(/엔터테인먼트|엔터|ENTERTAINMENT|ENT\.?/gi, '')
    .replace(/주식회사|㈜/g, '').toUpperCase();
  const byNorm = {};
  Object.keys(coCount).forEach(k => { (byNorm[norm(k)] ??= []).push(k); });
  Object.entries(byNorm).filter(([, v]) => v.length > 1).forEach(([, v]) => {
    add('warn', 'co 표기 갈림', v.map(k => `"${k}"(${coCount[k]})`).join(' vs ') + ' — 같은 회사로 보이는데 표기가 다름');
  });
  // 슬래시 표기는 "자회사 / 모회사" 순서 — 뒤가 모회사다. 모회사로 알려진 이름이 앞에 오면 뒤집힌 것.
  const KNOWN_PARENTS = ['HYBE', 'SM', 'JYP', 'YG', '포켓돌스튜디오'];
  Object.keys(coCount).filter(k => k.includes('/')).forEach(k => {
    const head = k.split('/')[0].trim();
    if (KNOWN_PARENTS.includes(head)) add('error', 'co 슬래시 순서 뒤집힘', `"${k}" — 모회사가 앞에 있음("자회사 / 모회사" 순서)`);
  });
  // nat.en은 ISO 3166-1 alpha-2여야 natCodes가 코드 배열로 나온다(복합 국적은 '·'로 이어짐)
  ARTISTS.forEach(a => {
    const en = a.nat && a.nat.en; if (!en) return;
    String(en).split(/[·,]/).map(s => s.trim()).filter(Boolean).forEach(c => {
      if (!/^[A-Z]{2}$/.test(c)) add('error', 'nat 코드가 ISO 2자리가 아님', `${a.name?.ko}: nat.en="${en}" 중 "${c}"`);
    });
  });
  // disbanded는 'YYYY.MM.DD' / 'YYYY.MM' / 'YYYY' / true만 — 그 외는 endDate가 null(unknown)로 떨어진다
  Object.keys(GROUPS).forEach(k => {
    const d = GROUPS[k].disbanded;
    if (d === undefined || d === true) return;
    if (typeof d !== 'string' || !/^\d{4}(\.\d{1,2}){0,2}$/.test(d.trim()))
      add('error', 'disbanded 형식', `${k}: ${JSON.stringify(d)} — endDate로 못 바꿈`);
  });
}

// ── 9. 불변 id (2026-09-02) ──────────────────────
// id는 "이름이 바뀌어도 안 흔들리는 앵커"가 목적이라, 누락·중복·재부여가 생기면 존재 이유가 사라진다.
// 특히 **한 번 부여된 id가 바뀌는 것**이 가장 위험하다(그 id를 참조하는 모든 게 조용히 어긋난다).
// 여기선 형식·중복·누락만 본다 — 값이 바뀌었는지는 git diff가 잡아준다.
{
  const gIds = [], aIds = [];
  Object.keys(GROUPS).forEach(k => {
    const id = GROUPS[k].id;
    if (!id) add('error', 'id 누락(그룹)', `${k} — tools/assign_ids.mjs 실행 필요`);
    else if (!/^g\d{3,}$/.test(id)) add('error', 'id 형식(그룹)', `${k}: ${JSON.stringify(id)} — g + 숫자 3자리 이상`);
    else gIds.push(id);
  });
  ARTISTS.forEach(a => {
    const id = a.id;
    const who = `${a.name?.ko} [${a.group?.ko}]`;
    if (!id) add('error', 'id 누락(아티스트)', `${who} — tools/assign_ids.mjs 실행 필요`);
    else if (!/^a\d{4,}$/.test(id)) add('error', 'id 형식(아티스트)', `${who}: ${JSON.stringify(id)} — a + 숫자 4자리 이상`);
    else aIds.push(id);
  });
  const dup = arr => { const s = new Set(), d = new Set(); for (const x of arr) { if (s.has(x)) d.add(x); s.add(x); } return [...d]; };
  dup(gIds).forEach(d => add('error', 'id 중복(그룹)', d));
  dup(aIds).forEach(d => add('error', 'id 중복(아티스트)', d));
}

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
