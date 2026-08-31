// 원곡 오탐 청소 — 되돌리기 게이트(_coverRestoreSignal) 회귀 테스트 (2026-08-31 신설)
//
// 이 게이트는 "cover_of를 지울까, with_로 되돌릴까"를 정한다. 되돌리기는 **태그를 새로 만드는**
// 방향이라 잘못 켜지면 없던 콜라보가 생긴다. 실제로 시뮬레이션에서 `_coverHasCollabSignal`을 그대로
// 썼더니 "Good Boy Gone Bad - TOMORROW X TOGETHER"의 **그룹명 안에 든 X**가 콜라보로 읽혀서
// 지디·태양을 콜라보로 되돌리려 했다 — 그래서 x/×/vs를 뺀 좁은 게이트를 따로 만들었다.
// 실행: node tests/cover-cleanup.test.js
const {load}=require('../tools/m2_harness');
const M=load();
const {_coverRestoreSignal,_coverHasCollabSignal}=M;
if(!_coverRestoreSignal){console.error('_coverRestoreSignal 없음 — admin.js에서 슬라이스 실패');process.exit(2);}

let pass=0,fail=0;
function t(name,actual,expected){
  if(actual===expected)pass++;
  else{fail++;console.error(`✗ ${name}\n    기대: ${expected} / 실제: ${actual}`);}
}

// ── 되돌려야 하는 것: 게스트 출연이 명시된 제목 ──
t('선배님과', _coverRestoreSignal('아~ 아름답다🌹 with #오하영 선배님❤️'),true);
t('님과 함께', _coverRestoreSignal('#NINEi #이든 #지호 님과 함께하는 여름이었다☀️'),true);
t('with', _coverRestoreSignal('곰 발바닥 🐾 개 발바닥 🐾 with #LEE_EUNJI #이은지'),true);
t('w/', _coverRestoreSignal('dyd w/ @TVXQ @weareoneEXO #RIIZE'),true);
t('선배님(단독)', _coverRestoreSignal('#박재범 #JayPark 선배님과 \'Feel the POP\' 💘'),true);
t('feat.', _coverRestoreSignal('Warning (Feat. 호영 of VERIVERY)'),true);
t('콜라보', _coverRestoreSignal('스페셜 콜라보 무대'),true);
t('듀엣', _coverRestoreSignal('듀엣 무대 비하인드'),true);

// ── 되돌리면 안 되는 것: 그룹명 안의 X, vs, 아무 신호 없음 ──
// ⚠️ 이게 이 테스트의 존재 이유 — 실측으로 잡은 오작동이다.
t('그룹명 속 X — TOMORROW X TOGETHER', _coverRestoreSignal('Good Boy Gone Bad - TOMORROW X TOGETHER [뮤직뱅크/Music Bank]'),false);
t('그룹명 속 X — OH MY GIRL X ASTRO', _coverRestoreSignal('[예능연구소 직캠] OH MY GIRL X ASTRO - 분홍신 (YOONSANHA)'),false);
t('× 기호', _coverRestoreSignal('아이브 × 르세라핌 무대'),false);
t('vs', _coverRestoreSignal('1, 2, 3, POSE! 🆚 배틀'),false);
t('신호 없음 — 해시태그 나열', _coverRestoreSignal('✨샤인멍또캣✨이 말아주는 띄어쓰기의 중요성 #엠카운트다운 #ZEROBASEONE'),false);
t('신호 없음 — 축전 나열', _coverRestoreSignal('[300회 축전] 크래비티 (CRAVITY), 에이티즈 (ATEEZ), 케플러 (Kep1er)'),false);
t('신호 없음 — 평범한 제목', _coverRestoreSignal('Kissing Ⓨⓞⓤ 🍭'),false);

// ── 기존 _coverHasCollabSignal과의 차이가 의도된 것임을 못박는다 ──
// (그쪽은 "with_를 비울지"를 정하는 보수적 용도라 더 넓게 잡는 게 맞다. 둘을 같은 걸로 합치면
//  위의 X 오작동이 되살아난다.)
t('차이 확인 — X는 넓은 게이트에선 참', _coverHasCollabSignal('Good Boy Gone Bad - TOMORROW X TOGETHER'),true);
t('차이 확인 — 좁은 게이트에선 거짓', _coverRestoreSignal('Good Boy Gone Bad - TOMORROW X TOGETHER'),false);

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail?1:0);
