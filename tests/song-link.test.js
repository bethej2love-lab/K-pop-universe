// 영상 ↔ 곡 연결 규칙(shared.js _songLinkBases) 불변식 (2026-10-16)
// 실데이터(아이브·에스파·뉴진스 각 1,000개) 실측에서 실제로 걸렸던 함정을 고정한다.
// 실행: node tests/song-link.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') + '\nthis.f=_songLinkBases;this.L=_songListFromDisco;this.B=_songBase;', ctx);
const songsOf = g => ctx.L(Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'disco/g', g + '.json'), 'utf8')).g || {}));
let pass = 0, fail = 0;
const eq = (got, want, why) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { fail++; console.error(`❌ ${why}\n   기대 ${JSON.stringify(want)}\n   실제 ${JSON.stringify(got)}`); } };
const NJ = songsOf('뉴진스'), IVE = songsOf('아이브');
const nj = t => ctx.f(t, NJ, ['뉴진스', 'NewJeans']), ive = t => ctx.f(t, IVE, ['아이브', 'IVE']);
// 기본형: 버전·피처링 꼬리는 같은 곡
eq(ctx.B('Supernatural (Part.1)'), ctx.B('Supernatural'), '끝 괄호(파트 표기)는 같은 곡');
eq(ctx.B('LOVE DIVE (Shin Sakiura Remix)'), 'lovedive', '리믹스는 원곡과 같은 키');
eq(ctx.B('Kitsch (English Ver.)'), 'kitsch', '영어 버전은 원곡과 같은 키');
// 따옴표 = 곡명
eq(nj("[MPD직캠] 뉴진스 직캠 4K 'Hype Boy' (NewJeans FanCam)"), ['hypeboy'], '직캠 따옴표 곡명');
eq(nj("뉴진스와 함께할 새로운 계절을 기다리며 'Attention'부터 'OMG'까지 몰아보기"), ['attention', 'omg'], '따옴표 여러 개 = 여러 곡');
// 함정 ① 곡명 = 그룹명
eq(nj('[Light Jeans] MINJI ELLE Photoshoot Behind | NewJeans'), [], "곡 'New Jeans'가 그룹명 NewJeans에 걸리면 안 됨");
eq(nj("뉴진스 'New Jeans' 무대"), ['newjeans'], '곡명=그룹명이라도 따옴표로 감싸면 곡');
eq(nj('NewJeans(뉴진스) - Hurt @인기가요 inkigayo 20220828'), ['hurt'], '그룹명 대신 실제 곡(Hurt)을 잡는다');
// 함정 ② 해시태그 나열
eq(ive('혼자가 아닌 둘이기니 with #RedVelvet #조이 #IVE #REI #ATTITUDE #REBELHEART'), [], '해시태그에 곡 여러 개 = 모름');
eq(ive('기다렸을 거야 넌 #IVE #아이브 #ANYUJIN #Force #Shorts'), ['force'], '해시태그에 곡이 딱 하나면 그 곡');
// 함정 ③ 메들리
eq(ive("[2024 가요대전 4K] 아이브 장원영 'LOVE DIVE +해야 + IVE EMPATHY' (IVE JANG WONYOUNG FanCam)"), ['lovedive', '해야'], '한 따옴표 안 메들리 = 여러 곡');
// 영어 곡명은 단어 단위로만
const TW = songsOf('트와이스');
eq(ctx.f('[Dicon] "채영’s Special Day" (디아이콘 : 트와이스)', TW, ['트와이스', 'TWICE']), [], "'ICON'이 'Dicon' 안에 걸리면 안 됨");
eq(ctx.f('[#음중직캠] IVE LIZ (아이브 리즈) – REBEL HEART FanCam | 쇼! 음악중심', IVE, ['아이브', 'IVE']), ['rebelheart'], '띄어쓴 영어 곡명은 단어 경계로 잡힘');
// 짧은 곡명은 따옴표 없이 안 믿는다
eq(ive('아이브 해야 할 일 브이로그'), [], "2글자 곡명('해야')은 따옴표 없이는 안 잡는다");
console.log(fail ? `💥 곡 연결 테스트 실패 ${fail}건 (통과 ${pass})` : `✅ 곡 연결 테스트 통과 ${pass}건`);
process.exit(fail ? 1 : 0);
