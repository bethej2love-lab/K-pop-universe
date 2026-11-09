// 챌린지 영상 태깅 회귀 (2026-11-09)
//
// 사용자: "아직도 태깅 잘 못하더라, 특히 챌린지 같은 영상들 — 제목에서 맥락으로 유추할 수 있는 건 거의 완벽하게".
// 최근 챌린지 400개 실측에서 빠지던 유형과, 고치는 중 4만 5천 제목 차분으로 찾은 오답 유형을 함께 고정한다.
//  ① 로마자 흔들림 — #KIMSUNGMIN(등록 Kim Seongmin)·#BANGJEEMIN(Bang Jimin)·#Jooyeon(Juyeon)·#SUNGHANBIN(성+Hanbin)
//  ② 붙여 쓴 그룹 해시태그(#XdinaryHeroes)·성 붙인 한글 태그(#소정환 = 정환)
//  ③ 챌린지 게스트 해시태그(MOVE LIKE #온유·#이영지) — 단 챌린지 곡의 원곡 가수(#홀씨 #challenge의 아이유)는 아님
//  ④ 곡 주인 그룹 — "신혜원의 아일릿 '체포하겠어' 챌린지"·"엔믹스 댄스 챌린지에 도전하는 은가은 VS 박서진"
//  ⑤ 떠난/해체된 그룹으로 붙이지 않기(#박재범 → 2PM ✗)·잡힌 그룹 멤버의 애칭(#오하영 #하영 → 프로미스나인 ✗)
//
// 실행: node tests/challenge-guest-tagging.test.js

const H = require('../tools/matcher_harness.cjs');
let pass = true;
const ck = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) pass = false; };
const P = (t, self, d) => H._m2ParseTitle(t, self, false, d || '2026-10-01');
const has = (r, g, m) => !!r && (r.membersByGroup[g] || []).includes(m);
const hasG = (r, g) => !!r && (r.primaryGroup === g || (r.withGroups || []).includes(g));

// ① 로마자 흔들림
ck(has(P('Vibe Check #CLOSEYOUREYES #KIMSUNGMIN #SONGSEUNGHO #KENSHIN #VibeCheckChallenge'), '클로즈유어아이즈', '김성민'), '#KIMSUNGMIN → 김성민(Kim Seongmin)');
ck(has(P('Vibe Check #CLOSEYOUREYES #JEONMINWOOK #JANGYEOJUN #VibeCheckChallenge'), '클로즈유어아이즈', '전민욱'), '#JEONMINWOOK → 전민욱');
ck(has(P('Count to #SUNGHANBIN #BOYNEXTDOOR #CountToLove_Challenge', '보이넥스트도어'), '제로베이스원', '성한빈'), '#SUNGHANBIN → 제로베이스원 성한빈(성 + 등록 Hanbin)');
ck(has(P('#GoodBoy with #BANGJEEMIN @izna_offcl #IZNA #GoodBoy_challenge #andTEAM', '앤팀'), '이즈나', '방지민'), '#BANGJEEMIN → 이즈나 방지민');
ck(has(P('#GoodBoy with #Yihyun @BabyDONTCry.official #GoodBoy_challenge #andTEAM', '앤팀'), '베이비돈크라이', '이현'), '#Yihyun + 그룹 표기 → 베이비돈크라이 이현(막힌 이름도 그룹 근거가 있으면)');
ck(has(P('easy_ver._challenge_with_AND2BLE_ZHANGHAO.exe @AND2BLE', '누에라'), '앤더블', '장하오'), '밑줄로 이은 ZHANGHAO → 앤더블 장하오');

// ② 붙여 쓴 그룹명·성 붙인 한글
ck(has(P('Count to #XdinaryHeroes #Jooyeon #BOYNEXTDOOR #CountToLove_Challenge', '보이넥스트도어'), '엑스디너리 히어로즈', '주연'), '#XdinaryHeroes #Jooyeon → 엑디 주연');
ck(has(P('소박즈 참참참 챌린지 #MCOUNTDOWN #소정환 #TREASURE #박건욱 #ZEROBASEONE'), '트레저', '정환'), '#소정환 → 트레저 정환(성 붙인 한글)');
ck(!hasG(P('불꽃 #KISSOFLIFE #쥴리 #ONEPACT #정예찬 #TRENDZ'), '오메가엑스'), '#정예찬은 그대로 등록된 사람이 있으면 다른 그룹 예찬으로 안 감');

