// 크레딧 기반 공연자 재배정(_coverCreditReassign) 회귀 테스트 (2026-09-11 신설)
//
// 무엇을 푸는가: 제목에 `(원곡: X)`가 **명시**됐는데 `group_ko`가 바로 그 X인 행 = **원곡자가 공연자
// 자리에 들어간** 옛 오저장이다. 실측 예 — `[MCD] 성한빈 - INVU (원곡：태연)`이 group_ko='태연',
// `FANTASY BOYS - Super (원곡 : 세븐틴)`이 group_ko='세븐틴'. 제목에 "원곡"이 든 1,900행 중 170건.
//
// ⚠️ `_coverResolve`만으로는 영원히 안 고쳐진다: `_coverIsSelf`가 `origin.gko===performerGko`를 보고
//    "자기 곡이니 커버 아님"으로 끊는다. group_ko가 틀려서 생긴 **닭과 달걀**이라, 크레딧이 명시적일
//    때에 한해 group_ko를 의심하고 제목에서 공연자를 다시 찾는 별도 경로를 뒀다.
//
// 이 테스트가 지키는 선:
//   · 공연자를 못 찾으면 **손대지 않는다**(성한빈처럼 로스터 매칭이 안 되는 경우가 실제로 있다)
//   · 공연자 == 원곡자면 **자기 곡**이라 그대로 둔다(CORTIS의 JoyRide)
//   · 크레딧이 정식 표기와 정확히 일치할 때만 믿는다 — `원곡 : 서태지와 아이들`이 (여자)**아이들**로
//     해석되던 부분 매칭을 막는다(실측으로 발견, 이 가드로 182→170건)
//
// 실행: node tests/cover-credit-reassign.test.js
const { load } = require('../tools/m2_harness');
const M = load();
const { _coverCreditReassign, _coverCreditExact, _coverOriginFromText, GROUPS } = M;
if (!_coverCreditReassign) { console.error('_coverCreditReassign 없음 — admin.js 확인'); process.exit(2); }

let pass = true;
const ok = m => console.log(`✅ ${m}`);
const bad = (m, extra) => { pass = false; console.log(`❌ ${m}` + (extra ? `\n   → ${extra}` : '')); };

const row = (title, group_ko, extra) => Object.assign({ title, group_ko, members: [], published_at: '2026-01-01', tags_manual: false }, extra || {});

// t(설명, row, 기대) — 기대가 null이면 "손대지 않아야 함"
function t(name, v, want) {
  let r = null;
  try { r = _coverCreditReassign(v); } catch (e) { bad(name, '예외: ' + e.message); return; }
  if (want === null) {
    if (!r) ok(name);
    else bad(name, `건드리면 안 되는데 재배정됨: ${v.group_ko} → ${r.to}`);
    return;
  }
  if (!r) { bad(name, '재배정돼야 하는데 null'); return; }
  if (r.to !== want.to) { bad(name, `공연자 기대 ${want.to} ≠ 실제 ${r.to}`); return; }
  if (want.coverOf) {
    const got = r.origin.kind === 'group' ? r.origin.gko : r.origin.mko;
    if (got !== want.coverOf) { bad(name, `원곡자 기대 ${want.coverOf} ≠ 실제 ${got}`); return; }
  }
  if (want.members && JSON.stringify(r.patch.members) !== JSON.stringify(want.members)) {
    bad(name, `members 기대 ${JSON.stringify(want.members)} ≠ 실제 ${JSON.stringify(r.patch.members)}`); return;
  }
  ok(name);
}

console.log('── 재배정해야 하는 것(실DB 제목) ──');
t('판타지보이즈가 세븐틴으로 저장돼 있던 것',
  row('[Weekly Playlist l 짐벌캠] FANTASY BOYS - Super (원곡 : 세븐틴) (판타지 보이즈 - 손오공) l EP.6', '세븐틴'),
  { to: '판타지보이즈', coverOf: '세븐틴' });
t('싸이커스 현우 직캠 — 멤버까지 복원',
  row("[K-Fancam] 싸이커스 현우 직캠 'MAESTRO (원곡: 세븐틴)' (xikers HYUNWOO Fancam) @뮤직뱅크글로벌페스티벌", '세븐틴'),
  { to: '싸이커스', coverOf: '세븐틴', members: ['현우'] });
