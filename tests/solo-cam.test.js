// "개인 직캠" 판정(_isSoloCam) 회귀 테스트 (2026-09-10 신설)
//
// 사용자 제보: 나침반 탐험 > Discover > "주간 개인 직캠 TOP 20"에 **솔로 아티스트의 방송 무대**가 섞인다.
//   · 무대  "TAEMIN (태민) - FLOAT | Show! MusicCore | MBC260905방송"      ← 카메라 여러 대 방송 송출본
//   · 직캠  "[#음중팔로우캠4K] TAEMIN (태민) - FLOAT | 쇼! 음악중심 …"      ← 그 한 명만 따라간 카메라
// 원인은 옛 판정식이 음악방송 **프로그램명**(음악중심·뮤직뱅크…)을 직캠 근거로 삼은 것. 그룹 무대는
// members가 비거나 여럿이라 "1명" 조건에 걸렸지만 **솔로 무대는 members가 딱 1명**이라 그대로 통과했다.
//
// ⚠️ 정규식만 따로 떼어 문자열로 테스트하면 "실제 동작"을 검증한 게 아니다(이 프로젝트에서 실제로 겪은
//    실패 모드 — 성-뗀 가드 사고). 그래서 여기선 index.html의 **진짜 함수 본문을 잘라와 실행**하고,
//    케이스도 전부 DB에서 실제로 꺼낸 제목이다(tools 쪽 프로브로 뽑음).
// ⚠️ 새 직캠 브랜드를 _FANCAM_BRAND_RE에 추가할 땐 아래 CAMS에 실제 제목 한 줄도 같이 추가할 것.
//
// 실행: node tests/solo-cam.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// tests/matching.test.js와 같은 "이름으로 잘라오기" — 선언 줄부터 균형이 맞는 지점까지 그대로 실행한다.
function extractStatement(declStartRe, label) {
  const m = declStartRe.exec(src);
  if (!m) throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  let depth = 0;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) return src.slice(m.index, i + 1);
  }
  throw new Error(`[harness] 문장 끝(;)을 못 찾음: ${label}`);
}
function extractByBraces(declStartRe, label) {
  const m = declStartRe.exec(src);
  if (!m) throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  let i = src.indexOf('{', m.index), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}

