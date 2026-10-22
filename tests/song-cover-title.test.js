// 곡 창 "제목으로 찾은 커버" 판정(shared.js _songCoverByTitle) 불변식 (2026-10-22)
// 사용자: "곡 정보 창에서 커버한 영상까지 나오면 좋겠다" — 아이유 '잔소리'를 열면 커버 탭이 없었다.
// 커버 영상(아이즈원 불후의 명곡·츄×10CM·호이유)이 DB엔 있는데 cover_of_* 태깅이 없어서. 제목이 '잔소리'를 담은
// 영상 89개 중 대부분은 "엄마 잔소리"·STOP 챌린지라, 곡으로 부른 것만 골라야 한다. 제목은 전부 실제 DB 표본.
// 실행: node tests/song-cover-title.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') + '\nthis.f=_songCoverByTitle;this.B=_songBase;', ctx);
let pass = 0, fail = 0;
const is = (title, want, why, extra) => {
  const got = ctx.f(Object.assign({ title }, extra || {}), ctx.B('잔소리 (With 2AM 슬옹)'));
  if (got === want) pass++; else { fail++; console.error(`❌ ${why}\n   제목 ${title}\n   기대 ${want} 실제 ${got}`); }
};
// 곡으로 부른 것 — 커버로 잡아야 함
is('아이즈원 - 잔소리 [불후의 명곡2 전설을 노래하다/Immortal Songs 2] 20200808', true, '"가수 - 곡명 [프로그램]"');
is('💿츄x10CM - 잔소리 | 지켜츄 버츄킹 EP.2', true, '"가수 - 곡명 | 코너"');
is('호이유 - 잔소리 (feat.건옹) #원어스 #ONEUS #서호 #건희', true, '"가수 - 곡명 (feat.)"');
is('[숏츠] 아이유 - 잔소리 김호영 이지혜 ver. [더 시즌즈-이효리의 레드카펫] | KBS 방송', true, '"곡명 OOO ver."');
is('임슬옹 1승(?) 이렇게 높은 노래였다니😅 초토화된 〈잔소리〉 ㅋㅋ 바라던 바다', true, '꺾쇠 안 곡명');
is('IU & Seul Ong - Nagging (아이유 & 슬옹 - 잔소리) @ SBS Inkigayo 인기가요', true, '괄호 안 한글 표기의 대시 뒤');
// 곡명이 낱말로만 든 것 — 커버 아님
is('[#나혼자산다] 안 맞아도 너무 안 맞아! 잔소리 대마왕 민호와 리액션 맛집 키의 찐친 모먼트', false, '낱말 "잔소리"');
is('잔소리 안 듣기 미선 실패!😱 #미선임파서블 #박미선 선배님의 애정어린 잔소리! #STOPChallenge', false, 'STOP 챌린지');
is('난 자취하길 참 잘했다 생각해 w. 엄마 잔소리', false, '"엄마 잔소리"');
is('회사에서 잔소리 들었을 땐 SNEAKERS를 들어보세요 #루네이트', false, '다른 곡 홍보 문구');
is('[예고] TWS 경민 "투어스 막내의 잔소리 탈출기" | #순간뽀짝', false, '따옴표 안이 곡명이 아니라 문장');
// 곡 키(song_keys)가 있으면 그게 우선
is('아무 제목', true, '남의 같은 곡 키 = 커버', { song_keys: ['아이즈원:잔소리'] });
is('아이즈원 - 잔소리', false, '다른 곡에만 연결된 영상은 제외', { song_keys: ['아이즈원:fiesta'] });
// 짧은 영어 곡명은 대시 뒤로는 안 잡는다(따옴표만)
{
  const b = ctx.B('ON');
  const t1 = ctx.f({ title: 'BTS - ON TV 출연 모음' }, b), t2 = ctx.f({ title: "스트레이 키즈 'ON' 커버" }, b);
  if (!t1 && t2) pass++; else { fail++; console.error(`❌ 짧은 곡명: 대시 뒤 ${t1}(기대 false) · 따옴표 ${t2}(기대 true)`); }
}
console.log(`${fail ? '❌' : '✅'} 곡 창 제목 커버 판정 ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
