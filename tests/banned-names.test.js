// 밴 인물 영상 숨김(_isBannedVideoTitle) 회귀 테스트 (2026-09-03 신설)
//
// 왜: `hidden` 플래그의 **의도된 용도는 밴 인물 + 관리자 수동 판단뿐**인데(사용자 확인), 실측해보니
// hidden 2,377건 중 밴 목록에 걸리는 건 31건뿐이었고 그 31건 안에도 오탐이 6건 있었다 —
// `kris`에 단어 경계가 없어서 **하파크리스틴(HapaKristin)** 렌즈 광고와 **Kristen Bell**이 걸렸고,
// 그 바람에 장원영·빌리 영상이 숨겨져 있었다(진짜 크리스는 0건).
//
// 이 파일이 지키는 것: 영문 토큰은 단어 경계로만 매칭 / 한글 토큰은 경계 없이(본명 표기까지 잡아야 함).
// ⚠️ 한글에 경계를 걸지 말 것 — `태일`은 본명 **문태일**에도 걸려야 하는데 경계를 걸면 그게 빠진다.
//
// 실행: node tests/banned-names.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// 실제 배포 코드를 그대로 잘라와 실행한다(로직을 베껴 쓰면 조용히 어긋난다 — matching.test.js와 같은 방식).
function grab(re, label) {
  const m = re.exec(html);
  if (!m) throw new Error(`[harness] 못 찾음: ${label} — index.html이 리팩터링됐을 수 있음`);
  return m[0];
}
const src = [
  grab(/const _BANNED_VIDEO_NAMES_GLOBAL=\[[^\]]*\];/, '_BANNED_VIDEO_NAMES_GLOBAL'),
  grab(/const _BANNED_VIDEO_NAMES_SCOPED=\{[^}]*\};/, '_BANNED_VIDEO_NAMES_SCOPED'),
  grab(/const _bannedGlobalRe=new RegExp\(.*\);/, '_bannedGlobalRe'),
  grab(/function _isBannedVideoTitle\(t,ko\)\{[\s\S]*?\n\}/, '_isBannedVideoTitle'),
].join('\n');
const isBanned = new Function(src + '\nreturn _isBannedVideoTitle;')();

let pass = 0, fail = 0;
function t(name, title, gko, expected) {
  const got = isBanned(title, gko);
  if (got === expected) { pass++; console.log(`✅ ${name}`); }
  else {
    fail++;
    console.log(`❌ ${name}`);
    console.log(`   title="${title}" group_ko=${gko || '(none)'}`);
    console.log(`   기대=${expected ? '차단' : '통과'} 실제=${got ? '차단' : '통과'}`);
  }
}

// ── 오탐 방지: 영문 토큰은 단어 경계 안에서만 ──────────────────────────────
t('kris — 하파크리스틴 렌즈 광고는 안 걸림', "츠키 'Hapa Kristin' 렌즈 광고 BEHIND", '빌리', false);
t('kris — 해시태그 hapakristin도 안 걸림', '#제작지원 #장원영 #하파크리스틴 #hapakristin #렌즈', '아이브', false);
t('kris — Kristen Bell도 안 걸림', "Billlie | 'Text Me Merry Christmas (Feat. Kristen Bell)'", '빌리', false);
t('평범한 제목은 당연히 통과', '아이브 장원영 직캠 4K', '아이브', false);

// ── 진짜 밴 대상은 계속 걸려야 함 ─────────────────────────────────────────
t('kris — 단독 단어면 걸림', 'EXO Kris 크리스 무대', '엑소', true);
t('taeil — 해시태그', '[#TAEIL Focus] NCT 127 엔시티 127', '엔시티 127', true);
t('taeil — 아포스트로피 뒤에서도', "TAEIL'S DAY｜NCT 127", '엔시티 127', true);
t('한글 태일 — 본명 표기(문태일)도 걸려야 함 ⚠️경계 걸지 말 것', '[N-6] 내 친구의 방은 어디인가 -문태일 편-', '엔시티 127', true);
t('한글 종훈', 'WELCOME TO FTISLAND STUDIO 종훈(JONG HOON) MESSAGE', '에프티아일랜드', true);
t('seungri', '빅뱅 seungri 무대 모음', '빅뱅', true);

// ── scoped: 동명이인 때문에 그룹 한정으로만 거는 것 ────────────────────────
t('종현 — 씨엔블루에서만 차단', '씨엔블루 종현 기타 연주', '씨엔블루', true);
t('종현 — 샤이니 종현은 차단하면 안 됨(활동중 멤버)', '샤이니 종현 무대', '샤이니', false);
t('승리 — 빅뱅에서만 차단', '빅뱅 승리 무대', '빅뱅', true);
t('승리 — 다른 그룹의 "승리"라는 단어는 통과', '오늘의 승리 팀은? 아이브', '아이브', false);

console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