const harness = [
  extractStatement(/^const _FANCAM_BRAND_RE\s*=/m, '_FANCAM_BRAND_RE'),
  extractByBraces(/^function _isSoloCam\(/m, '_isSoloCam'),
  'return {_isSoloCam, _FANCAM_BRAND_RE};',
].join('\n');
const { _isSoloCam } = new Function(harness)();

// ── 실제 DB 제목 ─────────────────────────────────────────────────────────────
// 직캠 = 통과해야 함. 브랜드 계열을 골고루(MPD/입덕·예능연구소·안방1열·페이스캠·K-Fancam·단독샷캠·
// 팔로우캠·원픽캠·보컬캠·FAN PICK CAM·K-Choreo 직캠), 솔로 아티스트 직캠도 포함.
const CAMS = [
  "[MPD직캠] 방탄소년단 뷔 직캠 4K 'FAKE LOVE' (BTS V FanCam) | @MCOUNTDOWN_2018.5.31",
  "[입덕직캠] 정국 직캠 4K 'Standing Next to You' (Jung Kook FanCam) | @MCOUNTDOWN_2023.11.16",
  "[예능연구소] 블랙핑크 제니 직캠 'Pretty Savage' (BLACKPINK JENNIE FanCam) @Show!MusicCore 201010",
  "[안방1열 풀캠4K] 지수 '꽃' (JISOO 'FLOWER' FullCam)│@SBS Inkigayo 230409",
  "[페이스캠4K] 하츠투하츠 지우 '15-LOVE' (Hearts2Hearts JIWOO FaceCam) @SBS Inkigayo 260830",
  "[단독샷캠4K] 정국 'Seven (feat. Latto)' 단독샷 별도녹화│Jung Kook ONE TAKE STAGE│@SBS Inkigayo_230730",
  "[K-Fancam] 청하 직캠 'México' (CHUNG HA Fancam) @뮤직뱅크(Music Bank) 260904",
  "[#음중팔로우캠4K] TAEMIN (태민) - FLOAT | 쇼! 음악중심 | MBC260905방송",
  "[쇼챔 원픽캠 4K] MASHIRO(마시로) - HOTLINE (Feat. BOBBY) | Show Champion | EP.610 | 260902",
  "[쇼챔 보컬캠] ONEWE  YONGHOON (원위 용훈) - Scenario  | Show Champion | EP.610 | 260902",
  "THE SHOW CHOICE - ALPHA DRIVE ONE 'JUNSEO' [THE SHOW] 260901 방송 [FAN PICK CAM 4K]",
  "[K-Choreo 8K] 태민 직캠 'Gooey' (TAEMIN Choreography) @MusicBank 260904",
  "[얼빡직캠 4K] 청하 'México' (CHUNG HA Facecam) @뮤직뱅크(Music Bank) 260904",
  "[#최애직캠] Girls’ Generation-HRS HYO (소녀시대-효리수 효연) – Skibidi | 쇼! 음악중심 | MBC260905",
];
// 무대·홍보물 = 빠져야 함. 전부 옛 기준에선 "개인 직캠"으로 새어 들어오던 실제 행들이다.
const STAGES = [
  "TAEMIN (태민) - FLOAT | Show! MusicCore | MBC260905방송",
  "Gooey - 태민 (TAEMIN) [뮤직뱅크/Music Bank] | KBS 260904 방송",
  "CHUNG HA (청하) - México | Show! MusicCore | MBC260905방송",
  "'최초 공개' 미미 (오마이걸) - Bish Bash Bosh #엠카운트다운 EP.942 | Mnet 260820 방송",
  "'HOT SOLO DEBUT' 한빈(TEMPEST) - No Fear (Feat. punchnello) #엠카운트다운 EP.943 | Mnet 260827 방송",
  "[SOLO HOT DEBUT] 마시로 (MASHIRO)- HOTLINE (Feat. BOBBY) l Show Champion l EP.610 l 260902",
  "NINA(니나) - Why l Show Champion l EP.611 l 260909",
  "JISOO(지수) - FLOWER(꽃) @인기가요 inkigayo 20230409",
  "ROSÉ - 'On The Ground' 0314 SBS Inkigayo",
  "G-DRAGON_0922_SBS Inkigayo_니가 뭔데(WHO YOU) + No.1 of the week",
  "[4K] TAEYANG (태양) - LIVE FAST DIE SLOW | Show! MusicCore | MBC260523방송",
  "[🔴라이브] 09/05 SATㅣ쇼! 음악중심ㅣKPOP LIVEㅣ##GirlsGeneration_HRS #MonstaX #NCT127 #DINO",
  "초코민트보다도 달콤한 화니쨩~ 꼬물이쨩~과 함께하는 8월의 먼슬리 엠카PICK! #엠카운트다운 #MCOUNTDOWN #박건욱",
  "♡#엔딩요정컬렉션🧚#태용 #TAEYONG - WYLD✨ #MCOUNTDOWN #엠카운트다운",
];

let fail = 0;
const check = (label, got, want, title) => {
  if (got === want) return;
  fail++;
  console.log(`  ✗ ${label}: 기대 ${want} / 실제 ${got}\n     ${title}`);
};
console.log('1) 직캠 제목은 통과해야 한다');
CAMS.forEach(t => check('직캠 누락', _isSoloCam({ title: t, members: ['X'] }), true, t));
console.log('2) 방송 무대·홍보물은 빠져야 한다');
STAGES.forEach(t => check('무대 유입', _isSoloCam({ title: t, members: ['X'] }), false, t));
console.log('3) 멤버 태깅 1명 조건은 그대로다');
const camTitle = CAMS[0];
check('멤버 0명(그룹 포메이션 직캠)', _isSoloCam({ title: camTitle, members: [] }), false, camTitle);
check('멤버 2명(콜라보 직캠)', _isSoloCam({ title: camTitle, members: ['A', 'B'] }), false, camTitle);
check('members 없음', _isSoloCam({ title: camTitle }), false, camTitle);
check('빈 입력', _isSoloCam(null), false, '(null)');
console.log('4) 쇼츠 예외가 흡수됐는지 — 브랜드 낱말만 있으면 쇼츠도 통과, 없으면 탈락');
check('쇼츠 직캠', _isSoloCam({ title: '니키야 나 울어 #MPD직캠 #엔하이픈 #shorts', members: ['니키'], is_short: true }), true, 'shorts 직캠');
check('쇼츠 홍보물', _isSoloCam({ title: '템페스트 왜이리 가족이야😭 #HANBIN #TEMPEST @260901 [THE SHOW]', members: ['한빈'], is_short: true }), false, 'shorts 홍보');

console.log(fail ? `\n❌ 실패 ${fail}건` : `\n✅ 전부 통과 (${CAMS.length + STAGES.length + 6}건)`);
process.exit(fail ? 1 : 0);
