// dispKo/dispEn — 표기 전용 그룹명 오버라이드 (2026-08-27)
// 장현승: 소속 데이터는 '하이라이트'(영상 조회 키)인데 표기는 '비스트'.
// 이 테스트의 요점은 "표기만 바뀌고 키는 안 바뀐다"를 코드 레벨에서 못박는 것 —
// group.ko를 '비스트'로 바꿔버리면 DB에 없는 group_ko를 조회하게 돼 카드가 통째로 빈다
// (soloDisplay가 우즈에서 겪은 것과 같은 사고, index.html의 _dispGroup 주석 참고).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } };

// ── _gLabel 실동작 ──────────────────────────────────────────────
// index.html에서 함수를 떼어내 실제로 돌린다(주석만 검사하면 로직이 바뀌어도 안 잡힘).
const m = /function _gLabel\(g\)\{[^\n]*\n?/.exec(html);
ok(!!m, '_gLabel 함수를 index.html에서 못 찾음');
if (m) {
  const src = m[0].trim();
  const mk = lang => new Function('currentLang', `${src}; return _gLabel;`)(lang);
  const gKo = mk('ko'), gEn = mk('en');
  const beast = { ko: '하이라이트', en: 'Highlight', dispKo: '비스트', dispEn: 'BEAST' };
  const plain = { ko: '아이브', en: 'IVE' };

  ok(gKo(beast) === '비스트', `ko: dispKo 우선 (got ${gKo(beast)})`);
  ok(gEn(beast) === 'BEAST', `en: dispEn 우선 (got ${gEn(beast)})`);
  ok(gKo(plain) === '아이브', `ko: 오버라이드 없으면 ko (got ${gKo(plain)})`);
  ok(gEn(plain) === 'IVE', `en: 오버라이드 없으면 en (got ${gEn(plain)})`);
  ok(gEn({ ko: '솔로' }) === '솔로', 'en인데 en도 dispEn도 없으면 ko로 폴백');
  ok(gKo(null) === '' && gEn(undefined) === '', 'null/undefined는 빈 문자열');
  // dispKo만 있고 dispEn이 없는 경우 en에서 en(원래 그룹명)이 아니라 dispKo로 떨어져야 한다 —
  // 표기를 갈아끼우기로 한 이상 영문에서만 옛 이름이 아닌 새 이름이 튀어나오면 안 됨.
  ok(gEn({ ko: '하이라이트', en: 'Highlight', dispKo: '비스트' }) === '비스트',
    'dispEn 없으면 en에서도 dispKo로 (원래 en으로 새면 안 됨)');
  ok(gKo({ ko: '하이라이트', en: 'Highlight', dispEn: 'BEAST' }) === 'BEAST',
    'dispKo 없으면 ko에서도 dispEn으로 — 오버라이드는 한쪽만 채워도 항상 이긴다');
}

// ── 그룹명을 그리는 자리가 전부 _gLabel을 타는가 ─────────────────
// 같은 조건이 여러 곳에 복붙돼 한 곳만 고쳐지는 게 이 프로젝트의 반복 사고 패턴이라,
// "currentLang==='ko'?g.ko:(g.en||g.ko)" 같은 raw 표기가 남아있으면 실패시킨다.
const rawGroupLabel = [...html.matchAll(/currentLang===['"]ko['"]\?g\.ko\s*:\s*\(g\.en\|\|g\.ko\)/g)];
ok(rawGroupLabel.length === 0,
  `그룹명을 _gLabel 안 거치고 직접 그리는 자리가 ${rawGroupLabel.length}곳 남아있음`);

for (const site of ['const _tgTxt=_gLabel(g)', 'const _spTxt=_gLabel(g)', 'function _dispGroupName(a){return _gLabel(']) {
  ok(html.includes(site), `${site} — 이 자리가 _gLabel을 안 탐`);
}

// 연결 카드 그룹 칩: 버킷 키(gko)는 showGC·_groupsCoAppear가 쓰는 실제 그룹명이라 그대로,
// 라벨만 갈아끼워야 한다.
ok(/groupChip\.innerHTML=isWideOnly\?gkoLabel:`\$\{gkoLabel\}/.test(html),
  '연결 카드 그룹 칩이 gkoLabel을 안 씀');
ok(/_connSelectedGroups\.has\(gko\)/.test(html) && !/_connSelectedGroups\.has\(gkoLabel\)/.test(html),
  '연결 카드 선택 상태가 라벨(gkoLabel)을 키로 쓰고 있음 — 실제 그룹명이어야 함');
ok(/showGC\(gkoLabel/.test(html) === false, 'showGC에 라벨이 넘어가고 있음 — g.ko여야 함');

// ── 장현승 데이터 ────────────────────────────────────────────────
const jhs = ARTISTS.find(a => a.name.ko === '장현승');
ok(!!jhs, '장현승이 artists.json에 없음');
if (jhs) {
  ok(jhs.group.ko === '하이라이트', `group.ko는 조회 키라 '하이라이트'여야 함 (got ${jhs.group.ko})`);
  ok(jhs.group.dispKo === '비스트' && jhs.group.dispEn === 'BEAST', '표기 오버라이드가 없음');
  ok(jhs.active === false, '장현승 active는 false여야 함');
  // left가 없으면 _memberVideoCutoff가 미태깅 그룹영상을 통째로 막아버린다(ownGroupWideClause='').
  ok(jhs.left === '2016.04.19', `left 탈퇴일이 정확해야 함 (got ${jhs.left})`);
  ok(!!GROUPS[jhs.group.ko], 'group.ko가 GROUPS에 실존해야 그룹 태그가 렌더됨');
}

// dispKo를 쓰는 모든 아티스트는 group.ko가 GROUPS에 실존해야 한다(표기만 바꾸는 게 이 필드의 전부).
ARTISTS.forEach(a => {
  (a.groups || [a.group]).forEach(g => {
    if (g && g.dispKo) ok(!!GROUPS[g.ko], `${a.name.ko}: dispKo가 있는데 group.ko(${g.ko})가 GROUPS에 없음`);
  });
});

// ── 하이라이트 strictSync 해제 + 토큰 게이트가 세트로 들어갔는가 ──
const adminJs = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
ok(!GROUPS['하이라이트'].strictSync, '하이라이트 strictSync가 아직 켜져 있음');
ok((GROUPS['하이라이트'].altNames || []).includes('B2ST'), 'altNames에 B2ST가 없음');
const gate = /_GROUP_TOKEN_HASHTAG_ONLY=new Set\(\[([^\]]*)\]\)/.exec(adminJs);
ok(!!gate, '_GROUP_TOKEN_HASHTAG_ONLY를 못 찾음');
if (gate) {
  const toks = [...gate[1].matchAll(/'([^']*)'/g)].map(x => x[1]);
  for (const t of ['하이라이트', 'Highlight', 'BEAST']) {
    ok(toks.includes(t), `토큰 게이트에 '${t}'가 없음 — strictSync를 풀었으면 반드시 세트`);
  }
  // '비스트'/'B2ST'는 게이트 밖이어야 한다. 이 둘을 hit()으로 잡는 게 strictSync를 푼 이유 자체라,
  // 게이트에 넣어버리면 해시태그 없는 옛 비스트 영상을 여전히 못 잡는다.
  for (const t of ['비스트', 'B2ST']) {
    ok(!toks.includes(t), `'${t}'는 일반어 충돌이 없어 게이트 밖이어야 함`);
  }
}

// ── 용준형 밴 ────────────────────────────────────────────────────
const ban = /_BANNED_VIDEO_NAMES_GLOBAL=\[([^\]]*)\]/.exec(html);
ok(!!ban, '_BANNED_VIDEO_NAMES_GLOBAL을 못 찾음');
if (ban) {
  const names = [...ban[1].matchAll(/'([^']*)'/g)].map(x => x[1]);
  ok(names.includes('용준형'), '밴 목록에 용준형이 없음');
  // ⚠️ 로마자 단독 'junhyung'/'jun hyung'은 고스트나인 손준형(#SONJUNHYUNG, 현역)과 정면 충돌.
  // 실측 55건 중 48건이 손준형이었다 — 성(yong)이 안 붙은 형태는 절대 들어가면 안 됨.
  for (const bad of ['junhyung', 'jun hyung', 'jun hyeong', '준형']) {
    ok(!names.includes(bad), `'${bad}'는 손준형(고스트나인)을 오폭함 — 밴 목록에 넣으면 안 됨`);
  }
  // 실제 매칭 확인: 밴 정규식이 손준형 제목을 안 잡고 용준형 제목은 잡아야 한다.
  const re = new RegExp(names.join('|'), 'i');
  ok(re.test('하이라이트 Highlight 용준형이 즐겨 듣는 음악은? #마리미니토크'), '한글 용준형 제목을 못 잡음');
  ok(re.test('Wheesung Words That Freeze My Heart Feat Yong Jun Hyung of Beast'), 'Yong Jun Hyung 제목을 못 잡음');
  ok(!re.test('도가니 사리기 #GHOST9 #고스트나인 #SONJUNHYUNG #손준형 #Shorts'), '고스트나인 손준형을 오폭함');
  ok(!re.test('[MPD직캠] 고스트나인 손준형 직캠 4K (GHOST9 SON JUN HYUNG FanCam)'), 'GHOST9 SON JUN HYUNG 직캠을 오폭함');
  ok(!re.test('JUNHYUNG 1st Solo Digital Single CRUSH #GHOST9'), 'GHOST9 JUNHYUNG 솔로 영상을 오폭함');
}
// 밴 인물은 artists.json에 등록하지 않는다(승리·힘찬·종훈·이종현 선례).
ok(!ARTISTS.some(a => a.name.ko === '용준형'), '용준형이 artists.json에 등록돼 있음 — 밴 인물은 미등록이 규칙');

console.log(`disp-group: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