// ③ 챌린지 게스트 해시태그
ck(has(P('#ANIMAL_beat #온유 🐾 #BOYNEXTDOOR #ANIMAL #ANIMAL_Challenge', '보이넥스트도어'), '샤이니', '온유'), 'MOVE LIKE #온유 → 샤이니 온유(샤이니 ANIMALS ≠ 보넥도 ANIMAL)');
ck(hasG(P('MOVE LIKE #이영지 🐾 #BOYNEXTDOOR #ANIMAL #ANIMAL_Challenge', '보이넥스트도어'), '이영지'), 'MOVE LIKE #이영지 → 이영지');
ck(has(P('What’s a girl to do with #MONSTAX #JOOHONEY #DAYOUNG @MONSTAX #WAGTD_Challenge', '몬스타엑스'), '우주소녀', '다영'), '원곡 가수라도 with 뒤면 함께(다영 WAGTD)');
ck(has(P('#켄 선배님과 FREAK ALARM #ALPHADRIVEONE #ALD1 #FREAK_ALARM #KEN', '알파드라이브원'), '빅스', '켄'), '#켄 선배님과 → 빅스 켄(한 글자 + 함께 표시)');
ck(!hasG(P('홀씨가 됐다구 #PRIMROSE #프림로즈 #NAHYUN #나현 #IU #아이유 #홀씨 #challenge #dance', '프림로즈'), '아이유'), '#아이유 #홀씨 #challenge → 아이유는 원곡 가수(게스트 아님)');
ck(!hasG(P('#Blue by #KIMTAEWOO #김태우 #god #DxS #도겸X승관 #소야곡', '세븐틴'), 'god'), 'by #KIMTAEWOO → 곡 크레딧(게스트 아님)');

// ④ 곡 주인 그룹
{ const r = P("[EXCLUSIVE] 아워벌스데이 신혜원의 아일릿 '체포하겠어' 챌린지 💗");
  // (신혜원'의'처럼 조사 붙은 이름이 멤버로 안 잡히는 건 기존 한계 — 여기선 곡 주인 제외만 본다)
  ck(hasG(r, '아워벌스데이') && !hasG(r, '아일릿'), "신혜원의 아일릿 '체포하겠어' 챌린지 → 아일릿은 곡 주인"); }
{ const r = P('[선공개] 엔믹스 댄스 챌린지에 도전하는 은가은 VS 박서진! [살림하는 남자들] | KBS 방송');
  ck(!!r && r.hold && !r.primaryGroup, '엔믹스 챌린지에 도전하는 비아이돌 → 보류'); }
ck(hasG(P("'복부'대공 '윤산'의 에이티즈 'BAD' 챌린지"), '에이티즈'), "'윤산'의 에이티즈 'BAD' 챌린지 → 에이티즈 그대로(보류 아님)");
ck(hasG(P("건욱 탐정과 함께하는 ADP 'CRASH' 챌린지 #MCOUNTDOWN #ALLDAYPROJECT #박건욱"), '올데이프로젝트'), "함께하는 ADP 'CRASH' 챌린지 → 올데이프로젝트 출연 유지");
ck(!hasG(P("리센느 원이 'SPAGHETTI' 챌린지 직캠 RESCENE WONI [251206 미니팬미팅] #lesserafim #eat_it_up_spaghetti"), '르세라핌'), '직캠의 해시태그 원곡 그룹(#lesserafim) → 제외');
ck(hasG(P('go viral #CRAVITY #SERIM #BOYNEXTDOOR #VIRAL #VIRAL_Challenge'), '보이넥스트도어'), '일반 챌린지의 원곡 그룹은 유지(같이 나오는 게 보통)');

// ⑤ 떠난 그룹·애칭·일반 낱말
{ const r = P('LNGSHOT huh This is LNGSHOT #LNGSHOT #Saucin #SHOTCALLERS @JayPark0425 #박재범 #JayPark', undefined, '2026-09-01');
  ck(!hasG(r, '2PM'), '#박재범 (2026) → 2PM 아님(2010 탈퇴)'); }