t('이즈나 — 크레딧이 영문(한글) 병기',
  row('What is Love? (원곡: TWICE(트와이스)) - izna (이즈나) [뮤직뱅크 인 리스본] | KBS 251010 방송', '트와이스'),
  { to: '이즈나', coverOf: '트와이스' });
t('원어스 시온 — 원곡자가 영문 표기',
  row('[쇼챔직캠 4K] ONEUS XION - Pink Venom (원어스 시온 - 핑크 베놈 (원곡 : BLACKPINK)) | Show Champion', '블랙핑크'),
  { to: '원어스', coverOf: '블랙핑크', members: ['시온'] });
t('우아 민서 — 레드벨벳으로 저장돼 있던 것',
  row('[쇼챔직캠 4K] 우아 민서 - 파워 업 (원곡 : 레드벨벳) (woo!ah! MINSEO - Power Up) l #쇼챔피언 l EP.40', '레드벨벳'),
  { to: '우아', coverOf: '레드벨벳', members: ['민서'] });
t('원곡자가 **멤버**(슬기)인 경우',
  row('[#퀸덤퍼즐/Full CAM] ♬ 28 Reasons - 소은 (SO EUN) (원곡 : 슬기 (SEULGI)) @업다운배틀 #QUEENDOMPUZZLE', '슬기'),
  { coverOf: '슬기', to: '트라이비' });
t('전각 콜론(원곡：)도 인식',
  row('[#2024MAMA] RIIZE (라이즈) - 영웅 (英雄;  Kick It) (원곡：NCT 127) | Mnet 241122 방송', '엔시티 127'),
  { to: '라이즈', coverOf: '엔시티 127' });

console.log('\n── 손대면 안 되는 것 ──');
t('자기 곡 — 코르티스 멤버가 코르티스 곡을 부름',
  row('[LIVE] CORTIS 성현&건호 - JoyRide (원곡: 코르티스) | 우쥬레코드 코르티스 편', '코르티스'), null);
t('공연자를 못 찾으면 보류 — 성한빈(로스터 매칭 실패)',
  row('[MCD Summer Camp⛺️] 성한빈 (SUNG HAN BIN) - INVU (원곡：태연) #엠카운트다운 EP.941 | Mnet 260813 방송', '태연'), null);
t('크레딧이 없으면 발동 안 함(곡명 추론 금지)',
  row("[K-Fancam] 싸이커스 현우 직캠 'MAESTRO' (xikers HYUNWOO Fancam)", '세븐틴'), null);
t('group_ko가 원곡자가 아니면 발동 안 함',
  row('[Weekly Playlist] DRIPPIN - Getting Closer (원곡 : 세븐틴) (드리핀 - 숨이차)', '드리핀'), null);
// ⚠️ 부분 매칭 방지 — 이 가드가 없으면 '서태지와 아이들'이 (여자)아이들로 해석돼 cover_of가 오염된다
t('서태지와 아이들 → (여자)아이들 부분매칭 거부',
  row("[K-Fancam] 투어스 영재 직캠 '마지막 축제 (원곡 : 서태지와 아이들)' (TWS YOUNGJAE Fancam) @뮤직뱅크 글로벌", '아이들'), null);

console.log('\n── 크레딧 정확일치 가드 단위 확인 ──');
(() => {
  const seo = _coverOriginFromText('서태지와 아이들');
  if (seo && _coverCreditExact('서태지와 아이들', seo)) bad('"서태지와 아이들"이 정확일치로 통과됨', JSON.stringify(seo));
  else ok('"서태지와 아이들"은 정확일치 실패(거부)');
  const bp = _coverOriginFromText('BLACKPINK');
  if (bp && _coverCreditExact('BLACKPINK', bp)) ok('"BLACKPINK"(영문 정식표기) 통과');
  else bad('"BLACKPINK"가 거부됨', JSON.stringify(bp));
  const tw = _coverOriginFromText('TWICE(트와이스)');
  if (tw && _coverCreditExact('TWICE(트와이스)', tw)) ok('"TWICE(트와이스)"(괄호 병기) 통과');
  else bad('"TWICE(트와이스)"가 거부됨', JSON.stringify(tw));
})();

console.log(pass ? '\n✅ 크레딧 재배정 테스트 통과' : '\n❌ 실패 있음');
process.exit(pass ? 0 : 1);
