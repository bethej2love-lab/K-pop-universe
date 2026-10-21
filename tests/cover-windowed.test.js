const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '../admin.js'), 'utf8');
const from = src.indexOf('async function _ytSweepCoverV2(){');
const until = src.indexOf('    if(!rows?.length)', from);
assert(from >= 0 && until > from);
// 실제 함수의 조회부까지만 실행. 매칭/쓰기/확인창은 이 검사에 포함하지 않는다.
const code = src.slice(from, until) + 'return rows;}finally{if(btn)btn.disabled=false;}}';
(async () => {
  for (const since of [null, '2026-10-19T00:00:00Z']) {
    const trace = []; let windows = 0;
    const query = {select() {return this;}, or() {return this;}, order() {return this;}, gt(col,val) {trace.push([col,val]);return this;}};
    const ctx = vm.createContext({sb: {from: () => query}, _YT_TABLE: 'yt_channel_videos', document: {getElementById: () => null},
      _ytSetProg: () => {}, _coverLoadChartRows: async () => [], _coverBuildIndex: () => {}, _coverIndex: new Map(),
      _hasCoverManualCol: true, _admRoutineScopeSince: () => since, _coverManualColMissing: () => false,
      _sbFetchAll: () => {throw new Error('희소 증분 조회를 상한 없는 경로로 보냄');},
      _sbFetchAllWindowed: async (build, size) => {assert.equal(size, 5000);build();windows++;return {data:[{id:'fixture'}],error:null};}
    });
    vm.runInContext(code, ctx);
    const data = await ctx._ytSweepCoverV2();
    assert.equal(windows, 1); assert.equal(data.length, 1);
    assert.deepEqual(trace, since ? [['created_at',since]] : [], '증분 날짜 조건 보존');
  }
  console.log('PASS cover query: bounded full/incremental reads, incremental date preserved, no writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