ck(!hasG(P('프리큐큐 #에이핑크 #Apink #오하영 #하영 #HaYoung'), '프로미스나인'), '#오하영 #하영 → 프로미스나인 하영 아님(잡힌 그룹 멤버 애칭)');
ck(!hasG(P('[쇼챔1분직캠] idntt - eunchan (아이덴티티 - 은찬)의 ＜It\'s Not Over＞ #idntt #eunchan #은찬'), '템페스트'), '#은찬(조은찬 애칭) → 템페스트 은찬 아님');
ck(!has(P('pov: #THEBOYZ is our new crew', '피원하모니'), '더보이즈', '뉴'), '"new crew"의 new → 더보이즈 뉴 아님');
ck(has(P('Ten used the snow filter! #WayV #威神V'), '웨이션브이', '텐'), '"Ten used…" → 웨이션브이 텐 유지');
ck(!hasG(P('I DONT CARE #BabyDONTCry #BDC #베돈크 #IDONTCARE'), '비디씨'), '#BDC는 베이비돈크라이 표기가 있으면 그룹 비디씨 아님');
ck(!hasG(P('#WHIB#휘브#JUNMIN#준민 #WONJUN#원준'), '싸이커스'), '#JUNMIN #준민(휘브 미등록 멤버) → 싸이커스 준민 아님');

// ⑥ 자체 채널 멤버 해시태그 — 게스트 그룹만 제목에 있어도 채널 멤버(#HYUI)를 놓치지 않기
ck(has(P('#StrayKids #한 선배님 goes "O-RLY?" | #HYUI', '넥스지', '2025-05-01'), '넥스지', '휴이') && has(P('#StrayKids #한 선배님 goes "O-RLY?" | #HYUI', '넥스지', '2025-05-01'), '스트레이키즈', '한'), '넥스지 채널 #StrayKids #한 … #HYUI → 넥스지 휴이 + 스키즈 한');

// ⑦ 조사 붙은 한글 이름(그룹 확정 범위) · 동명이인 방어
ck(has(P("[EXCLUSIVE] 아워벌스데이 신혜원의 아일릿 '체포하겠어' 챌린지 💗"), '아워벌스데이', '신혜원'), '"신혜원의" → 아워벌스데이 신혜원(조사)');
ck(has(P('X맛 젤리를 먹은 투어스 신유&도훈의 반응 | #팅글인터뷰'), '투어스', '도훈'), '"도훈의" → 투어스 도훈');
ck(!has(P('피프티피프티 하나도 모르는 퀴즈 #FIFTYFIFTY'), '피프티피프티', '하나'), '"하나도"(일상어) → 피프티피프티 하나 아님');
ck(!hasG(P('#xikers #세은 님과 BLUSH🌸 @xikers_official #싸이커스 #SEEUN #WOOAH #우아 #LUCY #루시', '우아'), '스테이씨'), '#xikers #세은 → 스테이씨 세은 아님(잡힌 그룹 멤버)');
ck(!hasG(P('#XODIAC #규민 선배님과 Dopamine 폭발💥#AHOF #아홉 #JEONGWOO #서정우 #Sugar_High', '아홉'), '트레저'), '#JEONGWOO(서정우 Seo Jungwoo) → 트레저 정우 아님(로마자 흔들림 포함)');
ck(!hasG(P('#루네이트 #LUN8 #나비 #Butterfly', '루네이트'), '시크릿넘버'), '#나비(루네이트 곡) → 시크릿넘버 나비 아님');

// ⑧ tvN 예능 '온앤오프' 디글 꼬리표는 그룹 ONF가 아니다(정식 ONF 표기는 그대로)
ck(!hasG(P('[#온앤오프] 승윤의 싱어게인 ON🎤 음악인들이 거쳐간 인디밴드의 성지에 금의환향한 이승윤✨'), '온앤오프'), '"[#온앤오프]" 예능 클립 → 그룹 온앤오프 아님');
ck(has(P('온앤오프 효진 직캠'), '온앤오프', '효진'), '"온앤오프 효진 직캠" → 그룹 온앤오프 그대로');

console.log(pass ? '\n✅ 챌린지 태깅 테스트 통과' : '\n❌ 실패 있음');
process.exit(pass ? 0 : 1);
