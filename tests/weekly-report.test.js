// 모듈 실행·DB 조회·Issue 발행 없이 실제 집계 코드와 Supabase error 응답 처리 검사.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const src = fs.readFileSync(path.join(__dirname, '../tools/weekly_report.mjs'), 'utf8');
const helpers = src.slice(src.indexOf('async function safeCount('), src.indexOf('async function main('));
const query = src.match(/const \[newVideos,[\s\S]*?await Promise\.all\(\[[\s\S]*?\n  \]\);/)[0];
const warnings = [];
const ctx = vm.createContext({console: {warn: text => warnings.push(text)}, weekAgo: new Date(), weekAgoStr: '2026-10-13',
  sb: {from(table) {
    const builder = {
      select(column, opts) {
        if (table === 'yt_view_milestones') assert.equal(column, 'video_id', '복합 PK 표에 없는 id를 조회하면 안 됨');
        assert.equal(opts.head, true); assert.equal(opts.count, 'exact'); return this;
      },
      gte() {return this;}, eq() {return this;}, is() {return this;},
      then(resolve) {return Promise.resolve({count: 7, error: null}).then(resolve);}
    }; return builder;
  }}
});
(async () => {
  vm.runInContext(helpers, ctx);
  assert.equal(await vm.runInContext(`(async()=>{${query};return milestones;})()`, ctx), 7);
  assert.equal(await vm.runInContext(`safeCount(Promise.resolve({count:0,error:null}))`, ctx), 0);
  assert.equal(await vm.runInContext(`safeCount(Promise.resolve({count:null,error:{message:'missing column'}}))`, ctx), null);
  assert.equal(await vm.runInContext(`safeData(Promise.resolve({data:[],error:{message:'query failed'}}))`, ctx), null);
  assert.equal(await vm.runInContext(`safeCount(Promise.reject(new Error('network failed')))`, ctx), null);
  assert.equal(warnings.length, 3, '반환형 error와 네트워크 오류를 로그에 남김');
  console.log('PASS weekly report: actual count query, zero count, returned errors and thrown error');
})().catch(e=>{console.error(e);process.exitCode=1;});
