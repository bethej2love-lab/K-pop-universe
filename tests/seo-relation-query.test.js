// 실제 빌더 조회 함수를 실행하되 외부 요청 대신 PK 범위가 다른 데이터로 응답한다.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const src = fs.readFileSync(path.join(__dirname, '../build_group_pages.js'), 'utf8');
const from = src.indexOf('async function fetchRelationRows() {');
const until = src.indexOf('\n}\n', from) + 2;
assert(from >= 0 && until > from);
const code = src.slice(from, until);
const fixture = Array.from({length: 12007}, (_, i) => ({id: String(i).padStart(6,'0'), group_ko:'group', content_flag: i === 4 ? 'hidden' : null}));
fixture[5].group_ko = 'not-in-roster';
let calls = 0, fail = false;
const ctx = vm.createContext({URL, AbortSignal, console: {log(){}}, SB_URL: 'https://fixture.invalid', SB_KEY:'not-a-key', groups: {group:{}},
  fetch: async url => {
    calls++; if (fail) return {ok:false,status:500,json:async()=>({code:'57014',message:'statement timeout'})};
    const p = new URL(url).searchParams;
    let rows = fixture.filter(r => p.getAll('id').every(v=>v.startsWith('gt.') ? r.id > v.slice(3) : r.id <= v.slice(4)));
    if (p.has('or')) {
      assert(p.getAll('id').length > 0, '희소 쿼리는 ID 구간 경계 필수');
      assert(rows.length <= 5000, '한 후보 요청이 훑을 최대 원본 구간');
      // 몇 구간은 드물고, 첫 구간은 1000개 이상이라 구간 내부 페이지네이션도 검사.
      rows = rows.filter(r => +r.id < 1500 || +r.id % 53 === 0);
    }
    const offset = +(p.get('offset') || 0), limit = +p.get('limit');
    return {ok:true,json:async()=>rows.slice(offset, offset+limit)};
  }
});
(async()=>{
  vm.runInContext(code,ctx);
  const got = await ctx.fetchRelationRows();
  const expected = fixture.filter(r=>(+r.id < 1500 || +r.id % 53 === 0)&&!r.content_flag&&r.group_ko==='group');
  assert.deepEqual(Array.from(got, r=>r.id), expected.map(r=>r.id), '경계·내부 페이지에 누락/중복 없음, 기존 숨김/로스터 필터 유지');
  assert(calls >= 7);
  fail = true;
  await assert.rejects(ctx.fetchRelationRows(), /Supabase 500\/57014: statement timeout/, '빈 데이터 성공으로 위장하지 않고 기존 페이지 보존 경로로 전달');
  console.log('PASS SEO relation query: bounded windows, multi-page, sparse/tail rows, filters and DB failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
