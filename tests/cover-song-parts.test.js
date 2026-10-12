// 원곡 곡명 여러 곡 구분(_coverSongParts) 회귀 테스트 (2026-10-12)
// cover_of_song에 여러 곡은 ';'로 이어 적는다. 쉼표는 곡 제목에 흔해서 구분자가 아니고("안돼, 난 안돼"),
// 괄호 안의 ';'(불가사의; 不可思議)는 곡명 일부다. 화면의 "같은 곡 커버" 묶음이 이 헬퍼로 곡을 나눈다.
// 실행: node tests/cover-song-parts.test.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = /function _coverSongParts\(s\)\{[\s\S]*?\n\}/.exec(src);
let fail = 0;
const ck = (c, msg) => { console.log((c ? '✓ ' : '✗ 실패: ') + msg); if (!c) fail++; };
ck(!!m, '_coverSongParts 존재');
const f = m ? new Function(m[0] + ';return _coverSongParts;')() : () => [];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
ck(eq(f('Likey; 약속해요'), ['Likey', '약속해요']), "';'로 여러 곡 분리");
ck(eq(f('안돼, 난 안돼 (No Way)'), ['안돼, 난 안돼 (No Way)']), '쉼표는 구분자 아님(곡 제목 일부)');
ck(eq(f('Fact Check (불가사의; 不可思議)'), ['Fact Check (불가사의; 不可思議)']), "괄호 안 ';'는 곡명 일부");
ck(eq(f('영웅 (英雄; Kick It); Cherry Bomb'), ['영웅 (英雄; Kick It)', 'Cherry Bomb']), '괄호 밖만 자름');
ck(eq(f(''), []) && eq(f(null), []), '빈 값');
ck(/_coverSongParts\(v\.cover_of_song\)/.test(src), '같은 곡 커버 묶음이 곡 단위로 비교');
console.log(`\n${fail === 0 ? '✅' : '❌'} ${fail} 실패`);
process.exit(fail ? 1 : 0);
